import { writeFile, unlink } from "node:fs/promises";
import { join, basename } from "node:path";
import { buildApp } from "../../../../server/src/app.js";
import { prisma } from "../../../../server/src/lib/prisma.js";
if (process.env.NODE_ENV !== "test" || !/\/vitalis_qa(?:\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("Use somente o banco vitalis_qa e NODE_ENV=test.");
const app = await buildApp();
await app.ready();
const checks: Array<{id: string; passed: boolean; observed: unknown}> = [];
const check = (id: string, passed: boolean, observed: unknown) => checks.push({id, passed, observed});
let userId = "", avatarFile = "";
try {
  const email = `auditoria-${crypto.randomUUID()}@example.com`;
  const response = await app.inject({method: "POST", url: "/v1/auth/register", payload: {name: "Auditoria Sprint", email, password: "qa-12345678", passwordConfirmation: "qa-12345678"}});
  if (response.statusCode !== 201) throw new Error("Cadastro QA falhou");
  const account = response.json().data;
  userId = account.profile.id;
  const headers = {authorization: `Bearer ${account.tokens.accessToken}`};
  const request = async (method: "GET" | "POST" | "PATCH", url: string, payload?: unknown) => app.inject({method, url, headers, ...(payload ? {payload} : {})});
  const badEmail = await request("PATCH", "/v1/profile", {email: "alterado@example.com"});
  check("US-016.C2-api-email-inalteravel", badEmail.statusCode === 400, badEmail.statusCode);
  const profile = await request("PATCH", "/v1/profile", {name: "Auditoria Sprint", birthDate: "2000-10-03", weightKg: 70, heightCm: 175, gender: "Outro"});
  check("US-016-dados-e-idade", profile.statusCode === 200 && profile.json().data.age === 26, {status: profile.statusCode, age: profile.json().data.age});
  const goals = await request("PATCH", "/v1/goals", {calories: 2300, mealCalories: 600, weightKg: 65, dailyDeficit: 500});
  check("US-022.C1-C5-metas-persistidas", goals.statusCode === 200 && goals.json().data.mealCalories === 600 && goals.json().data.calories === 2300, {status: goals.statusCode, calories: goals.json().data.calories, mealCalories: goals.json().data.mealCalories});
  const calories: Record<string, number> = {};
  for (const type of ["walk", "run", "cycling"]) {
    const activity = await request("POST", "/v1/activities", {id: crypto.randomUUID(), type, date: "2026-10-03", durationSeconds: 1800, distanceMeters: 5000, route: []});
    calories[type] = activity.json().data?.calories;
    check(`US-029.C1-C3-${type}`, activity.statusCode === 201 && calories[type] > 0, {status: activity.statusCode, calories: calories[type]});
  }
  check("US-029.C3-calorias-por-tipo", calories.walk === 129 && calories.run === 305 && calories.cycling === 276, calories);
  await prisma.dailySteps.createMany({data: [{userId, date: new Date("2026-10-03"), steps: 7000}, {userId, date: new Date("2026-09-26"), steps: 3500}]});
  const stats = await request("GET", "/v1/activities/stats?period=week&date=2026-10-03");
  const s = stats.json().data;
  check("US-031.C4-C5-estatisticas-semanais", s.stepAverage === 1000 && s.previousStepAverage === 500 && s.trend === "up" && s.trendPercent === 100 && s.calories === 710, {stepAverage:s.stepAverage, previousStepAverage:s.previousStepAverage, trend:s.trend, trendPercent:s.trendPercent, calories:s.calories});
  const month = (await request("GET", "/v1/activities/stats?period=month&date=2026-10-03")).json().data;
  check("US-031.C4-estatisticas-mensais", month.steps === 10500 && month.calories === 710, {steps:month.steps, calories:month.calories});
  for (const [date, weightKg] of [["2026-09-25",72],["2026-09-30",71],["2026-10-03",70]] as const) await request("POST", "/v1/weights", {id:crypto.randomUUID(), date, weightKg});
  const weights = (await request("GET", "/v1/weights/comparison?date=2026-10-03")).json().data;
  check("US-038-US-039-comparacao-e-previsao", weights.currentWeek.length === 2 && weights.previousWeek.length === 1 && weights.goal.estimatedWeeks === 11, weights);
  const boundary = "vitalis-audit-boundary";
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII=", "base64");
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n`), png, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const avatar = await app.inject({method:"POST",url:"/v1/profile/avatar",headers:{...headers,"content-type":`multipart/form-data; boundary=${boundary}`},payload});
  const avatarUrl = avatar.json().data?.avatarUrl;
  if (avatarUrl) avatarFile = join(process.cwd(), "storage", "avatars", basename(new URL(avatarUrl).pathname));
  check("US-016.C1-upload-online", avatar.statusCode === 200 && Boolean(avatarUrl), {status:avatar.statusCode, hasAvatarUrl:Boolean(avatarUrl)});
  if (avatarUrl) {
    const image = await request("GET", new URL(avatarUrl).pathname);
    check("US-016.C1-foto-acessivel", image.statusCode === 200 && image.rawPayload.equals(png), {status:image.statusCode, bytes:image.rawPayload.length});
  }
  await prisma.activity.createMany({data:Array.from({length:997},(_,i)=>({id:crypto.randomUUID(),userId,type:i%2?"run":"walk",date:new Date("2026-10-03"),durationSeconds:60,distanceMeters:100,calories:10}))});
  const seededActivities = await prisma.activity.count({where:{userId,deletedAt:null}});
  const pagination = [];
  for (const sort of ["date","type"]) {
    let cursor: string | null = null, pages=0;
    const ids: string[] = [];
    do {
      const page = await request("GET", `/v1/activities?limit=100&sort=${sort}${cursor?`&cursor=${cursor}`:""}`);
      if (page.statusCode !== 200) throw new Error("Paginação QA falhou");
      const body=page.json(); ids.push(...body.data.map((r:{id:string})=>r.id));
      cursor=body.meta.nextCursor; pages++;
    } while(cursor && pages<12);
    const observed={sort,pages,returned:ids.length,unique:new Set(ids).size,complete:!cursor};
    pagination.push(observed);
    check(`RNF6-paginacao-completa-${sort}`,ids.length===1000 && new Set(ids).size===1000 && !cursor,observed);
  }
  await app.listen({host:"127.0.0.1",port:0});
  const address=app.server.address();
  if (!address || typeof address === "string") throw new Error("Endereço HTTP inválido");
  const samples: Array<{endpoint:string;status:number;ms:number}> = [];
  for (let i=0;i<20;i++) {
    const endpoint=["/v1/profile","/v1/goals","/v1/activities?limit=100","/v1/dashboard/daily?date=2026-10-03"][i%4];
    const start=performance.now();
    const r=await fetch(`http://127.0.0.1:${address.port}${endpoint}`,{headers});
    await r.arrayBuffer();
    samples.push({endpoint,status:r.status,ms:Math.round((performance.now()-start)*100)/100});
  }
  for(let i=0;i<5;i++) {
    const start=performance.now();
    const r=await fetch(`http://127.0.0.1:${address.port}/v1/water`,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({id:crypto.randomUUID(),amountMl:200,date:"2026-10-03",time:"12:00"})});
    await r.arrayBuffer(); samples.push({endpoint:"POST /v1/water",status:r.status,ms:Math.round((performance.now()-start)*100)/100});
  }
  const report={createdAt:new Date().toISOString(),environment:"PostgreSQL vitalis_qa; Fastify inject e HTTP loopback. Sem rede móvel/aparelho.",checks,seededActivities,pagination,http:{samples,maxMs:Math.max(...samples.map(x=>x.ms)),allUnder2Seconds:samples.every(x=>x.ms<=2000),allSuccessful:samples.every(x=>x.status<300)},passed:checks.filter(x=>x.passed).length,total:checks.length};
  await writeFile("../docs/qa/evidence/correcoes-sprint1-2026-10-04/api-confirmacao.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
} finally {
  if (userId) await prisma.user.delete({where:{id:userId}});
  if (avatarFile) await unlink(avatarFile).catch(()=>{});
  await app.close(); await prisma.$disconnect();
}

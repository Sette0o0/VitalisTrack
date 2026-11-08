import { writeFile,readFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import pg from 'pg';
if(!process.env.DATABASE_URL?.includes('/vitalis_sprint22'))throw new Error('Exclusive QA database required');
const root=new URL('../../artifacts/sprint22-20261107/',import.meta.url);const app=await buildApp();await app.ready();
const account=await app.inject({method:'POST',url:'/v1/auth/register',payload:{name:'QA Load 22',email:`load22-${crypto.randomUUID()}@example.com`,password:'qa-12345678',passwordConfirmation:'qa-12345678'}});if(account.statusCode!==201)throw new Error(account.body);const user=account.json().data.profile.id,token=account.json().data.tokens.accessToken,secondary=crypto.randomUUID();
const headers={authorization:`Bearer ${token}`};const created=await app.inject({method:'POST',url:'/v1/profiles',headers,payload:{id:secondary,name:'QA Family'}});if(created.statusCode!==201)throw new Error(created.body);
const mutations=Array.from({length:900},(_,i)=>({mutationId:crypto.randomUUID(),profileId:i%2?secondary:user,entity:'wellbeing',action:'upsert',clientUpdatedAt:'2000-01-01T00:00:00Z',payload:{id:crypto.randomUUID(),kind:'sleep',data:{date:'2026-11-07',durationMinutes:400+i%100}}}));
let next=0,failures=0;const timings:number[]=[];
await Promise.all(Array.from({length:8},async()=>{while(next<mutations.length){const m=mutations[next++]!;const start=performance.now();const r=await app.inject({method:'POST',url:'/v1/sync',headers,payload:{mutations:[m]}});timings.push(performance.now()-start);if(r.statusCode!==200||r.json().data[0]?.status!=='applied')failures++;}}));
const before=await prisma.wellbeingRecord.findMany({where:{userId:user},select:{id:true,updatedAt:true,revision:true}});
for(const m of mutations.slice(0,100)){const start=performance.now();const r=await app.inject({method:'POST',url:'/v1/sync',headers,payload:{mutations:[m]}});timings.push(performance.now()-start);if(r.json().data[0]?.status!=='applied')failures++;}
const after=await prisma.wellbeingRecord.findMany({where:{userId:user},select:{id:true,updatedAt:true,revision:true}});const map=new Map(before.map(r=>[r.id,r]));timings.sort((a,b)=>a-b);const counts=await Promise.all([user,secondary].map(profileId=>prisma.wellbeingRecord.count({where:{profileId}})));
const load={operations:1000,failures,rows:after.length,perProfile:counts,idempotent:after.every(r=>map.get(r.id)?.updatedAt.getTime()===r.updatedAt.getTime()&&map.get(r.id)?.revision===r.revision),p95Ms:timings[Math.ceil(timings.length*.95)-1],maxMs:timings.at(-1),transport:'Fastify inject, exclusive local PostgreSQL; not 4G'};await writeFile(new URL('load.json',root),JSON.stringify(load,null,2));
await prisma.user.delete({where:{id:user}});await app.close();
// Apply the old schemas with sentinel records, then the new migration, in a disposable schema.
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{
 await client.query('CREATE SCHEMA s22_legacy_probe');await client.query('SET search_path TO s22_legacy_probe');
 for(const dir of ['20260921000425_init','20261026000100_sprint2_profiles'])await client.query(await readFile(new URL('../prisma/migrations/'+dir+'/migration.sql',import.meta.url),'utf8'));
 const uid=crypto.randomUUID(),aid=crypto.randomUUID();
 await client.query('INSERT INTO "User" (id,email,"passwordHash","updatedAt") VALUES ($1,$2,$3,now())',[uid,'legacy-s22@example.com','synthetic-unused']);
 await client.query('INSERT INTO "Profile" (id,"userId","isPrimary",name,"avatarPath","updatedAt") VALUES ($1,$1,true,$2,$3,now())',[uid,'QA Legacy','/uploads/qa-synthetic.png']);
 await client.query('INSERT INTO "Goals" ("profileId","userId",steps,"updatedAt") VALUES ($1,$1,12345,now())',[uid]);
 await client.query('INSERT INTO "Activity" (id,"userId","profileId",type,date,"durationSeconds","distanceMeters",calories,"updatedAt") VALUES ($1,$2,$2,$3,$4,60,100,5,now())',[aid,uid,'run','2026-11-07']);
 const before=(await client.query('SELECT id,"profileId","durationSeconds","distanceMeters" FROM "Activity"')).rows;
 await client.query(await readFile(new URL('../prisma/migrations/20261107000100_sprint22/migration.sql',import.meta.url),'utf8'));
 const after=(await client.query('SELECT id,"profileId","durationSeconds","distanceMeters",visibility,"heartRate" FROM "Activity"')).rows;
 const preserved=JSON.stringify(before)===JSON.stringify(after.map(({visibility:_,heartRate:__,...r})=>r));
 const report={preserved,privateDefault:after[0].visibility==='private',heartRateAbsent:after[0].heartRate===null,avatarPreserved:(await client.query('SELECT "avatarPath" FROM "Profile"')).rows[0].avatarPath==='/uploads/qa-synthetic.png',goalPreserved:(await client.query('SELECT steps FROM "Goals"')).rows[0].steps===12345};await writeFile(new URL('migration-upgrade.json',root),JSON.stringify(report,null,2));
 if(!Object.values(report).every(Boolean))throw new Error('Migration preservation failed');
}finally{await client.query('SET search_path TO public');await client.query('DROP SCHEMA IF EXISTS s22_legacy_probe CASCADE');await client.end();}
console.log(JSON.stringify(load));if(failures>=10||after.length!==900||!load.idempotent)process.exitCode=1;

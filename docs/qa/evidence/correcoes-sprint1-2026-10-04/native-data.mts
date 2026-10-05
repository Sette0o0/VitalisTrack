import { prisma } from "../../../../server/src/lib/prisma.js";
import { writeFile, readdir } from "node:fs/promises";
if (process.env.NODE_ENV !== "test" || !/\/vitalis_qa(?:\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("Use banco QA.");
const accounts = [];
for (const api of [24,36]) {
 const user=await prisma.user.findUniqueOrThrow({where:{email:`sprint1-api${api}-20261004@example.com`}});
 const profile=await prisma.profile.findUniqueOrThrow({where:{userId:user.id}});
 const avatarOperations=(await prisma.processedMutation.findMany({where:{userId:user.id},select:{mutationId:true,result:true}})).filter(x=>x.result&&typeof x.result==="object"&&"kind" in x.result&&x.result.kind==="avatar");
 accounts.push({api,userId:user.id,profile,avatarOperations,avatarFiles:(await readdir("storage/avatars")).filter(x=>x.startsWith(user.id+"-")),
  meals:await prisma.meal.findMany({where:{userId:user.id}}),water:await prisma.waterEntry.findMany({where:{userId:user.id}}),
  activities:await prisma.activity.count({where:{userId:user.id,deletedAt:null}}),weights:await prisma.weightEntry.findMany({where:{userId:user.id},orderBy:{date:"asc"}}),
  sessions:await prisma.refreshSession.findMany({where:{userId:user.id},select:{id:true,createdAt:true,revokedAt:true,replacedById:true},orderBy:{createdAt:"asc"}}),
 });
}
await writeFile("../docs/qa/evidence/correcoes-sprint1-2026-10-04/native-server.json",JSON.stringify({at:new Date().toISOString(),accounts},null,2)+"\n");
console.log(JSON.stringify(accounts.map(x=>({api:x.api,avatars:x.avatarOperations.length,activeMeals:x.meals.filter(m=>!m.deletedAt).length,activities:x.activities}))));
await prisma.$disconnect();

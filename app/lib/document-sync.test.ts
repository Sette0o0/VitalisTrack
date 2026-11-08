import * as SQLite from 'expo-sqlite';
import { initDatabase, saveState, rememberProfiles, pendingCount } from './local-database';
import { synchronizeAccount } from './sync-engine';
import { saveDocument, findDocument } from './document-store';
import { apiRequest } from './api';
import { initialState } from '@/state/reducer';
import type { MedicalDocument, SyncPull } from '@vitalis/contracts';
jest.mock('expo-sqlite',()=>jest.requireActual('@/testing/sqlite').sqliteBridge());
jest.mock('expo-file-system',()=>({File:class {uri:string;constructor(value:string){this.uri=value;} get name(){return 'private-uuid.pdf';}}}));
jest.mock('./api',()=>({apiRequest:jest.fn()}));
jest.mock('./avatar-files',()=>({reconcileAvatar:()=>({})}));
const owner='00000000-0000-4000-8000-000000000001';
test('document sync sends the display name independently of the private file basename',async()=>{
 await initDatabase();const db=await SQLite.openDatabaseAsync('test');
 await db.execAsync('DELETE FROM kv;DELETE FROM outbox_v2;DELETE FROM medical_documents;DELETE FROM health_records;');
 await saveState({...initialState,userId:owner,profileId:owner});
 const profile={id:owner,name:'QA',isPrimary:true,updatedAt:'2026-11-08T00:00:00Z'};
 await rememberProfiles(owner,[profile]);
 const doc:MedicalDocument={id:'00000000-0000-4000-8000-000000000002',profileId:owner,name:'exame cardíaco QA.pdf',mimeType:'application/pdf',size:10,sha256:'a'.repeat(64),createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z',deletedAt:null,revision:'0'};
 await saveDocument(owner,owner,doc,'file:///private-uuid.pdf');
 const health:SyncPull={water:[],meals:[],activities:[],weights:[],steps:[],profile:null,goals:null,cursor:'2026-11-08T00:00:00Z',documentsVersion:1};
 jest.mocked(apiRequest).mockImplementation(async(path,options)=>{
  if(path==='/v1/profiles')return [profile];
  if(path==='/v1/documents'){
   const form=options!.body as FormData;
   expect(form.getAll('name')).toEqual([doc.name]);
   expect(form.getAll('file')).toHaveLength(1);
   return {...doc,revision:'1'};
  }
  if(path.includes('/documents/sync'))return {records:[{...doc,revision:'1'}],cursor:'1',hasMore:false};
  if(path.startsWith('/v1/sync'))return health;
  throw new Error(path);
 });
 await synchronizeAccount(owner);
 expect(await pendingCount(owner,owner)).toBe(0);
 expect((await findDocument(owner,owner,doc.id))!.name).toBe(doc.name);
});

import { act, render, waitFor } from '@testing-library/react-native';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { AppStateProvider, useAppState } from './app-state';
import { apiRequest, publicRequest } from '@/lib/api';
import { loadTokens } from '@/lib/session';
import { initDatabase, pendingCount, loadState, setActiveUser } from '@/lib/local-database';

jest.mock('expo-sqlite',()=>jest.requireActual('@/testing/sqlite').sqliteBridge());
jest.mock('@/lib/use-session-refresh',()=>({useSessionRefresh:jest.fn()}));
jest.mock('expo-sensors',()=>({Pedometer:{isAvailableAsync:async()=>false}}));
jest.mock('@/lib/session',()=>({loadTokens:jest.fn(async()=>null),saveTokens:jest.fn(async()=>{}),clearTokens:jest.fn(async()=>{}),tokenClaims:()=>({sub:'a'})}));
jest.mock('@/lib/api',()=>({apiRequest:jest.fn(),publicRequest:jest.fn()}));
jest.mock('@react-native-community/netinfo',()=>({__esModule:true,default:{fetch:jest.fn(async()=>({isConnected:false})),addEventListener:()=>()=>{}}}));
let context: ReturnType<typeof useAppState>;
function Probe(){context=useAppState();return null;}
const profile=(id='a')=>({id,name:'Pessoa Teste',email:`${id}@example.com`,birthDate:'2000-01-01',weightKg:70,heightCm:170,gender:'Outro',avatarUrl:null});
const loginResult=(id='a')=>({profile:profile(id),tokens:{accessToken:'access',refreshToken:'refresh',expiresIn:900}});
const emptyPull={water:[],meals:[],activities:[],weights:[],steps:[],profile:null,goals:null,cursor:'2026-10-03T12:00:00Z'};
beforeEach(async()=>{
 jest.clearAllMocks(); await initDatabase(); const db=await SQLite.openDatabaseAsync('test');await db.execAsync('DELETE FROM kv; DELETE FROM outbox_v2; DELETE FROM outbox;');setActiveUser(null);
 (loadTokens as jest.Mock).mockResolvedValue(null);(NetInfo.fetch as jest.Mock).mockResolvedValue({isConnected:false});(publicRequest as jest.Mock).mockResolvedValue(loginResult());
});
async function mount(){const view=render(<AppStateProvider><Probe/></AppStateProvider>);await waitFor(()=>expect(context.loading).toBe(false));return view;}
test('registros offline sobrevivem logout, troca de conta e reinício',async()=>{
 let view=await mount(); await act(async()=>context.login('a@example.com','12345678'));
 await act(async()=>context.dispatch({type:'WATER_ADD',value:{amountMl:500,date:'2026-10-03',time:'08:00'}}));
 expect(await pendingCount('a')).toBe(1);await act(async()=>context.logout());
 (publicRequest as jest.Mock).mockResolvedValue(loginResult('b'));await act(async()=>context.register('Outra','b@example.com','12345678','12345678'));
 expect(context.state.water).toHaveLength(0);expect(await pendingCount('a')).toBe(1);
 await act(async()=>context.logout());view.unmount();(loadTokens as jest.Mock).mockResolvedValue(loginResult().tokens);
 view=await mount();expect(context.state.water[0].amountMl).toBe(500);expect(context.state.authenticated).toBe(true);view.unmount();
});
test('pull em andamento preserva uma alteração local posterior ao push',async()=>{
 const view=await mount();await act(async()=>context.login('a@example.com','12345678'));
 (NetInfo.fetch as jest.Mock).mockResolvedValue({isConnected:true});
 let deliver: (value: unknown)=>void=()=>{};
 (apiRequest as jest.Mock).mockImplementation(()=>new Promise(resolve=>{deliver=resolve;}));
 let flight:Promise<void>;await act(async()=>{flight=context.syncNow();});
 await waitFor(()=>expect(apiRequest).toHaveBeenCalled());
 await act(async()=>context.dispatch({type:'WATER_ADD',value:{amountMl:200,date:'2026-10-03',time:'09:00'}}));
 await act(async()=>{deliver({...emptyPull,water:[]});await flight;});
 expect(context.state.water).toHaveLength(1);expect(await pendingCount('a')).toBe(1);expect((await loadState('a'))?.water).toHaveLength(1);view.unmount();
});
test('operações locais concorrentes acumulam os deltas de passos',async()=>{
 const view=await mount();await act(async()=>context.login('a@example.com','12345678'));
 await act(async()=>{await Promise.all([context.dispatch({type:'STEPS_INCREMENT',date:'2026-10-03',value:10}),context.dispatch({type:'STEPS_INCREMENT',date:'2026-10-03',value:15})]);});
 expect(context.state.dailySteps).toEqual([{date:'2026-10-03',steps:25}]);expect(await pendingCount('a')).toBe(2);view.unmount();
});

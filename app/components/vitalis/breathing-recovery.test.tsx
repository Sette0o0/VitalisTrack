import { render,act,fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import Breathing from '@/app/wellbeing/breathing';
import { initialState as mockInitialState } from '@/state/reducer';
import { getValue,setValue } from '@/lib/local-database';
let mockFocused=true;
jest.mock('@react-navigation/native',()=>({useIsFocused:()=>mockFocused}));
jest.mock('expo-router',()=>({router:{back:jest.fn()}}));
jest.mock('@/state/app-state',()=>({useAppState:()=>({state:{...mockInitialState,userId:'a',profileId:'a',authenticated:true}})}));
jest.mock('@/hooks/use-wellbeing',()=>({useWellbeing:()=>({save:jest.fn(async()=>{})})}));
jest.mock('@/lib/local-database',()=>({getValue:jest.fn(),setValue:jest.fn(async()=>{})}));
jest.mock('@/components/vitalis/focus-control',()=>({FocusControl:()=>null}));
test('leaving before a draft finishes loading must not overwrite the saved session',async()=>{let resolve!:(v:string)=>void;jest.mocked(getValue).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const ui=render(<PaperProvider><Breathing/></PaperProvider>);ui.unmount();await act(async()=>resolve(JSON.stringify({id:'00000000-0000-4000-8000-000000000001',startedAt:'2026-11-07T10:00:00Z',elapsedMs:90000})));expect(setValue).not.toHaveBeenCalled();});

test('a retained screen pauses active breathing time while another route is focused',async()=>{
 jest.useFakeTimers();mockFocused=true;jest.mocked(getValue).mockResolvedValue(null);
 const view=()=> <PaperProvider><Breathing/></PaperProvider>;
 const ui=render(view());await act(async()=>{});
 fireEvent.press(ui.getByLabelText('Iniciar ou retomar respiração'));
 act(()=>jest.advanceTimersByTime(3000));
 expect(ui.getByText('00:02:57')).toBeTruthy();
 mockFocused=false;ui.rerender(view());
 act(()=>jest.advanceTimersByTime(30000));
 mockFocused=true;ui.rerender(view());
 expect(ui.getByText('00:02:57')).toBeTruthy();
 expect(ui.getByLabelText('Iniciar ou retomar respiração')).toBeTruthy();
 ui.unmount();jest.useRealTimers();
});

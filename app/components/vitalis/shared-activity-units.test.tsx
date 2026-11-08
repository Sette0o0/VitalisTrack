import { render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import SharedActivities from '@/app/profile/shared-activities';
import { initialState as mockInitial } from '@/state/reducer';
jest.mock('expo-router',()=>({router:{back:jest.fn()},useLocalSearchParams:()=>({profileId:'friend'})}));
jest.mock('@/state/app-state',()=>({useAppState:()=>({state:{...mockInitial,unitSystem:'imperial'}})}));
jest.mock('@/hooks/use-online-profile',()=>({useOnlineProfile:()=>({data:[{id:'a',date:'2026-11-07',type:'walk',durationSeconds:600,distanceMeters:1000,calories:40}],error:'',reload:jest.fn(),request:jest.fn()})}));
test('shared activity distance respects the viewing profile unit preference',()=>{
 const ui=render(<PaperProvider><SharedActivities/></PaperProvider>);
 expect(ui.getByText(/0,62 mi/)).toBeTruthy();
 expect(ui.queryByText(/1 km/)).toBeNull();
});

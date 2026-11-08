import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';
import { initialState } from '@/state/reducer';
let mockState={...initialState,authenticated:true,userId:'account-a',profileId:'profile-a'};
jest.mock('@/state/app-state',()=>({AppStateProvider:({children}:any)=>children,useAppState:()=>({state:mockState})}));
jest.mock('expo-router',()=>{
 const React=jest.requireActual('react'),{Button}=jest.requireActual('react-native');
 const Stack=({children}:any)=>{const confirm=jest.requireActual('@/components/vitalis/confirmation').useConfirm();return React.createElement(React.Fragment,null,children,React.createElement(Button,{title:'Abrir confirmação de QA',onPress:()=>confirm('Dados do perfil anterior','Confirmação de uma ação antiga',async()=>{})}));};
 Stack.Screen=function MockScreen(){return null;};Stack.Protected=function MockProtected({children}:any){return children;};return {Stack};
});
beforeEach(()=>{mockState={...initialState,authenticated:true,userId:'account-a',profileId:'profile-a'};});
test.each(['profile','account','logout'])('a pending confirmation closes after %s changes',async(mode)=>{
 const view=render(<RootLayout/>);fireEvent.press(view.getByText('Abrir confirmação de QA'));expect(view.getByText('Dados do perfil anterior')).toBeTruthy();
 mockState={...mockState,...(mode==='profile'?{profileId:'profile-b'}:mode==='account'?{userId:'account-b',profileId:'profile-b'}:{authenticated:false})};
 view.rerender(<RootLayout/>);
 await waitFor(()=>expect(view.queryByText('Dados do perfil anterior')).toBeNull());
});

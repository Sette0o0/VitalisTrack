import { useEffect,useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { useAppState } from '@/state/app-state';
import { claimStepAlert } from '@/lib/step-alert';
import { isoDate } from '@/lib/health';
export function StepAlert(){
 const {state}=useAppState(),[message,setMessage]=useState(false),[active,setActive]=useState(AppState.currentState==='active');const focused=useIsFocused(),date=isoDate();
 useEffect(()=>{const sub=AppState.addEventListener('change',v=>setActive(v==='active'));return ()=>sub.remove();},[]);
 useEffect(()=>setMessage(false),[state.userId,state.profileId,date]);
 useEffect(()=>{let live=true;if(active&&focused&&state.authenticated&&state.userId)void claimStepAlert(state.userId,state.profileId??state.userId,date,state.steps,state.goals.steps).then(show=>{if(live&&show)setMessage(true);}).catch(()=>{});return ()=>{live=false;};},[active,focused,state.authenticated,state.userId,state.profileId,date,state.steps,state.goals.steps]);
 return message?<Text accessibilityLiveRegion="polite">Você chegou a 90% da sua meta de passos. Continue no seu ritmo!</Text>:null;
}

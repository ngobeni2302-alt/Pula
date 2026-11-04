import React,{createContext,useContext,useState} from 'react';
import {appWorkflow,getAppWorkspace,setWorkflowProfile} from './appWorkflow.js';
// Existing role selection is the only entry flow. No login or credential checks.
export const coreApi=appWorkflow;
const Context=createContext(null);
export function CoreProvider({children}){
  const [workspace,setWorkspace]=useState(null),[revision,setRevision]=useState(0);
  const chooseProfile=p=>{setWorkflowProfile(p);setWorkspace(getAppWorkspace());setRevision(n=>n+1);};
  const reload=async()=>{const w=getAppWorkspace();setWorkspace(w);setRevision(n=>n+1);return w;};
  return <Context.Provider value={{workspace,chooseProfile,reload,revision,refresh:()=>setRevision(n=>n+1)}}>{children}</Context.Provider>;
}
export const useCore=()=>useContext(Context);

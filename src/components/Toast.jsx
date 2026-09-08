import {createContext,useContext,useMemo,useState,useCallback,useEffect} from 'react';

const ToastContext=createContext(null);
let COUNTER=0;

const ICONS={success:'✓',error:'✕',warning:'!',info:'i'};

function ToastItem({toast,onDone}){
  const [leaving,setLeaving]=useState(false);
  const dismiss=useCallback(()=>setLeaving(true),[]);
  useEffect(()=>{
    if(!toast.duration) return;
    const t=setTimeout(()=>setLeaving(true),toast.duration);
    return ()=>clearTimeout(t);
  },[toast.duration]);
  useEffect(()=>{
    if(!leaving) return;
    const t=setTimeout(onDone,240);
    return ()=>clearTimeout(t);
  },[leaving,onDone]);
  return (
    <div className={'toast toast-'+toast.type+(leaving?' toast-out':'')} role="status" aria-live="polite">
      <span className="toast-icon">{ICONS[toast.type]||'i'}</span>
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={dismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}

export function ToastProvider({children}){
  const [toasts,setToasts]=useState([]);
  const remove=useCallback((id)=>setToasts(t=>t.filter(x=>x.id!==id)),[]);
  const notify=useCallback((message,type='success',opts={})=>{
    const id=++COUNTER;
    setToasts(t=>[...t,{id,message,type,duration:opts.duration??1800}]);
    return id;
  },[]);
  const value=useMemo(()=>({
    notify,
    success:(message,opts)=>notify(message,'success',opts),
    error:(message,opts)=>notify(message,'error',opts),
    warning:(message,opts)=>notify(message,'warning',opts),
    info:(message,opts)=>notify(message,'info',opts),
  }),[notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length>0&&<div className="toast-wrap">{toasts.map(t=><ToastItem key={t.id} toast={t} onDone={()=>remove(t.id)}/>)}</div>}
    </ToastContext.Provider>
  );
}

export function useToast(){
  return useContext(ToastContext);
}
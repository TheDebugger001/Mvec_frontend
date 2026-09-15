import React,{useEffect,useState} from 'react';

// Fullscreen initial loader. Visible on first mount / hard refresh, then fades
// out cleanly once the app data is ready (or after a short min delay).
export default function Preloader({
  label='MVEC',
  sublabel='Loading workspace',
  ready=true,
  minDelay=900,
  bar=false,       // false → pulsing dot, true → sliding loading bar
}){
  const [fading,setFading]=useState(false);
  const [gone,setGone]=useState(false);

  useEffect(()=>{
    if(!ready||gone) return;
    const t=setTimeout(()=>setFading(true),minDelay);
    return()=>clearTimeout(t);
  },[ready,minDelay,gone]);

  useEffect(()=>{
    if(!fading) return;
    const t=setTimeout(()=>setGone(true),550);
    return()=>clearTimeout(t);
  },[fading]);

  if(gone) return null;

  return (
    <div
      aria-hidden={fading}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-500 ${fading?'pointer-events-none opacity-0':'opacity-100'}`}
    >
      <div className="animate-[mvecPop_0.5s_ease-out] text-center">
        <div className="text-3xl font-semibold tracking-wider text-slate-900">{label}</div>
        <div className="mt-2 text-xs font-normal uppercase tracking-[0.35em] text-slate-400">{sublabel}</div>
      </div>

      {bar?(
        <div className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/5 rounded-full bg-slate-900 animate-[mvecBar_1.3s_ease-in-out_infinite]"/>
        </div>
      ):(
        <div className="mt-8 flex items-center gap-1.5">
          {[0,180,360].map(d=>(
            <span
              key={d}
              className="h-1.5 w-1.5 rounded-full bg-slate-900 animate-[mvecPulse_1.2s_ease-in-out_infinite]"
              style={{animationDelay:`${d}ms`}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
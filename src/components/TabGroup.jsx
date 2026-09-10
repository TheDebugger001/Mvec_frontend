import {useState,useEffect,useRef,useCallback} from 'react';

export default function TabGroup({tabs,activeTab,onTabChange}){
  const [indicator,setIndicator]=useState({left:0,width:0});
  const refs=useRef({});
  const containerRef=useRef(null);
  
  useEffect(()=>{
    const el=refs.current[activeTab];
    if(!el||!containerRef.current)return;
    const containerRect=containerRef.current.getBoundingClientRect();
    const elRect=el.getBoundingClientRect();
    setIndicator({left:elRect.left-containerRect.left,width:elRect.width});
  },[activeTab]);
  
  return (
    <div className="tab-group" ref={containerRef}>
      <div className="tab-group-track">
        <div className="tab-group-indicator" style={{left:indicator.left,width:indicator.width}}/>
        {tabs.map(tab=>(
          <button
            key={tab.key}
            ref={el=>refs.current[tab.key]=el}
            className={'tab-btn'+(activeTab===tab.key?' active':'')}
            onClick={()=>onTabChange(tab.key)}
          >
            {tab.icon&&<span className="tab-icon">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count!==undefined&&<span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Modal({open,title,subtitle,onClose,children,wide}){
  const backdropRef=useRef(null);
  
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')onClose()};
    document.addEventListener('keydown',onKey);
    document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow='';};
  },[open,onClose]);
  
  if(!open)return null;
  return (
    <div className="modal-backdrop" ref={backdropRef} onMouseDown={e=>{if(e.target===backdropRef.current)onClose()}}>
      <div className={'modal'+(wide?' modal-wide':'')} onMouseDown={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {title&&<span className="eyebrow">{title}</span>}
        {subtitle&&<h2>{subtitle}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({open,title,message,onConfirm,onCancel,danger}){
  if(!open)return null;
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="confirm-modal">
        {danger&&<div className="danger-icon">!</div>}
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="outline-btn" onClick={onCancel}>Cancel</button>
          <button className={danger?'danger-btn':'gradient-btn'} onClick={onConfirm}>{danger?'Confirm':'OK'}</button>
        </div>
      </div>
    </Modal>
  );
}

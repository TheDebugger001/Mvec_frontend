import {useEffect,useState} from "react";
import Icon from "./Icon";
import {notificationsApi} from "../API/notifications";
import {extractErrorMessage} from "../API/client";
import {useToast} from "../components/Toast";

const iconFor=type=>{const t=String(type||"").toUpperCase();return t==="PAYMENT"||t==="PAYOUT"?"wallet":t==="DELIVERY"||t==="ORDER"?"check":"bell";};
const fmt=n=>`${new Date(n.createdAt).toLocaleDateString('en-GB')} · ${new Date(n.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;

export default function NotificationPanel({role}){
 const toast=useToast();
 const [items,setItems]=useState([]);
 const [unread,setUnread]=useState(0);
 const [loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);try{const res=await notificationsApi.getMine({limit:50});const list=res.data||[];setItems(list);setUnread(res.meta?.unreadCount??list.filter(n=>!n.isRead).length);}catch(err){toast.error(extractErrorMessage(err));}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const mark=async id=>{try{await notificationsApi.markRead(id);setItems(prev=>prev.map(n=>String(n.id)===String(id)?{...n,isRead:true}:n));setUnread(u=>Math.max(0,u-1));}catch(err){toast.error(extractErrorMessage(err));}};
 const scopeLabel=role?`${String(role).toUpperCase()} UPDATES`:'UPDATES';
 return <><div className="dash-page-head"><div><span className="eyebrow">{scopeLabel}</span><h1>Notifications</h1><p>Important payment, order, delivery and marketplace updates.</p></div><button className="outline-btn" onClick={load} disabled={loading}>{loading?"Loading…":"Refresh"}</button></div><div className="data-card"><div className="data-card-head"><div><h3>Updates</h3><span>{unread} unread</span></div></div>{loading&&<div className="form-alert">Loading notifications…</div>}{!loading&&items.length?items.map(n=><div className={'notification-card '+(n.isRead?'read':'unread')} key={n.id}><div className="notification-icon"><Icon name={iconFor(n.type)}/></div><div className="notification-copy"><b>{n.title}</b><p>{n.message}</p><small>{fmt(n)}{n.reference?` · ${n.reference}`:''}</small></div>{!n.isRead&&<button className="outline-btn" onClick={()=>mark(n.id)}>Mark read</button>}</div>):!loading&&<div className="empty-state"><h3>No notifications yet</h3><p>Payment and order updates will appear here.</p></div>}</div></>;
}
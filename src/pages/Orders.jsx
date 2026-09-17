import {Link} from "react-router-dom";
import {useEffect,useMemo,useState} from "react";
import Pagination from "../components/Pagination";
import Storefront from "../components/Storefront";
import {ordersApi} from "../API/orders";
import {extractErrorMessage} from "../API/client";
import {useToast} from "../components/Toast";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";
const fmtDate=d=>{if(!d)return "—";const dt=new Date(d);return isNaN(dt.getTime())?"—":dt.toLocaleDateString("en-GB")};
const statusClass=s=>`status ${String(s||"PENDING").toLowerCase()}`;
export default function Orders(){
 const [orders,setOrders]=useState([]),[q,setQ]=useState(""),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const toast=useToast();
 const load=async()=>{setLoading(true);try{const res=await ordersApi.getMyOrders();setOrders(res.orders||[]);setError("");}catch(err){setError(extractErrorMessage(err));toast.error(extractErrorMessage(err));}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const filtered=useMemo(()=>orders.filter(o=>JSON.stringify(o).toLowerCase().includes(q.toLowerCase())),[orders,q]);
 const shown=filtered.slice((page-1)*5,page*5);
 return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">PURCHASES</span><h1>My orders</h1><p>Track payment and delivery from one place.</p></div>
 <div className="dash-toolbar"><div className="dash-filter"><span>⌕</span><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search orders, products, vendors or status…"/></div><button className="outline-btn" onClick={load} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
 {error&&<div className="form-alert error">{error}</div>}
 {loading&&<div className="form-alert">Loading orders…</div>}
 {!loading&&!shown.length&&!error&&<div className="empty-state"><h3>No orders yet</h3><p>Your orders will appear here once you place one.</p></div>}
 <div className="orders-table"><div className="table-head"><span>Order</span><span>Product</span><span>Total</span><span>Payment</span><span>Delivery</span><span>Date</span></div>{shown.map(o=>{const oid=o._id;const display=o.orderNumber||o._id;return <div className="table-row" key={oid}><Link to={"/orders/"+oid}><b>{display}</b></Link><span>{o.items?.[0]?.name||"Order"}</span><span>{money(o.totalAmount)}</span><span className={statusClass(o.paymentStatus)}>{o.paymentStatus||"PENDING"}</span><span>{o.orderStatus||"PENDING"}{o.isDelivered?" · Delivered":""}</span><span>{fmtDate(o.createdAt)}</span></div>})}</div>
 <Pagination page={Math.min(page,Math.max(1,Math.ceil(filtered.length/5)))} setPage={setPage} total={filtered.length} perPage={5}/>
 <div className="verified-box"><b>Protected payment & delivery</b><p>Payments are recorded as HELD until delivery is confirmed. Delivery is confirmed only when the correct delivery OTP is verified.</p></div><Link className="gradient-btn" to="/shop">Continue shopping</Link></main></Storefront>}
import {Link,useParams} from "react-router-dom";
import {useEffect,useState} from "react";
import Storefront from "../components/Storefront";
import {ordersApi,disputesApi} from "../API";
import {extractErrorMessage} from "../API/client";
import {useAuth} from "../context/AuthContext";
import {useToast} from "../components/Toast";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

const FLOW_STEPS=["Order placed","Payment confirmed","Preparing","Ready for shipment","Shipped","Out for delivery","Delivered","Completed"];
const STATUS_TO_LABEL={PENDING:"Order placed",CONFIRMED:"Payment confirmed",PROCESSING:"Preparing",READY_FOR_SHIPMENT:"Ready for shipment",SHIPPED:"Shipped",OUT_FOR_DELIVERY:"Out for delivery",DELIVERED:"Delivered",COMPLETED:"Completed",CANCELLED:"Cancelled",RETURNED:"Returned",REFUNDED:"Refunded",FAILED:"Failed"};
export default function OrderDetails(){
 const {id}=useParams();const toast=useToast();const {user}=useAuth();
 const [order,setOrder]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [reason,setReason]=useState(""),[description,setDescription]=useState(""),[reporting,setReporting]=useState(false),[reported,setReported]=useState(false);
 const [otp,setOtp]=useState(""),[delivering,setDelivering]=useState(false);
 const role=user?.role||"buyer";
 const canConfirmDelivery=role==="courier"||role==="super_admin";
 const load=async()=>{setLoading(true);try{const res=await ordersApi.getById(id);setOrder(res.order||null);setError("");}catch(err){setError(extractErrorMessage(err));setOrder(null);}finally{setLoading(false);}};
 useEffect(()=>{load();},[id]);
 const report=async()=>{if(!reason){toast.error("Please choose a problem to report.");return;}setReporting(true);try{await disputesApi.open({orderId:order._id,reason,description:description.trim()||reason,disputedAmount:order.totalAmount});setReported(true);toast.success("Problem reported. MVEC support will review the order.");}catch(err){const msg=extractErrorMessage(err);toast.error(msg);}finally{setReporting(false);}};
 const confirmDelivery=async()=>{if(!otp.trim()){toast.error("Enter the delivery OTP provided by the buyer.");return;}setDelivering(true);try{const res=await ordersApi.confirmDelivery(id,otp.trim());toast.success(res.message||"Order marked as delivered.");setOrder(res.order||{...order,isDelivered:true,deliveredAt:new Date().toISOString(),orderStatus:"DELIVERED"});}catch(err){const msg=extractErrorMessage(err);toast.error(msg);}finally{setDelivering(false);}};
 if(loading)return <Storefront><main className="account-page"><div className="form-alert">Loading order…</div></main></Storefront>;
 if(!order)return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">ORDER DETAILS</span><h1>Order not found</h1></div>{error&&<div className="form-alert error">{error}</div>}<Link className="outline-btn" to="/orders">← Back to orders</Link></main></Storefront>;
 const items=order.items||[];
 const nowLabel=STATUS_TO_LABEL[order.orderStatus]||order.orderStatus||"PENDING";
 const idx=FLOW_STEPS.indexOf(nowLabel);
 const address=order.shippingAddress||{};
 return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">ORDER DETAILS</span><h1>{order.orderNumber||order._id}</h1><p>Placed {new Date(order.createdAt).toLocaleString("en-GB")}</p></div>
 {error&&<div className="form-alert error">{error}</div>}
 <div className="detail-grid"><section className="data-card"><div className="data-card-head"><div><h3>Order information</h3><span>{new Date(order.createdAt).toLocaleDateString("en-GB")}</span></div><em className="status active">{nowLabel}{order.paymentStatus?` · ${order.paymentStatus}`:""}</em></div>
 {items.length?items.map((it,ix)=>(<div className="order-product" key={ix}><img src={it.image} alt=""/><div><b>{it.name||"Item"}</b><small>{it.vendor?.companyName||it.vendor?.Fullname||it.vendor||"Marketplace seller"} · Qty {it.quantity||1}</small><strong>{money(it.price*it.quantity)}</strong></div></div>)):<div className="empty-state"><h3>No items on this order</h3></div>}
 <div className="order-summary-lines"><span>Products <b>{money(items.reduce((s,x)=>s+(x.price||0)*(x.quantity||1),0))}</b></span><span>Grand total <b>{money(order.totalAmount)}</b></span></div></section>
 <section className="data-card"><h3>Shipping & payment</h3><div className="profile-detail"><b>{order.user?.Fullname||"You"}</b><span>Payment: {order.paymentStatus||"PENDING"}</span><span>Method: {order.paymentMethod||"Not selected"}</span><span>Delivery address</span><span>{address.street||""} {address.city||""} {address.state||""} {address.country||""}</span><span>{order.deliveredAt?`Delivered: ${new Date(order.deliveredAt).toLocaleString("en-GB")}`:"Not yet delivered"}</span></div></section></div>
 {order.deliveryOtp&&<section className="verified-box otp-buyer-box"><b>Your delivery OTP</b><p>Show this code to the delivery person upon arrival. Delivery is confirmed only after the correct code is entered.</p><strong className="delivery-otp">{order.deliveryOtp}</strong>{order.isDelivered&&<span className="success-text">Delivery confirmed ✓</span>}</section>}
 {(order.orderStatus==="CANCELLED"||order.orderStatus==="RETURNED"||order.orderStatus==="REFUNDED"||order.orderStatus==="FAILED")&&<section className="verified-box refund-box"><b>{STATUS_TO_LABEL[order.orderStatus]||order.orderStatus}</b><p>This order did not complete the regular delivery flow.</p></section>}
 <section className="data-card"><div className="data-card-head"><div><h3>Delivery timeline</h3><span>Status updates come from the marketplace backend.</span></div></div><div className="timeline">{FLOW_STEPS.map((s,i)=><div className={i<=idx?"timeline-item done":"timeline-item"} key={s}><i/><div><b>{s}</b><small>{i===idx?"Current order status":"MVEC workflow step"}</small></div></div>)}</div>{order.isDelivered&&<div className="verified-box"><b>✓ Delivery confirmed</b><p>The delivery OTP was verified and the order was marked delivered.</p></div>}</section>
 {canConfirmDelivery&&<section className="data-card"><div className="data-card-head"><div><h3>Confirm delivery</h3><span>Courier / MVEC staff action</span></div></div><label className="field"><span>Delivery OTP provided by buyer</span><input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter the 6-digit code"/></label><button className="gradient-btn" onClick={confirmDelivery} disabled={delivering}>{delivering?"Confirming…":"Mark as delivered"}</button></section>}
 {!canConfirmDelivery&&<section className="data-card"><h3>Report a problem</h3>{reported?<div className="form-alert success">Your problem was reported. MVEC support will review the order and evidence.</div>:<><select className="field" value={reason} onChange={e=>setReason(e.target.value)}><option value="">Choose a problem</option><option>Product not received</option><option>Wrong product</option><option>Damaged product</option><option>Missing item</option><option>Product differs from description</option><option>Other</option></select><textarea className="field" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the issue (optional)…"/><button className="outline-btn" onClick={report} disabled={reporting}>{reporting?"Reporting…":"Report a problem"}</button></>}</section>}
 <Link className="outline-btn" to="/orders">← Back to orders</Link></main></Storefront>}
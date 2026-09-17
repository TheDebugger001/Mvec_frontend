import {Link,useParams} from "react-router-dom";
import {useEffect,useState} from "react";
import Storefront from "../components/Storefront";
import {useToast} from "../components/Toast";
import {ordersApi} from "../API/orders";
import {extractErrorMessage} from "../API/client";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

export default function OrderConfirmation(){
  const {id}=useParams();
  const toast=useToast();
  const [order,setOrder]=useState(null);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const res=await ordersApi.getById(id);
        if(!cancelled){setOrder(res.order||null);setMessage("");}
      }catch(err){
        if(!cancelled){setMessage(extractErrorMessage(err));}
      }finally{
        if(!cancelled)setLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  },[id]);
  if(loading)return <Storefront><main className="account-page"><div className="form-alert">Loading order…</div></main></Storefront>;
  if(!order)return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">ORDER CONFIRMED</span><h1>Thank you for your order</h1><p>Your order is being recorded.</p></div>{message&&<div className="form-alert error">{message}</div>}<Link className="gradient-btn" to="/orders">View orders</Link></main></Storefront>;
  const items=order.items||[];
  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ORDER CONFIRMED</span><h1>Thank you for your order</h1><p>Order #{order.orderNumber||order._id} · {new Date(order.createdAt).toLocaleString("en-GB")}</p></div>
    {message&&<div className="form-alert error">{message}</div>}
    <div className="detail-grid">
      <section className="data-card">
        <div className="data-card-head"><div><h3>Order summary</h3><span>{new Date(order.createdAt).toLocaleDateString("en-GB")}</span></div><em className="status active">{order.paymentStatus==="PAID"?"Payment confirmed":order.paymentStatus||"PENDING"}</em></div>
        {items.length?items.map((it,ix)=>(
          <div className="mini-item" key={ix}>
            {it.image&&<img src={it.image} alt=""/>}
            <div><b>{it.name||"Item"}</b><span>Qty {it.quantity||1} · {money(it.price)}</span></div>
            <strong>{money((it.price||0)*(it.quantity||1))}</strong>
          </div>
        )):<div className="empty-state"><h3>No items on this order</h3></div>}
        <div className="order-summary-lines">
          <span>Products <b>{money(items.reduce((s,x)=>s+(x.price||0)*(x.quantity||1),0))}</b></span>
          <span className="grand">Grand total <b>{money(order.totalAmount)}</b></span>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-head"><div><h3>Next steps</h3><span>Protected settlement flow</span></div></div>
        <div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div>
        <p>Your order is recorded and tracked against the marketplace backend. When payment is confirmed, the delivery OTP below is used to verify delivery.</p>

        {order.deliveryOtp&&(
          <div className="verified-box otp-buyer-box">
            <b>Your delivery OTP</b>
            <p>Show this code to the delivery person upon arrival. It is used to confirm delivery and release payment.</p>
            <strong className="delivery-otp">{order.deliveryOtp}</strong>
          </div>
        )}

        <div className="modal-actions confirmation-actions">
          <Link className="outline-btn" to="/orders">View all orders</Link>
          <Link className="gradient-btn" to="/shop">Continue shopping</Link>
        </div>
      </section>
    </div>
  </main></Storefront>;
}
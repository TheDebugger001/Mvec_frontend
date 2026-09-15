import {Link,useParams} from "react-router-dom";
import {useEffect,useState} from "react";
import Storefront from "../components/Storefront";
import {useToast} from "../components/Toast";
import {cancelOrderByBuyer, getOrders, getDeliveryRemaining, canBuyerCancel} from "../services/mvecStore";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";
const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`};

export default function OrderConfirmation(){
  const {id}=useParams();
  const toast=useToast();
  const [tick,setTick]=useState(0);
  const [message,setMessage]=useState("");
  const [order,setOrder]=useState(()=>getOrders().find(o=>String(o.id)===String(id))||null);
  useEffect(()=>{const t=setInterval(()=>{setTick(x=>x+1);setOrder(getOrders().find(o=>String(o.id)===String(id))||null)},1000);return()=>clearInterval(t);},[id]);
  const remaining=order?getDeliveryRemaining(order):0;
  const canCancel=order?canBuyerCancel(order):false;
  if(!order)return <Storefront><main className="account-page"><div className="page-title"><span className="eyebrow">ORDER CONFIRMED</span><h1>Thank you for your order</h1><p>Your order is being recorded.</p></div><div className="form-alert">This order is being synced. Check "My Orders" to view it.</div><Link className="gradient-btn" to="/orders">View orders</Link></main></Storefront>;
  const items=order.items||[];
  const cancel=()=>{try{cancelOrderByBuyer(order.id);const m="Order cancelled. A full refund has been recorded.";setMessage(m);setOrder(getOrders().find(o=>String(o.id)===String(id)));toast.success(m)}catch(e){setMessage(e.message);toast.error(e.message)}};
  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ORDER CONFIRMED</span><h1>Thank you for your order</h1><p>Order #{order.id||order.orderNumber} · {order.date||order.createdAt}</p></div>
    {message&&<div className="form-alert success">{message}</div>}
    <div className="detail-grid">
      <section className="data-card">
        <div className="data-card-head"><div><h3>Order summary</h3><span>{order.date||order.createdAt}</span></div><em className="status active">Payment confirmed</em></div>
        {items.map(it=>(
          <div className="mini-item" key={it.id||it.productId||it.name}>
            {it.image&&<img src={it.image} alt=""/>}
            <div><b>{it.name||it.productName||"Item"}</b><span>Qty {it.qty||it.quantity||1} · {it.price?money(it.price):""}</span></div>
            <strong>{money((it.price||0)*(it.qty||it.quantity||1))}</strong>
          </div>
        ))}
        <div className="order-summary-lines">
          <span>Subtotal <b>{money(order.subtotal||order.total)}</b></span>
          <span>Shipping <b>{money(order.shipping||0)}</b></span>
          <span className="grand">Grand total <b>{money(order.total)}</b></span>
        </div>
      </section>

      <section className="data-card">
        <div className="data-card-head"><div><h3>Next steps</h3><span>Protected settlement flow</span></div></div>
        <div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div>
        <p>Your payment has been recorded as HELD in the MVEC escrow system. A three-hour delivery window is active starting from payment confirmation.</p>

        {canCancel&&(
          <div className="countdown-card">
            <div className="data-card-head"><div><h3>30-minute cancellation window</h3><span>Cancel with full refund while countdown is active</span></div><strong className={remaining<5*60*1000?'danger-text':''}>{fmt(remaining)}</strong></div>
            <p>You may cancel this order within 30 minutes of payment. After that, only delivery can release the funds.</p>
            <button className="outline-btn" style={{borderColor:'#dc2626',color:'#dc2626'}} onClick={cancel}>Cancel order & refund</button>
          </div>
        )}
        {!canCancel&&order.paidAt&&(
          <div className="countdown-card">
            <div className="data-card-head"><div><h3>30-minute cancellation window</h3><span>Timeout elapsed</span></div><strong className="danger-text">00:00:00</strong></div>
            <p>The 30-minute buyer cancellation window has expired. The order can only be resolved through delivery confirmation.</p>
          </div>
        )}

        {order.buyerDeliveryOtp&&(
          <div className="verified-box otp-buyer-box">
            <b>Your delivery OTP</b>
            <p>Show this code to the delivery person upon arrival. It will be used to release payment.</p>
            <strong className="delivery-otp">{order.buyerDeliveryOtp}</strong>
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
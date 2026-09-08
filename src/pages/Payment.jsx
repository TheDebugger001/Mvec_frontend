import {useState} from "react";
import {useNavigate,useParams} from "react-router-dom";
import Storefront from "../components/Storefront";
import {getOrders, confirmPayment} from "../services/mvecStore";
import {useToast} from "../components/Toast";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

export default function Payment(){
  const navigate=useNavigate(),{id}=useParams();
  const toast=useToast();
  const [method,setMethod]=useState("momo"),[processing,setProcessing]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
  const order=getOrders().find(o=>String(o.id)===String(id));
  if(!order)return <Storefront><main className="account-page"><div className="form-alert error">Order not found.</div></main></Storefront>;
  const pay=()=>{
    setError("");setProcessing(true);
    setTimeout(()=>{
      try{
        confirmPayment(id,method);
        setDone(true);
        toast.success("Payment confirmed ✓");
        setTimeout(()=>navigate(`/orders/${id}`),500);
      }catch{setError("Payment could not be completed. Please try again.");toast.error("Payment could not be completed. Please try again.");setProcessing(false);}
    },700);
  };
  return <Storefront><main className="payment-page"><div className="page-title"><span className="eyebrow">PAYMENT</span><h1>Pay for your order</h1><p>Order #{order.id} · Total {money(order.total)}</p></div>
    {error&&<div className="form-alert error">{error}</div>}
    <div className="payment-layout"><section className="payment-card"><h2>Choose a payment method</h2>
      <label className={`payment-option ${method==="momo"?"selected":""}`}><input type="radio" checked={method==="momo"} onChange={()=>setMethod("momo")}/><span className="payment-logo">M</span><div><b>Mobile Money</b><small>MTN MoMo / Airtel Money</small></div></label>
      <label className={`payment-option ${method==="card"?"selected":""}`}><input type="radio" checked={method==="card"} onChange={()=>setMethod("card")}/><span className="payment-logo">▣</span><div><b>Visa / Mastercard</b><small>Pay with your bank card</small></div></label>
      <label className={`payment-option ${method==="bank"?"selected":""}`}><input type="radio" checked={method==="bank"} onChange={()=>setMethod("bank")}/><span className="payment-logo">₣</span><div><b>Bank transfer</b><small>Use your preferred Rwandan bank</small></div></label>
      {method==="momo"&&<div className="payment-fields"><label className="field"><span>Mobile number</span><input placeholder="+250 7xx xxx xxx"/></label></div>}
      {method==="card"&&<div className="payment-fields"><label className="field"><span>Card number</span><input placeholder="Card number"/></label><div className="two-col"><label className="field"><span>Expiry</span><input placeholder="MM/YY"/></label><label className="field"><span>CVV</span><input placeholder="CVV"/></label></div></div>}
      <button className="gradient-btn full" onClick={pay} disabled={processing||done}>{done?"Payment confirmed ✓":processing?"Confirming payment…":"Pay securely"}</button>
    </section><aside className="security-panel"><div className="secure-icon">✓</div><h3>How MVEC works</h3><p>For this protected-settlement flow, your payment is recorded as HELD until delivery is confirmed. In production, the actual funds must be held and released by an appropriately regulated payment/escrow partner.</p><div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div><p className="tiny">After payment, the delivery window is three hours. You may cancel within the first 30 minutes. Your delivery OTP is generated after payment and is required at the door.</p></aside></div>
  </main></Storefront>
}
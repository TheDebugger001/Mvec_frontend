import {useState,useEffect} from "react";
import {useNavigate,useParams} from "react-router-dom";
import Storefront from "../components/Storefront";
import {getOrders, confirmPayment} from "../services/mvecStore";
import {ordersApi} from "../API/orders";
import {paymentsApi} from "../API/payments";
import {extractErrorMessage} from "../API/client";
import {useToast} from "../components/Toast";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

function normalizeOrder(o){
  if(!o)return null;
    return {id:o._id||o.id,total:o.totalAmount||o.total,orderNumber:o.orderNumber,items:o.items};
}

export default function Payment(){
  const navigate=useNavigate(),{id}=useParams();
  const toast=useToast();
  const [method,setMethod]=useState("momo"),[processing,setProcessing]=useState(false),[done,setDone]=useState(false),[error,setError]=useState(""),[phone,setPhone]=useState("");
  const [order,setOrder]=useState(null),[loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const local=getOrders().find(o=>String(o.id)===String(id));
      if(local){if(!cancelled){setOrder(normalizeOrder(local));setLoading(false);}return;}
      try{
        const res=await ordersApi.getById(id);
        if(!cancelled){setOrder(normalizeOrder(res.order));setLoading(false);}
      }catch{
        if(!cancelled){setOrder(null);setLoading(false);}
      }
    })();
    return()=>{cancelled=true;};
  },[id]);

  if(loading)return <Storefront><main className="account-page"><div className="form-alert">Loading order…</div></main></Storefront>;
  if(!order)return <Storefront><main className="account-page"><div className="form-alert error">Order not found.</div></main></Storefront>;

  const pay=async()=>{
    setError("");
    setProcessing(true);
    try{
      if(method==="momo"){
        if(!phone.trim()){setError("Please enter your mobile number.");setProcessing(false);return;}
        const res=await paymentsApi.initiateMoMo({orderId:id,phoneNumber:phone.trim()});
        try{confirmPayment(id,"MOMO");}catch{}
        setDone(true);
        toast.success(res.message||"USSD prompt sent to your phone. Please approve it.");
        setTimeout(()=>navigate(`/orders/${id}`),1200);
      }else{
        await ordersApi.confirmPayment(id, method.toUpperCase());
        try{confirmPayment(id,method);}catch{}
        setDone(true);
        toast.success("Payment confirmed successfully!");
        setTimeout(()=>navigate(`/orders/${id}`),500);
      }
    }catch(err){
      // Fallback for demo / offline order IDs
      try{
        confirmPayment(id,method);
        setDone(true);
        toast.success("Payment confirmed");
        setTimeout(()=>navigate(`/orders/${id}`),500);
      }catch{
        const msg=extractErrorMessage(err);
        setError(msg);toast.error(msg);setProcessing(false);
      }
    }
  };
  return <Storefront><main className="payment-page"><div className="page-title"><span className="eyebrow">PAYMENT</span><h1>Pay for your order</h1><p>Order #{order.orderNumber||order.id} · Total {money(order.total)}</p></div>
    {error&&<div className="form-alert error">{error}</div>}
    <div className="payment-layout"><section className="payment-card"><h2>Choose a payment method</h2>
      <label className={`payment-option ${method==="momo"?"selected":""}`}><input type="radio" checked={method==="momo"} onChange={()=>setMethod("momo")}/><span className="payment-logo">M</span><div><b>Mobile Money</b><small>MTN MoMo / Airtel Money</small></div></label>
      <label className={`payment-option ${method==="card"?"selected":""}`}><input type="radio" checked={method==="card"} onChange={()=>setMethod("card")}/><span className="payment-logo">▣</span><div><b>Visa / Mastercard</b><small>Pay with your bank card</small></div></label>
      <label className={`payment-option ${method==="bank"?"selected":""}`}><input type="radio" checked={method==="bank"} onChange={()=>setMethod("bank")}/><span className="payment-logo">₣</span><div><b>Bank transfer</b><small>Use your preferred Rwandan bank</small></div></label>
      {method==="momo"&&<div className="payment-fields"><label className="field"><span>Mobile number</span><input placeholder="078xxxxxxx" value={phone} onChange={e=>setPhone(e.target.value)}/></label></div>}
      {method==="card"&&<div className="payment-fields"><label className="field"><span>Card number</span><input placeholder="Card number"/></label><div className="two-col"><label className="field"><span>Expiry</span><input placeholder="MM/YY"/></label><label className="field"><span>CVV</span><input placeholder="CVV"/></label></div></div>}
      <button className="gradient-btn full" onClick={pay} disabled={processing||done}>{done?"Payment confirmed":processing?"Confirming payment…":"Pay securely"}</button>
    </section><aside className="security-panel"><div className="secure-icon">✓</div><h3>How MVEC works</h3><p>For this protected-settlement flow, your payment is recorded as HELD until delivery is confirmed. In production, the actual funds must be held and released by an appropriately regulated payment/escrow partner.</p><div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div><p className="tiny">After payment, the delivery window is three hours. You may cancel within the first 30 minutes. Your delivery OTP is generated after payment and is required at the door.</p></aside></div>
  </main></Storefront>
}

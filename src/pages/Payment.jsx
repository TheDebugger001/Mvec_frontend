import {useState,useEffect} from "react";
import {useNavigate,useParams} from "react-router-dom";
import Storefront from "../components/Storefront";
import {ordersApi} from "../API/orders";
import {paymentsApi} from "../API/payments";
import {extractErrorMessage} from "../API/client";
import {useToast} from "../components/Toast";
const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

const MOMO_STEPS=["USSD push sent","Approve on phone","Payment confirmed"];

function normalizeOrder(o){
  if(!o)return null;
    return {id:o._id||o.id,total:o.totalAmount||o.total,orderNumber:o.orderNumber,items:o.items,deliveryOtp:o.deliveryOtp,paymentStatus:o.paymentStatus,orderStatus:o.orderStatus};
}

export default function Payment(){
  const navigate=useNavigate(),{id}=useParams();
  const toast=useToast();
  const [method,setMethod]=useState("momo"),[payStage,setPayStage]=useState("idle"),[error,setError]=useState(""),[phone,setPhone]=useState("");
  const [order,setOrder]=useState(null),[loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const res=await ordersApi.getById(id);
        if(!cancelled){setOrder(normalizeOrder(res.order));setLoading(false);}
      }catch{
        if(!cancelled){setOrder(null);setLoading(false);}
      }
    })();
    return()=>{cancelled=true;};
  },[id]);

  const pay=async()=>{
    setError("");
    const isMobile=method==="momo"||method==="airtel";
    if(isMobile&&!phone.trim()){setError("Please enter your mobile number.");return;}
    setPayStage("requesting");
    try{
      if(isMobile){
        const res=method==="momo"
          ?await paymentsApi.initiateMoMo({orderId:id,phoneNumber:phone.trim()})
          :await paymentsApi.initiateAirtel({orderId:id,phoneNumber:phone.trim()});
        setPayStage("approving");
        toast.success(res.message||"USSD prompt sent to your phone. Please approve it.");
        await new Promise(r=>setTimeout(r,1800));
        setPayStage("verifying");
      }else{
        setPayStage("verifying");
      }
      const confirmed=await ordersApi.confirmPayment(id,isMobile?(method==="momo"?"MOMO":"AIRTEL"):method.toUpperCase());
      if(confirmed.order){setOrder(normalizeOrder(confirmed.order));}
      setPayStage("done");
      toast.success("Payment confirmed — your delivery OTP is ready.");
      setTimeout(()=>navigate(`/order-confirmation/${id}`),2000);
    }catch(err){
      setPayStage("idle");
      const msg=extractErrorMessage(err);
      setError(msg);toast.error(msg);
    }
  };

  if(loading)return <Storefront><main className="account-page"><div className="form-alert">Loading order…</div></main></Storefront>;
  if(!order)return <Storefront><main className="account-page"><div className="form-alert error">Order not found.</div></main></Storefront>;

  const stepIndex=payStage==="requesting"?1:payStage==="approving"?2:payStage==="verifying"?3:payStage==="done"?3:0;
  const buttonLabel={
    requesting:"Sending USSD prompt…",
    approving:"Waiting for approval…",
    verifying:"Confirming payment…",
    done:"Payment confirmed",
  }[payStage]||"Pay securely";

  return <Storefront><main className="payment-page"><div className="page-title"><span className="eyebrow">PAYMENT</span><h1>Pay for your order</h1><p>Order #{order.orderNumber||order.id} · Total {money(order.total)}</p></div>
    {error&&<div className="form-alert error">{error}</div>}
    <div className="payment-layout"><section className="payment-card"><h2>Choose a payment method</h2>
      <label className={`payment-option ${method==="momo"?"selected":""}`}><input type="radio" checked={method==="momo"} onChange={()=>setMethod("momo")}/><span className="payment-logo">M</span><div><b>MTN MoMo</b><small>Pay with an MTN number (starts with 078 / 079)</small></div></label>
      <label className={`payment-option ${method==="airtel"?"selected":""}`}><input type="radio" checked={method==="airtel"} onChange={()=>setMethod("airtel")}/><span className="payment-logo">A</span><div><b>Airtel Money</b><small>Pay with an Airtel number (starts with 073 / 072)</small></div></label>
      <label className={`payment-option ${method==="card"?"selected":""}`}><input type="radio" checked={method==="card"} onChange={()=>setMethod("card")}/><span className="payment-logo">▣</span><div><b>Visa / Mastercard</b><small>Pay with your bank card</small></div></label>
      <label className={`payment-option ${method==="bank"?"selected":""}`}><input type="radio" checked={method==="bank"} onChange={()=>setMethod("bank")}/><span className="payment-logo">₣</span><div><b>Bank transfer</b><small>Use your preferred Rwandan bank</small></div></label>
      {(method==="momo"||method==="airtel")&&<div className="payment-fields"><label className="field"><span>{method==="momo"?"MTN MoMo":"Airtel Money"} number</span><input placeholder={method==="momo"?"078xxxxxxx":"073xxxxxxx"} value={phone} onChange={e=>setPhone(e.target.value)} disabled={payStage!=="idle"}/></label></div>}
      {method==="card"&&<div className="payment-fields"><label className="field"><span>Card number</span><input placeholder="Card number"/></label><div className="two-col"><label className="field"><span>Expiry</span><input placeholder="MM/YY"/></label><label className="field"><span>CVV</span><input placeholder="CVV"/></label></div></div>}

      {(method==="momo"||method==="airtel")&&(
        <div className="momo-progress">
          {MOMO_STEPS.map((s,i)=>(
            <div key={s} className={(stepIndex>i?"done":stepIndex===i+1?"active":"")+" momo-step"}>
              <span className="momo-step-dot">{stepIndex>i?"✓":i+1}</span>
              <span>{s}</span>
            </div>
          ))}
          {payStage==="requesting"&&<div className="momo-spinner"><i/>Sending USSD push to {phone.trim()||"your number"}…</div>}
          {payStage==="approving"&&<div className="momo-spinner"><i/>Check your phone and approve the prompt with your MoMo PIN…</div>}
          {payStage==="verifying"&&<div className="momo-spinner"><i/>Verifying payment and locking escrow…</div>}
        </div>
      )}

      <button className="gradient-btn full" onClick={pay} disabled={payStage!=="idle"}>{buttonLabel}</button>
      {payStage==="done"&&order?.deliveryOtp&&(
        <div className="verified-box otp-buyer-box">
          <b>Your delivery OTP</b>
          <p>Show this code to the delivery person upon arrival. It is used to confirm delivery and release payment.</p>
          <strong className="delivery-otp">{order.deliveryOtp}</strong>
        </div>
      )}
    </section><aside className="security-panel"><div className="secure-icon">✓</div><h3>How MVEC works</h3><p>For this protected-settlement flow, your payment is recorded as HELD until delivery is confirmed. In production, the actual funds must be held and released by an appropriately regulated payment/escrow partner.</p><div className="status-flow"><span>Payment</span><i>→</i><span>MVEC holds</span><i>→</i><span>Delivery</span><i>→</i><span>Release</span></div><p className="tiny">Your delivery OTP is generated after payment and is required at the door. Delivery is confirmed only after the correct code is entered.</p></aside></div>
  </main></Storefront>
}
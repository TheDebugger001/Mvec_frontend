import {useEffect,useMemo,useState} from "react";
import {Link,useNavigate,useSearchParams} from "react-router-dom";
import Storefront from "../components/Storefront";
import {products as seedProducts} from "../data";
import {useMarketplace} from "../context/MarketplaceContext";
import {useAuth} from "../context/AuthContext";
import {getCatalogProducts, snapshotOrderPricing} from "../services/mvecStore";
import {ordersApi} from "../API/orders";
import {productsApi} from "../API/products";
import {extractErrorMessage} from "../API/client";
import {useToast} from "../components/Toast";

const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

export default function Checkout(){
  const [params]=useSearchParams(), navigate=useNavigate();
  const {cart, clearCart}=useMarketplace();
  const {user}=useAuth();
  const toast=useToast();
  const pid=params.get("product");
  const [directProduct,setDirectProduct]=useState(() => {
    if (!pid) return null;
    const fromCart = cart.find(x=>String(x.productId||x.id)===pid);
    if (fromCart) return fromCart;
    const catalog = getCatalogProducts(seedProducts);
    return catalog.find(x=>String(x.id)===pid) || null;
  });

  useEffect(()=>{
    if(!pid || directProduct) return;
    let active=true;
    productsApi.getById(pid).then(prod => {
      if(active && prod){
        setDirectProduct({
          id: prod._id || prod.id,
          productId: prod._id || prod.id,
          name: prod.name,
          price: prod.discountPrice || prod.price,
          image: prod.media?.mainImage || prod.image || "",
          vendor: prod.vendor?.companyName || prod.vendor?.Fullname || "Marketplace Vendor",
          vendorId: prod.vendor?._id || prod.vendor?.id || prod.vendor,
          sku: prod.sku,
        });
      }
    }).catch(()=>{});
    return ()=>{active=false};
  },[pid, directProduct]);

  const p = directProduct;
  const items=useMemo(()=>p?[{...p,qty:Number(params.get("qty")||1)}]:cart,[p,cart,params]);
  const [form,setForm]=useState({name:user?.fullName||"",phone:user?.telephone||"",email:user?.email||"",province:"Kigali City",district:"Gasabo",sector:"Remera",address:"KG 11 Ave, Kigali",method:"standard"});
  const [error,setError]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const subtotal=items.reduce((s,x)=>s+x.price*(x.qty||1),0);
  const shipping=form.province==="Kigali City"?0:(form.method==="express"?10000:5000);
  const pricing=snapshotOrderPricing(items,shipping,0,false);
  const total=pricing.buyerTotal;
  function update(e){setForm({...form,[e.target.name]:e.target.value});}
  async function continuePayment(e){
    e.preventDefault(); setError("");
    if(!form.name||!form.phone||!form.address){setError("Please complete your name, phone number and delivery address.");toast.error("Please complete your name, phone number and delivery address.");return;}
    if(!items.length){setError("Your cart is empty.");toast.error("Your cart is empty.");return;}
    setSubmitting(true);
    try{
      const res=await ordersApi.directCheckout({
        items:items.map(x=>({
          productId:x.productId||x.id,
          name:x.name,
          qty:Number(x.qty)||1,
          price:Number(x.price)||0,
          vendor:x.vendorId||x.vendor,
          image:x.image||x.media?.mainImage||"",
        })),
        shippingAddress:{street:form.address,city:form.district,state:form.province,country:"Rwanda",postalCode:""},
        paymentMethod:"MOMO",
      });
      if(!p) clearCart();
      toast.success("Order created — continue to payment.");
      navigate(`/payment/${res.order._id}`);
    }catch(err){
      const msg=extractErrorMessage(err);
      setError(msg);toast.error(msg);setSubmitting(false);
    }
  }
  return <Storefront><main className="checkout-page">
    <div className="page-title"><span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1><p>Simple phone-first checkout with protected MVEC settlement.</p></div>
    <div className="checkout-steps"><span className="active">1 Customer & delivery</span><span>2 Payment</span><span>3 Confirmation</span></div>
    {error&&<div className="form-alert error">{error}</div>}
    <form onSubmit={continuePayment}><div className="checkout-layout"><section className="checkout-main">
      <div className="form-card"><h2>Customer information</h2><p className="tiny">Email is optional. Your phone number is used for order updates.</p>
        <div className="two-col"><label className="field"><span>Name</span><input name="name" value={form.name} onChange={update} required/></label><label className="field"><span>Phone</span><input name="phone" value={form.phone} onChange={update} placeholder="+250 7xx xxx xxx" required/></label></div>
        <label className="field"><span>Email (optional)</span><input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com"/></label>
      </div>
      <div className="form-card"><h2>Delivery address</h2><div className="two-col"><label className="field"><span>Province / City</span><select name="province" value={form.province} onChange={update}><option>Kigali City</option><option>Northern Province</option><option>Southern Province</option><option>Eastern Province</option><option>Western Province</option></select></label><label className="field"><span>District</span><input name="district" value={form.district} onChange={update} placeholder="District"/></label></div><div className="two-col"><label className="field"><span>Sector</span><input name="sector" value={form.sector} onChange={update} placeholder="Sector"/></label><label className="field"><span>Street / landmark</span><input name="address" value={form.address} onChange={update} placeholder="Street, landmark" required/></label></div>
        <div className="delivery-options"><label><input type="radio" checked={form.method==="standard"} onChange={()=>setForm({...form,method:"standard"})}/> Standard delivery <b>{form.province==="Kigali City"?"FREE":"5,000 RWF"}</b></label><label><input type="radio" checked={form.method==="express"} onChange={()=>setForm({...form,method:"express"})}/> Express delivery <b>10,000 RWF</b></label></div>
        <p className="tiny">Delivery is fulfilled by the seller or an assigned delivery partner. Delivery proof is recorded when the order arrives.</p>
      </div>
      <div className="form-card"><h2>Order items</h2>{items.map(x=><div className="mini-item" key={x.id}><img src={x.image} alt=""/><div><b>{x.name}</b><span>{x.vendor} · Qty {x.qty}</span></div><strong>{money(x.price*x.qty)}</strong></div>)}</div>
    </section><aside className="summary-card"><h2>Order summary</h2><div><span>Products</span><b>{money(subtotal)}</b></div><div><span>Shipping</span><b>{money(shipping)}</b></div><div><span>Platform fees</span><b>Included where applicable</b></div><hr/><div className="grand"><span>Grand total</span><strong>{money(total)}</strong></div>
      <button className="gradient-btn full" type="submit" disabled={submitting}>{submitting?"Placing order…":"Continue to payment"}</button><Link to="/cart" className="back-link">← Back to cart</Link>
      <div className="verified-box"><b>✓ Clear payment flow</b><p>Your payment is processed through an appropriate payment partner. In the protected workflow, funds are recorded as HELD until delivery is confirmed.</p></div>
    </aside></div></form>
  </main></Storefront>
}
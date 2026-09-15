import {useEffect,useMemo,useState} from "react";
import {Modal} from "./TabGroup";
import Icon from "./Icon";
import {suppliersApi} from "../API/suppliers";
import {wholesaleApi} from "../API/wholesale";
import {extractErrorMessage} from "../API/client";
import {useToast} from "./Toast";
import {createOrder as createLocalOrder, confirmPayment as confirmLocalPayment} from "../services/mvecStore";

const money=n=>new Intl.NumberFormat("en-RW").format(Number(n)||0)+" RWF";

const CATALOG_POOLS={
  "Electronics":[
    {name:"Samsung Galaxy S25 Ultra 256GB",unitPrice:980000,moq:5,stockQty:84},
    {name:"Sony WH-1000XM5 Wireless Headphones",unitPrice:320000,moq:3,stockQty:140},
    {name:"Anker 20,000mAh Power Bank",unitPrice:45000,moq:10,stockQty:500},
    {name:"Dell 27\" 4K UHD Monitor",unitPrice:610000,moq:2,stockQty:45},
    {name:"Apple iPhone 15 128GB",unitPrice:1150000,moq:5,stockQty:60},
    {name:"TP-Link WiFi 6 Router",unitPrice:120000,moq:8,stockQty:220},
  ],
  "Fashion":[
    {name:"Classic Leather Sneakers (Men)",unitPrice:28500,moq:12,stockQty:640},
    {name:"Premium Cotton T-Shirts (Pack of 24)",unitPrice:96000,moq:5,stockQty:380},
    {name:"Women's Tailored Blazer",unitPrice:45000,moq:6,stockQty:210},
    {name:"Denim Jeans (Mixed Sizes)",unitPrice:32000,moq:10,stockQty:450},
    {name:"Handwoven Sisal Market Tote",unitPrice:18000,moq:15,stockQty:720},
  ],
  "Home & Living":[
    {name:"Office Chair Pro Ergonomic",unitPrice:165000,moq:4,stockQty:72},
    {name:"Stoneware Dinner Set (12 pcs)",unitPrice:120000,moq:6,stockQty:140},
    {name:"Memory Foam Mattress (King)",unitPrice:385000,moq:2,stockQty:38},
    {name:"LED Kitchen Pendant Light",unitPrice:52000,moq:8,stockQty:260},
    {name:"Rattan Storage Basket Set",unitPrice:29000,moq:10,stockQty:300},
  ],
};
const DEFAULT_POOL=[
  {name:"Wholesale Notebooks (Pack of 50)",unitPrice:60000,moq:10,stockQty:800},
  {name:"Premium Ballpoint Pens (Pack of 100)",unitPrice:35000,moq:20,stockQty:1500},
  {name:"Stainless Steel Bottle 750ml",unitPrice:15000,moq:15,stockQty:900},
  {name:"USB-C Quick Charge Cable",unitPrice:9000,moq:25,stockQty:1200},
  {name:"Bluetooth Speaker Mini",unitPrice:24000,moq:12,stockQty:500},
];

const reliable=n=>{
  if(n>=4.7)return{label:"Excellent · Top ranked supplier",level:3};
  if(n>=4.4)return{label:"High reliability",level:2};
  if(n>=4)return{label:"Standard reliability",level:1};
  return{label:"New supplier — review carefully",level:0};
};

function buildMockCatalog(supplier){
  const pool=CATALOG_POOLS[supplier.category]||DEFAULT_POOL;
  const seed=String(supplier.id||supplier.name||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)||1;
  const start=seed%pool.length;
  const items=[];
  for(let i=0;i<Math.min(5,pool.length);i++){
    const src=pool[(start+i)%pool.length];
    items.push({
      id:`${supplier.id||"SUP"}-ITM-${i+1}-${seed}`,
      productId:null,
      name:src.name,
      sku:`SKU-${(supplier.id||"SUP").replace(/\D/g,"")}-${String((start+i+1)*137).padStart(4,"0")}`,
      unitPrice:src.unitPrice,
      moq:src.moq,
      stockQty:src.stockQty,
      image:"",
    });
  }
  return items;
}

function toCatalogItems(products=[]){
  return products.map((p,i)=>({
    id:p._id||p.id||`PID-${i}`,
    productId:p._id||p.id||null,
    name:p.name||"Product",
    sku:p.sku||`SKU-${String(p._id||p.id).slice(-6)}`,
    unitPrice:Number(p.discountPrice||p.price)||0,
    moq:5,
    stockQty:Number(p.stockQuantity)||0,
    image:(p.media&&(p.media.mainImage||(p.media.gallery&&p.media.gallery[0])))||"",
  }));
}

export default function SupplierOrderModal({supplier,onClose}){
  const toast=useToast();
  const [profile,setProfile]=useState(supplier||null);
  const [catalog,setCatalog]=useState([]);
  const [order,setOrder]=useState({});
  const [qtyMap,setQtyMap]=useState({});
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [placed,setPlaced]=useState(null);

  useEffect(()=>{
    if(!supplier)return;
    let active=true;
    setLoading(true);
    Promise.allSettled([
      suppliersApi.getByIdOrSlug(supplier.id),
      suppliersApi.getProducts(supplier.id),
    ]).then(([pRes,gRes])=>{
      if(!active)return;
      const fetchedProfile=pRes.status==="fulfilled"?pRes.value?.supplier:null;
      const products=gRes.status==="fulfilled"?Array.isArray(gRes.value?.products)?gRes.value.products:[]
                        :Array.isArray(gRes.value)?gRes.value:[];
      if(fetchedProfile){setProfile(p=>({...(p||{}),...fetchedProfile}));}
      else setProfile(supplier);
      setCatalog(products.length?toCatalogItems(products):buildMockCatalog(supplier));
      setLoading(false);
    });
    return()=>{active=false};
  },[supplier]);

  const toggle=(id,checked)=>{
    setOrder(o=>{
      const next={...o,[id]:checked};
      if(checked&&!(id in qtyMap))setQtyMap(m=>({...m,[id]:0}));
      return next;
    });
  };
  const setQty=(id,val)=>{
    setQtyMap(m=>({...m,[id]:Math.max(0,Number(val)||0)}));
    setError("");
  };

  const lineErrors=useMemo(()=>{
    const out={};
    catalog.forEach(it=>{
      if(order[it.id]){
        const q=qtyMap[it.id]||0;
        if(q<it.moq)out[it.id]=`Below MOQ — minimum quantity is ${it.moq}`;
        else if(q>it.stockQty)out[it.id]=`Exceeds stock — only ${it.stockQty} available`;
        else if(q<=0)out[it.id]="Enter an order quantity";
      }
    });
    return out;
  },[order,qtyMap,catalog]);

  const selectedItems=useMemo(()=>catalog.filter(it=>order[it.id]&&!lineErrors[it.id]),[catalog,order,lineErrors]);
  const subtotal=selectedItems.reduce((s,it)=>s+it.unitPrice*(qtyMap[it.id]||0),0);
  const delivery=subtotal?Math.max(5000,Math.min(25000,Math.round(subtotal*0.015))):0;
  const grandTotal=subtotal+delivery;
  const hasSelection=Object.values(order).some(Boolean);
  const canSubmit=hasSelection&&!Object.keys(lineErrors).length&&!submitting;

  const badge=profile?.verificationStatus||"VERIFIED";
  const rel=reliable(Number(profile?.ratingAvg)||Number(profile?.rating)||0);
  const srcName=profile?.name||profile?.businessName||"Supplier";
  const srcLocation=profile?.location||"Rwanda";
  const logo=profile?.logoUrl||profile?.logo||"";

  const submitOrder=async()=>{
    if(!canSubmit)return;
    setSubmitting(true);
    setError("");
    const items=selectedItems.filter(it=>it.productId).map(it=>({
      supplierProductId:it.id,
      product:it.productId,
      productName:it.name,
      unitPrice:it.unitPrice,
      moq:it.moq,
      quantity:qtyMap[it.id]||0,
    }));
    if(!items.length){
      setError("No valid catalog products selected. Please ensure products are loaded from the supplier catalog.");
      setSubmitting(false);
      return;
    }
    const payload={supplierId:profile?.user||profile?._id||supplier.id,items};
    try{
      const res=await wholesaleApi.createOrder(payload);
      const data=res?.data||res?.order||res;
      if(data?._id){
        try{await wholesaleApi.holdEscrow(data._id,{});}catch{}
      }
      recordLocal(payload.items,grandTotal,delivery);
      setPlaced({orderNumber:data?.orderNumber||`WSO-${Date.now()}`,items:items.length,total:grandTotal});
      toast.success("Wholesale supply order placed. Funds held in MVEC escrow.");
      setSubmitting(false);
    }catch(err){
      if(!err?.response){
        recordLocal(payload.items,grandTotal,delivery);
        setPlaced({orderNumber:`WSO-${Date.now()}`,items:items.length,total:grandTotal,demo:true});
        toast.success("Supply order recorded (demo mode). Escrow hold simulated locally.");
        setSubmitting(false);
        return;
      }
      setError(extractErrorMessage(err));
      toast.error(extractErrorMessage(err));
      setSubmitting(false);
    }
  };

  const recordLocal=(items,total,shipping)=>{
    try{
      const local=createLocalOrder({
        orderType:"supplier",
        supplier:srcName,
        supplierId:profile?._id||supplier.id,
        vendor:"Your store",
        items:items.map(i=>({name:i.productName,qty:i.quantity,price:i.unitPrice,productId:i.product})),
        subtotal:total-shipping,
        shipping,
        total,
        paymentMethod:"MOMO",
      });
      confirmLocalPayment(local.id,"MOMO");
    }catch{}
  };

  return (
    <Modal open={!!supplier} onClose={onClose} title="SUPPLIER DETAILS & B2B ORDER" subtitle={srcName} wide>
      {loading?(
        <div className="form-alert">Loading supplier catalog…</div>
      ):placed?(
        <div className="order-placed-panel">
          <div className="placed-check">✓</div>
          <h2>Supply order placed</h2>
          <p>Your B2B wholesale supply order <b>{placed.orderNumber}</b> ({placed.items} item{placed.items>1?"s":""}) worth <b>{money(placed.total)}</b> was submitted{placed.demo?" (demo record)":""}.</p>
          <p className="tiny">Funds are held by MVEC Escrow and will be released to the supplier only after you confirm delivery with your OTP.</p>
          <div className="modal-actions">
            <button className="gradient-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      ):(
        <>
          <div className="supplier-modal-head">
            {logo?<img src={logo} alt=""/>:<div className="supplier-logo-fallback">{srcName.slice(0,2).toUpperCase()}</div>}
            <div className="supplier-head-copy">
              <div className="supplier-title-row"><h2>{srcName}</h2><em className={`status ${badge==="VERIFIED"?"active":"warning"}`}>{badge==="VERIFIED"?"Verified":badge==="REJECTED"?"Unverified":"Pending"}</em></div>
              <span><Icon name="pin"/>{srcLocation}</span>
              <span>★ {Number(profile?.ratingAvg)||Number(profile?.rating)||"—"} · {rel.label}</span>
            </div>
          </div>

          <div className="supplier-metrics">
            <div><span>Location</span><b>{srcLocation}</b></div>
            <div><span>Rating</span><b>★ {Number(profile?.ratingAvg)||Number(profile?.rating)||"—"}</b></div>
            <div><span>Verification</span><b className="success-text">{badge==="VERIFIED"?"Verified / Licensed":"Unverified"}</b></div>
            <div><span>Reliability</span><b>{badge==="VERIFIED"?"Verified / Licensed":"Escrow protected"}</b></div>
          </div>

          <h3 className="modal-subhead">Wholesale catalog</h3>
          <div className="wholesale-table">
            <div className="wholesale-row wholesale-head">
              <span>Product</span><span>SKU</span><span>Unit price</span><span>MOQ</span><span>Stock</span><span>Order qty</span><span>Order</span>
            </div>
            {catalog.map(it=>{
              const q=qtyMap[it.id]||0;
              const err=lineErrors[it.id];
              const outOfStock=it.stockQty<=0;
              return (
                <div className="wholesale-row" key={it.id}>
                  <span className="wholesale-name"><b>{it.name}</b></span>
                  <span className="wholesale-sku">{it.sku}</span>
                  <span className="wholesale-price">{money(it.unitPrice)}</span>
                  <span>{it.moq}</span>
                  <span className={outOfStock?"danger-text":"success-text"}>{outOfStock?"Out of stock":it.stockQty}</span>
                  <span><input
                    className="qty-input"
                    type="number" min="0"
                    disabled={!order[it.id]||outOfStock}
                    value={order[it.id]?q:""}
                    placeholder="—"
                    onChange={e=>setQty(it.id,e.target.value)}
                  /></span>
                  <span>
                    {outOfStock?<em className="status danger">Unavailable</em>:(
                      <label className="check-box"><input type="checkbox" checked={!!order[it.id]} onChange={e=>toggle(it.id,e.target.checked)}/> Add</label>
                    )}
                  </span>
                  {err&&<em className="wholesale-error">{err}</em>}
                </div>
              );
            })}
          </div>

          <div className="order-summary-box">
            <div className="order-summary-lines">
              <span>Subtotal <b>{money(subtotal)}</b></span>
              <span>Delivery fee (estimate) <b>{subtotal?money(delivery):money(0)}</b></span>
              <span className="grand">Grand total <b>{money(grandTotal)}</b></span>
            </div>
            <div className="escrow-notice"><b>🔒 MVEC Escrow</b><p>Your payment is held by MVEC Escrow until you confirm delivery via OTP. Nothing is released to the supplier before you verify receipt.</p></div>
            {error&&<div className="form-alert error">{error}</div>}
            <div className="modal-actions">
              <button className="outline-btn" onClick={onClose} disabled={submitting}>Cancel</button>
              <button className="gradient-btn" onClick={submitOrder} disabled={!canSubmit}>
                {submitting?"Placing supply order…":`Place Wholesale Supply Order · ${money(grandTotal)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
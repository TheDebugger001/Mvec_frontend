import {useMemo,useState,useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import Icon from '../components/Icon';
import SmartTable from '../components/SmartTable';
import DashboardLayout from '../components/DashboardLayout';import Storefront from '../components/Storefront';import NotificationPanel from '../components/NotificationPanel';
import {products,categories,vendors} from '../data';
import {getOrders,updateOrder,getCommissionRate,calculateCommission,store} from '../services/mvecStore';
import {useToast} from '../components/Toast';
import {monetizationApi} from '../API/monetization';
import {extractErrorMessage} from '../API/client';
import {reviewsApi,shippingApi,notificationsApi} from '../API';

const titleCase=s=>String(s||'').toLowerCase().split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const dateDMY=d=>new Date(d).toLocaleDateString('en-GB');
const RELEASE='v9';
const read=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(`mvec_${RELEASE}_${k}`));return v??f}catch{return f}};
const write=(k,v)=>localStorage.setItem(`mvec_${RELEASE}_${k}`,JSON.stringify(v));

function Header({eyebrow,title,desc,action}){return <div className="dash-page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{action}</div>}
function Metric({label,value,sub,icon='chart'}){return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>}
function SettingCard({title,desc,children}){return <div className="data-card"><h3>{title}</h3>{desc&&<p className="tiny">{desc}</p>}{children}</div>}

// INTEGRATION LAYER: vendor/admin subscription & advertisement pages hit the
// real backend (/api/vendor, /api/buyer, /api/admin) and fall back to the
// existing localStorage mock whenever the API or authentication is unavailable.

function hasToken(){return !!localStorage.getItem('huska_token');}

function MonetizationModule({role,type}){
 const toast=useToast();
 const [rows,setRows]=useState(null);
 const [subData,setSubData]=useState(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);

 useEffect(()=>{
   let mounted=true;
   const load=async()=>{
     if(!hasToken()){setLoading(false);return;}
     try{
       if(role==='vendor'&&type==='subscription'){
         const r=await monetizationApi.getVendorSubscription();
         if(!mounted)return;
         setSubData(r);
         setRows(r.tiers||[]);
       } else if(role==='vendor'&&type==='advertisements'){
         const r=await monetizationApi.getVendorAdvertisements();
         if(!mounted)return;
         setRows(r.data||[]);
       } else if(role==='admin'&&type==='subscriptions'){
         const r=await monetizationApi.getAdminSubscriptions();
         if(!mounted)return;
         const combined=r.data||[];
         try{
           const buyer=await monetizationApi.getAdminBuyerSubscriptions();
           combined.push(...(buyer.data||[]));
         }catch(e){/* buyer branch optional */}
         setRows(combined);
       } else if(role==='admin'&&type==='advertising'){
         const r=await monetizationApi.getAdminAdvertisements();
         if(!mounted)return;
         setRows(r.data||[]);
       }
     }catch(err){
       if(mounted)setError(extractErrorMessage(err));
     }finally{
       if(mounted)setLoading(false);
     }
   };
   load();
   return ()=>{mounted=false;};
 },[role,type]);

 const defaults={
  advertisements:[{id:'AD-1001',product:'Samsung Galaxy S25',placement:'Homepage hero',budget:150000,status:'Active',clicks:1820,impressions:28400},{id:'AD-1002',product:'Classic Leather Sneakers',placement:'Fashion category',budget:80000,status:'Scheduled',clicks:0,impressions:0},{id:'AD-1003',product:'Office Chair Pro',placement:'Search results',budget:95000,status:'Paused',clicks:412,impressions:7900}],
  subscription:[{id:'SUB-V-101',plan:'Vendor Premium',holder:'Kigali Tech Store',price:15000,billing:'Monthly',renewal:'30/09/2026',status:'Active'},{id:'SUB-V-102',plan:'Vendor Premium',holder:'Fashion Rwanda',price:15000,billing:'Monthly',renewal:'—',status:'Available'}],
  advertising:[{id:'AD-ADM-01',vendor:'Kigali Tech Store',product:'Samsung Galaxy S25',placement:'Homepage',budget:250000,status:'Active',ctr:'6.4%'},{id:'AD-ADM-02',vendor:'Fashion Rwanda',product:'Classic Leather Sneakers',placement:'Fashion category',budget:100000,status:'Pending approval',ctr:'—'}],
  subscriptions:[{id:'SUB-001',holder:'Kigali Tech Store',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Active'},{id:'SUB-002',holder:'Aline Uwase',type:'Buyer Ad Removal',amount:5000,cycle:'Monthly',status:'Active'},{id:'SUB-003',holder:'Fashion Rwanda',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Expired'}],
 };

 const stored=read(`mvec_${role}_${type}`,null);
 const mock=stored||defaults[type]||[];
 const fallbackRows=subData?rows||[]:(rows&&rows.length?rows:mock);
 const display=error||loading?(loading&&hasToken()?mock:mock):(rows===null?mock:rows);

 // Normalise backend rows to the exact shape the SmartTable expects.
 const normalize=(r)=>{
   if(type==='subscription'||type==='subscriptions'){
     return {
       id:r.id||r.publicId,
       plan:r.plan||(r.type==='Buyer Ad Removal'?'Buyer Ad Removal':r.type)||'Vendor Premium',
       holder:r.holder||'—',
       price:r.price??r.amount??0,
       billing:r.billing||r.cycle||'Monthly',
       renewal:r.renewal||'—',
       status:r.status||'Available',
     };
   }
   if(type==='advertisements'){
     return {
       id:r.id||r.publicId,
       product:r.product,
       placement:r.placement,
       budget:r.budget,
       status:r.status,
       clicks:r.clicks,
       impressions:r.impressions,
     };
   }
   if(type==='advertising'){
     return {
       id:r.id||r.publicId,
       vendor:r.vendor||'—',
       product:r.product,
       placement:r.placement,
       budget:r.budget,
       status:r.status,
       ctr:r.ctr,
     };
   }
   return r;
 };
 const normalized=useMemo(()=>display.map(normalize),[display,type]);

 const cfg=moduleConfig[role][type];
 const isSub=type==='subscription'||type==='subscriptions';
 const isAd=type==='advertisements'||type==='advertising';
 const editable=isSub||isAd;

 const action=(row)=>{
   const notify=m=>toast.info(m);
   if(isAd){
     return <button className="table-action-btn" onClick={async()=>{
       const next=row.status==='Active'?'Paused':'Active';
       const optimistic=normalized.map(x=>x.id===row.id?{...x,status:next}:x);
       setRows(prev=>prev?optimistic:prev);
       if(hasToken()){
         try{
           const endpoint=type==='advertisements'?monetizationApi.updateVendorAdvertisementStatus:monetizationApi.updateAdminAdvertisementStatus;
           await endpoint(row.id,next==='Active'?'ACTIVE':'PAUSED');
           notify(`Campaign ${next.toLowerCase()}.`);
         }catch(e){notify(extractErrorMessage(e));}
       } else {
         const src=read(`mvec_${role}_${type}`,defaults[type]);
         const updated=src.map(x=>String(x.id)===String(row.id)?{...x,status:next}:x);
         write(`mvec_${role}_${type}`,updated);
         notify(`Record ${next.toLowerCase()}.`);
       }
     }}>{row.status==='Active'?'Pause':'Activate'}</button>;
   }
   if(isSub){
     const target=type==='subscriptions'?'admin':'vendor';
     return <button className="table-action-btn" onClick={async()=>{
       const plan=row.planKey==='PREMIUM'||row.plan==='Vendor Premium'||row.plan==='Buyer Ad Removal'?'premium':'free';
       const next=row.status==='Active'?'Available':'Active';
       const optimistic=normalized.map(x=>x.id===row.id?{...x,status:next}:x);
       setRows(prev=>prev?optimistic:prev);
       if(hasToken()){
         try{
           const fn=target==='vendor'?monetizationApi.upgradeVendorSubscription:monetizationApi.upgradeBuyerSubscription;
           await fn({plan});
           notify('Subscription updated.');
         }catch(e){notify(extractErrorMessage(e));}
       } else {
         const src=read(`mvec_${role}_${type}`,defaults[type]);
         const updated=src.map(x=>String(x.id)===String(row.id)?{...x,status:next}:x);
         write(`mvec_${role}_${type}`,updated);
         notify(`Record ${next.toLowerCase()}.`);
       }
     }}>{row.status==='Active'?'Cancel':'Activate'}</button>;
   }
   return null;
 };

 const rowKey=r=>r.id||r.name||r.plan||r.zone||r.control||r.signal||r.party;
 return <><Header eyebrow={`${role.toUpperCase()} · ${cfg[0]}`} title={cfg[1]} desc={cfg[2]}/><div className="data-card"><SmartTable columns={Object.keys(normalized[0]||{}).map(k=>({key:k,label:k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),render:r=>typeof r[k]==='boolean'?r[k]?'Yes':'No':(k==='price'||k==='budget'||k==='amount')&&typeof r[k]==='number'?money(r[k]):String(r[k])}))} rows={normalized} rowKey={rowKey} searchPlaceholder={`Search ${cfg[1].toLowerCase()}…`} exportName={`mvec-${role}-${type}`} actions={action}/></div></>;
}

const moduleConfig={
 vendor:{
  support:['support','MVEC Support','Contact MVEC directly about payments, delivery, orders or marketplace issues.'],
  categories:['categories','Category management','Organize products into simple categories and subcategories.'],
  purchases:['purchases','Purchases','Track stock purchased from suppliers and supplier order history.'],
  advertisements:['advertisements','Advertising','Create sponsored product campaigns and monitor their performance.'],
  subscription:['subscription','Subscription','Manage the optional premium vendor plan and advanced tools.'],
  refunds:['refunds','Refunds','Review buyer refund requests and their evidence.'],
  reviews:['reviews','Reviews','Monitor customer ratings, feedback and seller reputation.'],
  messages:['messages','Messages','Keep buyer and supplier conversations organized.'],
  shipping:['shipping','Shipping','Configure delivery zones, fees and estimated delivery times.']
 },
 supplier:{
  support:['support','MVEC Support','Contact MVEC directly about payments, delivery, supply orders or marketplace issues.'],
  requests:['supply-requests','Supply Requests','Review incoming vendor requests and confirm fulfillment.'],
  transactions:['transactions','Transactions','Every supplier payment and settlement has an auditable record.'],
  messages:['messages','Messages','Communicate with vendors about products and deliveries.'],
  reviews:['reviews','Reviews','Review supplier feedback and reliability indicators.']
 },
 affiliate:{support:['support','MVEC Support','Contact MVEC directly about payments, delivery, commissions or marketplace issues.'],fraud:['fraud','Fraud Protection','Review flagged clicks, self-referrals and suspicious conversions.']},
 admin:{
  support:['support','MVEC Support','Contact MVEC directly about platform issues and escalations.'],
  payments:['payments','Payments','Monitor payment confirmations and protected settlement states.'],
  refunds:['refunds','Refunds','Review marketplace refund requests and financial return records.'],
  advertising:['advertising','Advertising','Manage sponsored products, campaigns and marketplace placements.'],
  subscriptions:['subscriptions','Subscriptions','Manage optional vendor premium and buyer ad-removal plans.'],
  languages:['languages','Languages','Manage multilingual marketplace content and language availability.'],
  locations:['locations','Locations','Manage Rwanda provinces, districts, sectors and delivery rules.'],
  security:['security','Security','Review platform security controls and role permissions.'],
  audit:['audit-logs','Audit Logs','Trace important changes and financial events across MVEC.'],
  notifications:['notifications','Notifications','Monitor marketplace notifications and delivery status messages.'],
  recommendations:['recommendations','Recommendations','Manage product recommendation signals and rules.'],
  matching:['matching','Supplier Matching','Help vendors discover suppliers using transparent matching signals.'],
  trust:['trust','Trust Scores','Monitor transparent vendor and supplier trust metrics.'],
  system:['system','System Administration','Platform maintenance, feature flags and operational controls.']
 }
};

function GenericTableModule({role,type}){
 const cfg=moduleConfig[role][type];
 if((role==='vendor'&&(type==='subscription'||type==='advertisements'))||(role==='admin'&&(type==='subscriptions'||type==='advertising'))) return <MonetizationModule role={role} type={type}/>;
 const [rows,setRows]=useState(()=>read(`mvec_${role}_${type}`,null));
 const defaults={
  categories:categories.map((x,i)=>({id:`CAT-${i+1}`,name:x,products:[42,31,27,24,18,16,12,9][i],status:i===6?'Paused':'Active'})),
  purchases:[{id:'PO-2026-001',supplier:'Rwanda Wholesale Suppliers',items:24,total:2200000,status:'HELD',date:'28/08/2026'},{id:'PO-2026-002',supplier:'East Africa Fashion Supply',items:40,total:1800000,status:'RELEASED',date:'25/08/2026'},{id:'PO-2026-003',supplier:'Kigali General Suppliers',items:16,total:920000,status:'PROCESSING',date:'02/09/2026'}],
  advertisements:[{id:'AD-1001',product:'Samsung Galaxy S25',placement:'Homepage hero',budget:150000,status:'Active',clicks:1820,impressions:28400},{id:'AD-1002',product:'Classic Leather Sneakers',placement:'Fashion category',budget:80000,status:'Scheduled',clicks:0,impressions:0},{id:'AD-1003',product:'Office Chair Pro',placement:'Search results',budget:95000,status:'Paused',clicks:412,impressions:7900}],
  subscription:role==='vendor'?[{id:'SUB-V-101',plan:'Vendor Premium',holder:'Kigali Tech Store',price:15000,billing:'Monthly',renewal:'30/09/2026',status:'Active'},{id:'SUB-V-102',plan:'Vendor Premium',holder:'Fashion Rwanda',price:15000,billing:'Monthly',renewal:'—',status:'Available'}]:[{id:'SUB-S-101',plan:'Supplier Plus',holder:'Rwanda Wholesale Suppliers',price:25000,billing:'Monthly',renewal:'20/09/2026',status:'Active'},{id:'SUB-S-102',plan:'Supplier Plus',holder:'East Africa Fashion Supply',price:25000,billing:'Monthly',renewal:'—',status:'Available'}],
  refunds:[{id:'REF-ADM-001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',requester:'Aline Uwase',reason:'Damaged on arrival',amount:68000,evidence:'Photo attached',status:'Pending review',date:'31/08/2026'},{id:'REF-ADM-002',order:'MVEC-SNEAKERS-2026-000002-4822',requester:'Jean Paul',reason:'Wrong size delivered',amount:95000,evidence:'Photo attached',status:'Approved',date:'30/08/2026'},{id:'REF-ADM-003',order:'SUP-2026-1001',requester:'Kigali Tech Store',reason:'Missing wholesale items',amount:2200000,evidence:'Delivery record',status:'Escalated',date:'29/08/2026'}],
  reviews:role==='supplier'?[{id:'REV-S-301',product:'Bulk Bluetooth Headsets',reviewer:'Kigali Tech Store',rating:5,comment:'Consistent stock and reliable fulfillment.',status:'Published',date:'31/08/2026'},{id:'REV-S-302',product:'Fashion Basics Pack',reviewer:'Urban Closet',rating:4,comment:'Good wholesale pricing and packaging.',status:'Published',date:'30/08/2026'},{id:'REV-S-303',product:'Kitchen Starter Set',reviewer:'HomeStyle Kigali',rating:3,comment:'Delivery arrived one day late.',status:'Needs response',date:'29/08/2026'}]:[{id:'REV-V-201',product:'Wireless Headphones',reviewer:'Aline Uwase',rating:5,comment:'Great sound and fast delivery.',status:'Published',date:'31/08/2026'},{id:'REV-V-202',product:'Smart Watch Active',reviewer:'Jean Paul',rating:4,comment:'Good battery life.',status:'Published',date:'30/08/2026'},{id:'REV-V-203',product:'Office Chair Pro',reviewer:'Diane Mukamana',rating:2,comment:'Assembly instructions were unclear.',status:'Needs response',date:'29/08/2026'}],
  shipping:[{id:'ZONE-001',zone:'Kigali City',fee:2000,eta:'Same day',method:'Standard / Pickup',status:'Active'},{id:'ZONE-002',zone:'Northern Province',fee:5000,eta:'2–4 days',method:'Standard',status:'Active'},{id:'ZONE-003',zone:'Southern Province',fee:7000,eta:'3–6 days',method:'Standard',status:'Active'},{id:'ZONE-004',zone:'Eastern Province',fee:7000,eta:'3–6 days',method:'Standard',status:'Paused'}],
  messages:[{id:'MSG-1001',from:role==='vendor'?'Aline Uwase':'Kigali Tech Store',subject:'Order delivery question',status:'Unread',date:'31/08/2026'},{id:'MSG-1002',from:'Rwanda Wholesale Suppliers',subject:'Wholesale stock update',status:'Read',date:'30/08/2026'}],
  'supply-requests':[{id:'SUP-2026-1001',vendor:'Kigali Tech Store',products:'Phones + accessories',total:2200000,status:'Awaiting acceptance',requested:'01/09/2026'},{id:'SUP-2026-1002',vendor:'Urban Closet',products:'Sneakers',total:860000,status:'Processing',requested:'30/08/2026'}],
  transactions:[{id:'TXN-2026-0001',party:'Kigali Tech Store',order:'SUP-2026-1001',amount:2200000,supplierSettlement:2200000,status:'HELD',release:'After receipt'},{id:'TXN-2026-0002',party:'Smart Hub Rwanda',order:'SUP-2026-1002',amount:1480000,supplierSettlement:1480000,status:'RELEASED',release:'30/08/2026'}],
  fraud:[{id:'RISK-1001',affiliate:'AFF-00045',signal:'Self-referral pattern',orders:2,risk:'High',status:'Flagged'},{id:'RISK-1002',affiliate:'AFF-00021',signal:'Repeated device clicks',orders:18,risk:'Medium',status:'Review'},{id:'RISK-1003',affiliate:'AFF-00018',signal:'Unusual conversion timing',orders:7,risk:'Low',status:'Monitoring'}],
  payments:[{id:'PAY-2026-0001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',payer:'Aline Uwase',amount:68000,method:'MTN MoMo',status:'HELD'},{id:'PAY-2026-0002',order:'MVEC-SNEAKERS-2026-000002-4822',payer:'Jean Paul',amount:95000,method:'Airtel Money',status:'RELEASED'},{id:'PAY-2026-0003',order:'SUP-2026-1001',payer:'Kigali Tech Store',amount:2200000,method:'MTN MoMo',status:'PENDING'}],
  adminRefunds:[{id:'REF-ADM-001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',requester:'Aline Uwase',reason:'Damaged on arrival',amount:68000,evidence:'Photo attached',status:'Pending review',date:'31/08/2026'},{id:'REF-ADM-002',order:'MVEC-SNEAKERS-2026-000002-4822',requester:'Jean Paul',reason:'Wrong size delivered',amount:95000,evidence:'Photo attached',status:'Approved',date:'30/08/2026'},{id:'REF-ADM-003',order:'SUP-2026-1001',requester:'Kigali Tech Store',reason:'Missing wholesale items',amount:2200000,evidence:'Delivery record',status:'Escalated',date:'29/08/2026'}],
  advertising:[{id:'AD-ADM-01',vendor:'Kigali Tech Store',product:'Samsung Galaxy S25',placement:'Homepage',budget:250000,status:'Active',ctr:'6.4%'},{id:'AD-ADM-02',vendor:'Fashion Rwanda',product:'Classic Leather Sneakers',placement:'Fashion category',budget:100000,status:'Pending approval',ctr:'—'}],
  subscriptions:[{id:'SUB-001',holder:'Kigali Tech Store',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Active'},{id:'SUB-002',holder:'Aline Uwase',type:'Buyer Ad Removal',amount:5000,cycle:'Monthly',status:'Active'},{id:'SUB-003',holder:'Fashion Rwanda',type:'Vendor Premium',amount:15000,cycle:'Monthly',status:'Expired'}],
  languages:[{code:'rw',name:'Kinyarwanda',role:'Primary',coverage:'100%',activeUsers:'58%'},{code:'en',name:'English',role:'Secondary',coverage:'100%',activeUsers:'34%'},{code:'fr',name:'French',role:'Secondary',coverage:'72%',activeUsers:'8%'}],
  locations:[{province:'Kigali City',districts:3,sectors:35,deliveryFee:2000,coverage:'100%'},{province:'Northern Province',districts:5,sectors:36,deliveryFee:5000,coverage:'92%'},{province:'Southern Province',districts:8,sectors:101,deliveryFee:7000,coverage:'86%'},{province:'Eastern Province',districts:7,sectors:95,deliveryFee:7000,coverage:'83%'}],
  security:[{id:'SEC-001',control:'Role-based access',area:'Identity & access',owner:'Platform Security',status:'Enabled',lastReview:'01/09/2026'},{id:'SEC-002',control:'OTP authentication',area:'Account security',owner:'Identity Service',status:'Enabled',lastReview:'31/08/2026'},{id:'SEC-003',control:'Financial action audit',area:'Finance',owner:'Finance Operations',status:'Enabled',lastReview:'30/08/2026'},{id:'SEC-004',control:'Session anomaly detection',area:'Threat monitoring',owner:'Security Operations',status:'Monitoring',lastReview:'02/09/2026'}],
  audit:[{id:'AUD-10001',actor:'MVEC Administrator',action:'Vendor verification updated',entity:'Vendor VND-0086',date:'31/08/2026'},{id:'AUD-10002',actor:'MVEC System',action:'Payment marked HELD',entity:'MVEC-TXN-2026-0001',date:'31/08/2026'},{id:'AUD-10003',actor:'Finance Operations',action:'Refund approved',entity:'REF-ADM-002',date:'30/08/2026'}],
  notifications:[{id:'NTF-1001',recipient:'Kigali Tech Store',channel:'In-app',type:'Payment',message:'Order payment was confirmed and funds are protected.',status:'Sent',date:'31/08/2026'},{id:'NTF-1002',recipient:'Rwanda Wholesale Suppliers',channel:'SMS',type:'Supply order',message:'Supply order SUP-2026-1001 is awaiting acceptance.',status:'Delivered',date:'31/08/2026'},{id:'NTF-1003',recipient:'Aline Uwase',channel:'Push',type:'Delivery',message:'Your order is out for delivery.',status:'Read',date:'31/08/2026'}],
  recommendations:[{id:'REC-001',signal:'Purchase history',source:'Completed orders',weight:35,enabled:true,lastUpdated:'02/09/2026'},{id:'REC-002',signal:'Search history',source:'Marketplace searches',weight:25,enabled:true,lastUpdated:'02/09/2026'},{id:'REC-003',signal:'Product views',source:'Product detail views',weight:20,enabled:true,lastUpdated:'01/09/2026'},{id:'REC-004',signal:'Similar customers',source:'Behavior similarity',weight:12,enabled:false,lastUpdated:'28/08/2026'},{id:'REC-005',signal:'Popular products',source:'Marketplace demand',weight:8,enabled:true,lastUpdated:'02/09/2026'}],
  matching:[{id:'MATCH-001',supplier:'Rwanda Wholesale Suppliers',category:'Electronics',score:95,price:'Excellent',stock:'High',reliability:'98%',distance:'Kigali',status:'Recommended'},{id:'MATCH-002',supplier:'East Africa Fashion Supply',category:'Fashion',score:91,price:'Good',stock:'High',reliability:'96%',distance:'Kigali',status:'Recommended'},{id:'MATCH-003',supplier:'Kigali General Suppliers',category:'Home & Living',score:87,price:'Good',stock:'Medium',reliability:'93%',distance:'Kigali',status:'Available'}],
  trust:[{id:'TRUST-001',party:'Kigali Tech Store',type:'Vendor',score:94,completion:'98%',refundRate:'2%',disputeRate:'1%',rating:'4.8/5',trend:'+3'},{id:'TRUST-002',party:'Rwanda Wholesale Suppliers',type:'Supplier',score:91,completion:'96%',refundRate:'2%',disputeRate:'1%',rating:'4.7/5',trend:'+1'},{id:'TRUST-003',party:'Aline Uwase',type:'Buyer',score:88,completion:'94%',refundRate:'3%',disputeRate:'0%',rating:'4.6/5',trend:'Stable'}],
  system:[{id:'SYS-001',setting:'Marketplace availability',value:'Operational',scope:'Core platform',lastChanged:'02/09/2026',owner:'Operations'},{id:'SYS-002',setting:'Protected settlement',value:'Enabled',scope:'Payments',lastChanged:'01/09/2026',owner:'Finance'},{id:'SYS-003',setting:'Maintenance mode',value:'Off',scope:'Platform access',lastChanged:'29/08/2026',owner:'Engineering'},{id:'SYS-004',setting:'API health monitoring',value:'Enabled',scope:'Integrations',lastChanged:'02/09/2026',owner:'Engineering'}]
 };
 const defaultRows = role==='admin' && type==='refunds' ? defaults.adminRefunds : defaults[type]; const rawInitial=rows||defaultRows||[]; const initial=role==='supplier'&&type==='transactions'?rawInitial.map(({fee,...r})=>({...r,supplierSettlement:r.supplierSettlement??r.amount})):rawInitial; const [data,setData]=useState(initial);
 // ── Backend sync layer: hydrate real DB rows for wired modules, fall back to local mock. ──
 const backendFetch=async()=>{
   const map=(r)=>{
     if(type==='reviews')return {id:r.id,product:r.product,reviewer:r.reviewer,rating:r.rating,comment:r.review||r.comment,status:titleCase(r.status||'Published'),date:r.date||r.createdAt};
     if(type==='shipping')return {id:r.id,zone:r.zone||r.name,fee:r.fee,eta:r.eta,method:r.method,status:titleCase(r.status||'Active')};
     if(type==='notifications')return {id:r.id,recipient:r.recipient||'',channel:titleCase(r.channel||'In-app'),type:r.type,message:r.message||r.title,status:r.status||(r.isRead?'Read':'Unread'),date:r.createdAt};
     return r;
   };
   if(role==='vendor'&&type==='reviews'){const x=await reviewsApi.getVendorReviews();return (x.data||[]).map(map);}
   if(role==='vendor'&&type==='shipping'){const x=await shippingApi.getMine();return (x.data||[]).map(map);}
   if(role==='admin'&&type==='reviews'){const x=await reviewsApi.getAdmin();return (x.data||[]).map(map);}
   if(role==='admin'&&type==='notifications'){const x=await notificationsApi.getAdmin();return (x.data||[]).map(map);}
   return null;
 };
 useEffect(()=>{let mounted=true;(async()=>{if(!hasToken())return;try{const next=await backendFetch();if(next&&mounted&&next.length){setData(next);write(`mvec_${role}_${type}`,next);}}catch(e){if(mounted)console.warn(type,extractErrorMessage(e));}})();return()=>{mounted=false};},[role,type]);
 const save=next=>{setData(next);write(`mvec_${role}_${type}`,next)};
 const columns=useMemo(()=>{const keys=Object.keys(data[0]||{});return keys.map(k=>({key:k,label:k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()),render:r=>typeof r[k]==='boolean'?r[k]?'Yes':'No':(k==='amount'||k==='budget'||k==='price'&&typeof r[k]==='number')?money(r[k]):k==='rating'?`★ ${r[k]}`:String(r[k])}))},[data]);
 const editable=['advertisements','subscription','shipping','categories'].includes(type);
 const actionTypes=['refunds','reviews','notifications','recommendations','matching','trust','security','system','fraud','advertising','subscriptions','shipping','categories'];
 const {info}=useToast(); const [details,setDetails]=useState(null);
 const contextualAction=(row)=>{
   const notify=(message)=>info(message);
   if(type==='refunds') return <button className="table-action-btn" onClick={()=>{const next=row.status==='Approved'?'Pending review':'Approved';save(data.map(x=>x===row?{...x,status:next}:x));notify(`Refund ${row.id} marked ${next.toLowerCase()}.`)}}>{row.status==='Approved'?'Reopen':'Review'}</button>;
   if(type==='reviews') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:x.status==='Published'?'Response requested':'Published'}:x));notify('Review status updated.')}}>{row.status==='Published'?'Respond':'Publish'}</button>;
   if(type==='notifications') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:'Read'}:x));notify('Notification marked as read.')}}>{row.status==='Read'?'Read':'Mark read'}</button>;
   if(type==='recommendations') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,enabled:!x.enabled,lastUpdated:dateDMY(new Date())}:x));notify(`Recommendation signal ${row.enabled?'disabled':'enabled'}.`)}}>{row.enabled?'Disable':'Enable'}</button>;
   if(type==='matching') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,score:Math.min(99,Number(x.score)+1),status:'Recommended'}:x));notify('Supplier match refreshed.')}}>Refresh match</button>;
   if(type==='trust') return <button className="table-action-btn" onClick={()=>setDetails(row)}>Review</button>;
   if(type==='security') return <button className="table-action-btn" onClick={()=>setDetails(row)}>Review policy</button>;
   if(type==='system') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,lastChanged:dateDMY(new Date())}:x));notify(`${row.setting} updated.`)}}>Apply</button>;
   if(type==='fraud') return <button className="table-action-btn" onClick={()=>{save(data.map(x=>x===row?{...x,status:x.status==='Flagged'?'Review':'Monitoring'}:x));notify('Risk case status updated.')}}>Review</button>;
   return editable?<button className="table-action-btn" onClick={()=>{const nextStatus=row.status==='Active'?'Paused':'Active';const key=Object.keys(row).find(k=>k==='status');if(key)save(data.map(x=>x===row?{...x,status:nextStatus}:x));notify(`Record ${nextStatus.toLowerCase()}.`)}}>{row.status==='Active'?'Pause':'Activate'}</button>:null;
 };
 if(type==='support') return <SupportModule role={role}/>;
 return <><Header eyebrow={`${role.toUpperCase()} · ${cfg[0]}`} title={cfg[1]} desc={cfg[2]}/><div className="data-card"><SmartTable columns={columns} rows={data} rowKey={r=>r.id||r.name||r.plan||r.zone||r.control||r.signal||r.party} searchPlaceholder={`Search ${cfg[1].toLowerCase()}…`} exportName={`mvec-${role}-${type}`} actions={actionTypes.includes(type)?contextualAction:undefined}/></div>{details&&<div className="modal-backdrop" onMouseDown={()=>setDetails(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDetails(null)}>×</button><span className="eyebrow">DETAILS</span><h2>{type==='trust'?'Trust profile':'Security policy'}</h2><div className="vendor-detail-grid">{Object.entries(details).map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b>{String(v)}</b></div>)}</div><button className="gradient-btn" onClick={()=>setDetails(null)}>Done</button></div></div>}</>;
}


function SupportModule({role}){
 const [subject,setSubject]=useState('Marketplace support'); const [reference,setReference]=useState(''); const [message,setMessage]=useState(''); const toast=useToast();
 const submit=()=>{if(!subject.trim()||!message.trim())return;write(`mvec_${role}_support`,{id:`CASE-${Date.now()}`,subject:subject.trim(),reference:reference.trim(),message:message.trim(),status:'Submitted',date:dateDMY(new Date())});toast.success('Support request submitted successfully.');setMessage('');};
 return <div className="data-card support-direct"><h3>Contact MVEC</h3><p>Send a message directly to the MVEC support team. Your request can be linked to an order or transaction reference.</p><div className="form-row"><label className="field"><span>Subject</span><input value={subject} onChange={e=>setSubject(e.target.value)}/></label><label className="field"><span>Order or transaction ID</span><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional"/></label></div><label className="field"><span>Message</span><textarea rows="5" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Describe the issue…"/></label><div className="support-actions"><button className="gradient-btn" onClick={submit} disabled={!subject.trim()||!message.trim()}>Send to MVEC</button><a className="outline-btn" href="sms:+250788100000">Send SMS</a></div></div>;
}
function BuyerRefunds(){
 const [rows,setRows]=useState(()=>read('mvec_buyer_refunds',[{id:'REF-1001',order:'MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821',reason:'Damaged product',amount:68000,status:'Under review',date:'31/08/2026'}]));
 const orders=getOrders(); const toast=useToast(); const [open,setOpen]=useState(false); const [orderId,setOrderId]=useState(orders[0]?.id||''); const [reason,setReason]=useState('');
 const submit=()=>{const order=orders.find(o=>String(o.id)===String(orderId));if(!order||!reason.trim())return;const next={id:`REF-${Date.now()}`,order:order.id,reason:reason.trim(),amount:Number(order.total||0),status:'Submitted',date:dateDMY(new Date())};const list=[next,...rows];setRows(list);write('mvec_buyer_refunds',list);setReason('');toast.success('Refund request submitted successfully.');setOpen(false)};
 return <><Header eyebrow="BUYER" title="Refunds" desc="Request and track refunds with evidence and a clear audit trail."/><SettingCard title="Request a refund"><p className="tiny">Choose an order, explain the problem and submit the request for review.</p><button className="gradient-btn" onClick={()=>setOpen(true)}>Start refund request</button></SettingCard><div className="data-card"><SmartTable columns={[{key:'id',label:'Refund'},{key:'order',label:'Order'},{key:'reason',label:'Reason'},{key:'amount',label:'Amount',render:r=>money(r.amount)},{key:'status',label:'Status'},{key:'date',label:'Date'}]} rows={rows} rowKey={r=>r.id} searchPlaceholder="Search refunds…" exportName="buyer-refunds"/></div>{open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setOpen(false)}>×</button><span className="eyebrow">REFUND REQUEST</span><h2>Request a refund</h2><label className="field"><span>Order</span><select value={orderId} onChange={e=>setOrderId(e.target.value)}>{orders.length?orders.map(o=><option key={o.id} value={o.id}>{o.id} · {money(o.total)}</option>):<option value="">No orders available</option>}</select></label><label className="field"><span>Reason</span><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Damaged product"/></label><div className="modal-actions"><button className="outline-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="gradient-btn" onClick={submit} disabled={!orderId||!reason.trim()}>Submit request</button></div></div></div>}</>;
}

function BuyerMessages(){
 const [text,setText]=useState(''); const [msgs,setMsgs]=useState(()=>read('mvec_buyer_messages',[{from:'Kigali Tech Store',text:'Your order is being prepared.',date:'31/08/2026'}]));
 const send=()=>{if(!text.trim())return;const next=[...msgs,{from:'You',text:text.trim(),date:dateDMY(new Date())}];setMsgs(next);write('mvec_buyer_messages',next);setText('');};
 return <><Header eyebrow="BUYER" title="Messages" desc="Contact a seller about an order and keep the conversation linked to its reference."/><div className="data-card"><div className="thread-head"><div><h3>Kigali Tech Store</h3><small>MVEC-WIRELESS-NOISE-CANCELLING-HEADPHONES-2026-000001-4821</small></div><Link className="outline-btn" to="/orders">View order</Link></div><div className="message-list">{msgs.map((m,i)=><div key={i} className={'message-bubble '+(m.from==='You'?'mine':'theirs')}><p>{m.text}</p><small>{m.from} · {m.date}</small></div>)}</div><div className="message-compose"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message…" onKeyDown={e=>e.key==='Enter'&&send()}/><button className="gradient-btn" onClick={send}>Send</button></div></div></>;
}

function BuyerModule({type}){
 if(type==='compare') return <><Header eyebrow="BUYER" title="Compare products" desc="Compare price, rating, stock and seller trust before you buy."/><div className="dash-grid">{products.slice(0,3).map(p=><div className="data-card" key={p.id}><img className="module-product-image" src={p.image} alt=""/><h3>{p.name}</h3><p>{p.vendor}</p><strong>{money(p.price)}</strong><div className="comparison-list"><span>Rating <b>★ {p.rating}</b></span><span>Stock <b>{p.stock}</b></span><span>Seller <b>Verified ✓</b></span><span>Category <b>{p.category}</b></span></div></div>)}</div></>;
 if(type==='recommendations') return <><Header eyebrow="BUYER" title="Recommended for you" desc="Recommendations can use purchases, searches, views and similar products."/><div className="product-grid">{products.slice(0,6).map(p=><div className="product-card" key={p.id}><Link to={`/product/${p.id}`} className="product-img"><img src={p.image} alt={p.name}/></Link><div className="product-info"><small>Recommended</small><Link to={`/product/${p.id}`} className="product-name">{p.name}</Link><b>{money(p.price)}</b></div></div>)}</div></>;
 if(type==='refunds') return <BuyerRefunds/>;
 if(type==='messages') return <BuyerMessages/>;
 if(type==='notifications') return <><Header eyebrow="BUYER" title="Notifications" desc="Order, payment, delivery and marketplace updates in one place."/><NotificationPanel role="buyer"/></>;
 if(type==='support') return <><Header eyebrow="BUYER" title="Help & Support" desc="Get help with orders, payments, delivery and refunds."/><div className="dash-grid"><SettingCard title="Order problem" desc="Something went wrong with an order? Open the order and choose Report a problem."><Link className="gradient-btn" to="/orders">View my orders</Link></SettingCard><SettingCard title="Common questions"><div className="timeline">{['How do I track my order?','How are delivery fees calculated?','How do refunds work?','How can I contact a seller?'].map((x,i)=><div className="timeline-item done" key={x}><i/><div><b>{i+1}. {x}</b><small>MVEC Help Center</small></div></div>)}</div></SettingCard></div></>;
 if(type==='subscription') return <BuyerSubscription/>;
 return null;
}

export default function FeaturePages({role}){
 const path=useLocation().pathname; const key=path.split('/').filter(Boolean)[1]||'';
 if(role==='buyer') return <Storefront><main className="account-page"><BuyerModule type={key}/></main></Storefront>;
 if(!moduleConfig[role]?.[key]) return <DashboardLayout admin={role==='admin'}><div className="data-card"><h2>Page unavailable</h2><p>The requested workspace page could not be found.</p><Link className="gradient-btn" to={role==='admin'?'/admin':`/${role}`}>Return to dashboard</Link></div></DashboardLayout>; return <DashboardLayout admin={role==='admin'}><GenericTableModule role={role} type={key}/></DashboardLayout>;
}

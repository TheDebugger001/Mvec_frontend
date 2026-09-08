import {useMemo,useState} from "react";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import {createOrder,confirmPayment,addNotification} from "../services/mvecStore";
import {useToast} from "../components/Toast";

const suppliers=[
 {name:"Rwanda Wholesale Suppliers",category:"Electronics",rating:4.8,products:126,moq:10,location:"Kigali",verified:true},
 {name:"East Africa Fashion Supply",category:"Fashion",rating:4.7,products:84,moq:5,location:"Kigali",verified:true},
 {name:"Kigali General Suppliers",category:"General",rating:4.5,products:53,moq:20,location:"Gasabo",verified:false},
 {name:"Great Lakes Home Supply",category:"Home & Living",rating:4.6,products:72,moq:8,location:"Kicukiro",verified:true},
 {name:"Rwanda Sports Wholesale",category:"Sports & Fitness",rating:4.7,products:61,moq:12,location:"Nyarugenge",verified:true},
 {name:"AutoSource Rwanda",category:"Automotive",rating:4.4,products:49,moq:6,location:"Kigali",verified:true},
 {name:"AgriTrade Rwanda",category:"Agriculture",rating:4.6,products:93,moq:25,location:"Musanze",verified:true},
 {name:"Kivu Beauty Distribution",category:"Beauty",rating:4.5,products:57,moq:10,location:"Rubavu",verified:true},
 {name:"Rwanda Office & Stationery",category:"Office Supplies",rating:4.3,products:68,moq:15,location:"Kigali",verified:false}
];

export default function VendorNetwork(){
 const [q,setQ]=useState("");const [page,setPage]=useState(1);const toast=useToast();const perPage=6;
 const filtered=useMemo(()=>suppliers.filter(s=>`${s.name} ${s.category} ${s.location}`.toLowerCase().includes(q.trim().toLowerCase())),[q]);
 const safePage=Math.min(page,Math.max(1,Math.ceil(filtered.length/perPage)));
 const rows=filtered.slice((safePage-1)*perPage,safePage*perPage);
 const search=e=>{setQ(e.target.value);setPage(1)};
 const placeOrder=s=>{
  const total=220000;
  const order=createOrder({buyer:"Kigali Tech Store",buyerPhone:"+250 788 100 002",vendor:"Kigali Tech Store",supplier:s.name,orderType:"supplier",items:[{productId:`SUP-${s.products}`,name:`${s.category} wholesale order`,qty:s.moq,price:Math.round(total/s.moq)}],subtotal:total,shipping:0,total,address:"Kigali",deliveryMethod:"B2B",commission:0});
  confirmPayment(order.id,"momo");
  addNotification({role:"supplier",recipient:s.name,type:"payment",title:"Vendor order paid successfully",message:`Kigali Tech Store paid ${order.id}. The full supplier amount is protected pending supply delivery and receipt confirmation.`,reference:order.id});
  toast.success(`Paid B2B order ${order.id} created. ${s.name} has been notified.`);
 };
 return <DashboardLayout><div className="dash-page-head"><div><span className="eyebrow">B2B MARKETPLACE</span><h1>Find suppliers</h1><p>Buy wholesale products from verified suppliers and grow your store.</p></div></div>
 <div className="dash-toolbar"><div className="dash-filter"><Icon name="search"/><input value={q} onChange={search} placeholder="Search suppliers, categories or location…"/></div><span className="table-count">{filtered.length} supplier{filtered.length===1?'':'s'}</span></div>
 
 <div className="dash-grid supplier-search-grid">{rows.map(s=><div className="data-card" key={s.name}><div className="data-card-head"><div><h3>{s.name}</h3><span>{s.category} · {s.location}</span></div>{s.verified&&<em className="status active">Verified ✓</em>}</div><div className="profile-detail"><span>Rating: <b>{s.rating}/5</b></span><span>Wholesale products: <b>{s.products}</b></span><span>Minimum order: <b>{s.moq} units</b></span></div><button className="gradient-btn" onClick={()=>placeOrder(s)}>Place B2B order & pay</button></div>)}</div>
 {!rows.length&&<div className="data-card table-empty">No suppliers match your search.</div>}
 <Pagination page={safePage} setPage={setPage} total={filtered.length} perPage={perPage}/>
 <div className="verified-box"><b>✓ B2B trust</b><p>MVEC verifies suppliers and tracks orders, delivery proof and disputes. Supplier transactions carry no MVEC commission; the full supplier amount remains protected until supply delivery and receipt are confirmed.</p></div></DashboardLayout>
}

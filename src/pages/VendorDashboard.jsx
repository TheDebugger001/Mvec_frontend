import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';
import { products as seedProducts, demoOrders } from '../data';
import {getOrders} from '../services/mvecStore';
import { useAuth } from '../context/AuthContext';
import DeliveryTracking from '../components/DeliveryTracking';
import NotificationPanel from '../components/NotificationPanel';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from '../services/analytics';
import {useToast} from '../components/Toast';
import { usersApi, promotionsApi, reviewsApi, shippingApi, notificationsApi, reportsApi, payoutsApi, productsApi, categoriesApi } from '../API';
import { extractErrorMessage } from '../API/client';
import { clearCatalogCache } from '../services/catalogApi';

const hasToken=()=>!!localStorage.getItem('huska_token');

const money = n => new Intl.NumberFormat('en-RW').format(Number(n) || 0) + ' RWF';
const titleCase = s => String(s||'').toLowerCase().split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
// Convert the vendor product form into the backend Product schema payload.
const toBackendPayload = p => ({
  name:p.name, sku:p.sku, brand:p.brand||'', shortDescription:p.shortDescription||'',
  description:p.description||'', price:Number(p.price)||0,
  costPrice:p.costPrice?Number(p.costPrice):null, discountPrice:p.discountPrice?Number(p.discountPrice):null,
  stockQuantity:Math.max(0,Number(p.stock)||0), lowStockThreshold:Math.max(0,Number(p.minStock)||0),
  status:(Number(p.stock)||0)<=0?'OUT_OF_STOCK':'ACTIVE',
  media:{mainImage:(p.images&&p.images[0])||p.image||'',gallery:(p.images||[]).filter(Boolean),videos:(p.videos||[]).map(v=>typeof v==='string'?v:(v?.src||''))},
  attributes:{color:p.color||'',size:p.size||'',material:p.material||'',weight:p.weight||'',capacity:p.capacity||'',model:p.model||''},
});
// Resolve a category ObjectId by name (creating the category if it doesn't exist yet).
const resolveCategoryId = async (name) => {
  if(!name) return null;
  try{
    const res=await categoriesApi.getAll();
    const cats=(res&&(res.categories||res.data||res))||[];
    const found=cats.find(c=>String(c.name||c.title||'').toLowerCase()===String(name).toLowerCase());
    if(found) return found._id||found.id;
    const created=await categoriesApi.create({name});
    return (created&&(created.category?._id||created._id||created.category||created.id))||null;
  }catch(e){console.warn('category',extractErrorMessage(e));return null;}
};
const PRODUCT_KEY = 'mvec_vendor_products';
const CATEGORY_KEY = 'mvec_vendor_categories';
const readJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };

const defaultCategories = ['Electronics','Phones','Computers','Fashion','Home & Living','Beauty','Sports','Automotive'];
const initialProducts = seedProducts.map(p => ({
  ...p,
  shortDescription: p.description?.slice(0, 90) || '',
  discountPrice: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : '',
  costPrice: '',
  minStock: 5,
  status: p.stock ? 'Active' : 'Out of stock',
  images: [p.image],
  videos: [],
  tax: 0,
  weight: p.attributes?.Weight || '',
  dimensions: '',
  shippingInfo: 'Standard delivery',
  variants: p.attributes || {},
}));

const modules = {
  stores:[['Kigali Tech Store','Electronics','148','4.9','Active'],['Kigali Tech Outlet','Computers','64','4.7','Pending']],
  inventory:initialProducts.map(p=>[p.name,p.sku,p.stock,Math.min(5,p.stock),p.stock<=5?'Low stock':p.stock?'In stock':'Out of stock']),
  orders:[['MVEC-2026-10452','Aline Uwase','Samsung Galaxy S25','1,450,000 RWF','SUCCESS','Delivered'],['MVEC-2026-10451','Jean Paul','Classic Leather Sneakers','95,000 RWF','SUCCESS','In transit'],['MVEC-2026-10450','Diane Mukamana','Smart Watch Active','99,000 RWF','PENDING','Preparing'],['MVEC-2026-10449','Patrick Niyonzima','Office Chair Pro','185,000 RWF','SUCCESS','Confirmed'],['MVEC-2026-10448','Grace Uwimana','Professional Camera Kit','920,000 RWF','SUCCESS','Delivered']],
  customers:[['Aline Uwase','12','2,450,000 RWF','26 Aug 2026'],['Jean Paul','7','1,180,000 RWF','26 Aug 2026'],['Mugisha Eric','5','780,000 RWF','27 Aug 2026'],['Claudine Mukamana','3','425,000 RWF','27 Aug 2026'],['Patrick N.','2','214,000 RWF','27 Aug 2026'],['Diane U.','9','1,920,000 RWF','25 Aug 2026'],['Kevin M.','4','530,000 RWF','24 Aug 2026']],
  payouts:[['PAY-2401','100,000 RWF','MTN MoMo','Completed'],['PAY-2402','245,000 RWF','Bank account','Processing'],['PAY-2403','90,000 RWF','MTN MoMo','Pending'],['PAY-2404','310,000 RWF','Bank account','Completed']],
  promotions:[['Back to School','SCHOOL15','15%','Active','10 Sep 2026'],['Weekend Tech Sale','TECH10','10%','Scheduled','05 Sep 2026'],['Free Delivery','FREESHIP','Free shipping','Active','30 Sep 2026']],
  reviews:[['Wireless Headphones','Aline Uwase','★★★★★','Great sound and battery','26 Aug 2026'],['Smart Watch Active','Jean Paul','★★★★☆','Good value','25 Aug 2026'],['Professional Camera Kit','Mugisha Eric','★★★★★','Excellent camera','24 Aug 2026']],
  shipping:[['Kigali','2,000 RWF','Same day','Standard / Pickup','Active'],['Outside Kigali','5,000 RWF','1–3 days','Standard','Active'],['Free shipping','Orders over 150,000 RWF','1–3 days','Standard','Active']],
  notifications:[['New order received','ORD-1004','2 minutes ago','Unread'],['Low-stock alert','Professional Camera Kit','1 hour ago','Unread'],['Review received','Wireless Headphones','3 hours ago','Read'],['Payout completed','PAY-2401','Yesterday','Read']],
  team:[['Eric M.','Owner','All permissions','Active'],['Sarah K.','Store Manager','Products, Orders, Analytics','Active'],['David N.','Inventory Manager','Inventory, Products','Active'],['Alice R.','Sales Staff','Orders, Customers','Active']],
  reports:[['Sales report','01 Aug – 27 Aug','18,450,000 RWF','Download'],['Product performance','01 Aug – 27 Aug','327 orders','Download'],['Inventory report','27 Aug','148 products','Download']],
  settings:[['Store information','Kigali Tech Store','Active','27 Aug 2026'],['Business information','Rwanda · Kigali','Complete','27 Aug 2026'],['Payment & payouts','MTN MoMo •••• 2184','Configured','26 Aug 2026'],['Shipping','Kigali / Outside Kigali','Configured','25 Aug 2026'],['Notifications','Orders · Stock · Payouts','Enabled','27 Aug 2026'],['Security','Password + sessions','Protected','27 Aug 2026']],
};

const cfg={
 stores:{title:'My Stores',desc:'Manage your store identity, status and policies.',headers:['Store','Category','Products','Rating','Status'],icon:'shop'},
 inventory:{title:'Inventory',desc:'Monitor stock, adjustments, damaged and returned items.',headers:['Product','SKU','On hand','Reserved','Status'],icon:'grid'},
 orders:{title:'Orders',desc:'Manage orders, customers, payment and fulfillment.',headers:['Order','Customer','Product','Total','Payment','Fulfillment'],icon:'cart'},
 customers:{title:'Customers',desc:'Customer records belonging to your store only.',headers:['Customer','Orders','Total spent','Last purchase'],icon:'users'},
 payouts:{title:'Payouts',desc:'Track pending, available, processing and completed earnings.',headers:['Payout','Amount','Destination','Status'],icon:'wallet'},
 promotions:{title:'Promotions',desc:'Create percentage, fixed, coupon, flash-sale and shipping promotions.',headers:['Promotion','Code','Discount','Status','Ends'],icon:'tag'},
 reviews:{title:'Reviews',desc:'View product ratings and respond professionally; moderation stays with Admin.',headers:['Product','Customer','Rating','Review','Date'],icon:'heart'},
 shipping:{title:'Shipping',desc:'Configure zones, delivery fees, methods and pickup options.',headers:['Zone','Fee','Delivery','Method','Status'],icon:'shop'},
 notifications:{title:'Notifications',desc:'New orders, stock alerts, reviews, payouts and admin decisions.',headers:['Notification','Reference','When','State'],icon:'bell'},
 team:{title:'Team / Staff',desc:'Seller-level RBAC for your employees and store operations.',headers:['Member','Role','Permissions','Status'],icon:'users'},
 reports:{title:'Reports',desc:'Sales, product and inventory reporting with export-ready actions.',headers:['Report','Range','Summary','Action'],icon:'chart'},
 settings:{title:'Settings',desc:'Manage store, business, payout, shipping, notification and security settings.',headers:['Setting','Current value','Status','Last updated'],icon:'settings'},
};

function Metric({label,value,icon,sub}){return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div></div>}

function SellerOverview(){
  const [period,setPeriod]=useState('30 Days');
  const chart=getPeriodChart(period); const labels=getPeriodLabels(period); const metrics=getPeriodMetrics(period);
  const products=readJSON(PRODUCT_KEY,initialProducts);
  return <><div className="dash-page-head"><div><span className="eyebrow">SELLER PLATFORM</span><h1>Good morning, Seller 👋</h1><p>Everything you need to operate your MVEC store.</p></div></div><div className="metric-grid"><Metric label="Sales" value={money(metrics.sales)} icon="chart" sub={`${period} performance`}/><Metric label="Orders" value={metrics.orders} icon="cart" sub={`${period} orders`}/><Metric label="Products" value={products.length} icon="box" sub="Published catalog"/><Metric label="Earnings" value={money(Math.round(metrics.sales*0.635))} icon="wallet" sub="After fees"/><Metric label="Pending payout" value={money(Math.round(metrics.sales*0.154))} icon="wallet" sub="Awaiting settlement"/><Metric label="Low-stock items" value={products.filter(p=>Number(p.stock)<=5).length} icon="bell" sub="Needs attention"/></div><div className="dash-grid"><div className="data-card chart-card"><div className="data-card-head"><div><h3>Sales overview</h3><span>{period} performance</span></div><select value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>7 Days</option><option>30 Days</option><option>3 Months</option><option>6 Months</option><option>1 Year</option></select></div><div className="fake-chart">{chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}</div></div><div className="data-card"><div className="data-card-head"><div><h3>Inventory alerts</h3><span>Reorder soon</span></div><Link to="/vendor/inventory">View all</Link></div>{products.filter(p=>Number(p.stock)<=9).slice(0,6).map(p=><div className="activity-row" key={p.id}><div><b>{p.name}</b><small>{p.stock} units remaining</small></div><em className="status warning">Low stock</em></div>)}</div></div><div className="data-card"><div className="data-card-head"><div><h3>Recent orders</h3><span>Latest customer activity</span></div><Link to="/vendor/orders">View all</Link></div>{demoOrders.map(o=><div className="activity-row" key={o.id}><div><b>{o.id}</b><small>{o.buyer} · {o.vendor}</small></div><div><strong>{money(o.total)}</strong><em className={'status '+(o.payment==='SUCCESS'?'active':'warning')}>{o.status}</em></div></div>)}</div></>}


const emptyProduct={name:'',sku:'',category:'',brand:'',shortDescription:'',description:'',price:'',discountPrice:'',costPrice:'',stock:'',minStock:5,status:'Draft',images:[],videos:[],color:'',size:'',material:'',weight:'',capacity:'',model:'',tax:0,dimensions:'',shippingInfo:'Standard delivery'};

function ProductForm({product,onSave,onCancel}){
  const toast=useToast();
  const [form,setForm]=useState(()=>{const base=product?{...emptyProduct,...product,...(product.variants||{})}:{...emptyProduct};return {...base,images:Array.isArray(base.images)?base.images:(base.image?[base.image]:[]),videos:Array.isArray(base.videos)?base.videos:[]};});
  const [categories,setCategories]=useState(()=>{
    const stored=readJSON(CATEGORY_KEY,defaultCategories);
    const values=Array.isArray(stored)?stored.map(c=>typeof c==='string'?c:(c?.name||'')).map(c=>String(c).trim()).filter(Boolean):[];
    return [...new Set(values.length?values:defaultCategories)];
  });
  const [newCategory,setNewCategory]=useState('');
  const update=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const addCategory=()=>{const name=newCategory.trim();if(!name)return;const existing=categories.map(c=>typeof c==='string'?c:(c?.name||'')).filter(Boolean);if(!existing.some(c=>c.toLowerCase()===name.toLowerCase())){const next=[...existing,name];setCategories(next);localStorage.setItem(CATEGORY_KEY,JSON.stringify(next));}setForm(f=>({...f,category:name}));setNewCategory('');};
  const addImages=e=>{[...e.target.files||[]].forEach(file=>{const reader=new FileReader();reader.onload=()=>setForm(f=>({...f,images:[...f.images,reader.result]}));reader.readAsDataURL(file);});e.target.value='';};
  const addVideo=()=>{const url=window.prompt('Paste a product video URL');if(url?.trim())setForm(f=>({...f,videos:[...f.videos,{type:'url',src:url.trim()}]}));}; const addVideoFiles=e=>{[...e.target.files||[]].forEach(file=>{const reader=new FileReader();reader.onload=()=>setForm(f=>({...f,videos:[...f.videos,{type:'file',src:reader.result,name:file.name}]}));reader.readAsDataURL(file);});e.target.value='';};
  const removeImage=i=>setForm(f=>({...f,images:f.images.filter((_,x)=>x!==i)}));
  const submit=e=>{e.preventDefault();if(!form.name||!form.sku||!form.category||form.price===''||form.stock===''){toast.error('Please complete the required product fields.');return;}onSave({...form,id:form.id||Date.now(),price:Number(form.price),stock:Number(form.stock),minStock:Number(form.minStock||0),tax:Number(form.tax||0),image:form.images[0]||'' ,oldPrice:form.discountPrice && Number(form.discountPrice)>Number(form.price)?Number(form.discountPrice):form.oldPrice});};
  return <div className="product-editor"><div className="editor-head"><div><span className="eyebrow">PRODUCT CATALOG</span><h2>{product?'Edit product':'Add product'}</h2><p>Complete product information before publishing it to the MVEC marketplace.</p></div><button className="outline-btn" type="button" onClick={onCancel}>Cancel</button></div><form onSubmit={submit} className="product-form"><section className="editor-section"><h3>Basic information</h3><div className="two-col"><label className="field"><span>Product name *</span><input name="name" value={form.name} onChange={update} required placeholder="e.g. Samsung Galaxy S25"/></label><label className="field"><span>SKU *</span><input name="sku" value={form.sku} onChange={update} required placeholder="SAM-S25-256-BLK"/></label></div><div className="two-col"><label className="field"><span>Category *</span><select name="category" value={form.category} onChange={update} required><option value="">Select category</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label className="field"><span>Brand</span><input name="brand" value={form.brand} onChange={update} placeholder="Brand name"/></label></div><div className="inline-add-category"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="New category name"/><button type="button" className="outline-btn" onClick={addCategory}>+ Add category</button></div><label className="field"><span>Short description</span><input name="shortDescription" value={form.shortDescription} onChange={update} maxLength="180" placeholder="A short summary shown on product cards"/></label><label className="field"><span>Description *</span><textarea name="description" value={form.description} onChange={update} rows="5" required placeholder="Describe the product, benefits and important information..."/></label></section>
  <section className="editor-section"><h3>Pricing & inventory</h3><div className="three-col"><label className="field"><span>Selling price (RWF) *</span><input type="number" min="0" name="price" value={form.price} onChange={update} required/></label><label className="field"><span>Original price</span><input type="number" min="0" name="discountPrice" value={form.discountPrice} onChange={update}/></label><label className="field"><span>Cost price</span><input type="number" min="0" name="costPrice" value={form.costPrice} onChange={update}/></label></div><div className="three-col"><label className="field"><span>Stock quantity *</span><input type="number" min="0" name="stock" value={form.stock} onChange={update} required/></label><label className="field"><span>Minimum stock</span><input type="number" min="0" name="minStock" value={form.minStock} onChange={update}/></label><label className="field"><span>Status</span><select name="status" value={form.status} onChange={update}><option>Draft</option><option>Active</option><option>Archived</option><option>Out of stock</option></select></label></div></section>
  <section className="editor-section"><h3>Product attributes</h3><div className="three-col">{[['color','Color'],['size','Size'],['material','Material'],['weight','Weight'],['capacity','Capacity'],['model','Model']].map(([name,label])=><label className="field" key={name}><span>{label}</span><input name={name} value={form[name]||''} onChange={update} placeholder={label}/></label>)}</div><div className="two-col"><label className="field"><span>Tax (%)</span><input type="number" min="0" name="tax" value={form.tax} onChange={update}/></label><label className="field"><span>Dimensions</span><input name="dimensions" value={form.dimensions} onChange={update} placeholder="L × W × H"/></label></div><label className="field"><span>Shipping information</span><textarea name="shippingInfo" value={form.shippingInfo} onChange={update} rows="3" placeholder="Processing time, shipping restrictions, pickup details..."/></label></section>
  <section className="editor-section"><h3>Media</h3><p className="editor-help">Upload multiple product images before publishing. The first image becomes the main product image.</p><label className="upload-zone"><Icon name="box"/><b>Upload product images</b><small>PNG, JPG or WEBP · multiple files supported</small><input type="file" accept="image/*" multiple onChange={addImages}/></label>{form.images.length>0&&<div className="media-grid">{form.images.map((src,i)=><div className="media-thumb" key={i}><img src={src} alt={`Product ${i+1}`}/><button type="button" onClick={()=>removeImage(i)}>×</button>{i===0&&<span>Main image</span>}</div>)}</div>}<div className="video-row"><label className="outline-btn media-file-btn">+ Upload videos<input type="file" accept="video/*" multiple onChange={addVideoFiles}/></label><button type="button" className="outline-btn" onClick={addVideo}>+ Add video URL</button>{form.videos.map((v,i)=><div className="video-chip" key={i}>{v?.name||v?.src||v}<button type="button" onClick={()=>setForm(f=>({...f,videos:f.videos.filter((_,x)=>x!==i)}))}>×</button></div>)}</div></section><div className="editor-actions"><button type="button" className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" type="submit">{product?'Save changes':'Create product'}</button></div></form></div>
}

function ProductModule(){
  const {user}=useAuth();
  const toast=useToast();
  const owner=user?.companyName||user?.fullName||'Kigali Tech Store';
  const normalize=p=>({...p,images:Array.isArray(p.images)?p.images:(p.image?[p.image]:[]),videos:Array.isArray(p.videos)?p.videos:[],status:p.status||'Active'});
  const location=useLocation();
  const navigate=useNavigate();
  const [rows,setRows]=useState(()=>readJSON(PRODUCT_KEY,initialProducts).map(normalize).filter(p=>!p.vendor||p.vendor===owner));
  const [editing,setEditing]=useState(null);
  const [page,setPage]=useState(1);
  const [q,setQ]=useState('');
  const [statusFilter,setStatusFilter]=useState('');
  const per=6;

  // Open the same editor for both entry points: the overview button and the Products page button.
  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    if(params.get('add')==='1') {
      setEditing({mode:'create'});
      navigate('/vendor/products',{replace:true});
    }
  },[location.search,navigate]);

  useEffect(()=>{
    if(!editing) return;
    const onKeyDown=e=>{if(e.key==='Escape') setEditing(null);};
    document.addEventListener('keydown',onKeyDown);
    return()=>document.removeEventListener('keydown',onKeyDown);
  },[editing]);

  const persist=next=>{setRows(next);localStorage.setItem(PRODUCT_KEY,JSON.stringify(next));};
  const filtered=useMemo(()=>rows.filter(p=>JSON.stringify(p).toLowerCase().includes(q.toLowerCase())&&(!statusFilter||p.status===statusFilter)),[rows,q,statusFilter]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/per));
  const current=Math.min(page,totalPages);
  const shown=filtered.slice((current-1)*per,current*per);
  const closeEditor=()=>{
    setEditing(null);
    if(new URLSearchParams(location.search).get('add')==='1') navigate('/vendor/products',{replace:true});
  };
  const saveProduct=async p=>{
    const mode=editing?.mode==='create';
    const owned=normalize({...p,vendor:owner});
    let next=mode?[owned,...rows]:rows.map(x=>x.id===p.id?owned:x);
    if(hasToken()){
      try{
        const catId=await resolveCategoryId(p.category);
        const payload={...toBackendPayload(owned),category:catId};
        let backendId;
        if(mode){
          const res=await productsApi.create(payload);
          const saved=res&&(res.product||res);
          backendId=(saved&&(saved._id||saved.publicId||saved.id))||null;
        }else if(p.backendId){
          backendId=p.backendId;
          await productsApi.update(p.backendId,payload);
        }
        if(backendId) next=next.map(x=>x===owned?{...x,id:backendId,backendId}:x);
        clearCatalogCache();
      }catch(e){
        toast.error(extractErrorMessage(e)||'Could not publish product to the marketplace.');
      }
    }
    persist(next);
    setEditing(null);
    setPage(1);
    toast.success(mode?'Product created.':'Product saved.');
    navigate('/vendor/products',{replace:true});
  };
  const exportCsv=()=>{
    const cols=['name','sku','category','brand','price','stock','status'];
    const csv=[cols.join(','),...filtered.map(p=>cols.map(k=>`"${String(p[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;
    a.download=`mvec-products-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className="dash-page-head">
      <div><span className="eyebrow">SELLER PLATFORM</span><h1>Products</h1><p>Manage product details, pricing, stock, media and publishing status.</p></div>
      <button type="button" className="gradient-btn" onClick={()=>setEditing({mode:'create'})}><Icon name="plus"/> Add product</button>
    </div>
    <div className="dash-toolbar">
      <div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search products, SKU, brand or category…"/></div>
      <select className="table-filter-select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="">All statuses</option>{[...new Set(rows.map(p=>p.status).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select>
      <button type="button" className="filter-btn" onClick={exportCsv}>Export CSV</button>
    </div>
    <div className="data-card">
      <div className="data-card-head"><div><h3>Product catalog</h3><span>{filtered.length} products</span></div><span className="muted">Create · Edit · Archive · Restore · Delete</span></div>
      <div className="product-admin-list">
        {shown.map(p=><div className="product-admin-row" key={p.id}>
          <div className="admin-product-main">{p.image?<img src={p.image} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}<div><b>{p.name}</b><small>{p.sku} · {p.brand||'No brand'} · {p.category}</small></div></div>
          <div><b>{money(p.price)}</b><small>Stock: {p.stock}</small></div>
          <em className={'status '+(p.status==='Active'?'active':'warning')}>{p.status}</em>
          <div className="row-actions"><button type="button" title="Edit product" onClick={()=>setEditing({mode:'edit',product:normalize(p)})}><Icon name="edit"/></button><button type="button" title={p.status==='Archived'?'Restore product':'Archive product'} onClick={()=>{persist(rows.map(x=>x.id===p.id?{...x,status:x.status==='Archived'?'Active':'Archived'}:x));toast.info(p.status==='Archived'?'Product restored.':'Product archived.')}}><Icon name={p.status==='Archived'?'check':'box'}/></button><button type="button" title="Delete product" onClick={()=>{if(window.confirm(`Delete ${p.name}?`))persist(rows.filter(x=>x.id!==p.id))}}><Icon name="trash"/></button></div>
        </div>)}
      </div>
      <Pagination page={current} setPage={setPage} total={filtered.length} perPage={per}/>
    </div>
    {editing&&typeof document!=='undefined'&&createPortal(
      <div className="product-editor-backdrop" role="dialog" aria-modal="true" aria-label={editing.mode==='create'?'Add product':'Edit product'} onMouseDown={e=>{if(e.target===e.currentTarget) closeEditor();}}>
        <div className="product-editor-modal" onMouseDown={e=>e.stopPropagation()}>
          <ProductForm product={editing.mode==='edit'?editing.product:null} onCancel={closeEditor} onSave={saveProduct}/>
        </div>
      </div>,
      document.body
    )}
  </>;
}
// New ModulePage implementation (backend-sync layer + original JSX preserved)
function ModulePage({type}){
  const c=cfg[type],initial=modules[type]||[];const storageKey=`mvec_vendor_${type}`;const toast=useToast();
  const [rows,setRows]=useState(()=>readJSON(storageKey,initial));const [page,setPage]=useState(1);const [q,setQ]=useState('');const [statusFilter,setStatusFilter]=useState('');const [editing,setEditing]=useState(null);

  // ── Backend sync: normalize DB objects into the array rows the table expects ──
  const normalizeRow=(r)=>{
    if(type==='customers')return [r.name||r.fullName||'',String(r.orders||0),money(r.totalSpent||0),r.lastPurchase?new Date(r.lastPurchase).toLocaleDateString('en-GB'):''];
    if(type==='promotions')return [r.name||'',r.code||'',r.discount??(r.type==='PERCENT'?r.value+'%':(r.value||0)+' RWF'),titleCase(r.status||'DRAFT'),r.endsAt?new Date(r.endsAt).toLocaleDateString('en-GB'):'—'];
    if(type==='reviews')return [r.product||'',r.reviewer||'',(Number(r.rating||0)>0)?'★'.repeat(Math.round(r.rating)):'',r.review||r.comment||'',r.date?new Date(r.date).toLocaleDateString('en-GB'):''];
    if(type==='shipping')return [r.name||r.zone||'',money(r.fee||0),r.eta||r.delivery||'—',r.method||(Array.isArray(r.methods)?r.methods.join(' / '):'')||'—',titleCase(r.status||'ACTIVE')];
    if(type==='notifications')return [r.title||'',r.reference||'',r.createdAt?new Date(r.createdAt).toLocaleString('en-GB'):'',r.status||(r.isRead?'Read':'Unread')];
    if(type==='payouts')return [r.ref||r.id||'',money(r.amount??r.supplierSettlement??0),r.destination||r.method||'—',titleCase(r.status||'')];
    if(type==='reports')return [r.report||r.name||'',r.range||'',r.summary||'','Download'];
    return Array.isArray(r)?r:[];
  };
  const fetchRows=async()=>{
    if(type==='customers'){const r=await usersApi.getVendorCustomers();return (r.data||[]).map(normalizeRow);}
    if(type==='promotions'){const r=await promotionsApi.getAll();return (r.data||[]).map(normalizeRow);}
    if(type==='reviews'){const r=await reviewsApi.getVendorReviews();return (r.data||[]).map(normalizeRow);}
    if(type==='shipping'){const r=await shippingApi.getMine();return (r.data||[]).map(normalizeRow);}
    if(type==='notifications'){const r=await notificationsApi.getMine();return (r.data||[]).map(normalizeRow);}
    if(type==='payouts'){const r=await payoutsApi.getHistory();return (r.data||r.payouts||[]).map(normalizeRow);}
    return null;
  };
  useEffect(()=>{
    let mounted=true;
    (async()=>{
      if(!hasToken())return;
      try{
        const next=await fetchRows();
        if(next&&mounted&&next.length){setRows(next);localStorage.setItem(storageKey,JSON.stringify(next));}
      }catch(e){/* fall back to local mock */if(mounted)console.warn(type,extractErrorMessage(e));}
    })();
    return ()=>{mounted=false;};
  },[type]);

  const filtered=useMemo(()=>rows.filter(r=>(Array.isArray(r)?r.join(' '):JSON.stringify(r)).toLowerCase().includes(q.toLowerCase())&&(!statusFilter||String(r[r.length-1])===statusFilter)),[rows,q,statusFilter]);
  const per=6;const totalPages=Math.max(1,Math.ceil(filtered.length/per));const current=Math.min(page,totalPages);const shown=filtered.slice((current-1)*per,current*per);
  const editable=['stores','promotions','team','shipping'].includes(type);
  const add=()=>{
    if(type==='team')setEditing({row:['New staff member','Sales Staff','Orders, Customers','Active'],new:true});
    else if(type==='stores')setEditing({row:['New Store','Electronics','0','New','Pending'],new:true});
    else if(type==='promotions')setEditing({row:['New promotion','CODE','10%','Draft','30 Sep 2026'],new:true});
    else if(type==='shipping')setEditing({row:['New zone','0 RWF','1–3 days','Standard','Active'],new:true});
  };
  const persist=(next)=>{setRows(next);localStorage.setItem(storageKey,JSON.stringify(next));};
  // Best-effort backend create for new promotions/zones (id not available for array rows).
  const syncCreate=async(nextRow)=>{
    if(!hasToken())return;
    try{
      if(type==='promotions')await promotionsApi.create({name:nextRow[0],code:nextRow[1],type:'PERCENT',status:nextRow[3]||'DRAFT'});
      else if(type==='shipping')await shippingApi.create({name:nextRow[0],fee:parseFloat(String(nextRow[1]).replace(/[^0-9.]/g,''))||0,eta:nextRow[2],methods:['STANDARD']});
    }catch(e){console.warn(type,extractErrorMessage(e));}
  };
  const saveEdit=async(nextRow,isNew,at)=>{const idx=Number.isInteger(at)?at:rows.findIndex(x=>x===at);const next=isNew?[nextRow,...rows]:idx>=0?rows.map((x,i)=>i===idx?nextRow:x):[nextRow,...rows.filter(x=>x!==at)];persist(next);(isNew&&['promotions','shipping'].includes(type))&&syncCreate(nextRow);setEditing(null);setPage(1);toast.success(c.title+' saved.')};
  const exportCsv=()=>{const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;const csv=[c.headers.map(esc).join(','),...filtered.map(r=>r.map(esc).join(','))].join('\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`mvec-${type}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)};const statuses=[...new Set(rows.map(r=>String(r[r.length-1]??'')).filter(Boolean))];
  return <><div className="dash-page-head"><div><span className="eyebrow">SELLER PLATFORM</span><h1>{c.title}</h1><p>{c.desc}</p></div>{editable&&<button className="gradient-btn" onClick={add}><Icon name="plus"/> Add {type==='team'?'staff member':type==='stores'?'store':type.slice(0,-1)}</button>}</div><div className="dash-toolbar"><div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder={`Search ${c.title.toLowerCase()}…`}/></div>{statuses.length>1&&<select className="table-filter-select" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}}><option value="">All statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select>}<button className="filter-btn" onClick={exportCsv}>Export CSV</button></div><div className="data-card"><div className="data-card-head"><div><h3>{c.title}</h3><span>{filtered.length} records</span></div><span className="muted">Marketplace records</span></div><div className="data-table"><div className={'data-row module-row '+(c.headers.length===4?'four':'')}>{c.headers.map(h=><span className="table-label" key={h}>{h}</span>)}{editable&&<span className="table-label">Actions</span>}</div>{shown.map((r,i)=><div className={'data-row module-row '+(c.headers.length===4?'four':'')} key={`${r[0]}-${i}`}>{r.map((v,j)=><span key={j}>{j===0?<b>{v}</b>:j===c.headers.length-1&&['Active','Completed','Processing','Pending','Scheduled','Unread','Read','Low stock','In stock','Out of stock'].includes(v)?<em className={'status '+(['Active','Completed','Read','In stock'].includes(v)?'active':'warning')}>{v}</em>:v}</span>)}{editable&&<span className="row-actions"><button title={`Edit ${c.title.toLowerCase()}`} onClick={()=>setEditing({row:[...r],index:rows.indexOf(r),new:false})}><Icon name="edit"/></button><button title="Delete record" onClick={()=>{const next=rows.filter(x=>x!==r);persist(next);toast.info('Record deleted.')}}><Icon name="trash"/></button></span>}</div>)}</div><Pagination page={current} setPage={setPage} total={filtered.length} perPage={per}/></div>{editing&&<EditRows type={type} headers={c.headers} rows={rows} value={editing.row} isNew={editing.new} onCancel={()=>setEditing(null)} onSave={row=>saveEdit(row,editing.new,editing.index)}/>}</>}

const EDIT_ENUMS={
 'Status':['Active','Pending','Draft','Scheduled','Completed','Archived','Inactive','Out of stock'],
 'State':['Active','Pending','Draft','Scheduled','Completed','Archived','Inactive'],
 'Payment':['SUCCESS','PENDING','FAILED','REFUNDED'],
 'Fulfillment':['Delivered','In transit','Preparing','Confirmed','Processing','Shipped','Completed','Cancelled'],
 'Method':['Standard','Express','Pickup','Standard / Pickup'],
 'Delivery':['Same day','1–3 days','2–4 days','3–6 days','5–7 days','Next day'],
 'Role':['Owner','Store Manager','Inventory Manager','Sales Staff','Accountant'],
 'Permissions':['All permissions','Products, Orders, Analytics','Inventory, Products','Orders, Customers'],
 'Destination':['MTN MoMo','Airtel Money','Bank account'],
};
function EditRows({type,headers,rows,value,isNew,onCancel,onSave}){const [row,setRow]=useState(value);return <div className="modal-backdrop" onMouseDown={onCancel}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onCancel}>×</button><h2>{isNew?'Add':'Edit'} {cfg[type].title.slice(0,-1)}</h2><p>Update the fields below and save your changes.</p>{headers.map((h,i)=>{const known=EDIT_ENUMS[h];let options=known;if(options&&row[i]!=null&&!options.includes(String(row[i])))options=[...options,String(row[i])];return options?<label className="field" key={h}><span>{h}</span><select value={row[i]??''} onChange={e=>setRow(r=>r.map((x,j)=>j===i?e.target.value:x))}>{[<option key="_" value="">Select…</option>,...options.map(o=><option key={o} value={o}>{o}</option>)]}</select></label>:<label className="field" key={h}><span>{h}</span><input value={row[i]??''} onChange={e=>setRow(r=>r.map((x,j)=>j===i?e.target.value:x))}/></label>})}<div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" onClick={()=>onSave(row)}>Save changes</button></div></div></div>}

function Analytics(){const [period,setPeriod]=useState('30 Days');const chart=getPeriodChart(period);const labels=getPeriodLabels(period);return <><div className="dash-page-head"><div><span className="eyebrow">SELLER PLATFORM</span><h1>Analytics</h1><p>Measure sales, orders, customers, conversion, refunds and profit.</p></div><select className="period-select" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>7 Days</option><option>30 Days</option><option>3 Months</option><option>6 Months</option><option>1 Year</option></select></div><div className="metric-grid"><Metric label="Total sales" value={money(getPeriodMetrics(period).sales)} icon="chart" sub={`${period} revenue`}/><Metric label="Avg. order value" value={money(getPeriodMetrics(period).avgOrder)} icon="cart" sub={`${period} average`}/><Metric label="Customers" value={getPeriodMetrics(period).customers} icon="users" sub={`${period} active customers`}/><Metric label="Conversion" value={`${Math.min(9.9,Math.max(1.2,4.1+getPeriodMetrics(period).orders/900)).toFixed(2)}%`} icon="chart" sub="Estimated conversion"/></div><div className="data-card large-chart"><div className="data-card-head"><h3>Sales performance</h3><span>Orders and revenue</span></div><div className="fake-chart">{chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}</div></div><div className="dash-grid"><div className="data-card"><h3>Top products</h3>{readJSON(PRODUCT_KEY,initialProducts).slice(0,5).map((p,i)=><div className="activity-row" key={p.id}><div><b>{i+1}. {p.name}</b><small>{120-i*17} units sold</small></div><strong>{money(p.price*(120-i*17))}</strong></div>)}</div><div className="data-card"><h3>Business health</h3><div className="progress-row"><span>Profit margin</span><div><i style={{width:'72%'}}/></div><b>72%</b></div><div className="progress-row"><span>Fulfillment</span><div><i style={{width:'91%'}}/></div><b>91%</b></div><div className="progress-row"><span>Conversion</span><div><i style={{width:'48%'}}/></div><b>4.8%</b></div></div></div></>}

export default function VendorDashboard(){const path=useLocation().pathname;if(path.includes('/delivery'))return <DashboardLayout><DeliveryTracking role="vendor"/></DashboardLayout>;if(path.includes('/notifications'))return <DashboardLayout><NotificationPanel role="vendor" recipient="Kigali Tech Store"/></DashboardLayout>;if(path==='/vendor')return <DashboardLayout><SellerOverview/></DashboardLayout>;if(path.includes('/products'))return <DashboardLayout><ProductModule/></DashboardLayout>;if(path.includes('/analytics'))return <DashboardLayout><Analytics/></DashboardLayout>;if(path.includes('/transactions'))return <DashboardLayout><ModulePage type="payouts"/></DashboardLayout>;const type=Object.keys(cfg).find(k=>path.includes('/'+k))||'products';return <DashboardLayout><ModulePage type={type}/></DashboardLayout>}

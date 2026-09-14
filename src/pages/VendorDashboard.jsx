import {useState,useEffect,useCallback,useMemo} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import SmartTable from '../components/SmartTable';
import Pagination from '../components/Pagination';
import {products as seedProducts,demoOrders} from '../data';
import {getOrders} from '../services/mvecStore';
import {useAuth} from '../context/AuthContext';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from '../services/analytics';
import {useToast} from '../components/Toast';
import {productsApi,categoriesApi} from '../API';
import {extractErrorMessage} from '../API/client';
import {clearCatalogCache} from '../services/catalogApi';

const hasToken=()=>!!localStorage.getItem('huska_token');
const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const PRODUCT_KEY='mvec_vendor_products';

const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const toBackendPayload=p=>({name:p.name,sku:p.sku,brand:p.brand||'',description:p.description||'',price:Number(p.price)||0,stockQuantity:Math.max(0,Number(p.stock)||0),status:(Number(p.stock)||0)<=0?'OUT_OF_STOCK':'ACTIVE',color:p.color||'',size:p.size||'',attributes:{Color:p.color||'',Size:p.size||'',Material:p.material||'',Brand:p.brand||''},media:{mainImage:p.images?.[0]||p.image||'',gallery:Array.isArray(p.images)?p.images:[],videos:Array.isArray(p.videos)?p.videos:[]}});

const fileToDataURLs=(files,onDone)=>{
  const arr=Array.from(files||[]);
  if(!arr.length){onDone([]);return;}
  const out=[];let done=0;
  arr.forEach(f=>{const r=new FileReader();r.onload=()=>{out.push(r.result);if(++done===arr.length)onDone(out);};r.readAsDataURL(f);});
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const initialProducts=seedProducts.map(p=>({...p,shortDescription:p.description?.slice(0,90)||'',status:p.stock?'Active':'Out of stock',images:[p.image],vendor:'Kigali Tech Store'}));
const seedWallet={pending:2850000,available:1420000,history:[
  {id:'TXN-001',type:'Escrow Release',reference:'MVEC-10452',amount:765000,status:'Released',date:'2026-08-27'},
  {id:'TXN-002',type:'Platform Fee',reference:'MVEC-10452',amount:-85000,status:'Deducted',date:'2026-08-27'},
  {id:'TXN-003',type:'Escrow Release',reference:'MVEC-10451',amount:171000,status:'Released',date:'2026-08-28'},
  {id:'TXN-004',type:'Withdrawal',reference:'WTH-001',amount:-200000,status:'Completed',date:'2026-08-28'},
]};
const seedSuppliers=[
  {id:'SUP-001',name:'Rwanda Wholesale Electronics',category:'Electronics',rating:4.7,moq:10,catalog:126},
  {id:'SUP-002',name:'Bulk Fashion Hub',category:'Fashion',rating:4.5,moq:5,catalog:84},
  {id:'SUP-003',name:'HomeGoods Supply Co',category:'Home & Living',rating:4.6,moq:8,catalog:63},
];
const seedOrders=[
  {id:'MVEC-10452',customer:'Aline Uwase',product:'Samsung Galaxy S25',total:850000,payment:'SUCCESS',status:'Delivered'},
  {id:'MVEC-10451',customer:'Jean Paul',product:'Classic Leather Sneakers',total:95000,payment:'SUCCESS',status:'In Transit'},
  {id:'MVEC-10450',customer:'Diane Mukamana',product:'Smart Watch Active',total:99000,payment:'PENDING',status:'Preparing'},
  {id:'MVEC-10449',customer:'Patrick Niyonzima',product:'Office Chair Pro',total:185000,payment:'SUCCESS',status:'Confirmed'},
];
const seedReviews=[
  {id:'REV-001',product:'Wireless Headphones',customer:'Aline Uwase',rating:5,text:'Great sound and battery',date:'2026-08-26'},
  {id:'REV-002',product:'Smart Watch Active',customer:'Jean Paul',rating:4,text:'Good value for money',date:'2026-08-25'},
];
const seedAbuse=[
  {id:'ABUSE-001',reporter:'Customer A',reason:'Wrong item received',status:'Open',date:'2026-08-24'},
];
const seedWarnings=[
  {id:'WARN-001',message:'Product listing policy update - Please review description requirements',date:'2026-08-20',acknowledged:false},
];

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const cls=['Active','Published','Approved','Completed','Available','Success','Released','Delivered'].includes(status)?'active':
             ['Suspended','Blocked','Rejected','Cancelled','Failed','Out of stock','Archived'].includes(status)?'danger':
             ['Pending','Processing','Draft','Under Review','Open','In Transit','Preparing','Confirmed'].includes(status)?'warning':'';
  return <em className={'status '+cls}>{status}</em>;
}

function DataTable({columns,rows,rowKey,actions,emptyText='No records found'}){
  const [sortKey,setSortKey]=useState(null);
  const [sortDir,setSortDir]=useState('asc');
  const [q,setQ]=useState('');
  const [page,setPage]=useState(1);
  const per=8;
  
  const filtered=useMemo(()=>{
    let result=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
    if(sortKey){
      result=[...result].sort((a,b)=>{
        const va=a[sortKey],vb=b[sortKey];
        const cmp=typeof va==='number'?va-vb:String(va||'').localeCompare(String(vb||''));
        return sortDir==='asc'?cmp:-cmp;
      });
    }
    return result;
  },[rows,q,sortKey,sortDir]);
  
  const totalPages=Math.max(1,Math.ceil(filtered.length/per));
  const current=Math.min(page,totalPages);
  const shown=filtered.slice((current-1)*per,current*per);
  
  return (
    <div className="data-card">
      <div className="data-card-head">
        <div className="dash-toolbar" style={{width:'100%'}}>
          <div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search…"/></div>
          <span className="table-count">{filtered.length} records</span>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row table-header">
          {columns.map(col=>(
            <span key={col.key} className="table-label sortable" onClick={()=>{if(sortKey===col.key)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortKey(col.key);setSortDir('asc');}}}>
              {col.label}{sortKey===col.key&&(sortDir==='asc'?' ↑':' ↓')}
            </span>
          ))}
          {actions&&<span className="table-label">Actions</span>}
        </div>
        {shown.length===0?(
          <div className="data-row table-empty">{emptyText}</div>
        ):shown.map((r,i)=>(
          <div className="data-row" key={rowKey?rowKey(r,i):i}>
            {columns.map(col=>(<span key={col.key}>{col.render?col.render(r):r[col.key]}</span>))}
            {actions&&<span className="row-actions">{actions(r)}</span>}
          </div>
        ))}
      </div>
      {totalPages>1&&(
        <div className="pagination">
          <button disabled={current<=1} onClick={()=>setPage(p=>p-1)}>←</button>
          <span>Page {current} of {totalPages}</span>
          <button disabled={current>=totalPages} onClick={()=>setPage(p=>p+1)}>→</button>
        </div>
      )}
    </div>
  );
}

// ─── VENDOR OVERVIEW ──────────────────────────────────────────────────────────

function VendorOverview(){
  const [tab,setTab]=useState('orders');
  const [period,setPeriod]=useState('30 Days');
  const chart=getPeriodChart(period);
  const labels=getPeriodLabels(period);
  const metrics=getPeriodMetrics(period);
  const products=readJSON(PRODUCT_KEY,initialProducts);
  const [orders]=useState(seedOrders);
  
  const orderColumns=[
    {key:'id',label:'Order'},{key:'customer',label:'Customer'},{key:'product',label:'Product'},
    {key:'total',label:'Total',render:r=>money(r.total)},{key:'payment',label:'Payment',render:r=><StatusBadge status={r.payment}/>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const deliveryColumns=[
    {key:'id',label:'Order'},{key:'customer',label:'Customer'},{key:'product',label:'Product'},
    {key:'status',label:'Delivery Status',render:r=><StatusBadge status={r.status}/>},
    {key:'payment',label:'OTP',render:r=>r.status==='Delivered'?<StatusBadge status="Completed"/>:<button className="table-action-btn" onClick={()=>{}}>Verify</button>},
  ];
  const stockColumns=[
    {key:'name',label:'Product'},{key:'stock',label:'Stock',render:r=><span className={r.stock<=5?'warning-text':''}>{r.stock} units</span>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.stock<=5?'Low Stock':r.stock?'In Stock':'Out of Stock'}/>},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'delivery':return {columns:deliveryColumns,rows:orders};
      case 'stock':return {columns:stockColumns,rows:products};
      default:return {columns:orderColumns,rows:orders};
    }
  };
  const {columns,rows}=getTabData();

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Store Overview</h1>
          <p>Monitor sales, orders, delivery and inventory from one place.</p>
        </div>
        <select className="period-select" value={period} onChange={e=>setPeriod(e.target.value)}>
          <option>Today</option><option>7 Days</option><option>30 Days</option><option>3 Months</option><option>1 Year</option>
        </select>
      </div>

      <div className="metric-grid">
        <Metric label="Daily Sales" value={money(metrics.sales)} icon="chart" sub={`${period} performance`}/>
        <Metric label="Active Orders" value={metrics.orders} icon="cart" sub={`${period} orders`}/>
        <Metric label="Low Stock" value={products.filter(p=>Number(p.stock)<=5).length} icon="bell" sub="Needs attention"/>
        <Metric label="Store Rating" value="4.8 ★" icon="heart" sub="Customer reviews"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head"><div><h3>Sales Trend</h3><span>{period}</span></div></div>
          <div className="fake-chart">
            {chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Inventory Alerts</h3><span>Low stock items</span></div></div>
          {products.filter(p=>Number(p.stock)<=9).slice(0,4).map(p=>(
            <div className="activity-row" key={p.id}><div><b>{p.name}</b><small>{p.stock} units remaining</small></div><em className="status warning">Low</em></div>
          ))}
        </div>
      </div>

      <TabGroup tabs={[{key:'orders',label:'Active Orders',count:orders.length},{key:'delivery',label:'Delivery Status'},{key:'stock',label:'Low Stock Alerts',count:products.filter(p=>p.stock<=5).length}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.name}/>
    </>
  );
}

// ─── VENDOR WALLET ────────────────────────────────────────────────────────────

function VendorWallet(){
  const toast=useToast();
  const [wallet]=useState(seedWallet);
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState(wallet.available);
  const [method,setMethod]=useState('MTN MoMo');
  const [account,setAccount]=useState('+250 788 100 002');
  const [txns,setTxns]=useState(wallet.history);

  const submitWithdrawal=()=>{
    if(amount<10000){toast.error('Minimum withdrawal is RWF 10,000.');return;}
    if(amount>wallet.available){toast.error('Insufficient balance.');return;}
    setTxns(prev=>[{id:`WTH-${Date.now()}`,type:'Withdrawal',reference:`WTH-${Date.now()}`,amount:-amount,status:'Processing',date:new Date().toISOString().slice(0,10)},...prev]);
    toast.success(`Withdrawal of ${money(amount)} requested.`);
    setWithdrawModal(false);
  };

  const txnColumns=[
    {key:'id',label:'Reference'},{key:'type',label:'Type'},{key:'amount',label:'Amount',render:r=><span className={r.amount<0?'danger-text':''}>{money(Math.abs(r.amount))}</span>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Wallet</h1>
          <p>Escrow held during order transit vs. cleared for withdrawal.</p>
        </div>
        <button className="gradient-btn" onClick={()=>setWithdrawModal(true)}>Request Withdrawal</button>
      </div>

      <div className="metric-grid">
        <Metric label="Pending Balance" value={money(wallet.pending)} icon="wallet" sub="Held in escrow"/>
        <Metric label="Available Balance" value={money(wallet.available)} icon="wallet" sub="Cleared for withdrawal"/>
      </div>

      <DataTable columns={txnColumns} rows={txns} rowKey={r=>r.id} emptyText="No transactions yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(wallet.available)}</b>. Minimum withdrawal is RWF 10,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="10000" step="1000" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Bank account</option></select></label>
        <label className="field"><span>Account / phone</span><input value={account} onChange={e=>setAccount(e.target.value)}/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={wallet.available<10000}>Submit Request</button>
        </div>
      </Modal>
    </>
  );
}

// ─── VENDOR SUPPLIERS ─────────────────────────────────────────────────────────

function VendorSuppliers(){
  const toast=useToast();
  const [suppliers]=useState(seedSuppliers);
  const [orderModal,setOrderModal]=useState(null);
  const [quantity,setQuantity]=useState(10);

  const placeOrder=(supplier)=>{
    toast.success(`Wholesale order placed with ${supplier.name} (Qty: ${quantity}).`);
    setOrderModal(null);
  };

  const columns=[
    {key:'name',label:'Supplier',render:r=><div><b>{r.name}</b><small>{r.category}</small></div>},
    {key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'moq',label:'MOQ',render:r=>`${r.moq} units`},
    {key:'catalog',label:'Products',render:r=>`${r.catalog} items`},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Suppliers</h1>
          <p>Directory of verified wholesale platform suppliers.</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey={r=>r.id}
        actions={r=><button className="gradient-btn" onClick={()=>setOrderModal(r)}>Place Order</button>}
      />

      <Modal open={!!orderModal} onClose={()=>setOrderModal(null)} title="WHOLESALE ORDER" subtitle={`Order from ${orderModal?.name}`}>
        <div className="vendor-detail-grid">
          <div><span>Supplier</span><b>{orderModal?.name}</b></div>
          <div><span>Category</span><b>{orderModal?.category}</b></div>
          <div><span>MOQ</span><b>{orderModal?.moq} units</b></div>
        </div>
        <p>This initiates a B2B escrow-protected payment to the supplier.</p>
        <label className="field"><span>Quantity</span><input type="number" min={orderModal?.moq||1} value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setOrderModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={()=>placeOrder(orderModal)}>Confirm Order</button>
        </div>
      </Modal>
    </>
  );
}

// ─── VENDOR PRODUCTS ──────────────────────────────────────────────────────────

function VendorProducts(){
  const {user}=useAuth();
  const toast=useToast();
  const owner=user?.companyName||user?.fullName||'Kigali Tech Store';
  const normalize=p=>({...p,images:Array.isArray(p.images)?p.images:(p.image?[p.image]:[]),videos:Array.isArray(p.videos)?p.videos:(Array.isArray(p.media?.videos)?p.media.videos:[]),color:p.color||'',size:p.size||'',brand:p.brand||'',status:p.status||'Active'});
  const [rows,setRows]=useState(()=>readJSON(PRODUCT_KEY,initialProducts).map(normalize).filter(p=>!p.vendor||p.vendor===owner));
  const [editModal,setEditModal]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [form,setForm]=useState({name:'',sku:'',category:'',price:'',stock:'',description:'',status:'Draft',color:'',size:'',brand:'',images:[],videos:[]});
  const [categories]=useState(['Electronics','Phones','Computers','Fashion','Home & Living','Beauty','Sports','Automotive']);

  const persist=next=>{setRows(next);localStorage.setItem(PRODUCT_KEY,JSON.stringify(next))};

  const saveProduct=async()=>{
    if(!form.name||!form.sku||!form.category||form.price===''){toast.error('Please complete required fields.');return;}
    const product={...form,id:form.id||Date.now(),price:Number(form.price),stock:Number(form.stock),image:form.images?.[0]||'',gallery:Array.isArray(form.images)?form.images:[],vendor:owner};
    
    if(hasToken()){
      try{
        const payload=toBackendPayload(product);
        if(editModal?.isNew){await productsApi.create(payload);}
        else if(form.backendId){await productsApi.update(form.backendId,payload);}
        clearCatalogCache();
      }catch(e){toast.error(extractErrorMessage(e));}
    }
    
    const isNew=editModal?.isNew;
    persist(isNew?[product,...rows]:rows.map(x=>x.id===form.id?{...x,...product}:x));
    toast.success(isNew?'Product created.':'Product saved.');
    setEditModal(null);
  };

  const deleteProduct=(p)=>{
    persist(rows.filter(x=>x.id!==p.id));
    toast.success(`${p.name} deleted.`);
    setDeleteConfirm(null);
  };

  const toggleArchive=(p)=>{
    persist(rows.map(x=>x.id===p.id?{...x,status:x.status==='Archived'?'Active':'Archived'}:x));
    toast.info(p.status==='Archived'?'Product restored.':'Product archived.');
  };

  const openCreate=()=>{setForm({name:'',sku:'',category:'',price:'',stock:'',description:'',status:'Draft',color:'',size:'',brand:'',images:[],videos:[]});setEditModal({isNew:true});};
  const openEdit=(p)=>{setForm({...normalize(p),price:String(p.price),stock:String(p.stock)});setEditModal({isNew:false});};

  const columns=[
    {key:'name',label:'Product',render:r=>(
      <div className="admin-product-main">
        {r.images?.[0]?<img src={r.images[0]} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}
        <div><b>{r.name}</b><small>{r.sku} · {r.category}</small></div>
      </div>
    )},
    {key:'price',label:'Price',render:r=>money(r.price)},
    {key:'stock',label:'Stock',render:r=>r.stock},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Products</h1>
          <p>Full CRUD management of inventory listings.</p>
        </div>
        <button className="gradient-btn" onClick={openCreate}><Icon name="plus"/> Add Product</button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r=>r.id}
        actions={r=>(
          <>
            <button title="Edit" onClick={()=>openEdit(r)}><Icon name="edit"/></button>
            <button title={r.status==='Archived'?'Restore':'Archive'} onClick={()=>toggleArchive(r)}><Icon name={r.status==='Archived'?'check':'box'}/></button>
            <button title="Delete" onClick={()=>setDeleteConfirm(r)}><Icon name="trash"/></button>
          </>
        )}
      />

      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={editModal?.isNew?'ADD PRODUCT':'EDIT PRODUCT'} subtitle="Product catalog management" wide>
        <div className="product-form">
          <div className="two-col">
            <label className="field"><span>Product name *</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Samsung Galaxy S25"/></label>
            <label className="field"><span>SKU *</span><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} required placeholder="SAM-S25-256-BLK"/></label>
          </div>
          <div className="two-col">
            <label className="field"><span>Category *</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} required><option value="">Select category</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
            <label className="field"><span>Brand</span><input value={form.brand||''} onChange={e=>setForm({...form,brand:e.target.value})} placeholder="Brand name"/></label>
          </div>
          <label className="field"><span>Description *</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="4" required placeholder="Describe the product…"/></label>
          <div className="two-col">
            <label className="field"><span>Color (optional)</span><input value={form.color||''} onChange={e=>setForm({...form,color:e.target.value})} placeholder="e.g. Midnight Black"/></label>
            <label className="field"><span>Size (optional)</span><input value={form.size||''} onChange={e=>setForm({...form,size:e.target.value})} placeholder="e.g. 256GB / L / 42"/></label>
          </div>
          <div className="three-col">
            <label className="field"><span>Price (RWF) *</span><input type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} required/></label>
            <label className="field"><span>Stock *</span><input type="number" min="0" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} required/></label>
            <label className="field"><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Draft</option><option>Active</option><option>Archived</option></select></label>
          </div>
          <div className="editor-section">
            <h3>Media <small style={{fontWeight:400,fontSize:11}}>(optional — add as many as you want)</small></h3>
            <div className="upload-grid">
              <label className="upload-zone">
                <b>+ Add product photos</b>
                <small>Click to upload, one or many images</small>
                <input type="file" accept="image/*" multiple onChange={e=>fileToDataURLs(e.target.files,added=>{if(!added.length)return;setForm(f=>({...f,images:[...(f.images||[]),...added]}))})}/>
              </label>
              <label className="upload-zone">
                <b>+ Add product video</b>
                <small>One or more videos</small>
                <input type="file" accept="video/*" multiple onChange={e=>fileToDataURLs(e.target.files,added=>{if(!added.length)return;setForm(f=>({...f,videos:[...(f.videos||[]),...added]}))})}/>
              </label>
            </div>
            {Array.isArray(form.images)&&form.images.length>0&&<div className="media-grid">{form.images.map((img,i)=><div className="media-thumb" key={i}><img src={img} alt=""/>{i===0?<span>MAIN</span>:null}<button type="button" title="Remove" onClick={()=>setForm(f=>({...f,images:f.images.filter((x,j)=>j!==i)}))}>×</button></div>)}</div>}
            {Array.isArray(form.videos)&&form.videos.length>0&&<div className="video-row">{form.videos.map((v,i)=><div className="video-chip" key={i}><video src={v} controls/><button type="button" title="Remove" onClick={()=>setForm(f=>({...f,videos:f.videos.filter((x,j)=>j!==i)}))}>×</button></div>)}</div>}
          </div>
        </div>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setEditModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={saveProduct}>{editModal?.isNew?'Create Product':'Save Changes'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteConfirm} title="Delete Product" message={`Are you sure you want to delete ${deleteConfirm?.name}?`} danger onConfirm={()=>deleteProduct(deleteConfirm)} onCancel={()=>setDeleteConfirm(null)}/>
    </>
  );
}

// ─── VENDOR REPORTS ───────────────────────────────────────────────────────────

function VendorReports(){
  const [tab,setTab]=useState('reviews');
  const [dateRange,setDateRange]=useState('30');

  const reviewColumns=[
    {key:'product',label:'Product'},{key:'customer',label:'Customer'},
    {key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},{key:'text',label:'Review'},
    {key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Reports</h1>
          <p>Customer reviews, abuse reports and policy notices.</p>
        </div>
        <select className="period-select" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
          <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 3 Months</option>
        </select>
      </div>

      <TabGroup tabs={[{key:'reviews',label:'Customer Reviews',count:seedReviews.length},{key:'abuse',label:'Abuse Reports',count:seedAbuse.length},{key:'warnings',label:'Policy Warnings',count:seedWarnings.length}]} activeTab={tab} onTabChange={setTab}/>

      {tab==='reviews'&&<DataTable columns={reviewColumns} rows={seedReviews} rowKey={r=>r.id}/>}
      
      {tab==='abuse'&&(
        <div className="data-card">
          {seedAbuse.map(r=>(
            <div className="activity-row" key={r.id}><div><b>{r.reason}</b><small>Reported by {r.reporter} · {r.date}</small></div><StatusBadge status={r.status}/></div>
          ))}
        </div>
      )}
      
      {tab==='warnings'&&(
        <div className="data-card">
          {seedWarnings.map(r=>(
            <div className="activity-row" key={r.id}><div><b>{r.message}</b><small>{r.date}</small></div><StatusBadge status={r.acknowledged?'Acknowledged':'Pending'}/></div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── MAIN VENDOR DASHBOARD ────────────────────────────────────────────────────

export default function VendorDashboard(){
  const path=useLocation().pathname;
  
  if(path.includes('/wallet'))return <DashboardLayout><VendorWallet/></DashboardLayout>;
  if(path.includes('/suppliers'))return <DashboardLayout><VendorSuppliers/></DashboardLayout>;
  if(path.includes('/products'))return <DashboardLayout><VendorProducts/></DashboardLayout>;
  if(path.includes('/reports'))return <DashboardLayout><VendorReports/></DashboardLayout>;
  return <DashboardLayout><VendorOverview/></DashboardLayout>;
}

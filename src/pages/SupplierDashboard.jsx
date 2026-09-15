import {useState,useMemo,useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import SmartTable from '../components/SmartTable';
import {products as seedProducts} from '../data';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from '../services/analytics';
import {useToast} from '../components/Toast';
import {getOrders,updateOrder} from '../services/mvecStore';
import {useLocalQuery} from '../hooks/useLocalQuery';

const KEY='mvec_supplier_products';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return[]}};
const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seeded=seedProducts.slice(0,6).map((p,i)=>({...p,id:`SUP-${p.id}`,wholesalePrice:Math.round(p.price*.82),moq:i%2?5:10,bulkDiscount:i%2?5:8}));
const seedOrders=[
  {id:'B2B-2001',vendor:'Kigali Tech Store',products:'Electronics bundle',total:2200000,payment:'SUCCESS',status:'Ready for delivery',settlement:'HELD'},
  {id:'B2B-2002',vendor:'Smart Hub Rwanda',products:'Phone accessories',total:1480000,payment:'SUCCESS',status:'In Transit',settlement:'HELD'},
  {id:'B2B-2003',vendor:'Urban Closet',products:'Fashion items',total:860000,payment:'PENDING',status:'Awaiting Payment',settlement:'PENDING'},
];
const seedVendors=[
  {id:1,name:'Kigali Tech Store',category:'Electronics',orders:42,totalSpent:2200000,rating:4.9,status:'Active'},
  {id:2,name:'Smart Hub Rwanda',category:'Phones',orders:31,totalSpent:1480000,rating:4.8,status:'Active'},
  {id:3,name:'Urban Closet',category:'Fashion',orders:18,totalSpent:860000,rating:4.7,status:'Active'},
  {id:4,name:'HomeStyle Kigali',category:'Home & Living',orders:12,totalSpent:540000,rating:4.6,status:'Inactive'},
];
const seedWallet={pending:3680000,available:1840000,history:[
  {id:'TXN-S01',type:'Escrow Hold',reference:'B2B-2001',amount:2200000,status:'Held',date:'2026-08-26'},
  {id:'TXN-S02',type:'Escrow Hold',reference:'B2B-2002',amount:1480000,status:'Held',date:'2026-08-27'},
  {id:'TXN-S03',type:'Settlement Released',reference:'B2B-2000',amount:920000,status:'Released',date:'2026-08-25'},
]};
const seedReports=[
  {metric:'Fulfillment Speed',value:'94%',status:'Good'},
  {metric:'Stock Accuracy',value:'98.2%',status:'Excellent'},
  {metric:'Dispute Rate',value:'1.2%',status:'Low'},
  {metric:'Vendor Satisfaction',value:'4.7/5',status:'High'},
];

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const cls=['Active','Available','Completed','Released','Success','Good','Excellent','High','Low'].includes(status)?'active':
             ['Suspended','Blocked','Cancelled','Failed','Out of stock','Inactive'].includes(status)?'danger':
             ['Pending','Processing','Draft','Held','In Transit','Awaiting Payment','Ready for delivery'].includes(status)?'warning':'';
  return <em className={'status '+cls}>{status}</em>;
}

function DataTable({columns,rows,rowKey,actions,emptyText='No records found'}){
  const safeColumns=Array.isArray(columns)?columns:[];
  const safeRows=Array.isArray(rows)?rows:[];
  const [sortKey,setSortKey]=useState(null);
  const [sortDir,setSortDir]=useState('asc');
  const [q,setQ]=useState('');
  const [page,setPage]=useState(1);
  const per=8;
  
  const filtered=useMemo(()=>{
    let result=safeRows.filter(r=>JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
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
          {safeColumns.map(col=>(
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
            {safeColumns.map(col=>(<span key={col.key}>{col.render?col.render(r):r[col.key]}</span>))}
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

// ─── SUPPLIER OVERVIEW ────────────────────────────────────────────────────────

function SupplierOverview(){
  const [tab,setTab]=useState('pending');
  const [period,setPeriod]=useState('30 Days');
  const chart=getPeriodChart(period);
  const labels=getPeriodLabels(period);
  const toast=useToast();

  // TanStack Query: live B2B supplier orders (mvecStore + auto-refetch every 10s)
  const {data:rawOrders,invalidate:invalidateOrders}=useLocalQuery(
    ['supplierOrders'],
    ()=>getOrders().filter(o=>o.orderType==='supplier'||o.supplierId),
    {staleTime:1000*15}
  );
  const orders=useMemo(()=>{
    if(rawOrders?.length)return rawOrders.map(o=>({id:o.id||o.orderNumber||`B2B-${Date.now()}`,vendor:o.vendor||o.supplierName||'',products:o.items?.[0]?.name||o.products||'',total:Number(o.total||o.totalAmount)||0,payment:o.payment||'SUCCESS',status:o.status||'Pending',settlement:o.settlementStatus||'HELD'}));
    return seedOrders;
  },[rawOrders]);

  const markShipped=(order)=>{
    try{updateOrder(order.id,{status:'Shipped',settlement:'HELD'});}
    catch{}
    invalidateOrders();
    toast.success(`${order.id} marked as shipped.`);
  };

  const pendingColumns=[
    {key:'id',label:'Order'},{key:'vendor',label:'Vendor'},{key:'products',label:'Products'},
    {key:'total',label:'Total',render:r=>money(r.total)},{key:'payment',label:'Payment',render:r=><StatusBadge status={r.payment}/>},
    {key:'settlement',label:'Funds',render:r=><StatusBadge status={r.settlement}/>},
  ];
  const shippedColumns=[
    {key:'id',label:'Order'},{key:'vendor',label:'Vendor'},{key:'products',label:'Products'},
    {key:'total',label:'Total',render:r=>money(r.total)},{key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const inventoryColumns=[
    {key:'name',label:'Product',render:r=>(<div className="admin-product-main"><img src={r.image} alt=""/><div><b>{r.name}</b><small>MOQ: {r.moq}</small></div></div>)},
    {key:'wholesalePrice',label:'Price',render:r=>money(r.wholesalePrice)},
    {key:'stock',label:'Stock',render:r=>r.stock},
    {key:'bulkDiscount',label:'Discount',render:r=>`${r.bulkDiscount}%`},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'shipped':return {columns:shippedColumns,rows:orders.filter(o=>o.status==='Shipped'||o.status==='In Transit')};
      case 'inventory':return {columns:inventoryColumns,rows:read(KEY).length?read(KEY):seeded};
      default:return {columns:pendingColumns,rows:orders.filter(o=>o.status!=='Shipped'&&o.status!=='In Transit')};
    }
  };
  const {columns,rows}=getTabData();

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Supplier Overview</h1>
          <p>Wholesale revenue, active B2B orders and pending shipments.</p>
        </div>
        <select className="period-select" value={period} onChange={e=>setPeriod(e.target.value)}>
          <option>Today</option><option>7 Days</option><option>30 Days</option><option>3 Months</option><option>1 Year</option>
        </select>
      </div>

      <div className="metric-grid">
        <Metric label="Wholesale Revenue" value={money(Math.round(getPeriodMetrics(period).sales*.455))} icon="chart" sub={`${period} performance`}/>
        <Metric label="Active B2B Orders" value={orders.filter(o=>o.status!=='Completed').length} icon="cart" sub="In progress"/>
        <Metric label="Pending Shipments" value={orders.filter(o=>o.status==='Ready for delivery').length} icon="box" sub="Needs action"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head"><div><h3>Wholesale Performance</h3><span>{period}</span></div></div>
          <div className="fake-chart">{chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}</div>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Protected Settlements</h3><span>Escrow status</span></div></div>
          {seedWallet.history.slice(0,3).map(txn=>(
            <div className="activity-row" key={txn.id}><div><b>{txn.id}</b><small>{txn.reference} · {txn.type}</small></div><StatusBadge status={txn.status}/></div>
          ))}
        </div>
      </div>

      <div className="verified-box"><b>🔒 MVEC protected settlement</b><p>When a vendor pays a supplier through MVEC, funds are held. After fulfillment confirmation, the full supplier amount is released.</p></div>

      <TabGroup tabs={[{key:'pending',label:'Pending Supply Orders',count:orders.filter(o=>o.status!=='Shipped'&&o.status!=='In Transit').length},{key:'shipped',label:'Shipped Orders',count:orders.filter(o=>o.status==='Shipped'||o.status==='In Transit').length},{key:'inventory',label:'Inventory Levels'}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r=>r.id||r.name}
        actions={tab==='pending'?(r)=><button className="gradient-btn" onClick={()=>markShipped(r)}>Mark Shipped</button>:null}
      />
    </>
  );
}

// ─── SUPPLIER WALLET ──────────────────────────────────────────────────────────

function SupplierWallet(){
  const toast=useToast();
  const [wallet]=useState(seedWallet);
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState(wallet.available);
  const [method,setMethod]=useState('Bank Transfer');
  const [account,setAccount]=useState('BNK-00123456');

  const submitWithdrawal=()=>{
    if(amount<50000){toast.error('Minimum withdrawal is RWF 50,000.');return;}
    toast.success(`Withdrawal of ${money(amount)} requested.`);
    setWithdrawModal(false);
  };

  const txnColumns=[
    {key:'id',label:'Reference'},{key:'type',label:'Type'},{key:'amount',label:'Amount',render:r=>money(r.amount)},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Wallet</h1>
          <p>Pending balance held until vendor confirms stock receipt vs. available balance.</p>
        </div>
        <button className="gradient-btn" onClick={()=>setWithdrawModal(true)}>Request Payout</button>
      </div>

      <div className="metric-grid">
        <Metric label="Pending Balance" value={money(wallet.pending)} icon="wallet" sub="Held until delivery confirmed"/>
        <Metric label="Available Balance" value={money(wallet.available)} icon="wallet" sub="Cleared for withdrawal"/>
      </div>

      <DataTable columns={txnColumns} rows={wallet.history} rowKey={r=>r.id} emptyText="No transactions yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(wallet.available)}</b>. Minimum withdrawal is RWF 50,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="50000" step="1000" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option>Bank Transfer</option><option>MTN MoMo</option></select></label>
        <label className="field"><span>Account number</span><input value={account} onChange={e=>setAccount(e.target.value)}/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={wallet.available<50000}>Submit Request</button>
        </div>
      </Modal>
    </>
  );
}

// ─── SUPPLIER VENDORS ─────────────────────────────────────────────────────────

function SupplierVendors(){
  const toast=useToast();
  const [vendors]=useState(seedVendors);
  const [inviteModal,setInviteModal]=useState(null);
  const [inviteMessage,setInviteMessage]=useState('');

  const sendInvite=(vendor)=>{
    toast.success(`Invitation sent to ${vendor.name}.`);
    setInviteModal(null);
    setInviteMessage('');
  };

  const columns=[
    {key:'name',label:'Vendor',render:r=>(<div><b>{r.name}</b><small>{r.category}</small></div>)},
    {key:'orders',label:'Orders'},
    {key:'totalSpent',label:'Total Spent',render:r=>money(r.totalSpent)},
    {key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Vendors</h1>
          <p>Directory of active marketplace vendors for wholesale partnerships.</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={vendors}
        rowKey={r=>r.id}
        actions={r=>r.status==='Active'?<button className="gradient-btn" onClick={()=>setInviteModal(r)}>Invite to Catalog</button>:null}
      />

      <Modal open={!!inviteModal} onClose={()=>setInviteModal(null)} title="INVITE VENDOR" subtitle={`Invite ${inviteModal?.name} to your wholesale catalog`}>
        <div className="vendor-detail-grid">
          <div><span>Vendor</span><b>{inviteModal?.name}</b></div>
          <div><span>Category</span><b>{inviteModal?.category}</b></div>
        </div>
        <label className="field"><span>Message (optional)</span><textarea value={inviteMessage} onChange={e=>setInviteMessage(e.target.value)} rows="3" placeholder="Add a personalized message…"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setInviteModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={()=>sendInvite(inviteModal)}>Send Invitation</button>
        </div>
      </Modal>
    </>
  );
}

// ─── SUPPLIER PRODUCTS ────────────────────────────────────────────────────────

function SupplierProducts(){
  const toast=useToast();
  const {data:queryRows,invalidate:invalidateProducts}=useLocalQuery(
    ['supplierProducts'],
    ()=>read(KEY),
    {staleTime:1000*30}
  );
  // Local state mirrors the query cache so saves/deletes/status changes reflect
  // instantly in the table; the refetch then syncs localStorage in the background.
  const [rows,setRows]=useState(()=>{
    const stored=read(KEY);
    return Array.isArray(stored)&&stored.length?stored:seeded;
  });
  const [editModal,setEditModal]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [form,setForm]=useState({name:'',category:'Electronics',wholesalePrice:0,moq:1,stock:0,bulkDiscount:0,description:''});

  useEffect(()=>{
    if(Array.isArray(queryRows)&&queryRows.length)setRows(queryRows);
  },[queryRows]);

  const persist=next=>{setRows(next);localStorage.setItem(KEY,JSON.stringify(next));invalidateProducts();};

  const saveProduct=()=>{
    if(!form.name){toast.error('Product name is required.');return;}
    const product={...form,id:form.id||`SUP-${Date.now()}`};
    const isNew=!form.id;
    persist(isNew?[product,...rows]:rows.map(x=>x.id===form.id?{...x,...product}:x));
    toast.success(isNew?'Wholesale product added.':'Wholesale product saved.');
    setEditModal(null);
  };

  const deleteProduct=(p)=>{
    persist(rows.filter(x=>x.id!==p.id));
    toast.success('Product deleted.');
    setDeleteConfirm(null);
  };

  const openCreate=()=>{setForm({name:'',category:'Electronics',wholesalePrice:0,moq:1,stock:0,bulkDiscount:0,description:''});setEditModal({isNew:true});};
  const openEdit=(p)=>{setForm({...p});setEditModal({isNew:false});};

  const columns=[
    {key:'name',label:'Product',render:r=>(<div className="admin-product-main"><img src={r.image||seedProducts[0].image} alt=""/><div><b>{r.name}</b><small>{r.category} · MOQ {r.moq}</small></div></div>)},
    {key:'wholesalePrice',label:'Price',render:r=>money(r.wholesalePrice)},
    {key:'stock',label:'Stock'},
    {key:'bulkDiscount',label:'Discount',render:r=>`${r.bulkDiscount}%`},
    {key:'status',label:'Status',render:r=><StatusBadge status={Number(r.stock)>0?'Available':'Out of stock'}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Wholesale Products</h1>
          <p>Manage products that vendors can buy in bulk.</p>
        </div>
        <button className="gradient-btn" onClick={openCreate}><Icon name="plus"/> Add Product</button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r=>r.id}
        actions={r=>(<>
          <button title="Edit" onClick={()=>openEdit(r)}><Icon name="edit"/></button>
          <button title="Delete" onClick={()=>setDeleteConfirm(r)}><Icon name="trash"/></button>
        </>)}
      />

      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={editModal?.isNew?'ADD PRODUCT':'EDIT PRODUCT'} subtitle="Wholesale catalog management" wide>
        <div className="product-form">
          <div className="two-col">
            <label className="field"><span>Product name *</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Product name"/></label>
            <label className="field"><span>Category</span><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Electronics','Phones','Computers','Fashion','Home & Living','Beauty','Sports','Automotive'].map(c=><option key={c}>{c}</option>)}</select></label>
          </div>
          <div className="three-col">
            <label className="field"><span>Wholesale price (RWF) *</span><input type="number" min="0" value={form.wholesalePrice} onChange={e=>setForm({...form,wholesalePrice:Number(e.target.value)})} required/></label>
            <label className="field"><span>MOQ *</span><input type="number" min="1" value={form.moq} onChange={e=>setForm({...form,moq:Number(e.target.value)})} required/></label>
            <label className="field"><span>Stock *</span><input type="number" min="0" value={form.stock} onChange={e=>setForm({...form,stock:Number(e.target.value)})} required/></label>
          </div>
          <div className="two-col">
            <label className="field"><span>Bulk discount (%)</span><input type="number" min="0" max="100" value={form.bulkDiscount} onChange={e=>setForm({...form,bulkDiscount:Number(e.target.value)})}/></label>
          </div>
          <label className="field"><span>Description</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="3" placeholder="Product details for vendors…"/></label>
        </div>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setEditModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={saveProduct}>{editModal?.isNew?'Add Product':'Save Changes'}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteConfirm} title="Delete Product" message={`Delete ${deleteConfirm?.name}?`} danger onConfirm={()=>deleteProduct(deleteConfirm)} onCancel={()=>setDeleteConfirm(null)}/>
    </>
  );
}

// ─── SUPPLIER REPORTS ─────────────────────────────────────────────────────────

function SupplierReports(){
  const [dateRange,setDateRange]=useState('30');

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Reports</h1>
          <p>Fulfillment metrics, stock accuracy and vendor feedback.</p>
        </div>
        <select className="period-select" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
          <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 3 Months</option>
        </select>
      </div>

      <div className="metric-grid">
        {seedReports.map(r=>(
          <Metric key={r.metric} label={r.metric} value={r.value} icon="chart" sub={r.status}/>
        ))}
      </div>

      <div className="data-card">
        <div className="data-card-head"><div><h3>Performance Summary</h3><span>{dateRange} period</span></div></div>
        {seedReports.map(r=>(
          <div className="activity-row" key={r.metric}>
            <div><b>{r.metric}</b><small>{r.status}</small></div>
            <strong>{r.value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── MAIN SUPPLIER DASHBOARD ──────────────────────────────────────────────────

export default function SupplierDashboard(){
  const path=useLocation().pathname;
  
  if(path.includes('/wallet'))return <DashboardLayout><SupplierWallet/></DashboardLayout>;
  if(path.includes('/vendors'))return <DashboardLayout><SupplierVendors/></DashboardLayout>;
  if(path.includes('/products'))return <DashboardLayout><SupplierProducts/></DashboardLayout>;
  if(path.includes('/reports'))return <DashboardLayout><SupplierReports/></DashboardLayout>;
  return <DashboardLayout><SupplierOverview/></DashboardLayout>;
}

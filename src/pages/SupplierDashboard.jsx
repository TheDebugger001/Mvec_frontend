import {useState,useMemo,useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics,getReportSummary,normalizePeriod} from '../services/analytics';
import {useToast} from '../components/Toast';
import {extractErrorMessage,ordersApi,payoutsApi,adminApi} from '../API';
import {useVendorOrders} from '../hooks/useOrders';
import {
  useMyWholesaleProducts,
  useCreateWholesaleProduct,
  useUpdateWholesaleProduct,
  useDeleteWholesaleProduct,
  buildWholesalePayload,
} from '../hooks/useWholesaleProducts';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';

const fileToDataURLs=(files,onDone)=>{
  const arr=Array.from(files||[]);
  if(!arr.length){onDone([]);return;}
  const out=[];let done=0;
  arr.forEach(f=>{const r=new FileReader();r.onload=()=>{out.push(r.result);if(++done===arr.length)onDone(out);};r.readAsDataURL(f);});
};

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const cls=['Active','Available','Completed','Released','Success','Good','Excellent','High','Low','Paid','PAID'].includes(status)?'active':
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
  const normalized=normalizePeriod(period);
  const toast=useToast();

  const [chart,setChart]=useState([]);
  const [labels,setLabels]=useState([]);
  const [metrics,setMetrics]=useState({sales:0,orders:0,avgOrder:0,paymentVolume:0});

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [m,c,l]=await Promise.all([getPeriodMetrics(normalized),getPeriodChart(normalized),getPeriodLabels(normalized)]);
        if(!active)return;
        setMetrics(m||{});
        setChart(c||[]);
        setLabels(l||[]);
      }catch(e){
        if(active)toast.error(extractErrorMessage(e));
      }
    })();
    return ()=>{active=false};
  },[normalized]);

  // Note: no supplier-scoped order list endpoint exists yet; getVendorOrders()
  // is vendor-scoped and returns only orders containing the caller's items.
  const {data:ordersRes}=useVendorOrders();
  const orders=useMemo(()=>{
    const raw=Array.isArray(ordersRes?.orders)?ordersRes.orders:(Array.isArray(ordersRes)?ordersRes:null);
    if(!raw?.length)return [];
    return raw.map(o=>({id:o.orderNumber||o._id||`B2B-${Date.now()}`,vendor:o.user?.Fullname||o.user?.name||o.vendor||''.trim(),products:o.items?.[0]?.name||o.items?.[0]?.productName||o.products||'',total:Number(o.totalAmount||o.vendorSubtotal||o.total)||0,payment:o.paymentStatus||'SUCCESS',status:o.orderStatus||o.status||'Pending',settlement:'HELD'}));
  },[ordersRes]);

  const pendingColumns=[
    {key:'id',label:'Order'},{key:'vendor',label:'Vendor'},{key:'products',label:'Products'},
    {key:'total',label:'Total',render:r=>money(r.total)},{key:'payment',label:'Payment',render:r=><StatusBadge status={r.payment}/>},
    {key:'settlement',label:'Funds',render:r=><StatusBadge status={r.settlement}/>},
  ];
  const shippedColumns=[
    {key:'id',label:'Order'},{key:'vendor',label:'Vendor'},{key:'products',label:'Products'},
    {key:'total',label:'Total',render:r=>money(r.total)},{key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'shipped':return {columns:shippedColumns,rows:orders.filter(o=>o.status==='Shipped'||o.status==='In Transit'||o.status==='SHIPPED'||o.status==='OUT_FOR_DELIVERY')};
      default:return {columns:pendingColumns,rows:orders.filter(o=>!(o.status==='Shipped'||o.status==='In Transit'||o.status==='SHIPPED'||o.status==='OUT_FOR_DELIVERY'))};
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
        <Metric label="Wholesale Revenue" value={money(metrics.sales)} icon="chart" sub={`${normalized} performance`}/>
        <Metric label="Active B2B Orders" value={metrics.orders} icon="cart" sub="In progress"/>
        <Metric label="Payment Volume" value={money(metrics.paymentVolume)} icon="wallet" sub="Confirmed payments"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head"><div><h3>Wholesale Performance</h3><span>{normalized}</span></div></div>
          <div className="fake-chart">{chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}</div>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Protected Settlements</h3><span>Escrow status</span></div></div>
          <p className="muted">No settlement history is available through the API yet.</p>
        </div>
      </div>

      <div className="verified-box"><b>🔒 MVEC protected settlement</b><p>When a vendor pays a supplier through MVEC, funds are held. After fulfillment confirmation, the full supplier amount is released.</p></div>

      <TabGroup tabs={[{key:'pending',label:'Pending Supply Orders'},{key:'shipped',label:'Shipped Orders'}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.name} emptyText="No supply orders available through the API yet."/>
    </>
  );
}

// ─── SUPPLIER WALLET ──────────────────────────────────────────────────────────

function SupplierWallet(){
  const toast=useToast();
  const [balance,setBalance]=useState({availableBalance:0,pendingBalance:0,available:0,pending:0});
  const [txns,setTxns]=useState([]);
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('Bank Transfer');
  const [account,setAccount]=useState('');

  const available=Number(balance.availableBalance??balance.available??0);
  const pending=Number(balance.pendingBalance??balance.pending??0);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [b,h]=await Promise.all([payoutsApi.getBalance(),payoutsApi.getHistory()]);
        if(!active)return;
        setBalance(b?.balance||{});
        setTxns((Array.isArray(h?.payouts)?h.payouts:[]).map(p=>({id:p.payoutNumber||p._id||`TXN-${Date.now()}`,type:'Payout',reference:p.payoutNumber||'—',amount:Number(p.amount)||0,status:p.status||'PAID',date:p.createdAt?.slice?.(0,10)||''})));
      }catch(e){if(active)toast.error(extractErrorMessage(e));}
    })();
    return ()=>{active=false};
  },[]);

  const submitWithdrawal=async()=>{
    const value=Math.round(Number(amount)||0);
    if(value<50000){toast.error('Minimum withdrawal is RWF 50,000.');return;}
    if(value>available){toast.error('Insufficient available balance.');return;}
    if(!account.trim()){toast.error('Please provide payout details.');return;}
    try{
      await payoutsApi.requestPayout({amount:value,payoutMethod:method.toUpperCase().replace(' ','_'),payoutDetails:{accountName:account.trim(),accountNumber:account.trim()}});
      const [b,h]=await Promise.all([payoutsApi.getBalance(),payoutsApi.getHistory()]);
      setBalance(b?.balance||{});
      setTxns((Array.isArray(h?.payouts)?h.payouts:[]).map(p=>({id:p.payoutNumber||p._id||`TXN-${Date.now()}`,type:'Payout',reference:p.payoutNumber||'—',amount:Number(p.amount)||0,status:p.status||'PAID',date:p.createdAt?.slice?.(0,10)||''})));
      toast.success(`Withdrawal of ${money(value)} requested.`);
      setWithdrawModal(false);
      setAmount('');
    }catch(e){toast.error(extractErrorMessage(e));}
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
        <Metric label="Pending Balance" value={money(pending)} icon="wallet" sub="Held until delivery confirmed"/>
        <Metric label="Available Balance" value={money(available)} icon="wallet" sub="Cleared for withdrawal"/>
      </div>

      <DataTable columns={txnColumns} rows={txns} rowKey={r=>r.id} emptyText="No transactions yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(available)}</b>. Minimum withdrawal is RWF 50,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="50000" step="1000" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option>Bank Transfer</option><option>MTN MoMo</option></select></label>
        <label className="field"><span>Account / phone</span><input value={account} onChange={e=>setAccount(e.target.value)} placeholder="+250 7XX XXX XXX or account number"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={available<50000}>Submit Request</button>
        </div>
      </Modal>
    </>
  );
}

// ─── SUPPLIER VENDORS ─────────────────────────────────────────────────────────

function SupplierVendors(){
  const toast=useToast();
  const [vendors,setVendors]=useState([]);
  const [inviteModal,setInviteModal]=useState(null);
  const [inviteMessage,setInviteMessage]=useState('');

  useEffect(()=>{
    let active=true;
    adminApi.getVendors({pageSize:100}).then(res=>{
      if(!active)return;
      setVendors((res?.data||[]).map(v=>({
        id:v.user?._id||v._id,
        name:v.businessName||v.name||'',
        category:'—',
        orders:'—',
        totalSpent:0,
        rating:v.ratingAvg||0,
        status:v.status||'ACTIVE',
      })));
    }).catch(e=>{if(active)toast.error(`Vendor directory unavailable: ${extractErrorMessage(e)}`);});
    return ()=>{active=false};
  },[]);

  const sendInvite=(vendor)=>{
    toast.info(`Wholesale catalog invitations are managed via vendor-supplier messages.`);
    setInviteModal(null);
  };

  const columns=[
    {key:'name',label:'Vendor',render:r=>(<div><b>{r.name}</b><small>{r.category}</small></div>)},
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
        emptyText="No vendors found."
        actions={r=>String(r.status).toUpperCase()==='ACTIVE'?<button className="gradient-btn" onClick={()=>setInviteModal(r)}>Invite to Catalog</button>:null}
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

const WHOLESALE_STATUS_COLORS={
  'Active':'#15815e',
  'Out of stock':'#b56a00',
  'Archived':'#d64545',
};

function SupplierProducts(){
  const toast=useToast();
  const {data:productsRes,isLoading}=useMyWholesaleProducts();
  const createMutation=useCreateWholesaleProduct();
  const updateMutation=useUpdateWholesaleProduct();
  const deleteMutation=useDeleteWholesaleProduct();

  const [rows,setRows]=useState([]);
  useEffect(()=>{setRows(Array.isArray(productsRes)?productsRes:[]);},[productsRes]);

  const [q,setQ]=useState('');
  const [statusFilter,setStatusFilter]=useState('All');
  const [editModal,setEditModal]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [form,setForm]=useState({name:'',category:'',unit:'piece',wholesalePrice:'',retailPrice:'',moq:'1',stock:'',bulkDiscount:'',description:'',images:[]});

  const displayStatus=p=>p.status==='OUT_OF_STOCK'?'Out of stock':p.status==='ARCHIVED'?'Archived':'Active';
  const productStatuses=[...new Set(rows.map(displayStatus).filter(Boolean))];

  const normalizeForForm=p=>({
    name:p.name||'',
    category:p.category||'General',
    unit:p.unit||'piece',
    wholesalePrice:String(p.wholesalePrice||''),
    retailPrice:String(p.retailPrice||''),
    moq:String(p.moq||'1'),
    stock:String(p.stock||''),
    bulkDiscount:String(p.bulkDiscount||''),
    description:p.shortDescription||'',
    images:Array.isArray(p.images)?p.images:[],
  });

  const saveProduct=async()=>{
    if(!form.name||!form.name.trim()){toast.error('Product name is required.');return;}
    if(!(Number(form.wholesalePrice)>0)){toast.error('A valid wholesale price is required.');return;}
    const payload=buildWholesalePayload(form);
    try{
      if(editModal?.isNew){
        await createMutation.mutateAsync(payload);
        toast.success('Wholesale product created.');
      }else{
        await updateMutation.mutateAsync({id:editModal.backendId,payload});
        toast.success('Wholesale product saved.');
      }
      setEditModal(null);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const removeProduct=async(p)=>{
    try{
      await deleteMutation.mutateAsync(p.backendId||p.id);
      toast.success(`${p.name} deleted.`);
    }catch(e){toast.error(extractErrorMessage(e));}
    setDeleteConfirm(null);
  };

  const toggleArchive=async(p)=>{
    const next=p.status==='ARCHIVED'?'ACTIVE':'ARCHIVED';
    try{
      await updateMutation.mutateAsync({id:p.backendId||p.id,payload:{status:next}});
      toast.info(next==='ARCHIVED'?'Product archived.':'Product restored.');
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const openCreate=()=>{setForm({name:'',category:'',unit:'piece',wholesalePrice:'',retailPrice:'',moq:'1',stock:'',bulkDiscount:'',description:'',images:[]});setEditModal({isNew:true});};
  const openEdit=p=>{setForm(normalizeForForm(p));setEditModal({isNew:false,backendId:p.backendId||p.id});};

  const filtered=useMemo(()=>{
    let list=rows;
    if(statusFilter!=='All')list=list.filter(p=>displayStatus(p)===statusFilter);
    if(q.trim())list=list.filter(p=>JSON.stringify(p).toLowerCase().includes(q.toLowerCase()));
    return list;
  },[rows,q,statusFilter]);

  const columns=[
    {key:'name',label:'Product',render:r=>(
      <div className="admin-product-main">
        {r.images?.[0]?<img src={r.images[0]} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}
        <div><b>{r.name}</b><small>{r.category} · MOQ {r.moq}</small></div>
      </div>
    )},
    {key:'wholesalePrice',label:'Price',render:r=>money(r.wholesalePrice)},
    {key:'stock',label:'Stock',render:r=><span style={r.stock<=0?{color:'var(--danger,#d64545)'}:{}}>{r.stock} units</span>},
    {key:'bulkDiscount',label:'Discount',render:r=>`${r.bulkDiscount}%`},
    {key:'status',label:'Status',render:r=><StatusBadge status={displayStatus(r)}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPPLIER PLATFORM</span>
          <h1>Wholesale Products</h1>
          <p>Manage the bulk catalog vendors can order against.</p>
        </div>
        <button className="gradient-btn" onClick={openCreate}><Icon name="plus"/> Add Product</button>
      </div>

      {productStatuses.length>0&&(
        <div className="status-filter-bar">
          {['All',...productStatuses].map(s=>(
            <button
              key={s}
              className={'status-filter-btn'+(statusFilter===s?' active':'')}
              style={s!=='All'&&WHOLESALE_STATUS_COLORS[s]?{'--sf-color':WHOLESALE_STATUS_COLORS[s]}:{}}
              onClick={()=>setStatusFilter(s)}
            >
              {s!=='All'&&<span className="status-dot" style={{background:WHOLESALE_STATUS_COLORS[s]||'#94a3b8'}}/>}
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="data-card">
        <div className="data-card-head">
          <div className="dash-toolbar" style={{width:'100%'}}>
            <div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>{setQ(e.target.value)}} placeholder="Search wholesale products…"/></div>
            <span className="table-count">{filtered.length} products</span>
          </div>
        </div>

        {isLoading?(
          <div className="data-row table-empty">Loading your wholesale catalog…</div>
        ):filtered.length===0?(
          <div className="empty-state">
            <Icon name="box" size={34}/>
            <b>{rows.length===0?'No wholesale products yet.':'No products match your filters.'}</b>
            <p>Create your first listing to make bulk-priced products available to vendors.</p>
            <button className="gradient-btn" onClick={openCreate}><Icon name="plus"/> Add Product</button>
          </div>
        ):(
          <div className="data-table">
            <div className="data-row table-header">
              {columns.map(col=><span key={col.key} className="table-label">{col.label}</span>)}
              <span className="table-label">Actions</span>
            </div>
            {filtered.map(r=>(
              <div className="data-row" key={r.id}>
                {columns.map(col=><span key={col.key}>{col.render?col.render(r):r[col.key]}</span>)}
                <span className="row-actions">
                  <button title="Edit" onClick={()=>openEdit(r)}><Icon name="edit"/></button>
                  <button title={r.status==='ARCHIVED'?'Restore':'Archive'} onClick={()=>toggleArchive(r)}><Icon name={r.status==='ARCHIVED'?'check':'box'}/></button>
                  <button title="Delete" onClick={()=>setDeleteConfirm(r)}><Icon name="trash"/></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={editModal?.isNew?'ADD WHOLESALE PRODUCT':'EDIT WHOLESALE PRODUCT'} subtitle="Bulk catalog management" wide>
        <div className="product-form">
          <div className="two-col">
            <label className="field"><span>Product name *</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Samsung Galaxy S25 (Wholesale)"/></label>
            <label className="field"><span>Category</span><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="e.g. Electronics"/></label>
          </div>
          <label className="field"><span>Description</span><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows="3" placeholder="Short description for vendors…"/></label>
          <div className="three-col">
            <label className="field"><span>Wholesale price (RWF) *</span><input type="number" min="0" value={form.wholesalePrice} onChange={e=>setForm({...form,wholesalePrice:e.target.value})} required/></label>
            <label className="field"><span>Retail price (RWF)</span><input type="number" min="0" value={form.retailPrice} onChange={e=>setForm({...form,retailPrice:e.target.value})}/></label>
            <label className="field"><span>MOQ *</span><input type="number" min="1" value={form.moq} onChange={e=>setForm({...form,moq:e.target.value})} required/></label>
          </div>
          <div className="three-col">
            <label className="field"><span>Stock *</span><input type="number" min="0" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} required/></label>
            <label className="field"><span>Bulk discount (%)</span><input type="number" min="0" max="100" value={form.bulkDiscount} onChange={e=>setForm({...form,bulkDiscount:e.target.value})}/></label>
            <label className="field"><span>Unit</span><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="piece"/></label>
          </div>
          <div className="editor-section">
            <h3>Media <small style={{fontWeight:400,fontSize:11}}>(optional)</small></h3>
            <div className="upload-grid">
              <label className="upload-zone">
                <b>+ Add product photos</b>
                <small>One or many images</small>
                <input type="file" accept="image/*" multiple onChange={e=>fileToDataURLs(e.target.files,added=>{if(!added.length)return;setForm(f=>({...f,images:[...(f.images||[]),...added]}))})}/>
              </label>
            </div>
            {Array.isArray(form.images)&&form.images.length>0&&(
              <div className="media-grid">
                {form.images.map((img,i)=>(
                  <div className="media-thumb" key={i}>
                    <img src={img} alt=""/>
                    {i===0?<span>MAIN</span>:null}
                    <button type="button" title="Remove" onClick={()=>setForm(f=>({...f,images:f.images.filter((x,j)=>j!==i)}))}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setEditModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={saveProduct} disabled={createMutation.isPending||updateMutation.isPending}>
            {(createMutation.isPending||updateMutation.isPending)?'Saving…':(editModal?.isNew?'Create Product':'Save Changes')}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteConfirm} title="Delete wholesale product" message={`Are you sure you want to delete ${deleteConfirm?.name}?`} danger onConfirm={()=>removeProduct(deleteConfirm)} onCancel={()=>setDeleteConfirm(null)}/>
    </>
  );
}

// ─── SUPPLIER REPORTS ─────────────────────────────────────────────────────────

function SupplierReports(){
  const [dateRange,setDateRange]=useState('30');
  const [metrics,setMetrics]=useState([]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const summary=await getReportSummary(dateRange);
        const m=summary?.metrics||{};
        if(!active)return;
        setMetrics([
          {metric:'Gross Sales',value:money(m.grossSales||0),status:'Reported'},
          {metric:'Orders',value:m.orders||0,status:'Reported'},
          {metric:'Low Stock Products',value:m.lowStockProducts||0,status:'Reported'},
          {metric:'Payment Volume',value:money(m.paymentVolume||0),status:'Reported'},
        ]);
      }catch(e){
        if(active)setMetrics([]);
      }
    })();
    return ()=>{active=false};
  },[dateRange]);

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
        {metrics.length===0?<p className="muted">No supplier performance metrics are available through the API yet.</p>:metrics.map(r=>(
          <Metric key={r.metric} label={r.metric} value={r.value} icon="chart" sub={r.status}/>
        ))}
      </div>

      <div className="data-card">
        <div className="data-card-head"><div><h3>Performance Summary</h3><span>{dateRange} day period</span></div></div>
        {metrics.length===0&&<div className="data-row table-empty">No performance summary available.</div>}
        {metrics.map(r=>(
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
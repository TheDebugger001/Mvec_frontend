import {useState,useEffect,useMemo} from 'react';
import {useLocation} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics,normalizePeriod} from '../services/analytics';
import {useAuth} from '../context/AuthContext';
import {useToast} from '../components/Toast';
import {extractErrorMessage,payoutsApi,categoriesApi} from '../API';
import {useCreateProduct,useUpdateProduct,useDeleteProduct,useVendorProducts} from '../hooks/useProducts';
import {useSuppliers} from '../hooks/useSuppliers';
import {useVendorOrders} from '../hooks/useOrders';
import {useVendorReviews,useReviewReply} from '../hooks/useReviews';
import {useAbuseReports,useSubmitAbuseReport,useUserSearch} from '../hooks/useAbuseReports';
import {queryKeys} from '../queryClient';
import SupplierOrderModal from '../components/SupplierOrderModal';

const hasToken=()=>!!localStorage.getItem('huska_token');
const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const generateSku=(name='',category='')=>{
  const base=(String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,8)||'PROD').toUpperCase();
  const cat=(String(category).toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,3)||'GEN').toUpperCase();
  return `${cat}-${base}-${Date.now().toString(36).toUpperCase()}`;
};

const toBackendPayload=p=>({name:p.name,sku:p.sku,brand:p.brand||'',description:p.description||'',category:p.category||undefined,price:Number(p.price)||0,stockQuantity:Math.max(0,Number(p.stock)||0),status:(Number(p.stock)||0)<=0?'OUT_OF_STOCK':'ACTIVE',color:p.color||'',size:p.size||'',attributes:{Color:p.color||'',Size:p.size||'',Material:p.material||'',Brand:p.brand||''},media:{mainImage:p.images?.[0]||p.image||'',gallery:Array.isArray(p.images)?p.images:[],videos:Array.isArray(p.videos)?p.videos:[]}});

const fileToDataURLs=(files,onDone)=>{
  const arr=Array.from(files||[]);
  if(!arr.length){onDone([]);return;}
  const out=[];let done=0;
  arr.forEach(f=>{const r=new FileReader();r.onload=()=>{out.push(r.result);if(++done===arr.length)onDone(out);};r.readAsDataURL(f);});
};

const localProductStatus=s=>{
  const upper=String(s||'').toUpperCase();
  if(upper==='OUT_OF_STOCK')return 'Out of stock';
  if(upper==='DRAFT')return 'Draft';
  if(upper==='PENDING_APPROVAL')return 'Pending';
  return 'Active';
};

const flattenCategories=(tree=[])=>{
  const out=[];
  const walk=nodes=>{
    nodes.forEach(n=>{
      out.push({id:n._id||n.id,name:n.name||''});
      if(Array.isArray(n.children)&&n.children.length)walk(n.children);
      if(Array.isArray(n.subcategories)&&n.subcategories.length)walk(n.subcategories);
    });
  };
  walk(tree);
  return out;
};

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const s=String(status||'');
  const cls=['Active','Published','Approved','Completed','Available','Success','Released','Delivered','Resolved','RESOLVED','PAID','SUCCESS'].includes(s)?'active':
             ['Suspended','Blocked','Rejected','Cancelled','Failed','Out of stock','Archived','FRAUDULENT_ACTIVITY','HARASSMENT_OR_ABUSE'].includes(s)?'danger':
             ['investigation','INVESTIGATE','Under Review','UNDER_REVIEW'].includes(s)?'investigation':
             ['Pending','Pending Review','Processing','Draft','Open','In Transit','Preparing','Confirmed','PENDING','NON_COMPLIANT_PRODUCT_OR_ORDER','OTHER_POLICY_VIOLATION'].includes(s)?'warning':'';
  const label=s
    .replace(/_/g,' ')
    .toLowerCase()
    .replace(/\b\w/g,m=>m.toUpperCase());
  return <em className={'status '+cls}>{label}</em>;
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

const PRODUCT_STATUS_COLORS={
  'Active':'#15815e',
  'Draft':'#6b7780',
  'Archived':'#d64545',
  'Out of stock':'#b56a00',
};

// ─── VENDOR OVERVIEW ──────────────────────────────────────────────────────────

function VendorOverview(){
  const [tab,setTab]=useState('orders');
  const [period,setPeriod]=useState('30 Days');
  const normalized=normalizePeriod(period);

  const [chart,setChart]=useState([]);
  const [labels,setLabels]=useState([]);
  const [metrics,setMetrics]=useState({sales:0,orders:0,avgOrder:0,customers:0,activeVendors:0,lowStockProducts:0,paymentVolume:0});

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [m,c,l]=await Promise.all([getPeriodMetrics(normalized),getPeriodChart(normalized),getPeriodLabels(normalized)]);
        if(!active)return;
        setMetrics(m||{});
        setChart(c||[]);
        setLabels(l||[]);
      }catch(e){console.warn(e);}
    })();
    return ()=>{active=false};
  },[normalized]);

  const {data:productsRes}=useVendorProducts();
  const products=useMemo(()=>(Array.isArray(productsRes?.products)?productsRes.products:[]).map(p=>({id:p._id||p.id,name:p.name||'',stock:Number(p.stockQuantity??p.stock??0),status:p.status||'ACTIVE',image:p.media?.mainImage||p.image||''})),[productsRes]);

  const {data:reviewsRes}=useVendorReviews();
  const reviews=useMemo(()=>(Array.isArray(reviewsRes?.data)?reviewsRes.data:[]),[reviewsRes]);
  const storeRating=useMemo(()=>{
    if(!reviews.length)return '—';
    return (reviews.reduce((s,r)=>s+(Number(r.rating)||0),0)/reviews.length).toFixed(1)+' ★';
  },[reviews]);

  // TanStack Query: live vendor orders with background polling
  const {data:ordersRes}=useVendorOrders();
  const orders=useMemo(()=>{
    const raw=Array.isArray(ordersRes?.orders)?ordersRes.orders:(Array.isArray(ordersRes)?ordersRes:null);
    if(!raw?.length)return [];
    return raw.map(o=>({id:o.orderNumber||o._id||`MVEC-${Date.now()}`,customer:o.user?.Fullname||o.user?.name||o.customer||'',product:(Array.isArray(o.items)&&o.items[0]?.productName)||o.items?.[0]?.name||o.product||'',total:Number(o.totalAmount||o.vendorSubtotal||o.total)||0,payment:o.paymentStatus||'SUCCESS',status:o.orderStatus||o.status||'Processing'}));
  },[ordersRes]);
  
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
    {key:'status',label:'Status',render:r=><StatusBadge status={r.stock<=5?'Out of stock':r.stock?'Active':'Out of stock'}/>},
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
        <Metric label="Daily Sales" value={money(metrics.sales)} icon="chart" sub={`${normalized} performance`}/>
        <Metric label="Active Orders" value={metrics.orders} icon="cart" sub={`${normalized} orders`}/>
        <Metric label="Low Stock" value={metrics.lowStockProducts||products.filter(p=>Number(p.stock)<=5).length} icon="bell" sub="Needs attention"/>
        <Metric label="Store Rating" value={storeRating} icon="heart" sub="Customer reviews"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head"><div><h3>Sales Trend</h3><span>{normalized}</span></div></div>
          <div className="fake-chart">
            {chart.map((h,i)=><div key={i} style={{height:h+'%'}}><span>{labels[i]}</span></div>)}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Inventory Alerts</h3><span>Low stock items</span></div></div>
          {products.filter(p=>Number(p.stock)<=9).slice(0,4).map(p=>(
            <div className="activity-row" key={p.id}><div><b>{p.name}</b><small>{p.stock} units remaining</small></div><em className="status warning">Low</em></div>
          ))}
          {products.filter(p=>Number(p.stock)<=9).length===0&&<p className="muted">No low stock alerts.</p>}
        </div>
      </div>

      <TabGroup tabs={[{key:'orders',label:'Active Orders',count:orders.length},{key:'delivery',label:'Delivery Status'},{key:'stock',label:'Low Stock Alerts',count:products.filter(p=>p.stock<=5).length}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.name} emptyText="No vendor orders yet."/>
    </>
  );
}

// ─── VENDOR WALLET ────────────────────────────────────────────────────────────

function VendorWallet(){
  const toast=useToast();
  const [balance,setBalance]=useState({availableBalance:0,pendingBalance:0,available:0,pending:0});
  const [txns,setTxns]=useState([]);
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('MTN MoMo');
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
        setTxns((Array.isArray(h?.payouts)?h.payouts:[]).map(p=>({id:p.payoutNumber||p._id||`TXN-${Date.now()}`,type:'Withdrawal',reference:p.payoutNumber||'—',amount:-(Number(p.amount)||0),status:p.status||'PAID',date:p.createdAt?.slice?.(0,10)||''})));
      }catch(e){if(active)toast.error(extractErrorMessage(e));}
    })();
    return ()=>{active=false};
  },[]);

  const submitWithdrawal=async()=>{
    const value=Math.round(Number(amount)||0);
    if(value<10000){toast.error('Minimum withdrawal is RWF 10,000.');return;}
    if(value>available){toast.error('Insufficient balance.');return;}
    if(!account.trim()){toast.error('Please provide a payout phone / account.');return;}
    try{
      await payoutsApi.requestPayout({amount:value,payoutMethod:method.toUpperCase(),payoutDetails:{accountName:account.trim(),accountNumber:account.trim()}});
      const [b,h]=await Promise.all([payoutsApi.getBalance(),payoutsApi.getHistory()]);
      setBalance(b?.balance||{});
      setTxns((Array.isArray(h?.payouts)?h.payouts:[]).map(p=>({id:p.payoutNumber||p._id||`TXN-${Date.now()}`,type:'Withdrawal',reference:p.payoutNumber||'—',amount:-(Number(p.amount)||0),status:p.status||'PAID',date:p.createdAt?.slice?.(0,10)||''})));
      toast.success(`Withdrawal of ${money(value)} requested.`);
      setWithdrawModal(false);
      setAmount('');
    }catch(e){toast.error(extractErrorMessage(e));}
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
        <Metric label="Pending Balance" value={money(pending)} icon="wallet" sub="Held in escrow"/>
        <Metric label="Available Balance" value={money(available)} icon="wallet" sub="Cleared for withdrawal"/>
      </div>

      <DataTable columns={txnColumns} rows={txns} rowKey={r=>r.id} emptyText="No transactions yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(available)}</b>. Minimum withdrawal is RWF 10,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="10000" step="1000" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Bank account</option></select></label>
        <label className="field"><span>Account / phone</span><input value={account} onChange={e=>setAccount(e.target.value)} placeholder="+250 7XX XXX XXX"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={available<10000}>Submit Request</button>
        </div>
      </Modal>
    </>
  );
}

// ─── VENDOR SUPPLIERS ─────────────────────────────────────────────────────────

function VendorSuppliers(){
  const [detailsSupplier,setDetailsSupplier]=useState(null);

  // TanStack Query: real supplier directory with auto-refetch + cache
  const {data:suppliersRes}=useSuppliers({page:1,pageSize:100});
  const suppliers=useMemo(()=>{
    const raw=suppliersRes?.data;
    if(Array.isArray(raw)&&raw.length)return raw;
    if(Array.isArray(suppliersRes?.suppliers)&&suppliersRes.suppliers.length)return suppliersRes.suppliers;
    return [];
  },[suppliersRes]);

  const columns=[
    {key:'name',label:'Supplier',render:r=>(
      <div className="admin-product-main">
        {r.logoUrl||r.logo?<img src={r.logoUrl||r.logo} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}
        <div><b>{r.businessName||r.name}</b><small>{(r.category?.name||r.category||'')+' · '+(r.location?.name||r.location||'Rwanda')}</small></div>
      </div>
    )},
    {key:'rating',label:'Rating',render:r=>`★ ${Number(r.ratingAvg||r.rating)||'—'}`},
    {key:'verificationStatus',label:'Verification',render:r=><StatusBadge status={r.verificationStatus==='VERIFIED'?'Approved':'Pending'}/>},
    {key:'catalog',label:'Catalog',render:r=>`${r.catalog||'—'} items`},
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
        rowKey={r=>r.id||r._id}
        emptyText="No suppliers found."
        actions={r=><button className="gradient-btn place-order-btn" onClick={()=>setDetailsSupplier(r)}>Details</button>}
      />

      <SupplierOrderModal supplier={detailsSupplier} onClose={()=>setDetailsSupplier(null)}/>
    </>
  );
}

// ─── VENDOR PRODUCTS ──────────────────────────────────────────────────────────

function VendorProducts(){
  const {user}=useAuth();
  const toast=useToast();
  const queryClient=useQueryClient();
  const createProduct=useCreateProduct();
  const updateProduct=useUpdateProduct();
  const deleteProductMutation=useDeleteProduct();
  const owner=user?.companyName||user?.fullName||'My Store';

  const normalize=p=>{
    const images=Array.isArray(p.media?.gallery)&&p.media.gallery.length?p.media.gallery:(p.media?.mainImage?[p.media.mainImage]:(p.image?[p.image]:[]));
    return {
      ...p,
      backendId:p._id||p.id,
      id:p._id||p.id||`PRD-${Date.now()}`,
      images,
      videos:Array.isArray(p.media?.videos)?p.media.videos:[],
      category:typeof p.category==='object'&&p.category?p.category._id||p.category.id:null,
      categoryName:typeof p.category==='object'&&p.category?p.category.name:'',
      price:Number(p.price)||0,
      stock:Number(p.stockQuantity??p.stock??0),
      color:p.attributes?.Color||p.color||'',
      size:p.attributes?.Size||p.size||'',
      brand:p.brand||'',
      description:p.description||'',
      status:localProductStatus(p.status),
    };
  };

  const {data:productsRes,invalidate:pInvalidate}=useVendorProducts();
  const [rows,setRows]=useState([]);
  useEffect(()=>{
    setRows((Array.isArray(productsRes?.products)?productsRes.products:[]).map(normalize));
  },[productsRes]);

  const [statusFilter,setStatusFilter]=useState('All');
  const [editModal,setEditModal]=useState(null);
  const [deleteConfirm,setDeleteConfirm]=useState(null);
  const [form,setForm]=useState({name:'',sku:'',category:'',price:'',stock:'',description:'',status:'Draft',color:'',size:'',brand:'',images:[],videos:[]});

  const [categories,setCategories]=useState([]);
  useEffect(()=>{
    let active=true;
    categoriesApi.getAll().then(r=>{
      const tree=Array.isArray(r?.categories)?r.categories:(Array.isArray(r?.data)?r.data:[]);
      if(active)setCategories(flattenCategories(tree));
    }).catch(()=>{});
    return ()=>{active=false};
  },[]);

  const reload=()=>{queryClient.invalidateQueries({queryKey:queryKeys.products});};

  const saveProduct=async()=>{
    if(!form.name||!form.category||form.price===''){toast.error('Please complete required fields.');return;}
    const sku=(form.sku||'').trim()||generateSku(form.name,form.category);
    const product={...form,sku,price:Number(form.price),stock:Number(form.stock),image:form.images?.[0]||'',gallery:Array.isArray(form.images)?form.images:[],vendor:owner};
    try{
      const payload=toBackendPayload(product);
      if(editModal?.isNew){await createProduct.mutateAsync(payload);}
      else if(form.backendId){await updateProduct.mutateAsync({id:form.backendId,payload});}
      reload();
      toast.success(editModal?.isNew?'Product created.':'Product saved.');
      setEditModal(null);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const deleteProduct=async(p)=>{
    try{
      await deleteProductMutation.mutateAsync(p.backendId||p.id);
      reload();
      toast.success(`${p.name} deleted.`);
    }catch(e){toast.error(extractErrorMessage(e));}
    setDeleteConfirm(null);
  };

  const toggleArchive=async(p)=>{
    const nextStatus=p.status==='Draft'?'ACTIVE':'DRAFT';
    try{
      await updateProduct.mutateAsync({id:p.backendId||p.id,payload:{status:nextStatus}});
      reload();
      toast.info(nextStatus==='DRAFT'?'Product archived.':'Product restored.');
    }catch(e){toast.error(extractErrorMessage(e));}
    setStatusFilter('All');
  };

  const openCreate=()=>{setForm({name:'',sku:'',category:'',price:'',stock:'',description:'',status:'Draft',color:'',size:'',brand:'',images:[],videos:[]});setEditModal({isNew:true});};
  const openEdit=(p)=>{setForm({...normalize(p),price:String(p.price),stock:String(p.stock)});setEditModal({isNew:false});};

  const columns=[
    {key:'name',label:'Product',render:r=>(
      <div className="admin-product-main">
        {r.images?.[0]?<img src={r.images[0]} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}
        <div><b>{r.name}</b><small>{r.sku} · {r.categoryName||''}</small></div>
      </div>
    )},
    {key:'price',label:'Price',render:r=>money(r.price)},
    {key:'stock',label:'Stock',render:r=>r.stock},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  const productStatuses=[...new Set(rows.map(r=>r.status).filter(Boolean))];
  const filteredRows=statusFilter==='All'?rows:rows.filter(r=>r.status===statusFilter);

  const statusFilterBar=(
    <div className="status-filter-bar">
      {['All',...productStatuses].map(s=>(
        <button
          key={s}
          className={'status-filter-btn'+(statusFilter===s?' active':'')}
          style={s!=='All'&&PRODUCT_STATUS_COLORS[s]?{'--sf-color':PRODUCT_STATUS_COLORS[s]}:{}}
          onClick={()=>setStatusFilter(s)}
        >
          {s!=='All'&&<span className="status-dot" style={{background:PRODUCT_STATUS_COLORS[s]||'#94a3b8'}}/>}
          {s}
        </button>
      ))}
    </div>
  );

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

      {statusFilterBar}

      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={r=>r.id}
        emptyText="No products yet. Create your first listing."
        actions={r=>(
          <>
            <button title="Edit" onClick={()=>openEdit(r)}><Icon name="edit"/></button>
            <button title={r.status==='Draft'?'Restore':'Archive'} onClick={()=>toggleArchive(r)}><Icon name={r.status==='Draft'?'check':'box'}/></button>
            <button title="Delete" onClick={()=>setDeleteConfirm(r)}><Icon name="trash"/></button>
          </>
        )}
      />

      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title={editModal?.isNew?'ADD PRODUCT':'EDIT PRODUCT'} subtitle="Product catalog management" wide>
        <div className="product-form">
          <div className="two-col">
            <label className="field"><span>Product name *</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. Samsung Galaxy S25"/></label>
            <label className="field"><span>SKU (auto-generated if left blank)</span><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="SAM-S25-256-BLK"/></label>
          </div>
          <div className="two-col">
            <label className="field"><span>Category *</span><select value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})} required><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
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
            <label className="field"><span>Status</span><select value={form.status||'Draft'} onChange={e=>setForm({...form,status:e.target.value})}><option>Draft</option><option>Active</option><option>Published</option><option>Archived</option><option>Out of stock</option></select></label>
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

function Stars({ value }) {
  const [filled, hasHalf] = (() => {
    const v = Math.max(0, Math.min(5, Number(value) || 0));
    return [Math.round(v), false];
  })();
  return (
    <span className="star-row" title={`${Number(value).toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={"star" + (i <= filled ? " filled" : "")}>★</span>
      ))}
    </span>
  );
}

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const reasonLabel = (c) =>
  String(c || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

function ReviewDetailsModal({ review, onClose, onSaveReply, saving }) {
  const [reply, setReply] = useState(review?.vendorReply || "");
  useEffect(() => {
    setReply(review?.vendorReply || "");
  }, [review]);
  if (!review) return null;
  return (
    <Modal open={!!review} onClose={onClose} title="CUSTOMER REVIEW" subtitle="Review details & response" wide>
      <div className="review-detail">
        <div className="review-detail-top">
          {review.productImage ? (
            <img className="review-thumb" src={review.productImage} alt="" />
          ) : (
            <div className="product-placeholder"><Icon name="box" /></div>
          )}
          <div className="review-detail-meta">
            <div className="admin-product-main">
              <div className="product-placeholder" style={{ borderRadius: "50%" }}><Icon name="user" /></div>
              <div>
                <b>{review.user || review.reviewer}</b>
                <small>{review.email || "No email"} · {fmtDate(review.date)}</small>
              </div>
            </div>
            <div className="review-rating-block">
              <Stars value={review.rating} />
              <span className="review-rating-num">★ {review.rating}/5</span>
            </div>
            {review.isVerifiedPurchase && (
              <span className="verified-chip">✓ Verified purchase · Order {String(review.orderId||"").slice(-6).toUpperCase() || "—"}</span>
            )}
          </div>
        </div>

        <div className="review-product-line">
          <span className="eyebrow">PRODUCT</span>
          <b>{review.product}</b>
        </div>

        <div className="review-body">
          <span className="eyebrow">CUSTOMER REVIEW</span>
          <p>{review.comment || review.review || "No written review."}</p>
        </div>

        {review.vendorReply && (
          <div className="review-vendor-reply">
            <span className="eyebrow">YOUR RESPONSE · {fmtDate(review.vendorRepliedAt)}</span>
            <p>{review.vendorReply}</p>
          </div>
        )}

        <div className="review-respond">
          <span className="eyebrow">{review.vendorReply ? "UPDATE YOUR RESPONSE" : "POST YOUR OFFICIAL RESPONSE"}</span>
          <textarea
            className="field-textarea"
            rows="4"
            placeholder="Respond to this customer's review…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="modal-actions">
            <button className="outline-btn" onClick={onClose}>Close</button>
            <button
              className="gradient-btn"
              disabled={!reply.trim() || saving}
              onClick={() => onSaveReply(review.id, reply)}
            >
              {saving ? "Saving…" : review.vendorReply ? "Update Response" : "Post Response"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AbuseDetailsModal({ report, onClose }) {
  if (!report) return null;
  return (
    <Modal open={!!report} onClose={onClose} title="ABUSE REPORT" subtitle={report.reportNumber || "Report details"} wide>
      <div className="abuse-detail">
        <div className="abuse-overview-grid">
          <div className="abuse-field"><span className="eyebrow">TARGET USER / STORE</span><b>{report.targetUser || "—"}</b><small>{report.store?.name || ""}</small></div>
          <div className="abuse-field"><span className="eyebrow">REPORTED ROLE</span><b>{report.targetRole || "—"}</b></div>
          <div className="abuse-field"><span className="eyebrow">INCIDENT DATE</span><b>{fmtDate(report.incidentDate)}</b></div>
          <div className="abuse-field">
            <span className="eyebrow">CATEGORY</span>
            <span><StatusBadge status={report.reasonCategory} /></span>
          </div>
          {report.order && <div className="abuse-field"><span className="eyebrow">RELATED ORDER</span><b>{report.order.orderNumber}</b><small>{report.order.total ? money(report.order.total) : ""}</small></div>}
          <div className="abuse-field"><span className="eyebrow">STATUS</span><span><StatusBadge status={report.status} /></span></div>
        </div>

        <div className="review-body">
          <span className="eyebrow">EXPLANATION</span>
          <p>{report.description || "No description provided."}</p>
        </div>

        {Array.isArray(report.evidenceUrls) && report.evidenceUrls.length > 0 && (
          <div className="editor-section">
            <span className="eyebrow">EVIDENCE ATTACHMENTS</span>
            <div className="media-grid">
              {report.evidenceUrls.map((img, i) => (
                <a className="media-thumb" href={img} target="_blank" rel="noreferrer" key={i}>
                  <img src={img} alt={`Evidence ${i + 1}`} />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="abuse-admin-notes">
          <span className="eyebrow">ADMIN STATUS TRACKING</span>
          {report.adminNotes ? (
            <p>{report.adminNotes}</p>
          ) : (
            <p className="muted">No administrative notes yet. Your report is under review.</p>
          )}
          {report.status === "RESOLVED" && <span className="verified-chip">Resolved</span>}
        </div>

        <div className="modal-actions">
          <button className="outline-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function SubmitAbuseReportModal({ open, onClose, onSubmit, submitting }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [errors, setErrors] = useState({});
  const { data: searchRes, isFetching } = useUserSearch(q);
  const results = searchRes?.data || [];

  useEffect(() => {
    if (!open) {
      setQ("");
      setSelected(null);
      setReasonCategory("");
      setDescription("");
      setEvidence([]);
      setErrors({});
    }
  }, [open]);

  const handleSelect = (r) => {
    setSelected(r);
    setQ(r.label);
    setDropdownOpen(false);
  };

  const submit = () => {
    const errs = {};
    if (!selected) errs.target = "Please select a target user, store, or order.";
    if (!reasonCategory) errs.reasonCategory = "Reason category is required.";
    if (!description.trim()) errs.description = "Incident description is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    onSubmit({
      targetUserId: selected.targetUserId,
      reasonCategory,
      description: description.trim(),
      evidenceUrls: evidence,
      ...(selected.orderId && { relatedOrderId: selected.orderId }),
      ...(selected.store?.id && { targetStoreId: selected.store.id }),
      ...(selected.role && { targetRole: selected.role }),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="SUBMIT ABUSE REPORT" subtitle="Report a user or store to platform moderation" wide>
      <div className="abuse-form">
        <label className="field">
          <span>Target user / store / order *</span>
          <div className="search-combobox">
            <div className="dash-filter" style={{ width: "100%" }}>
              <Icon name="search" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSelected(null); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="Search by name, store name, or order id…"
              />
            </div>
            {dropdownOpen && (
              <div className="search-dropdown">
                {isFetching && <div className="search-dropdown-item muted">Searching…</div>}
                {!isFetching && results.length === 0 && (
                  <div className="search-dropdown-item muted">{q.trim().length < 2 ? "Type at least 2 characters to search." : "No matches found."}</div>
                )}
                {results.slice(0, 8).map((r, i) => (
                  <button
                    key={`${r.kind}-${r.targetUserId}-${i}`}
                    type="button"
                    className="search-dropdown-item"
                    onMouseDown={() => handleSelect(r)}
                  >
                    <b>{r.label}</b>
                    <small>{r.subtitle}</small>
                    <em>{r.kind}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selected && <small className="field-hint">✓ {selected.label} selected ({selected.kind})</small>}
          {errors.target && <small className="field-error">{errors.target}</small>}
        </label>

        <label className="field">
          <span>Reason category *</span>
          <select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
            <option value="">Select a reason…</option>
            {["FRAUDULENT_ACTIVITY", "HARASSMENT_OR_ABUSE", "NON_COMPLIANT_PRODUCT_OR_ORDER", "OTHER_POLICY_VIOLATION"].map((c) => (
              <option key={c} value={c}>{reasonLabel(c)}</option>
            ))}
          </select>
          {errors.reasonCategory && <small className="field-error">{errors.reasonCategory}</small>}
        </label>

        <label className="field">
          <span>Incident description *</span>
          <textarea
            className="field-textarea"
            rows="5"
            maxLength="2000"
            placeholder="Explain the violation in detail…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {errors.description && <small className="field-error">{errors.description}</small>}
        </label>

        <div className="field">
          <span>Evidence files (optional)</span>
          <label className="upload-zone">
            <b>+ Attach screenshots / documents</b>
            <small>Click to upload, one or many files</small>
            <input type="file" accept="image/*" multiple onChange={(e) => fileToDataURLs(e.target.files, (added) => { if (!added.length) return; setEvidence((prev) => [...prev, ...added].slice(0, 10)); })} />
          </label>
          {evidence.length > 0 && (
            <div className="media-grid">
              {evidence.map((img, i) => (
                <div className="media-thumb" key={i}>
                  <img src={img} alt="" />
                  <button type="button" title="Remove" onClick={() => setEvidence((prev) => prev.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="outline-btn" onClick={onClose}>Cancel</button>
          <button className="gradient-btn" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Abuse Report"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VendorReports(){
  const [tab,setTab]=useState('reviews');
  const [dateRange,setDateRange]=useState('30');
  const toast=useToast();
  const queryClient=useQueryClient();

  const {data:reviewsRes}=useVendorReviews();
  const reviews=useMemo(()=>(Array.isArray(reviewsRes?.data)?reviewsRes.data:[]),[reviewsRes]);

  const {data:abuseRes}=useAbuseReports();
  const abuses=useMemo(()=>(Array.isArray(abuseRes?.data)?abuseRes.data:[]),[abuseRes]);

  const avgRating=useMemo(()=>{
    if(!reviews.length) return "0.0";
    return (reviews.reduce((s,r)=>s+(Number(r.rating)||0),0)/reviews.length).toFixed(1);
  },[reviews]);

  const replyMutation=useReviewReply();
  const submitMutation=useSubmitAbuseReport();

  const [detailsReview,setDetailsReview]=useState(null);
  const [detailsReport,setDetailsReport]=useState(null);
  const [submitOpen,setSubmitOpen]=useState(false);

  const saveReply=async(id,reply)=>{
    try{
      await replyMutation.mutateAsync({id,reply});
      toast.success('Response posted to the customer review.');
      setDetailsReview(null);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const submitReport=async(payload)=>{
    try{
      await submitMutation.mutateAsync(payload);
      toast.success('Abuse report submitted. Our team will investigate.');
      setSubmitOpen(false);
      queryClient.invalidateQueries({queryKey:queryKeys.abuseReports});
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const reviewColumns=[
    {key:'date',label:'Date',render:r=><span>{fmtDate(r.date)}</span>},
    {key:'user',label:'Customer',render:r=><b>{r.user||r.reviewer||'—'}</b>},
    {key:'product',label:'Product Name',render:r=>r.product},
    {key:'rating',label:'Star Rating',render:r=><Stars value={r.rating}/>},
    {key:'comment',label:'Comment Snippet',render:r=><span className="snippet">{(r.comment||r.review||'').slice(0,60)}{(r.comment||r.review||'').length>60?'…':''}</span>},
  ];

  const abuseColumns=[
    {key:'reportNumber',label:'Report ID',render:r=><b>{r.reportNumber||String(r.id||'').slice(-6).toUpperCase()}</b>},
    {key:'targetUser',label:'Target User / Store',render:r=><div><b>{r.targetUser||'—'}</b>{r.store?.name&&<small className="muted"> · {r.store.name}</small>}</div>},
    {key:'incidentDate',label:'Incident Date',render:r=><span>{fmtDate(r.incidentDate)}</span>},
    {key:'reasonCategory',label:'Reason Category',render:r=><StatusBadge status={r.reasonCategory}/>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SELLER PLATFORM</span>
          <h1>Reports</h1>
          <p>Customer reviews, abuse reports and policy notices.</p>
        </div>
        {tab==='abuse'&&(
          <button className="gradient-btn" onClick={()=>setSubmitOpen(true)}><Icon name="plus"/> Submit Abuse Report</button>
        )}
      </div>

      {tab==='reviews'&&(
        <div className="rating-banner">
          <div className="rating-banner-stars"><Stars value={avgRating}/></div>
          <div className="rating-banner-num"><strong>{avgRating}</strong><span> / 5.0</span></div>
          <div className="rating-banner-meta"><b>{reviews.length} customer review{reviews.length===1?'':'s'}</b><span>Overall vendor rating from verified purchases</span></div>
        </div>
      )}

      <TabGroup tabs={[{key:'reviews',label:'Customer Reviews',count:reviews.length},{key:'abuse',label:'Abuse Reports',count:abuses.length},{key:'warnings',label:'Policy Warnings'}]} activeTab={tab} onTabChange={setTab}/>

      {tab==='reviews'&&(
        <DataTable
          columns={reviewColumns}
          rows={reviews}
          rowKey={r=>r.id}
          actions={r=>(
            <>
              <button className="table-action-btn" onClick={()=>setDetailsReview(r)}>View Details</button>
            </>
          )}
          emptyText="No customer reviews yet."
        />
      )}

      {tab==='abuse'&&(
        <DataTable
          columns={abuseColumns}
          rows={abuses}
          rowKey={r=>r.id}
          actions={r=>(
            <>
              <button className="table-action-btn" onClick={()=>setDetailsReport(r)}>View Details</button>
            </>
          )}
          emptyText="No abuse reports submitted."
        />
      )}

      {tab==='warnings'&&(
        <div className="data-card">
          <div className="data-row table-empty">No policy warnings available through the API yet.</div>
        </div>
      )}

      <ReviewDetailsModal review={detailsReview} onClose={()=>setDetailsReview(null)} onSaveReply={saveReply} saving={replyMutation.isPending}/>
      <AbuseDetailsModal report={detailsReport} onClose={()=>setDetailsReport(null)}/>
      <SubmitAbuseReportModal open={submitOpen} onClose={()=>setSubmitOpen(false)} onSubmit={submitReport} submitting={submitMutation.isPending}/>
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
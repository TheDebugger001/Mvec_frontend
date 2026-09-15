import {useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import SmartTable from '../components/SmartTable';
import ModernDataTable from '../components/DataTable';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from '../services/analytics';
import {useToast} from '../components/Toast';
import {useUsers,useUpdateUser,mapUserRow} from '../hooks/useUsers';
import {useAllProducts} from '../hooks/useProducts';
import {useAllOrders} from '../hooks/useOrders';
import {queryKeys} from '../queryClient';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seedUsers=[
  {id:'USR-001',name:'Aline Uwase',email:'buyer@mvec.rw',role:'Buyer',status:'Active',phone:'+250788100001'},
  {id:'USR-002',name:'Eric Mugabo',email:'vendor@mvec.rw',role:'Vendor',status:'Active',phone:'+250788100002'},
  {id:'USR-003',name:'Jean Paul',email:'jean@mvec.rw',role:'Buyer',status:'Active',phone:'+250788100003'},
  {id:'USR-004',name:'MVEC Admin',email:'admin@mvec.rw',role:'Super Admin',status:'Active',phone:'+250788100004'},
  {id:'USR-005',name:'Diane Mukamana',email:'diane@mvec.rw',role:'Buyer',status:'Active',phone:'+250788100005'},
  {id:'USR-006',name:'Patrick Niyonzima',email:'patrick@mvec.rw',role:'Vendor',status:'Suspended',phone:'+250788100006'},
  {id:'USR-007',name:'Grace Uwimana',email:'grace@mvec.rw',role:'Supplier',status:'Active',phone:'+250788100007'},
  {id:'USR-008',name:'Kevin Mugisha',email:'kevin@mvec.rw',role:'Affiliate',status:'Active',phone:'+250788100008'},
];
const seedVendors=[
  {id:1,name:'Kigali Tech Store',category:'Electronics',products:148,rating:4.9,status:'Active',owner:'Eric Mugabo'},
  {id:2,name:'Smart Hub Rwanda',category:'Phones',products:82,rating:4.8,status:'Active',owner:'Jean Paul'},
  {id:3,name:'HomeStyle Kigali',category:'Home & Living',products:67,rating:4.8,status:'Active',owner:'Grace Uwimana'},
  {id:4,name:'Urban Closet',category:'Fashion',products:92,rating:4.7,status:'Pending',owner:'Diane Mukamana'},
  {id:5,name:'Glow Beauty',category:'Beauty',products:51,rating:4.6,status:'Active',owner:'Kevin Mugisha'},
];
const seedSuppliers=[
  {id:'SUP-001',name:'Rwanda Wholesale Electronics',category:'Electronics',products:126,rating:4.7,status:'Active',contact:'+250788100009'},
  {id:'SUP-002',name:'Bulk Fashion Hub',category:'Fashion',products:84,rating:4.5,status:'Active',contact:'+250788100010'},
  {id:'SUP-003',name:'HomeGoods Supply Co',category:'Home & Living',products:63,rating:4.6,status:'Pending',contact:'+250788100011'},
];
const seedAffiliates=[
  {id:'AFF-001',name:'Affiliate Marketer 1',email:'aff1@mvec.rw',status:'Active',clicks:8420,conversions:184,earnings:420000},
  {id:'AFF-002',name:'Social Media Promoter',email:'aff2@mvec.rw',status:'Active',clicks:5230,conversions:98,earnings:210000},
  {id:'AFF-003',name:'Blog Reviewer',email:'aff3@mvec.rw',status:'Suspended',clicks:2100,conversions:42,earnings:84000},
];
const seedOrders=[
  {id:'MVEC-10452',buyer:'Aline Uwase',vendor:'Kigali Tech Store',total:850000,payment:'SUCCESS',status:'Delivered',date:'2026-08-26'},
  {id:'MVEC-10451',buyer:'Jean Paul',vendor:'Fashion Rwanda',total:190000,payment:'SUCCESS',status:'Shipped',date:'2026-08-26'},
  {id:'MVEC-10450',buyer:'Diane Mukamana',vendor:'Smart Gadgets',total:185000,payment:'PENDING',status:'Processing',date:'2026-08-27'},
  {id:'MVEC-10449',buyer:'Patrick Niyonzima',vendor:'Home & Living RW',total:320000,payment:'SUCCESS',status:'Confirmed',date:'2026-08-27'},
  {id:'MVEC-10448',buyer:'Grace Uwimana',vendor:'Fashion Rwanda',total:145000,payment:'SUCCESS',status:'Delivered',date:'2026-08-28'},
];
const seedProducts=[
  {id:1,name:'Samsung Galaxy S25',vendor:'Kigali Tech Store',price:850000,stock:25,status:'Published'},
  {id:2,name:'iPhone 16 Pro',vendor:'Kigali Tech Store',price:1450000,stock:12,status:'Published'},
  {id:3,name:'Nike Air Max',vendor:'Fashion Rwanda',price:95000,stock:32,status:'Published'},
  {id:4,name:'Wireless Headphones',vendor:'Smart Gadgets',price:65000,stock:18,status:'Draft'},
  {id:5,name:'Smart Watch',vendor:'Smart Gadgets',price:120000,stock:9,status:'Published'},
];
const seedFeedback=[
  {id:'FB-001',user:'Aline Uwase',target:'Kigali Tech Store',type:'Review',rating:5,text:'Excellent service and fast delivery!',date:'2026-08-26',status:'Approved'},
  {id:'FB-002',user:'Jean Paul',target:'Urban Closet',type:'Review',rating:3,text:'Product quality was average.',date:'2026-08-25',status:'Pending'},
  {id:'FB-003',user:'Diane Mukamana',target:'Smart Gadgets',type:'Complaint',rating:1,text:'Received wrong item.',date:'2026-08-24',status:'Pending'},
];
const seedDisputes=[
  {id:'DSP-001',buyer:'Patrick Niyonzima',vendor:'HomeStyle Kigali',type:'Item not received',amount:320000,status:'Open',date:'2026-08-27'},
  {id:'DSP-002',buyer:'Grace Uwimana',vendor:'Fashion Rwanda',type:'Damaged item',amount:145000,status:'Under Review',date:'2026-08-26'},
  {id:'DSP-003',buyer:'Kevin Mugisha',vendor:'Glow Beauty',type:'Wrong size',amount:56000,status:'Resolved',date:'2026-08-25'},
];

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────

function Metric({label,value,change,icon}){
  return (
    <div className="metric">
      <div className="metric-icon"><Icon name={icon}/></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {change&&<small className="positive">{change}</small>}
      </div>
    </div>
  );
}

function DataTable({columns,rows,rowKey,actions,emptyText='No records found',rowClassName,tableClassName}){
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
    <div className={'data-card'+(tableClassName?' '+tableClassName:'')}>
      <div className="data-card-head">
        <div className="dash-toolbar" style={{width:'100%'}}>
          <div className="dash-filter">
            <Icon name="search"/>
            <input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search…"/>
          </div>
          <span className="table-count">{filtered.length} records</span>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row table-header">
          {safeColumns.map(col=>(
            <span 
              key={col.key} 
              className="table-label sortable"
              onClick={()=>{if(sortKey===col.key)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortKey(col.key);setSortDir('asc');}}}
            >
              {col.label}{sortKey===col.key&&(sortDir==='asc'?' ↑':' ↓')}
            </span>
          ))}
          {actions&&<span className="table-label">Actions</span>}
        </div>
        {shown.length===0?(
          <div className="data-row table-empty">{emptyText}</div>
        ):shown.map((r,i)=>{
          const rc=rowClassName?rowClassName(r):'';
          return(
            <div className={'data-row'+(rc?' '+rc:'')} key={rowKey?rowKey(r,i):i}>
              {safeColumns.map(col=>(
                <span key={col.key}>{col.render?col.render(r):r[col.key]}</span>
              ))}
              {actions&&<span className="row-actions">{actions(r)}</span>}
            </div>
          );
        })}
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

function StatusBadge({status}){
  const cls=['Active','Published','Approved','Completed','Available','Success'].includes(status)?'active':
             ['Suspended','Blocked','Rejected','Cancelled','Failed','Out of stock'].includes(status)?'danger':
             ['Pending','Processing','Draft','Under Review','Open'].includes(status)?'warning':
             status==='Investigation'?'investigation':'';
  return <em className={'status '+cls}>{status}</em>;
}

// ─── ADMIN OVERVIEW ───────────────────────────────────────────────────────────

function AdminOverview(){
  const [chartPeriod,setChartPeriod]=useState('30');
  const [activeTab,setActiveTab]=useState('orders');
  const chartKey=chartPeriod==='7'?'7 Days':chartPeriod==='30'?'30 Days':chartPeriod==='90'?'3 Months':'1 Year';
  const chart=getPeriodChart(chartKey);
  const labels=getPeriodLabels(chartKey);
  const periodMetrics=getPeriodMetrics(chartKey);
  const toast=useToast();
  const queryClient=useQueryClient();
  
  const [orders,setOrders]=useState(seedOrders);
  const [vendorsList,setVendorsList]=useState(seedVendors);
  const [suppliersList,setSuppliersList]=useState(seedSuppliers);
  const [affiliatesList,setAffiliatesList]=useState(seedAffiliates);
  const [productsList,setProductsList]=useState(seedProducts);

  // TanStack Query: users
  const {data:usersRes,isLoading:usersLoading}=useUsers({limit:200});
  const usersList=useMemo(()=>{
    if(usersRes?.data?.length)return usersRes.data.map(mapUserRow);
    return seedUsers;
  },[usersRes]);

  // TanStack Query: products (falls back to seed)
  const {data:productsRes}=useAllProducts({limit:200});
  useEffect(()=>{
    if(productsRes?.data?.length){
      setProductsList(productsRes.data.map(p=>({id:p._id||p.id||`PRD-${Date.now()}`,name:p.name||'',vendor:p.vendor?.name||p.vendor||'',price:Number(p.price||p.discountPrice)||0,stock:p.stockQuantity??p.stock??0,status:p.status||'Active'})));
    }
  },[productsRes]);

  // TanStack Query: orders
  const {data:ordersRes}=useAllOrders();
  useEffect(()=>{
    const list=ordersRes?.data||(Array.isArray(ordersRes)?ordersRes:null);
    if(list?.length){
      setOrders(list.map(o=>({id:o.orderNumber||o.orderId||o._id||`MVEC-${Date.now()}`,buyer:o.user?.name||o.buyer||'',vendor:o.vendor?.name||o.vendorName||'',total:Number(o.totalAmount||o.grandTotal||o.total)||0,payment:o.paymentStatus||'SUCCESS',status:o.status||'Processing',date:o.createdAt?.slice?.(0,10)||''})));
    }
  },[ordersRes]);

  // Product actions (mutations invalidate cache)
  const unpublishProduct=(p)=>{
    setProductsList(prev=>prev.map(x=>x.id===p.id?{...x,status:'Unpublished'}:x));
    queryClient.invalidateQueries({queryKey:queryKeys.products});
    toast.info(`${p.name} unpublished.`);
  };
  const deleteProduct=(p)=>{
    setProductsList(prev=>prev.filter(x=>x.id!==p.id));
    queryClient.invalidateQueries({queryKey:queryKeys.products});
    toast.success(`${p.name} deleted.`);
  };

  const tabItems=[
    {key:'orders',label:'Live Orders',count:orders.length},
    {key:'buyers',label:'Buyers',count:usersList.filter(u=>u.role==='Buyer').length},
    {key:'vendors',label:'Vendors',count:vendorsList.length},
    {key:'suppliers',label:'Suppliers',count:suppliersList.length},
    {key:'affiliates',label:'Affiliates',count:affiliatesList.length},
    {key:'products',label:'Products',count:productsList.length},
  ];

  const buyerColumns=[
    {key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const vendorColumns=[
    {key:'name',label:'Store'},{key:'category',label:'Category'},{key:'products',label:'Products'},
    {key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const supplierColumns=[
    {key:'name',label:'Supplier'},{key:'category',label:'Category'},{key:'products',label:'Products'},
    {key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const affiliateColumns=[
    {key:'name',label:'Affiliate'},{key:'email',label:'Email'},{key:'clicks',label:'Clicks'},
    {key:'conversions',label:'Conversions'},{key:'earnings',label:'Earnings',render:r=>money(r.earnings)},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const orderColumns=[
    {key:'id',label:'Order'},{key:'buyer',label:'Buyer'},{key:'vendor',label:'Vendor'},
    {key:'total',label:'Total',render:r=>money(r.total)},
    {key:'payment',label:'Payment',render:r=><StatusBadge status={r.payment}/>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const productColumns=[
    {key:'name',label:'Product'},{key:'vendor',label:'Vendor'},{key:'price',label:'Price',render:r=>money(r.price)},
    {key:'stock',label:'Stock'},{key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  const getTabData=()=>{
    switch(activeTab){
      case 'buyers':return {columns:buyerColumns,rows:usersList.filter(u=>u.role==='Buyer')};
      case 'vendors':return {columns:vendorColumns,rows:vendorsList};
      case 'suppliers':return {columns:supplierColumns,rows:suppliersList};
      case 'affiliates':return {columns:affiliateColumns,rows:affiliatesList};
      case 'products':return {columns:productColumns,rows:productsList};
      default:return {columns:orderColumns,rows:orders};
    }
  };

  const {columns,rows}=getTabData();

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">SUPER ADMIN DASHBOARD</span>
          <h1>Platform Overview</h1>
          <p>Monitor the entire MVEC marketplace from one control center.</p>
        </div>
        <select value={chartPeriod} onChange={e=>setChartPeriod(e.target.value)} className="period-select">
          <option value="7">7 Days</option>
          <option value="30">30 Days</option>
          <option value="90">3 Months</option>
          <option value="365">1 Year</option>
        </select>
      </div>

      <div className="metric-grid">
        <Metric label="Gross Revenue" value={money(periodMetrics.sales)} change={`${chartKey} revenue`} icon="chart"/>
        <Metric label="Active Orders" value={periodMetrics.orders} change={`${chartKey} orders`} icon="cart"/>
        <Metric label="SLA Breaches" value="3" change="Needs attention" icon="bell"/>
        <Metric label="Net Commission" value={money(Math.round(periodMetrics.sales*0.05))} change={`${chartKey} commission`} icon="wallet"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head">
            <div><h3>Revenue Trend</h3><span>{chartKey} performance</span></div>
          </div>
          <div className="fake-chart">
            {chart.map((height,index)=>(
              <div key={index} style={{height:`${height}%`}}>
                <span>{labels[index]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="data-card">
          <div className="data-card-head"><div><h3>Quick Stats</h3><span>Platform health</span></div></div>
          {[
            ['Vendor approvals','6 pending','warning'],
            ['Product moderation','14 pending','warning'],
            ['Payment success','96.8%','active'],
            ['Disputes','3 open','warning'],
          ].map(item=>(
            <div className="activity-row" key={item[0]}>
              <div><b>{item[0]}</b><small>Marketplace operations</small></div>
              <em className={`status ${item[2]}`}>{item[1]}</em>
            </div>
          ))}
        </div>
      </div>

      <TabGroup tabs={tabItems} activeTab={activeTab} onTabChange={setActiveTab}/>
      
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r=>r.id||r.email||r.name}
        actions={activeTab==='products'?(r)=>(
          <>
            <button className="table-action-btn" title="Unpublish" onClick={()=>unpublishProduct(r)}>
              <Icon name="box"/>
            </button>
            <button className="table-action-btn danger" title="Delete" onClick={()=>deleteProduct(r)}>
              <Icon name="trash"/>
            </button>
          </>
        ):activeTab==='buyers'||activeTab==='vendors'?(r)=>(
          <span className={`status-chip ${r.status==='Suspended'?'danger':'active'}`}>{r.status}</span>
        ):null}
      />
    </>
  );
}

// ─── ADMIN WALLET & LEDGER ────────────────────────────────────────────────────

function AdminWallet(){
  const toast=useToast();
  const [tab,setTab]=useState('overview');
  const [ledger,setLedger]=useState([
    {id:'LED-001',actor:'Kigali Tech Store',email:'ops@kigalitech.rw',role:'Vendor',txType:'Escrow Release',from:'Escrow Account',to:'Vendor - Kigali Tech Store',amount:765000,type:'Release',status:'Released',date:'2026-08-27'},
    {id:'LED-002',actor:'Fashion Rwanda',email:'accounts@fashionrwanda.rw',role:'Vendor',txType:'Escrow Release',from:'Escrow Account',to:'Vendor - Fashion Rwanda',amount:171000,type:'Release',status:'Released',date:'2026-08-28'},
    {id:'LED-003',actor:'Smart Gadgets',email:'finance@smartgadgets.rw',role:'Vendor',txType:'Commission',from:'Escrow Account',to:'Commission Pool',amount:9200,type:'Commission',status:'Recorded',date:'2026-08-30'},
    {id:'LED-004',actor:'FarmFresh Suppliers',email:'payments@farmfresh.rw',role:'Supplier',txType:'Payout',from:'Escrow Account',to:'Supplier - FarmFresh Suppliers',amount:420000,type:'Payout',status:'Pending',date:'2026-08-29'},
    {id:'LED-005',actor:'Kigali Tech Store',email:'ops@kigalitech.rw',role:'Vendor',txType:'Payout',from:'Escrow Account',to:'Vendor - Kigali Tech Store',amount:612000,type:'Payout',status:'Processing',date:'2026-08-31'},
    {id:'LED-006',actor:'Aline Uwase',email:'aline@example.com',role:'Buyer',txType:'Deposit',from:'Buyer - Aline Uwase',to:'Escrow Account',amount:850000,type:'Deposit',status:'Held',date:'2026-08-26'},
    {id:'LED-007',actor:'Jean Paul',email:'jp@example.com',role:'Buyer',txType:'Deposit',from:'Buyer - Jean Paul',to:'Escrow Account',amount:190000,type:'Deposit',status:'Held',date:'2026-08-26'},
    {id:'LED-008',actor:'Platform',email:'',role:'Platform',txType:'Commission',from:'Platform',to:'Commission Pool',amount:85000,type:'Commission',status:'Recorded',date:'2026-08-27'},
  ]);
  const [payouts,setPayouts]=useState([
    {id:'PAY-001',vendor:'Kigali Tech Store',amount:765000,method:'Bank Transfer',status:'Completed',date:'2026-08-27'},
    {id:'PAY-002',vendor:'Fashion Rwanda',amount:171000,method:'MTN MoMo',status:'Processing',date:'2026-08-28'},
    {id:'PAY-003',vendor:'Smart Gadgets',amount:92000,method:'Bank Transfer',status:'Pending',date:'2026-08-28'},
  ]);
  const [holdModal,setHoldModal]=useState(null);
  const [holdReason,setHoldReason]=useState('');
  const [ledgerFilter,setLedgerFilter]=useState('all');

  const escrowTotal=ledger.filter(l=>['Held','Pending','Processing'].includes(l.status)).reduce((s,l)=>s+l.amount,0);
  const releasedTotal=ledger.filter(l=>['Released','Completed'].includes(l.status)).reduce((s,l)=>s+l.amount,0);
  const commissionTotal=ledger.filter(l=>l.type==='Commission').reduce((s,l)=>s+l.amount,0);

  const ledgerFilters=[
    {key:'all',label:'All transactions'},
    {key:'release',label:'Escrow Release',filter:list=>list.filter(l=>l.txType==='Escrow Release')},
    {key:'payout',label:'Payout',filter:list=>list.filter(l=>l.txType==='Payout')},
    {key:'commission',label:'Commission',filter:list=>list.filter(l=>l.txType==='Commission')},
  ];

  const deleteLedger=(sel)=>{
    const ids=new Set(sel.map(r=>r.id));
    if(!ids.size)return;
    setLedger(l=>l.filter(x=>!ids.has(x.id)));
    toast.success(`${ids.size} ledger entr${ids.size>1?'ies':'y'} removed.`);
  };

  const executeHold=(payout)=>{
    if(!holdReason.trim()){toast.error('Please provide a reason.');return;}
    setPayouts(prev=>prev.map(x=>x.id===payout.id?{...x,status:'On Hold',holdReason}:x));
    toast.success(`Hold placed on ${payout.id}.`);
    setHoldModal(null);
    setHoldReason('');
  };

  const releasePayout=(payout)=>{
    setPayouts(prev=>prev.map(x=>x.id===payout.id?{...x,status:'Completed'}:x));
    toast.success(`${payout.id} released.`);
  };

  const ledgerColumns=[
    {key:'role',label:'Role'},
    {key:'txType',label:'Transaction Type'},
    {key:'amount',label:'Amount',align:'right',render:r=>money(r.amount)},
    {key:'date',label:'Date'},
  ];
  const payoutColumns=[
    {key:'id',label:'Payout'},{key:'vendor',label:'Vendor'},{key:'amount',label:'Amount',align:'right',render:r=>money(r.amount)},
    {key:'method',label:'Method'},{key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">ADMIN CONTROL</span>
          <h1>Wallet & Ledger</h1>
          <p>Escrow, revenue, payouts and double-entry audit trail.</p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Escrow Locked" value={money(escrowTotal)} change="Held for delivery" icon="wallet"/>
        <Metric label="Net Revenue" value={money(commissionTotal)} change="Platform commission" icon="chart"/>
        <Metric label="Pending Payouts" value={payouts.filter(p=>p.status==='Pending').length} change="Awaiting processing" icon="cart"/>
        <Metric label="Released" value={money(releasedTotal)} change="Completed settlements" icon="check"/>
      </div>

      <TabGroup 
        tabs={[{key:'overview',label:'Escrow & Revenue'},{key:'payouts',label:'Payout Requests',count:payouts.filter(p=>p.status!=='Completed').length},{key:'ledger',label:'Ledger Audit Trail'}]}
        activeTab={tab} 
        onTabChange={setTab}
      />

      {tab==='overview'&&(
        <div className="dash-grid">
          <div className="data-card">
            <h3>Escrow Holdings</h3>
            {ledger.filter(l=>l.status==='HELD').map(l=>(
              <div className="activity-row" key={l.id}>
                <div><b>{l.id}</b><small>{l.from} → {l.to}</small></div>
                <strong>{money(l.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="data-card">
            <h3>Recent Releases</h3>
            {ledger.filter(l=>l.status==='RELEASED').slice(0,3).map(l=>(
              <div className="activity-row" key={l.id}>
                <div><b>{l.id}</b><small>{l.to}</small></div>
                <strong>{money(l.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='payouts'&&(
        <ModernDataTable
          columns={payoutColumns}
          rows={payouts}
          rowKey={r=>r.id}
          avatar={r=>({name:r.vendor,subtitle:r.method})}
          searchKeys={['id','vendor','method','status']}
          searchPlaceholder="Search vendor, payout ID…"
          actions={r=>(
            <>
              {r.status==='Pending'&&<button className="table-action-btn" title="Approve" onClick={()=>releasePayout(r)}><Icon name="check"/></button>}
              {(r.status==='Pending'||r.status==='Processing')&&<button className="table-action-btn danger" title="Hold" onClick={()=>setHoldModal(r)}><Icon name="lock"/></button>}
            </>
          )}
          onBulkDelete={sel=>{
            const ids=new Set(sel.map(x=>x.id));
            setPayouts(p=>p.filter(x=>!ids.has(x.id)));
            toast.success(`${ids.size} payout${ids.size>1?'s':''} removed.`);
          }}
        />
      )}

      {tab==='ledger'&&(
        <ModernDataTable
          columns={ledgerColumns}
          rows={ledger}
          rowKey={r=>r.id}
          filters={ledgerFilters}
          activeFilter={ledgerFilter}
          onFilterChange={setLedgerFilter}
          avatar={r=>({name:r.actor,subtitle:r.email||r.role})}
          status={r=>r.status}
          searchKeys={['actor','email','role','txType','id','status']}
          searchPlaceholder="Search by username, email, transaction…"
          sortableColumns={[{key:'amount',label:'Amount'},{key:'date',label:'Date'},{key:'status',label:'Status'}]}
          onBulkDelete={deleteLedger}
        />
      )}

      <Modal open={!!holdModal} onClose={()=>setHoldModal(null)} title="ADMINISTRATIVE HOLD" subtitle={`Hold funds for ${holdModal?.id}?`}>
        <p>Place an administrative hold on this payout during fraud checks or active disputes.</p>
        <label className="field"><span>Reason for hold *</span><textarea value={holdReason} onChange={e=>setHoldReason(e.target.value)} rows="3" required placeholder="Enter the reason for placing this hold…"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setHoldModal(null)}>Cancel</button>
          <button className="danger-btn" onClick={()=>executeHold(holdModal)}>Place Hold</button>
        </div>
      </Modal>
    </>
  );
}

// ─── ADMIN USERS & STORES ─────────────────────────────────────────────────────

const STATUS_OPTIONS=[
  {value:'Active',color:'#15815e',hoverBg:'#eafaf4'},
  {value:'Suspended',color:'#b56a00',hoverBg:'#fff3e0'},
  {value:'Blocked',color:'#d64545',hoverBg:'#fdf0f0'},
  {value:'Investigation',color:'#6b7780',hoverBg:'#f0f2f3'},
];
const STATUS_ITEM_BG={Active:'bg-emerald-50',Suspended:'bg-orange-50',Blocked:'bg-rose-50',Investigation:'bg-slate-100'};

function StatusDropdown({currentStatus,onSave}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    if(!open)return;
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[open]);

  const cur=STATUS_OPTIONS.find(o=>o.value===currentStatus)||STATUS_OPTIONS[0];

  return (
    <div className="relative z-[90] w-[140px]" ref={ref}>
      <button
        className={'flex h-[34px] w-full cursor-pointer items-center gap-2 rounded-md border bg-white px-2.5 text-xs font-semibold text-[#16252d] transition-colors duration-150 '+(open?'border-[#b7d8e4]':'border-[#d8dfe6] hover:border-[#b7d8e4]')}
        onClick={()=>setOpen(!open)}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{background:cur.color}}/>
        <span className="flex-1 truncate text-left">{currentStatus}</span>
        <span className="flex items-center text-[#71808a]"><Icon name="chevron" size={12}/></span>
      </button>
      {open&&(
        <div className="absolute left-0 top-[calc(100%+6px)] z-[90] flex w-[200px] flex-col rounded-[10px] border border-[#d8dfe6] bg-white p-1.5 shadow-[0_12px_32px_rgba(23,84,105,0.14)]">
          {STATUS_OPTIONS.map(opt=>(
            <button
              key={opt.value}
              className={'flex h-10 w-full cursor-pointer items-center rounded-[7px] px-3 text-left text-[12.5px] font-medium text-[#16252d] transition-colors duration-150 hover:bg-[#f3f4f6]'+(opt.value===currentStatus?' font-bold '+(STATUS_ITEM_BG[opt.value]||'bg-[#f0f2f3]'):'')}
              onClick={()=>{onSave(opt.value);setOpen(false)}}
            >
              {opt.value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminUsers(){
  const [tab,setTab]=useState('buyers');
  const toast=useToast();
  const [vendorsList,setVendorsList]=useState(seedVendors);
  const [suppliersList,setSuppliersList]=useState(seedSuppliers);
  const [affiliatesList,setAffiliatesList]=useState(seedAffiliates);
  const [pendingChanges,setPendingChanges]=useState({});
  const [statusFilter,setStatusFilter]=useState('All');
  const [confirmSaveOpen,setConfirmSaveOpen]=useState(false);

  // TanStack Query: users (auto-refetch + shared cache with AdminOverview)
  const {data:usersRes}=useUsers({limit:200});
  const usersList=useMemo(()=>{
    if(usersRes?.data?.length)return usersRes.data.map(mapUserRow);
    return seedUsers;
  },[usersRes]);

  const stageChange=(id,newStatus)=>{
    setPendingChanges(prev=>({...prev,[id]:newStatus}));
  };

  const queryClient=useQueryClient();
  const updateUser=useUpdateUser();

  const applyChanges=async()=>{
    const ids=Object.keys(pendingChanges);
    if(!ids.length)return;
    for(const id of ids){
      try{await updateUser.mutateAsync({id,payload:{status:pendingChanges[id]}});}
      catch{}
    }
    // Write the new statuses straight into the users cache so the table text
    // updates instantly without waiting for a background refetch.
    queryClient.setQueryData(queryKeys.users,(old)=>{
      const patch=new Map();
      Object.entries(pendingChanges).forEach(([id,s])=>patch.set(id,s));
      const apply=list=>Array.isArray(list)?list.map(u=>{
        const uid=String(u.id||u._id);
        return patch.has(uid)?{...u,status:patch.get(uid)}:u;
      }):list;
      if(old?.data)return {...old,data:apply(old.data)};
      return apply(old);
    });
    queryClient.invalidateQueries({queryKey:queryKeys.users});
    toast.success(`${ids.length} status change${ids.length>1?'s':''} saved.`);
    setPendingChanges({});
  };

  const getEffectiveStatus=(r)=>pendingChanges[r.id]||r.status;

  const buyerColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},
  ];
  const vendorColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Store'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
  ];
  const supplierColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Supplier'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
  ];
  const affiliateColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Affiliate'},{key:'email',label:'Email'},
    {key:'clicks',label:'Clicks'},{key:'conversions',label:'Conversions'},
  ];

  const deleteSelected=(sel)=>{
    const keys=new Set(sel.map(r=>r.id||r.email));
    if(!keys.size)return;
    queryClient.invalidateQueries({queryKey:queryKeys.users});
    toast.success(`${keys.size} account${keys.size>1?'s':''} deleted.`);
  };

  const getTabData=()=>{
    const filter=list=>statusFilter==='All'?list:list.filter(r=>getEffectiveStatus(r)===statusFilter);
    switch(tab){
      case 'buyers':return {columns:buyerColumns,rows:filter(usersList.filter(u=>u.role==='Buyer'))};
      case 'vendors':return {columns:vendorColumns,rows:filter(vendorsList)};
      case 'suppliers':return {columns:supplierColumns,rows:filter(suppliersList)};
      case 'affiliates':return {columns:affiliateColumns,rows:filter(affiliatesList)};
      default:return {columns:buyerColumns,rows:filter(usersList.filter(u=>u.role==='Buyer'))};
    }
  };

  const {columns,rows}=getTabData();
  const hasPending=Object.keys(pendingChanges).length>0;

  const statusFilterBar=(
    <div className="status-filter-bar">
      {['All','Active','Suspended','Blocked','Investigation'].map(s=>{
        const opt=STATUS_OPTIONS.find(o=>o.value===s);
        return(
          <button
            key={s}
            className={'status-filter-btn'+(statusFilter===s?' active':'')}
            style={opt?{'--sf-color':opt.color}:{}}
            onClick={()=>setStatusFilter(s)}
          >
            {opt&&<span className="status-dot" style={{background:opt.color}}/>}
            {s}
          </button>
        );
      })}
      {hasPending&&(
        <button className="status-save-btn" onClick={()=>setConfirmSaveOpen(true)}>
          <Icon name="check"/>
          <span>Save {Object.keys(pendingChanges).length} change{Object.keys(pendingChanges).length>1?'s':''}</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">ADMIN CONTROL</span>
          <h1>Users & Stores</h1>
          <p>Manage marketplace accounts by role category.</p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Buyers" value={usersList.filter(u=>u.role==='Buyer').length} change="Active accounts" icon="users"/>
        <Metric label="Vendors" value={vendorsList.length} change="Active stores" icon="shop"/>
        <Metric label="Suppliers" value={suppliersList.length} change="Wholesale partners" icon="box"/>
        <Metric label="Affiliates" value={affiliatesList.length} change="Marketing partners" icon="users"/>
      </div>

      <TabGroup 
        tabs={[
          {key:'buyers',label:'Buyers',count:usersList.filter(u=>u.role==='Buyer').length},
          {key:'vendors',label:'Vendors',count:vendorsList.length},
          {key:'suppliers',label:'Suppliers',count:suppliersList.length},
          {key:'affiliates',label:'Affiliates',count:affiliatesList.length},
        ]}
        activeTab={tab} 
        onTabChange={(t)=>{setTab(t);setStatusFilter('All')}}
      />

      {statusFilterBar}

      <ModernDataTable
        columns={columns}
        rows={rows}
        rowKey={r=>r.id||r.email}
        avatar={r=>({name:r.name,subtitle:r.email||r.category||r.phone})}
        status={r=>getEffectiveStatus(r)}
        onStatusChange={(value,row)=>stageChange(row.id,value)}
        searchKeys={['id','name','email','phone','category','products']}
        searchPlaceholder="Search users, emails, IDs…"
        onBulkDelete={deleteSelected}
        rowClassName={r=>getEffectiveStatus(r)==='Investigation'?'row-investigation':''}
      />

      <ConfirmDialog
        open={confirmSaveOpen}
        title="Save status changes"
        message="Are you sure you want to save the changes?"
        confirmLabel="OK"
        cancelStyle={{border:'1px solid #dc2626',color:'#dc2626'}}
        onConfirm={()=>{setConfirmSaveOpen(false);applyChanges();}}
        onCancel={()=>setConfirmSaveOpen(false)}
      />
    </>
  );
}

// ─── ADMIN REPORTS & CASES ────────────────────────────────────────────────────

function AdminReports(){
  const [tab,setTab]=useState('feedback');
  const [dateRange,setDateRange]=useState('30');
  const [searchQuery,setSearchQuery]=useState('');
  const toast=useToast();
  const [feedback,setFeedback]=useState(seedFeedback);
  const [disputes,setDisputes]=useState(seedDisputes);
  const [arbitrationModal,setArbitrationModal]=useState(null);

  const moderateFeedback=(fb,newStatus)=>{
    setFeedback(prev=>prev.map(x=>x.id===fb.id?{...x,status:newStatus}:x));
    toast.success(`Feedback ${newStatus.toLowerCase()}.`);
  };

  const resolveDispute=(dispute,resolution)=>{
    setDisputes(prev=>prev.map(x=>x.id===dispute.id?{...x,status:'Resolved',resolution}:x));
    toast.success(`Dispute ${resolution.toLowerCase()}.`);
    setArbitrationModal(null);
  };

  const feedbackColumns=[
    {key:'id',label:'ID'},{key:'user',label:'User'},{key:'target',label:'Target'},
    {key:'type',label:'Type'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'text',label:'Review',render:r=><span title={r.text}>{r.text?.slice(0,40)}…</span>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const disputeColumns=[
    {key:'id',label:'Dispute'},{key:'buyer',label:'Buyer'},{key:'vendor',label:'Vendor'},
    {key:'type',label:'Type'},{key:'amount',label:'Amount',render:r=>money(r.amount)},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];

  const filteredFeedback=feedback.filter(f=>{
    const matchSearch=!searchQuery||JSON.stringify(f).toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });
  const filteredDisputes=disputes.filter(d=>{
    const matchSearch=!searchQuery||JSON.stringify(d).toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">ADMIN CONTROL</span>
          <h1>Reports & Cases</h1>
          <p>Customer feedback, abuse reports and dispute arbitration.</p>
        </div>
        <div className="dash-toolbar" style={{gap:8}}>
          <select className="period-select" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 3 Months</option>
          </select>
          <div className="dash-filter"><Icon name="search"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search reports…"/></div>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Total Feedback" value={feedback.length} change="All time" icon="heart"/>
        <Metric label="Pending Reviews" value={feedback.filter(f=>f.status==='Pending').length} change="Needs moderation" icon="bell"/>
        <Metric label="Open Disputes" value={disputes.filter(d=>d.status==='Open').length} change="Awaiting resolution" icon="cart"/>
        <Metric label="Resolved" value={disputes.filter(d=>d.status==='Resolved').length} change="Completed cases" icon="check"/>
      </div>

      <TabGroup 
        tabs={[
          {key:'feedback',label:'Customer Feedback',count:feedback.length},
          {key:'abuse',label:'Abuse Reports',count:2},
          {key:'disputes',label:'Dispute Arbitration',count:disputes.filter(d=>d.status!=='Resolved').length},
        ]}
        activeTab={tab} 
        onTabChange={setTab}
      />

      {tab==='feedback'&&(
        <DataTable
          columns={feedbackColumns}
          rows={filteredFeedback}
          rowKey={r=>r.id}
          actions={r=>r.status==='Pending'?(
            <>
              <button className="table-action-btn" title="Approve" onClick={()=>moderateFeedback(r,'Approved')}><Icon name="check"/></button>
              <button className="table-action-btn danger" title="Reject" onClick={()=>moderateFeedback(r,'Rejected')}><Icon name="trash"/></button>
            </>
          ):null}
        />
      )}

      {tab==='abuse'&&(
        <div className="data-card">
          <div className="data-card-head"><div><h3>Abuse Reports</h3><span>2 pending reports</span></div></div>
          {[
            {id:'ABUSE-001',reporter:'Jean Paul',target:'Smart Gadgets',reason:'Counterfeit products',status:'Pending'},
            {id:'ABUSE-002',reporter:'Diane Mukamana',target:'Affiliate Marketer 1',reason:'Spam referrals',status:'Pending'},
          ].map(r=>(
            <div className="activity-row" key={r.id}>
              <div><b>{r.reporter} → {r.target}</b><small>{r.reason}</small></div>
              <div className="row-actions">
                <button className="table-action-btn" title="Investigate" onClick={()=>toast.info('Investigation started.')}><Icon name="eye"/></button>
                <button className="table-action-btn" title="Dismiss" onClick={()=>toast.success('Report dismissed.')}><Icon name="trash"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==='disputes'&&(
        <DataTable
          columns={disputeColumns}
          rows={filteredDisputes}
          rowKey={r=>r.id}
          actions={r=>r.status!=='Resolved'?(
            <button className="table-action-btn" title="Arbitrate" onClick={()=>setArbitrationModal(r)}><Icon name="cart"/></button>
          ):null}
        />
      )}

      <Modal open={!!arbitrationModal} onClose={()=>setArbitrationModal(null)} title="DISPUTE ARBITRATION" subtitle={`Case ${arbitrationModal?.id}`}>
        <div className="vendor-detail-grid">
          <div><span>Buyer</span><b>{arbitrationModal?.buyer}</b></div>
          <div><span>Vendor</span><b>{arbitrationModal?.vendor}</b></div>
          <div><span>Issue</span><b>{arbitrationModal?.type}</b></div>
          <div><span>Amount</span><b>{money(arbitrationModal?.amount||0)}</b></div>
        </div>
        <p>Review evidence and execute a binding settlement decision.</p>
        <div className="modal-actions" style={{flexWrap:'wrap',gap:8}}>
          <button className="gradient-btn" onClick={()=>resolveDispute(arbitrationModal,'REFUND_BUYER')}>Refund Buyer</button>
          <button className="gradient-btn" onClick={()=>resolveDispute(arbitrationModal,'RELEASE_TO_VENDOR')}>Release to Vendor</button>
          <button className="outline-btn" onClick={()=>resolveDispute(arbitrationModal,'SPLIT_SETTLEMENT')}>Split 50/50</button>
        </div>
      </Modal>
    </>
  );
}

// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────────────────────────

export default function AdminDashboard(){
  const path=useLocation().pathname;
  
  if(path.includes('/wallet'))return <DashboardLayout admin><AdminWallet/></DashboardLayout>;
  if(path.includes('/users'))return <DashboardLayout admin><AdminUsers/></DashboardLayout>;
  if(path.includes('/reports'))return <DashboardLayout admin><AdminReports/></DashboardLayout>;
  return <DashboardLayout admin><AdminOverview/></DashboardLayout>;
}

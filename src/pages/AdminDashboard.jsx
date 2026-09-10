import {useState,useEffect,useCallback,useMemo} from 'react';
import {Link,useLocation} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import SmartTable from '../components/SmartTable';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from '../services/analytics';
import {useToast} from '../components/Toast';
import {usersApi,reportsApi} from '../API';
import {extractErrorMessage} from '../API/client';

const hasToken=()=>!!localStorage.getItem('huska_token');
const titleCase=s=>String(s||'').toLowerCase().split('_').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
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
          <div className="dash-filter">
            <Icon name="search"/>
            <input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search…"/>
          </div>
          <span className="table-count">{filtered.length} records</span>
        </div>
      </div>
      <div className="data-table">
        <div className="data-row table-header">
          {columns.map(col=>(
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
        ):shown.map((r,i)=>(
          <div className="data-row" key={rowKey?rowKey(r,i):i}>
            {columns.map(col=>(
              <span key={col.key}>{col.render?col.render(r):r[col.key]}</span>
            ))}
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

function StatusBadge({status}){
  const cls=['Active','Published','Approved','Completed','Available','Success'].includes(status)?'active':
             ['Suspended','Blocked','Rejected','Cancelled','Failed','Out of stock'].includes(status)?'danger':
             ['Pending','Processing','Draft','Under Review','Open'].includes(status)?'warning':'';
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
  
  const [orders,setOrders]=useState(seedOrders);
  const [usersList,setUsersList]=useState(seedUsers);
  const [vendorsList,setVendorsList]=useState(seedVendors);
  const [suppliersList,setSuppliersList]=useState(seedSuppliers);
  const [affiliatesList,setAffiliatesList]=useState(seedAffiliates);
  const [productsList,setProductsList]=useState(seedProducts);

  // Backend sync
  useEffect(()=>{
    if(!hasToken())return;
    (async()=>{
      try{
        const r=await usersApi.getAll({limit:200});
        if(r.data?.length){
          setUsersList(r.data.map(u=>({id:u.id||`USR-${Date.now()}`,name:u.name||u.fullName||'',email:u.email||'',role:titleCase(u.role||''),status:titleCase(u.status||'Active'),phone:u.phone||''})));
        }
      }catch(e){console.warn(extractErrorMessage(e));}
    })();
  },[]);

  // Product actions
  const unpublishProduct=(p)=>{
    setProductsList(prev=>prev.map(x=>x.id===p.id?{...x,status:'Unpublished'}:x));
    toast.info(`${p.name} unpublished.`);
  };
  const deleteProduct=(p)=>{
    setProductsList(prev=>prev.filter(x=>x.id!==p.id));
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
        <Metric label="Net Commission" value={money(Math.round(periodMetrics.sales*0.15))} change={`${chartKey} commission`} icon="wallet"/>
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
    {id:'LED-001',from:'Buyer - Aline Uwase',to:'Escrow Account',amount:850000,type:'Deposit',status:'HELD',date:'2026-08-26'},
    {id:'LED-002',from:'Escrow Account',to:'Vendor - Kigali Tech Store',amount:765000,type:'Release',status:'RELEASED',date:'2026-08-27'},
    {id:'LED-003',from:'Platform',to:'Commission Pool',amount:85000,type:'Commission',status:'RECORDED',date:'2026-08-27'},
    {id:'LED-004',from:'Buyer - Jean Paul',to:'Escrow Account',amount:190000,type:'Deposit',status:'HELD',date:'2026-08-26'},
    {id:'LED-005',from:'Escrow Account',to:'Vendor - Fashion Rwanda',amount:171000,type:'Release',status:'RELEASED',date:'2026-08-28'},
  ]);
  const [payouts,setPayouts]=useState([
    {id:'PAY-001',vendor:'Kigali Tech Store',amount:765000,method:'Bank Transfer',status:'Completed',date:'2026-08-27'},
    {id:'PAY-002',vendor:'Fashion Rwanda',amount:171000,method:'MTN MoMo',status:'Processing',date:'2026-08-28'},
    {id:'PAY-003',vendor:'Smart Gadgets',amount:92000,method:'Bank Transfer',status:'Pending',date:'2026-08-28'},
  ]);
  const [holdModal,setHoldModal]=useState(null);
  const [holdReason,setHoldReason]=useState('');

  const escrowTotal=ledger.filter(l=>l.status==='HELD').reduce((s,l)=>s+l.amount,0);
  const releasedTotal=ledger.filter(l=>l.status==='RELEASED').reduce((s,l)=>s+l.amount,0);
  const commissionTotal=ledger.filter(l=>l.type==='Commission').reduce((s,l)=>s+l.amount,0);

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
    {key:'id',label:'Entry'},{key:'from',label:'From'},{key:'to',label:'To'},
    {key:'amount',label:'Amount',render:r=>money(r.amount)},{key:'type',label:'Type'},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];
  const payoutColumns=[
    {key:'id',label:'Payout'},{key:'vendor',label:'Vendor'},{key:'amount',label:'Amount',render:r=>money(r.amount)},
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
        <DataTable
          columns={payoutColumns}
          rows={payouts}
          rowKey={r=>r.id}
          actions={r=>(
            <>
              {r.status==='Pending'&&<button className="table-action-btn" title="Approve" onClick={()=>releasePayout(r)}><Icon name="check"/></button>}
              {(r.status==='Pending'||r.status==='Processing')&&<button className="table-action-btn danger" title="Hold" onClick={()=>setHoldModal(r)}><Icon name="lock"/></button>}
            </>
          )}
        />
      )}

      {tab==='ledger'&&(
        <DataTable columns={ledgerColumns} rows={ledger} rowKey={r=>r.id}/>
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

function AdminUsers(){
  const [tab,setTab]=useState('buyers');
  const toast=useToast();
  const [usersList,setUsersList]=useState(seedUsers);
  const [vendorsList,setVendorsList]=useState(seedVendors);
  const [suppliersList,setSuppliersList]=useState(seedSuppliers);
  const [affiliatesList,setAffiliatesList]=useState(seedAffiliates);
  const [editModal,setEditModal]=useState(null);
  const [confirmAction,setConfirmAction]=useState(null);
  const [commissionModal,setCommissionModal]=useState(null);
  const [commissionRate,setCommissionRate]=useState(10);

  // Backend sync
  useEffect(()=>{
    if(!hasToken())return;
    (async()=>{
      try{
        const r=await usersApi.getAll({limit:200});
        if(r.data?.length){
          setUsersList(r.data.map(u=>({id:u.id||`USR-${Date.now()}`,name:u.name||u.fullName||'',email:u.email||'',role:titleCase(u.role||''),status:titleCase(u.status||'Active'),phone:u.phone||''})));
        }
      }catch(e){console.warn(extractErrorMessage(e));}
    })();
  },[]);

  const toggleStatus=(list,setList,item,newStatus)=>{
    setList(prev=>prev.map(x=>x.id===item.id?{...x,status:newStatus}:x));
    toast.success(`${item.name||item.id} ${newStatus.toLowerCase()}.`);
  };

  const suspendUser=(user)=>toggleStatus(usersList,setUsersList,user,'Suspended');
  const activateUser=(user)=>toggleStatus(usersList,setUsersList,user,'Active');
  const blockUser=(user)=>toggleStatus(usersList,setUsersList,user,'Blocked');

  const suspendVendor=(vendor)=>toggleStatus(vendorsList,setVendorsList,vendor,'Suspended');
  const approveVendor=(vendor)=>toggleStatus(vendorsList,setVendorsList,vendor,'Active');

  const buyerColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const vendorColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Store'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const supplierColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Supplier'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const affiliateColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Affiliate'},{key:'email',label:'Email'},
    {key:'clicks',label:'Clicks'},{key:'conversions',label:'Conversions'},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'buyers':return {columns:buyerColumns,rows:usersList.filter(u=>u.role==='Buyer'),actions:r=>(
        <>
          <button className="table-action-btn" title="View" onClick={()=>setEditModal({type:'view',data:r})}><Icon name="eye"/></button>
          {r.status==='Active'?<button className="table-action-btn warning" title="Suspend" onClick={()=>setConfirmAction({action:()=>suspendUser(r),message:`Suspend ${r.name}?`})}><Icon name="lock"/></button>:<button className="table-action-btn" title="Activate" onClick={()=>activateUser(r)}><Icon name="check"/></button>}
          {r.status!=='Blocked'&&<button className="table-action-btn danger" title="Block" onClick={()=>setConfirmAction({action:()=>blockUser(r),message:`Block ${r.name}?`} )}><Icon name="trash"/></button>}
        </>
      )};
      case 'vendors':return {columns:vendorColumns,rows:vendorsList,actions:r=>(
        <>
          <button className="table-action-btn" title="View" onClick={()=>setEditModal({type:'view',data:r})}><Icon name="eye"/></button>
          {r.status==='Pending'&&<button className="table-action-btn" title="Approve" onClick={()=>approveVendor(r)}><Icon name="check"/></button>}
          {r.status!=='Suspended'&&<button className="table-action-btn warning" title="Suspend" onClick={()=>setConfirmAction({action:()=>suspendVendor(r),message:`Suspend ${r.name}?`})}><Icon name="lock"/></button>}
          <button className="table-action-btn" title="Commission" onClick={()=>{setCommissionModal(r);setCommissionRate(10)}}><Icon name="wallet"/></button>
        </>
      )};
      case 'suppliers':return {columns:supplierColumns,rows:suppliersList,actions:r=>(
        <button className="table-action-btn" title="View" onClick={()=>setEditModal({type:'view',data:r})}><Icon name="eye"/></button>
      )};
      case 'affiliates':return {columns:affiliateColumns,rows:affiliatesList,actions:r=>(
        <>
          <button className="table-action-btn" title="View" onClick={()=>setEditModal({type:'view',data:r})}><Icon name="eye"/></button>
          {r.status!=='Blocked'&&<button className="table-action-btn danger" title="Block" onClick={()=>{setAffiliatesList(prev=>prev.map(x=>x.id===r.id?{...x,status:'Blocked'}:x));toast.success(`${r.name} blocked.`)}}><Icon name="trash"/></button>}
        </>
      )};
      default:return {columns:buyerColumns,rows:usersList.filter(u=>u.role==='Buyer')};
    }
  };

  const {columns,rows,actions}=getTabData();

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
        onTabChange={setTab}
      />

      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.email} actions={actions}/>

      <Modal open={!!editModal} onClose={()=>setEditModal(null)} title="ACCOUNT REVIEW" subtitle={editModal?.data?.name||editModal?.data?.id}>
        <div className="vendor-detail-grid">
          {editModal?.data&&Object.entries(editModal.data).filter(([k])=>k!=='id').map(([k,v])=>(
            <div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b>{String(v)}</b></div>
          ))}
        </div>
        <button className="gradient-btn" onClick={()=>setEditModal(null)}>Done</button>
      </Modal>

      <ConfirmDialog open={!!confirmAction} title="Confirm Action" message={confirmAction?.message} danger onConfirm={()=>{confirmAction?.action();setConfirmAction(null)}} onCancel={()=>setConfirmAction(null)}/>

      <Modal open={!!commissionModal} onClose={()=>setCommissionModal(null)} title="COMMISSION RULE" subtitle={`Set commission for ${commissionModal?.name}`}>
        <label className="field"><span>Commission Rate (%)</span><input type="number" min="0" max="100" value={commissionRate} onChange={e=>setCommissionRate(Number(e.target.value))}/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setCommissionModal(null)}>Cancel</button>
          <button className="gradient-btn" onClick={()=>{toast.success(`Commission set to ${commissionRate}% for ${commissionModal?.name}`);setCommissionModal(null)}}>Save Rule</button>
        </div>
      </Modal>
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

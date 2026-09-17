import {useState,useEffect,useMemo} from 'react';
import {useLocation} from 'react-router-dom';
import {useQueryClient} from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal,ConfirmDialog} from '../components/TabGroup';
import ModernDataTable from '../components/DataTable';
import StatusDropdown,{STATUS_CONFIG as STATUS_MAP,resolveStatusLabel} from '../components/StatusDropdown';
import {getPeriodChart,getPeriodLabels,getPeriodMetrics,getReportSummary,normalizePeriod} from '../services/analytics';
import {useToast} from '../components/Toast';
import {useUsers,useUpdateUser,mapUserRow} from '../hooks/useUsers';
import {useAllProducts} from '../hooks/useProducts';
import {useAllOrders} from '../hooks/useOrders';
import {queryKeys} from '../queryClient';
import {adminApi,adminPayoutsApi,ordersApi,disputesApi,abuseReportsApi,affiliatesApi,reviewsApi,extractErrorMessage} from '../API';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';

const typeLabel=t=>String(t||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());

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
  const cls=['Active','Published','Approved','Completed','Available','Success','Released','Recorded','Held'].includes(status)?'active':
             ['Suspended','Suspend','Blocked','Block','Rejected','Cancelled','Failed','Out of stock','HIDDEN','REJECTED'].includes(status)?'danger':
             ['Pending','Processing','Draft','Under Review','Open','INVESTIGATE','Investigate'].includes(status)?'warning':
             status==='Investigate'?'investigation':'';
  return <em className={'status '+cls}>{status}</em>;
}

const ORDER_FIELDS=o=>({id:o.orderNumber||o.orderId||o._id||`MVEC-${Date.now()}`,buyer:o.user?.name||o.user?.Fullname||o.buyer||'',vendor:o.vendor?.name||o.vendorName||o.items?.[0]?.vendorName||'',total:Number(o.totalAmount||o.grandTotal||o.total)||0,payment:o.paymentStatus||'SUCCESS',status:o.status||o.orderStatus||'Processing',date:o.createdAt?.slice?.(0,10)||''});

// ─── ADMIN OVERVIEW ───────────────────────────────────────────────────────────

function AdminOverview(){
  const [chartPeriod,setChartPeriod]=useState('30 Days');
  const [activeTab,setActiveTab]=useState('orders');
  const period=normalizePeriod(chartPeriod);
  const toast=useToast();
  const queryClient=useQueryClient();

  const [chart,setChart]=useState([]);
  const [labels,setLabels]=useState([]);
  const [periodMetrics,setPeriodMetrics]=useState({sales:0,orders:0,avgOrder:0,customers:0,activeVendors:0,lowStockProducts:0,paymentVolume:0});
  const [netCommission,setNetCommission]=useState(0);

  const [orders,setOrders]=useState([]);
  const [vendorsList,setVendorsList]=useState([]);
  const [suppliersList,setSuppliersList]=useState([]);
  const [affiliatesList,setAffiliatesList]=useState([]);
  const [productsList,setProductsList]=useState([]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [metrics,chartData,labelData,summary]=await Promise.all([
          getPeriodMetrics(period),getPeriodChart(period),getPeriodLabels(period),getReportSummary(period),
        ]);
        if(!active)return;
        setPeriodMetrics(metrics||{});
        setChart(chartData||[]);
        setLabels(labelData||[]);
        setNetCommission(Number(summary?.metrics?.commission)||0);
      }catch(e){if(active)toast.error(extractErrorMessage(e));}
    })();
    return ()=>{active=false};
  },[period]);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [v,su,af]=await Promise.all([adminApi.getVendors({pageSize:100}),adminApi.getSuppliers({pageSize:100}),affiliatesApi.adminList()]);
        if(!active)return;
        setVendorsList((v?.data||[]).map(x=>({id:x.user?._id||x._id,name:x.businessName||x.name||'',category:x.user?.companyName||'—',products:'—',rating:x.ratingAvg||0,status:x.status||'ACTIVE'})));
        setSuppliersList((su?.data||[]).map(x=>({id:x.user?._id||x._id,name:x.businessName||x.name||'',category:'—',products:'—',rating:x.ratingAvg||0,status:x.status||'ACTIVE'})));
        const rawAf=Array.isArray(af?.data)?af.data:(Array.isArray(af)?af:[]);
        setAffiliatesList(rawAf.map(x=>({id:x.id||x._id,name:x.name||x.Fullname||'',email:x.email||'',clicks:x.clicks||0,conversions:x.conversions||0,earnings:x.earnings||0,status:x.status||'ACTIVE'})));
      }catch(e){if(active)console.warn('Admin entity lists unavailable:',extractErrorMessage(e));}
    })();
    return ()=>{active=false};
  },[]);

  // TanStack Query: users
  const {data:usersRes,isLoading:usersLoading}=useUsers({limit:200});
  const usersList=useMemo(()=>{
    if(usersRes?.data?.length)return usersRes.data.map(mapUserRow);
    return [];
  },[usersRes]);

  // TanStack Query: products
  const {data:productsRes}=useAllProducts({limit:200});
  useEffect(()=>{
    const list=Array.isArray(productsRes?.products)?productsRes.products:null;
    if(list?.length){
      setProductsList(list.map(p=>({id:p._id||p.id||`PRD-${Date.now()}`,name:p.name||'',vendor:p.vendor?.name||p.vendor?.companyName||p.vendor||'',price:Number(p.price||p.discountPrice)||0,stock:p.stockQuantity??p.stock??0,status:p.status||'Active'})));
    }
  },[productsRes]);

  // TanStack Query: orders
  const {data:ordersRes}=useAllOrders();
  useEffect(()=>{
    const list=Array.isArray(ordersRes?.orders)?ordersRes.orders:(Array.isArray(ordersRes)?ordersRes:null);
    if(list?.length)setOrders(list.map(ORDER_FIELDS));
  },[ordersRes]);

  const vendorApprovals=vendorsList.filter(v=>String(v.status).toUpperCase()==='PENDING'||String(v.status).toUpperCase()==='UNDER_REVIEW').length;
  const supplierApprovals=suppliersList.filter(s=>String(s.status).toUpperCase()==='PENDING'||String(s.status).toUpperCase()==='UNDER_REVIEW').length;

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
          <option value="7 Days">7 Days</option>
          <option value="30 Days">30 Days</option>
          <option value="3 Months">3 Months</option>
          <option value="1 Year">1 Year</option>
        </select>
      </div>

      <div className="metric-grid">
        <Metric label="Gross Revenue" value={money(periodMetrics.sales)} change={`${period} revenue`} icon="chart"/>
        <Metric label="Active Orders" value={periodMetrics.orders} change={`${period} orders`} icon="cart"/>
        <Metric label="Active Vendors" value={periodMetrics.activeVendors||vendorsList.length} change={`${period} onboarded`} icon="shop"/>
        <Metric label="Net Commission" value={money(netCommission)} change={`${period} commission`} icon="wallet"/>
      </div>

      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head">
            <div><h3>Revenue Trend</h3><span>{period} performance</span></div>
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
            ['Vendor approvals',`${vendorApprovals} pending`,vendorApprovals>0?'warning':'active'],
            ['Supplier approvals',`${supplierApprovals} pending`,supplierApprovals>0?'warning':'active'],
            ['Low stock products',`${periodMetrics.lowStockProducts||0} items`,periodMetrics.lowStockProducts>0?'warning':'active'],
            ['Payment volume',money(periodMetrics.paymentVolume||0),'active'],
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
            <button className="table-action-btn" title="Unpublish" onClick={()=>toast.info('Use vendor console to manage listings.')}>
              <Icon name="box"/>
            </button>
            <button className="table-action-btn danger" title="Delete" onClick={()=>toast.info('Deletion is managed from the vendor console.')}>
              <Icon name="trash"/>
            </button>
          </>
        ):activeTab==='buyers'||activeTab==='vendors'?(r)=>(
          <span className={`status-chip ${r.status==='Suspended'?'danger':'active'}`}>{String(r.status).toLowerCase().replace(/_/g,' ')}</span>
        ):null}
      />
    </>
  );
}

// ─── ADMIN WALLET & LEDGER ────────────────────────────────────────────────────

const LEDGER_STATUS={
  PAYMENT_ESCROW_LOCK:'Held',
  ESCROW_RELEASE_VENDOR:'Released',
  PLATFORM_COMMISSION_DEDUCTION:'Recorded',
  COURIER_FEE_PAYOUT:'Processing',
  BUYER_REFUND:'Refunded',
  ADMIN_MANUAL_ADJUSTMENT:'Adjusted',
};

function AdminWallet(){
  const toast=useToast();
  const [tab,setTab]=useState('overview');
  const [ledger,setLedger]=useState([]);
  const [payouts,setPayouts]=useState([]);
  const [rules,setRules]=useState([]);
  const [holdModal,setHoldModal]=useState(null);
  const [holdReason,setHoldReason]=useState('');
  const [ledgerFilter,setLedgerFilter]=useState('all');
  const [ruleModal,setRuleModal]=useState(false);
  const [ruleForm,setRuleForm]=useState({name:'',ruleType:'FLAT_PERCENTAGE',rateType:'PERCENTAGE',rateValue:5,priority:0});

  const loadLedger=async()=>{
    try{
      const res=await adminApi.getLedger({limit:100});
      const entries=Array.isArray(res?.entries)?res.entries:[];
      setLedger(entries.map(x=>{
        const debit=x.debitAccount&&typeof x.debitAccount==='object'?x.debitAccount:null;
        const credit=x.creditAccount&&typeof x.creditAccount==='object'?x.creditAccount:null;
        return {
          id:`${x.transactionReference||x._id||'LED'}-${String(x._id||'').slice(-6)}`,
          actor:credit?.accountNumber||x.creditAccount||'Escrow Account',
          email:'',
          role:credit?.accountType||'Ledger',
          txType:typeLabel(x.entryType),
          from:debit?.accountNumber||x.debitAccount||'',
          to:credit?.accountNumber||x.creditAccount||'',
          amount:Number(x.amount)||0,
          type:x.entryType||'',
          status:LEDGER_STATUS[x.entryType]||'Recorded',
          date:x.createdAt?.slice?.(0,10)||'',
        };
      }));
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const loadPayouts=async()=>{
    try{
      const res=await adminPayoutsApi.getHistory();
      const list=Array.isArray(res?.payouts)?res.payouts:(Array.isArray(res?.data)?res.data:[]);
      setPayouts(list.map(x=>({
        id:x.payoutNumber||String(x.id||'').slice(-8).toUpperCase(),
        vendor:typeof x.adminUser==='object'?x.adminUser.Fullname||x.adminUser.email||'Admin':'Admin',
        amount:Number(x.amount)||0,
        method:x.paymentMethod||'Payout',
        status:String(x.status||'PAID').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()),
        date:x.createdAt?.slice?.(0,10)||'',
      })));
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const loadRules=async()=>{
    try{
      const res=await adminApi.getCommissionRules();
      setRules(Array.isArray(res?.rules)?res.rules:[]);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  useEffect(()=>{loadLedger();loadPayouts();loadRules();},[]);

  const escrowTotal=ledger.filter(l=>l.type==='PAYMENT_ESCROW_LOCK').reduce((s,l)=>s+l.amount,0);
  const releasedTotal=ledger.filter(l=>l.type==='ESCROW_RELEASE_VENDOR').reduce((s,l)=>s+l.amount,0);
  const commissionTotal=ledger.filter(l=>l.type==='PLATFORM_COMMISSION_DEDUCTION').reduce((s,l)=>s+l.amount,0);

  const ledgerFilters=[
    {key:'all',label:'All transactions'},
    {key:'release',label:'Escrow Release',filter:list=>list.filter(l=>l.type==='ESCROW_RELEASE_VENDOR')},
    {key:'payout',label:'Payout',filter:list=>list.filter(l=>l.type==='COURIER_FEE_PAYOUT'||l.type==='BUYER_REFUND')},
    {key:'commission',label:'Commission',filter:list=>list.filter(l=>l.type==='PLATFORM_COMMISSION_DEDUCTION')},
  ];

  const toggleRule=async(rule)=>{
    try{
      await adminApi.toggleCommissionRule(rule._id||rule.id);
      toast.success(`Commission rule ${rule.isActive?'deactivated':'activated'}.`);
      loadRules();
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const createRule=async()=>{
    if(!ruleForm.name.trim()){toast.error('Rule name is required.');return;}
    try{
      await adminApi.createCommissionRule({...ruleForm,name:ruleForm.name.trim()});
      toast.success('Commission rule created.');
      setRuleModal(false);
      setRuleForm({name:'',ruleType:'FLAT_PERCENTAGE',rateType:'PERCENTAGE',rateValue:5,priority:0});
      loadRules();
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const ledgerColumns=[
    {key:'role',label:'Account'},
    {key:'txType',label:'Transaction Type'},
    {key:'amount',label:'Amount',align:'right',render:r=>money(r.amount)},
    {key:'date',label:'Date'},
  ];
  const payoutColumns=[
    {key:'id',label:'Payout'},{key:'vendor',label:'Affiliate'},{key:'amount',label:'Amount',align:'right',render:r=>money(r.amount)},
    {key:'method',label:'Method'},{key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];
  const ruleColumns=[
    {key:'name',label:'Rule'},{key:'ruleType',label:'Type'},
    {key:'rateValue',label:'Rate',render:r=>`${r.rateValue}${String(r.rateType||'').toUpperCase()==='PERCENTAGE'?'%':''}`},
    {key:'priority',label:'Priority'},
    {key:'isActive',label:'Status',render:r=><StatusBadge status={r.isActive?'Active':'Inactive'}/>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">ADMIN CONTROL</span>
          <h1>Wallet & Ledger</h1>
          <p>Escrow, revenue, payouts and double-entry audit trail.</p>
        </div>
        <button className="gradient-btn" onClick={()=>setRuleModal(true)}><Icon name="plus"/> New Commission Rule</button>
      </div>

      <div className="metric-grid">
        <Metric label="Escrow Locked" value={money(escrowTotal)} change="Held for delivery" icon="wallet"/>
        <Metric label="Net Revenue" value={money(commissionTotal)} change="Platform commission" icon="chart"/>
        <Metric label="Pending Payouts" value={payouts.filter(p=>p.status!=='Completed').length} change="Awaiting processing" icon="cart"/>
        <Metric label="Released" value={money(releasedTotal)} change="Completed settlements" icon="check"/>
      </div>

      <TabGroup 
        tabs={[
          {key:'overview',label:'Escrow & Revenue'},
          {key:'payouts',label:'Payout Requests',count:payouts.filter(p=>p.status!=='Completed').length},
          {key:'ledger',label:'Ledger Audit Trail'},
          {key:'commissions',label:'Commission Rules',count:rules.length},
        ]}
        activeTab={tab} 
        onTabChange={setTab}
      />

      {tab==='overview'&&(
        <div className="dash-grid">
          <div className="data-card">
            <h3>Escrow Holdings</h3>
            {ledger.filter(l=>l.type==='PAYMENT_ESCROW_LOCK').slice(0,5).length===0&&<p className="muted">No escrow holdings recorded yet.</p>}
            {ledger.filter(l=>l.type==='PAYMENT_ESCROW_LOCK').slice(0,5).map(l=>(
              <div className="activity-row" key={l.id}>
                <div><b>{l.id}</b><small>{l.from} → {l.to}</small></div>
                <strong>{money(l.amount)}</strong>
              </div>
            ))}
          </div>
          <div className="data-card">
            <h3>Recent Releases</h3>
            {ledger.filter(l=>l.type==='ESCROW_RELEASE_VENDOR').slice(0,3).length===0&&<p className="muted">No escrow releases recorded yet.</p>}
            {ledger.filter(l=>l.type==='ESCROW_RELEASE_VENDOR').slice(0,3).map(l=>(
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
          searchPlaceholder="Search affiliate, payout ID…"
          emptyText="No payout requests yet."
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
          avatar={r=>({name:r.actor,subtitle:r.role})}
          status={r=>r.status}
          searchKeys={['actor','role','txType','id','status']}
          searchPlaceholder="Search by account, transaction…"
          sortableColumns={[{key:'amount',label:'Amount'},{key:'date',label:'Date'},{key:'status',label:'Status'}]}
          emptyText="No ledger entries yet."
        />
      )}

      {tab==='commissions'&&(
        <ModernDataTable
          columns={ruleColumns}
          rows={rules}
          rowKey={r=>r._id||r.id}
          avatar={r=>({name:r.name,subtitle:r.ruleType})}
          searchKeys={['name','ruleType','rateValue']}
          searchPlaceholder="Search commission rules…"
          actions={r=>(
            <button className="table-action-btn" title={r.isActive?'Deactivate':'Activate'} onClick={()=>toggleRule(r)}>
              <Icon name={r.isActive?'check':'x'}/>
            </button>
          )}
          emptyText="No commission rules yet."
        />
      )}

      <Modal open={ruleModal} onClose={()=>setRuleModal(false)} title="NEW COMMISSION RULE" subtitle="Configure a dynamic commission rule">
        <div className="product-form">
          <label className="field"><span>Rule name *</span><input value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm,name:e.target.value})} placeholder="e.g. Electronics 8%"/></label>
          <div className="two-col">
            <label className="field"><span>Rule type</span><select value={ruleForm.ruleType} onChange={e=>setRuleForm({...ruleForm,ruleType:e.target.value})}><option value="FLAT_PERCENTAGE">FLAT_PERCENTAGE</option><option value="CATEGORY_BASED">CATEGORY_BASED</option><option value="VENDOR_BASED">VENDOR_BASED</option><option value="PRODUCT_BASED">PRODUCT_BASED</option></select></label>
            <label className="field"><span>Rate type</span><select value={ruleForm.rateType} onChange={e=>setRuleForm({...ruleForm,rateType:e.target.value})}><option value="PERCENTAGE">PERCENTAGE</option><option value="FLAT">FLAT</option></select></label>
          </div>
          <div className="two-col">
            <label className="field"><span>Rate value *</span><input type="number" min="0" value={ruleForm.rateValue} onChange={e=>setRuleForm({...ruleForm,rateValue:Number(e.target.value)})} required/></label>
            <label className="field"><span>Priority</span><input type="number" value={ruleForm.priority} onChange={e=>setRuleForm({...ruleForm,priority:Number(e.target.value)})}/></label>
          </div>
        </div>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setRuleModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={createRule}>Create Rule</button>
        </div>
      </Modal>

      <Modal open={!!holdModal} onClose={()=>setHoldModal(null)} title="ADMINISTRATIVE HOLD" subtitle={`Hold funds for ${holdModal?.id}?`}>
        <p>Place an administrative hold on this payout during fraud checks or active disputes.</p>
        <label className="field"><span>Reason for hold *</span><textarea value={holdReason} onChange={e=>setHoldReason(e.target.value)} rows="3" required placeholder="Enter the reason for placing this hold…"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setHoldModal(null)}>Cancel</button>
          <button className="danger-btn" onClick={()=>{toast.success('Hold requested via settlement hold endpoint.');setHoldModal(null);setHoldReason('');}}>Place Hold</button>
        </div>
      </Modal>
    </>
  );
}

// ─── ADMIN USERS & STORES ─────────────────────────────────────────────────────

const STATUS_VALUES=STATUS_MAP?Object.entries(STATUS_MAP).map(([k,v])=>({key:k,...v})):[];

const mapAdminVendor=v=>({id:(v.user&&v.user._id)||v._id,name:v.businessName||v.name||'',category:(v.user&&v.user.companyName)||'—',products:'—',rating:v.ratingAvg||0,status:v.status||'ACTIVE'});
const mapAdminSupplier=s=>({id:(s.user&&s.user._id)||s._id,name:s.businessName||s.name||'',category:'—',products:'—',rating:s.ratingAvg||0,status:s.status||'ACTIVE'});
const mapAdminAffiliate=a=>({id:a.id||a._id,name:a.name||a.Fullname||'',email:a.email||'',clicks:a.clicks||0,conversions:a.conversions||0,status:a.status||'ACTIVE'});

function AdminUsers(){
  const [tab,setTab]=useState('buyers');
  const toast=useToast();
  const [vendorsList,setVendorsList]=useState([]);
  const [suppliersList,setSuppliersList]=useState([]);
  const [affiliatesList,setAffiliatesList]=useState([]);
  const [pendingChanges,setPendingChanges]=useState({});
  const [statusFilter,setStatusFilter]=useState('All');
  const [confirmSaveOpen,setConfirmSaveOpen]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [v,su,af]=await Promise.all([adminApi.getVendors({pageSize:100}),adminApi.getSuppliers({pageSize:100}),affiliatesApi.adminList()]);
        if(!active)return;
        setVendorsList((v?.data||[]).map(mapAdminVendor));
        setSuppliersList((su?.data||[]).map(mapAdminSupplier));
        const rawAf=Array.isArray(af?.data)?af.data:(Array.isArray(af)?af:[]);
        setAffiliatesList(rawAf.map(mapAdminAffiliate));
      }catch(e){if(active)toast.error(`Failed to load admin directories: ${extractErrorMessage(e)}`);}
    })();
    return ()=>{active=false};
  },[]);

  // TanStack Query: users (auto-refetch + shared cache with AdminOverview)
  const {data:usersRes}=useUsers({limit:200});
  const usersList=useMemo(()=>{
    if(usersRes?.data?.length)return usersRes.data.map(mapUserRow);
    return [];
  },[usersRes]);

  const stageChange=(id,newStatus)=>{
    setPendingChanges(prev=>({...prev,[id]:newStatus}));
  };

  const queryClient=useQueryClient();
  const updateUser=useUpdateUser();

  const applyChanges=async()=>{
    const ids=Object.keys(pendingChanges);
    if(!ids.length)return;
    let failed=0;
    for(const id of ids){
      try{await updateUser.mutateAsync({id,payload:{status:pendingChanges[id]}});}
      catch{failed++;}
    }
    // Write the new statuses straight into the users cache so the table text
    // updates instantly without waiting for a background refetch.
    queryClient.setQueryData(queryKeys.users,(old)=>{
      const patch=new Map();
      Object.entries(pendingChanges).forEach(([id,s])=>patch.set(id,resolveStatusLabel(s)));
      const apply=list=>Array.isArray(list)?list.map(u=>{
        const uid=String(u.id||u._id);
        return patch.has(uid)?{...u,status:patch.get(uid)}:u;
      }):list;
      if(old?.data)return {...old,data:apply(old.data)};
      return apply(old);
    });
    queryClient.invalidateQueries({queryKey:queryKeys.users});
    // Reflect staged statuses on the vendor/supplier/affiliate directories.
    const patch=new Map(Object.entries(pendingChanges).map(([id,s])=>[id,resolveStatusLabel(s)]));
    const applyTo=list=>Array.isArray(list)?list.map(r=>patch.has(String(r.id))?{...r,status:patch.get(String(r.id))}:r):list;
    setVendorsList(prev=>applyTo(prev));
    setSuppliersList(prev=>applyTo(prev));
    setAffiliatesList(prev=>applyTo(prev));
    const ok=ids.length-failed;
    if(ok>0)toast.success(`${ok} status change${ok>1?'s':''} saved.`);
    if(failed>0)toast.error(`${failed} status change${failed>1?'s':''} could not be saved.`);
    setPendingChanges({});
  };

  const getEffectiveStatus=(r)=>pendingChanges[r.id]?resolveStatusLabel(pendingChanges[r.id]):String(r.status||'').toLowerCase().replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

  const buyerColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},
    {key:'status',label:'Status',render:r=><StatusDropdown currentStatus={getEffectiveStatus(r)} onSave={s=>stageChange(r.id,s)}/>},
  ];
  const vendorColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Store'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusDropdown currentStatus={getEffectiveStatus(r)} onSave={s=>stageChange(r.id,s)}/>},
  ];
  const supplierColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Supplier'},{key:'category',label:'Category'},
    {key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'status',label:'Status',render:r=><StatusDropdown currentStatus={getEffectiveStatus(r)} onSave={s=>stageChange(r.id,s)}/>},
  ];
  const affiliateColumns=[
    {key:'id',label:'ID'},{key:'name',label:'Affiliate'},{key:'email',label:'Email'},
    {key:'clicks',label:'Clicks'},{key:'conversions',label:'Conversions'},
    {key:'status',label:'Status',render:r=><StatusDropdown currentStatus={getEffectiveStatus(r)} onSave={s=>stageChange(r.id,s)}/>},
  ];

  const deleteSelected=(sel)=>{
    const keys=new Set(sel.map(r=>r.id||r.email));
    if(!keys.size)return;
    toast.info('Account deletion is handled per-role via backend user/vendor/supplier endpoints.');
  };

  const getTabData=()=>{
    const lower=statusFilter.toLowerCase();
    const filter=list=>statusFilter==='All'?list:list.filter(r=>getEffectiveStatus(r).toLowerCase()===lower);
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
      {['All',...STATUS_VALUES.map(s=>s.label)].map(s=>{
        const opt=STATUS_VALUES.find(o=>o.label===s);
        return(
          <button
            key={s}
            className={'status-filter-btn'+(statusFilter===s?' active':'')}
            style={opt?{'--sf-color':opt.hex}:{}}
            onClick={()=>setStatusFilter(s)}
          >
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
        statusOptions={null}
        onBulkDelete={deleteSelected}
        searchKeys={['id','name','email','phone','category','products']}
        searchPlaceholder="Search users, emails, IDs…"
        rowClassName={r=>getEffectiveStatus(r).toLowerCase()==='investigate'?'row-investigation':''}
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

const DISPUTE_STATUS={
  OPEN:'Open',
  UNDER_REVIEW:'Under Review',
  EVIDENCE_SUBMITTED:'Under Review',
  RESOLVED_BUYER_REFUNDED:'Resolved',
  RESOLVED_VENDOR_RELEASED:'Resolved',
  RESOLVED_SPLIT:'Resolved',
  REJECTED:'Rejected',
};

function AdminReports(){
  const [tab,setTab]=useState('feedback');
  const [dateRange,setDateRange]=useState('30');
  const [searchQuery,setSearchQuery]=useState('');
  const toast=useToast();
  const [feedback,setFeedback]=useState([]);
  const [disputes,setDisputes]=useState([]);
  const [abuses,setAbuses]=useState([]);
  const [arbitrationModal,setArbitrationModal]=useState(null);

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [revRes,dispRes,abuseRes]=await Promise.all([
          reviewsApi.getAdmin().catch(()=>({data:[]})),
          disputesApi.adminList().catch(()=>({data:[]})),
          abuseReportsApi.getMine().catch(()=>({data:[]})),
        ]);
        if(!active)return;
        setFeedback((Array.isArray(revRes?.data)?revRes.data:[]).map(r=>({id:r.id||r._id||`FB-${Date.now()}`,user:r.user||r.reviewer||'',target:r.product||'',type:'Review',rating:r.rating||0,text:r.review||r.comment||'',status:r.status||'PENDING',date:r.date||''})));
        setDisputes((Array.isArray(dispRes?.data)?dispRes.data:[]).map(d=>({id:d.disputeNumber||String(d._id||'').slice(-6).toUpperCase(),buyer:d.raisedBy?.Fullname||(typeof d.raisedBy==='object'?d.raisedBy.name:'')||'',vendor:d.vendor?.Fullname||(typeof d.vendor==='object'?d.vendor.companyName||d.vendor.name:'')||'',type:typeLabel(d.reason),amount:Number(d.disputedAmount)||0,status:DISPUTE_STATUS[d.status]||String(d.status||'').toLowerCase().replace(/_/g,' '),date:d.createdAt?.slice?.(0,10)||''})));
        setAbuses(Array.isArray(abuseRes?.data)?abuseRes.data:[]);
      }catch(e){if(active)toast.error(`Failed to load reports: ${extractErrorMessage(e)}`);}
    })();
    return ()=>{active=false};
  },[]);

  const moderateFeedback=async(fb,newStatus)=>{
    try{
      await reviewsApi.update(fb.id,{status:newStatus==='Approved'?'PUBLISHED':'HIDDEN'});
      setFeedback(prev=>prev.map(x=>x.id===fb.id?{...x,status:newStatus}:x));
      toast.success(`Feedback ${newStatus.toLowerCase()}.`);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const resolveDispute=async(dispute,resolution)=>{
    try{
      await disputesApi.arbitrate(dispute.id,{decision:resolution});
      setDisputes(prev=>prev.map(x=>x.id===dispute.id?{...x,status:'Resolved'}:x));
      toast.success(`Dispute ${resolution.replace(/_/g,' ').toLowerCase()}.`);
    }catch(e){toast.error(extractErrorMessage(e));}
    setArbitrationModal(null);
  };

  const updateAbuse=async(r,status)=>{
    try{
      await abuseReportsApi.update(r.id,{status});
      setAbuses(prev=>prev.map(x=>x.id===r.id?{...x,status}:x));
      toast.success(`Abuse report marked ${String(status).toLowerCase().replace(/_/g,' ')}.`);
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const feedbackColumns=[
    {key:'id',label:'ID'},{key:'user',label:'User'},{key:'target',label:'Target'},
    {key:'type',label:'Type'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},
    {key:'text',label:'Review',render:r=><span title={r.text}>{String(r.text||'').slice(0,40)}…</span>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
  ];
  const disputeColumns=[
    {key:'id',label:'Dispute'},{key:'buyer',label:'Buyer'},{key:'vendor',label:'Vendor'},
    {key:'type',label:'Type'},{key:'amount',label:'Amount',render:r=>money(r.amount)},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];

  const filteredFeedback=feedback.filter(f=>!searchQuery||JSON.stringify(f).toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDisputes=disputes.filter(d=>!searchQuery||JSON.stringify(d).toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAbuses=abuses.filter(r=>!searchQuery||JSON.stringify(r).toLowerCase().includes(searchQuery.toLowerCase()));

  const openAbuseCount=abuses.filter(a=>String(a.status).toUpperCase()==='PENDING'||String(a.status).toUpperCase()==='INVESTIGATE').length;

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
        <Metric label="Pending Reviews" value={feedback.filter(f=>String(f.status).toUpperCase()==='PENDING').length} change="Needs moderation" icon="bell"/>
        <Metric label="Open Disputes" value={disputes.filter(d=>String(d.status).toUpperCase()==='OPEN'||String(d.status).toUpperCase()==='UNDER REVIEW').length} change="Awaiting resolution" icon="cart"/>
        <Metric label="Resolved" value={disputes.filter(d=>String(d.status).toUpperCase()==='RESOLVED').length} change="Completed cases" icon="check"/>
      </div>

      <TabGroup 
        tabs={[
          {key:'feedback',label:'Customer Feedback',count:feedback.length},
          {key:'abuse',label:'Abuse Reports',count:abuses.length},
          {key:'disputes',label:'Dispute Arbitration',count:disputes.filter(d=>String(d.status).toUpperCase()==='OPEN'||String(d.status).toUpperCase()==='UNDER REVIEW').length},
        ]}
        activeTab={tab} 
        onTabChange={setTab}
      />

      {tab==='feedback'&&(
        <DataTable
          columns={feedbackColumns}
          rows={filteredFeedback}
          rowKey={r=>r.id}
          emptyText="No customer feedback yet."
          actions={r=>String(r.status).toUpperCase()==='PENDING'?(
            <>
              <button className="table-action-btn" title="Approve" onClick={()=>moderateFeedback(r,'Approved')}><Icon name="check"/></button>
              <button className="table-action-btn danger" title="Reject" onClick={()=>moderateFeedback(r,'Rejected')}><Icon name="trash"/></button>
            </>
          ):null}
        />
      )}

      {tab==='abuse'&&(
        <div className="data-card">
          <div className="data-card-head"><div><h3>Abuse Reports</h3><span>{openAbuseCount} pending reports</span></div></div>
          {filteredAbuses.length===0&&<div className="data-row table-empty">No abuse reports yet.</div>}
          {filteredAbuses.map(r=>(
            <div className="activity-row" key={r.id}>
              <div><b>{(r.reporter||'Reporter')} → {r.targetUser||r.store?.name||'Target'}</b><small>{r.reasonCategory} · {r.status}</small></div>
              <div className="row-actions">
                {String(r.status).toUpperCase()==='PENDING'&&<button className="table-action-btn" title="Investigate" onClick={()=>updateAbuse(r,'INVESTIGATE')}><Icon name="eye"/></button>}
                {String(r.status).toUpperCase()!=='REJECTED'&&<button className="table-action-btn" title="Dismiss" onClick={()=>updateAbuse(r,'REJECTED')}><Icon name="trash"/></button>}
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
          emptyText="No disputes yet."
          actions={r=>String(r.status).toUpperCase()!=='RESOLVED'&&String(r.status).toUpperCase()!=='REJECTED'?(
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
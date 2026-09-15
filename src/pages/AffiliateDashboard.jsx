import {useState,useMemo,useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal} from '../components/TabGroup';
import SmartTable from '../components/SmartTable';
import {products} from '../data';
import {getAffiliateWallet,saveAffiliateWallet,requestAffiliateWithdrawal} from '../services/mvecStore';
import {useToast} from '../components/Toast';
import {useLocalQuery} from '../hooks/useLocalQuery';

const KEY='mvec_affiliate_links';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=links=>localStorage.setItem(KEY,JSON.stringify(links));
const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const affiliateUrl=l=>`${window.location.origin}/product/${l.productId}?ref=${l.code}`;
async function copyText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');el.remove();}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const seedConversions=[
  {id:'CONV-001',order:'ORD-1008',product:'Wireless Headphones',sale:68000,commission:1360,status:'Completed',date:'2026-08-26'},
  {id:'CONV-002',order:'ORD-1012',product:'Smart Watch Active',sale:99000,commission:1980,status:'Pending',date:'2026-08-25'},
  {id:'CONV-003',order:'ORD-1019',product:'Portable Blender',sale:42000,commission:840,status:'Completed',date:'2026-08-24'},
  {id:'CONV-004',order:'ORD-1025',product:'ProBook 14 Laptop',sale:780000,commission:15600,status:'Completed',date:'2026-08-23'},
];
const seedWallet={totalEarned:600000,available:285000,pending:135000,withdrawn:180000,history:[
  {id:'COM-001',source:'Completed order',reference:'ORD-1008',amount:1360,status:'Available',date:'2026-08-26'},
  {id:'COM-002',source:'Completed order',reference:'ORD-1019',amount:840,status:'Available',date:'2026-08-24'},
  {id:'COM-003',source:'Awaiting completion',reference:'ORD-1012',amount:1980,status:'Pending',date:'2026-08-25'},
],withdrawals:[
  {id:'AFF-PAY-001',amount:100000,method:'MTN MoMo',account:'+250 788 100 005',status:'Paid',requestedAt:'2026-08-21T09:00:00.000Z'},
]};
const seedTopLinks=[
  {product:'Wireless Headphones',clicks:2450,conversions:42,commission:8400},
  {product:'Smart Watch Active',clicks:1820,conversions:28,commission:5600},
  {product:'ProBook 14 Laptop',clicks:980,conversions:12,commission:2400},
];

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const s=String(status||'');
  const cls=['Active','Available','Completed','Success','Paid','Approved','Released','Clear'].includes(s)?'active':
             ['Suspended','Blocked','Cancelled','Failed','Rejected','Out of stock'].includes(s)?'danger':
             ['Pending','Processing','Draft','Pending review'].includes(s)?'warning':
             s==='Investigation'||s==='On Hold'?'investigation':'';
  return <em className={'status '+cls}>{s}</em>;
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
  },[safeRows,q,sortKey,sortDir]);
  
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

// ─── AFFILIATE OVERVIEW ───────────────────────────────────────────────────────

function AffiliateOverview(){
  const [tab,setTab]=useState('conversions');
  const {data:wallet}=useLocalQuery(['affiliateWallet'],getAffiliateWallet);
  const walletData=wallet||{totalEarned:420000,available:285000,pending:135000};
  const {data:links}=useLocalQuery(['affiliateLinks'],read);
  const linkList=Array.isArray(links)?links:[];
  
  const recentConversions=seedConversions.slice(0,5);
  const topLinks=linkList.length?linkList.map(l=>{
    const p=products.find(x=>String(x.id)===String(l.productId));
    return {...l,productName:p?.name||'Unknown',amount:Number(l.amount||(Number(l.orders||0)*Number(p?.price||0)))};
  }).sort((a,b)=>b.amount-a.amount).slice(0,5):seedTopLinks;

  const conversionColumns=[
    {key:'order',label:'Order'},{key:'product',label:'Product'},
    {key:'sale',label:'Sale',render:r=>money(r.sale)},{key:'commission',label:'Commission',render:r=>money(r.commission)},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},{key:'date',label:'Date'},
  ];
  const linkColumns=[
    {key:'productName',label:'Product'},{key:'clicks',label:'Clicks'},
    {key:'conversions',label:'Conversions'},{key:'commission',label:'Commission %',render:r=>r.commission?`${r.commission}%`:'2%'},
    {key:'amount',label:'Generated',render:r=>money(r.amount)},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'topLinks':return {columns:linkColumns,rows:topLinks};
      default:return {columns:conversionColumns,rows:recentConversions};
    }
  };
  const {columns,rows}=getTabData();

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">AFFILIATE PLATFORM</span>
          <h1>Affiliate Dashboard</h1>
          <p>Promote MVEC products and earn when qualifying orders are completed.</p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric label="Total Clicks" value="8,420" icon="chart" sub="+18.2% this period"/>
        <Metric label="Conversions" value="184" icon="cart" sub="2.18% conversion rate"/>
        <Metric label="Pending Earnings" value={money(walletData.pending)} icon="wallet" sub="Awaiting completion"/>
        <Metric label="Lifetime Earned" value={money(walletData.totalEarned)} icon="wallet" sub="All time commission"/>
      </div>

      <div className="verified-box"><b>✓ Protected commission workflow</b><p>Commission follows purchase → payment → delivery → refund window → confirmation. Once available, it moves into your wallet.</p></div>

      <TabGroup tabs={[{key:'conversions',label:'Recent Conversions',count:recentConversions.length},{key:'topLinks',label:'Top Performing Links',count:topLinks.length}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.order||r.product}/>
    </>
  );
}

// ─── AFFILIATE WALLET ─────────────────────────────────────────────────────────

// Guard against legacy/partial wallet payloads: always yield the full shape so
// the wallet UI (and its tables) never receives undefined arrays.
const sanitizeWallet=(w)=>{
  const base=w&&typeof w==='object'?w:{};
  return {
    available:Number(base.available)||0,
    pending:Number(base.pending)||0,
    totalEarned:Number(base.totalEarned)||0,
    withdrawn:Number(base.withdrawn)||0,
    history:Array.isArray(base.history)?base.history:[],
    withdrawals:Array.isArray(base.withdrawals)?base.withdrawals:[],
  };
};

function AffiliateWallet(){
  const toast=useToast();
  const {data:walletData,invalidate:invalidateWallet}=useLocalQuery(['affiliateWallet'],getAffiliateWallet);
  // Local copy of the wallet: balances and the activity ledger update instantly
  // on withdrawal, then the query refetch keeps localStorage in sync.
  const [wallet,setWallet]=useState(()=>sanitizeWallet(walletData||getAffiliateWallet()));
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('MTN MoMo');
  const [account,setAccount]=useState('');

  useEffect(()=>{
    if(walletData)setWallet(sanitizeWallet(walletData));
  },[walletData]);

  const submitWithdrawal=()=>{
    const value=Math.round(Number(amount)||0);
    if(!value||value<10000){toast.error('Minimum withdrawal is RWF 10,000.');return;}
    if(value>wallet.available){toast.error('Withdrawal amount is higher than your available balance.');return;}
    if(!account.trim()){toast.error('Please provide a payout account or phone number.');return;}
    let request;
    try{request=requestAffiliateWithdrawal(value,method,account.trim());}
    catch(e){toast.error(e?.message||'Unable to request withdrawal.');return;}
    // Apply the payout to local state immediately so the ledger and balances
    // re-render without waiting for the background refetch.
    setWallet(prev=>sanitizeWallet({
      ...prev,
      available:Number(prev.available||0)-value,
      withdrawn:Number(prev.withdrawn||0)+value,
      withdrawals:[request,...(prev.withdrawals||[])],
    }));
    invalidateWallet();
    toast.success(`Withdrawal of ${money(value)} requested. It is pending MVEC review.`);
    setWithdrawModal(false);
    setAmount('');
    setAccount('');
  };

  const activityRows=useMemo(()=>{
    const commission=(wallet.history||[]).map(h=>({
      id:h.id||`COM-${Date.now()}`,
      type:'Commission',
      source:h.source||'Commission',
      reference:h.reference||'—',
      amount:Number(h.amount)||0,
      status:h.status||'Pending',
      date:String(h.date||'').slice(0,10),
    }));
    const payouts=(wallet.withdrawals||[]).map(r=>({
      id:r.id||`AFF-PAY-${Date.now()}`,
      type:'Withdrawal',
      source:`${r.method||'Payout'}`,
      reference:r.account||'—',
      amount:-(Number(r.amount)||0),
      status:r.status||'Pending review',
      date:String(r.requestedAt||'').slice(0,10),
    }));
    return [...payouts,...commission].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  },[wallet]);

  const txnColumns=[
    {key:'id',label:'Entry'},
    {key:'type',label:'Type'},
    {key:'source',label:'Source'},
    {key:'amount',label:'Amount',render:r=><span className={r.amount<0?'danger-text':'success-text'}>{r.amount<0?money(Math.abs(r.amount)):'+ '+money(r.amount)}</span>},
    {key:'status',label:'Status',render:r=><StatusBadge status={r.status}/>},
    {key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">AFFILIATE PLATFORM</span>
          <h1>Wallet</h1>
          <p>Commission balance and payout activity.</p>
        </div>
        <button
          className="gradient-btn"
          onClick={()=>setWithdrawModal(true)}
          disabled={wallet.available<10000}
          title={wallet.available<10000?'Balance is below the RWF 10,000 minimum.':''}
        >
          Request Withdrawal
        </button>
      </div>

      <div className="metric-grid">
        <Metric label="Total Earned" value={money(wallet.totalEarned)} icon="chart" sub="Lifetime commission"/>
        <Metric label="Available Balance" value={money(wallet.available)} icon="wallet" sub="Ready for withdrawal"/>
        <Metric label="Pending Commission" value={money(wallet.pending)} icon="wallet" sub="Awaiting completion"/>
        <Metric label="Withdrawn" value={money(wallet.withdrawn)} icon="check" sub="Paid out successfully"/>
      </div>

      <div className="verified-box"><b>✓ Protected payout workflow</b><p>Withdrawals are reviewed and paid on the weekly payout cycle. The ledger below shows cleared commissions and payout requests together, newest first.</p></div>

      <DataTable columns={txnColumns} rows={activityRows} rowKey={r=>r.id} emptyText="No wallet activity yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(wallet.available)}</b>. Minimum withdrawal is RWF 10,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="10000" max={wallet.available} step="1000" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 50000"/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Bank account</option></select></label>
        <label className="field"><span>Account / phone</span><input value={account} onChange={e=>setAccount(e.target.value)} placeholder="+250 7XX XXX XXX"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={wallet.available<10000}>Submit Request</button>
        </div>
      </Modal>
    </>
  );
}

// ─── AFFILIATE VENDORS & SUPPLIERS ────────────────────────────────────────────

function AffiliateVendors(){
  const {data:linkData,invalidate:invalidateLinks}=useLocalQuery(['affiliateLinks'],read);
  // Local copy of the link list: button states update instantly on create/copy,
  // then the query refetch keeps localStorage/cache in sync in the background.
  const [links,setLinks]=useState(()=>Array.isArray(linkData)?linkData:[]);
  const [copied,setCopied]=useState('');
  const [q,setQ]=useState('');

  useEffect(()=>{
    if(Array.isArray(linkData))setLinks(linkData);
  },[linkData]);

  const filteredProducts=useMemo(()=>products.filter(p=>`${p.name} ${p.vendor||''} ${p.category||''}`.toLowerCase().includes(q.toLowerCase())),[q]);

  const saveLinks=next=>{
    setLinks(next);
    write(next);
    invalidateLinks();
  };

  const createLink=(product)=>{
    const existing=links.find(l=>String(l.productId)===String(product.id));
    if(existing)return existing;
    const link={id:`AFF-${Date.now()}`,productId:product.id,product:product.name,code:`MV${product.id}${Date.now().toString().slice(-4)}`,clicks:0,orders:0,commission:2,amount:0,createdAt:new Date().toISOString()};
    saveLinks([link,...links]);
    return link;
  };

  const copyFor=async(product)=>{
    const link=links.find(l=>String(l.productId)===String(product.id))||createLink(product);
    await copyText(affiliateUrl(link));
    setCopied(String(product.id));
    setTimeout(()=>setCopied(''),1600);
  };

  const columns=[
    {key:'name',label:'Product',render:r=>(
      <div className="admin-product-main">
        <img src={r.image} alt=""/>
        <div><b>{r.name}</b><small>{money(r.price)} · {r.vendor}</small></div>
      </div>
    )},
    {key:'category',label:'Category'},
    {key:'stock',label:'Stock',render:r=>`${r.stock} units`},
    {key:'commission',label:'Commission',render:()=><b>2%</b>},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">AFFILIATE PLATFORM</span>
          <h1>Vendors & Suppliers</h1>
          <p>Generate referral links for marketplace products.</p>
        </div>
      </div>

      <div className="dash-toolbar">
        <div className="dash-filter"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products, vendors or categories…"/></div>
        <span className="table-count">{filteredProducts.length} products</span>
      </div>

      <div className="dash-grid affiliate-product-grid">
        {filteredProducts.slice(0,12).map(product=>{
          const hasLink=links.find(l=>String(l.productId)===String(product.id));
          return (
            <div className="data-card" key={product.id}>
              <div className="admin-product-main">
                <img src={product.image} alt=""/>
                <div><b>{product.name}</b><small>{money(product.price)} · {product.vendor}</small></div>
              </div>
              <div className="affiliate-product-meta">
                <span>Stock <b>{product.stock} units</b></span>
                <span>Commission <b>2%</b></span>
              </div>
              <div className="affiliate-link-actions">
                <button className="gradient-btn" onClick={()=>createLink(product)} disabled={!!hasLink}>{hasLink?'Link Created':'Create Link'}</button>
                {hasLink&&<button className="outline-btn copy-link-btn" onClick={()=>copyFor(product)}><Icon name="copy" size={15}/>{copied===String(product.id)?'Copied!':'Copy Link'}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── AFFILIATE REPORTS ────────────────────────────────────────────────────────

function AffiliateReports(){
  const [dateRange,setDateRange]=useState('30');
  const [tab,setTab]=useState('clicks');
  
  const clicksData=[
    {date:'2026-08-26',clicks:342,conversions:8,rate:'2.34%'},
    {date:'2026-08-25',clicks:287,conversions:6,rate:'2.09%'},
    {date:'2026-08-24',clicks:412,conversions:12,rate:'2.91%'},
    {date:'2026-08-23',clicks:198,conversions:4,rate:'2.02%'},
  ];
  const auditLog=[
    {id:'AUD-001',event:'Commission earned',reference:'ORD-1008',amount:'RWF 1,360',date:'2026-08-26'},
    {id:'AUD-002',event:'Link clicked',reference:'REF-MV1-ABC',amount:'—',date:'2026-08-26'},
    {id:'AUD-003',event:'Conversion recorded',reference:'ORD-1012',amount:'RWF 1,980',date:'2026-08-25'},
  ];
  const accountNotices=[
    {message:'Account verified and in good standing',status:'Active',date:'2026-08-20'},
    {message:'No fraud flags detected',status:'Clear',date:'2026-08-20'},
  ];

  const clickColumns=[
    {key:'date',label:'Date'},{key:'clicks',label:'Clicks'},{key:'conversions',label:'Conversions'},
    {key:'rate',label:'Conversion Rate'},
  ];
  const auditColumns=[
    {key:'id',label:'ID'},{key:'event',label:'Event'},{key:'reference',label:'Reference'},
    {key:'amount',label:'Amount'},{key:'date',label:'Date'},
  ];

  return (
    <>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">AFFILIATE PLATFORM</span>
          <h1>Reports</h1>
          <p>Click-through analytics, conversion audits and account status.</p>
        </div>
        <select className="period-select" value={dateRange} onChange={e=>setDateRange(e.target.value)}>
          <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 3 Months</option>
        </select>
      </div>

      <div className="metric-grid">
        <Metric label="Click-through Rate" value="3.2%" icon="chart" sub="Average CTR"/>
        <Metric label="Conversion Rate" value="2.18%" icon="cart" sub="Orders / Clicks"/>
        <Metric label="Revenue Generated" value="RWF 989,000" icon="wallet" sub="Total referred sales"/>
      </div>

      <TabGroup tabs={[{key:'clicks',label:'Click Analytics'},{key:'audit',label:'Conversion Audit'},{key:'account',label:'Account Status'}]} activeTab={tab} onTabChange={setTab}/>

      {tab==='clicks'&&<DataTable columns={clickColumns} rows={clicksData} rowKey={r=>r.date}/>}
      {tab==='audit'&&<DataTable columns={auditColumns} rows={auditLog} rowKey={r=>r.id}/>}
      {tab==='account'&&(
        <div className="data-card">
          {accountNotices.map((n,i)=>(
            <div className="activity-row" key={i}><div><b>{n.message}</b><small>{n.date}</small></div><StatusBadge status={n.status}/></div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── MAIN AFFILIATE DASHBOARD ─────────────────────────────────────────────────

export default function AffiliateDashboard(){
  const path=useLocation().pathname;
  
  if(path.includes('/wallet'))return <DashboardLayout><AffiliateWallet/></DashboardLayout>;
  if(path.includes('/vendors'))return <DashboardLayout><AffiliateVendors/></DashboardLayout>;
  if(path.includes('/reports'))return <DashboardLayout><AffiliateReports/></DashboardLayout>;
  return <DashboardLayout><AffiliateOverview/></DashboardLayout>;
}

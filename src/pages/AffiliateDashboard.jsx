import {useState,useMemo,useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Icon from '../components/Icon';
import TabGroup,{Modal} from '../components/TabGroup';
import {useToast} from '../components/Toast';
import {extractErrorMessage,affiliatesApi,productsApi} from '../API';
import {useAffiliateConversions} from '../hooks/useAffiliateConversions';

const money=n=>new Intl.NumberFormat('en-RW').format(Number(n)||0)+' RWF';
const affiliateUrl=l=>`${window.location.origin}/product/${l.productId}?ref=${l.code}`;
async function copyText(text){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');el.remove();}

// ─── REUSABLE ─────────────────────────────────────────────────────────────────

function Metric({label,value,icon,sub}){
  return <div className="metric"><div className="metric-icon"><Icon name={icon}/></div><div><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>;
}

function StatusBadge({status}){
  const s=String(status||'');
  const cls=['Active','Active Link','Available','Completed','Success','Paid','Approved','Released','Clear','COMPLETED','PAID'].includes(s)?'active':
             ['Suspended','Blocked','Cancelled','Failed','Rejected','Out of stock','REJECTED'].includes(s)?'danger':
             ['Pending','Processing','Draft','Pending review','PENDING','PROCESSING'].includes(s)?'warning':
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
  const toast=useToast();
  const [tab,setTab]=useState('links');
  const [dashboard,setDashboard]=useState({wallet:{available:0,pending:0,totalEarned:0,totalWithdrawn:0},links:[],totalClicks:0,totalConversions:0,payouts:[]});

  useEffect(()=>{
    let active=true;
    affiliatesApi.getMyDashboard().then(res=>{
      if(!active)return;
      const d=res?.data||{};
      setDashboard({
        wallet:d.wallet||{available:0,pending:0,totalEarned:0,totalWithdrawn:0},
        links:Array.isArray(d.links)?d.links:[],
        totalClicks:Number(d.totalClicks)||0,
        totalConversions:Number(d.totalConversions)||0,
        payouts:Array.isArray(d.payouts)?d.payouts:[],
      });
    }).catch(e=>{if(active)toast.error(extractErrorMessage(e));});
    return ()=>{active=false};
  },[]);

  const links=dashboard.links.map(l=>({
    id:l.id,code:l.code,productId:l.productId,product:l.product,productImage:l.productImage,
    price:Number(l.price)||0,clicks:Number(l.clicks)||0,conversions:Number(l.conversions)||0,isActive:l.isActive,createdAt:l.createdAt,
  }));
  const topLinks=[...links].sort((a,b)=>b.clicks-a.clicks).slice(0,5);

  const linkColumns=[
    {key:'product',label:'Product'},
    {key:'code',label:'Referral Code',render:r=><code>{r.code}</code>},
    {key:'clicks',label:'Clicks'},
    {key:'conversions',label:'Conversions'},
    {key:'isActive',label:'Status',render:r=><StatusBadge status={r.isActive?'Active Link':'Inactive'}/>},
  ];
  const topColumns=[
    {key:'product',label:'Product'},{key:'clicks',label:'Clicks'},
    {key:'conversions',label:'Conversions'},{key:'price',label:'Unit Price',render:r=>money(r.price)},
  ];

  const getTabData=()=>{
    switch(tab){
      case 'topLinks':return {columns:topColumns,rows:topLinks};
      default:return {columns:linkColumns,rows:links};
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
        <Metric label="Total Clicks" value={dashboard.totalClicks} icon="chart" sub="Across all links"/>
        <Metric label="Conversions" value={dashboard.totalConversions} icon="cart" sub="Completed referrals"/>
        <Metric label="Pending Earnings" value={money(dashboard.wallet.pending)} icon="wallet" sub="Awaiting completion"/>
        <Metric label="Lifetime Earned" value={money(dashboard.wallet.totalEarned)} icon="wallet" sub="All time commission"/>
      </div>

      <div className="verified-box"><b>✓ Protected commission workflow</b><p>Commission follows purchase → payment → delivery → refund window → confirmation. Once available, it moves into your wallet.</p></div>

      {links.length===0&&<div className="empty-state">No referral links yet. Generate one from the Vendors &amp; Suppliers page.</div>}

      <TabGroup tabs={[{key:'links',label:'My Referral Links',count:links.length},{key:'topLinks',label:'Top Performing Links',count:topLinks.length}]} activeTab={tab} onTabChange={setTab}/>
      
      <DataTable columns={columns} rows={rows} rowKey={r=>r.id||r.code} emptyText="No referral links found."/>
    </>
  );
}

// ─── AFFILIATE WALLET ─────────────────────────────────────────────────────────

function AffiliateWallet(){
  const toast=useToast();
  const [wallet,setWallet]=useState({available:0,pending:0,totalEarned:0,totalWithdrawn:0});
  const [payouts,setPayouts]=useState([]);
  const [withdrawModal,setWithdrawModal]=useState(false);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState('MTN_MOMO');
  const [account,setAccount]=useState('');
  const [submitting,setSubmitting]=useState(false);

  const loadData=async()=>{
    const [d,p]=await Promise.all([affiliatesApi.getMyDashboard(),affiliatesApi.getMyPayouts()]);
    const w=d?.data?.wallet||{available:0,pending:0,totalEarned:0,totalWithdrawn:0};
    setWallet({available:Number(w.available)||0,pending:Number(w.pending)||0,totalEarned:Number(w.totalEarned)||0,totalWithdrawn:Number(w.totalWithdrawn)||0});
    setPayouts((p?.data||[]).map(r=>({
      id:r.id,type:'Withdrawal',source:r.paymentMethod||'Payout',reference:r.number||r.accountDetails||'—',
      amount:-(Number(r.amount)||0),status:r.status||'PENDING',date:String(r.createdAt||'').slice(0,10),
    })));
  };

  useEffect(()=>{
    let active=true;
    loadData().catch(e=>{if(active)toast.error(extractErrorMessage(e));});
    return ()=>{active=false};
  },[]);

  const submitWithdrawal=async()=>{
    const value=Math.round(Number(amount)||0);
    if(!value||value<10000){toast.error('Minimum withdrawal is RWF 10,000.');return;}
    if(value>wallet.available){toast.error('Withdrawal amount is higher than your available balance.');return;}
    if(!account.trim()){toast.error('Please provide a payout account or phone number.');return;}
    setSubmitting(true);
    try{
      await affiliatesApi.requestPayout({amount:value,paymentMethod:method,accountDetails:{phone:account.trim()}});
      await loadData();
      toast.success(`Withdrawal of ${money(value)} requested. It is pending MVEC review.`);
      setWithdrawModal(false);
      setAmount('');
      setAccount('');
    }catch(e){toast.error(extractErrorMessage(e));}
    finally{setSubmitting(false);}
  };

  const txnColumns=[
    {key:'id',label:'Entry'},
    {key:'type',label:'Type'},
    {key:'source',label:'Source'},
    {key:'amount',label:'Amount',render:r=><span className="danger-text">{r.amount<0?'- '+money(Math.abs(r.amount)):money(r.amount)}</span>},
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
        <Metric label="Withdrawn" value={money(wallet.totalWithdrawn)} icon="check" sub="Paid out successfully"/>
      </div>

      <div className="verified-box"><b>✓ Protected payout workflow</b><p>Withdrawals are reviewed and paid on the weekly payout cycle. The ledger shows payout requests from the API, newest first.</p></div>

      <DataTable columns={txnColumns} rows={payouts} rowKey={r=>r.id} emptyText="No wallet activity yet."/>

      <Modal open={withdrawModal} onClose={()=>setWithdrawModal(false)} title="WITHDRAWAL" subtitle="Request a payout">
        <p>Available balance: <b>{money(wallet.available)}</b>. Minimum withdrawal is RWF 10,000.</p>
        <label className="field"><span>Amount (RWF)</span><input type="number" min="10000" max={wallet.available} step="1000" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 50000"/></label>
        <label className="field"><span>Payment method</span><select value={method} onChange={e=>setMethod(e.target.value)}><option value="MTN_MOMO">MTN MoMo</option><option value="AIRTEL_MONEY">Airtel Money</option><option value="BANK_TRANSFER">Bank transfer</option></select></label>
        <label className="field"><span>Account / phone</span><input value={account} onChange={e=>setAccount(e.target.value)} placeholder="+250 7XX XXX XXX"/></label>
        <div className="modal-actions">
          <button className="outline-btn" onClick={()=>setWithdrawModal(false)}>Cancel</button>
          <button className="gradient-btn" onClick={submitWithdrawal} disabled={wallet.available<10000||submitting}>{submitting?'Submitting…':'Submit Request'}</button>
        </div>
      </Modal>
    </>
  );
}

// ─── AFFILIATE VENDORS & SUPPLIERS ────────────────────────────────────────────

function AffiliateVendors(){
  const toast=useToast();
  const [links,setLinks]=useState([]);
  const [products,setProducts]=useState([]);
  const [copied,setCopied]=useState('');
  const [q,setQ]=useState('');
  const [loading,setLoading]=useState(true);

  const loadLinks=async()=>{
    const d=await affiliatesApi.getMyDashboard();
    setLinks(Array.isArray(d?.data?.links)?d.data.links:[]);
  };

  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const [l,pr]=await Promise.all([affiliatesApi.getMyDashboard(),productsApi.getAll({pageSize:100})]);
        if(!active)return;
        setLinks(Array.isArray(l?.data?.links)?l.data.links:[]);
        setProducts(Array.isArray(pr?.products)?pr.products:[]);
      }catch(e){if(active)toast.error(extractErrorMessage(e));}
      finally{if(active)setLoading(false);}
    })();
    return ()=>{active=false};
  },[]);

  const mapProduct=p=>({
    id:p._id,
    name:p.name||'',
    price:Number(p.price)||0,
    vendor:p.vendor?.businessName||p.businessName||'',
    image:p.media?.mainImage||p.media?.images?.[0]||'',
    category:p.category?.name||'',
    stock:p.stockQuantity||0,
  });
  const filteredProducts=useMemo(()=>{
    const list=products.map(mapProduct);
    return q?list.filter(p=>`${p.name} ${p.vendor} ${p.category}`.toLowerCase().includes(q.toLowerCase())):list;
  },[products,q]);

  const createLink=async(product)=>{
    try{
      await affiliatesApi.generateLink({productId:product.id});
      await loadLinks();
      toast.success('Referral link created.');
    }catch(e){toast.error(extractErrorMessage(e));}
  };

  const terminateLink=()=>{
    toast.info('Link termination is not yet available through the API. Contact support to deactivate a link.');
  };

  const copyFor=async(product)=>{
    const link=links.find(l=>String(l.productId)===String(product.id));
    if(!link)return;
    await copyText(affiliateUrl(link));
    setCopied(String(product.id));
    setTimeout(()=>setCopied(''),1600);
  };

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

      {loading?(
        <div className="data-row table-empty">Loading products…</div>
      ):filteredProducts.length===0?(
        <div className="empty-state">No active products are available through the API yet.</div>
      ):(
        <div className="dash-grid affiliate-product-grid">
          {filteredProducts.slice(0,12).map(product=>{
            const link=links.find(l=>String(l.productId)===String(product.id));
            const hasLink=!!link;
            return (
              <div className="data-card affiliate-product-card" key={product.id}>
                <div className="admin-product-main">
                  {product.image?<img src={product.image} alt=""/>:<div className="product-placeholder"><Icon name="box"/></div>}
                  <div><b>{product.name}</b><small>{money(product.price)}{product.vendor?` · ${product.vendor}`:''}</small></div>
                </div>
                <div className="affiliate-product-meta">
                  <span>Stock <b>{product.stock} units</b></span>
                  <span>Commission <b>2%</b></span>
                </div>
                <div className="affiliate-status-row">
                  <StatusBadge status={hasLink?'Active Link':'No Link Generated'}/>
                </div>
                <div className="affiliate-link-actions">
                  {hasLink?(
                    <>
                      <button className="outline-btn copy-link-btn" onClick={()=>copyFor(product)}><Icon name="copy" size={15}/>{copied===String(product.id)?'Copied!':'Copy Link'}</button>
                      <button className="terminate-link-btn" onClick={terminateLink}><Icon name="trash" size={15}/>Terminate Link</button>
                    </>
                  ):(
                    <button className="gradient-btn" onClick={()=>createLink(product)}><Icon name="link" size={15}/>Create Link</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── AFFILIATE REPORTS ────────────────────────────────────────────────────────

const fmtDateTime=d=>{
  if(!d)return '—';
  const date=new Date(d);
  if(isNaN(date))return String(d);
  return date.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+' · '+date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
};

const convStatus=s=>{
  const v=String(s||'PENDING').toUpperCase();
  if(v==='PENDING')return 'Pending';
  if(v==='PAID')return 'Paid';
  if(v==='APPROVED')return 'Approved';
  return 'Rejected';
};

const SAMPLE_CONVERSIONS=[
  {id:'sample-conv-1',referralCode:'AFF-8F2A-D3E5',product:'Samsung Galaxy S25',conversionValue:425000,commissionEarned:2125,status:'APPROVED',convertedAt:new Date(Date.now()-2*86400000).toISOString()},
  {id:'sample-conv-2',referralCode:'AFF-1B9C-44AA',product:'Airtel 4G Modem',conversionValue:95000,commissionEarned:475,status:'PENDING',convertedAt:new Date(Date.now()-5*86400000).toISOString()},
  {id:'sample-conv-3',referralCode:'AFF-8F2A-D3E5',product:'MTN Airtime Bundle',conversionValue:50000,commissionEarned:250,status:'PAID',convertedAt:new Date(Date.now()-9*86400000).toISOString()},
  {id:'sample-conv-4',referralCode:'AFF-C774-02AA',product:'Canvas Sneakers',conversionValue:180000,commissionEarned:900,status:'REJECTED',convertedAt:new Date(Date.now()-14*86400000).toISOString()},
];

function ConversionAuditTable({items,sample}){
  const columns=[
    {key:'convertedAt',label:'Timestamp',render:r=><span className="muted">{fmtDateTime(r.convertedAt)}</span>},
    {key:'link',label:'Referral Link',render:r=>(
      <div className="audit-link">
        <code>{r.referralCode}</code>
        {sample&&<em style={{fontStyle:'italic',opacity:.55,fontSize:10}}>SNEAK PEEK</em>}
        <small className="muted">{r.product}</small>
      </div>
    )},
    {key:'conversionValue',label:'Conversion Value',render:r=>money(r.conversionValue)},
    {key:'commissionEarned',label:'Commission Earned',render:r=><b>{money(r.commissionEarned)}</b>},
    {key:'status',label:'Status',render:r=><StatusBadge status={convStatus(r.status)}/>},
  ];
  return (
    <div className="data-card">
      <div className="data-card-head">
        <div className="dash-toolbar" style={{width:'100%',justifyContent:'space-between'}}>
          <h3>Conversion Audit Log</h3>
          <span className="table-count">{items.length} event{items.length===1?'':'s'}</span>
        </div>
      </div>
      {sample&&(
        <div className="sample-banner" style={{margin:'0 16px 8px',padding:'8px 12px',border:'1px dashed #64748b',borderRadius:8,color:'#94a3b8',fontSize:12,display:'flex',alignItems:'center',gap:6}}>
          <Icon name="info" size={13}/> Sample preview matching the target API schema — not live data.
        </div>
      )}
      <div className="data-table">
        <div className="data-row table-header">
          {columns.map(col=><span key={col.key} className="table-label">{col.label}</span>)}
        </div>
        {items.map(r=>(
          <div className="data-row" key={r.id}>
            {columns.map(col=><span key={col.key}>{col.render?col.render(r):r[col.key]}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function AffiliateReports(){
  const [dateRange,setDateRange]=useState('30');
  const [tab,setTab]=useState('clicks');
  const [rows,setRows]=useState([]);
  const [dashboard,setDashboard]=useState({});

  const {data:conversions,isLoading:convLoading}=useAffiliateConversions();
  const convList=Array.isArray(conversions)?conversions:[];
  const totalCommission=convList.reduce((s,c)=>s+(Number(c.commissionEarned)||0),0);

  useEffect(()=>{
    let active=true;
    affiliatesApi.getMyDashboard().then(d=>{
      if(!active)return;
      const data=d?.data||{};
      const links=Array.isArray(data.links)?data.links:[];
      setDashboard(data);
      setRows([
        {metric:'Total Clicks',value:Number(data.totalClicks)||0,note:'Aggregated across all links'},
        {metric:'Total Conversions',value:Number(data.totalConversions)||convList.length,note:'Completed referrals'},
        {metric:'Active Links',value:links.filter(l=>l.isActive).length,note:'Currently generating referral traffic'},
      ]);
    }).catch(()=>{});
    return ()=>{active=false};
  },[]);

  const totalClicks=Number(dashboard.totalClicks)||0;
  const totalConversions=Number(dashboard.totalConversions)||convList.length;
  const conversionRate=totalClicks>0?Math.round((totalConversions/totalClicks)*1000)/10:0;

  const clickColumns=[
    {key:'metric',label:'Metric'},{key:'value',label:'Value'},{key:'note',label:'Note'},
  ];

  const accountRows=[
    {metric:'Active Referral Links',value:(dashboard.links||[]).filter(l=>l.isActive).length,note:'Links live and accepting clicks'},
    {metric:'Pending Payout Requests',value:(dashboard.payouts||[]).filter(p=>String(p.status||'').toUpperCase()==='PENDING').length,note:'Awaiting MVEC review'},
    {metric:'Wallet Balance (Available)',value:money(dashboard.wallet?.available||0),note:'Cleared for withdrawal'},
    {metric:'Lifetime Earnings',value:money(totalCommission),note:'Cumulative commission from recorded conversions'},
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

      <div className="metric-grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}>
        <Metric label="Total Clicks" value={totalClicks} icon="chart" sub={totalClicks>0?`Across ${(dashboard.links||[]).length} links`:'Awaiting click data'}/>
        <Metric label="Conversions" value={totalConversions} icon="cart" sub={`${convList.length} in this audit log`}/>
        <Metric label="Conversion Rate" value={`${conversionRate}%`} icon="arrow" sub="Clicks → confirmed orders"/>
        <Metric label="Commission Earned" value={money(totalCommission)} icon="wallet" sub="From recorded conversions"/>
      </div>

      <TabGroup tabs={[{key:'clicks',label:'Click Analytics'},{key:'audit',label:'Conversion Audit'},{key:'account',label:'Account Status'}]} activeTab={tab} onTabChange={setTab}/>

      {tab==='clicks'&&<DataTable columns={clickColumns} rows={rows} rowKey={r=>r.metric} emptyText="Click analytics are loading — pull new traffic with your referral links to see metrics here."/>}
      {tab==='audit'&&(
        convLoading?(
          <div className="data-card"><div className="data-row table-empty">Loading conversion audit…</div></div>
        ):convList.length===0?(
          <>
            <div className="empty-state">
              <Icon name="cart" size={34}/>
              <b>No conversions recorded yet</b>
              <p>Qualifying orders will appear here with the referral code, conversion value and commission earned.</p>
            </div>
            <ConversionAuditTable items={SAMPLE_CONVERSIONS} sample/>
          </>
        ):(
          <ConversionAuditTable items={convList}/>
        )
      )}
      {tab==='account'&&<DataTable columns={clickColumns} rows={accountRows} rowKey={r=>r.metric} emptyText="Account status is not yet available through the API."/>}
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
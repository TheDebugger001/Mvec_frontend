import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import SmartTable from "../components/SmartTable";
import {getPeriodChart,getPeriodLabels,getPeriodMetrics} from "../services/analytics";
import {useToast} from "../components/Toast";

// -----------------------------------------------------------------------------
// Marketplace data
// -----------------------------------------------------------------------------

const users = [
  {
    name: "Aline Uwase",
    email: "buyer@mvec.rw",
    role: "Buyer",
    status: "Active",
  },
  {
    name: "Eric Mugabo",
    email: "vendor@mvec.rw",
    role: "Vendor",
    status: "Active",
  },
  {
    name: "Jean Paul",
    email: "jean@mvec.rw",
    role: "Buyer",
    status: "Active",
  },
  {
    name: "MVEC Administrator",
    email: "admin@mvec.rw",
    role: "Super Admin",
    status: "Active",
  },
];

const vendors = [
  {
    id: 1,
    name: "Kigali Tech Store",
    category: "Electronics",
    products: 48,
    rating: 4.8,
  },
  {
    id: 2,
    name: "Fashion Rwanda",
    category: "Fashion",
    products: 36,
    rating: 4.6,
  },
  {
    id: 3,
    name: "Home & Living RW",
    category: "Home",
    products: 29,
    rating: 4.7,
  },
  {
    id: 4,
    name: "Smart Gadgets",
    category: "Electronics",
    products: 21,
    rating: 4.5,
  },
];

const products = [
  {
    id: 1,
    name: "Samsung Galaxy S25",
    vendor: "Kigali Tech Store",
    price: 850000,
    stock: 25,
  },
  {
    id: 2,
    name: "iPhone 16 Pro",
    vendor: "Kigali Tech Store",
    price: 1450000,
    stock: 12,
  },
  {
    id: 3,
    name: "Nike Air Max",
    vendor: "Fashion Rwanda",
    price: 95000,
    stock: 32,
  },
  {
    id: 4,
    name: "Wireless Headphones",
    vendor: "Smart Gadgets",
    price: 65000,
    stock: 18,
  },
  {
    id: 5,
    name: "Smart Watch",
    vendor: "Smart Gadgets",
    price: 120000,
    stock: 9,
  },
];

const categories = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Beauty",
  "Phones",
  "Computers",
  "Sports",
  "Automotive",
];

const demoOrders = [
  {
    id: "MVEC-10452",
    buyer: "Aline Uwase",
    vendor: "Kigali Tech Store",
    total: 850000,
    payment: "SUCCESS",
    status: "Delivered",
  },
  {
    id: "MVEC-10451",
    buyer: "Jean Paul",
    vendor: "Fashion Rwanda",
    total: 190000,
    payment: "SUCCESS",
    status: "Shipped",
  },
  {
    id: "MVEC-10450",
    buyer: "Diane Mukamana",
    vendor: "Smart Gadgets",
    total: 185000,
    payment: "PENDING",
    status: "Processing",
  },
  {
    id: "MVEC-10449",
    buyer: "Patrick Niyonzima",
    vendor: "Home & Living RW",
    total: 320000,
    payment: "SUCCESS",
    status: "Confirmed",
  },
  {
    id: "MVEC-10448",
    buyer: "Grace Uwimana",
    vendor: "Fashion Rwanda",
    total: 145000,
    payment: "SUCCESS",
    status: "Delivered",
  },
];

const adminStats = {
  orders: 428,
  vendors: 86,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function money(value) {
  return new Intl.NumberFormat("en-RW").format(value) + " RWF";
}

// -----------------------------------------------------------------------------
// Metric
// -----------------------------------------------------------------------------

function Metric({ label, value, change, icon }) {
  return (
    <div className="metric">
      <div className="metric-icon">
        <Icon name={icon} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className="positive">{change}</small>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Generic Admin Table
// -----------------------------------------------------------------------------

function GenericAdminTable({ title, subtitle, type }) {
  let rows;
  if(type==='users') rows=users.map((u,i)=>({...u,id:u.id||`USR-${i+1}`}));
  else if(type==='vendors') rows=vendors.map(v=>({...v,status:v.status||'Approved'}));
  else if(type==='products') rows=products.map(p=>({...p,status:p.status||'Published'}));
  else if(type==='categories') rows=categories.map((name,index)=>({id:index+1,name,products:[148,122,98,86,72,64,54,41][index]||35,status:'Active'}));
  else if(type==='orders') rows=demoOrders;
  else rows=users;

  const storageKey=`mvec_admin_${type}`;
  const normalize=(saved)=>{
    if(type!=='vendors') return saved;
    return saved.map((item,index)=>{const seed=vendors.find(v=>v.id===item.id||v.name===item.name)||vendors[index]||{};return {...seed,...item,category:item.category||seed.category||'General',products:Number(item.products??seed.products??products.filter(p=>p.vendor===item.name).length),rating:item.rating||seed.rating||0,status:item.status||'Approved'};});
  };
  const [list,setList]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey));return normalize(saved||rows)}catch{return normalize(rows)}});
  const [editing,setEditing]=useState(null); const [viewing,setViewing]=useState(null);
  const toast=useToast();
  const readOnly=type==='users'||type==='vendors';
  const persist=next=>{setList(next);localStorage.setItem(storageKey,JSON.stringify(next))};
  const addNew=()=>{
    if(type==='products')setEditing({id:`NEW-${Date.now()}`,name:'',vendor:'',price:0,stock:0,status:'Draft'});
    else if(type==='categories')setEditing({id:`NEW-${Date.now()}`,name:'',products:0,status:'Active'});
    else if(type==='orders')setEditing({id:`NEW-${Date.now()}`,buyer:'',vendor:'',total:0,payment:'PENDING',status:'Processing'});
  };
  const columns= type==='users' ? [
    {key:'name',label:'User'},{key:'email',label:'Email'},{key:'role',label:'Role'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='Active'?'active':'warning')}>{r.status}</em>}
  ] : type==='vendors' ? [
    {key:'name',label:'Store'},{key:'category',label:'Category'},{key:'products',label:'Products'},{key:'rating',label:'Rating',render:r=>`★ ${r.rating}`},{key:'status',label:'Status',render:r=><em className="status active">{r.status||'Approved'}</em>}
  ] : type==='products' ? [
    {key:'name',label:'Product'},{key:'vendor',label:'Vendor'},{key:'price',label:'Price',render:r=>money(r.price)},{key:'stock',label:'Stock'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='Published'?'active':'warning')}>{r.status}</em>}
  ] : type==='orders' ? [
    {key:'id',label:'Order'},{key:'buyer',label:'Buyer'},{key:'vendor',label:'Vendor'},{key:'total',label:'Total',render:r=>money(r.total)},{key:'payment',label:'Payment',render:r=><em className={'status '+(r.payment==='SUCCESS'?'active':'warning')}>{r.payment}</em>},{key:'status',label:'Status'}
  ] : [
    {key:'name',label:'Category'},{key:'products',label:'Products'},{key:'status',label:'Status',render:r=><em className={'status '+(r.status==='Active'?'active':'warning')}>{r.status}</em>}
  ];
  return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">SUPER ADMIN</span><h1>{title}</h1><p>{subtitle}</p></div>{!readOnly&&<button className="gradient-btn" onClick={addNew}><Icon name="plus"/> Add new</button>}</div>{readOnly&&<div className="verified-box"><b>Account data is protected</b><p>Administrators can review account information here, but personal identity fields such as names and email addresses are not editable from this page.</p></div>}<div className="data-card"><div className="data-card-head"><div><h3>{title}</h3><span>{list.length} records</span></div><span className="muted">{readOnly?'View-only account records':'Marketplace management records'}</span></div><SmartTable columns={columns} rows={list} rowKey={(r,i)=>r.id||r.email||r.name||i} searchPlaceholder={`Search ${title.toLowerCase()}…`} exportName={`admin-${type}`} actions={readOnly?(item=><button className="table-action-btn" onClick={()=>setViewing(item)}><Icon name="eye"/> View</button>):(item=><><button title="Edit" onClick={()=>setEditing(item)}><Icon name="edit"/></button>{type!=='orders'&&<button title="Delete" onClick={()=>{if(window.confirm(`Delete ${item.name||item.id}?`))persist(list.filter(x=>x!==item))}}><Icon name="trash"/></button>}</>)}/></div>{editing&&<AdminEditModal value={editing} isNew={String(editing.id).startsWith('NEW-')} onCancel={()=>setEditing(null)} onSave={next=>{const isNew=String(editing.id).startsWith('NEW-');persist(isNew?[{...next,id:Date.now()},...list]:list.map(x=>x===editing?next:x));setEditing(null);toast.success(isNew?'Record added.':'Record saved.')}}/>}{viewing&&type==='vendors'&&<VendorQuickView vendor={viewing} onClose={()=>setViewing(null)}/>} {viewing&&type==='users'&&<AdminRecordView title="User account" record={viewing} onClose={()=>setViewing(null)}/>}</DashboardLayout>;
}

function AdminRecordView({title,record,onClose}){return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">ACCOUNT REVIEW</span><h2>{title}</h2><div className="vendor-detail-grid">{Object.entries(record).filter(([k])=>k!=='id').map(([k,v])=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><b>{String(v)}</b></div>)}</div><button className="gradient-btn" onClick={onClose}>Done</button></div></div>}

function VendorQuickView({vendor,onClose}){return <div className="modal-backdrop"><div className="modal vendor-view-modal"><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">VENDOR PROFILE</span><h2>{vendor.name}</h2><p>MVEC marketplace vendor overview.</p><div className="vendor-detail-grid"><div><span>Category</span><b>{vendor.category}</b></div><div><span>Products</span><b>{vendor.products}</b></div><div><span>Rating</span><b>★ {vendor.rating}</b></div><div><span>Status</span><b className="status active">Approved</b></div><div><span>Vendor ID</span><b>VND-{String(vendor.id).padStart(4,'0')}</b></div><div><span>Trust</span><b>Verified ✓</b></div></div><div className="verified-box"><b>🔒 Protected settlement</b><p>Eligible order funds are shown as held by MVEC until delivery confirmation and release according to the marketplace workflow.</p></div><button className="gradient-btn" onClick={onClose}>Done</button></div></div>}
function DeleteVendorModal({vendor,onCancel,onDelete}){return <div className="modal-backdrop"><div className="modal confirm-modal"><button className="modal-close" onClick={onCancel}>×</button><div className="danger-icon">!</div><h2>Delete this vendor?</h2><p>You are about to delete <strong>{vendor.name}</strong>. This action removes the vendor from the marketplace records. Are you sure you want to continue?</p><div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="danger-btn" onClick={onDelete}>Yes, delete vendor</button></div></div></div>}

const ADMIN_EDIT_ENUMS={
 status:['Active','Draft','Published','Archived','Processing','Completed','Pending','Cancelled','Suspended'],
 payment:['SUCCESS','PENDING','FAILED','REFUNDED'],
 settlement:['HELD','RELEASED','PENDING'],
 role:['buyer','vendor','supplier','affiliate','delivery','super_admin'],
 billing:['Monthly','Yearly'],
};

function AdminEditModal({value,isNew,onCancel,onSave}){
 const [row,setRow]=useState(value);
 const fields=Object.keys(row).filter(k=>k!=="id" && k!=="image");
 return <div className="modal-backdrop"><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onCancel}>×</button><h2>{isNew?"Add":"Edit"} record</h2><p>Update the marketplace record and save your changes.</p>{fields.map(k=>{const opts=ADMIN_EDIT_ENUMS[k.toLowerCase()];return opts?<label className="field" key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><select value={row[k]??""} onChange={e=>setRow({...row,[k]:e.target.value})}>{[<option key="_" value="">Select…</option>,...opts.map(o=><option key={o} value={o}>{o}</option>)]}</select></label>:<label className="field" key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><input value={row[k]??""} onChange={e=>setRow({...row,[k]:e.target.value})}/></label>})}<div className="modal-actions"><button className="outline-btn" onClick={onCancel}>Cancel</button><button className="gradient-btn" onClick={()=>onSave(row)}>Save changes</button></div></div></div>;
}

function AdminReports(){const [period,setPeriod]=useState('30 Days');const metrics=getPeriodMetrics(period);const rows=[['Marketplace revenue',period,money(metrics.sales)],['Vendor sales',period,money(Math.round(metrics.sales*.696))],['Transactions',period,metrics.orders],['Refunds',period,Math.max(1,Math.round(metrics.orders*.033))],['Platform commission',period,money(Math.round(metrics.sales*.1496))]].map(r=>({report:r[0],range:r[1],summary:r[2]}));return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Reports</h1><p>Platform-wide revenue, vendors, orders, payments and marketplace performance.</p></div><select className="period-select" value={period} onChange={e=>setPeriod(e.target.value)}><option>30 Days</option><option>3 Months</option><option>1 Year</option></select></div><div className="metric-grid"><Metric label="Revenue" value={money(metrics.sales)} change={`${period} revenue`} icon="chart"/><Metric label="Orders" value={metrics.orders} change={`${period} orders`} icon="cart"/><Metric label="Vendors" value="86" change="Active marketplace vendors" icon="shop"/><Metric label="Commission" value={money(Math.round(metrics.sales*.1496))} change={`${period} commission`} icon="wallet"/></div><div className="data-card"><div className="data-card-head"><div><h3>Platform reports</h3><span>{period} reporting data</span></div></div><SmartTable columns={[{key:'report',label:'Report',render:r=><b>{r.report}</b>},{key:'range',label:'Range'},{key:'summary',label:'Summary'}]} rows={rows} rowKey={r=>r.report} searchPlaceholder="Search reports…" exportName="admin-platform-reports"/></div></DashboardLayout>}
function AdminSettings(){const initial={marketplaceName:'MVEC',currency:'RWF',vendorApproval:'Manual',commission:'10%',cancellation:'24 hours',reviews:'Required',orders:'Enabled',shipping:'Enabled',payouts:'Enabled'};const [settings,setSettings]=useState(()=>{try{return JSON.parse(localStorage.getItem('mvec_admin_settings'))||initial}catch{return initial}});const [saved,setSaved]=useState(false);const toast=useToast();const u=(key,value)=>setSettings(s=>({...s,[key]:value}));const save=()=>{localStorage.setItem('mvec_admin_settings',JSON.stringify(settings));setSaved(true);setTimeout(()=>setSaved(false),1800);toast.success('Platform settings saved.')};return <DashboardLayout admin><div className="dash-page-head"><div><span className="eyebrow">ADMIN CONTROL</span><h1>Platform Settings</h1><p>Configure marketplace-wide rules and system behavior.</p></div><button className="gradient-btn" onClick={save}>Save changes</button></div>{saved&&<div className="success-text">Platform settings saved.</div>}<div className="settings-grid"><div className="data-card"><h3>Marketplace</h3><label className="field"><span>Marketplace name</span><input value={settings.marketplaceName} onChange={e=>u('marketplaceName',e.target.value)}/></label><label className="field"><span>Default currency</span><select value={settings.currency} onChange={e=>u('currency',e.target.value)}><option>RWF</option><option>USD</option></select></label><label className="field"><span>Vendor approval</span><select value={settings.vendorApproval} onChange={e=>u('vendorApproval',e.target.value)}><option>Manual</option><option>Automatic</option></select></label></div><div className="data-card"><h3>Commerce rules</h3><label className="field"><span>Platform commission</span><input value={settings.commission} onChange={e=>u('commission',e.target.value)}/></label><label className="field"><span>Order cancellation window</span><input value={settings.cancellation} onChange={e=>u('cancellation',e.target.value)}/></label><label className="field"><span>Reviews moderation</span><select value={settings.reviews} onChange={e=>u('reviews',e.target.value)}><option>Required</option><option>Optional</option></select></label></div><div className="data-card"><h3>Notifications</h3><label className="field"><span>Order notifications</span><select value={settings.orders} onChange={e=>u('orders',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Shipping notifications</span><select value={settings.shipping} onChange={e=>u('shipping',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label><label className="field"><span>Payout notifications</span><select value={settings.payouts} onChange={e=>u('payouts',e.target.value)}><option>Enabled</option><option>Disabled</option></select></label></div></div></DashboardLayout>}

// -----------------------------------------------------------------------------
// Admin Dashboard
// -----------------------------------------------------------------------------

export default function AdminDashboard() {const [chartPeriod,setChartPeriod]=useState('30'); const [createOpen,setCreateOpen]=useState(false); const chartKey=chartPeriod==='7'?'7 Days':chartPeriod==='30'?'30 Days':chartPeriod==='90'?'3 Months':'1 Year'; const chart=getPeriodChart(chartKey); const labels=getPeriodLabels(chartKey); const periodMetrics=getPeriodMetrics(chartKey);
  const location = useLocation();
  const path = location.pathname;

  // ---------------------------------------------------------------------------
  // Admin management pages
  // ---------------------------------------------------------------------------

  if (path.includes("/reports")) return <AdminReports />;
  if (path.includes("/settings")) return <AdminSettings />;

  if (path !== "/admin") {
    let type = "users";
    let title = "Users";

    if (path.includes("users")) {
      type = "users";
      title = "Users";
    } else if (path.includes("vendors")) {
      type = "vendors";
      title = "Vendors";
    } else if (path.includes("products")) {
      type = "products";
      title = "Products";
    } else if (path.includes("categories")) {
      type = "categories";
      title = "Categories";
    } else if (path.includes("orders")) {
      type = "orders";
      title = "Orders";
    } else {
      type = "users";
      title = "Settings";
    }

    return (
      <GenericAdminTable
        type={type}
        title={title}
        subtitle="Manage marketplace records and platform operations."
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Main admin dashboard
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout admin>
      <div className="dash-page-head">
        <div>
          <span className="eyebrow">
            SUPER ADMIN DASHBOARD
          </span>

          <h1>
            Good morning, Administrator 👋
          </h1>

          <p>
            Monitor the entire MVEC marketplace from
            one control center.
          </p>
        </div>

        <button className="gradient-btn" onClick={()=>setCreateOpen(true)}>
          <Icon name="plus" />
          Create record
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="metric-grid">
        <Metric
          label="Gross sales"
          value={money(periodMetrics.sales)}
          change={`${chartKey} revenue`}
          icon="chart"
        />

        <Metric
          label="Orders"
          value={periodMetrics.orders}
          change={`${chartKey} orders`}
          icon="cart"
        />

        <Metric
          label="Customers"
          value={periodMetrics.customers}
          change={`${chartKey} active customers`}
          icon="users"
        />

        <Metric
          label="Vendors"
          value={periodMetrics.activeVendors}
          change="Active in selected period"
          icon="shop"
        />
      </div>

      {/* CHART + PLATFORM ACTIVITY */}
      <div className="dash-grid">
        <div className="data-card chart-card">
          <div className="data-card-head">
            <div>
              <h3>Marketplace revenue</h3>

              <span>
                All sellers · last 30 days
              </span>
            </div>

            <select value={chartPeriod} onChange={e=>setChartPeriod(e.target.value)}>
              <option value="7">
                7 days
              </option>

              <option value="30">
                30 days
              </option>

              <option value="90">
                3 months
              </option>

              <option value="365">
                1 year
              </option>
            </select>
          </div>

          <div className="fake-chart">
            {chart.map((height, index) => (
              <div
                key={index}
                style={{
                  height: `${height}%`,
                }}
              >
                <span>{labels[index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="data-card">
          <div className="data-card-head">
            <div>
              <h3>Platform activity</h3>

              <span>
                Live operational snapshot
              </span>
            </div>
          </div>

          {[
            [
              "Vendor approvals",
              "6 pending",
              "warning",
            ],
            [
              "Product moderation",
              "14 pending",
              "warning",
            ],
            [
              "Payment success",
              "96.8%",
              "active",
            ],
            [
              "Disputes",
              "3 open",
              "warning",
            ],
          ].map((item) => (
            <div
              className="activity-row"
              key={item[0]}
            >
              <div>
                <b>{item[0]}</b>

                <small>
                  Marketplace operations
                </small>
              </div>

              <em
                className={`status ${item[2]}`}
              >
                {item[1]}
              </em>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT ORDERS */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Recent orders</h3>

            <span>
              Across all vendors
            </span>
          </div>

          <Link to="/admin/orders">
            View all
          </Link>
        </div>

        {demoOrders.map((order) => (
          <div
            className="activity-row"
            key={order.id}
          >
            <div>
              <b>
                <Link
                  to={`/orders/${order.id}`}
                >
                  {order.id}
                </Link>
              </b>

              <small>
                {order.buyer} · {order.vendor}
              </small>
            </div>

            <div>
              <strong>
                {money(order.total)}
              </strong>

              <em
                className={`status ${
                  order.payment === "SUCCESS"
                    ? "active"
                    : "warning"
                }`}
              >
                {order.status}
              </em>
            </div>
          </div>
        ))}
      </div>

      {/* CATEGORY HEALTH */}
      <div className="data-card">
        <div className="data-card-head">
          <div>
            <h3>Category health</h3>

            <span>
              Products by category
            </span>
          </div>

          <Link to="/admin/categories">
            Manage
          </Link>
        </div>

        {categories
          .slice(0, 6)
          .map((category, index) => {
            const percentages = [
              84,
              72,
              61,
              55,
              44,
              38,
            ];

            const productCounts = [
              148,
              122,
              98,
              86,
              72,
              64,
            ];

            return (
              <div
                className="progress-row"
                key={category}
              >
                <span>{category}</span>

                <div>
                  <i
                    style={{
                      width: `${percentages[index]}%`,
                    }}
                  />
                </div>

                <b>
                  {productCounts[index]}
                </b>
              </div>
            );
          })}
      </div>
      {createOpen&&<div className="modal-backdrop" onMouseDown={()=>setCreateOpen(false)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setCreateOpen(false)}>×</button><span className="eyebrow">CREATE RECORD</span><h2>Choose a record type</h2><p>Create marketplace records from the correct management area.</p><div className="quick-actions"><Link to="/admin/products" onClick={()=>setCreateOpen(false)}><span><Icon name="box"/></span><div><b>Product</b><small>Add or manage a product record</small></div></Link><Link to="/admin/categories" onClick={()=>setCreateOpen(false)}><span><Icon name="tag"/></span><div><b>Category</b><small>Add or manage a category</small></div></Link><Link to="/admin/orders" onClick={()=>setCreateOpen(false)}><span><Icon name="cart"/></span><div><b>Order</b><small>Review order records</small></div></Link></div></div></div>}
    </DashboardLayout>
  );
}
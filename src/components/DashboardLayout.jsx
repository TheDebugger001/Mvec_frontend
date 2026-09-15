import {useState,useEffect,useRef} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import Icon from './Icon';
import {products,vendors} from '../data';

export default function DashboardLayout({admin=false,children}){
  const {user,logout,effectiveRole,switchRole}=useAuth();
  const loc=useLocation();
  const navigate=useNavigate();
  const {theme,toggleTheme}=useTheme();
  const displayRole=admin?'super_admin':effectiveRole||user?.role||'default';
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [roleDropdown,setRoleDropdown]=useState(false);
  const avatar=localStorage.getItem('mvec_profile_image')||'';
  const roleRef=useRef(null);

  useEffect(()=>{
    if(!roleDropdown)return;
    const handler=(e)=>{
      if(roleRef.current&&!roleRef.current.contains(e.target))setRoleDropdown(false);
    };
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[roleDropdown]);

  // MINIMAL NAVIGATION: Only 4-5 items per role
  const adminItems={groups:[
    {name:'Main',icon:'grid',items:[['/admin','Overview','grid'],['/admin/wallet','Wallet & Ledger','wallet'],['/admin/users','Users & Stores','users'],['/admin/reports','Reports & Cases','chart']]}
  ]};

  const seller={groups:[
    {name:'Main',icon:'grid',items:[['/vendor','Overview','grid'],['/vendor/wallet','Wallet','wallet'],['/vendor/suppliers','Suppliers','shop'],['/vendor/products','Products','box'],['/vendor/reports','Reports','chart']]}
  ]};

  const supplier={groups:[
    {name:'Main',icon:'grid',items:[['/supplier','Overview','grid'],['/supplier/wallet','Wallet','wallet'],['/supplier/vendors','Vendors','users'],['/supplier/products','Products','box'],['/supplier/reports','Reports','chart']]}
  ]};

  const affiliate={groups:[
    {name:'Main',icon:'grid',items:[['/affiliate','Overview','grid'],['/affiliate/wallet','Wallet','wallet'],['/affiliate/vendors','Partners','users'],['/affiliate/reports','Reports','chart']]}
  ]};

  const delivery={groups:[
    {name:'Main',icon:'grid',items:[['/delivery','Overview','grid'],['/delivery/deliveries','My Deliveries','box'],['/delivery/earnings','Earnings','wallet'],['/delivery/messages','Messages','users']]}
  ]};

  const role=displayRole;
  const items=admin&&displayRole!=='super_admin'?adminItems:role==='supplier'?supplier:role==='affiliate'?affiliate:role==='delivery'?delivery:role==='super_admin'?adminItems:seller;

  const searchResults=search.trim()
    ?[...products.filter(p=>`${p.name} ${p.brand||''} ${p.vendor||''} ${p.category||''}`.toLowerCase().includes(search.toLowerCase())).slice(0,4),
      ...vendors.filter(v=>`${v.name} ${v.category}`.toLowerCase().includes(search.toLowerCase())).slice(0,2)]
    :[];

  const goGlobalSearch=()=>{
    if(search.trim())navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className={'dashboard-shell '+(open?'sidebar-open':'')}>
      <aside className="dashboard-sidebar">
        <div className="dash-logo">
          <Link to="/">MVEC</Link>
          <span>{admin?'ADMIN CONTROL':role==='supplier'?'SUPPLIER PLATFORM':role==='affiliate'?'AFFILIATE PLATFORM':role==='delivery'?'DELIVERY PLATFORM':'SELLER PLATFORM'}</span>
        </div>

        <nav>
          {items.groups?items.groups.map(g=>(
            <div className="sidebar-group" key={g.name}>
              <div className="sidebar-group-items">
                {g.items.map(([href,label,icon])=>(
                  <Link
                    onClick={()=>setOpen(false)}
                    className={loc.pathname===href?'active':''}
                    key={href}
                    to={href}
                  >
                    <Icon name={icon}/>
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )):items.map(([href,label,icon])=>(
            <Link
              onClick={()=>setOpen(false)}
              className={loc.pathname===href?'act':''}
              key={href}
              to={href}
            >
              <Icon name={icon}/>
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={toggleTheme}>
            <Icon name={theme==='dark'?'sun':'moon'}/>
            <span>{theme==='dark'?'Light mode':'Dark mode'}</span>
          </button>
          <button className="sidebar-footer-btn logout-btn" onClick={()=>{logout();navigate('/login')}}>
            <Icon name="logout"/>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dash-header">
          <button className="mobile-menu" onClick={()=>setOpen(!open)}>
            <Icon name="menu"/>
          </button>
          <div className="dash-search">
            <Icon name="search"/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&goGlobalSearch()}
              placeholder="Search products, vendors, orders…"
            />
            {searchResults.length>0&&(
              <div className="search-dropdown">
                {searchResults.map(p=>(
                  <Link
                    key={p.id||p.name}
                    to={p.sku?`/product/${p.id}`:`/vendors/${p.id}`}
                    className="search-result"
                    onClick={()=>setSearch('')}
                  >
                    <b>{p.name}</b>
                    <small>{p.category||p.brand||''}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="dash-header-actions">
            {user?.role==='super_admin'&&(
              <div className="role-switcher" ref={roleRef}>
                <button className="role-switcher-btn" onClick={()=>setRoleDropdown(!roleDropdown)}>
                  <Icon name="users"/>
                  <span>{displayRole==='super_admin'?'Admin':displayRole==='vendor'?'Vendor':displayRole==='supplier'?'Supplier':displayRole==='affiliate'?'Affiliate':'Delivery'}</span>
                  <Icon name="chevron"/>
                </button>
                {roleDropdown&&(
                  <div className="role-switcher-dropdown">
                    {['super_admin','vendor','supplier','affiliate'].map(r=>(
                      <button
                        key={r}
                        className={'role-option'+(displayRole===r?' active':'')}
                        onClick={()=>{switchRole(r);setRoleDropdown(false);navigate(r==='super_admin'?'/admin':`/${r}`)}}
                      >
                        {r==='super_admin'?'Admin':r.charAt(0).toUpperCase()+r.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Link to={`${loc.pathname}/notifications`}>
              <Icon name="bell"/>
            </Link>
            <Link to={`${loc.pathname}/messages`}>
              <Icon name="users"/>
            </Link>
            <Link className="mini-avatar" to="/profile">
              {avatar?<img src={avatar} alt=""/>:(user?.fullName?.[0]||'M')}
            </Link>
          </div>
        </div>
        <div className="dash-content">
          {children}
        </div>
      </main>
    </div>
  );
}

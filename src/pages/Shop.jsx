import {useMemo,useState,useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';
import Storefront from '../components/Storefront';
import {getCatalogProducts} from '../services/mvecStore';
import {loadCatalog} from '../services/catalogApi';
import {rankCatalogProducts,aggregateCategories} from '../services/searchService';
import Icon from '../components/Icon';
import Pagination from '../components/Pagination';

const money=n=>new Intl.NumberFormat('en-RW').format(n)+' RWF';
const PER_PAGE=8;

export default function Shop(){
  const [searchParams,setSearchParams]=useSearchParams();
  const [page,setPage]=useState(1);
  const [q,setQ]=useState(searchParams.get('q')||'');
  const [cat,setCat]=useState(searchParams.get('category')||'');
  const [sort,setSort]=useState('featured');
  const [max,setMax]=useState(2500000);
  const [base,setBase]=useState([]);
  const [categories,setCategories]=useState([]);

  // Keep filters in sync with the URL (?q= and ?category=) so navigation works
  useEffect(()=>{
    setQ(searchParams.get('q')||'');
    setCat(searchParams.get('category')||'');
    setPage(1);
  },[searchParams]);

  useEffect(()=>{
    let mounted=true;
    loadCatalog().then(cat=>{
      if(!mounted)return;
      const prods=cat.products||[];
      setBase(prods);
      const cats=cat.categories&&cat.categories.length?cat.categories.map(c=>(typeof c==='string'?c:c.name)).filter(Boolean):[];
      setCategories(aggregateCategories([cats]));
    });
    return()=>{mounted=false};
  },[]);

  const catalog=getCatalogProducts(base);

  const syncQ=(value,submit=false)=>{
    setQ(value);
    setPage(1);
    const next=new URLSearchParams(searchParams);
    if(value.trim())next.set('q',value.trim());
    else next.delete('q');
    if(cat)next.set('category',cat);
    setSearchParams(next,{replace:!submit});
  };
  const syncCat=(value)=>{
    setCat(value);
    setPage(1);
    const next=new URLSearchParams(searchParams);
    if(value)next.set('category',value);
    else next.delete('category');
    if(q.trim())next.set('q',q.trim());
    setSearchParams(next,{replace:false});
  };

  const ranked=useMemo(()=>rankCatalogProducts(catalog,{q,category:cat,maxPrice:max}),[catalog,q,cat,max]);
  const {primary,related}=ranked;
  const ordered=useMemo(()=>sort==='price-low'?ranked.results.slice().sort((a,b)=>a.price-b.price):sort==='price-high'?ranked.results.slice().sort((a,b)=>b.price-a.price):sort==='rating'?ranked.results.slice().sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0)):ranked.results,[ranked,sort]);
  const total=ordered.length;
  const totalPages=Math.max(1,Math.ceil(total/PER_PAGE));
  const current=Math.min(page,totalPages);
  const shown=ordered.slice((current-1)*PER_PAGE,current*PER_PAGE);

  const catName=cat||(searchParams.get('category')||'');

  return <Storefront>
    <main className="catalog-page">
      <div className="catalog-head">
        <div>
          <span className="eyebrow">MVEC MARKETPLACE</span>
          <h1>{q.trim()?`Results for “${q.trim()}”`:catName?catName:'Shop products'}</h1>
          <p>Search by name, SKU, brand, category or vendor.</p>
        </div>
        <div className="catalog-search">
          <Icon name="search"/>
          <input value={q} onChange={e=>syncQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&syncQ(e.target.value,true)} placeholder="Search the marketplace…"/>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <h3>Filters</h3>
          <label>Category
            <select value={cat||''} onChange={e=>syncCat(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Maximum price
            <input type="range" min="20000" max="2500000" step="10000" value={max} onChange={e=>{setMax(+e.target.value);setPage(1)}}/>
            <b>{money(max)}</b>
          </label>
          <div className="filter-list">
            <span>Availability</span>
            <label><input type="checkbox" defaultChecked/> In stock</label>
            <label><input type="checkbox"/> On sale</label>
            <label><input type="checkbox"/> New arrivals</label>
            <label><input type="checkbox"/> 4★ &amp; above</label>
          </div>
        </aside>
        <section className="catalog-results">
          <div className="results-toolbar">
            <span>{total} products</span>
            <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}}>
              <option value="featured">Featured</option>
              <option value="rating">Top rated</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </div>
          <div className="product-grid">
            {shown.map(p=><div className="product-card" key={String(p._id||p.id)}>
              <a href={`/product/${p._id||p.id}`} className="product-img">
                <img src={p.image} alt={p.name}/>
                <span className="sale-badge">{p.oldPrice?'SALE':'NEW'}</span>
              </a>
              <div className="product-info">
                <small>{p.vendor}</small>
                <a href={`/product/${p._id||p.id}`} className="product-name">{p.name}</a>
                <div className="rating">★ {p.rating} <span>({p.reviews})</span></div>
                <b>{money(p.price)}</b> <del>{money(p.oldPrice)}</del>
              </div>
            </div>)}
          </div>
          {q.trim()&&primary.length&&related.length&&<div className="related-divider">{total>PER_PAGE?`${primary.length} direct + ${related.length} related matches`:`${primary.length} direct match${primary.length===1?'':'es'} + ${related.length} related ${related.length===1?'product':'products'}`}</div>}
          <Pagination page={current} setPage={setPage} total={total} perPage={PER_PAGE}/>
          {!total&&<div className="empty-state"><h3>No products found</h3><p>Try another search or remove a filter.</p></div>}
        </section>
      </div>
    </main>
  </Storefront>;
}
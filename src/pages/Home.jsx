import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import Pagination from "../components/Pagination";
import { products as seedProducts, categories as seedCategories, vendors as seedVendors } from "../data";
import { loadCatalog } from "../services/catalogApi";
import Storefront from "../components/Storefront";
import Icon from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useMarketplace } from "../context/MarketplaceContext";
const money = (n) => new Intl.NumberFormat("en-RW").format(n) + " RWF";
function ProductCard({ p }) {
  const { user } = useAuth();
  const { toggleWishlist, isWishlisted } = useMarketplace();
  const wished = isWishlisted(p.id);
  const save = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    toggleWishlist(p);
  };
  return (
    <div className="product-card">
      <Link to={`/product/${p.id}`} className="product-img">
        <img src={p.image} alt={p.name} />
        <button
          className={"quick-heart " + (wished ? "wish-active" : "")}
          onClick={save}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Icon name="heart" size={17} />
        </button>
        {p.oldPrice && <span className="sale-badge">SALE</span>}
      </Link>
      <div className="product-info">
        <small>{p.category}</small>
        <Link to={`/product/${p.id}`} className="product-name">
          {p.name}
        </Link>
        <div className="rating">
          ★ {p.rating} <span>({p.reviews})</span>
        </div>
        <div>
          <b>{money(p.price)}</b> <del>{money(p.oldPrice)}</del>
        </div>
      </div>
    </div>
  );
}
export default function Home() {
  const [productPage, setProductPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);
  const pp = 8,
    vp = 4;
  const [products, setProducts] = useState(seedProducts);
  const [categories, setCategories] = useState(seedCategories);
  const [vendors, setVendors] = useState(seedVendors);

  useEffect(() => {
    let mounted = true;
    loadCatalog().then((cat) => {
      if (!mounted) return;
      setProducts(cat.products && cat.products.length ? cat.products : seedProducts);
      const cats = cat.categories && cat.categories.length
        ? cat.categories.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean)
        : seedCategories;
      setCategories(cats.length ? cats : seedCategories);
      setVendors(cat.vendors && cat.vendors.length ? cat.vendors : seedVendors);
    });
    return () => { mounted = false; };
  }, []);

  const shownProducts = products.slice(
    (productPage - 1) * pp,
    productPage * pp,
  );
  const shownVendors = vendors.slice((vendorPage - 1) * vp, vendorPage * vp);
  const heroProducts = products.slice(0, 6);
  return (
    <Storefront>
      <main className="home-page">
        <section className="hero-market hero-modern">
          <div className="hero-copy">
            <span className="eyebrow">MVEC MARKETPLACE</span>
            <h1 className="hero-animated-title">
              <span>Shop.</span> <span>Sell.</span>
              <br />
              <em>Grow together.</em>
              <i className="hero-title-spark spark-one">✦</i>
              <i className="hero-title-spark spark-two">✦</i>
            </h1>
            <p>Products from trusted sellers across Rwanda.</p>
            <div className="hero-buttons">
              <Link to="/shop" className="gradient-btn">
                Shop now <Icon name="arrow" size={17} />
              </Link>
              <Link to="/signup" className="outline-btn">
                Start selling
              </Link>
            </div>
            <div className="trust-row">
              <span>✓ Verified sellers</span>
              <span>✓ Secure checkout</span>
              <span>✓ Local delivery</span>
            </div>
          </div>
          <div className="hero-visual dynamic-product-stage">
            <div className="visual-glow" />
            {heroProducts.map((p, i) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className={`hero-product-card hero-product-${i}`}
              >
                <img src={p.image} alt={p.name} />
                <span>{p.name}</span>
                <b>{money(p.price)}</b>
              </Link>
            ))}
          </div>
        </section>
        <section className="moving-products">
          <div className="moving-track">
            {[...products, ...products].map((p, i) => (
              <Link to={`/product/${p.id}`} key={i} className="moving-product">
                <img src={p.image} alt="" />
                <span>{p.name}</span>
                <b>{money(p.price)}</b>
              </Link>
            ))}
          </div>
        </section>
        <section className="category-strip">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SHOP BY CATEGORY</span>
              <h2>Find what you need</h2>
            </div>
            <Link to="/shop">View all →</Link>
          </div>
          <div className="category-grid">
            {categories.map((c, i) => (
              <Link
                key={c}
                to={`/shop?category=${encodeURIComponent(c)}`}
                className="category-tile"
              >
                <span className="cat-icon">
                  {["▦", "▣", "▤", "◉", "⌂", "✦", "◈", "◍"][i % 8]}
                </span>
                <b>{c}</b>
                <small>Explore products</small>
              </Link>
            ))}
          </div>
        </section>
        <section className="product-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TRENDING NOW</span>
              <h2>Popular products</h2>
            </div>
            <Link to="/shop">View all products →</Link>
          </div>
          <div className="product-grid">
            {shownProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
          <Pagination
            page={productPage}
            setPage={setProductPage}
            total={products.length}
            perPage={pp}
          />
        </section>
        {categories.map((category) => {
          const categoryProducts = products
            .filter((p) => p.category === category)
            .slice(0, 4);
          return (
            <section
              className="product-section category-products-section"
              key={category}
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{category.toUpperCase()}</span>
                  <h2>{category}</h2>
                </div>
                <Link to={`/shop?category=${encodeURIComponent(category)}`}>
                  More {category} →
                </Link>
              </div>
              <div className="product-grid">
                {categoryProducts.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          );
        })}
        <section className="visual-banner">
          <div>
            <span className="eyebrow">MVEC DEAL DAYS</span>
            <h2>
              More products.
              <br />
              Less searching.
            </h2>
            <p>Explore deals from verified sellers.</p>
            <Link to="/shop?deal=true" className="gradient-btn">
              Shop deals
            </Link>
          </div>
          <div className="banner-image-stack">
            {products.slice(1, 5).map((p, i) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className={`banner-product banner-${i}`}
              >
                <img src={p.image} alt={p.name} />
              </Link>
            ))}
          </div>
        </section>
        <section className="product-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TOP STORES</span>
              <h2>Trusted vendors</h2>
            </div>
            <Link to="/vendors">View all stores →</Link>
          </div>
          <div className="vendor-grid">
            {shownVendors.map((v) => (
              <Link to={`/vendors/${v.id}`} className="vendor-card" key={v.id}>
                <div className="vendor-avatar">{v.name.charAt(0)}</div>
                <div>
                  <b>{v.name}</b>
                  <small>{v.category}</small>
                  <span>
                    ★ {v.rating} · {v.products} products
                  </span>
                </div>
                <Icon name="arrow" size={17} />
              </Link>
            ))}
          </div>
          <Pagination
            page={vendorPage}
            setPage={setVendorPage}
            total={vendors.length}
            perPage={vp}
          />
        </section>
      </main>
    </Storefront>
  );
}

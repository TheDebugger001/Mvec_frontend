import { productsApi, categoriesApi, vendorsApi } from '../API';
import {
  products as mockProducts,
  categories as mockCategories,
  vendors as mockVendors,
} from '../data';

let cached = null;
let inflight = null;

const PLACEHOLDER_IMG =
  'https://placehold.co/600x600?text=MVEC+Product';

export function mapBackendProduct(p) {
  if (!p) return null;
  const vendor = p.vendor || {};
  const category = p.category || {};
  const rawPrice = Number(p.price || 0);
  const discountPrice = Number(p.discountPrice || 0);
  const activePrice = discountPrice > 0 && discountPrice < rawPrice ? discountPrice : rawPrice;
  const mainImage =
    p.media?.mainImage ||
    (Array.isArray(p.media) ? p.media[0] : null) ||
    p.image ||
    PLACEHOLDER_IMG;
  const attrs = p.attributes || {};
  return {
    id: p._id || p.id || p.publicId,
    name: p.name || '',
    category: category.name || (typeof p.category === 'string' ? p.category : 'Uncategorized'),
    brand: p.brand || '',
    vendor: vendor.companyName || vendor.Fullname || p.vendorName || 'MVEC Seller',
    vendorId: vendor._id || p.vendor || '',
    price: activePrice,
    oldPrice: discountPrice > 0 && discountPrice < rawPrice ? rawPrice : 0,
    rating: p.averageRating || p.rating || 4,
    reviews: p.reviewCount || p.reviews || 0,
    stock: Number(p.stockQuantity || 0),
    sku: p.sku || '',
    image: mainImage,
    description: p.description || p.shortDescription || '',
    status: p.status || 'ACTIVE',
    slug: p.slug || '',
    attributes: {
      Color: attrs.color || '',
      Size: attrs.size || '',
      Material: attrs.material || '',
      Weight: attrs.weight || '',
      Capacity: attrs.capacity || '',
      Model: attrs.model || '',
    },
  };
}

export function mapBackendVendor(v) {
  if (!v) return null;
  return {
    id: v._id || v.id || v.user,
    name: v.businessName || v.companyName || v.Fullname || v.name || 'Vendor',
    category: v.businessCategory || v.vendorCategory || v.category || 'General',
    products: v.productCount || v.products || 0,
    rating: v.ratingAvg || v.rating || v.averageRating || 0,
    slug: v.slug || '',
    logoUrl: v.logoUrl || '',
    bannerUrl: v.bannerUrl || '',
    status: v.status || 'ACTIVE',
  };
}

export function mapBackendCategory(c) {
  if (!c) return null;
  return {
    id: c._id || c.id,
    name: c.name || '',
    slug: c.slug || '',
    imageUrl: c.imageUrl || '',
    description: c.description || '',
  };
}

const toCache = (result) => ({
  ...result,
  products: result.backendProducts && result.backendProducts.length ? result.backendProducts : mockProducts,
  categories: result.backendCategories && result.backendCategories.length ? result.backendCategories : mockCategories,
  vendors: result.backendVendors && result.backendVendors.length ? result.backendVendors : mockVendors,
});

export function loadCatalog(force = false) {
  if (cached && !force) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    const [pRes, cRes, vRes] = await Promise.allSettled([
      productsApi.getAll(),
      categoriesApi.getAll(),
      vendorsApi.getAll(),
    ]);

    const backendProducts = pRes.status === 'fulfilled'
      ? (pRes.value.products || []).map(mapBackendProduct).filter(Boolean)
      : [];

    const backendCategories = cRes.status === 'fulfilled'
      ? (cRes.value.categories || []).map(mapBackendCategory).filter(Boolean)
      : [];

    const rawVendors = vRes.status === 'fulfilled'
      ? (vRes.value.data || vRes.value.vendors || [])
      : [];
    const backendVendors = rawVendors.map(mapBackendVendor).filter(Boolean);

    cached = toCache({ backendProducts, backendCategories, backendVendors });
    return cached;
  })()
    .catch(() => {
      cached = toCache({ backendProducts: [], backendCategories: [], backendVendors: [] });
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearCatalogCache() {
  cached = null;
}

export function getProductById(productsList, id) {
  return (productsList || []).find((x) => String(x.id) === String(id)) || null;
}

export { mockProducts, mockCategories, mockVendors };
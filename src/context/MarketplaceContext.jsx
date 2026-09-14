import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { cartApi } from '../API/cart';
import { useAuth } from './AuthContext';
import { useToast } from '../components/Toast';

const MarketplaceContext = createContext(null);

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};

const normalizeCartItem = (item) => {
  if (!item) return item;
  const src = item.product;
  const prodIsId = typeof src === 'string';
  const prod = (!prodIsId && src && typeof src === 'object') ? src : {};
  const rawProductId = prodIsId ? src : (prod._id || prod.id || '');
  const media = prod.media || {};
  const prodImages = Array.isArray(prod.media) ? prod.media : (prod.gallery || []);
  return {
    ...(prodIsId ? {} : prod),
    id: prod._id || prod.id || rawProductId,
    sku: prod.sku || item.sku || '',
    name: prod.name || item.name || 'Product',
    qty: item.quantity || item.qty || 1,
    price: item.price != null ? item.price : (prod.discountPrice || prod.price || item.price || 0),
    image: media.mainImage || prodImages[0] || prod.image || item.image || '',
  };
};

const normalizeCart = (items) => (Array.isArray(items) ? items.map(normalizeCartItem).filter(Boolean) : []);

// Anonymous carts are persisted to localStorage as raw product objects with a
// `quantity` key. Normalize so both `qty` and `quantity` are always present
// (Cart.jsx / Checkout.jsx read `qty`, cartCount reads `quantity`).
const normalizeLocalCartItem = (item) => {
  if (!item) return item;
  const qty = Math.max(1, Number(item.quantity) || Number(item.qty) || 1);
  return { ...item, quantity: qty, qty };
};
const normalizeLocalCart = (items) => (Array.isArray(items) ? items.map(normalizeLocalCartItem).filter(Boolean) : []);

export function MarketplaceProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState(read('mvec_wishlist'));
  const [cartLoading, setCartLoading] = useState(false);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCart(normalizeLocalCart(read("mvec_cart")));
      return;
    }
    setCartLoading(true);
    try {
      const serverCart = await cartApi.get();
      setCart(normalizeCart(serverCart?.items));
    } catch {
      setCart([]);
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addToCart = useCallback(async (product, qty = 1) => {
    if (!user) {
      setCart((prev) => {
        const existing = prev.findIndex(x => String(x._id || x.id) === String(product._id || product.id));
        const next = existing >= 0
          ? prev.map((x, i) => i === existing ? { ...x, quantity: (x.quantity || 1) + qty, qty: (x.quantity || 1) + qty } : x)
          : [...prev, { ...product, quantity: qty, qty }];
        localStorage.setItem('mvec_cart', JSON.stringify(next));
        return next;
      });
      toast.success('Added to cart');
      return;
    }
    try {
      const productId = product._id || product.id;
      const res = await cartApi.add(productId, qty);
      setCart(normalizeCart(res?.cart?.items));
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart. Please try again.');
    }
  }, [user, toast]);

  const removeFromCart = useCallback(async (id) => {
    if (!user) {
      setCart((prev) => {
        const next = prev.filter(x => String(x._id || x.id) !== String(id));
        localStorage.setItem('mvec_cart', JSON.stringify(next));
        return next;
      });
      toast.info('Removed from cart');
      return;
    }
    try {
      const res = await cartApi.remove(id);
      setCart(normalizeCart(res?.cart?.items));
      toast.info('Removed from cart');
    } catch {
      toast.error('Could not remove the item.');
    }
  }, [user, toast]);

  const updateCartQty = useCallback(async (id, qty) => {
    const newQty = Math.max(1, qty);
    if (!user) {
      setCart((prev) => {
        const next = prev.map(x => String(x._id || x.id) === String(id) ? { ...x, quantity: newQty, qty: newQty } : x);
        localStorage.setItem('mvec_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const res = await cartApi.updateQuantity(id, newQty);
      setCart(normalizeCart(res?.cart?.items));
    } catch {
      // silent
    }
  }, [user]);

  const clearCart = useCallback(async () => {
    if (!user) {
      setCart([]);
      localStorage.removeItem('mvec_cart');
      return;
    }
    try {
      await cartApi.clear();
      setCart([]);
    } catch {
      // silent
    }
  }, [user]);

  const toggleWishlist = useCallback((product) => {
    const pid = product._id || product.id;
    const exists = wishlist.some(x => String(x._id || x.id) === String(pid));
    const next = exists
      ? wishlist.filter(x => String(x._id || x.id) !== String(pid))
      : [...wishlist, product];
    setWishlist(next);
    localStorage.setItem('mvec_wishlist', JSON.stringify(next));
    if (exists) toast.info('Removed from wishlist');
    else toast.success('Added to wishlist');
  }, [wishlist, toast]);

  const isWishlisted = useCallback((id) => {
    return wishlist.some(x => String(x._id || x.id) === String(id));
  }, [wishlist]);

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    localStorage.removeItem('mvec_wishlist');
  }, []);

  const cartCount = useMemo(() => cart.reduce((n, x) => n + (Number(x.quantity) || 1), 0), [cart]);

  const value = useMemo(() => ({
    cart,
    wishlist,
    cartCount,
    cartLoading,
    wishlistCount: wishlist.length,
    addToCart,
    removeFromCart,
    updateCartQty,
    toggleWishlist,
    isWishlisted,
    clearWishlist,
    clearCart,
  }), [cart, wishlist, cartCount, cartLoading, addToCart, removeFromCart, updateCartQty, toggleWishlist, isWishlisted, clearWishlist, clearCart]);

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}

export const useMarketplace = () => useContext(MarketplaceContext);

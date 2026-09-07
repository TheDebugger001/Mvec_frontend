import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { cartApi } from '../API/cart';
import { useAuth } from './AuthContext';

const MarketplaceContext = createContext(null);

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};

const normalizeCartItem = (item) => {
  if (!item) return item;
  const prod = item.product || {};
  if (typeof prod === 'object' && prod !== null) {
    const media = prod.media || {};
    return {
      ...prod,
      id: prod._id || prod.id,
      qty: item.quantity || item.qty || 1,
      price: item.price != null ? item.price : (prod.discountPrice || prod.price),
      image: media.mainImage || (Array.isArray(prod.media) ? prod.media[0] : null) || prod.image || '',
    };
  }
  return item;
};

const normalizeCart = (items) => (Array.isArray(items) ? items.map(normalizeCartItem).filter(Boolean) : []);

export function MarketplaceProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState(read('mvec_wishlist'));
  const [cartLoading, setCartLoading] = useState(false);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCart([]);
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
          ? prev.map((x, i) => i === existing ? { ...x, quantity: (x.quantity || 1) + qty } : x)
          : [...prev, { ...product, quantity: qty }];
        localStorage.setItem('mvec_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const productId = product._id || product.id;
      const res = await cartApi.add(productId, qty);
      setCart(normalizeCart(res?.cart?.items));
    } catch {
      // silent
    }
  }, [user]);

  const removeFromCart = useCallback(async (id) => {
    if (!user) {
      setCart((prev) => {
        const next = prev.filter(x => String(x._id || x.id) !== String(id));
        localStorage.setItem('mvec_cart', JSON.stringify(next));
        return next;
      });
      return;
    }
    try {
      const res = await cartApi.remove(id);
      setCart(normalizeCart(res?.cart?.items));
    } catch {
      // silent
    }
  }, [user]);

  const updateCartQty = useCallback(async (id, qty) => {
    const newQty = Math.max(1, qty);
    if (!user) {
      setCart((prev) => {
        const next = prev.map(x => String(x._id || x.id) === String(id) ? { ...x, quantity: newQty } : x);
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
    setWishlist((prev) => {
      const exists = prev.some(x => String(x._id || x.id) === String(pid));
      const next = exists
        ? prev.filter(x => String(x._id || x.id) !== String(pid))
        : [...prev, product];
      localStorage.setItem('mvec_wishlist', JSON.stringify(next));
      return next;
    });
  }, []);

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

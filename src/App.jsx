import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Shop from "./pages/Shop";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import Profile from "./pages/Profile";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import OrderConfirmation from "./pages/OrderConfirmation";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import AdminDashboard from "./pages/AdminDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import RequireAuth from "./components/RequireAuth";
import { syncOrderLifecycle } from "./services/mvecStore";
import Preloader from "./components/Preloader";

export default function App() {
  useEffect(() => {
    syncOrderLifecycle();
    const timer = setInterval(syncOrderLifecycle, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Preloader />
      <Routes>
      {/* ─── Public Routes ─────────────────────────────────────────────── */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<ProductDetails />} />
      <Route path="/vendors" element={<Vendors />} />
      <Route path="/vendors/:id" element={<VendorDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route
        path="/wishlist"
        element={
          <RequireAuth>
            <Wishlist />
          </RequireAuth>
        }
      />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/payment/:id" element={<Payment />} />
      <Route
        path="/order-confirmation/:id"
        element={
          <RequireAuth>
            <OrderConfirmation />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/orders"
        element={
          <RequireAuth>
            <Orders />
          </RequireAuth>
        }
      />
      <Route path="/orders/:id" element={<OrderDetails />} />

      {/* ─── Admin Dashboard (4 pages) ────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/wallet"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />

      {/* ─── Vendor Dashboard (5 pages) ───────────────────────────────── */}
      <Route
        path="/vendor"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/wallet"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/suppliers"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/products"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/reports"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />

      {/* ─── Supplier Dashboard (5 pages) ─────────────────────────────── */}
      <Route
        path="/supplier"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/wallet"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/vendors"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/products"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/reports"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />

      {/* ─── Affiliate Dashboard (4 pages) ────────────────────────────── */}
      <Route
        path="/affiliate"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/wallet"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/vendors"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/reports"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />

      {/* ─── Fallback ─────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

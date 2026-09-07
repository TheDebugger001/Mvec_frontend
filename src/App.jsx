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
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import VendorDashboard from "./pages/VendorDashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import PlatformOperations from "./pages/PlatformOperations";
import VendorNetwork from "./pages/VendorNetwork";
import VendorAffiliate from "./pages/VendorAffiliate";
import AdminDashboard from "./pages/AdminDashboard";
import Transactions from "./pages/Transactions";
import SellerOrderDetail from "./pages/SellerOrderDetail";
import RequireAuth from "./components/RequireAuth";
import DeliveryTracking from "./components/DeliveryTracking";
import DashboardLayout from "./components/DashboardLayout";
import NotificationPanel from "./components/NotificationPanel";
import FeaturePages from "./pages/FeaturePages";
import {
  CommissionRules,
  FinancialLedger,
  AdminAnalytics,
  CommunicationPage,
  AcquisitionPage,
  RiskManagement,
  LanguageSettings,
} from "./pages/ExtendedModules";
import { syncOrderLifecycle } from "./services/mvecStore";
function DashboardDelivery({ role }) {
  return (
    <DashboardLayout admin={role === "admin"}>
      <DeliveryTracking role={role} />
    </DashboardLayout>
  );
}
export default function App() {
  useEffect(() => {
    syncOrderLifecycle();
    const timer = setInterval(syncOrderLifecycle, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Routes>
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
      <Route path="/buyer/compare" element={<FeaturePages role="buyer" />} />
      <Route
        path="/buyer/recommendations"
        element={<FeaturePages role="buyer" />}
      />
      <Route path="/buyer/refunds" element={<FeaturePages role="buyer" />} />
      <Route path="/buyer/support" element={<FeaturePages role="buyer" />} />
      <Route
        path="/buyer/messages"
        element={
          <RequireAuth>
            <CommunicationPage role="buyer" />
          </RequireAuth>
        }
      />
      <Route
        path="/buyer/notifications"
        element={
          <RequireAuth>
            <FeaturePages role="buyer" />
          </RequireAuth>
        }
      />
      <Route
        path="/buyer/subscription"
        element={<FeaturePages role="buyer" />}
      />
      <Route
        path="/vendor/support"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/support"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/support"
        element={
          <RequireAuth roles={["affiliate"]}>
            <FeaturePages role="affiliate" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/messages"
        element={
          <RequireAuth roles={["super_admin"]}>
            <CommunicationPage role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/support"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/categories"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/purchases"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/advertisements"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/subscription"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/refunds"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/reviews"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/messages"
        element={
          <RequireAuth roles={["vendor"]}>
            <CommunicationPage role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/shipping"
        element={
          <RequireAuth roles={["vendor"]}>
            <FeaturePages role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/delivery"
        element={
          <RequireAuth roles={["vendor"]}>
            <DashboardDelivery role="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/transactions"
        element={
          <RequireAuth roles={["vendor"]}>
            <Transactions />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/suppliers"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorNetwork />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/affiliates"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorAffiliate />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/orders/:id"
        element={
          <RequireAuth roles={["vendor"]}>
            <SellerOrderDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/vendor/*"
        element={
          <RequireAuth roles={["vendor"]}>
            <VendorDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/supply-requests"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/transactions"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/messages"
        element={
          <RequireAuth roles={["supplier"]}>
            <CommunicationPage role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/reviews"
        element={
          <RequireAuth roles={["supplier"]}>
            <FeaturePages role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/delivery"
        element={
          <RequireAuth roles={["supplier"]}>
            <DashboardDelivery role="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/supplier/*"
        element={
          <RequireAuth roles={["supplier"]}>
            <SupplierDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/notifications"
        element={
          <RequireAuth roles={["affiliate"]}>
            <DashboardLayout>
              <NotificationPanel
                role="affiliate"
                recipient="affiliate@mvec.rw"
              />
            </DashboardLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/fraud"
        element={
          <RequireAuth roles={["affiliate"]}>
            <FeaturePages role="affiliate" />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/messages"
        element={
          <RequireAuth roles={["affiliate"]}>
            <CommunicationPage role="affiliate" />
          </RequireAuth>
        }
      />
      <Route
        path="/affiliate/*"
        element={
          <RequireAuth roles={["affiliate"]}>
            <AffiliateDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/delivery/messages"
        element={
          <RequireAuth roles={["delivery"]}>
            <CommunicationPage role="delivery" />
          </RequireAuth>
        }
      />
      <Route
        path="/delivery/*"
        element={
          <RequireAuth roles={["delivery"]}>
            <DeliveryDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/refunds"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/advertising"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/subscriptions"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/languages"
        element={
          <RequireAuth roles={["super_admin"]}>
            <LanguageSettings />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/locations"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/security"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/recommendations"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/matching"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/trust"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/system"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FeaturePages role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/transactions"
        element={
          <RequireAuth roles={["super_admin"]}>
            <Transactions />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <RequireAuth roles={["super_admin"]}>
            <SellerOrderDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/suppliers"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PlatformOperations type="suppliers" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/affiliates"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PlatformOperations type="affiliates" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/deliveries"
        element={
          <RequireAuth roles={["super_admin"]}>
            <DashboardDelivery role="admin" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/disputes"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PlatformOperations type="disputes" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/commissions"
        element={
          <RequireAuth roles={["super_admin"]}>
            <PlatformOperations type="commissions" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminAnalytics />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/ledger"
        element={
          <RequireAuth roles={["super_admin"]}>
            <FinancialLedger />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/commission-rules"
        element={
          <RequireAuth roles={["super_admin"]}>
            <CommissionRules />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/risk"
        element={
          <RequireAuth roles={["super_admin"]}>
            <RiskManagement />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/supplier-acquisition"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AcquisitionPage type="supplier" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/vendor-acquisition"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AcquisitionPage type="vendor" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAuth roles={["super_admin"]}>
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

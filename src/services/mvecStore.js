const read = (key, fallback = []) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const store = { read, write };

function readOrdersRaw() { return read("mvec_orders", []); }

const DELIVERY_WINDOW_MS = 3 * 60 * 60 * 1000;
const BUYER_CANCEL_WINDOW_MS = 30 * 60 * 1000;

export function getOrders() {
  syncOrderLifecycle();
  return readOrdersRaw();
}
export function recordLedgerEntry(entry) {
  const ledger = read("mvec_financial_ledger", []);
  const item = { id:`LEDGER-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, createdAt:new Date().toISOString(), ...entry };
  write("mvec_financial_ledger", [item, ...ledger]);
  return item;
}
export function getLedger() { return read("mvec_financial_ledger", []); }

export function saveOrders(orders) { write("mvec_orders", orders); }

export function addNotification(notification) {
  const list = read("mvec_notifications", []);
  const item = {
    id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    createdAt: new Date().toISOString(),
    read: false,
    ...notification,
  };
  write("mvec_notifications", [item, ...list]);
  return item;
}
export function getNotifications(role, recipient) {
  const list = read("mvec_notifications", []);
  return list.filter(n => !role || n.role === role || n.role === "all" || (recipient && n.recipient === recipient));
}
export function markNotificationRead(id) {
  const list = read("mvec_notifications", []).map(n => String(n.id) === String(id) ? {...n, read:true} : n);
  write("mvec_notifications", list);
}

export function createOrder(order) {
  const orders = getOrders();
  const firstItem = order?.items?.[0] || {};
  const rawName = firstItem.name || order?.productName || 'ORDER';
  const productSlug = String(rawName).toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42) || 'ORDER';
  const year = new Date().getFullYear();
  const sequence = String(orders.length + 1).padStart(6,'0');
  const uniquePart = String(Date.now()).slice(-6);
  const id = `MVEC-${productSlug}-${year}-${sequence}-${uniquePart}`;
  const transactionId = `MVEC-TXN-${year}-${sequence}-${uniquePart}`;
  const created = {
    id,
    transactionId,
    date: new Date().toISOString().slice(0,10),
    payment: "PENDING",
    status: "Created",
    settlementMode: "protected",
    settlementStatus: "PENDING",
    heldAmount: 0,
    disputeStatus: "none",
    refundStatus: "none",
    refundAmount: 0,
    paidAt: null,
    deliveryDeadline: null,
    buyerCancelDeadline: null,
    buyerDeliveryOtp: null,
    deliveryOtpVerified: false,
    commissionStatus: "Pending",
    deliveryStatus: "Order placed",
    trackingNumber: `MVEC-TRK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    ...order,
  };
  if (created.supplier || created.orderType === "supplier") {
    created.commission = 0;
    created.commissionStatus = "Not applicable";
    if (created.pricing) created.pricing = {...created.pricing, commissionRate:0, mvecCommission:0, vendorSettlement:Number(created.total||created.pricing.basePrice||0), supplierSettlement:Number(created.total||created.pricing.basePrice||0)};
  }
  if(created.affiliateCode){
    created.affiliateCommission=calculateAffiliateCommission(created.total||0);
    const wallet=getAffiliateWallet();
    saveAffiliateWallet({...wallet,pending:Number(wallet.pending||0)+created.affiliateCommission});
  }
  saveOrders([created, ...orders]);
  if(created.affiliateCode){ recordLedgerEntry({type:"AFFILIATE_COMMISSION",orderId:created.id,transactionId:created.transactionId,amount:created.affiliateCommission,status:"PENDING",affiliate:created.affiliateCode}); }
  recordLedgerEntry({type:"ORDER_CREATED",orderId:created.id,transactionId:created.transactionId,amount:created.total||0,status:"PENDING",productName:firstItem.name||rawName});
  return created;
}

export function updateOrder(id, patch) {
  const next = readOrdersRaw().map(o => String(o.id) === String(id) ? {...o, ...patch} : o);
  saveOrders(next);
  return next.find(o => String(o.id) === String(id));
}

export function confirmPayment(id, method) {
  const existing = readOrdersRaw().find(o => String(o.id) === String(id));
  const paidAt = new Date().toISOString();
  const deliveryDeadline = new Date(Date.now() + DELIVERY_WINDOW_MS).toISOString();
  const buyerCancelDeadline = new Date(Date.now() + BUYER_CANCEL_WINDOW_MS).toISOString();
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const order = updateOrder(id, {
    payment: "SUCCESS",
    paymentMethod: method,
    status: "Payment Confirmed",
    settlementMode: "protected",
    settlementStatus: "HELD",
    heldAmount: Number(existing?.total || 0),
    deliveryStatus: "Payment confirmed",
    paidAt,
    deliveryDeadline,
    buyerCancelDeadline,
    buyerDeliveryOtp: otp,
    deliveryOtpVerified: false,
    refundStatus: "none",
  });
  if (order) {
    addNotification({
      role: "vendor",
      recipient: order.vendor,
      type: "payment",
      title: "Order paid successfully",
      message: `${order.id} was successfully paid. MVEC has recorded the funds as HELD pending delivery confirmation.`,
      reference: order.id,
    });
    addNotification({
      role: "buyer",
      recipient: order.buyerEmail || order.buyerPhone,
      type: "payment",
      title: "Payment confirmed",
      message: `${order.id} is paid. Your delivery OTP is ${otp}. Keep it private and give it to the delivery person when your order arrives.`,
      reference: order.id,
    });
    recordLedgerEntry({type:"PAYMENT_HELD",orderId:order.id,transactionId:order.transactionId,amount:order.total||0,status:"HELD",paymentMethod:method});
    if (order.supplier) {
      addNotification({
        role: "supplier",
        recipient: order.supplier,
        type: "payment",
        title: "Supplier order paid successfully",
        message: `${order.id} was successfully paid. MVEC has recorded the funds as HELD pending supply delivery confirmation.`,
        reference: order.id,
      });
    }
  }
  return order;
}

function refundOrderInternal(order, reason="Delivery deadline exceeded") {
  if (!order || order.payment !== "SUCCESS" || order.refundStatus === "FULL") return order;
  const amount = Number(order.total || order.heldAmount || 0);
  const updated = updateOrder(order.id, {
    status: "Cancelled",
    deliveryStatus: "Cancelled",
    settlementStatus: "CANCELLED",
    heldAmount: 0,
    refundStatus: "FULL",
    refundAmount: amount,
    refundReason: reason,
    refundedAt: new Date().toISOString(),
    commissionStatus: "Cancelled",
  });
  recordLedgerEntry({type:"REFUND_FULL",orderId:order.id,transactionId:order.transactionId,amount,status:"REFUNDED",reason});
  if(Number(order.affiliateCommission||0)>0){
    const wallet=getAffiliateWallet();
    saveAffiliateWallet({...wallet,pending:Math.max(0,Number(wallet.pending||0)-Number(order.affiliateCommission||0))});
    recordLedgerEntry({type:"AFFILIATE_COMMISSION_CANCELLED",orderId:order.id,transactionId:order.transactionId,amount:Number(order.affiliateCommission||0),status:"CANCELLED",affiliate:order.affiliateCode||""});
  }
  addNotification({role:"buyer",recipient:order.buyerEmail||order.buyerPhone,type:"refund",title:"Full refund approved",message:`${order.id} was cancelled and a full refund of RWF ${amount.toLocaleString()} is due because the delivery window expired.`,reference:order.id});
  addNotification({role:"vendor",recipient:order.vendor,type:"refund",title:"Order cancelled and refunded",message:`${order.id} was automatically cancelled after the delivery deadline. MVEC recorded a full refund for the buyer.`,reference:order.id});
  if(order.supplier) addNotification({role:"supplier",recipient:order.supplier,type:"refund",title:"Supply order cancelled and refunded",message:`${order.id} was automatically cancelled after the delivery deadline.`,reference:order.id});
  addNotification({role:"admin",type:"refund",title:"Automatic order cancellation",message:`${order.id} exceeded the 3-hour delivery window and was fully refunded.`,reference:order.id});
  return updated;
}

export function refundOrder(id, reason="Buyer requested a refund") {
  const order = readOrdersRaw().find(o => String(o.id) === String(id));
  return refundOrderInternal(order, reason);
}

export function cancelOrderByBuyer(id) {
  const order = readOrdersRaw().find(o => String(o.id) === String(id));
  if (!order) throw new Error("Order not found.");
  if (order.payment !== "SUCCESS") throw new Error("Only paid orders can be cancelled from this page.");
  if (order.status === "Cancelled" || order.refundStatus === "FULL") throw new Error("This order is already cancelled.");
  const paidAt = new Date(order.paidAt || 0).getTime();
  if (!paidAt || Date.now() - paidAt > BUYER_CANCEL_WINDOW_MS) throw new Error("The 30-minute cancellation period has ended.");
  return refundOrderInternal(order, "Buyer cancelled within 30 minutes of payment");
}

export function verifyDeliveryOtp(id, otp) {
  const order = readOrdersRaw().find(o => String(o.id) === String(id));
  if (!order) throw new Error("Order not found.");
  if (order.payment !== "SUCCESS") throw new Error("Payment has not been confirmed.");
  if (order.settlementStatus !== "HELD") throw new Error("This order is no longer awaiting delivery confirmation.");
  if (String(otp).trim() !== String(order.buyerDeliveryOtp || "")) throw new Error("The OTP is incorrect. Ask the buyer to provide the delivery OTP shown on their order.");
  const updated = updateOrder(id, {
    deliveryOtpVerified: true,
    deliveryVerifiedAt: new Date().toISOString(),
    deliveryStatus: "Delivered",
    status: "Delivered",
  });
  addNotification({role:"buyer",recipient:updated.buyerEmail||updated.buyerPhone,type:"delivery",title:"Delivery confirmed",message:`${updated.id} was successfully delivered using the correct OTP.`,reference:updated.id});
  addNotification({role:"vendor",recipient:updated.vendor,type:"delivery",title:"Order delivered successfully",message:`${updated.id} was delivered and the buyer OTP was verified. MVEC can now release the protected funds.`,reference:updated.id});
  if(updated.supplier) addNotification({role:"supplier",recipient:updated.supplier,type:"delivery",title:"Supply delivery confirmed",message:`${updated.id} was received and the delivery OTP was verified.`,reference:updated.id});
  return releaseSettlement(id,"delivery-otp");
}

export function syncOrderLifecycle() {
  // Manual vendor fulfillment lifecycle: statuses must NOT be auto-progressed by a timer.
  return readOrdersRaw();
}

export function getDeliveryRemaining(order) {
  const deadline = new Date(order?.deliveryDeadline || 0).getTime();
  return Math.max(0, deadline - Date.now());
}

export function canBuyerCancel(order) {
  if (!order || order.payment !== "SUCCESS" || order.status === "Cancelled" || order.refundStatus === "FULL") return false;
  const paidAt = new Date(order.paidAt || 0).getTime();
  return !!paidAt && Date.now() - paidAt <= BUYER_CANCEL_WINDOW_MS;
}

export function releaseSettlement(id, actor = "delivery") {
  const existing = readOrdersRaw().find(o => String(o.id) === String(id));
  if (existing?.settlementStatus === "RELEASED") return existing;
  const supplierOrder=!!(existing?.supplier || existing?.orderType === "supplier");
  const order = updateOrder(id, {
    settlementStatus: "RELEASED",
    releasedAt: new Date().toISOString(),
    status: "Completed",
    deliveryStatus: "Delivered",
    commissionStatus: supplierOrder ? "Not applicable" : "Payable",
  });
  if (order) {
    const gross=Number(order.heldAmount||order.total||0);
    const mvecCommission=supplierOrder ? 0 : Number(order.pricing?.mvecCommission ?? order.commission ?? calculateCommission(gross));
    const affiliateCommission=supplierOrder ? 0 : Number(order.affiliateCommission||0);
    const settlementAmount=Math.max(0,gross-mvecCommission-affiliateCommission);
    recordLedgerEntry({type:"SETTLEMENT_RELEASED",orderId:order.id,transactionId:order.transactionId,amount:gross,status:"RELEASED",grossAmount:gross,mvecCommission,affiliateCommission,...(supplierOrder?{supplierSettlement:settlementAmount}:{vendorSettlement:settlementAmount})});
    if(!supplierOrder && mvecCommission>0) recordLedgerEntry({type:"MVEC_COMMISSION",orderId:order.id,transactionId:order.transactionId,amount:mvecCommission,status:"PAYABLE"});
    if(affiliateCommission>0 && order.affiliateCode){
      const wallet=getAffiliateWallet();
      const next={...wallet,available:Number(wallet.available||0)+affiliateCommission,totalEarned:Number(wallet.totalEarned||0)+affiliateCommission,pending:Math.max(0,Number(wallet.pending||0)-affiliateCommission)};
      saveAffiliateWallet(next);
      recordLedgerEntry({type:"AFFILIATE_COMMISSION",orderId:order.id,transactionId:order.transactionId,amount:affiliateCommission,status:"PAYABLE",affiliate:order.affiliateCode});
      addNotification({role:"affiliate",recipient:order.affiliateEmail||"affiliate@mvec.rw",type:"commission",title:"Commission approved",message:`Commission of RWF ${affiliateCommission.toLocaleString()} is now available for ${order.id}.`,reference:order.id});
    }
    addNotification({ role:"vendor", recipient:order.vendor, type:"settlement", title:"MVEC released protected funds", message:`Funds for ${order.id} were released after delivery confirmation.`, reference:order.id });
    if (order.supplier) addNotification({ role:"supplier", recipient:order.supplier, type:"settlement", title:"MVEC released protected funds", message:`Funds for ${order.id} were released after supply receipt confirmation.`, reference:order.id });
    addNotification({ role:"admin", type:"settlement", title:"Protected settlement released", message:`${order.id} was released after ${actor} confirmation.`, reference:order.id });
  }
  return order;
}

export function getCommissionRate() {
  const raw=localStorage.getItem("mvec_commission_rate"); const n=Number(raw);
  return raw!==null && Number.isFinite(n) && n>=0 ? n : 5;
}
export function calculateCommission(amount, rate = getCommissionRate()) { return Math.round(Number(amount || 0) * Number(rate || 0) / 100); }
export function getAffiliateCommissionRate(){ const raw=localStorage.getItem('mvec_affiliate_commission_rate'); const n=Number(raw); return raw!==null&&Number.isFinite(n)&&n>=0?n:0.5; }
export function calculateAffiliateCommission(amount,rate=getAffiliateCommissionRate()){ return Math.round(Number(amount||0)*Number(rate||0)/100); }
export function getCatalogProducts(baseProducts = []) {
  const extra = read("mvec_vendor_products", []);
  const active = extra.filter(p => p.status !== "Archived");
  const ids = new Set(baseProducts.map(p => String(p.id)));
  return [...baseProducts, ...active.filter(p => !ids.has(String(p.id)))];
}

const WALLET_KEY = "mvec_affiliate_wallet";
export function getAffiliateWallet() {
  return read(WALLET_KEY, { available: 0, pending: 0, totalEarned: 0, withdrawn: 0, withdrawals: [] });
}
export function saveAffiliateWallet(wallet) { write(WALLET_KEY, wallet); return wallet; }
export function requestAffiliateWithdrawal(amount, method = "MTN MoMo", account = "") {
  const wallet = getAffiliateWallet();
  const value = Math.round(Number(amount) || 0);
  if (value < 10000) throw new Error("The minimum withdrawal amount is RWF 10,000.");
  if (value > wallet.available) throw new Error("Withdrawal amount is higher than your available balance.");
  const request = { id:`AFF-PAY-${Date.now()}`, amount:value, method, account, status:"Pending review", requestedAt:new Date().toISOString() };
  const next = {...wallet, available:wallet.available-value, withdrawn:Number(wallet.withdrawn||0)+value, withdrawals:[request,...(wallet.withdrawals||[])]};
  saveAffiliateWallet(next);
  addNotification({ role:"affiliate", recipient:"affiliate@mvec.rw", type:"payout", title:"Withdrawal request submitted", message:`Your RWF ${value.toLocaleString()} payout request is pending MVEC review.`, reference:request.id });
  return request;
}

const COMMISSION_RULES_KEY = 'mvec_commission_rules';
const defaultCommissionRules = [
  {id:'RULE-DEFAULT',scope:'Platform',target:'All sales',rate:5,status:'Active'},
];
export function getCommissionRules(){ return read(COMMISSION_RULES_KEY, defaultCommissionRules); }
export function saveCommissionRules(rules){ const normalized=(rules||[]).map(r=>({...r,rate:Number(r.rate)||0})); write(COMMISSION_RULES_KEY,normalized); localStorage.setItem('mvec_commission_rate',String(normalized.find(r=>r.scope==='Platform')?.rate ?? 5)); return normalized; }
export function getMatchingCommissionRate({category='',vendor='',vendorType='',productId='',promotion=false}={}){
  const rules=getCommissionRules();
  const matches=[
    rules.find(r=>r.status==='Active'&&r.scope==='Product'&&String(r.target)===String(productId)),
    rules.find(r=>r.status==='Active'&&r.scope==='Vendor'&&String(r.target).toLowerCase()===String(vendor).toLowerCase()),
    rules.find(r=>r.status==='Active'&&r.scope==='Vendor Type'&&String(r.target).toLowerCase()===String(vendorType).toLowerCase()),
    rules.find(r=>r.status==='Active'&&r.scope==='Category'&&String(r.target).toLowerCase()===String(category).toLowerCase()),
    promotion&&rules.find(r=>r.status==='Active'&&r.scope==='Promotion'),
    rules.find(r=>r.status==='Active'&&r.scope==='Platform')
  ].filter(Boolean);
  return Number(matches[0]?.rate ?? 5);
}
export function calculateOrderPricing({price=0,category='',vendor='',vendorType='',productId='',delivery=0,discount=0,promotion=false}={}){
  const basePrice=Math.max(0,Number(price)||0); const deliveryCost=Math.max(0,Number(delivery)||0); const discountAmount=Math.max(0,Number(discount)||0);
  const rate=getMatchingCommissionRate({category,vendor,vendorType,productId,promotion}); const mvecCommission=Math.round(Math.max(0,basePrice-discountAmount)*rate/100);
  const buyerTotal=Math.max(0,basePrice+deliveryCost-discountAmount); const vendorSettlement=Math.max(0,basePrice-discountAmount-mvecCommission);
  return {basePrice,delivery:deliveryCost,discount:discountAmount,commissionRate:rate,mvecCommission,buyerTotal,vendorSettlement};
}
export function snapshotOrderPricing(items=[],shipping=0,discount=0,promotion=false){
 const itemTotal=(items||[]).reduce((s,x)=>s+Number(x.price||0)*Number(x.qty||1),0);
 const first=items?.[0]||{}; const pricing=calculateOrderPricing({price:itemTotal,category:first.category||'',vendor:first.vendor||'',productId:first.productId||first.id||'',delivery:shipping,discount,promotion});
 return {...pricing,itemsSubtotal:itemTotal};
}

const SUBSCRIPTION_KEY='mvec_subscriptions';
export function getSubscription(type='buyer'){ const all=read(SUBSCRIPTION_KEY,{}); return all[type]||'free'; }
export function setSubscription(type,plan){ const all=read(SUBSCRIPTION_KEY,{}); all[type]=plan; write(SUBSCRIPTION_KEY,all); return plan; }

export function seedLedgerFromOrders(){
 const orders=getOrders(); const ledger=getLedger(); const existing=new Set(ledger.map(x=>x.transactionId||x.id));
 orders.forEach(o=>{if(o.transactionId&&!existing.has(o.transactionId)){recordLedgerEntry({type:o.payment==='SUCCESS'?'PAYMENT_HELD':'ORDER_CREATED',orderId:o.id,transactionId:o.transactionId,amount:o.total||0,status:o.settlementStatus||o.payment||'PENDING',productName:o.items?.[0]?.name||o.productName||''});}});
 return getLedger();
}

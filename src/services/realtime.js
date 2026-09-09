// Real-time synchronization service
// Uses standard Server-Sent Events (SSE) for zero-dependency, browser-native push updates

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const EVENTS_URL = API_BASE.replace(/\/api\/?$/, "") + "/api/events";

class RealtimeService {
  constructor() {
    this.source = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    try {
      if (this.source) {
        this.source.close();
      }

      this.source = new EventSource(EVENTS_URL);

      this.source.onopen = () => {
        this.isConnected = true;
      };

      this.source.addEventListener("connected", () => {
        this.isConnected = true;
      });

      this.source.addEventListener("order_status_updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          this.emit("order_status_updated", data);
          this.emit(`order:${data._id || data.id}`, data);
        } catch (err) {
          console.error("Error parsing order_status_updated:", err);
        }
      });

      this.source.addEventListener("order_created", (e) => {
        try {
          const data = JSON.parse(e.data);
          this.emit("order_created", data);
        } catch (err) {
          console.error("Error parsing order_created:", err);
        }
      });

      this.source.addEventListener("dashboard_update", (e) => {
        try {
          const data = JSON.parse(e.data);
          this.emit("dashboard_update", data);
        } catch (err) {
          console.error("Error parsing dashboard_update:", err);
        }
      });

      this.source.onerror = () => {
        this.isConnected = false;
        if (this.source) {
          this.source.close();
          this.source = null;
        }
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.init();
          }, 3000);
        }
      };
    } catch (error) {
      console.warn("RealtimeService init error:", error);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Listener error on event "${event}":`, err);
        }
      });
    }
  }

  subscribeToOrder(orderId, callback) {
    const unsubOrder = this.on(`order:${orderId}`, callback);
    const unsubGeneral = this.on("order_status_updated", (data) => {
      if (String(data._id || data.id) === String(orderId)) {
        callback(data);
      }
    });
    return () => {
      unsubOrder();
      unsubGeneral();
    };
  }
}

export const realtime = new RealtimeService();

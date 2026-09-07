import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../API/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('huska_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      localStorage.removeItem('huska_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  function persistSession({ token, user: u }) {
    localStorage.setItem('huska_token', token);
    setUser(u);
  }

  async function login(identity, password) {
    const data = await authApi.login(identity, password);
    persistSession(data);
    return data.user;
  }

  async function register(payload) {
    const data = await authApi.register(payload);
    persistSession(data);
    return data.user;
  }

  async function resetPassword(email) {
    return authApi.forgotPassword({ email });
  }

  function logout() {
    localStorage.removeItem('huska_token');
    setUser(null);
  }

  async function refresh() {
    return user;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, resetPassword, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../API/client';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function routeFor(user) {
  if (user.role === 'vendor') return '/vendor';
  if (user.role === 'supplier') return '/supplier';
  if (user.role === 'affiliate') return '/affiliate';
  if (user.role === 'delivery') return '/delivery';
  if (user.role === 'super_admin') return '/admin';
  return null;
}

export default function GoogleButton() {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const renderedRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!CLIENT_ID || !el) return undefined;

    const render = () => {
      if (!window.google?.accounts?.id) return;
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        ux_mode: 'popup',
        locale: 'en',
        callback: async (response) => {
          if (!response?.credential) return;
          setLoading(true);
          setError('');
          try {
            const user = await googleLogin(response.credential);
            navigate(routeFor(user) || location.state?.from || '/');
          } catch (err) {
            setError(extractErrorMessage(err));
          } finally {
            setLoading(false);
          }
        },
      });
      google.accounts.id.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.max(el.clientWidth || 340, 300),
      });
      renderedRef.current = true;
    };

    if (renderedRef.current) return undefined;
    if (window.google?.accounts?.id) {
      render();
      return undefined;
    }

    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer);
        render();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [googleLogin, location.state?.from, navigate]);

  if (!CLIENT_ID) {
    return (
      <div className="form-alert error">
        Google login is not configured (missing VITE_GOOGLE_CLIENT_ID).
      </div>
    );
  }

  return (
    <div className="google-btn-wrap">
      {error && <div className="form-alert error">{error}</div>}
      {loading && <div className="google-loading">Signing in with Google…</div>}
      <div ref={containerRef} className="google-btn" />
    </div>
  );
}
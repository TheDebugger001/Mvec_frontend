import { createPortal } from 'react-dom';
import { useState, useRef, useEffect } from 'react';

export const STATUS_CONFIG = {
  ACTIVE:     { label: 'Active',     hex: '#0f9f6e', pill: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  SUSPEND:    { label: 'Suspend',    hex: '#b56a00', pill: 'bg-amber-100 text-amber-700 border-amber-300' },
  BLOCK:      { label: 'Block',      hex: '#dc2626', pill: 'bg-rose-100 text-rose-700 border-rose-300' },
  INVESTIGATE:{ label: 'Investigate',hex: '#5046e5', pill: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
};

export const STATUS_VALUES = Object.entries(STATUS_CONFIG).map(([key, v]) => ({ key, ...v }));

export function resolveStatusLabel(key) {
  const upper = String(key || '').toUpperCase();
  return STATUS_CONFIG[upper]?.label || key || '—';
}

export function resolveStatusConfig(displayLabel) {
  const upper = String(displayLabel || '').toUpperCase();
  if (STATUS_CONFIG[upper]) return STATUS_CONFIG[upper];
  const lower = String(displayLabel || '').toLowerCase();
  return STATUS_VALUES.find(v => v.label.toLowerCase() === lower) || null;
}

function Chevron({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const config = resolveStatusConfig(value);
  const triggerPill = config ? config.pill : 'bg-slate-100 text-slate-500 border-slate-200';

  const pos = triggerRef.current
    ? triggerRef.current.getBoundingClientRect()
    : { bottom: 0, left: 0 };

  const menu = open && createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
      style={{ top: pos.bottom + window.scrollY + 6, left: pos.left + window.scrollX }}
    >
      {STATUS_VALUES.map(opt => {
        const isActive = config && opt.key === config.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => { onChange(opt.key); setOpen(false); }}
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${isActive ? (opt.pill + ' font-bold') : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div className="relative inline-block">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${triggerPill}${open ? ' shadow-sm' : ''}`}
        title="Change status"
      >
        {config ? config.label : value || '—'}
        <Chevron size={12} />
      </button>
      {menu}
    </div>
  );
}
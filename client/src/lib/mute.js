import { useEffect, useState } from 'react';

const KEY = 'jplay-muted';
const EVT = 'jplay-mute-change';

export function isMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(v) {
  try {
    if (v) window.localStorage.setItem(KEY, '1');
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVT, { detail: !!v }));
  } catch {}
}

export function useMuted() {
  const [muted, setLocal] = useState(isMuted);
  useEffect(() => {
    const onChange = (e) => setLocal(!!(e?.detail ?? isMuted()));
    const onStorage = (e) => {
      if (e.key === KEY) setLocal(isMuted());
    };
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return [muted, (v) => setMuted(typeof v === 'function' ? v(muted) : v)];
}

const KEY = 'jplay-settings-v1';

export const DEFAULTS = {
  clueSeconds: 15,
  fjSeconds: 30,
  autoAdvanceSeconds: 5,
  voiceRate: 1.0,
};

export function loadSettings() {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

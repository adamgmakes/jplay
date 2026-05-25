let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function tick(freq = 880) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.value = 0.06;
  o.connect(g);
  g.connect(c.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08);
  o.stop(c.currentTime + 0.1);
}

export function ding(correct = true) {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = correct ? 880 : 220;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(c.destination);
  const now = c.currentTime;
  o.start(now);
  g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  o.stop(now + 0.45);
}

export class FinalJeopardyTicker {
  constructor() {
    this.id = null;
  }
  start(intervalMs = 1000) {
    this.stop();
    this.id = setInterval(() => tick(660), intervalMs);
  }
  stop() {
    if (this.id) clearInterval(this.id);
    this.id = null;
  }
}

export function speak(text, opts = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = opts.rate ?? 1.0;
  u.pitch = opts.pitch ?? 1.0;
  u.volume = opts.volume ?? 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return u;
}

export function cancelSpeak() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function recognizerSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createRecognizer({ onResult, onEnd } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  let pauseTimer = null;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    const text = (finalText + ' ' + interim).trim();
    if (onResult) onResult(text);
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      try { rec.stop(); } catch {}
    }, 1000);
  };
  rec.onend = () => {
    if (pauseTimer) clearTimeout(pauseTimer);
    if (onEnd) onEnd(finalText.trim());
  };
  return rec;
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { DEFAULTS, loadSettings, saveSettings } from '../lib/settings.js';

export default function Settings() {
  const [s, setS] = useState(loadSettings());

  function update(k, v) {
    const next = { ...s, [k]: v };
    setS(next);
    saveSettings(next);
  }

  function reset() {
    setS({ ...DEFAULTS });
    saveSettings(DEFAULTS);
    toast.success('Settings reset');
  }

  return (
    <div className="px-6 py-10 max-w-xl mx-auto">
      <h2 className="font-jeopardy text-4xl text-jgold mb-6">Settings</h2>

      <Field
        label="Clue timer (seconds)"
        hint="How long you have to buzz in on a regular clue."
        value={s.clueSeconds}
        min={3}
        max={60}
        onChange={(v) => update('clueSeconds', v)}
      />
      <Field
        label="Final Jeopardy timer (seconds)"
        value={s.fjSeconds}
        min={5}
        max={120}
        onChange={(v) => update('fjSeconds', v)}
      />
      <Field
        label="Auto-advance delay (seconds)"
        hint="How long the answer reveal stays up before moving on. Press space to skip."
        value={s.autoAdvanceSeconds}
        min={1}
        max={20}
        onChange={(v) => update('autoAdvanceSeconds', v)}
      />
      <Field
        label="Play-Along selection delay (seconds)"
        hint="How long the highlighted next-clue cell shows before the clue opens. Press space to skip."
        value={s.paHighlightSeconds}
        min={1}
        max={20}
        onChange={(v) => update('paHighlightSeconds', v)}
      />
      <button
        onClick={reset}
        className="mt-6 px-4 py-2 rounded border border-jblueDark text-white/70 hover:text-white"
      >
        Reset to defaults
      </button>
    </div>
  );
}

function Field({ label, hint, value, onChange, min, max, step }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline">
        <label className="font-jeopardy text-jgold text-lg">{label}</label>
        <span className="font-jeopardy text-jgold text-xl">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-jgold"
      />
      {hint && <div className="text-xs text-white/60 mt-1">{hint}</div>}
    </div>
  );
}

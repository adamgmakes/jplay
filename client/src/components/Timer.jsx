import { useEffect, useRef, useState } from 'react';

export default function Timer({ seconds, active, onExpire, onTick }) {
  const [remaining, setRemaining] = useState(seconds);
  const startedAt = useRef(null);

  useEffect(() => {
    setRemaining(seconds);
    startedAt.current = null;
  }, [seconds]);

  useEffect(() => {
    if (!active) return;
    startedAt.current = performance.now();
    const startRemaining = remaining;
    let raf;
    const tick = () => {
      const elapsed = (performance.now() - startedAt.current) / 1000;
      const r = Math.max(0, startRemaining - elapsed);
      setRemaining(r);
      if (onTick) onTick(r);
      if (r <= 0) {
        onExpire?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const pct = Math.max(0, Math.min(100, (remaining / seconds) * 100));
  return (
    <div className="w-full h-2 bg-jblueDeep rounded overflow-hidden">
      <div
        className="h-full bg-jgold transition-[width] duration-100 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

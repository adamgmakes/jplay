import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Results() {
  const { sessionId } = useParams();
  const [data, setData] = useState(null);
  const [showCoryat, setShowCoryat] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`jplay-session-${sessionId}`);
      if (raw) setData(JSON.parse(raw));
    } catch {}
  }, [sessionId]);

  if (!data) {
    return (
      <div className="p-10 text-center text-white/70">
        Loading results, or session not found.{' '}
        <Link to="/play" className="text-jgold underline">Play a new game</Link>.
      </div>
    );
  }

  const s = data.state;
  const g = data.gameData;
  const contestants = g.contestants || [];
  const scores = contestants.map((c) => c.finalScore ?? 0);
  const maxBar = Math.max(s.score, ...scores, 1);
  const rank = data.rank;
  const wonOutright = rank === 1;

  function shareText() {
    return `J! Play — ${g.airDate || `Game #${g.gameId}`}\nScore: $${s.score.toLocaleString()} | Coryat: $${s.coryatScore.toLocaleString()}\nCorrect: ${s.cluesCorrect} | Incorrect: ${s.cluesIncorrect}${rank ? `\nWould have placed ${rank === 1 ? '1st 🏆' : rank === 2 ? '2nd' : '3rd'}` : ''}\n${location.origin}/results/${sessionId}`;
  }

  async function onShare() {
    const text = shareText();
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto">
      <h2 className="font-jeopardy text-4xl text-jgold mb-2">Final Score</h2>
      <div className="text-white/60 text-sm mb-6">
        {g.airDate ? `Aired ${g.airDate}` : `Game #${g.gameId}`}
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="rounded-lg bg-jblueDeep border border-jblueDark p-5">
          <div className="text-sm uppercase text-white/60">Your score</div>
          <div className="font-jeopardy text-5xl text-jgold">
            ${s.score.toLocaleString()}
          </div>
          <div className="mt-3 text-sm uppercase text-white/60">Coryat score</div>
          <div className="font-jeopardy text-3xl text-white">
            ${s.coryatScore.toLocaleString()}
          </div>
          <button
            onClick={() => setShowCoryat((x) => !x)}
            className="mt-2 text-xs underline text-white/60"
          >
            What is a Coryat score?
          </button>
          {showCoryat && (
            <p className="text-xs text-white/70 mt-2">
              The Coryat score measures clue-by-clue performance ignoring Daily Doubles and Final Jeopardy wagers,
              and never deducts for wrong answers. Higher Coryat = more knowledge demonstrated.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-jblueDeep border border-jblueDark p-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Correct" value={s.cluesCorrect} color="text-jgreen" />
            <Stat label="Incorrect" value={s.cluesIncorrect} color="text-jred" />
            <Stat label="Timed out" value={s.cluesTimedOut} />
            <Stat label="Accepted anyway" value={s.cluesAcceptedOverride} />
            <Stat label="DDs seen" value={s.dailyDoublesSeen} />
            <Stat label="DDs correct" value={s.dailyDoublesCorrect} />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h3 className="font-jeopardy text-2xl text-jgold mb-3">Compare to contestants</h3>
        <div className="space-y-2">
          <Bar name="You" score={s.score} max={maxBar} highlight />
          {contestants.map((c, i) => (
            <Bar key={i} name={c.name} score={c.finalScore ?? 0} max={maxBar} />
          ))}
        </div>
        {rank && (
          <div className="mt-3 text-white/80">
            You would have placed{' '}
            <span className="font-bold">
              {rank === 1 ? '1st 🏆' : rank === 2 ? '2nd' : '3rd or below'}
            </span>{wonOutright ? ' — you beat the winner!' : ''}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h3 className="font-jeopardy text-2xl text-jgold mb-3">Categories</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {Object.entries(s.categoryResults).map(([cat, v]) => (
            <div
              key={cat}
              className="flex justify-between border border-jblueDark rounded p-2 bg-jblueDeep"
            >
              <span>{cat}</span>
              <span>
                <span className="text-jgreen">{v.correct}✓</span>{' '}
                <span className="text-jred">{v.incorrect}✗</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 flex gap-3 flex-wrap">
        <button
          onClick={onShare}
          className="px-5 py-3 rounded bg-jgold text-jchrome font-bold"
        >
          Share
        </button>
        <Link
          to="/play"
          className="px-5 py-3 rounded border border-jgold text-jgold"
        >
          New game
        </Link>
        <Link
          to={`/game/${g.gameId}`}
          className="px-5 py-3 rounded border border-white/30 text-white/80"
        >
          Play again
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="text-xs uppercase text-white/50">{label}</div>
      <div className={`font-jeopardy text-2xl ${color || 'text-white'}`}>{value}</div>
    </div>
  );
}

function Bar({ name, score, max, highlight }) {
  const pct = Math.max(2, (Math.max(score, 0) / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className={highlight ? 'text-jgold font-bold' : ''}>{name}</span>
        <span>${score.toLocaleString()}</span>
      </div>
      <div className="h-3 bg-jblueDeep rounded">
        <div
          className={`h-full rounded ${highlight ? 'bg-jgold' : 'bg-jblueDark'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

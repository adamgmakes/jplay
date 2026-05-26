import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { fetchRandomGame, fetchSeasons } from '../lib/api.js';

const MODES = [
  { id: 'board', label: 'Board Mode', desc: 'The classic. Pick clues off the board, one round at a time.' },
  { id: 'random', label: 'Random Clue Mode', desc: 'Clues are served in random order. No strategy, just speed.' },
];

export default function Play() {
  const nav = useNavigate();
  const [mode, setMode] = useState('board');
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSeasons()
      .then(setSeasons)
      .catch(() => {});
  }, []);

  function goWithGame(gameId) {
    nav(`/game/${gameId}?mode=${mode}`);
  }

  async function pickRandom() {
    setLoading(true);
    try {
      const game = await fetchRandomGame(season || undefined);
      goWithGame(game.gameId);
    } catch (e) {
      toast.error('Could not find a game — try again.');
    } finally {
      setLoading(false);
    }
  }

  function pickById(e) {
    e.preventDefault();
    const id = parseInt(gameIdInput, 10);
    if (!id || id <= 0) {
      toast.error('Enter a valid J! Archive game ID');
      return;
    }
    goWithGame(id);
  }

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <h2 className="font-jeopardy text-4xl text-jgold">Start a game</h2>

      <section className="mt-8">
        <h3 className="uppercase text-xs tracking-widest text-white/60 mb-2">Mode</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`text-left p-4 rounded border ${
                mode === m.id
                  ? 'border-jgold bg-jblueDark'
                  : 'border-jblueDark/60 hover:border-jblueDark'
              }`}
            >
              <div className="font-jeopardy text-xl text-jgold">{m.label}</div>
              <div className="text-sm text-white/70 mt-1">{m.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 grid sm:grid-cols-3 gap-4">
        <button
          onClick={pickRandom}
          disabled={loading}
          className="p-6 rounded bg-jgold text-jchrome font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Random Game'}
        </button>

        <div className="p-4 rounded border border-jblueDark bg-jblueDeep">
          <label className="text-xs uppercase tracking-widest text-white/60">Random by Season</label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="mt-2 w-full bg-jchrome border border-jblueDark rounded p-2"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} {s.years ? `— ${s.years}` : ''}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={pickById}
          className="p-4 rounded border border-jblueDark bg-jblueDeep"
        >
          <label className="text-xs uppercase tracking-widest text-white/60">By Game ID</label>
          <input
            value={gameIdInput}
            onChange={(e) => setGameIdInput(e.target.value)}
            placeholder="e.g. 4234"
            className="mt-2 w-full bg-jchrome border border-jblueDark rounded p-2"
          />
          <button className="mt-2 w-full rounded bg-jblueDark hover:bg-jblue p-2 text-sm">
            Load that game
          </button>
        </form>
      </section>
    </div>
  );
}

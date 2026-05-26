import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchRandomGame,
  fetchSeasons,
  fetchSeasonGames,
} from '../lib/api.js';

const MODES = [
  { id: 'board', label: 'Board Mode', desc: 'The classic. Pick clues off the board, one round at a time.' },
  { id: 'random', label: 'Random Clue Mode', desc: 'Clues are served in random order. No strategy, just speed.' },
  { id: 'playalong', label: 'Play Along', desc: 'Real selection order. See contestant responses + running scores as the game unfolds.' },
];

export default function Play() {
  const nav = useNavigate();
  const [mode, setMode] = useState('board');
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [gameIdInput, setGameIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  useEffect(() => {
    fetchSeasons()
      .then(setSeasons)
      .catch(() => toast.error('Could not load seasons list.'));
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
        <div className="grid sm:grid-cols-3 gap-3">
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
                {s.label}
                {s.years ? ` — ${s.years}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setBrowserOpen(true)}
            className="mt-2 w-full text-xs rounded bg-jblueDark hover:bg-jblue p-2"
          >
            Browse episodes…
          </button>
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

      {browserOpen && (
        <EpisodeBrowser
          seasons={seasons}
          onClose={() => setBrowserOpen(false)}
          onPick={(gameId) => {
            setBrowserOpen(false);
            goWithGame(gameId);
          }}
        />
      )}
    </div>
  );
}

function EpisodeBrowser({ seasons, onClose, onPick }) {
  const [selSeason, setSelSeason] = useState(seasons[0]?.id || '');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!selSeason) return;
    setLoading(true);
    fetchSeasonGames(selSeason)
      .then(setGames)
      .catch(() => toast.error('Could not load season games'))
      .finally(() => setLoading(false));
  }, [selSeason]);

  const filtered = useMemo(() => {
    if (!query) return games;
    const q = query.toLowerCase();
    return games.filter(
      (g) =>
        (g.airDate || '').toLowerCase().includes(q) ||
        (g.rowText || '').toLowerCase().includes(q) ||
        String(g.gameId).includes(q)
    );
  }, [games, query]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-jchrome border border-jblueDark rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-jblueDark flex justify-between items-center gap-3 flex-wrap">
          <div className="font-jeopardy text-2xl text-jgold">Browse episodes</div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3 border-b border-jblueDark">
          <select
            value={selSeason}
            onChange={(e) => setSelSeason(e.target.value)}
            className="bg-jblueDeep border border-jblueDark rounded p-2"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.years ? ` — ${s.years}` : ''}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by date, contestant, game id…"
            className="bg-jblueDeep border border-jblueDark rounded p-2"
          />
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <div className="p-6 text-white/60 text-sm">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-white/60 text-sm">No episodes match.</div>
          )}
          <ul>
            {filtered.map((g) => (
              <li
                key={g.gameId}
                onClick={() => onPick(g.gameId)}
                className="px-4 py-3 border-b border-jblueDark/40 hover:bg-jblueDark/40 cursor-pointer"
              >
                <div className="flex justify-between gap-3">
                  <div className="font-jeopardy text-jgold">
                    {g.showLabel || `#${g.gameId}`}
                  </div>
                  <div className="text-sm text-white/60">
                    {g.airDate || ''}
                  </div>
                </div>
                {g.rowText && (
                  <div className="text-xs text-white/60 mt-1 line-clamp-2">
                    {g.rowText}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

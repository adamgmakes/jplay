import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const TABS = [
  { id: 'top_coryat', label: 'Top Coryat' },
  { id: 'avg_coryat', label: 'Avg Coryat (min 5)' },
  { id: 'most_played', label: 'Most Played' },
  { id: 'week', label: 'This Week' },
];

export default function Leaderboard() {
  const [tab, setTab] = useState('top_coryat');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const view = {
      top_coryat: 'v_leaderboard_top_coryat',
      avg_coryat: 'v_leaderboard_avg_coryat',
      most_played: 'v_leaderboard_most_played',
      week: 'v_leaderboard_week',
    }[tab];
    supabase
      .from(view)
      .select('*')
      .then(({ data }) => setRows(data || []));
  }, [tab]);

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <h2 className="font-jeopardy text-4xl text-jgold mb-5">Leaderboard</h2>
      <div className="flex flex-wrap gap-2 mb-5 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded ${
              tab === t.id ? 'bg-jgold text-jchrome font-bold' : 'bg-jblueDark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-white/60">
            <th className="py-2">#</th>
            <th>Player</th>
            {(tab === 'top_coryat' || tab === 'week') && <th>Coryat</th>}
            {tab === 'avg_coryat' && <th>Avg / Games</th>}
            {tab === 'most_played' && <th>Games / Avg</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-jblueDark/60">
              <td className="py-2">{i + 1}</td>
              <td>
                <Link
                  to={`/profile/${r.username}`}
                  className="text-jgold underline"
                >
                  {r.username}
                </Link>
              </td>
              {(tab === 'top_coryat' || tab === 'week') && (
                <td>${r.coryat_score?.toLocaleString()}</td>
              )}
              {tab === 'avg_coryat' && (
                <td>
                  ${r.avg_coryat} / {r.games_played}
                </td>
              )}
              {tab === 'most_played' && (
                <td>
                  {r.games_played} / ${r.avg_coryat}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-white/50">
                No games yet — be the first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

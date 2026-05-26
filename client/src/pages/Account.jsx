import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export default function Account() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState('overview');
  const [sessions, setSessions] = useState([]);
  const [cats, setCats] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav('/auth');
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('game_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('played_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setSessions(data || []));
    supabase
      .from('category_stats')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => setCats(data || []));
  }, [user]);

  if (!user) return null;

  async function saveUsername() {
    const trimmed = newName.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(trimmed)) {
      toast.error('Username must be 3–24 chars: letters, numbers, underscore.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        toast.error('That username is taken.');
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success('Username updated');
    setEditingName(false);
    await refreshProfile();
  }

  const completed = sessions.filter((s) => s.completed);
  const avgCoryat = completed.length
    ? Math.round(completed.reduce((a, c) => a + (c.coryat_score || 0), 0) / completed.length)
    : 0;
  const last10 = completed.slice(0, 10);
  const last10Avg = last10.length
    ? Math.round(last10.reduce((a, c) => a + (c.coryat_score || 0), 0) / last10.length)
    : 0;
  const wins = completed.filter((s) => s.contestant_rank === 1).length;
  const winRate = completed.length ? Math.round((wins / completed.length) * 100) : 0;
  const totalCorrect = completed.reduce((a, c) => a + (c.clues_correct || 0), 0);
  const totalIncorrect = completed.reduce((a, c) => a + (c.clues_incorrect || 0), 0);
  const best = completed.reduce((a, c) => (c.coryat_score > (a?.coryat_score || 0) ? c : a), null);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        {editingName ? (
          <div className="flex gap-2 items-center">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-jblueDeep border border-jblueDark rounded px-3 py-2 font-jeopardy text-2xl text-jgold"
              placeholder="username"
            />
            <button
              onClick={saveUsername}
              disabled={saving}
              className="px-3 py-2 rounded bg-jgold text-jchrome text-sm font-bold disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="px-3 py-2 rounded border border-jblueDark text-sm text-white/70"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="font-jeopardy text-4xl text-jgold">
              {profile?.username || 'Your account'}
            </h2>
            <button
              onClick={() => {
                setNewName(profile?.username || '');
                setEditingName(true);
              }}
              className="text-xs px-2 py-1 rounded border border-jblueDark text-white/70 hover:text-white"
            >
              Edit
            </button>
          </div>
        )}
        {profile?.username && !editingName && (
          <Link to={`/profile/${profile.username}`} className="text-jgold underline text-sm">
            View public profile
          </Link>
        )}
      </div>
      <div className="text-xs text-white/40 mb-6">{user.email}</div>

      <div className="flex gap-3 mb-6 text-sm">
        {[
          ['overview', 'Stats'],
          ['categories', 'Categories'],
          ['history', 'History'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded ${
              tab === id ? 'bg-jgold text-jchrome font-bold' : 'bg-jblueDark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Games played" value={completed.length} />
          <Stat label="Average Coryat" value={`$${avgCoryat}`} />
          <Stat label="Last 10 average" value={`$${last10Avg}`} />
          <Stat label="Win rate" value={`${winRate}%`} />
          <Stat label="Total correct" value={totalCorrect} />
          <Stat label="Total incorrect" value={totalIncorrect} />
          <Stat label="Best Coryat" value={`$${best?.coryat_score || 0}`} />
        </div>
      )}

      {tab === 'categories' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60">
                <th className="py-2">Category</th>
                <th>Played</th>
                <th>Correct</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {cats
                .slice()
                .sort(
                  (a, b) =>
                    b.correct + b.incorrect - (a.correct + a.incorrect)
                )
                .map((c) => {
                  const tot = c.correct + c.incorrect;
                  const pct = tot ? Math.round((c.correct / tot) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-t border-jblueDark/60">
                      <td className="py-2">{c.category_name}</td>
                      <td>{tot}</td>
                      <td>{c.correct}</td>
                      <td>{pct}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60">
                <th className="py-2">Air date</th>
                <th>Score</th>
                <th>Coryat</th>
                <th>Correct</th>
                <th>Incorrect</th>
                <th>Place</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-jblueDark/60 hover:bg-jblueDark/30 cursor-pointer">
                  <td className="py-2">{s.air_date || `#${s.game_id}`}</td>
                  <td>${s.score?.toLocaleString()}</td>
                  <td>${s.coryat_score?.toLocaleString()}</td>
                  <td>{s.clues_correct}</td>
                  <td>{s.clues_incorrect}</td>
                  <td>{s.contestant_rank || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded bg-jblueDeep border border-jblueDark p-4">
      <div className="text-xs uppercase text-white/60">{label}</div>
      <div className="font-jeopardy text-3xl text-jgold">{value}</div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Profile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [cats, setCats] = useState([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle()
      .then(async ({ data }) => {
        setProfile(data);
        if (!data) return;
        const { data: s } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('user_id', data.id)
          .order('played_at', { ascending: false })
          .limit(10);
        setSessions(s || []);
        const { data: c } = await supabase
          .from('category_stats')
          .select('*')
          .eq('user_id', data.id);
        setCats(c || []);
      });
  }, [username]);

  if (!profile) return <div className="p-10 text-white/60">Profile not found.</div>;

  const completed = sessions.filter((s) => s.completed);
  const avg = completed.length
    ? Math.round(completed.reduce((a, c) => a + (c.coryat_score || 0), 0) / completed.length)
    : 0;
  const best = completed.reduce((a, c) => (c.coryat_score > (a?.coryat_score || 0) ? c : a), null);

  const ranked = cats
    .filter((c) => c.correct + c.incorrect >= 3)
    .map((c) => ({ ...c, pct: c.correct / (c.correct + c.incorrect) }));
  const top = [...ranked].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const bot = [...ranked].sort((a, b) => a.pct - b.pct).slice(0, 5);

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-jgold text-jchrome font-jeopardy text-2xl flex items-center justify-center">
          {initials}
        </div>
        <div>
          <h2 className="font-jeopardy text-3xl text-jgold">{profile.username}</h2>
          {profile.display_name && (
            <div className="text-white/60 text-sm">{profile.display_name}</div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Stat label="Games" value={completed.length} />
        <Stat label="Avg Coryat" value={`$${avg}`} />
        <Stat label="Best" value={`$${best?.coryat_score || 0}`} />
      </div>

      <h3 className="font-jeopardy text-2xl text-jgold mb-3">Recent games</h3>
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="text-left text-white/60">
            <th className="py-2">Date</th>
            <th>Score</th>
            <th>Coryat</th>
            <th>Place</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-jblueDark/60">
              <td className="py-2">{s.air_date || `#${s.game_id}`}</td>
              <td>${s.score?.toLocaleString()}</td>
              <td>${s.coryat_score?.toLocaleString()}</td>
              <td>{s.contestant_rank || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <h4 className="font-jeopardy text-xl text-jgreen mb-2">Strengths</h4>
          {top.map((c) => (
            <div key={c.id} className="flex justify-between text-sm py-1">
              <span>{c.category_name}</span>
              <span>{Math.round(c.pct * 100)}%</span>
            </div>
          ))}
        </div>
        <div>
          <h4 className="font-jeopardy text-xl text-jred mb-2">Weaknesses</h4>
          {bot.map((c) => (
            <div key={c.id} className="flex justify-between text-sm py-1">
              <span>{c.category_name}</span>
              <span>{Math.round(c.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
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

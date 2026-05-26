import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Home() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ totalGames: null });

  useEffect(() => {
    supabase
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setStats((s) => ({ ...s, totalGames: count ?? 0 })))
      .catch(() => {});
  }, []);

  return (
    <div className="px-6 py-16 max-w-5xl mx-auto">
      <h1 className="font-jeopardy text-6xl sm:text-8xl text-jgold tracking-wider">J! PLAY</h1>
      <p className="mt-3 text-xl text-white/80">
        Play real Jeopardy! games from history.
      </p>
      <p className="mt-2 text-sm text-white/50">
        Powered by <a href="https://j-archive.com" className="underline">J! Archive</a>. Non-commercial, for-fans.
      </p>

      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <div className="rounded-lg bg-jblueDeep border border-jblueDark p-4">
          <div className="text-3xl font-jeopardy text-jgold">9,000+</div>
          <div className="text-sm text-white/70">games in archive</div>
        </div>
        <div className="rounded-lg bg-jblueDeep border border-jblueDark p-4">
          <div className="text-3xl font-jeopardy text-jgold">
            {stats.totalGames ?? '—'}
          </div>
          <div className="text-sm text-white/70">games played on J! Play</div>
        </div>
        <div className="rounded-lg bg-jblueDeep border border-jblueDark p-4">
          <div className="text-3xl font-jeopardy text-jgold">2</div>
          <div className="text-sm text-white/70">play modes: board / random</div>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          to="/play"
          className="px-6 py-3 rounded bg-jgold text-jchrome font-bold text-lg hover:brightness-110"
        >
          Play Now
        </Link>
        {!user ? (
          <Link
            to="/auth"
            className="px-6 py-3 rounded border border-jgold text-jgold font-bold text-lg hover:bg-jgold/10"
          >
            Sign up to save stats
          </Link>
        ) : (
          <Link
            to="/account"
            className="px-6 py-3 rounded border border-jgold text-jgold font-bold text-lg hover:bg-jgold/10"
          >
            Welcome back, {profile?.username || 'player'}
          </Link>
        )}
      </div>
    </div>
  );
}

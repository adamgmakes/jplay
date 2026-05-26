import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

export default function Auth() {
  const [mode, setMode] = useState('signin'); // signin | signup | magic
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { refreshProfile } = useAuth();

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!username.trim()) {
          toast.error('Pick a username');
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: window.location.origin + '/account',
          },
        });
        if (error) throw error;
        // Profile is created server-side by the on_auth_user_created trigger.
        toast.success('Account created — check your email to confirm');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await refreshProfile();
        nav('/play');
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin + '/account' },
        });
        if (error) throw error;
        toast.success('Magic link sent — check your inbox');
      }
    } catch (e) {
      toast.error(e.message || 'Auth failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-12 max-w-md mx-auto">
      <h2 className="font-jeopardy text-3xl text-jgold mb-6">
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Magic link sign-in'}
      </h2>
      <div className="flex gap-2 text-xs mb-4">
        <button
          onClick={() => setMode('signin')}
          className={`px-2 py-1 rounded ${mode === 'signin' ? 'bg-jgold text-jchrome' : 'bg-jblueDark'}`}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode('signup')}
          className={`px-2 py-1 rounded ${mode === 'signup' ? 'bg-jgold text-jchrome' : 'bg-jblueDark'}`}
        >
          Sign up
        </button>
        <button
          onClick={() => setMode('magic')}
          className={`px-2 py-1 rounded ${mode === 'magic' ? 'bg-jgold text-jchrome' : 'bg-jblueDark'}`}
        >
          Magic link
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          required
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded bg-jblueDeep border border-jblueDark"
        />
        {mode !== 'magic' && (
          <input
            required
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded bg-jblueDeep border border-jblueDark"
          />
        )}
        {mode === 'signup' && (
          <input
            required
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded bg-jblueDeep border border-jblueDark"
          />
        )}
        <button
          disabled={loading}
          className="w-full py-3 rounded bg-jgold text-jchrome font-bold disabled:opacity-50"
        >
          {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
        </button>
      </form>
    </div>
  );
}

import { Routes, Route, Link } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Home from './pages/Home.jsx';
import Play from './pages/Play.jsx';
import Game from './pages/Game.jsx';
import Results from './pages/Results.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Account from './pages/Account.jsx';
import Auth from './pages/Auth.jsx';
import Settings from './pages/Settings.jsx';
import MuteButton from './components/MuteButton.jsx';

function Nav() {
  const { user, profile, signOut } = useAuth();
  return (
    <header className="bg-jchrome border-b border-jblueDark px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <Link to="/" className="font-jeopardy text-2xl text-jgold tracking-wider">
        J! PLAY
      </Link>
      <nav className="flex items-center gap-3 sm:gap-5 text-sm">
        <Link to="/play" className="hover:text-jgold">Play</Link>
        <Link to="/leaderboard" className="hover:text-jgold">Leaderboard</Link>
        <Link to="/settings" className="hover:text-jgold">Settings</Link>
        <MuteButton />
        {user ? (
          <>
            <Link to="/account" className="hover:text-jgold">
              {profile?.username || 'Account'}
            </Link>
            <button onClick={signOut} className="text-xs px-2 py-1 rounded bg-jblueDark hover:bg-jblue">
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth" className="px-3 py-1.5 rounded bg-jgold text-jchrome font-semibold hover:brightness-110">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Routes>
        {/* Game route gets no chrome */}
        <Route path="/game/:gameId" element={<Game />} />
        <Route
          path="*"
          element={
            <>
              <Nav />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/play" element={<Play />} />
                  <Route path="/results/:sessionId" element={<Results />} />
                  <Route path="/profile/:username" element={<Profile />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </main>
            </>
          }
        />
      </Routes>
    </div>
  );
}

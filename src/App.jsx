import { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, logout, getUserPreferences } from './firebase';
import AuthScreen from './components/AuthScreen';
import FirstRunSetup from './components/FirstRunSetup';
import Wizard from './components/Wizard';
import Dashboard from './components/Dashboard';
import { Wheat, FlaskConical, BarChart3, LogOut, Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('wizard'); // 'wizard' | 'dashboard'
  const [needsFirstRun, setNeedsFirstRun] = useState(false);
  const [checkingFirstRun, setCheckingFirstRun] = useState(false);

  useEffect(() => {
    // If Firebase is not configured, skip auth and show AuthScreen immediately.
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    // Timeout fallback: if Firebase never responds, show auth screen.
    const timeout = setTimeout(() => setAuthLoading(false), 3000);

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setCheckingFirstRun(true);
        try {
          const prefs = await getUserPreferences(u.uid);
          setNeedsFirstRun(!prefs?.initialHydration);
        } catch {
          setNeedsFirstRun(true);
        } finally {
          setCheckingFirstRun(false);
        }
      }
    });
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setView('wizard');
    setNeedsFirstRun(false);
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-amber-950/40 to-stone-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // Not logged in
  if (!user) return <AuthScreen />;

  // First run check loading
  if (checkingFirstRun) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-amber-950/40 to-stone-950">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // First run setup
  if (needsFirstRun) {
    return (
      <FirstRunSetup
        userId={user.uid}
        onComplete={() => setNeedsFirstRun(false)}
      />
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950/30 to-stone-950">
      {/* Top bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-stone-950/70 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow shadow-amber-500/20">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm sm:text-base tracking-tight">
              Sourdough Analytics
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <button
              id="nav-wizard"
              onClick={() => setView('wizard')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === 'wizard'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  : 'text-stone-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span className="hidden sm:inline">New Session</span>
            </button>
            <button
              id="nav-dashboard"
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                view === 'dashboard'
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                  : 'text-stone-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              id="nav-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-all ml-1"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {view === 'wizard' ? (
          <Wizard
            key={Date.now()} // Reset wizard on each new session click
            userId={user.uid}
            onComplete={() => setView('dashboard')}
          />
        ) : (
          <Dashboard userId={user.uid} />
        )}
      </main>
    </div>
  );
}

export default App;

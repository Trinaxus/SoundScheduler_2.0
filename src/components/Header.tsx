import React from 'react';
import { Clock, LogOut, Menu, X, Music } from 'lucide-react';
import { useSounds } from '../context/SoundContext';
import { useAuth } from '../hooks/useAuth';
import { logout } from '../lib/api';

const Header: React.FC = () => {
  const { isHost, setHostMode } = useSounds();
  const { authenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [time, setTime] = React.useState(new Date().toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false
  }));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Clean up URL from cache-busting param after reloads
  React.useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('logged_out')) {
        url.searchParams.delete('logged_out');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      try {
        // Clear local client state regardless
        window.localStorage?.clear?.();
        window.sessionStorage?.clear?.();
      } catch {}
      // Hard redirect to root (no cache-busting param)
      window.location.replace(`${window.location.origin}/`);
    }
  };

  return (
    <header className="relative z-40 bg-neutral-900/85 border-b-[0.5px] border-neutral-800 backdrop-blur-sm shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
        {/* Mobile: compact top bar */}
        <div className="flex items-center justify-between sm:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            onTouchStart={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#4ECBD9] to-[#F471B5] text-transparent bg-clip-text tracking-tight">
            <span className="inline-flex items-center gap-2">
              <Music className="w-5 h-5 text-[#4ECBD9]" />
              <span>SoundScheduler</span>
            </span>
          </h1>
          {authenticated ? (
            <button
              onClick={handleLogout}
              aria-label="Abmelden"
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-9 h-9" />
          )}
        </div>

        {/* Desktop: full header */}
        <div className="hidden sm:flex items-center justify-between">
          {/* Logo/Title (now left) */}
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4ECBD9] to-[#F471B5] text-transparent bg-clip-text tracking-tight">
            <span className="inline-flex items-center gap-3">
              <Music className="w-7 h-7 text-[#4ECBD9]" />
              <span>SoundScheduler</span>
            </span>
          </h1>

          {/* Clock (now center) */}
          <div className="flex items-center space-x-2 bg-neutral-700/50 px-4 py-2 rounded-xl border-[0.5px] border-[#4ECBD9]/10 shadow-glow-cyan">
            <Clock className="h-4 w-4 text-[#4ECBD9]" />
            <div className="text-base font-medium font-mono tracking-wider">
              <span className="text-[#4ECBD9]">{time.split(':')[0]}</span>
              <span className="text-neutral-500 mx-0.5">:</span>
              <span className="text-[#4ECBD9]">{time.split(':')[1]}</span>
              <span className="text-neutral-500 mx-0.5">:</span>
              <span className="text-[#4ECBD9]">{time.split(':')[2]}</span>
            </div>
          </div>

          {/* Host/Remote segmented toggle + Logout (right) */}
          <div className="flex items-center gap-2">
            <div className="flex bg-neutral-700/40 border border-neutral-600/50 rounded-lg overflow-hidden">
              <button
                onClick={() => setHostMode(true)}
                aria-pressed={isHost}
                className={`px-4 py-2 text-sm transition-colors ${
                  isHost ? 'bg-[#0d1718] text-[#4ECBD9] ring-1 ring-[#4ECBD9]/40' : 'text-neutral-300 hover:bg-neutral-600/40'
                }`}
                title="Dieses Gerät als Player (Host) festlegen"
              >
                Host
              </button>
              <button
                onClick={() => setHostMode(false)}
                aria-pressed={!isHost}
                className={`px-4 py-2 text-sm transition-colors ${
                  !isHost ? 'bg-[#0d1718] text-[#4ECBD9] ring-1 ring-[#4ECBD9]/40' : 'text-neutral-300 hover:bg-neutral-600/40'
                }`}
                title="Remote-Modus: Dieses Gerät sendet nur Play/Pause an den Host"
              >
                Remote
              </button>
            </div>
            {authenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg border-[0.5px] border-neutral-600/50 bg-neutral-700/50 text-neutral-400 hover:bg-neutral-600 hover:text-white active:bg-neutral-500 transition-all touch-manipulation"
                title="Abmelden"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Abmelden</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile overlay menu */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-0 left-0 right-0 bg-neutral-800 border-b border-neutral-700 rounded-b-xl p-4 pt-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-neutral-200">Menü</h2>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Menü schließen"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clock */}
            <div className="flex items-center justify-between bg-neutral-700/40 border border-neutral-600/40 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#4ECBD9]" />
                <span className="font-mono text-sm text-[#C1C2C5]">
                  {time}
                </span>
              </div>
            </div>

            {/* Host/Remote toggle (compact) */}
            <div className="flex bg-neutral-700/40 border border-neutral-600/50 rounded-lg overflow-hidden mb-3">
              <button
                onClick={() => setHostMode(true)}
                aria-pressed={isHost}
                className={`flex-1 px-2 py-1 text-xs transition-colors ${
                  isHost ? 'bg-[#0d1718] text-[#4ECBD9] ring-1 ring-[#4ECBD9]/40' : 'text-neutral-300 hover:bg-neutral-600/40'
                }`}
              >
                Host
              </button>
              <button
                onClick={() => setHostMode(false)}
                aria-pressed={!isHost}
                className={`flex-1 px-2 py-1 text-xs transition-colors ${
                  !isHost ? 'bg-[#0d1718] text-[#4ECBD9] ring-1 ring-[#4ECBD9]/40' : 'text-neutral-300 hover:bg-neutral-600/40'
                }`}
              >
                <span className="sr-only">Remote</span>
              </button>
            </div>

            {/* (On Air toggle removed per request) */}

            {/* Logout removed here to avoid duplication; header button remains */}
          </div>
        </div>
      )}
      {/* Gradient hairline */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[0.5px] bg-gradient-to-r from-[#4ECBD9] via-[#F471B5] to-[#4ECBD9] opacity-60" />
    </header>
  );
};

export default Header;
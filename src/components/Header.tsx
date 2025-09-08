import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { useSounds } from '../context/SoundContext';
import { logout } from '../lib/api';

const Header: React.FC = () => {
  const { isHost, setHostMode } = useSounds();
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
    <header className="bg-[#1c1917]/80 border-b-[0.5px] border-[#4ECBD9]/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          
          {/* Clock */}
          <div className="flex items-center space-x-2 bg-neutral-700/50 px-3 sm:px-4 py-2 rounded-xl border-[0.5px] border-[#4ECBD9]/10 shadow-glow-cyan">
            <Clock className="h-4 w-4 text-[#4ECBD9]" />
            <div className="text-sm sm:text-base font-medium font-mono tracking-wider">
              <span className="text-[#4ECBD9]">{time.split(':')[0]}</span>
              <span className="text-neutral-500 mx-0.5">:</span>
              <span className="text-[#4ECBD9]">{time.split(':')[1]}</span>
              <span className="text-neutral-500 mx-0.5">:</span>
              <span className="text-[#4ECBD9]">{time.split(':')[2]}</span>
            </div>
          </div>

          {/* Logo/Title */}
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-[#4ECBD9] to-[#F471B5] text-transparent bg-clip-text tracking-tight">
            SoundScheduler
          </h1>

          {/* Host toggle + Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHostMode(!isHost)}
              className={`px-3 sm:px-4 py-2 rounded-lg border-[0.5px] transition-all touch-manipulation ${isHost ? 'bg-[#0d1718] text-[#4ECBD9] border-[#4ECBD9]/40' : 'bg-neutral-700/50 text-neutral-300 border-neutral-600/50 hover:bg-neutral-600 hover:text-white'}`}
              title={isHost ? 'Dieses Gerät ist der Player (Host). Zum Remote-Modus wechseln.' : 'Remote-Modus: Dieses Gerät sendet nur Play/Pause an den Host. Zum Host wechseln.'}
            >
              <span className="text-sm font-medium">{isHost ? 'Host' : 'Remote'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg border-[0.5px] border-neutral-600/50 bg-neutral-700/50 text-neutral-400 hover:bg-neutral-600 hover:text-white active:bg-neutral-500 transition-all touch-manipulation"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Abmelden</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
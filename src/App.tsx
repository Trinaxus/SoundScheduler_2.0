import React, { Suspense, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import { useAuth } from './hooks/useAuth';
import { SoundProvider } from './context/SoundContext';
import SoundboardView from './components/SoundboardView';
import Header from './components/Header';
const AuthedApp = React.lazy(() => import('./AuthedApp'));

function App() {
  const { authenticated, role, loading } = useAuth();

  // Keep local Host/Remote toggle in sync with server-side role
  useEffect(() => {
    try {
      if (authenticated && role === 'admin') {
        window.localStorage.setItem('player_is_host', '1');
      } else if (authenticated && role === 'remote') {
        window.localStorage.setItem('player_is_host', '0');
      }
    } catch {}
  }, [authenticated, role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-[#4ECBD9] rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    // If device is set to Remote mode locally, show a minimal remote Soundboard (favorites only)
    let isRemote = false;
    try { isRemote = window.localStorage.getItem('player_is_host') === '0'; } catch {}
    if (isRemote) {
      return (
        <SoundProvider>
          <div className="min-h-screen flex flex-col bg-neutral-900 text-neutral-100">
            <main className="flex-1 max-w-[1200px] mx-auto px-4 py-6 w-full">
              <SoundboardView mode="remoteFavorites" />
            </main>
          </div>
        </SoundProvider>
      );
    }
    return <LoginPage />;
  }

  // If authenticated as 'remote', show Soundboard-only view (favorites)
  if (authenticated && role === 'remote') {
    return (
      <SoundProvider>
        <div className="min-h-screen flex flex-col bg-neutral-900 text-neutral-100">
          <Header />
          <main className="flex-1 max-w-[1200px] mx-auto px-4 py-6 w-full">
            <SoundboardView mode="remoteFavorites" />
          </main>
        </div>
      </SoundProvider>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-[#4ECBD9] rounded-full animate-spin" />
      </div>
    }>
      <AuthedApp />
    </Suspense>
  );
}

export default App;
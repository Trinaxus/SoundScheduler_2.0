import React from 'react';
import { SoundProvider } from './context/SoundContext';
import Header from './components/Header';
import SoundManagerPanel from './components/SoundManagerPanel';
import Footer from './components/Footer';

const AuthedApp: React.FC = () => {
  return (
    <SoundProvider>
      <div className="min-h-screen flex flex-col bg-transparent text-neutral-100">
        <Header />
        <main className="flex-1 max-w-[1200px] mx-auto px-6 py-8 w-full">
          <SoundManagerPanel />
        </main>
        <Footer />
      </div>
    </SoundProvider>
  );
};

export default AuthedApp;

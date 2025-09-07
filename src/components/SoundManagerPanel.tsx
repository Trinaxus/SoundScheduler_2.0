import React from 'react';
import SoundUploader from './SoundUploader';
import SoundList from './SoundList';
import TimelineView from './TimelineView';
import TimeChecker from './TimeChecker';
import SoundboardView from './SoundboardView';
import { useSounds } from '../context/SoundContext';

const SoundManagerPanel: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'list' | 'timeline' | 'soundboard'>('list');
  const { isGloballyEnabled, toggleGloballyEnabled } = useSounds();

  // Resync entfernt

  return (
    <div className="bg-neutral-900 rounded-xl border-[0.5px] border-neutral-700/20">
      <div className="border-b-[0.5px] border-neutral-700/20">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex-1 -mx-2 px-2 touch-manipulation no-scrollbar overflow-x-auto">
            <nav className="flex items-center justify-start min-w-max space-x-8">
              <button 
                className={`text-sm sm:text-base font-black uppercase tracking-wide transition-colors touch-manipulation ${
                  activeTab === 'list' 
                    ? 'text-neutral-100' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                onClick={() => setActiveTab('list')}
                onTouchStart={() => setActiveTab('list')}
              >
                Sound Liste
              </button>
              <button 
                className={`text-sm sm:text-base font-black uppercase tracking-wide transition-colors touch-manipulation ${
                  activeTab === 'timeline' 
                    ? 'text-neutral-100' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                onClick={() => setActiveTab('timeline')}
                onTouchStart={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button 
                className={`text-sm sm:text-base font-black uppercase tracking-wide transition-colors touch-manipulation ${
                  activeTab === 'soundboard' 
                    ? 'text-neutral-100' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                onClick={() => setActiveTab('soundboard')}
                onTouchStart={() => setActiveTab('soundboard')}
              >
                Soundboard
              </button>
            </nav>
          </div>

          <div className="ml-6 flex items-center space-x-3 flex-shrink-0">
            <label className="relative inline-flex items-center cursor-pointer touch-manipulation group" title={isGloballyEnabled ? 'ON AIR' : ''}>
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isGloballyEnabled}
                onChange={toggleGloballyEnabled}
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                isGloballyEnabled 
                  ? 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.6)] animate-pulse' 
                  : 'bg-neutral-800'
              } peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-red-500`}>
                <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform ${
                  isGloballyEnabled ? 'translate-x-full' : 'translate-x-0'
                }`} />
                {/* Tooltip */}
                <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-opacity pointer-events-none whitespace-nowrap ${
                  isGloballyEnabled ? 'bg-red-600/90 text-white opacity-0 group-hover:opacity-100' : 'opacity-0'
                }`}>
                  ON AIR
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
      
      <div className="p-4 sm:p-6 space-y-6">
        {activeTab === 'list' && (
          <div>
            <SoundList />
          </div>
        )}
        {activeTab === 'timeline' && (
          <div>
            <TimelineView />
          </div>
        )}
        {activeTab === 'soundboard' && (
          <div>
            <SoundboardView />
          </div>
        )}
      </div>
      
      <TimeChecker />
    </div>
  );
};

export default SoundManagerPanel;
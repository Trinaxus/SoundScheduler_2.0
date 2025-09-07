import { useEffect, useState, useRef } from 'react';
import { useSounds } from '../context/SoundContext';
import { isTimeToPlay, getCurrentTime, hasBeenPlayedToday } from '../utils/helpers';

const TimeChecker: React.FC = () => {
  const { 
    sounds, 
    playSound, 
    isGloballyEnabled,
    markSchedulePlayed,
    mutedSchedules,
  } = useSounds();
  const [currentTime, setCurrentTime] = useState<string>(getCurrentTime());
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedTimesRef = useRef<Map<string, number>>(new Map());
  const DEBOUNCE_TIME = 2000; // 2 seconds debounce

  // Set up the audio context on first user interaction
  useEffect(() => {
    const setupAudioContext = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Failed to create AudioContext:', error);
      }
    };
    
    // Add event listeners for user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      window.addEventListener(event, setupAudioContext, { once: true });
    });
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, setupAudioContext);
      });
    };
  }, []);

  // Check time every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(getCurrentTime());
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Check if any sounds need to be played
  useEffect(() => {
    if (!isGloballyEnabled) return;
    
    sounds.forEach(sound => {
      sound.schedules.forEach(schedule => {
        if (
          schedule.active && 
          isTimeToPlay(schedule.time) && 
          !hasBeenPlayedToday(schedule.lastPlayed) &&
          !mutedSchedules.has(schedule.id)
        ) {
          const now = Date.now();
          const lastPlayed = lastPlayedTimesRef.current.get(schedule.id) || 0;
          
          // Check if enough time has passed since last play
          if (now - lastPlayed >= DEBOUNCE_TIME) {
            console.log(`Playing scheduled sound: ${sound.name} at ${schedule.time}`);
            lastPlayedTimesRef.current.set(schedule.id, now);
            playSound(sound.id);
            markSchedulePlayed(sound.id, schedule.id);
          }
        }
      });
    });
  }, [currentTime, sounds, playSound, markSchedulePlayed, isGloballyEnabled]);

  // This component doesn't render anything visible
  return null;
};

export default TimeChecker;
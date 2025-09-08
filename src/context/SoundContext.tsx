import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Sound, Schedule } from '../types';
import { generateId } from '../utils/helpers';
import {
  getManifest,
  uploadSound,
  soundsInsert,
  soundsUpdate,
  soundsDelete,
  soundsReorder,
  schedulesInsert,
  schedulesUpdate,
  schedulesDelete,
  categoriesInsert,
  categoriesUpdate,
  categoriesDelete,
  timelineGet,
  timelineSave,
  remoteGet,
  remoteSend,
} from '../lib/api';

interface SoundContextType {
  sounds: Sound[];
  categories: { id: string; name: string; display_order?: number }[];
  isGloballyEnabled: boolean;
  isHost: boolean; // this device is the Player/Host
  currentTimeSeconds: number;
  mutedSchedules: Set<string>;
  mutedSegments: Set<string>;
  timelineLoaded: boolean;
  addSound: (file: File) => Promise<void>;
  deleteSound: (id: string) => void;
  renameSound: (id: string, newName: string) => void;
  playSound: (soundId: string) => void;
  pauseSound: () => void; // hard stop (clears current)
  pauseOnly: () => void;  // soft pause (keeps position)
  stopSound: () => void;  // alias for hard stop
  currentlyPlaying: string | null;
  isPaused: boolean;
  addSchedule: (soundId: string, time: string) => void;
  updateSchedule: (soundId: string, scheduleId: string, time: string, active: boolean) => void;
  deleteSchedule: (soundId: string, scheduleId: string) => void;
  toggleGloballyEnabled: () => void;
  markSchedulePlayed: (soundId: string, scheduleId: string) => void;
  toggleFavorite: (soundId: string) => Promise<void>;
  setSoundCategory: (soundId: string, categoryId: string | null) => Promise<void>;
  toggleHiddenCategory: (soundId: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  updateSoundOrder: (sounds: Sound[]) => Promise<void>;
  toggleScheduleMute: (scheduleId: string) => void;
  toggleSegmentMute: (segmentId: string) => void;
  setHostMode: (host: boolean) => void;
  playOrRemote: (soundId: string) => Promise<void>;
}

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',    // .mp3
  'audio/wav',     // .wav
  'audio/ogg',     // .ogg
  'audio/mp4',     // .m4a
  'audio/x-m4a',   // .m4a (alternative MIME type)
];

const getSoundType = (mimeType: string): 'music' | 'notification' => {
  const notificationTypes = ['audio/wav', 'audio/x-wav'];
  return notificationTypes.includes(mimeType) ? 'notification' : 'music';
};

const generateUniqueFilename = (originalName: string): string => {
  const extension = originalName.split('.').pop();
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
  const timestamp = Date.now();
  const uniqueId = generateId().substring(0, 8);
  return `${baseName}_${timestamp}_${uniqueId}.${extension}`;
};

const getAudioDuration = async (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer.duration);
      } catch (error) {
        console.error('Error getting audio duration:', error);
        resolve(0);
      } finally {
        audioContext.close();
      }
    };

    reader.onerror = () => {
      console.error('Error reading file');
      resolve(0);
    };

    reader.readAsArrayBuffer(file);
  });
};

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0);
  const [categories, setCategories] = useState<{ id: string; name: string; display_order?: number }[]>([]);
  const [isGloballyEnabled, setIsGloballyEnabled] = useState<boolean>(true);
  const [isHost, setIsHost] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('player_is_host') === '1';
    } catch { return false; }
  });
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [mutedSchedules, setMutedSchedules] = useState<Set<string>>(new Set());
  const [mutedSegments, setMutedSegments] = useState<Set<string>>(new Set());
  const [timelineLoaded, setTimelineLoaded] = useState<boolean>(false);
  const lastPlayTimestampRef = useRef<number>(0);
  const DEBOUNCE_TIME = 300; // 300ms debounce for play/pause actions
  const lastRemoteTsRef = useRef<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const manifest = await getManifest();
        const mapped: Sound[] = (manifest.sounds || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          size: s.size,
          type: s.type,
          duration: s.duration ?? 0,
          file: new File([], s.name, { type: s.type || 'audio/mpeg' }),
          schedules: (manifest.schedules || []).filter((sch: any) => sch.sound_id === s.id).map((sch: any) => ({
            id: sch.id,
            time: sch.time,
            active: sch.active,
            lastPlayed: sch.last_played ?? undefined,
          })) as Schedule[],
          isFavorite: !!s.is_favorite,
          order: s.display_order ?? 0,
          categoryId: s.category_id ?? null,
        }));
        // sort by display_order
        mapped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setSounds(mapped);
        setManifestVersion(manifest.version);
        setCategories((manifest.categories || []).map((c:any)=>({ id:c.id, name:c.name, display_order:c.display_order })));
      } catch (e) {
        console.error('Error loading manifest:', e);
      }
    };

    load();

    const initAudioContext = () => {
      if (!audioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
      }
    };

    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initAudioContext, { once: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initAudioContext);
      });
      if (audioContext) {
        audioContext.close();
      }
    };
  }, []);

  // (moved below playSound/pauseSound declarations)

  useEffect(() => {
    (async () => {
      try {
        const data = await timelineGet();
        if (data) {
          if (Array.isArray(data.mutedSchedules)) setMutedSchedules(new Set(data.mutedSchedules));
          if (Array.isArray(data.mutedSegments)) setMutedSegments(new Set(data.mutedSegments));
        }
      } catch (e) {
        // non-fatal
        console.warn('Failed to load timeline state', e);
      }
      setTimelineLoaded(true);
    })();
  }, []);

  const validateAudioFile = (file: File): boolean => {
    return SUPPORTED_AUDIO_TYPES.includes(file.type);
  };

  const [manifestVersion, setManifestVersion] = useState<number | null>(null);

  const addSound = useCallback(async (file: File): Promise<void> => {
    if (!validateAudioFile(file)) {
      throw new Error(`Unsupported audio format. Supported formats are: ${SUPPORTED_AUDIO_TYPES.join(', ')}`);
    }

    try {
      const duration = await getAudioDuration(file);
      // Upload file to PHP API
      const up = await uploadSound(file);

      // Ensure we have latest version
      const man = await getManifest();
      const nextOrder = (man.sounds?.length ?? 0);
      const insert = await soundsInsert({
        name: file.name.replace(/\.[^/.]+$/, ''),
        url: up.url,
        file_path: up.file_path,
        size: up.size,
        type: file.type,
        duration,
        display_order: nextOrder,
        is_favorite: false,
      }, man.version);
      setManifestVersion(insert.version);

      const s = insert.sound;
      const newSound: Sound = {
        id: s.id,
        name: s.name,
        url: s.url,
        size: s.size,
        type: s.type,
        duration: s.duration ?? duration,
        file,
        schedules: [],
        isFavorite: !!s.is_favorite,
        order: s.display_order ?? nextOrder,
      };
      setSounds(prev => [...prev, newSound].sort((a,b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (error) {
      console.error('Error adding sound:', error);
      throw error;
    }
  }, []);

  const playSound = useCallback((soundId: string): void => {
    const now = Date.now();
    if (now - lastPlayTimestampRef.current < DEBOUNCE_TIME) {
      return; // Ignore rapid repeated clicks/taps
    }
    lastPlayTimestampRef.current = now;

    const sound = sounds.find(s => s.id === soundId);
    if (!sound) {
      console.error('Sound not found:', soundId);
      return;
    }

    // If the same sound is already loaded
    if (currentlyPlaying === soundId && audioElement) {
      if (audioElement.paused) {
        // resume
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => console.error('Resume error:', err));
        }
        setPaused(false);
      } else {
        // soft pause
        pauseOnly();
      }
      return;
    }

    // Stop any currently playing sound
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    const audio = new Audio();
    
    audio.onerror = (e) => {
      const error = e as ErrorEvent;
      console.error('Error loading audio:', {
        sound: sound.name,
        url: sound.url,
        errorType: error.type,
        errorMessage: error.message,
        errorDetails: (audio.error as MediaError)?.message || 'Unknown error'
      });
      setCurrentlyPlaying(null);
      setAudioElement(null);
    };

    audio.oncanplaythrough = () => {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing sound:', {
            sound: sound.name,
            error: error.message
          });
          setCurrentlyPlaying(null);
        });
      }
    };

    audio.onended = () => {
      setCurrentlyPlaying(null);
      setAudioElement(null);
      setCurrentTimeSeconds(0);
    };

    audio.ontimeupdate = () => {
      setCurrentTimeSeconds(audio.currentTime || 0);
    };

    try {
      const url = new URL(sound.url);
      audio.src = url.toString();
      audio.load();
      setAudioElement(audio);
      setCurrentlyPlaying(soundId);
      setPaused(false);
      setCurrentTimeSeconds(0);
    } catch (error) {
      console.error('Invalid sound URL:', {
        sound: sound.name,
        url: sound.url,
        error: error
      });
      setCurrentlyPlaying(null);
      setAudioElement(null);
    }
  }, [sounds, audioElement, currentlyPlaying]);

  const pauseSound = useCallback((): void => {
    const now = Date.now();
    if (now - lastPlayTimestampRef.current < DEBOUNCE_TIME) {
      return; // Ignore rapid repeated clicks/taps
    }
    lastPlayTimestampRef.current = now;

    if (audioElement) {
      audioElement.pause();
      setCurrentlyPlaying(null);
      setAudioElement(null);
      setPaused(false);
      setCurrentTimeSeconds(0);
    }
  }, [audioElement]);

  const pauseOnly = useCallback((): void => {
    if (audioElement) {
      audioElement.pause();
      // keep currentlyPlaying and element to allow resume via playSound(soundId)
      setPaused(true);
    }
  }, [audioElement]);

  const stopSound = useCallback((): void => {
    pauseSound();
  }, [pauseSound]);

  // Poll remote commands when this device is Host (placed after playSound/pauseSound)
  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const res = await remoteGet();
        if (!res || !res.command) return;
        const { action, soundId, ts } = res.command as any;
        if (!ts || ts <= lastRemoteTsRef.current) return;
        lastRemoteTsRef.current = ts;
        if (cancelled) return;
        if (action === 'play' && soundId) {
          playSound(soundId);
        } else if (action === 'pause') {
          pauseSound();
        }
      } catch (_) {
        // ignore network errors
      }
    }, 600);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isHost, playSound, pauseSound]);

  const setHostMode = useCallback((host: boolean) => {
    setIsHost(host);
    try { window.localStorage.setItem('player_is_host', host ? '1' : '0'); } catch {}
  }, []);

  const playOrRemote = useCallback(async (soundId: string) => {
    if (isHost) {
      playSound(soundId);
      return;
    }
    try {
      await remoteSend('play', soundId);
    } catch (e) {
      console.warn('Failed to send remote play', e);
    }
  }, [isHost, playSound]);

  // Toggle mute for a specific Schedule ID (affects only auto-play, not manual play)
  const toggleScheduleMute = useCallback((scheduleId: string) => {
    setMutedSchedules(prev => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId); else next.add(scheduleId);
      // persist asynchronously
      setTimeout(() => {
        timelineSave(Array.from(next), Array.from(mutedSegments)).catch(() => {});
      }, 0);
      return next;
    });
  }, [mutedSegments]);

  // Toggle mute for a specific Segment ID (affects only auto-play unless UI blocks manual)
  const toggleSegmentMute = useCallback((segmentId: string) => {
    setMutedSegments(prev => {
      const next = new Set(prev);
      if (next.has(segmentId)) next.delete(segmentId); else next.add(segmentId);
      setTimeout(() => {
        timelineSave(Array.from(mutedSchedules), Array.from(next)).catch(() => {});
      }, 0);
      return next;
    });
  }, [mutedSchedules]);

  const deleteSound = useCallback(async (id: string): Promise<void> => {
    try {
      await soundsDelete(id, manifestVersion ?? undefined);

      if (currentlyPlaying === id) {
        pauseSound();
      }

      setSounds(prevSounds => prevSounds.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting sound:', error);
      throw error;
    }
  }, [currentlyPlaying, pauseSound, manifestVersion]);

  const renameSound = useCallback(async (id: string, newName: string): Promise<void> => {
    try {
      const res = await soundsUpdate({ id, name: newName }, manifestVersion ?? undefined);
      setManifestVersion(res.version);

      setSounds(prevSounds => 
        prevSounds.map(sound => 
          sound.id === id ? { ...sound, name: newName } : sound
        )
      );
    } catch (error) {
      console.error('Error renaming sound:', error);
      throw error;
    }
  }, []);

  const addSchedule = useCallback(async (soundId: string, time: string): Promise<void> => {
    try {
      const res = await schedulesInsert({ sound_id: soundId, time, active: true }, manifestVersion ?? undefined);
      const data = res.schedule;
      setManifestVersion(res.version);

      setSounds(prevSounds => 
        prevSounds.map(sound => 
          sound.id === soundId 
            ? { ...sound, schedules: [...sound.schedules, { id: data.id, time: data.time, active: data.active }] }
            : sound
        )
      );
    } catch (error) {
      console.error('Error adding schedule:', error);
      throw error;
    }
  }, []);

  const updateSchedule = useCallback(async (
    soundId: string, 
    scheduleId: string, 
    time: string, 
    active: boolean
  ): Promise<void> => {
    try {
      const res = await schedulesUpdate({ id: scheduleId, time, active }, manifestVersion ?? undefined);
      setManifestVersion(res.version);

      setSounds(prevSounds => 
        prevSounds.map(sound => 
          sound.id === soundId 
            ? {
                ...sound,
                schedules: sound.schedules.map(schedule =>
                  schedule.id === scheduleId 
                    ? { ...schedule, time, active }
                    : schedule
                ),
              }
            : sound
        )
      );
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }, []);

  const deleteSchedule = useCallback(async (soundId: string, scheduleId: string): Promise<void> => {
    try {
      const res = await schedulesDelete(scheduleId, manifestVersion ?? undefined);
      setManifestVersion(res.version);

      setSounds(prevSounds => 
        prevSounds.map(sound => 
          sound.id === soundId 
            ? {
                ...sound,
                schedules: sound.schedules.filter(schedule => schedule.id !== scheduleId),
              }
            : sound
        )
      );
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  }, []);

  const toggleGloballyEnabled = useCallback((): void => {
    setIsGloballyEnabled(prev => !prev);
  }, []);

  const markSchedulePlayed = useCallback(async (soundId: string, scheduleId: string): Promise<void> => {
    try {
      const res = await schedulesUpdate({ id: scheduleId, last_played: new Date().toISOString() }, manifestVersion ?? undefined);
      setManifestVersion(res.version);

      setSounds(prevSounds => 
        prevSounds.map(sound => 
          sound.id === soundId 
            ? {
                ...sound,
                schedules: sound.schedules.map(schedule =>
                  schedule.id === scheduleId 
                    ? { ...schedule, lastPlayed: new Date().toISOString() }
                    : schedule
                ),
              }
            : sound
        )
      );
    } catch (error) {
      console.error('Error marking schedule as played:', error);
      throw error;
    }
  }, []);

  const toggleFavorite = useCallback(async (soundId: string): Promise<void> => {
    try {
      const sound = sounds.find(s => s.id === soundId);
      if (!sound) return;

      const newFavoriteState = !sound.isFavorite;
      // 1) Toggle favorite flag
      const resFav = await soundsUpdate({ id: soundId, is_favorite: newFavoriteState }, manifestVersion ?? undefined);
      setManifestVersion(resFav.version);

      // 2) If marked as favorite, ensure category 'Favoriten' exists and assign it
      if (newFavoriteState) {
        // Try to find existing 'Favoriten' category (case-insensitive)
        let favCat = categories.find(c => c.name.toLowerCase() === 'favoriten');
        if (!favCat) {
          const created = await categoriesInsert({ name: 'Favoriten' }, resFav.version);
          favCat = created.category;
          setManifestVersion(created.version);
          setCategories(prev => [...prev, favCat!]);
        }
        if (favCat) {
          const resAssign = await soundsUpdate({ id: soundId, category_id: favCat.id }, favCat ? undefined : undefined);
          // Update local state: favorite flag + categoryId
          setManifestVersion(resAssign.version ?? resFav.version);
          setSounds(prev => prev.map(s => s.id === soundId ? { ...s, isFavorite: true, categoryId: favCat!.id } : s));
          return;
        }
      }

      // Default local state update (for unfavorite or if category assign skipped)
      setSounds(prevSounds =>
        prevSounds.map(s =>
          s.id === soundId
            ? { ...s, isFavorite: newFavoriteState }
            : s
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }, [sounds, manifestVersion, categories]);

  // --- Categories ---
  const setSoundCategory = useCallback(async (soundId: string, categoryId: string | null): Promise<void> => {
    try {
      const res = await soundsUpdate({ id: soundId, category_id: categoryId }, manifestVersion ?? undefined);
      setManifestVersion(res.version);
      setSounds(prev => prev.map(s => s.id === soundId ? { ...s, categoryId } : s));
    } catch (e) {
      console.error('Error setting sound category', e);
      throw e;
    }
  }, [manifestVersion]);

  // Toggle "Ausgeblendet" category: if sound is already in it, remove category; otherwise ensure it exists and assign
  const toggleHiddenCategory = useCallback(async (soundId: string): Promise<void> => {
    try {
      const sound = sounds.find(s => s.id === soundId);
      if (!sound) return;
      // Find or create 'Ausgeblendet'
      let hiddenCat = categories.find(c => c.name.toLowerCase() === 'ausgeblendet');
      if (!hiddenCat) {
        const created = await categoriesInsert({ name: 'Ausgeblendet' }, manifestVersion ?? undefined);
        hiddenCat = created.category;
        setManifestVersion(created.version);
        setCategories(prev => [...prev, hiddenCat!]);
      }
      if (!hiddenCat) return;
      const nextCategory = sound.categoryId === hiddenCat.id ? null : hiddenCat.id;
      const res = await soundsUpdate({ id: soundId, category_id: nextCategory }, manifestVersion ?? undefined);
      setManifestVersion(res.version);
      setSounds(prev => prev.map(s => s.id === soundId ? { ...s, categoryId: nextCategory } : s));
    } catch (e) {
      console.error('Error toggling hidden category', e);
      throw e;
    }
  }, [sounds, categories, manifestVersion]);

  const addCategory = useCallback(async (name: string): Promise<void> => {
    const res = await categoriesInsert({ name }, manifestVersion ?? undefined);
    setManifestVersion(res.version);
    setCategories(prev => [...prev, res.category]);
  }, [manifestVersion]);

  const renameCategory = useCallback(async (id: string, name: string): Promise<void> => {
    const res = await categoriesUpdate({ id, name }, manifestVersion ?? undefined);
    setManifestVersion(res.version);
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  }, [manifestVersion]);


  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    const res = await categoriesDelete(id, manifestVersion ?? undefined);
    setManifestVersion(res.version);
    setCategories(prev => prev.filter(c => c.id !== id));
    setSounds(prev => prev.map(s => (s.categoryId === id ? { ...s, categoryId: null } : s)));
  }, [manifestVersion]);

  const updateSoundOrder = useCallback(async (updatedSounds: Sound[]): Promise<void> => {
    try {
      const orders = updatedSounds.map((s, i) => ({ id: s.id, display_order: i }));
      const res = await soundsReorder(orders, manifestVersion ?? undefined);
      setManifestVersion(res.version);

      setSounds(updatedSounds);
    } catch (error) {
      console.error('Error updating sound order:', error);
      throw error;
    }
  }, [manifestVersion]);

  const value = {
    sounds,
    categories,
    isGloballyEnabled,
    isHost,
    currentTimeSeconds,
    mutedSchedules,
    mutedSegments,
    timelineLoaded,
    addSound,
    deleteSound,
    renameSound,
    playSound,
    pauseSound,
    pauseOnly,
    stopSound,
    currentlyPlaying,
    isPaused: paused,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleGloballyEnabled,
    markSchedulePlayed,
    toggleFavorite,
    setSoundCategory,
    toggleHiddenCategory,
    addCategory,
    renameCategory,
    deleteCategory,
    updateSoundOrder,
    toggleScheduleMute,
    toggleSegmentMute,
    setHostMode,
    playOrRemote,
  };

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
};

export const useSounds = (): SoundContextType => {
  const context = useContext(SoundContext);
  if (context === undefined) {
    throw new Error('useSounds must be used within a SoundProvider');
  }
  return context;
};
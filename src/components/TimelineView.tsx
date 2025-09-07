import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Play, Pause, VolumeX, Volume1, Plus, Star, X, Settings } from 'lucide-react';
import { useSounds } from '../context/SoundContext';
import { formatTime, formatDuration } from '../utils/helpers';
import PresetManagerModal, { TimelineSegment as PresetSegment } from './PresetManagerModal';

const DEFAULT_SEGMENTS = [
  { id: 'open', title: 'Vor der Session', time: '-18:00:00', startTime: '00:00:00', endTime: '18:00:00' },
  { id: 'soundcheck', title: 'Ankommen & Soundcheck', time: '18:00:00-18:30:00', startTime: '18:00:00', endTime: '18:30:00' },
  { id: 'cover', title: 'Covern', time: '18:30:00-20:15:00', startTime: '18:30:00', endTime: '20:15:00' },
  { id: 'break1', title: 'Spielpause', time: '20:15:00-20:30:00', startTime: '20:15:00', endTime: '20:30:00' },
  { id: 'jam', title: 'Freies Jammen', time: '20:30:00-22:15:00', startTime: '20:30:00', endTime: '22:15:00' },
  { id: 'break2', title: 'Spielpause', time: '22:15:00-22:30:00', startTime: '22:15:00', endTime: '22:30:00' },
  { id: 'stage', title: 'Open Stage', time: '22:30:00-', startTime: '22:30:00', endTime: '23:59:59' }
];

const TimelineView: React.FC = () => {
  const { sounds, addSchedule, playSound, pauseSound, currentlyPlaying, toggleFavorite } = useSounds();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [mutedSchedules, setMutedSchedules] = useState<Set<string>>(new Set());
  const [mutedSegments, setMutedSegments] = useState<Set<string>>(new Set());
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
  const [showPresetManager, setShowPresetManager] = useState(false);

  const now = new Date();
  const currentTime = now.toTimeString().split(' ')[0];

  const isTimeInSegment = (time: string, start: string, end: string) => time >= start && time <= end;
  const isPastSegment = (end: string) => currentTime > end;

  // (moved below schedulesBySegment)

  const toggleMute = (id: string) => {
    setMutedSchedules(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) {
        copy.delete(id);
      } else {
        copy.add(id);
        // If the currently active schedule is muted, pause immediately
        if (activeSchedule === id) {
          pauseSound();
          setActiveSchedule(null);
        }
      }
      return copy;
    });
  };

  const schedulesBySegment = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    segments.forEach(segment => {
      grouped[segment.id] = [];
      sounds.forEach(sound => {
        sound.schedules.forEach(schedule => {
          if (isTimeInSegment(schedule.time, segment.startTime, segment.endTime)) {
            grouped[segment.id].push({
              ...schedule,
              soundName: sound.name,
              soundId: sound.id,
              soundUrl: sound.url,
              duration: sound.duration,
              isFavorite: sound.isFavorite,
              hasPlayed: isPastSegment(schedule.time)
            });
          }
        });
      });
      grouped[segment.id].sort((a, b) => a.time.localeCompare(b.time));
    });
    return grouped;
  }, [sounds, currentTime, segments]);

  // Enforce mute globally: if a sound is playing that belongs to a muted schedule or muted segment, pause it immediately
  useEffect(() => {
    if (!currentlyPlaying) return;
    let mustPause = false;
    Object.entries(schedulesBySegment).forEach(([segId, items]) => {
      if (mustPause) return;
      const segMuted = mutedSegments.has(segId);
      (items as any[]).forEach((it) => {
        if (mustPause) return;
        if (it.soundId === currentlyPlaying) {
          if (segMuted || mutedSchedules.has(it.id)) {
            mustPause = true;
          }
        }
      });
    });
    if (mustPause) {
      pauseSound();
      setActiveSchedule(null);
    }
  }, [currentlyPlaying, mutedSchedules, mutedSegments, schedulesBySegment, pauseSound]);

  const handlePlaySound = (soundId: string, scheduleId: string, segmentId: string) => {
    // Block playback if this entry or its segment is muted
    if (mutedSchedules.has(scheduleId) || mutedSegments.has(segmentId)) return;
    if (currentlyPlaying === soundId && activeSchedule === scheduleId) {
      pauseSound();
      setActiveSchedule(null);
    } else {
      if (currentlyPlaying) pauseSound();
      playSound(soundId);
      setActiveSchedule(scheduleId);
    }
  };

  const validateTime = (time: string) => time >= '00:00' && time <= '23:59';

  const handleAddSound = async () => {
    if (!selectedTime || !selectedSound) return;
    const fullTime = `${selectedTime}:00`;
    if (!validateTime(selectedTime)) return setError('Zeit ungültig');
    await addSchedule(selectedSound, fullTime);
    setSelectedSound(null);
    setSelectedTime('');
    setShowSoundPicker(false);
  };

  const handleGlobalAdd = () => {
    setSelectedSound(null);
    setSelectedTime(currentTime.slice(0, 5));
    setShowSoundPicker(true);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Top actions: Settings (left) + Add (right) */}
      <div className="flex justify-end mb-4 gap-2">
        <button
          onClick={() => setShowPresetManager(true)}
          className="p-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
          title="Timeline-Presets verwalten"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={handleGlobalAdd}
          className="p-2 rounded-lg bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors"
          title="Sound einplanen"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {segments.map((segment: any) => {
        const items = schedulesBySegment[segment.id] || [];
        const isActive = isTimeInSegment(currentTime, segment.startTime, segment.endTime);
        
        return (
          <div
            key={segment.id}
            className={`bg-neutral-800/50 rounded-lg overflow-hidden hover:bg-neutral-800/70 transition-all`}
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="font-medium text-[#4ECBD9]">{segment.title}</h3>
                  <div className="flex items-center text-xs text-[#909296] mt-0.5">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>{segment.startTime.slice(0,5)}–{segment.endTime.slice(0,5)}</span>
                  </div>
                </div>
                {isActive && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-[#4ECBD9]/10 text-[#4ECBD9]">
                    Aktuell
                  </span>
                )}

      
              </div>

              {/* Segment mute toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setMutedSegments(prev => {
                      const copy = new Set(prev);
                      const turningOn = !copy.has(segment.id);
                      if (turningOn) {
                        copy.add(segment.id);
                        // If active schedule belongs to this segment, pause
                        if (activeSchedule) {
                          const isActiveInSegment = (schedulesBySegment[segment.id] || []).some((it: any) => it.id === activeSchedule);
                          if (isActiveInSegment) {
                            pauseSound();
                            setActiveSchedule(null);
                          }
                        }
                      } else {
                        copy.delete(segment.id);
                      }
                      return copy;
                    });
                  }}
                  className={`p-2 rounded-full ${
                    mutedSegments.has(segment.id)
                      ? 'bg-[#4ECBD9]/10 text-[#4ECBD9]'
                      : 'bg-neutral-700 text-[#C1C2C5] hover:bg-neutral-600'
                  }`}
                  title={mutedSegments.has(segment.id) ? 'Segment stumm' : 'Segment entstummen'}
                >
                  {mutedSegments.has(segment.id) ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume1 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <div className="border-t border-neutral-700/50 p-4">
                <div className="space-y-2">
                  {items.map(schedule => (
                    <div
                      key={schedule.id}
                      className="p-3 rounded-lg bg-neutral-700/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => handlePlaySound(schedule.soundId, schedule.id, segment.id)}
                            disabled={mutedSchedules.has(schedule.id) || mutedSegments.has(segment.id)}
                            title={
                              mutedSegments.has(segment.id)
                                ? 'Segment stumm – Wiedergabe blockiert'
                                : (mutedSchedules.has(schedule.id) ? 'Eintrag stumm – Wiedergabe blockiert' : 'Abspielen/Pausieren')
                            }
                            className={`p-2 rounded-full ${
                              (mutedSchedules.has(schedule.id) || mutedSegments.has(segment.id))
                                ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                                : (currentlyPlaying === schedule.soundId && activeSchedule === schedule.id
                                    ? 'bg-[#4ECBD9]/20 text-[#4ECBD9]'
                                    : 'bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20')
                            }`}
                          >
                            {currentlyPlaying === schedule.soundId && activeSchedule === schedule.id ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-[#C1C2C5] truncate">
                                {schedule.soundName}
                              </p>
                              {schedule.isFavorite && (
                                <Star className="h-3 w-3 ml-1 fill-[#F471B5] text-[#F471B5]" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="text-[#F471B5]">{formatTime(schedule.time)}</span>
                              <span className="text-[#909296]">•</span>
                              <span className="text-[#909296]">{formatDuration(schedule.duration)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 ml-3">
                          <button
                            onClick={() => toggleMute(schedule.id)}
                            className={`p-1.5 rounded-full transition-colors ${
                              mutedSchedules.has(schedule.id)
                                ? 'bg-[#4ECBD9]/10 text-[#4ECBD9]'
                                : 'bg-neutral-700 text-[#909296] hover:text-[#C1C2C5]'
                            }`}
                          >
                            {mutedSchedules.has(schedule.id) ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume1 className="h-4 w-4" />
                            )}
                          </button>
                          
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            schedule.active
                              ? 'bg-[#4ECBD9]/10 text-[#4ECBD9]'
                              : 'bg-neutral-700 text-[#909296]'
                          }`}>
                            {schedule.active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showSoundPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-[#C1C2C5]">
                  Sound zur Veranstaltung hinzufügen
                </h3>
                <p className="text-sm text-[#909296] mt-1">
                  Wählen Sie eine Zeit zwischen 00:00 und 23:59
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSoundPicker(false);
                  setSelectedSound(null);
                  setSelectedTime('');
                  setError(null);
                }}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-4">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => {
                      setSelectedTime(e.target.value);
                      setError(null);
                    }}
                    className="bg-neutral-700/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-[#C1C2C5]"
                    step="1"
                  />
                  <span className="text-sm text-[#909296]">
                    Wählen Sie die genaue Zeit
                  </span>
                </div>
                {error && (
                  <p className="text-sm text-[#F471B5]">{error}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
                {sounds.map(sound => (
                  <button
                    key={sound.id}
                    onClick={() => setSelectedSound(sound.id)}
                    className={`flex items-center p-3 rounded-lg ${
                      selectedSound === sound.id
                        ? 'bg-[#4ECBD9]/10 border border-[#4ECBD9]/30'
                        : 'bg-neutral-700/50 hover:bg-neutral-700 border border-transparent'
                    } transition-all relative group`}
                  >
                    <div className="ml-0 text-left min-w-0">
                      <span className="block text-sm text-[#C1C2C5] truncate">{sound.name}</span>
                      <span className="text-xs text-[#909296]">{formatDuration(sound.duration)}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(sound.id);
                      }}
                      className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Star className={`h-4 w-4 ${
                        sound.isFavorite 
                          ? 'fill-[#F471B5] text-[#F471B5]'
                          : 'text-[#909296] hover:text-[#C1C2C5]'
                      }`} />
                    </button>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-neutral-700 flex justify-end gap-3 flex-wrap">
              <button
                onClick={() => {
                  setShowSoundPicker(false);
                  setSelectedSound(null);
                  setSelectedTime('');
                  setError(null);
                }}
                className="px-4 py-2 text-sm text-[#909296] hover:text-[#C1C2C5]"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddSound}
                disabled={!selectedTime || !selectedSound}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  selectedTime && selectedSound
                    ? 'bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20'
                    : 'bg-neutral-700 text-[#909296] cursor-not-allowed'
                }`}
              >
                Sound hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset Manager */}
      <PresetManagerModal
        open={showPresetManager}
        onClose={() => setShowPresetManager(false)}
        currentSegments={segments.map(s => ({ id: s.id, title: s.title, startTime: s.startTime, endTime: s.endTime })) as PresetSegment[]}
        onApply={(newSegs) => {
          const mapped = newSegs.map((s, idx) => ({
            id: s.id || `seg-${idx}`,
            title: s.title,
            time: `${s.startTime}-${s.endTime}`,
            startTime: s.startTime,
            endTime: s.endTime,
          }));
          setSegments(mapped);
          setMutedSegments(new Set());
        }}
      />
    </div>
  );
};

export default TimelineView;
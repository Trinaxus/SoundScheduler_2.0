import React, { useEffect, useState } from 'react';
import { Plus, Trash, Save, X, Clock, Edit2 } from 'lucide-react';
import { Schedule } from '../types';
import { useSounds } from '../context/SoundContext';
import { formatTime } from '../utils/helpers';
import { timelineGet, timelineSave, presetsList, presetsUpsert } from '../lib/api';

interface ScheduleEditorProps {
  soundId: string;
  schedules: Schedule[];
  onClose: () => void;
}

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ 
  soundId, 
  schedules,
  onClose 
}) => {
  const { addSchedule, updateSchedule, deleteSchedule } = useSounds();
  const [newTime, setNewTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState<string>('');
  const [presetInfo, setPresetInfo] = useState<{ id: string | null; name: string | null } | null>(null);
  const [timelineSegments, setTimelineSegments] = useState<Array<{ id: string; title: string; startTime: string; endTime: string }>>([]);
  const [soundsBySegment, setSoundsBySegment] = useState<Record<string, Array<string | { id: string; time?: string }>>>({});

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission
    if (newTime && !isSubmitting) {
      try {
        setIsSubmitting(true);
        const full = newTime.length === 5 ? `${newTime}:00` : newTime; // normalize HH:mm -> HH:mm:ss
        // avoid duplicates if same time already exists
        const exists = (schedules || []).some(s => s.time === full);
        if (!exists) {
          await addSchedule(soundId, full);
        }
        // Also persist into active preset mapping
        await persistTimeIntoActivePreset(newTime);
        setNewTime('');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const persistTimeIntoActivePreset = async (timeHHmm: string) => {
    if (!presetInfo?.id) return;
    try {
      const lists = await presetsList();
      const preset = (lists.presets || []).find(p => p.id === presetInfo.id);
      if (!preset) return;
      // Find segment for this time
      const seg = timelineSegments.find(s => isTimeInRange(timeHHmm, s.startTime, s.endTime));
      if (!seg) return;
      // Normalize mapping
      const existingMap = (preset as any).soundsBySegment as Record<string, Array<string | { id: string; time?: string }>> || {};
      const current = (existingMap[seg.id] || []).map(x => (typeof x === 'string' ? { id: x } : x));
      const normalizedTime = timeHHmm.length === 5 ? `${timeHHmm}:00` : timeHHmm;
      const has = current.some(x => x.id === soundId && x.time === normalizedTime);
      if (!has) current.push({ id: soundId, time: normalizedTime });
      const nextMap: Record<string, Array<string | { id: string; time?: string }>> = { ...existingMap, [seg.id]: current };
      await presetsUpsert({ id: preset.id, name: preset.name, segments: preset.segments, soundsBySegment: nextMap });
      // Persist also into timeline so Timeline/Soundlist reflect immediately
      try {
        const tl = await timelineGet();
        const tlSegments = (tl as any).segments as Array<{ id: string; title: string; startTime: string; endTime: string }> | undefined;
        await timelineSave((tl as any).mutedSchedules || [], (tl as any).mutedSegments || [], tlSegments, {
          activePresetId: preset.id,
          activePresetName: preset.name,
          soundsBySegment: nextMap,
        });
        // notify other views
        try { window.dispatchEvent(new CustomEvent('timeline:updated')); } catch {}
      } catch {}
      setSoundsBySegment(nextMap);
    } catch {}
  };

  const persistRemoveFromActivePreset = async (timeHHmmss: string) => {
    if (!presetInfo?.id) return;
    try {
      const lists = await presetsList();
      const preset = (lists.presets || []).find(p => p.id === presetInfo.id);
      if (!preset) return;
      const timeHHmm = timeHHmmss.slice(0,5);
      const seg = timelineSegments.find(s => isTimeInRange(timeHHmm, s.startTime, s.endTime));
      if (!seg) return;
      const existingMap = (preset as any).soundsBySegment as Record<string, Array<string | { id: string; time?: string }>> || {};
      const current = (existingMap[seg.id] || []).map(x => (typeof x === 'string' ? { id: x } : x));
      const normalizedTime = timeHHmmss.length === 5 ? `${timeHHmmss}:00` : timeHHmmss;
      const pruned = current.filter(x => !(x.id === soundId && (x.time || '') === normalizedTime));
      const nextMap: Record<string, Array<string | { id: string; time?: string }>> = { ...existingMap, [seg.id]: pruned };
      await presetsUpsert({ id: preset.id, name: preset.name, segments: preset.segments, soundsBySegment: nextMap });
      try {
        const tl = await timelineGet();
        await timelineSave((tl as any).mutedSchedules || [], (tl as any).mutedSegments || [], preset.segments, {
          activePresetId: preset.id,
          activePresetName: preset.name,
          soundsBySegment: nextMap,
        });
      } catch {}
      setSoundsBySegment(nextMap);
    } catch {}
  };

  const persistUpdateInActivePreset = async (oldTimeHHmmss: string, newTimeHHmm: string) => {
    if (!presetInfo?.id) return;
    try {
      const lists = await presetsList();
      const preset = (lists.presets || []).find(p => p.id === presetInfo.id);
      if (!preset) return;
      const oldHHmm = oldTimeHHmmss.slice(0,5);
      const oldSeg = timelineSegments.find(s => isTimeInRange(oldHHmm, s.startTime, s.endTime));
      const newSeg = timelineSegments.find(s => isTimeInRange(newTimeHHmm, s.startTime, s.endTime));
      if (!newSeg) return;
      const existingMap = (preset as any).soundsBySegment as Record<string, Array<string | { id: string; time?: string }>> || {};
      const mapCopy: Record<string, Array<string | { id: string; time?: string }>> = { ...existingMap };
      if (oldSeg) {
        const arr = (mapCopy[oldSeg.id] || []).map(x => (typeof x === 'string' ? { id: x } : x));
        const normalizedOld = oldTimeHHmmss.length === 5 ? `${oldTimeHHmmss}:00` : oldTimeHHmmss;
        mapCopy[oldSeg.id] = arr.filter(x => !(x.id === soundId && (x.time || '') === normalizedOld));
      }
      const normalizedNew = newTimeHHmm.length === 5 ? `${newTimeHHmm}:00` : newTimeHHmm;
      const dest = (mapCopy[newSeg.id] || []).map(x => (typeof x === 'string' ? { id: x } : x));
      if (!dest.some(x => x.id === soundId && (x.time || '') === normalizedNew)) dest.push({ id: soundId, time: normalizedNew });
      mapCopy[newSeg.id] = dest;
      await presetsUpsert({ id: preset.id, name: preset.name, segments: preset.segments, soundsBySegment: mapCopy });
      try {
        const tl = await timelineGet();
        const tlSegments = (tl as any).segments as Array<{ id: string; title: string; startTime: string; endTime: string }> | undefined;
        await timelineSave((tl as any).mutedSchedules || [], (tl as any).mutedSegments || [], tlSegments, {
          activePresetId: preset.id,
          activePresetName: preset.name,
          soundsBySegment: mapCopy,
        });
        window.dispatchEvent(new CustomEvent('timeline:updated')); // Dispatch global event
      } catch {}
      setSoundsBySegment(mapCopy);
    } catch {}
  };

  // Load active preset meta + mapping on mount to show badges per schedule
  useEffect(() => {
    (async () => {
      try {
        const data = await timelineGet();
        const name = (data as any).activePresetName || null;
        const id = (data as any).activePresetId || null;
        setPresetInfo({ id, name });
        if ((data as any).segments) {
          setTimelineSegments(((data as any).segments || []) as Array<{ id: string; title: string; startTime: string; endTime: string }>);
        }
        if ((data as any).soundsBySegment) {
          setSoundsBySegment((data as any).soundsBySegment as Record<string, Array<string | { id: string; time?: string }>>);
        }
      } catch {}
    })();
  }, []);

  const isTimeInRange = (t: string, start: string, end: string) => {
    const tt = t.length === 5 ? `${t}:00` : t;
    return tt >= start && tt <= end;
  };

  const scheduleBadge = (time: string): { segment?: string; preset?: string } | null => {
    if (!presetInfo?.name || !timelineSegments.length) return null;
    const seg = timelineSegments.find(s => isTimeInRange(time, s.startTime, s.endTime));
    if (!seg) return null;
    const raw = soundsBySegment[seg.id];
    if (!Array.isArray(raw)) return null; // no limit -> not explicitly from preset
    const allowedIds = new Set(raw.map(x => (typeof x === 'string' ? x : x.id)));
    if (!allowedIds.has(soundId)) return null;
    return { segment: seg.title, preset: presetInfo.name };
  };

  // removed legacy importFromPreset

  const handleUpdateSchedule = async (scheduleId: string, time: string, active: boolean) => {
    if (!isSubmitting) {
      try {
        setIsSubmitting(true);
        const full = time.length === 5 ? `${time}:00` : time; // normalize HH:mm -> HH:mm:ss
        await updateSchedule(soundId, scheduleId, full, active);
        // Persist change into active preset mapping: find old time by id and update
        const old = (schedules || []).find(s => s.id === scheduleId);
        if (old) {
          await persistUpdateInActivePreset(old.time, time);
        }
        if (editingId === scheduleId) {
          setEditingId(null);
          setEditTime('');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const setNow = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    setNewTime(`${hh}:${mm}:${ss}`.slice(0,5));
  };

  const bumpMinutes = (base: string, delta: number) => {
    const [h, m] = (base || '00:00').split(':').map(x => parseInt(x || '0', 10));
    const d = new Date();
    d.setHours(isFinite(h) ? h : 0, isFinite(m) ? m : 0, 0, 0);
    d.setMinutes(d.getMinutes() + delta);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  return (
    <div className="border border-neutral-700 rounded-xl p-4 bg-neutral-800/50 mb-4 animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-[#C1C2C5] flex items-center">
          <Clock className="h-4 w-4 mr-1 text-[#4ECBD9]" />
          Zeitplan
        </h3>
        <button 
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      
      <div className="mb-4">
        {presetInfo?.name && (
          <div className="mb-2 text-xs text-[#C1C2C5] opacity-80">Aktives Preset: <span className="text-[#4ECBD9]">{presetInfo.name}</span></div>
        )}
        <form onSubmit={handleAddSchedule} className="space-y-2">
          <div className="flex items-center space-x-2">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm flex-1 text-[#C1C2C5]"
              step="1"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newTime || isSubmitting}
              className={`p-2 rounded-full ${
                newTime && !isSubmitting
                  ? 'bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20' 
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              } transition-colors`}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={setNow} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">Jetzt</button>
            <button type="button" onClick={() => setNewTime(bumpMinutes(newTime || formatTime(new Date().toTimeString().slice(0,8)), 1))} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">+1</button>
            <button type="button" onClick={() => setNewTime(bumpMinutes(newTime || formatTime(new Date().toTimeString().slice(0,8)), 5))} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">+5</button>
            <button type="button" onClick={() => setNewTime(bumpMinutes(newTime || formatTime(new Date().toTimeString().slice(0,8)), 10))} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">+10</button>
            <button type="button" onClick={() => setNewTime(bumpMinutes(newTime || formatTime(new Date().toTimeString().slice(0,8)), 15))} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">+15</button>
            <button type="button" onClick={() => setNewTime(bumpMinutes(newTime || formatTime(new Date().toTimeString().slice(0,8)), 30))} className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-[#C1C2C5]">+30</button>
          </div>
        </form>
      </div>
      
      {(() => {
        const filtered = schedules.filter(s => !!scheduleBadge(s.time));
        const show = (Object.keys(soundsBySegment).length > 0) ? filtered : schedules;
        const sorted = [...show].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        return sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map(schedule => (
            <li 
              key={schedule.id}
              className="flex items-center justify-between border border-neutral-700 rounded-lg p-3 bg-neutral-800/50"
            >
              <div className="flex items-center gap-2">
                {editingId === schedule.id ? (
                  <>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm w-28 text-[#C1C2C5]"
                      step="1"
                      disabled={isSubmitting}
                    />
                    <button
                      onClick={() => handleUpdateSchedule(schedule.id, editTime || schedule.time.slice(0, -3), schedule.active)}
                      className="p-1 rounded bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20"
                      disabled={isSubmitting}
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditTime(''); }}
                      className="p-1 rounded bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-[#C1C2C5] font-medium">{schedule.time.slice(0, -3)}</span>
                    <span className="text-xs text-neutral-400">({formatTime(schedule.time)})</span>
                    <button
                      onClick={() => { setEditingId(schedule.id); setEditTime(schedule.time.slice(0, -3)); }}
                      className="p-1 rounded text-neutral-400 hover:text-[#C1C2C5]"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Preset badge */}
                {(() => { const badge = scheduleBadge(schedule.time); return badge ? (
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-700/60 border border-neutral-600 text-[#C1C2C5]">
                    {badge.preset} • {badge.segment}
                  </div>
                ) : null; })()}
                <label className="inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={schedule.active}
                    onChange={(e) => handleUpdateSchedule(
                      schedule.id,
                      schedule.time.slice(0, -3), // Remove seconds when toggling
                      e.target.checked
                    )}
                    className="sr-only peer"
                    disabled={isSubmitting}
                  />
                  <div className="relative w-9 h-5 bg-neutral-700 peer-focus:ring-2 peer-focus:ring-[#4ECBD9]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4ECBD9]"></div>
                </label>
                
                <button
                  onClick={async () => { await deleteSchedule(soundId, schedule.id); await persistRemoveFromActivePreset(schedule.time); }}
                  className="p-1 text-neutral-400 hover:text-[#F471B5] transition-colors"
                  disabled={isSubmitting}
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-4 bg-gray-800/30 rounded-lg">
          <p className="text-sm text-gray-400">
            {Object.keys(soundsBySegment).length > 0 ? 'Keine Zeiten im aktiven Preset.' : 'No schedules yet. Add your first one above.'}
          </p>
        </div>
      );})()}
    </div>
  );
};

export default ScheduleEditor;
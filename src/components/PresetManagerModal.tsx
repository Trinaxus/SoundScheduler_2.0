import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Save, Trash2, Edit2, Check, Copy, Trash } from 'lucide-react';
import { presetsList, presetsUpsert, presetsDelete } from '../lib/api';
import { timelineGet, timelineSave } from '../lib/api';
import { useSounds } from '../context/SoundContext';

export type TimelineSegment = {
  id: string;
  title: string;
  startTime: string; // HH:mm:ss
  endTime: string;   // HH:mm:ss
};

type Preset = {
  id: string;
  name: string;
  segments: TimelineSegment[];
};

interface Props {
  open: boolean;
  onClose: () => void;
  currentSegments: TimelineSegment[];
  onApply: (segments: TimelineSegment[], meta: { id: string; name: string; soundsBySegment?: Record<string, Array<string | { id: string; time?: string }>> }) => void;
}

const PresetManagerModal: React.FC<Props> = ({ open, onClose, currentSegments, onApply }) => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const { sounds } = useSounds();
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await presetsList();
        const list = res.presets || [];
        setPresets(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
        } else {
          setSelectedId(null);
        }
        try {
          const tl = await timelineGet();
          setActivePresetId((tl as any).activePresetId || null);
        } catch {}
      } catch (e) {
        // Silent fail -> empty list
        setPresets([]);
        setSelectedId(null);
      }
    })();
  }, [open]);

  const selectedPreset = useMemo(() => presets.find(p => p.id === selectedId) || null, [presets, selectedId]);

  const persistReplace = (list: Preset[]) => setPresets(list);

  const generateId = () => Math.random().toString(36).slice(2, 10);

  const saveCurrentAsPreset = async () => {
    const name = newName.trim() || `Preset ${presets.length + 1}`;
    const preset: Preset = {
      id: generateId(),
      name,
      segments: currentSegments.map(s => ({ ...s })),
    };
    try {
      await presetsUpsert({ id: preset.id, name: preset.name, segments: preset.segments, soundsBySegment: {} });
      const next = [...presets, preset];
      persistReplace(next);
      setSelectedId(preset.id);
    } catch {}
    setNewName('');
  };

  const applyPreset = (p: Preset) => {
    onApply(
      p.segments.map(s => ({ ...s })), // pass a copy
      { id: p.id, name: p.name, soundsBySegment: workSoundsBySegment }
    );
    onClose();
  };

  const deletePreset = async (id: string) => {
    try { await presetsDelete(id); } catch {}
    const list = presets.filter(p => p.id !== id);
    persistReplace(list);
    if (selectedId === id) setSelectedId(null);
  };

  const startRename = (p: Preset) => {
    setEditingId(p.id);
    setEditingName(p.name);
  };

  const commitRename = async (p: Preset) => {
    const name = editingName.trim();
    if (!name) return;
    const updated = presets.map(x => x.id === p.id ? { ...x, name } : x);
    try { await presetsUpsert({ id: p.id, name, segments: (selectedPreset?.segments || p.segments), soundsBySegment: (selectedPreset as any)?.soundsBySegment }); } catch {}
    persistReplace(updated);
    setEditingId(null);
    setEditingName('');
  };

  const [workSegments, setWorkSegments] = useState<TimelineSegment[]>([]);
  const [workSoundsBySegment, setWorkSoundsBySegment] = useState<Record<string, Array<{ id: string; time?: string }>>>({});
  useEffect(() => {
    if (selectedPreset) {
      setWorkSegments(selectedPreset.segments.map(s => ({ ...s })));
      setWorkSoundsBySegment((selectedPreset as any).soundsBySegment || {});
    } else {
      setWorkSegments([]);
      setWorkSoundsBySegment({});
    }
  }, [selectedPreset?.id]);

  const isTimeInRange = (t: string, start: string, end: string) => {
    const tt = t.length === 5 ? `${t}:00` : t;
    return tt >= start && tt <= end;
  };

  const buildMappingFromSchedules = (): Record<string, Array<{ id: string; time?: string }>> => {
    const map: Record<string, Array<{ id: string; time?: string }>> = {};
    for (const seg of workSegments) {
      const arr: Array<{ id: string; time?: string }> = [];
      sounds.forEach(s => {
        (s.schedules || []).forEach(sch => {
          if (isTimeInRange(sch.time, seg.startTime, seg.endTime)) {
            arr.push({ id: s.id, time: sch.time });
          }
        });
      });
      map[seg.id] = arr;
    }
    return map;
  };

  const persistMapping = async (nextMap: Record<string, Array<{ id: string; time?: string }>>) => {
    if (!selectedPreset) return;
    await presetsUpsert({ id: selectedPreset.id, name: selectedPreset.name, segments: selectedPreset.segments, soundsBySegment: nextMap });
    // If selected is active, also persist into timeline
    try {
      const tl = await timelineGet();
      const tlSegments = (tl as any).segments as Array<{ id: string; title: string; startTime: string; endTime: string }> | undefined;
      if (activePresetId && selectedPreset.id === activePresetId) {
        await timelineSave((tl as any).mutedSchedules || [], (tl as any).mutedSegments || [], tlSegments, {
          activePresetId: selectedPreset.id,
          activePresetName: selectedPreset.name,
          soundsBySegment: nextMap,
        });
        try { window.dispatchEvent(new CustomEvent('timeline:updated')); } catch {}
      }
    } catch {}
  };

  const updateSeg = (idx: number, patch: Partial<TimelineSegment>) => {
    setWorkSegments(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const saveEditedSegments = async () => {
    if (!selectedPreset) return;
    const updated = presets.map(p => p.id === selectedPreset.id ? { ...p, segments: workSegments, soundsBySegment: workSoundsBySegment } : p);
    try { await presetsUpsert({ id: selectedPreset.id, name: selectedPreset.name, segments: workSegments, soundsBySegment: workSoundsBySegment }); } catch {}
    persistReplace(updated);
  };

  const duplicatePreset = async (p: Preset) => {
    const copy: Preset = {
      id: generateId(),
      name: `${p.name} (Kopie)`,
      segments: p.segments.map(s => ({ ...s })),
    };
    try { await presetsUpsert({ id: copy.id, name: copy.name, segments: copy.segments, soundsBySegment: (p as any).soundsBySegment }); } catch {}
    persistReplace([...presets, copy]);
  };

  const addSegmentRow = () => {
    setWorkSegments(prev => [
      ...prev,
      { id: generateId(), title: 'Neues Segment', startTime: '00:00:00', endTime: '00:00:00' },
    ]);
  };

  const removeSegmentRow = (idx: number) => {
    setWorkSegments(prev => prev.filter((_, i) => i !== idx));
  };

  if (!open) return null;

  // Helper: format duration between two HH:mm:ss times as "X h Y m"
  const durationLabel = (start: string, end: string) => {
    const toMinutes = (t: string) => {
      const [hh, mm] = t.split(':').map(x => parseInt(x, 10));
      return (hh || 0) * 60 + (mm || 0);
    };
    let diff = toMinutes(end) - toMinutes(start);
    if (diff < 0) diff += 24 * 60; // wrap overnight just in case
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h} h ${m} m`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl max-h-[85vh] bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 shrink-0">
          <h3 className="text-[#C1C2C5] text-lg font-medium">Timeline-Presets</h3>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-1 overflow-y-auto">
          {/* Left: List and create */}
          <div className="p-4 border-b md:border-b-0 md:border-r border-neutral-700 md:col-span-4">
            <h4 className="text-sm font-medium text-[#C1C2C5] mb-3">Vorlagen</h4>

            <div className="flex items-center gap-2 mb-3">
              <input
                placeholder="Neuer Preset-Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 bg-neutral-700/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-[#C1C2C5]"
              />
              <button
                onClick={saveCurrentAsPreset}
                className="px-3 py-2 rounded-lg bg-[#4ECBD9]/10 text-[#4ECBD9] border border-[#4ECBD9]/30 hover:bg-[#4ECBD9]/20 text-sm"
                title="Aktuelles Zeitmodell als Preset speichern"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {presets.map(p => (
                <li
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${selectedId === p.id ? 'bg-neutral-700/60 ring-1 ring-neutral-600' : 'bg-neutral-700/30 hover:bg-neutral-700/40'}`}
                >
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        className="flex-1 bg-neutral-700/50 border border-neutral-600 rounded px-2 py-1 text-sm text-[#C1C2C5]"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(p); if (e.key === 'Escape') setEditingId(null); }}
                      />
                      <button onClick={(e) => { e.stopPropagation(); commitRename(p); }} className="p-1 rounded bg-[#4ECBD9]/10 border border-[#4ECBD9]/30 text-[#4ECBD9]" title="Speichern">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-[#C1C2C5] truncate text-left">{p.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); duplicatePreset(p); }} className="p-1 rounded hover:bg-neutral-700" title="Duplizieren"><Copy className="w-4 h-4 text-neutral-400"/></button>
                        <button onClick={(e) => { e.stopPropagation(); startRename(p); }} className="p-1 rounded hover:bg-neutral-700" title="Umbenennen"><Edit2 className="w-4 h-4 text-neutral-400"/></button>
                        <button onClick={(e) => { e.stopPropagation(); deletePreset(p.id); }} className="p-1 rounded hover:bg-neutral-700" title="Löschen"><Trash2 className="w-4 h-4 text-[#F471B5]"/></button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {presets.length === 0 && (
                <li className="text-xs text-[#909296]">Noch keine Presets. Aktuelles Zeitmodell benennen und mit + speichern.</li>
              )}
            </ul>
          </div>

          {/* Right: Edit selected (wider) */}
          <div className="p-4 md:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-[#C1C2C5]">Preset bearbeiten</h4>
              {selectedPreset && (
                <div className="flex items-center gap-2">
                  <button onClick={saveEditedSegments} className="px-3 py-1.5 rounded bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20 text-xs" title="Änderungen speichern">
                    <Save className="w-4 h-4 inline mr-1"/> Speichern
                  </button>
                  <button onClick={() => applyPreset(selectedPreset)} className="px-3 py-1.5 rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600 text-xs" title="Preset anwenden">
                    Anwenden
                  </button>
                  <button
                    onClick={async () => {
                      const map = buildMappingFromSchedules();
                      setWorkSoundsBySegment(map);
                      await persistMapping(map);
                    }}
                    className="px-3 py-1.5 rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600 text-xs"
                    title="Zuordnungen aus aktuellen Zeitplänen erzeugen"
                  >
                    Aus Zeitplänen übernehmen
                  </button>
                </div>
              )}
            </div>
            {selectedPreset ? (
              <div className="space-y-4">
                {workSegments.map((seg, idx) => (
                  <div key={seg.id} className="space-y-2 bg-neutral-700/20 rounded-lg p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-center">
                      <input
                        value={seg.title}
                        onChange={e => updateSeg(idx, { title: e.target.value })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-[#C1C2C5] sm:col-span-3"
                        placeholder="Titel"
                      />
                      <input
                        type="time"
                        value={seg.startTime.slice(0,5)}
                        onChange={e => updateSeg(idx, { startTime: e.target.value + ':00' })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-[#C1C2C5]"
                      />
                      <input
                        type="time"
                        value={seg.endTime.slice(0,5)}
                        onChange={e => updateSeg(idx, { endTime: e.target.value + ':00' })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-[#C1C2C5]"
                      />
                      <div className="inline-flex items-center text-xs text-[#4ECBD9] bg-[#4ECBD9]/10 border border-[#4ECBD9]/30 rounded-full px-2 py-0.5 shadow-[0_0_8px_rgba(78,203,217,0.15)]">
                        {durationLabel(seg.startTime, seg.endTime)}
                      </div>
                      <button onClick={() => removeSegmentRow(idx)} className="justify-self-end p-1 rounded hover:bg-neutral-700" title="Segment entfernen"><Trash className="w-4 h-4 text-[#F471B5]"/></button>
                    </div>

                    {/* Sounds assignment (read-only). Editing erfolgt in der Soundliste/Zeitplan. */}
                    <div className="space-y-2">
                      <div className="text-xs text-[#C1C2C5] flex items-center justify-between">
                        <span>Zugeordnete Sounds (schreibgeschützt)</span>
                        <span className="text-[10px] text-neutral-400">Bearbeitung in der Soundliste → Zeitplan</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(workSoundsBySegment[seg.id] || []).map((item, i) => {
                          const id = typeof item === 'string' ? item : item.id;
                          const t = typeof item === 'string' ? '' : (item.time || '');
                          const s = sounds.find(x => x.id === id);
                          return (
                            <div key={id + '-' + i} className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-[#C1C2C5]">
                              <span className="mr-2">{s?.name || id}</span>
                              {t && <span className="text-neutral-400">{t.slice(0,5)}</span>}
                            </div>
                          );
                        })}
                        {!(workSoundsBySegment[seg.id] || []).length && (
                          <div className="text-xs text-neutral-400">Keine Zuordnungen</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <button onClick={addSegmentRow} className="px-3 py-1.5 rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600 text-xs" title="Segment hinzufügen">
                    <Plus className="w-4 h-4 inline mr-1"/> Segment hinzufügen
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#909296]">Links ein Preset auswählen, um es zu bearbeiten oder anzuwenden.</div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-neutral-700 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#C1C2C5] hover:text-white">Schließen</button>
        </div>
      </div>
    </div>
  );
};

export default PresetManagerModal;

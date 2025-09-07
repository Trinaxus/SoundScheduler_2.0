import React, { useState } from 'react';
import { Play, Pause, X, Clock, Edit, Save } from 'lucide-react';
import { useSounds } from '../context/SoundContext';
import { formatFileSize, formatDuration, formatTime } from '../utils/helpers';
import ScheduleEditor from './ScheduleEditor';
// Cover removed: no API_BASE required

const SoundList: React.FC = () => {
  const {
    sounds,
    currentlyPlaying,
    playSound,
    pauseSound,
    deleteSound,
    renameSound,
    categories,
  } = useSounds();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [expandedSchedulerId, setExpandedSchedulerId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('');

  const handleStartEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      renameSound(id, editName.trim());
    }
    setEditingId(null);
  };

  const toggleScheduleEditor = (id: string) => {
    setExpandedSchedulerId(expandedSchedulerId === id ? null : id);
  };

  if (sounds.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="mb-4 flex justify-center">
          <div className="bg-[#4ECBD9]/10 p-3 rounded-full">
            <Clock className="h-8 w-8 text-[#4ECBD9]" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-[#C1C2C5] mb-1">Keine Sounds</h3>
        <p className="text-sm text-[#909296]">
          Lade Audiodateien hoch, um sie für die Wiedergabe zu planen
        </p>
      </div>
    );
  }

  const visibleSounds = sounds.filter(s => !filterCat || s.categoryId === filterCat);

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => setFilterCat('')}
            className={`px-3 py-1.5 rounded-full text-xs border ${filterCat === '' ? 'bg-[#4ECBD9]/10 text-[#4ECBD9] border-[#4ECBD9]/30' : 'bg-neutral-800 text-[#C1C2C5] border-neutral-700 hover:bg-neutral-700'}`}
          >
            Alle
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${filterCat === c.id ? 'bg-[#4ECBD9]/10 text-[#4ECBD9] border-[#4ECBD9]/30' : 'bg-neutral-800 text-[#C1C2C5] border-neutral-700 hover:bg-neutral-700'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {visibleSounds.map((sound) => (
        <React.Fragment key={sound.id}>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-all">
            <div className="flex items-center p-4">
              <div className="flex-shrink-0 mr-4">
                {currentlyPlaying === sound.id ? (
                  <button
                    onClick={() => pauseSound()}
                    onTouchStart={() => pauseSound()}
                    className="p-2 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors touch-manipulation"
                  >
                    <Pause className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => playSound(sound.id)}
                    onTouchStart={() => playSound(sound.id)}
                    className="p-2 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors touch-manipulation"
                  >
                    <Play className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="ml-0 flex-1 text-left">
                {editingId === sound.id ? (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-black/20 rounded px-2 py-1 text-sm w-full text-[#4ECBD9]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(sound.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(sound.id)}
                      onTouchStart={() => handleSaveEdit(sound.id)}
                      className="ml-2 p-1 bg-[#4ECBD9]/10 text-[#4ECBD9] rounded hover:bg-[#4ECBD9]/20"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-medium text-[#4ECBD9] flex items-center">
                    {sound.name}
                    <button
                      onClick={() => handleStartEditing(sound.id, sound.name)}
                      onTouchStart={() => handleStartEditing(sound.id, sound.name)}
                      className="ml-2 p-1 text-[#909296] hover:text-[#4ECBD9] transition-colors"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                  </h3>
                )}

                <div className="mt-1 flex items-center text-xs text-[#909296]">
                  <span className="mr-3">{formatFileSize(sound.size)}</span>
                  <span>{formatDuration(sound.duration)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div
                  className="flex items-center cursor-pointer group"
                  onClick={() => toggleScheduleEditor(sound.id)}
                  onTouchStart={() => toggleScheduleEditor(sound.id)}
                >
                  <div className="flex px-2 py-1 rounded-md bg-black/20 group-hover:bg-black/30 transition-colors">
                    <Clock className="h-4 w-4 text-[#909296] mr-1" />
                    <span className="text-xs font-medium text-[#C1C2C5]">
                      {sound.schedules.length === 0
                        ? 'Zeitplan hinzufügen'
                        : `${sound.schedules.length} Zeitplan${sound.schedules.length > 1 ? 'e' : ''}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const ok = window.confirm(`Soll die Datei "${sound.name}" wirklich gelöscht werden? Dieser Vorgang kann nicht rückgängig gemacht werden.`);
                    if (ok) deleteSound(sound.id);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const ok = window.confirm(`Soll die Datei "${sound.name}" wirklich gelöscht werden? Dieser Vorgang kann nicht rückgängig gemacht werden.`);
                    if (ok) deleteSound(sound.id);
                  }}
                  className="p-1 text-[#909296] hover:text-[#4ECBD9] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {sound.schedules.length > 0 && expandedSchedulerId !== sound.id && (
              <div className="px-4 pb-3 pt-0">
                <div className="flex flex-wrap gap-2 mt-2">
                  {sound.schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`text-xs px-2 py-1 rounded ${
                        schedule.active
                          ? 'bg-[#F471B5]/10 text-[#F471B5]'
                          : 'bg-black/20 text-[#909296] line-through'
                      }`}
                    >
                      {formatTime(schedule.time)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {expandedSchedulerId === sound.id && (
            <ScheduleEditor
              soundId={sound.id}
              schedules={sound.schedules}
              onClose={() => setExpandedSchedulerId(null)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SoundList;
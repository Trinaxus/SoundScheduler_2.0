import React, { useState } from 'react';
import { Play, Pause, X, Clock, Edit, Save } from 'lucide-react';
import { useSounds } from '../context/SoundContext';
import { formatFileSize, formatDuration, formatTime } from '../utils/helpers';
import ScheduleEditor from './ScheduleEditor';
import SoundUploader from './SoundUploader';
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
  const [uploadOpen, setUploadOpen] = useState<boolean>(false);

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
      {/* Sticky filter bar + plus button for mobile */}
      <div className="sticky -mx-4 sm:mx-0 top-0 z-10 bg-neutral-900/85 backdrop-blur border-b border-neutral-800 px-4 sm:px-0 pt-2 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCat('')}
              className={`appearance-none p-0 inline-flex items-center justify-center min-h-[24px] h-[24px] px-4 rounded-full text-[12px] sm:text-sm border leading-none ${filterCat === '' ? 'bg-[#0d1718] text-[#4ECBD9] border-transparent ring-1 ring-[#4ECBD9]/40' : 'bg-neutral-800 text-[#C1C2C5] border-neutral-700 hover:bg-neutral-700'}`}
            >
              Alle
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                className={`appearance-none p-0 inline-flex items-center justify-center min-h-[24px] h-[24px] px-4 rounded-full text-[12px] sm:text-sm border leading-none ${filterCat === c.id ? 'bg-[#0d1718] text-[#4ECBD9] border-transparent ring-1 ring-[#4ECBD9]/40' : 'bg-neutral-800 text-[#C1C2C5] border-neutral-700 hover:bg-neutral-700'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setUploadOpen(v => !v)}
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${uploadOpen ? 'bg-[#4ECBD9]/20 text-[#4ECBD9]' : 'bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20'}`}
            title={uploadOpen ? 'Upload-Bereich schließen' : 'Upload-Bereich öffnen'}
            aria-expanded={uploadOpen}
            aria-controls="soundlist-upload"
          >
            {/* Using a simple plus via CSS rotates when open */}
            <span className={`block w-4 h-4 relative`}> 
              <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-4 bg-current transition-transform ${uploadOpen ? 'rotate-45' : ''}`} />
              <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-0.5 bg-current transition-transform ${uploadOpen ? '-rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Upload Panel */}
      <div id="soundlist-upload" className={`overflow-hidden transition-all duration-300 ${uploadOpen ? 'max-h-[600px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'}`}>
        <div className="bg-neutral-800/80 rounded-xl p-3 sm:p-6 border border-neutral-700/30 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">Audiodateien hochladen</h3>
              <p className="text-xs text-neutral-400">Drag & Drop • Mehrfach-Upload • Fortschritt</p>
            </div>
            <button
              onClick={() => setUploadOpen(false)}
              className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700/50"
              aria-label="Upload schließen"
            >
              <span className="block w-5 h-5 relative">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-4 bg-current rotate-45" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-0.5 bg-current -rotate-45" />
              </span>
            </button>
          </div>
          <SoundUploader />
        </div>
      </div>

      {visibleSounds.map((sound) => (
        <React.Fragment key={sound.id}>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-all">
            <div className="p-3 sm:p-4">
              {/* Mobile: top bar (play left, actions right) */}
              <div className="flex items-center justify-between sm:hidden mb-2">
                <div>
                  {currentlyPlaying === sound.id ? (
                    <button
                      onClick={() => pauseSound()}
                      onTouchStart={() => pauseSound()}
                      className="p-3 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => playSound(sound.id)}
                      onTouchStart={() => playSound(sound.id)}
                      className="p-3 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div
                    className="flex items-center cursor-pointer"
                    onClick={() => toggleScheduleEditor(sound.id)}
                    onTouchStart={() => toggleScheduleEditor(sound.id)}
                  >
                    <div className="flex px-2 py-2 rounded-md bg-black/20">
                      <Clock className="h-4 w-4 text-[#909296]" />
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
                    className="p-2 text-[#909296] hover:text-[#4ECBD9]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Mobile: full-width title and meta */}
              <div className="sm:hidden">
                {editingId === sound.id ? (
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-black/20 rounded px-2 py-2 text-sm w-full text-[#4ECBD9]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(sound.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(sound.id)}
                      onTouchStart={() => handleSaveEdit(sound.id)}
                      className="ml-2 p-2 bg-[#4ECBD9]/10 text-[#4ECBD9] rounded hover:bg-[#4ECBD9]/20"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-medium text-[#4ECBD9] text-sm mb-1 break-words whitespace-normal leading-snug">
                    {sound.name}
                    <button
                      onClick={() => handleStartEditing(sound.id, sound.name)}
                      onTouchStart={() => handleStartEditing(sound.id, sound.name)}
                      className="ml-2 p-1 text-[#909296] hover:text-[#4ECBD9]"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                  </h3>
                )}
                <div className="flex items-center text-xs text-[#909296] gap-3">
                  <span className="hidden xs:inline">{formatFileSize(sound.size)}</span>
                  <span>{formatDuration(sound.duration)}</span>
                </div>
              </div>

              {/* Desktop/tablet: previous horizontal layout */}
              <div className="hidden sm:flex items-stretch gap-4">
                <div className="flex-shrink-0">
                  {currentlyPlaying === sound.id ? (
                    <button
                      onClick={() => pauseSound()}
                      onTouchStart={() => pauseSound()}
                      className="p-2 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors"
                    >
                      <Pause className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => playSound(sound.id)}
                      onTouchStart={() => playSound(sound.id)}
                      className="p-2 bg-[#4ECBD9]/10 rounded-full text-[#4ECBD9] hover:bg-[#4ECBD9]/20 transition-colors"
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <div className="flex-1 text-left flex flex-col justify-between min-h-[56px]">
                  {editingId === sound.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-black/20 rounded px-2 py-2 text-sm w-full text-[#4ECBD9]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(sound.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSaveEdit(sound.id)}
                        onTouchStart={() => handleSaveEdit(sound.id)}
                        className="ml-2 p-2 bg-[#4ECBD9]/10 text-[#4ECBD9] rounded hover:bg-[#4ECBD9]/20"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="font-medium text-[#4ECBD9] flex items-center text-base mb-1 break-words whitespace-normal leading-snug">
                      {sound.name}
                      <button
                        onClick={() => handleStartEditing(sound.id, sound.name)}
                        onTouchStart={() => handleStartEditing(sound.id, sound.name)}
                        className="ml-2 p-1 text-[#909296] hover:text-[#4ECBD9]"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </h3>
                  )}
                  <div className="flex items-center text-xs text-[#909296] gap-3">
                    <span className="hidden xs:inline">{formatFileSize(sound.size)}</span>
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
                    className="p-1 text-[#909296] hover:text-[#4ECBD9]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {sound.schedules.length > 0 && expandedSchedulerId !== sound.id && (
              <div className="px-3 sm:px-4 pb-3 pt-0">
                <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2">
                  {sound.schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${
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
}
;

export default SoundList;
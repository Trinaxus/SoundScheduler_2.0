import React, { useMemo, useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Play, Pause, Star, StopCircle } from 'lucide-react';
import { useSounds } from '../context/SoundContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

const CategoryManagerModal: React.FC<Props> = ({ open, onClose }) => {
  const {
    categories,
    sounds,
    addCategory,
    renameCategory,
    deleteCategory,
    setSoundCategory,
    playSound,
    pauseSound,
    currentlyPlaying,
    toggleFavorite,
    toggleHiddenCategory,
  } = useSounds();

  const [newCat, setNewCat] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const categoriesSorted = useMemo(() => {
    return [...categories].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [categories]);

  // derive a stable (non-persistent) color from id/name
  const colorFor = (key: string | undefined): string => {
    if (!key) return '#9ca3af';
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 65% 55%)`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl max-h-[80vh] bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 shrink-0">
          <h3 className="text-[#C1C2C5] text-lg font-medium">Kategorien verwalten</h3>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-white" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:[grid-template-columns:300px_minmax(0,1fr)] gap-0 flex-1 overflow-y-auto">
          {/* Left: Category CRUD */}
          <div className="p-4 border-b md:border-b-0 md:border-r border-neutral-700">
            <h4 className="text-sm font-medium text-[#C1C2C5] mb-3">Kategorien</h4>

            <div className="flex items-center space-x-2 mb-3">
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Neue Kategorie"
                className="flex-1 bg-neutral-700/50 border border-neutral-600 rounded-lg px-3 py-2 text-sm text-[#C1C2C5]"
              />
              <button
                onClick={async () => {
                  const name = newCat.trim();
                  if (!name) return;
                  await addCategory(name);
                  setNewCat('');
                }}
                className="px-3 py-2 rounded-lg bg-[#4ECBD9]/10 text-[#4ECBD9] border border-[#4ECBD9]/30 hover:bg-[#4ECBD9]/20 text-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-2">
              {categoriesSorted.map((c) => (
                <li key={c.id} className="flex items-center justify-between bg-neutral-700/30 px-3 py-2 rounded-lg">
                  {editingId === c.id ? (
                    <div className="flex items-center space-x-2 flex-1">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-neutral-700/50 border border-neutral-600 rounded px-2 py-1 text-sm text-[#C1C2C5]"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            await renameCategory(c.id, editName.trim());
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                      <button
                        onClick={async () => {
                          await renameCategory(c.id, editName.trim());
                          setEditingId(null);
                        }}
                        className="p-1 rounded bg-[#4ECBD9]/10 border border-[#4ECBD9]/30 text-[#4ECBD9]"
                        aria-label="Speichern"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-[#C1C2C5] inline-flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(c.id || c.name) }} />
                        {c.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                          className="p-1 rounded hover:bg-neutral-700"
                          aria-label="Bearbeiten"
                        >
                          <Edit2 className="w-4 h-4 text-neutral-400" />
                        </button>
                        <button
                          onClick={async () => { await deleteCategory(c.id); }}
                          className="p-1 rounded hover:bg-neutral-700"
                          aria-label="Löschen"
                        >
                          <Trash2 className="w-4 h-4 text-[#F471B5]" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {categoriesSorted.length === 0 && (
                <li className="text-xs text-[#909296]">Noch keine Kategorien. Lege oben eine an.</li>
              )}
            </ul>
          </div>

          {/* Right: Assignment */}
          <div className="p-4">
            <h4 className="text-sm font-medium text-[#C1C2C5] mb-3">Zuweisung</h4>
            <div className="space-y-2 pr-1">
              {sounds.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-neutral-700/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0 mr-3">
                    <button
                      onClick={() => {
                        if (currentlyPlaying === s.id) {
                          pauseSound();
                        } else {
                          playSound(s.id);
                        }
                      }}
                      className={`p-1.5 rounded-full ${currentlyPlaying === s.id ? 'bg-[#4ECBD9]/20 text-[#4ECBD9]' : 'bg-neutral-700/70 text-neutral-300 hover:bg-neutral-600'}`}
                      aria-label="Vorhören"
                    >
                      {currentlyPlaying === s.id ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                    </button>
                    <button
                      onClick={async () => { await toggleFavorite(s.id); }}
                      className="p-1.5 rounded-full hover:bg-neutral-700"
                      aria-label="Favorit umschalten"
                    >
                      <Star className={`w-4 h-4 ${s.isFavorite ? 'fill-[#F471B5] text-[#F471B5]' : 'text-neutral-400'}`} />
                    </button>
                    <button
                      onClick={async () => { await toggleHiddenCategory(s.id); }}
                      className="p-1.5 rounded-full hover:bg-neutral-700"
                      aria-label="In/aus 'Ausgeblendet' verschieben"
                      title={(s.categoryId && (categories.find(c=>c.id===s.categoryId)?.name||'').toLowerCase()==='ausgeblendet') ? 'Aus "Ausgeblendet" entfernen' : 'In "Ausgeblendet" verschieben'}
                    >
                      <StopCircle className={`w-4 h-4 ${
                        (s.categoryId && (categories.find(c=>c.id===s.categoryId)?.name||'').toLowerCase()==='ausgeblendet')
                          ? 'text-[#F87171]'
                          : 'text-neutral-400'
                      }`} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm text-[#C1C2C5] truncate">{s.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.categoryId && (
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(s.categoryId) }} />
                    )}
                    <select
                      value={s.categoryId || ''}
                      onChange={async (e) => {
                        const val = e.target.value || null;
                        await setSoundCategory(s.id, val);
                      }}
                      className="bg-neutral-700/50 border border-neutral-600 rounded px-2 py-1 text-sm text-[#C1C2C5]"
                    >
                      <option value="">— Ohne —</option>
                      {categoriesSorted.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-neutral-700 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#C1C2C5] hover:text-white">Schließen</button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;

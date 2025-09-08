import React, { useState, useEffect } from 'react';
import { GripHorizontal, Star, Clock, Play, Pause, Music, Settings, Search } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSounds } from '../context/SoundContext';
import { Sound } from '../types';
import { formatDuration } from '../utils/helpers';
// Cover removed: no API_BASE required
import CategoryManagerModal from './CategoryManagerModal';
import { me, logout } from '../lib/api';

type SoundboardMode = 'normal' | 'remoteFavorites';
const SoundboardView: React.FC<{ mode?: SoundboardMode }> = ({ mode = 'normal' }) => {
  const { 
    sounds: originalSounds, 
    currentlyPlaying,
    categories,
    toggleFavorite,
    updateSoundOrder,
    currentTimeSeconds,
    playOrRemote,
  } = useSounds();
  
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [filterCat, setFilterCat] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  // no hover index needed with dnd-kit overlay/strategy
  const [catOpen, setCatOpen] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Derive a stable color from a string (category id or name)
  const colorFor = (key: string | undefined): string => {
    if (!key) return '#9ca3af'; // neutral gray fallback
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    const sat = 65; // percent
    const light = 55; // percent
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // remove snap to avoid interfering with hit-testing

  useEffect(() => {
    // Keep only display_order for manual sorting; do NOT prioritize favorites here,
    const sortedSounds = [...originalSounds].sort((a, b) => (a.order || 0) - (b.order || 0));
    setSounds(sortedSounds);
  }, [originalSounds]);

  useEffect(() => {
    // Check auth status so we can show a small header with login/logout in remote mode
    (async () => {
      try {
        const res = await me();
        setAuthed(!!res?.authenticated);
      } catch (_) {
        setAuthed(false);
      }
    })();
  }, []);

  const onDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const onDragOver = () => {};

  const onDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // Build filtered view as rendered
    const hiddenCat = categories.find(c => (c.name || '').toLowerCase() === 'ausgeblendet');
    const hiddenCatId = hiddenCat?.id;
    const visible = sounds
      .filter(s => !filterCat || s.categoryId === filterCat)
      .filter(s => (!filterCat && hiddenCatId) ? s.categoryId !== hiddenCatId : true);

    const getGroupKey = (s: Sound) => s.categoryId || 'none';

    if (!filterCat) {
      const a = sounds.find(s => s.id === active.id);
      const b = sounds.find(s => s.id === over.id);
      if (!a || !b) return;
      // Restrict reordering within same section in 'Alle'
      if (getGroupKey(a) !== getGroupKey(b)) return;

      const groupId = getGroupKey(a);
      const subset = visible.filter(s => getGroupKey(s) === groupId).sort((x, y) => (x.order || 0) - (y.order || 0));
      const ids = subset.map(s => s.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedIds = arrayMove(ids, oldIndex, newIndex);

      const indicesInFull = sounds.map((s, idx) => ({ s, idx })).filter(({ s }) => ids.includes(s.id)).map(({ idx }) => idx);
      const next = [...sounds];
      indicesInFull.forEach((fullIdx, i) => {
        const newId = reorderedIds[i];
        next[fullIdx] = sounds.find(s => s.id === newId)!;
      });
      const updated = next.map((item, idx) => ({ ...item, order: idx }));
      setSounds(updated);
      await updateSoundOrder(updated);
      return;
    }

    // Other filtered views: reorder within the filtered list as before
    const ids = visible.map(s => s.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedIds = arrayMove(ids, oldIndex, newIndex);
    const indicesInFull = sounds.map((s, idx) => ({ s, idx })).filter(({ s }) => ids.includes(s.id)).map(({ idx }) => idx);
    const next = [...sounds];
    indicesInFull.forEach((fullIdx, i) => {
      const newId = reorderedIds[i];
      next[fullIdx] = sounds.find(s => s.id === newId)!;
    });
    const updated = next.map((item, idx) => ({ ...item, order: idx }));
    setSounds(updated);
    await updateSoundOrder(updated);
  };

  if (sounds.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="mb-4 flex justify-center">
          <div className="bg-[#4ECBD9]/10 p-3 rounded-full">
            <Music className="h-8 w-8 text-[#4ECBD9]" />
          </div>
        </div>
        <h3 className="text-lg font-medium text-[#C1C2C5] mb-1">Keine Sounds</h3>
        <p className="text-sm text-[#909296]">
          Lade Audiodateien hoch, um sie im Soundboard zu verwenden
        </p>
      </div>
    );
  }

  const isRemoteFavorites = mode === 'remoteFavorites';

  return (
    <>
      {/* Remote compact header (iPad fix): show a small sticky header with login/logout if global header is hidden */}
      {isRemoteFavorites && (
        <div className="sticky top-0 z-30 -mx-4 sm:mx-0 bg-neutral-900/90 backdrop-blur border-b border-neutral-800 px-4 sm:px-0 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="text-[#C1C2C5]">Remote</div>
            <div className="flex items-center gap-2">
              {!authed ? (
                <button
                  type="button"
                  onClick={() => { try { window.localStorage.removeItem('player_is_host'); } catch(_) {} try { window.location.assign('/'); } catch (_) {} }}
                  onTouchStart={() => { try { window.localStorage.removeItem('player_is_host'); } catch(_) {} try { window.location.assign('/'); } catch (_) {} }}
                  className="px-2 h-7 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
                >
                  Zur Anmeldung
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => { try { await logout(); } catch (_) {} finally { try { window.location.reload(); } catch {} } }}
                  onTouchStart={async () => { try { await logout(); } catch (_) {} finally { try { window.location.reload(); } catch {} } }}
                  className="px-2 h-7 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
                >
                  Abmelden
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Sticky search + filters (aligned with SoundList) */}
      <div className="sticky -mx-4 sm:mx-0 top-0 z-10 bg-neutral-900/85 backdrop-blur border-b border-neutral-800 px-4 sm:px-0 pt-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suche Jingles..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-neutral-700/50 border border-neutral-600 text-sm text-[#C1C2C5] placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#4ECBD9]/40"
              />
            </div>
            {!isRemoteFavorites && (
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
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(c.id || c.name) }} />
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isRemoteFavorites && (
            <button
              onClick={() => setCatOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
              title="Kategorien verwalten"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        {(() => {
          const hiddenCat = categories.find(c => (c.name || '').toLowerCase() === 'ausgeblendet');
          const hiddenCatId = hiddenCat?.id;
          const favCat = categories.find(c => (c.name || '').toLowerCase() === 'favoriten');
          const fixedCatId = isRemoteFavorites ? favCat?.id : undefined;

          // Alle-Ansicht: gruppiert nach Kategorien
          if (!filterCat || fixedCatId) {
            const term = search.trim().toLowerCase();
            const visible = sounds
              .filter(s => (!hiddenCatId) ? true : s.categoryId !== hiddenCatId)
              .filter(s => term ? (s.name || '').toLowerCase().includes(term) : true);
            if (fixedCatId) {
              // Only favorites section
              const favItems = visible.filter(s => s.categoryId === fixedCatId).sort((a,b)=> (a.order||0)-(b.order||0));
              const ids = favItems.map(s=>s.id);
              return (
                <>
                  <SortableContext items={ids} strategy={rectSortingStrategy}>
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(fixedCatId || 'fav') }} />
                          <h4 className="text-xs uppercase tracking-wide text-[#909296]">Favoriten</h4>
                        </div>
                        {/* Mobile: compact rows */}
                        <div className="sm:hidden">
                          <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 overflow-hidden">
                            {favItems.map(sound => (
                              <li key={sound.id} className="bg-neutral-800/40">
                                <button
                                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800/70 ${currentlyPlaying===sound.id?'ring-1 ring-[#4ECBD9]':''}`}
                                  onClick={() => playOrRemote(sound.id)}
                                >
                                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${currentlyPlaying===sound.id?'bg-[#4ECBD9]/20 text-[#4ECBD9]':'bg-[#4ECBD9]/10 text-[#4ECBD9]'}`}>
                                    {currentlyPlaying===sound.id? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                                  </span>
                                  <span className="flex-1 truncate text-[#C1C2C5]">{sound.name}</span>
                                  <span className="text-[10px] text-[#909296]">{formatDuration(sound.duration)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Desktop/tablet: card grid */}
                        <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {favItems.map(sound => (
                            <SortableCard
                              key={sound.id}
                              id={sound.id}
                              sound={sound}
                              isActive={currentlyPlaying === sound.id}
                              categories={categories}
                              colorFor={colorFor}
                              currentTimeSeconds={currentTimeSeconds}
                              onPlay={() => playOrRemote(sound.id)}
                              onToggleFavorite={() => {}}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </SortableContext>
                </>
              );
            }
            const favoriten = categories.find(c => (c.name || '').toLowerCase() === 'favoriten');
            const normalCats = categories
              .filter(c => c.id !== hiddenCatId && (!favoriten || c.id !== favoriten.id))
              .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

            const sections: Array<{ key: string; title: string; color?: string; items: Sound[] }>= [];
            if (favoriten) {
              const favItems = visible.filter(s => s.categoryId === favoriten.id).sort((a,b)=> (a.order||0)-(b.order||0));
              if (favItems.length > 0) {
                sections.push({
                  key: favoriten.id,
                  title: favoriten.name,
                  color: colorFor(favoriten.id || favoriten.name),
                  items: favItems,
                });
              }
            }
            for (const c of normalCats) {
              const items = visible.filter(s => s.categoryId === c.id).sort((a,b)=> (a.order||0)-(b.order||0));
              if (items.length > 0) {
                sections.push({
                  key: c.id!,
                  title: c.name,
                  color: colorFor(c.id || c.name),
                  items,
                });
              }
            }
            // Ohne Kategorie
            const noneItems = visible.filter(s => !s.categoryId).sort((a,b)=> (a.order||0)-(b.order||0));
            if (noneItems.length) {
              sections.push({ key: 'none', title: 'Ohne Kategorie', items: noneItems });
            }

            // Single global SortableContext across all items
            const allIds = sections.flatMap(sec => sec.items.map(s => s.id));
            return (
              <>
                <SortableContext items={allIds} strategy={rectSortingStrategy}>
                  <div className="space-y-6">
                    {sections.map(sec => (
                      <div key={sec.key}>
                        <div className="flex items-center gap-2 mb-2">
                          {sec.color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />}
                          <h4 className="text-xs uppercase tracking-wide text-[#909296]">{sec.title}</h4>
                        </div>
                        {/* Mobile: compact rows */}
                        <div className="sm:hidden">
                          <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 overflow-hidden">
                            {sec.items.map(sound => (
                              <li key={sound.id} className="bg-neutral-800/40">
                                <button
                                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800/70 ${currentlyPlaying===sound.id?'ring-1 ring-[#4ECBD9]':''}`}
                                  onClick={() => playOrRemote(sound.id)}
                                >
                                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${currentlyPlaying===sound.id?'bg-[#4ECBD9]/20 text-[#4ECBD9]':'bg-[#4ECBD9]/10 text-[#4ECBD9]'}`}>
                                    {currentlyPlaying===sound.id? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                                  </span>
                                  <span className="flex-1 truncate text-[#C1C2C5]">{sound.name}</span>
                                  <span className="text-[10px] text-[#909296]">{formatDuration(sound.duration)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Desktop/tablet: card grid */}
                        <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {sec.items.map(sound => (
                            <SortableCard
                              key={sound.id}
                              id={sound.id}
                              sound={sound}
                              isActive={currentlyPlaying === sound.id}
                              categories={categories}
                              colorFor={colorFor}
                              currentTimeSeconds={currentTimeSeconds}
                              onPlay={() => playOrRemote(sound.id)}
                              onToggleFavorite={() => toggleFavorite(sound.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeId ? (
                    (() => {
                      const s = sounds.find(x => x.id === activeId);
                      if (!s) return null;
                      return (
                        <CardContent
                          sound={s}
                          isActive={currentlyPlaying === s.id}
                          categories={categories}
                          colorFor={colorFor}
                          onPlay={() => {}}
                          onToggleFavorite={() => {}}
                          currentTimeSeconds={currentTimeSeconds}
                        />
                      );
                    })()
                  ) : null}
                </DragOverlay>
              </>
            );
          }

          // Gefilterte Ansicht: wie bisher (eine Section, sortiert Favoriten zuerst)
          const term2 = search.trim().toLowerCase();
          const list = sounds
            .filter(s => !filterCat || s.categoryId === filterCat)
            .filter(s => (!filterCat && hiddenCatId) ? s.categoryId !== hiddenCatId : true)
            .filter(s => term2 ? (s.name || '').toLowerCase().includes(term2) : true)
            .sort((a, b) => {
              if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
              return (a.order || 0) - (b.order || 0);
            });
          return (
            <>
              <SortableContext items={list.map(s => s.id)} strategy={rectSortingStrategy}>
                {/* Mobile: compact rows */}
                <div className="sm:hidden">
                  <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800 overflow-hidden">
                    {list.map(sound => (
                      <li key={sound.id} className="bg-neutral-800/40">
                        <button
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800/70 ${currentlyPlaying===sound.id?'ring-1 ring-[#4ECBD9]':''}`}
                          onClick={() => playOrRemote(sound.id)}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${currentlyPlaying===sound.id?'bg-[#4ECBD9]/20 text-[#4ECBD9]':'bg-[#4ECBD9]/10 text-[#4ECBD9]'}`}>
                            {currentlyPlaying===sound.id? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
                          </span>
                          <span className="flex-1 truncate text-[#C1C2C5]">{sound.name}</span>
                          <span className="text-[10px] text-[#909296]">{formatDuration(sound.duration)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Desktop/tablet: card grid */}
                <div className="hidden sm:grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {list.map((sound) => (
                    <SortableCard
                      key={sound.id}
                      id={sound.id}
                      sound={sound}
                      isActive={currentlyPlaying === sound.id}
                      categories={categories}
                      colorFor={colorFor}
                      currentTimeSeconds={currentTimeSeconds}
                      onPlay={() => playOrRemote(sound.id)}
                      onToggleFavorite={() => toggleFavorite(sound.id)}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeId ? (
                  (() => {
                    const s = sounds.find(x => x.id === activeId);
                    if (!s) return null;
                    return (
                      <CardContent
                        sound={s}
                        isActive={currentlyPlaying === s.id}
                        categories={categories}
                        colorFor={colorFor}
                        onPlay={() => {}}
                        onToggleFavorite={() => {}}
                        currentTimeSeconds={currentTimeSeconds}
                      />
                    );
                  })()
                ) : null}
              </DragOverlay>
            </>
          );
        })()}
      </DndContext>

    <CategoryManagerModal open={catOpen} onClose={() => setCatOpen(false)} />
    </>
  );
}

// --- Sortable Card ---
type CardProps = {
  id: string;
  sound: Sound;
  isActive: boolean;
  categories: { id: string; name: string }[];
  colorFor: (key: string | undefined) => string;
  currentTimeSeconds: number;
  onPlay: () => void;
  onToggleFavorite: () => void;
};

const SortableCard: React.FC<CardProps> = ({ id, ...rest }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardContent {...rest} />
    </div>
  );
};

const CardContent: React.FC<Omit<CardProps, 'id'>> = ({ sound, isActive, categories, colorFor, onPlay, onToggleFavorite, currentTimeSeconds }) => {
  return (
    <div
      onClick={onPlay}
      className={`cursor-pointer bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-all shadow-lg touch-manipulation ${
      isActive ? 'ring-1 ring-[#4ECBD9] shadow-[#4ECBD9]/10' : ''
    }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title={sound.isFavorite ? 'Favorit entfernen' : 'Zu Favoriten hinzufügen'}
            >
              <Star 
                className={`h-4 w-4 ${
                  sound.isFavorite 
                    ? 'fill-[#F471B5] text-[#F471B5]' 
                    : 'text-[#909296] hover:text-[#C1C2C5]'
                }`} 
              />
            </button>
          </div>
          <div className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-grab active:cursor-grabbing" onClick={(e)=>e.stopPropagation()}>
            <GripHorizontal className="h-4 w-4 text-[#909296]" />
          </div>
        </div>
        {/* Centered play with circular progress */}
        <div className="flex items-center justify-center my-2">
          <div className="relative w-16 h-16">
            {(() => {
              const radius = 16; // SVG radius
              const circumference = 2 * Math.PI * radius;
              const progress = (isActive && sound.duration > 0) ? Math.min(1, Math.max(0, currentTimeSeconds / sound.duration)) : 0;
              const dash = circumference * progress;
              const rest = circumference - dash;
              return (
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r={radius} fill="none" stroke="#3f3f46" strokeWidth="4" />
                  <circle cx="20" cy="20" r={radius} fill="none" stroke="#4ECBD9" strokeWidth="4" strokeDasharray={`${dash} ${rest}`} strokeLinecap="round" />
                </svg>
              );
            })()}
            <button
              onClick={(e)=>e.preventDefault()}
              className={`pointer-events-none absolute inset-0 m-auto w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                isActive ? 'bg-[#4ECBD9]/20 text-[#4ECBD9]' : 'bg-[#4ECBD9]/10 text-[#4ECBD9] hover:bg-[#4ECBD9]/20'
              }`}
              aria-label={isActive ? 'Pause' : 'Abspielen'}
            >
              {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          </div>
        </div>

            {/* Bottom info: title/category/duration */}
            <div className="pt-3">
              <h3 className="text-sm font-medium text-[#C1C2C5] truncate">
                {sound.name}
              </h3>
              {/* Fixed-height category row to keep all cards equal height */}
              <div className="text-[10px] text-[#909296] mt-0.5 h-4 flex items-center gap-1.5">
                {sound.categoryId ? (
                  <>
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: colorFor(sound.categoryId) }}
                    />
                    <span>
                      {categories.find(c => c.id === sound.categoryId)?.name}
                    </span>
                  </>
                ) : (
                  // placeholder to reserve height when no category is set
                  <span className="inline-block w-2 h-2 rounded-full opacity-0" />
                )}
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <Clock className="h-3 w-3 text-[#909296]" />
                <p className="text-xs text-[#909296]">
                  {formatDuration(sound.duration)}
                </p>
              </div>
            </div>
          </div>
      </div>
  );
};

export default SoundboardView;
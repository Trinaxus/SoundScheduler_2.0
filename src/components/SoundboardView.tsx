import React, { useState, useEffect } from 'react';
import { GripHorizontal, Star, Clock, Play, Pause, Music, Settings, StopCircle } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSounds } from '../context/SoundContext';
import { Sound } from '../types';
import { formatDuration } from '../utils/helpers';
// Cover removed: no API_BASE required
import CategoryManagerModal from './CategoryManagerModal';

const SoundboardView: React.FC = () => {
  const { 
    sounds: originalSounds, 
    playSound,
    pauseSound,
    currentlyPlaying,
    categories,
    toggleFavorite,
    toggleHiddenCategory,
    updateSoundOrder,
    currentTimeSeconds,
  } = useSounds();
  
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [filterCat, setFilterCat] = useState<string>('');
  // no hover index needed with dnd-kit overlay/strategy
  const [catOpen, setCatOpen] = useState<boolean>(false);
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

  return (
    <>
      {/* Filter & Settings */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-wrap gap-2">
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
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(c.id || c.name) }} />
                {c.name}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setCatOpen(true)}
          className="p-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700/50"
          title="Kategorien verwalten"
        >
          <Settings className="w-4 h-4" />
        </button>
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

          // Alle-Ansicht: gruppiert nach Kategorien
          if (!filterCat) {
            const visible = sounds.filter(s => (!hiddenCatId) ? true : s.categoryId !== hiddenCatId);

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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {sec.items.map(sound => (
                            <SortableCard
                              key={sound.id}
                              id={sound.id}
                              sound={sound}
                              isActive={currentlyPlaying === sound.id}
                              categories={categories}
                              colorFor={colorFor}
                              currentTimeSeconds={currentTimeSeconds}
                              onPlay={() => { if (currentlyPlaying === sound.id) pauseSound(); else playSound(sound.id); }}
                              onToggleFavorite={() => toggleFavorite(sound.id)}
                              onToggleHidden={() => toggleHiddenCategory(sound.id)}
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
                          onToggleHidden={() => {}}
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
          const list = sounds
            .filter(s => !filterCat || s.categoryId === filterCat)
            .filter(s => (!filterCat && hiddenCatId) ? s.categoryId !== hiddenCatId : true)
            .sort((a, b) => {
              if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
              return (a.order || 0) - (b.order || 0);
            });
          return (
            <>
              <SortableContext items={list.map(s => s.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {list.map((sound) => (
                    <SortableCard
                      key={sound.id}
                      id={sound.id}
                      sound={sound}
                      isActive={currentlyPlaying === sound.id}
                      categories={categories}
                      colorFor={colorFor}
                      currentTimeSeconds={currentTimeSeconds}
                      onPlay={() => { if (currentlyPlaying === sound.id) pauseSound(); else playSound(sound.id); }}
                      onToggleFavorite={() => toggleFavorite(sound.id)}
                      onToggleHidden={() => toggleHiddenCategory(sound.id)}
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
                        onToggleHidden={() => {}}
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
  onToggleHidden: () => void;
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

const CardContent: React.FC<Omit<CardProps, 'id'>> = ({ sound, isActive, categories, colorFor, onPlay, onToggleFavorite, onToggleHidden, currentTimeSeconds }) => {
  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden hover:bg-white/20 transition-all shadow-lg touch-manipulation ${
      isActive ? 'ring-1 ring-[#4ECBD9] shadow-[#4ECBD9]/10' : ''
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleFavorite}
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
            <button
              onClick={onToggleHidden}
              className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
              title={sound.categoryId && (categories.find(c=>c.id===sound.categoryId)?.name?.toLowerCase()==='ausgeblendet') ? 'Aus "Ausgeblendet" entfernen' : 'In "Ausgeblendet" verschieben'}
            >
              <StopCircle
                className={`h-4 w-4 ${
                  (sound.categoryId && (categories.find(c=>c.id===sound.categoryId)?.name?.toLowerCase()==='ausgeblendet'))
                    ? 'text-[#F87171]'
                    : 'text-[#909296] hover:text-[#C1C2C5]'
                }`}
              />
            </button>
          </div>
          <div className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-grab active:cursor-grabbing">
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
              onClick={onPlay}
              className={`absolute inset-0 m-auto w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
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
import React, { useState } from 'react';
import { Plus, Trash, Save, X, Clock, Edit2 } from 'lucide-react';
import { Schedule } from '../types';
import { useSounds } from '../context/SoundContext';
import { formatTime } from '../utils/helpers';

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

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent form submission
    if (newTime && !isSubmitting) {
      try {
        setIsSubmitting(true);
        await addSchedule(soundId, newTime + ':00'); // Add seconds
        setNewTime('');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateSchedule = async (scheduleId: string, time: string, active: boolean) => {
    if (!isSubmitting) {
      try {
        setIsSubmitting(true);
        await updateSchedule(soundId, scheduleId, time + ':00', active); // Add seconds
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
      
      {schedules.length > 0 ? (
        <ul className="space-y-2">
          {schedules.map(schedule => (
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
                  onClick={() => deleteSchedule(soundId, schedule.id)}
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
            No schedules yet. Add your first one above.
          </p>
        </div>
      )}
    </div>
  );
};

export default ScheduleEditor;
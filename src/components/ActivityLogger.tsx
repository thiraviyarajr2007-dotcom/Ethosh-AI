import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, X, Monitor, Moon, Dumbbell, BookOpen, Droplets, Brain, MoreHorizontal, Salad, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, detectAlerts } from '../lib/utils';
import { analyzeHabits } from '../services/gemini';
import { getHabitAnalytics } from '../services/analyticsService';
import { predictHabitRisk } from '../services/predictionService';
import { Habit, DailyLog } from '../types/habit';

const ACTIVITY_TYPES = [
  { id: 'screen_time', label: 'Screen Time', icon: Monitor, defaultUnit: 'mins', color: 'text-blue-400 bg-blue-400/10' },
  { id: 'sleep', label: 'Sleep', icon: Moon, defaultUnit: 'hours', color: 'text-indigo-400 bg-indigo-400/10' },
  { id: 'exercise', label: 'Exercise', icon: Dumbbell, defaultUnit: 'mins', color: 'text-green-400 bg-green-400/10' },
  { id: 'reading', label: 'Reading', icon: BookOpen, defaultUnit: 'pages', color: 'text-amber-400 bg-amber-400/10' },
  { id: 'water', label: 'Water', icon: Droplets, defaultUnit: 'ml', color: 'text-cyan-400 bg-cyan-400/10' },
  { id: 'meditation', label: 'Meditation', icon: Brain, defaultUnit: 'mins', color: 'text-purple-400 bg-purple-400/10' },
  { id: 'nutrition', label: 'Nutrition', icon: Salad, defaultUnit: 'calories', color: 'text-rose-400 bg-rose-400/10' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, defaultUnit: 'units', color: 'text-gray-400 bg-gray-400/10' },
];

export default function ActivityLogger() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedType, setSelectedType] = useState(ACTIVITY_TYPES[0]);
  const [customLabel, setCustomLabel] = useState('');
  const [unit, setUnit] = useState(ACTIVITY_TYPES[0].defaultUnit);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const fetchHabits = async () => {
      if (!auth.currentUser) return;
      try {
        const habitsSnap = await getDocs(collection(db, 'users', auth.currentUser.uid, 'habits'));
        setHabits(habitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Habit)));
      } catch (error) {
        console.error("Error fetching habits in logger:", error);
      }
    };
    if (isOpen) fetchHabits();
  }, [isOpen]);

  const handleTypeSelect = (type: typeof ACTIVITY_TYPES[0]) => {
    setSelectedType(type);
    setUnit(type.defaultUnit);
    if (type.id !== 'other') {
      setCustomLabel('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const timestamp = serverTimestamp();
      const activityData = {
        userId: auth.currentUser.uid,
        type: selectedType.id === 'other' ? (customLabel || 'other') : selectedType.id,
        label: selectedType.id === 'other' ? customLabel : selectedType.label,
        value: Number(value),
        unit: unit,
        note,
        timestamp,
      };

      // 1. Save general activity log
      await addDoc(collection(db, 'activities'), activityData);

      // 2. Check if this activity corresponds to a tracked habit
      const matchingHabit = habits.find(h => h.category === selectedType.id);
      if (matchingHabit) {
        const dateId = new Date().toISOString().split('T')[0];
        const logId = `${dateId}_${matchingHabit.id}`;
        const logRef = doc(db, 'users', auth.currentUser.uid, 'dailyLogs', logId);
        
        // Cumulative update for some types (like water), or overwrite for others (like sleep/weight)
        // For simplicity, we'll overwrite or you can fetch existing and add.
        // Let's go with additive for water/exercise, overwrite for sleep.
        await setDoc(logRef, {
          userId: auth.currentUser.uid,
          habitId: matchingHabit.id,
          value: Number(value),
          unit: unit,
          timestamp,
          id: dateId,
          note
        }, { merge: true });

        // 3. Trigger Alert Check (Local check for immediate feedback loop)
        // In a real app, this might happen via Cloud Function
        const todayLogsSnap = await getDocs(query(collection(db, 'users', auth.currentUser.uid, 'dailyLogs')));
        const allLogs = todayLogsSnap.docs.map(d => d.data() as DailyLog);
        const alerts = detectAlerts(habits, allLogs);
        
        for (const alertData of alerts) {
          await addDoc(collection(db, 'users', auth.currentUser.uid, 'alerts'), {
            ...alertData,
            userId: auth.currentUser.uid,
            timestamp: serverTimestamp(),
            read: false
          });
        }
      }

      // AI Analysis Trigger
      let recentActivities: any[] = [];
      try {
        const activitiesSnap = await getDocs(
          query(
            collection(db, 'activities'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('timestamp', 'desc'),
            limit(20)
          )
        );

        recentActivities = activitiesSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
      } catch (err) {
        console.warn("Failed to fetch recent activities for AI analysis:", err);
      }

      if (recentActivities.length > 0) {
        try {
          const todayLogsSnap = await getDocs(query(collection(db, 'users', auth.currentUser.uid, 'dailyLogs')));
          const allLogs = todayLogsSnap.docs.map(d => d.data() as DailyLog);
          const currentAlertsSnap = await getDocs(query(collection(db, 'users', auth.currentUser.uid, 'alerts')));
          const currentAlerts = currentAlertsSnap.docs.map(d => d.data() as any);

          // Run analysis with ML context simulation
          const analyticsData = await getHabitAnalytics(auth.currentUser.uid, habits);
          const mockPredictions = habits.map(h => predictHabitRisk(h, allLogs.filter(l => l.habitId === h.id)));
          
          const insight = await analyzeHabits(auth.currentUser.uid, habits, analyticsData, mockPredictions as any);
          await addDoc(collection(db, 'insights'), {
            userId: auth.currentUser.uid,
            pattern: insight.pattern,
            summary: insight.summary,
            suggestions: insight.suggestions,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("AI Insights Error:", err);
        }
      }

      setIsOpen(false);
      setValue('');
      setNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'activities');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-accent text-bg-main p-4 rounded-xl shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 group border border-accent/20"
        id="open-logger-btn"
      >
        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-bg-main/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-bg-card rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden border border-border-main"
            >
              <div className="p-5 border-b border-border-main flex justify-between items-center bg-bg-hover">
                <h2 className="text-sm font-bold uppercase tracking-widest text-text-main">Log behavioral node</h2>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)} 
                  className="p-1 hover:bg-bg-card rounded transition-colors text-text-muted hover:text-text-main"
                  id="close-logger-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ACTIVITY_TYPES.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleTypeSelect(act)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center group/btn",
                        selectedType.id === act.id 
                          ? "border-accent bg-accent/5 ring-1 ring-accent/20" 
                          : "border-border-main hover:border-text-muted/30 bg-bg-hover"
                      )}
                    >
                      <act.icon className={cn("w-5 h-5 transition-transform group-hover/btn:scale-110", act.color.split(' ')[0])} />
                      <span className="text-[10px] font-bold uppercase tracking-tight text-text-muted truncate w-full px-1">{act.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {selectedType.id === 'other' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                          Activity Name
                        </label>
                        <input
                          required
                          type="text"
                          value={customLabel}
                          onChange={(e) => setCustomLabel(e.target.value)}
                          placeholder="e.g., Deep Work"
                          className="w-full bg-bg-hover border border-border-main rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent transition-all text-xs text-text-main placeholder:text-text-muted/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                          Unit Name
                        </label>
                        <input
                          required
                          type="text"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          placeholder="e.g., sessions"
                          className="w-full bg-bg-hover border border-border-main rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent transition-all text-xs text-text-main placeholder:text-text-muted/20"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      Metric ({unit})
                    </label>
                    <input
                      required
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={`0.00`}
                      className="w-full bg-bg-hover border border-border-main rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent transition-all text-lg font-mono text-text-main placeholder:text-text-muted/20"
                      id="activity-value-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                      Terminal Output / Notes
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Observation logs..."
                      className="w-full bg-bg-hover border border-border-main rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent transition-all min-h-[80px] text-xs text-text-main placeholder:text-text-muted/20"
                      id="activity-note-input"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full bg-accent text-bg-main py-3 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  id="submit-activity-btn"
                >
                  {loading ? "Transmitting..." : "Initialize Log"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as UserIcon, Save, Plus, X, Loader2, CheckCircle2, Award, Zap, Brain, Sparkles, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { usePredictions } from '../services/predictionService';
import { getHabitAnalytics } from '../services/analyticsService';
import { computeWellnessScore, getWellnessGrade } from '../services/wellnessService';
import { HabitAnalytics, PredictionResult } from '../types/analytics';
import { Habit } from '../types/habit';
import { onSnapshot, collection } from 'firebase/firestore';

const TECHNICAL_GOAL_SUGGESTIONS = [
  "Improve daily sleep schedule",
  "Drink more water throughout the day",
  "Reduce phone use before bed",
  "Regular morning exercise",
  "Daily reading or learning",
  "Practice mindfulness daily",
  "Eat healthier meals",
  "Take better work breaks",
  "Build a consistent routine",
  "Maintain regular habits"
];

export default function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [priorities, setPriorities] = useState<Record<string, 'high' | 'medium' | 'low'>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [wellnessScore, setWellnessScore] = useState(0);

  const predictions = usePredictions(user?.uid || '');

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to habits to calculate wellness
    const habRef = collection(db, 'users', user.uid, 'habits');
    const unsub = onSnapshot(habRef, async (snap) => {
      const habitsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Habit));
      setHabits(habitsData);
      
      const analyticsData = await getHabitAnalytics(user.uid, habitsData);
      const score = computeWellnessScore(analyticsData, predictions, priorities);
      setWellnessScore(score);
    });

    return unsub;
  }, [user, predictions, priorities]);

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && active) {
          const data = docSnap.data();
          setName(data.name || user.displayName || '');
          setGoals(data.goals || []);
          setPriorities(data.priorities || {});
        } else if (active) {
          setName(user.displayName || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchProfile();
    return () => { active = false; };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const docRef = doc(db, 'users', user.uid);
      
      // Update Firestore first
      await setDoc(docRef, {
        name,
        goals,
        priorities,
      }, { merge: true });

      // Update Auth Profile
      await updateProfile(user, { displayName: name });
      
      // Force refresh the reactive user state in context
      // This will trigger re-renders in all components using useAuth()
      await refreshUser();

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const addGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGoal.trim() && !goals.includes(newGoal.trim())) {
      setGoals([...goals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const removeGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const updatePriority = (habitId: string, priority: 'high' | 'medium' | 'low') => {
    setPriorities(prev => ({ ...prev, [habitId]: priority }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Profile Settings</h1>
        <p className="text-sm text-text-muted">Manage your identity and daily goals.</p>
      </header>

      <div className="data-card space-y-8">
        {/* Wellness Stats */}
        <section className="bg-accent/5 border border-accent/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-24 h-24 text-accent" />
          </div>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full border-4 border-accent border-r-transparent flex items-center justify-center animate-[spin_10s_linear_infinite]">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center animate-[spin_15s_linear_infinite_reverse]">
                <Award className="w-8 h-8 text-accent shrink-0" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Current Wellness Score</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-text-main tracking-tighter">{wellnessScore}</span>
                <span className={cn("text-sm font-bold uppercase", getWellnessGrade(wellnessScore).color)}>
                  {getWellnessGrade(wellnessScore).label}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-2 max-w-sm">
                Your score is calculated based on habit completion, weight priorities, and behavioral risk scores.
              </p>
            </div>
          </div>
        </section>

        {/* Profile Info */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Personal Information</h3>
          <div className="flex items-center gap-6 p-4 bg-bg-hover rounded-xl border border-border-main">
            <div className="relative group">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={name} className="w-16 h-16 rounded-2xl border border-border-main" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-bg-card flex items-center justify-center border border-border-main">
                  <UserIcon className="w-8 h-8 text-text-muted" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">Display Name</label>
              <input
                type="text"
                id="profile-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b border-border-main focus:border-accent focus:outline-none py-1 text-lg font-bold text-text-main transition-colors placeholder:opacity-30 tracking-tight"
                placeholder="Connection Name"
              />
            </div>
          </div>
        </section>

        {/* Goals Management */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">My Objectives</h3>
          <div className="space-y-4">
            <form onSubmit={addGoal} className="flex gap-2">
              <input
                type="text"
                id="goals-input"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="What is your focus?..."
                className="flex-1 bg-bg-hover border border-border-main rounded-xl px-4 py-2.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-sm"
              />
              <button
                type="submit"
                className="bg-accent text-bg-main p-2.5 rounded-xl hover:bg-accent/90 transition-all active:scale-95 shadow-md shadow-accent/10"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-3 h-3 text-accent" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Suggested Parameters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {TECHNICAL_GOAL_SUGGESTIONS.filter(s => !goals.includes(s)).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setGoals([...goals, suggestion])}
                    className="text-[9px] font-bold uppercase tracking-wider text-accent border border-accent/20 bg-accent/5 px-3 py-1.5 rounded-lg hover:border-accent/40 hover:bg-accent/10 transition-all active:scale-95 hover:-translate-y-0.5"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              {goals.map((goal, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-bg-hover rounded-xl border border-border-main group gap-3">
                  <span className="text-sm font-medium text-text-main flex-1 truncate">{goal}</span>
                  <button
                    type="button"
                    onClick={() => removeGoal(idx)}
                    className="p-1 text-text-muted hover:text-error shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {goals.length === 0 && (
                <div className="text-center py-8 border border-dashed border-border-main rounded-xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-40">No goals established</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Habit Priorities */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Habit Priority</h3>
          <p className="text-[10px] text-text-muted italic px-1">Define which habits have the highest impact on your daily wellness.</p>
          <div className="grid gap-2">
            {habits.map(habit => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-bg-hover rounded-xl border border-border-main">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="text-sm font-bold text-text-main capitalize">{habit.name}</span>
                </div>
                <div className="flex gap-1 bg-bg-card p-1 rounded-lg border border-border-main">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updatePriority(habit.id, p)}
                      className={cn(
                        "px-2 py-1 rounded text-[9px] font-bold uppercase transition-all",
                        priorities[habit.id] === p ? "bg-accent text-bg-main" : "text-text-muted hover:text-text-main"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {habits.length === 0 && (
              <div className="text-center py-8 border border-dashed border-border-main rounded-xl">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-40">No habits registered</p>
              </div>
            )}
          </div>
        </section>

        {/* Action Bar */}
        <div className="pt-4 border-t border-border-main flex justify-end items-center gap-4">
          {saved && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-accent text-xs font-bold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Profile Updated
            </motion.div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-text-main text-bg-main px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50 active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

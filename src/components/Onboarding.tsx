import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Monitor, Moon, Dumbbell, BookOpen, 
  Droplets, Brain, Salad, ChevronRight, Check,
  ArrowLeft
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Habit } from '../types/habit';
import { handleFirestoreError, OperationType } from '../lib/firebase';

const PRESET_HABITS = [
  { id: 'screen', name: 'Digital Detox', category: 'screen_time', goalValue: 120, unit: 'mins', isNegative: true, icon: Monitor, color: 'text-blue-400' },
  { id: 'sleep', name: 'Optimized Recovery', category: 'sleep', goalValue: 8, unit: 'hours', isNegative: false, icon: Moon, color: 'text-indigo-400' },
  { id: 'water', name: 'Daily Hydration', category: 'water', goalValue: 2500, unit: 'ml', isNegative: false, icon: Droplets, color: 'text-cyan-400' },
  { id: 'exercise', name: 'Physical Activity', category: 'exercise', goalValue: 45, unit: 'mins', isNegative: false, icon: Dumbbell, color: 'text-green-400' },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleHabit = (id: string) => {
    setSelectedHabits(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    
    try {
      // Save habits to user's habits subcollection
      const habitsPath = `users/${auth.currentUser.uid}/habits`;
      const habitsRef = collection(db, habitsPath);
      const selectedPresets = PRESET_HABITS.filter(h => selectedHabits.includes(h.id));
      
      for (const preset of selectedPresets) {
        try {
          await addDoc(habitsRef, {
            userId: auth.currentUser.uid,
            name: preset.name,
            category: preset.category,
            goalValue: preset.goalValue,
            goalUnit: preset.unit,
            isNegative: preset.isNegative,
            active: true,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, habitsPath);
        }
      }

      // Mark user as onboarded
      const userPath = `users/${auth.currentUser.uid}`;
      const userRef = doc(db, userPath);
      const { setDoc } = await import('firebase/firestore');
      try {
        await setDoc(userRef, {
          onboarded: true
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, userPath);
      }

      onComplete();
    } catch (error) {
      console.error("Onboarding saving error:", error);
      // If it's a JSON error from handleFirestoreError, we can see the details in console
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 select-none">
      <div className="max-w-xl w-full">
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center space-y-8"
            >
              <div className="flex justify-center">
                <div className="bg-bg-card p-4 rounded-2xl border border-border-main shadow-2xl">
                  <Sparkles className="w-10 h-10 text-accent animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tighter text-text-main">
                  WELCOME TO <span className="text-accent underline underline-offset-8 decoration-accent/30 font-mono">HABIT WELLNESS</span>
                </h1>
                <p className="text-sm text-text-muted leading-relaxed max-w-[80%] mx-auto">
                  Let's set up your focus areas. Select the daily habits you wish to improve.
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-3 bg-text-main text-bg-main py-4 px-6 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-accent transition-all shadow-xl active:scale-95 group"
              >
                Start My Plan
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Standard Habits</h2>
                  <p className="text-xs text-text-muted">Select at least one to continue</p>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PRESET_HABITS.map((habit) => {
                  const isSelected = selectedHabits.includes(habit.id);
                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        "p-5 rounded-2xl border transition-all text-left group relative overflow-hidden",
                        isSelected 
                          ? "bg-accent/5 border-accent ring-1 ring-accent/20" 
                          : "bg-bg-card border-border-main hover:border-text-muted/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <habit.icon className={cn("w-6 h-6", isSelected ? "text-accent" : habit.color)} />
                        {isSelected && (
                          <div className="bg-accent text-bg-main p-1 rounded-full">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-bold text-text-main mb-1">{habit.name}</h3>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">
                        Target: {habit.isNegative ? 'under' : 'at least'} {habit.goalValue} {habit.unit}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <button
                  disabled={selectedHabits.length === 0 || saving}
                  onClick={handleFinish}
                  className="w-full flex items-center justify-center gap-3 bg-accent text-bg-main py-4 px-6 rounded-xl font-bold uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Saving your setup..." : "Go to Dashboard"}
                </button>
                <p className="text-[9px] text-center mt-4 uppercase tracking-[0.2em] font-bold text-text-muted/40">
                  You can add more custom habits later in settings.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DailyLog, Habit } from '../types/habit';
import { PredictionResult } from '../types/analytics';
import { useState, useEffect } from 'react';

/**
 * Behavior Prediction Model (Lite)
 * Simulates a Random Forest classifier by analyzing 14-day completion sequences.
 */
export function predictHabitRisk(habit: Habit, logs: DailyLog[]): Omit<PredictionResult, 'generatedAt'> {
  const sortedLogs = [...logs].sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime()).slice(-14);
  
  if (sortedLogs.length < 3) {
    return {
      habitId: habit.id,
      riskScore: 0.2,
      trendLabel: 'good'
    };
  }

  // Feature 1: Completion consistency
  const successes = sortedLogs.filter(l => {
    return habit.isNegative ? l.value <= habit.goalValue : l.value >= habit.goalValue;
  }).length;
  const completionRatio = successes / sortedLogs.length;

  // Feature 2: Recency weighting (recent failures hurt more)
  const recentLogs = sortedLogs.slice(-5);
  const recentSuccesses = recentLogs.filter(l => {
    return habit.isNegative ? l.value <= habit.goalValue : l.value >= habit.goalValue;
  }).length;
  const recentRatio = recentSuccesses / (recentLogs.length || 1);

  // Feature 3: Variance (instability)
  const average = sortedLogs.reduce((acc, curr) => acc + curr.value, 0) / sortedLogs.length;
  const variance = sortedLogs.reduce((acc, curr) => acc + Math.pow(curr.value - average, 2), 0) / sortedLogs.length;

  // Calculate Risk Score (0-1)
  // Higher completion = lower risk
  // Higher recency failure = higher risk
  let riskScore = (1 - completionRatio) * 0.4 + (1 - recentRatio) * 0.5 + Math.min(0.1, (variance / (average || 1)) * 0.1);
  
  // Normalize
  riskScore = Math.max(0, Math.min(1, riskScore));

  let trendLabel: 'good' | 'at_risk' | 'declining' = 'good';
  if (riskScore > 0.6) trendLabel = 'declining';
  else if (riskScore > 0.3) trendLabel = 'at_risk';

  return {
    habitId: habit.id,
    riskScore: Math.round(riskScore * 100) / 100,
    trendLabel
  };
}

export async function savePrediction(uid: string, result: Omit<PredictionResult, 'generatedAt'>) {
  const predRef = doc(db, 'users', uid, 'predictions', result.habitId);
  await setDoc(predRef, {
    ...result,
    generatedAt: new Date()
  });
}

export function usePredictions(uid: string) {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);

  useEffect(() => {
    if (!uid) return;
    const ref = collection(db, 'users', uid, 'predictions');
    const unsub = onSnapshot(ref, (snap) => {
      setPredictions(snap.docs.map(d => ({ 
        ...d.data(), 
        generatedAt: d.data().generatedAt?.toDate() || new Date() 
      } as PredictionResult)));
    });
    return unsub;
  }, [uid]);

  return predictions;
}

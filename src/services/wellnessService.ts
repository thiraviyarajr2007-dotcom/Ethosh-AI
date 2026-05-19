import { HabitAnalytics, PredictionResult } from '../types/analytics';

const WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
};

export function computeWellnessScore(
  analytics: HabitAnalytics[],
  predictions: PredictionResult[],
  habitPriorities?: Record<string, 'high' | 'medium' | 'low'>
): number {
  if (analytics.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  analytics.forEach(a => {
    const pred = predictions.find(p => p.habitId === a.habitId);
    const risk = pred?.riskScore ?? 0;
    
    // Default to medium priority if not set
    const priority = habitPriorities?.[a.habitId] || 'medium';
    const weight = WEIGHTS[priority];

    // Score combines completion rate and risk mitigation
    // If completion is high and risk is low, score is high
    const habitScore = a.completionRate * (1 - (risk * 0.6));
    
    weightedSum += habitScore * weight;
    totalWeight += weight;
  });

  const finalScore = (weightedSum / (totalWeight || 1)) * 100;
  return Math.round(Math.max(0, Math.min(100, finalScore)));
}

export function getWellnessGrade(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Optimal', color: 'text-emerald-400' };
  if (score >= 75) return { label: 'Healthy', color: 'text-blue-400' };
  if (score >= 60) return { label: 'Stable', color: 'text-amber-400' };
  if (score >= 40) return { label: 'At Risk', color: 'text-orange-400' };
  return { label: 'Critical', color: 'text-rose-400' };
}

export interface HabitAnalytics {
  habitId: string;
  habitName: string;
  completionRate: number;     // 0–1 over last 30 days
  streak: number;             // consecutive days completed
  weeklyAvg: number;          // avg value this week
  trend: 'improving' | 'declining' | 'stable';
  negativePattern: boolean;   // worsening negative habit
}

export interface PredictionResult {
  habitId: string;
  riskScore: number;          // 0-1
  trendLabel: 'good' | 'at_risk' | 'declining';
  generatedAt: Date;
}

export interface WellnessScore {
  score: number;
  trend: number; // change from previous
  lastUpdated: Date;
}

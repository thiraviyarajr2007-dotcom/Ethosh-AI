export interface Habit {
  id: string;
  userId: string;
  name: string;
  category: 'screen_time' | 'sleep' | 'exercise' | 'reading' | 'water' | 'meditation' | 'nutrition' | 'other';
  goalValue: number;
  goalUnit: string;
  isNegative: boolean; // true if the goal is to keep it BELOW the value
  active: boolean;
  createdAt: any;
}

export interface DailyLog {
  id: string; // date string e.g. "2026-05-10"
  userId: string;
  habitId: string;
  value: number;
  unit: string;
  timestamp: any;
  note?: string;
}

export interface UserAlert {
  id: string;
  userId: string;
  habitId: string;
  type: 'threshold_exceeded' | 'consistency_drop' | 'custom';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: any;
  read: boolean;
}

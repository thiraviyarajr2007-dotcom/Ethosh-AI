import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Habit, DailyLog, UserAlert } from "../types/habit";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function detectAlerts(habits: Habit[], logs: DailyLog[]): Omit<UserAlert, 'id' | 'userId' | 'timestamp' | 'read'>[] {
  const alerts: Omit<UserAlert, 'id' | 'userId' | 'timestamp' | 'read'>[] = [];

  habits.forEach(habit => {
    const habitLogs = logs.filter(l => l.habitId === habit.id);
    if (habitLogs.length === 0) return;

    // Get latest log
    const latestLog = habitLogs.sort((a, b) => b.id.localeCompare(a.id))[0];

    if (habit.isNegative) {
      if (latestLog.value > habit.goalValue) {
        alerts.push({
          habitId: habit.id,
          type: 'threshold_exceeded',
          message: `Behavioral threshold exceeded for ${habit.name}. Recorded ${latestLog.value}${habit.goalUnit} vs goal of ${habit.goalValue}${habit.goalUnit}.`,
          severity: latestLog.value > habit.goalValue * 1.5 ? 'high' : 'medium'
        });
      }
    } else {
      if (latestLog.value < habit.goalValue * 0.7) {
        alerts.push({
          habitId: habit.id,
          type: 'consistency_drop',
          message: `Consistency drop detected in ${habit.name}. Performing at ${Math.round((latestLog.value / habit.goalValue) * 100)}% of target protocol.`,
          severity: latestLog.value < habit.goalValue * 0.4 ? 'high' : 'medium'
        });
      }
    }
  });

  return alerts;
}

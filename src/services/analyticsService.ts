import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Habit, DailyLog } from '../types/habit';
import { HabitAnalytics } from '../types/analytics';

export async function getHabitAnalytics(uid: string, habits: Habit[]): Promise<HabitAnalytics[]> {
  const logsRef = collection(db, 'users', uid, 'dailyLogs');
  const snap = await getDocs(query(logsRef, orderBy('timestamp', 'desc'), limit(100)));
  const allLogs = snap.docs.map(d => ({ ...d.data(), id: d.id } as DailyLog));

  return habits.map(habit => {
    const logs = allLogs.filter(l => l.habitId === habit.id).sort((a, b) => 
      new Date(a.id).getTime() - new Date(b.id).getTime()
    );
    
    // Completion Rate (last 30 logs or days)
    const recentLogs = logs.slice(-30);
    const goalValue = habit.isNegative ? -habit.goalValue : habit.goalValue;
    
    const completedCount = recentLogs.filter(l => {
      if (habit.isNegative) return l.value <= habit.goalValue;
      return l.value >= habit.goalValue;
    }).length;
    
    const completionRate = recentLogs.length ? completedCount / recentLogs.length : 0;

    // Streak calculation
    let streak = 0;
    const sortedLogs = [...logs].reverse();
    for (const log of sortedLogs) {
      const isSuccess = habit.isNegative ? log.value <= habit.goalValue : log.value >= habit.goalValue;
      if (isSuccess) streak++;
      else break;
    }

    // Trend analysis (this week vs last week)
    const thisWeek = logs.slice(-7);
    const lastWeek = logs.slice(-14, -7);
    
    const thisWeekAvg = thisWeek.length ? thisWeek.reduce((acc, curr) => acc + curr.value, 0) / thisWeek.length : 0;
    const lastWeekAvg = lastWeek.length ? lastWeek.reduce((acc, curr) => acc + curr.value, 0) / lastWeek.length : 0;
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    const delta = thisWeekAvg - lastWeekAvg;
    const threshold = lastWeekAvg * 0.1; // 10% change for trend shift

    if (Math.abs(delta) > Math.max(threshold, 0.1)) {
      if (habit.isNegative) {
        trend = delta < 0 ? 'improving' : 'declining';
      } else {
        trend = delta > 0 ? 'improving' : 'declining';
      }
    }

    const negativePattern = habit.isNegative && delta > threshold && lastWeekAvg > 0;

    return {
      habitId: habit.id,
      habitName: habit.name,
      completionRate,
      streak,
      weeklyAvg: Math.round(thisWeekAvg * 10) / 10,
      trend,
      negativePattern
    };
  });
}

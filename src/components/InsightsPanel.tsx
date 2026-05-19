import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { analyzeHabits, HabitInsight } from '../services/gemini';
import { getHabitAnalytics } from '../services/analyticsService';
import { usePredictions, predictHabitRisk, savePrediction } from '../services/predictionService';
import { computeWellnessScore, getWellnessGrade } from '../services/wellnessService';
import { askHabitCoach } from '../services/coachService';
import { PatternChart } from './PatternChart';
import { HabitAnalytics, PredictionResult } from '../types/analytics';
import { 
  Brain, TrendingUp, TrendingDown, ArrowRight, Loader2, Sparkles, Download, 
  Monitor, Moon, Dumbbell, BookOpen, Droplets, MoreHorizontal, ChevronDown, ChevronUp,
  Check, BellRing, Lightbulb, ListCheck, Award, Zap, Activity, Clock, LayoutDashboard, BarChart3,
  MoonStar, GraduationCap, Laptop, Salad, Smartphone, Utensils
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Line, ComposedChart 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

const ACTIVITY_ICONS: Record<string, any> = {
  screen_time: Monitor,
  sleep: Moon,
  exercise: Dumbbell,
  reading: BookOpen,
  water: Droplets,
  meditation: Brain,
  nutrition: Salad,
  other: MoreHorizontal,
};

export default function InsightsPanel({ activeTab: externalTab, onTabChange }: { activeTab?: string, onTabChange?: (tab: any) => void }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [insights, setInsights] = useState<HabitInsight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analytics, setAnalytics] = useState<HabitAnalytics[]>([]);
  const [coachQuestion, setCoachQuestion] = useState('');
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [askingCoach, setAskingCoach] = useState(false);
  const [wellnessScore, setWellnessScore] = useState(78);
  const [localActiveTab, setLocalActiveTab] = useState<'overview' | 'patterns' | 'alerts' | 'suggestions' | 'streaks'>('overview');
  
  const predictions = usePredictions(auth.currentUser?.uid || '');

  const activeTab = externalTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchAnalytics = async () => {
      const analyticsData = await getHabitAnalytics(auth.currentUser!.uid, habits);
      setAnalytics(analyticsData);
      
      const score = computeWellnessScore(analyticsData, predictions);
      setWellnessScore(score);
    };

    if (habits.length > 0) {
      fetchAnalytics();
    }
  }, [habits, dailyLogs, predictions]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const qAct = query(
      collection(db, 'activities'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const qIns = query(
      collection(db, 'insights'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const qHab = collection(db, 'users', auth.currentUser.uid, 'habits');
    const qAlr = query(
      collection(db, 'users', auth.currentUser.uid, 'alerts'),
      where('read', '==', false)
    );
    const qLogs = query(
      collection(db, 'users', auth.currentUser.uid, 'dailyLogs'),
      where('id', '==', todayStr)
    );

    const unsubAct = onSnapshot(qAct, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivities(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activities'));

    const unsubIns = onSnapshot(qIns, (snap) => {
      if (!snap.empty) {
        setInsights({ id: snap.docs[0].id, ...snap.docs[0].data() } as any);
      } else {
        setInsights(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'insights'));

    const unsubHab = onSnapshot(qHab, (snap) => {
      setHabits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubAlr = onSnapshot(qAlr, (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setDailyLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubAct();
      unsubIns();
      unsubHab();
      unsubAlr();
      unsubLogs();
    };
  }, []);

  const exportToCSV = () => {
    if (activities.length === 0) return;
    const headers = ["Timestamp", "Type", "Value", "Unit", "Note"];
    const rows = activities.map(act => {
      const date = act.timestamp?.seconds 
        ? new Date(act.timestamp.seconds * 1000).toISOString() 
        : 'Pending';
      return [
        date,
        act.type,
        act.value,
        act.unit,
        `"${(act.note || "").replace(/"/g, '""')}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ethos_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyze = async () => {
    if (!auth.currentUser || habits.length === 0) return;
    setAnalyzing(true);
    try {
      for (const habit of habits) {
        predictHabitRisk(habit, dailyLogs.filter(l => l.habitId === habit.id) as any);
      }
      const result = await analyzeHabits(auth.currentUser.uid, habits, analytics, predictions);
      await addDoc(collection(db, 'insights'), {
        userId: auth.currentUser.uid,
        ...result,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'insights');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAskCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachQuestion.trim() || askingCoach) return;
    setAskingCoach(true);
    try {
      const res = await askHabitCoach(coachQuestion, analytics, predictions);
      setCoachResponse(res);
      setCoachQuestion('');
    } catch (err) {
      console.error(err);
    } finally {
      setAskingCoach(false);
    }
  };

  const calculateStreaks = (activities: any[]) => {
    const streaks: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups: Record<string, Date[]> = {};
    activities.forEach(act => {
      if (!act.timestamp) return;
      const date = new Date(act.timestamp.seconds * 1000);
      date.setHours(0, 0, 0, 0);
      if (!groups[act.type]) groups[act.type] = [];
      if (!groups[act.type].some(d => d.getTime() === date.getTime())) {
        groups[act.type].push(date);
      }
    });
    Object.entries(groups).forEach(([type, dates]) => {
      dates.sort((a, b) => b.getTime() - a.getTime());
      const latest = dates[0];
      const diffDays = Math.floor((today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        streaks[type] = 0;
        return;
      }
      let currentStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = dates[i - 1];
        const curr = dates[i];
        const gap = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (gap === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
      streaks[type] = currentStreak;
    });
    return streaks;
  };

  const getRecentHistoryLong = (activities: any[], type: string, daysCount: number = 14) => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeDates = new Set(
      activities
        .filter(act => act.type === type && act.timestamp)
        .map(act => {
          const d = new Date(act.timestamp.seconds * 1000);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
    );
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ 
        active: activeDates.has(d.getTime()),
        date: d
      });
    }
    return days;
  };

  const streaks = calculateStreaks(activities);
  const avgCompletionRate = analytics.length > 0 
    ? analytics.reduce((acc, curr) => acc + curr.completionRate, 0) / analytics.length 
    : 0.84; 

  const activeStreaksCount = Object.values(streaks).filter((s: any) => s > 0).length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'streaks', label: 'Streaks', icon: Award },
    { id: 'patterns', label: 'Daily Flow', icon: BarChart3 },
    { id: 'alerts', label: 'Wellness Checks', icon: BellRing, count: alerts.length },
    { id: 'suggestions', label: 'Personal Support', icon: Lightbulb },
  ] as const;

  const renderStreaks = () => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-text-main tracking-tight">Active Streaks</h3>
          <p className="text-sm text-text-muted">Visualizing your progress and consistency over time.</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-bg-card border border-border-main px-4 py-2 rounded-2xl">
            <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">Total Completion</div>
            <div className="text-xl font-bold text-accent">{Math.round(avgCompletionRate * 100)}%</div>
          </div>
          <div className="bg-bg-card border border-border-main px-4 py-2 rounded-2xl">
            <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1">Active Habits</div>
            <div className="text-xl font-bold text-text-main">{activeStreaksCount}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {habits.length === 0 && (
          <div className="data-card text-center py-12">
            <div className="w-12 h-12 bg-bg-hover rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-text-muted" />
            </div>
            <h4 className="text-sm font-bold text-text-main">No Habits Yet</h4>
            <p className="text-xs text-text-muted">Add some habits to start tracking your progress.</p>
          </div>
        )}
        {habits.map((habit) => {
          const type = habit.category;
          const count = streaks[type] || 0;
          const Icon = ACTIVITY_ICONS[type] || MoreHorizontal;
          const history = getRecentHistoryLong(activities, type, 21);
          const isHot = count >= 5;
          const milestone = count < 7 ? 7 : count < 21 ? 21 : count < 66 ? 66 : 100;
          const remaining = Math.max(0, milestone - count);
          const progress = Math.min((count / milestone) * 100, 100);
          
          return (
            <motion.div key={habit.id} className="data-card !p-0 overflow-hidden group hover:border-accent/20 transition-all">
              <div className="p-6 flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/3 xl:w-1/4 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500", 
                      isHot ? "bg-amber-dim text-amber border-amber/20 shadow-lg shadow-amber/5" : "bg-bg-hover text-text-muted border-border-main"
                    )}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-text-main uppercase tracking-tight">{habit.name}</h4>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", count > 0 ? "bg-accent animate-pulse" : "bg-border-main")} />
                        <span className={cn("text-[10px] font-bold uppercase tracking-widest", count > 0 ? "text-accent" : "text-text-muted")}>
                          {count > 0 ? "On Track" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-bg-hover/50 p-3 rounded-2xl border border-border-main/50">
                      <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Streak</div>
                      <div className="flex items-baseline gap-1">
                        <span className={cn("text-3xl font-black tracking-tighter", isHot ? "text-amber" : "text-text-main")}>{count}</span>
                        <span className="text-[10px] font-bold text-text-muted uppercase">Days</span>
                      </div>
                    </div>
                    <div className="bg-bg-hover/50 p-3 rounded-2xl border border-border-main/50">
                      <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Target</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black tracking-tighter text-text-main">{milestone}</span>
                        <span className="text-[10px] font-bold text-text-muted uppercase">Days</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-text-muted">Progression</span>
                      <span className="text-accent">{remaining} Days to Milestone</span>
                    </div>
                    <div className="h-2 bg-bg-hover rounded-full overflow-hidden border border-border-main/50 p-0.5">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${progress}%` }} 
                        className={cn("h-full rounded-full transition-all duration-1000", isHot ? "bg-amber shadow-[0_0_8px_rgba(245,158,11,0.3)]" : "bg-accent shadow-[0_0_8px_rgba(20,184,166,0.3)]")} 
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Recent Activity History (21 Days)
                    </h5>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-accent" /><span className="text-[9px] text-text-muted uppercase font-bold">In-Sync</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-bg-hover border border-border-main" /><span className="text-[9px] text-text-muted uppercase font-bold">Gap</span></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-7 sm:grid-cols-21 gap-2 p-4 bg-bg-hover/20 rounded-2xl border border-border-main/30">
                    {history.map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 group/day">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.01 }}
                          className={cn(
                            "aspect-square w-full sm:w-10 rounded-lg flex items-center justify-center transition-all duration-500 relative", 
                            day.active 
                              ? (isHot ? "bg-amber text-bg-main shadow-[0_0_15px_rgba(245,158,11,0.25)]" : "bg-accent text-bg-main shadow-[0_0_15px_rgba(20,184,166,0.25)]") 
                              : "bg-bg-hover/50 border border-border-main hover:border-text-muted/30 group-hover/day:scale-110"
                          )}
                          title={formatDate(day.date)}
                        >
                          {day.active && <Check className="w-4 h-4 stroke-[4]" />}
                          {i === history.length - 1 && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-text-main rounded-full animate-ping" />
                          )}
                        </motion.div>
                        <span className="text-[8px] font-black text-text-muted/40 uppercase group-hover/day:text-text-main transition-colors">
                          {day.date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    {isHot && (
                      <div className="bg-amber/10 border border-amber/20 px-3 py-1 rounded-full flex items-center gap-2">
                        <Zap className="w-3 h-3 text-amber fill-current" />
                        <span className="text-[9px] font-bold text-amber uppercase tracking-widest">Momentum High</span>
                      </div>
                    )}
                    {count >= 21 && (
                      <div className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-full flex items-center gap-2">
                        <Award className="w-3 h-3 text-accent" />
                        <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Growth Milestone</span>
                      </div>
                    )}
                    <div className="bg-bg-hover border border-border-main px-3 py-1 rounded-full flex items-center gap-2">
                      <TrendingUp className="w-3 h-3 text-text-muted" />
                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Consistency Score: {Math.round(progress)}.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  const renderOverview = () => {
    const wellnessGrade = getWellnessGrade(wellnessScore);
    return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Wellness Score" value={wellnessScore.toString()} change="+4" trend="up" color={wellnessGrade.color} subtext={wellnessGrade.label} />
        <MetricCard label="Habits Tracked" value={habits.length.toString()} change="" trend="up" />
        <MetricCard label="Active Alerts" value={alerts.length.toString()} change="" trend="down" color="text-coral" />
        <MetricCard label="Peak Streak" value={Math.max(...Object.values(streaks) as number[], 0).toString()} subtext="DAYS" color="text-amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 data-card !p-4">
          <div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2"><Activity className="w-3 h-3" /> Weekly Activity</h4><div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-dim text-purple text-[9px] font-bold uppercase"><Sparkles className="w-2.5 h-2.5" /> Highlights</div></div>
          <div className="h-[180px] w-full min-h-0 relative">
            <ResponsiveContainer width="100%" height={180} debounce={1}>
              <ComposedChart data={[
                { name: 'Mon', pos: 6, neg: 3, sleep: 7.0 }, { name: 'Tue', pos: 7, neg: 4, sleep: 7.5 }, { name: 'Wed', pos: 5, neg: 5, sleep: 6.8 }, { name: 'Thu', pos: 8, neg: 4, sleep: 8.0 }, { name: 'Fri', pos: 7, neg: 3, sleep: 7.8 }, { name: 'Sat', pos: 9, neg: 2, sleep: 8.5 }, { name: 'Sun', pos: 8, neg: 4, sleep: 7.2 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272A" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A1A1AA', fontSize: 10 }} />
                <YAxis hide domain={[0, 10]} />
                <Tooltip contentStyle={{ backgroundColor: '#121214', border: '1px solid #27272A', borderRadius: '8px' }} itemStyle={{ fontSize: '10px' }} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="pos" fill="#1D9E75" radius={[2, 2, 0, 0]} barSize={8} />
                <Bar dataKey="neg" fill="#D85A30" radius={[2, 2, 0, 0]} barSize={8} />
                <Line type="monotone" dataKey="sleep" stroke="#7F77DD" strokeWidth={2} dot={{ r: 2, fill: '#7F77DD' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2"><LegendItem color="bg-accent" label="Positive Habits" /><LegendItem color="bg-coral" label="Negative Habits" /><LegendItem color="bg-purple" label="Sleep Quality" /></div>
        </div>
        <div className="data-card !p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2 mb-4"><Award className="w-3 h-3" /> Wellness Factors</h4>
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32 min-h-0">
              <ResponsiveContainer width="100%" height={128} debounce={1}>
                <PieChart><Pie data={[{ value: wellnessScore }, { value: 100 - wellnessScore }]} innerRadius={45} outerRadius={60} startAngle={90} endAngle={-270} dataKey="value"><Cell fill="#1D9E75" /><Cell fill="#27272A" /></Pie></PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-text-main tracking-tighter">{wellnessScore}</span><span className="text-[8px] font-bold text-text-muted uppercase">Health</span></div>
            </div>
            <div className="w-full space-y-2">{analytics.slice(0, 4).map(a => (<ScoreRow key={a.habitId} label={a.habitName} value={Math.round(a.completionRate * 100).toString()} color={a.completionRate > 0.7 ? "text-accent" : "text-amber"} />))}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Daily Consistency</h3><span className="text-[10px] text-text-muted">Activities / 14 Days</span></div>
          <div className="grid gap-4">
            {analytics.slice(0, 4).map((stat) => {
              const habit = habits.find(h => h.id === stat.habitId);
              if (!habit) return null;
              const history = getRecentHistoryLong(activities, habit.category, 14);
              const Icon = ACTIVITY_ICONS[habit.category] || MoreHorizontal;
              
              return (
                <div key={stat.habitId} className="bg-bg-hover p-4 rounded-xl border border-border-main group hover:border-accent/30 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-bg-card border border-border-main text-accent group-hover:bg-accent/5 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-main capitalize">{stat.habitName}</div>
                        <div className="flex items-center gap-1.5">
                          <Zap className={cn("w-3 h-3", stat.streak >= 3 ? "text-amber" : "text-text-muted")} />
                          <span className="text-[10px] font-bold text-text-muted uppercase tabular-nums">{stat.streak} Day Streak</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Rate</div>
                      <div className="text-sm font-bold text-text-main">{Math.round(stat.completionRate * 100)}%</div>
                    </div>
                  </div>
                  <div className="flex justify-between gap-1.5">
                    {history.map((day, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex-1 h-3 rounded-sm transition-all duration-300", 
                          day.active ? "bg-accent shadow-[0_0_8px_rgba(20,184,166,0.15)]" : "bg-bg-card border border-border-main/50"
                        )}
                        title={formatDate(day.date)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today's Goals</h3><span className="text-[10px] text-text-muted">{dailyLogs.length} / {habits.length} Done</span></div>
          <div className="grid gap-2">
            {habits.map((habit) => {
               const log = dailyLogs.find(l => l.habitId === habit.id);
               const total = log?.value || 0;
               const goal = habit.goalValue;
               const pct = Math.min((total / goal) * 100, 150);
               const isOver = habit.isNegative ? total > goal : false;
               const isMet = habit.isNegative ? total <= goal : total >= goal;
               const Icon = ACTIVITY_ICONS[habit.category] || MoreHorizontal;
               const statusColor = isOver ? 'bg-coral' : isMet ? 'bg-accent' : pct > 50 ? 'bg-amber' : 'bg-border-main';
               return (
                 <div key={habit.id} className="bg-bg-hover p-2.5 rounded-xl border border-border-main flex items-center justify-between transition-all hover:bg-bg-card hover:border-accent/20 cursor-pointer">
                   <div className="flex items-center gap-3"><div className={cn("p-1.5 rounded-lg bg-bg-card border border-border-main", isOver ? "text-coral" : "text-accent")}><Icon className="w-3.5 h-3.5" /></div><div><div className="text-xs font-bold text-text-main capitalize">{habit.name}</div><div className="text-[10px] text-text-muted">{total} / {goal} {habit.goalUnit}</div></div></div>
                   <div className="flex items-center gap-3"><div className="w-16 h-1 bg-border-main rounded-full overflow-hidden"><div className={cn("h-full transition-all duration-1000", statusColor)} style={{ width: `${Math.min(pct, 100)}%` }} /></div><div className={cn("text-[9px] font-bold w-6 text-right", isOver ? "text-coral" : "text-text-muted")}>{Math.round(pct)}%</div><div className={cn("w-1.5 h-1.5 rounded-full", isOver ? "bg-coral" : isMet ? "bg-accent" : "bg-amber")} /></div>
                 </div>
               );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Updates</h3>{alerts.length > 0 && (<div className="px-2 py-0.5 rounded text-[9px] font-bold bg-coral-dim text-coral uppercase tracking-widest">{alerts.length} New Insights</div>)}</div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (<AlertItem key={alert.id} icon={ACTIVITY_ICONS[alert.type] || BellRing} color={alert.severity === 'high' ? "text-coral" : "text-amber"} bg={alert.severity === 'high' ? "bg-coral-dim" : "bg-amber-dim"} title={alert.trigger} sub={alert.suggestion} onClick={() => setActiveTab('alerts')} />))}
            {alerts.length === 0 && (<div className="bg-bg-hover/50 p-4 rounded-2xl border border-border-main/50 text-center"><span className="text-[10px] font-bold text-accent uppercase tracking-widest">All habits on track</span></div>)}
          </div>
        </div>
      </div>
    </motion.div>
  );
  };

  const renderPatterns = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {habits.map(habit => {
          const prediction = predictions.find(p => p.habitId === habit.id);
          return (
            <PatternChart key={habit.id} habitId={habit.id} habitName={habit.name} logs={activities.filter(a => a.type === habit.category) as any} prediction={prediction} />
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="data-card">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-coral flex items-center gap-2 mb-4"><TrendingDown className="w-3 h-3" /> Habits to Watch</h4>
          <div className="space-y-3">
             <PatternRow icon={Monitor} label="Late Night Screen Time" detail="Commonly between 23:00–01:00" type="bad" />
             <PatternRow icon={Utensils} label="Hydration Goal" detail="Stay consistent with drinking water" type="bad" />
             <PatternRow icon={Clock} label="Sleep Routine" detail="Varying sleep times detected" type="warn" />
          </div>
        </div>
        <div className="data-card">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2 mb-4"><TrendingUp className="w-3 h-3" /> Recent Wins</h4>
          <div className="space-y-3">
             <PatternRow icon={Brain} label="Mindfulness Practice" detail="Consistent for 2 weeks" type="good" />
             <PatternRow icon={BookOpen} label="Reading Time" detail="Time spent is up 40% recently" type="good" />
             <PatternRow icon={Dumbbell} label="Physical Activity" detail="5/7 days target reached" type="good" />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderAlerts = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="data-card !p-0 overflow-hidden">
        <div className="p-4 border-b border-border-main flex items-center justify-between bg-bg-hover/30"><h4 className="text-[10px] font-bold uppercase tracking-widest text-text-main flex items-center gap-2"><BellRing className="w-3.5 h-3.5" /> High Priority Checks</h4><span className="bg-coral text-bg-main text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Needs attention</span></div>
        <div className="divide-y divide-border-main">
          <AlertDetailItem icon={Moon} title="Late-night screen usage" desc="Found a pattern of late usage for 3 nights. This might affect your sleep quality tomorrow." severity="high" />
          <AlertDetailItem icon={Droplets} title="Daily hydration lower than usual" desc="Your hydration is a bit below your typical goal. Remember to drink water." severity="medium" />
          <AlertDetailItem icon={Clock} title="Sleep schedule shift" desc="We've noticed a change in when you go to bed. Checking in to see if you're feeling rested." severity="medium" />
        </div>
      </div>
      <div className="data-card">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-2 mb-4"><Check className="w-3.5 h-3.5 text-accent" /> Recent Fixes (Last 7 Days)</h4>
        <div className="space-y-2"><ResolvedItem title="Morning routine back on track" date="Resolved May 5 · 14-day streak" /><ResolvedItem title="Activity goal met" date="Resolved May 3 · Exercise habit back" /></div>
      </div>
    </motion.div>
  );

  const renderSuggestions = () => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      <div className="flex items-center justify-between"><h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Personal Wellness Guide</h3><div className="ai-chip">Personalized Insights</div></div>
      <div className="data-card border-purple/20 bg-purple/5">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-purple flex items-center gap-2 mb-4"><Sparkles className="w-3.5 h-3.5" /> Wellness Assistant</h4>
        <form onSubmit={handleAskCoach} className="relative"><input type="text" value={coachQuestion} onChange={(e) => setCoachQuestion(e.target.value)} placeholder="Ask about getting better sleep or staying active..." className="w-full bg-bg-main border border-border-main rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-purple/50 transition-all pr-20" /><button type="submit" disabled={askingCoach || !coachQuestion.trim()} className="absolute right-2 top-2 bottom-2 bg-purple text-white px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all">{askingCoach ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ask'}</button></form>
        {coachResponse && (<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-bg-main border border-purple/10 rounded-xl"><p className="text-xs text-text-main leading-relaxed italic">"{coachResponse}"</p></motion.div>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SuggestionCard icon={Droplets} title="Daily Hydration" body="Drinking water regularly from 08:00–20:00 will help keep you on track." type="blue" />
        <SuggestionCard icon={Moon} title="Regular Sleep Window" body="Try consistent sleep times for better energy levels." type="purple" />
        <SuggestionCard icon={Monitor} title="Evening Routine" body="Limiting screen time in the evening can help you unwind more effectively." type="accent" />
      </div>
      {insights && (
        <div className="data-card bg-bg-hover border-accent/20">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-accent flex items-center gap-2 mb-4"><Brain className="w-3.5 h-3.5" /> Recent Focus</h4>
          <p className="text-sm font-medium text-text-main leading-relaxed mb-4">"{insights.summary}"</p>
          <div className="flex flex-wrap gap-2">{insights.suggestions.map((s: string, i: number) => (<span key={i} className="text-[10px] text-text-muted border border-border-main px-2 py-1 rounded-lg">{s}</span>))}</div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold tracking-tight text-text-main">Health Hub</h2><p className="text-[11px] text-text-muted">Tracking your progress and consistency.</p></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportToCSV} disabled={activities.length === 0} className="flex items-center gap-2 bg-bg-card border border-border-main px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:border-text-muted transition-all disabled:opacity-50 shadow-sm active:scale-95"><Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export History</span></button>
          <button type="button" onClick={handleAnalyze} disabled={analyzing || habits.length === 0} className="flex items-center gap-2 bg-accent text-bg-main px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 shadow-sm transition-all disabled:opacity-50 active:scale-95">{analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{analyzing ? 'Checking...' : 'Refresh'}</button>
        </div>
      </div>
      <div className="flex border-b border-border-main overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = (tab as any).count;
          return (
            <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex items-center gap-2", isActive ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-main")}>
              <Icon className="w-4 h-4" />{tab.label}
              {count > 0 && (<span className="bg-coral text-white text-[10px] px-2 py-0.5 rounded-full">{count}</span>)}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'streaks' && renderStreaks()}
          {activeTab === 'patterns' && renderPatterns()}
          {activeTab === 'alerts' && renderAlerts()}
          {activeTab === 'suggestions' && renderSuggestions()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* UI Helper Components */

function MetricCard({ label, value, change, trend, subtext, color = "text-text-main" }: any) {
  return (
    <div className="bg-bg-card border border-border-main p-3.5 rounded-2xl flex flex-col justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">{label}</span>
      <div className="flex items-baseline gap-1"><span className={cn("text-2xl font-bold tracking-tighter", color)}>{value}</span>{subtext && <span className="text-[10px] font-bold text-text-muted">{subtext}</span>}</div>
      {change && (<div className={cn("text-[9px] font-bold mt-1 flex items-center gap-1", trend === 'up' ? "text-accent" : trend === 'down' ? "text-coral" : "text-text-muted")}>{trend === 'up' && <TrendingUp className="w-2.5 h-2.5" />}{trend === 'down' && <TrendingDown className="w-2.5 h-2.5" />}{change}</div>)}
    </div>
  );
}

function ScoreRow({ label, value, color }: any) {
  return (
    <div className="flex items-center justify-between text-[11px] font-medium border-b border-border-main/50 pb-1.5"><span className="text-text-muted">{label}</span><span className={cn("font-bold", color)}>{value}</span></div>
  );
}

function LegendItem({ color, label, isDashed }: any) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-text-muted"><div className={cn("w-2 h-2 rounded-full", color, isDashed && "opacity-50")} />{label}</div>
  );
}

function AlertItem({ icon: Icon, color, bg, title, sub, onClick }: any) {
  return (
    <div onClick={onClick} className="bg-bg-hover border border-border-main p-3 rounded-xl flex gap-3 transition-colors hover:border-accent/10 cursor-pointer">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", bg, color)}><Icon className="w-4 h-4" /></div>
      <div><div className="text-xs font-bold text-text-main">{title}</div><div className="text-[10px] text-text-muted">{sub}</div></div>
    </div>
  );
}

function ResolvedItem({ title, date }: any) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-bg-hover/30 border border-border-main/50"><div className="w-6 h-6 rounded-lg bg-accent-dim text-accent flex items-center justify-center"><Check className="w-3 h-3" /></div><div className="flex-1"><div className="text-xs font-medium text-text-muted">{title}</div><div className="text-[10px] text-text-muted opacity-50">{date}</div></div></div>
  );
}

function AlertDetailItem({ icon: Icon, title, desc, severity }: any) {
  const sevColor = severity === 'high' ? 'bg-coral' : 'bg-amber';
  return (
    <div className="p-4 flex gap-4 hover:bg-bg-hover/20 transition-all">
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", severity === 'high' ? 'bg-coral-dim text-coral' : 'bg-amber-dim text-amber')}><Icon className="w-4 h-4" /></div>
      <div className="space-y-1">
        <div className="flex items-center gap-2"><span className="text-[13px] font-bold text-text-main leading-none">{title}</span><div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", sevColor)} /></div>
        <p className="text-[11px] text-text-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function PatternRow({ icon: Icon, label, detail, type }: any) {
  const dotColor = type === 'bad' ? 'bg-coral' : type === 'warn' ? 'bg-amber' : 'bg-accent';
  const iconBg = type === 'bad' ? 'bg-coral-dim text-coral' : type === 'warn' ? 'bg-amber-dim text-amber' : 'bg-accent-dim text-accent';
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-hover transition-colors group">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}><Icon className="w-4 h-4" /></div>
      <div className="flex-1 min-w-0"><div className="text-xs font-bold text-text-main truncate">{label}</div><div className="text-[10px] text-text-muted truncate">{detail}</div></div>
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
    </div>
  );
}

function SuggestionCard({ icon: Icon, title, body, type }: any) {
  const colorMap: any = { coral: 'text-coral bg-coral-dim border-coral/10', blue: 'text-[#378ADD] bg-[#378ADD1a] border-[#378ADD1a]', purple: 'text-purple bg-purple-dim border-purple/10', accent: 'text-accent bg-accent-dim border-accent/10' };
  return (
    <div className="data-card flex gap-4 items-start group hover:border-accent/10 transition-all cursor-pointer">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1 transition-transform group-hover:scale-105", colorMap[type] || colorMap.accent)}><Icon className="w-5 h-5" /></div>
      <div className="space-y-1"><h5 className="text-[13px] font-bold text-text-main tracking-tight leading-tight">{title}</h5><p className="text-[11px] text-text-muted leading-relaxed">{body}</p></div>
    </div>
  );
}

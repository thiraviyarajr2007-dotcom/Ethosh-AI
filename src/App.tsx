import React, { useState, useEffect } from 'react';
import AuthGate from './components/AuthGate';
import Navbar from './components/Navbar';
import ActivityLogger from './components/ActivityLogger';
import InsightsPanel from './components/InsightsPanel';
import ProfileSettings from './components/ProfileSettings';
import Onboarding from './components/Onboarding';
import { motion } from 'motion/react';
import { 
  Activity, Star, Calendar, LayoutDashboard, Zap, BarChart3, Bell, Settings, Sparkles, Brain, 
  CheckCircle2, Network, Lightbulb, Plug, BookOpen, Dumbbell, Monitor, Moon, Droplets, Loader2,
  Smartphone, Bluetooth, Watch
} from 'lucide-react';
import { cn } from './lib/utils';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from './context/AuthContext';
import { signInGoogleFit, fetchGoogleFitSteps, isGoogleFitConfigured } from './services/googleFitService';
import { requestBluetoothDevice } from './services/bluetoothService';

export default function App() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'dashboard' | 'profile' | 'api'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'patterns' | 'alerts' | 'suggestions' | 'streaks'>('overview');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [initializing, setInitializing] = useState(true);

  // Integration States
  const [googleFitStatus, setGoogleFitStatus] = useState<'Disconnected' | 'Connecting' | 'Connected'>('Disconnected');
  const [watchStatus, setWatchStatus] = useState<'Disconnected' | 'Connecting' | 'Connected'>('Disconnected');
  const [fitSteps, setFitSteps] = useState<number | null>(null);

  useEffect(() => {
    let unsubAlr: (() => void) | undefined;

    const initializeAppData = async () => {
      if (user) {
        setInitializing(true);
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            setOnboarded(data.onboarded === true);
          } else {
            setOnboarded(false);
          }
          
          // Alert counter
          const { collection, query, where, onSnapshot } = await import('firebase/firestore');
          const { handleFirestoreError, OperationType } = await import('./lib/firebase');
          const alertsPath = `users/${user.uid}/alerts`;
          const qAlr = query(
            collection(db, 'users', user.uid, 'alerts'),
            where('read', '==', false)
          );
          unsubAlr = onSnapshot(qAlr, (snap) => {
            setAlertCount(snap.size);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, alertsPath);
          });
          
          setInitializing(false);
        } catch (error) {
          console.error("Error checking onboarding:", error);
          setOnboarded(false);
          setInitializing(false);
        }
      } else {
        setOnboarded(null);
        setInitializing(false);
      }
    };

    initializeAppData();

    return () => {
      if (unsubAlr) unsubAlr();
    };
  }, [user]);

  const navigateToDashboardTab = (tab: typeof dashboardTab) => {
    setActiveView('dashboard');
    setDashboardTab(tab);
  };

  const handleConnectGoogleFit = async () => {
    setGoogleFitStatus('Connecting');
    try {
      const token = await signInGoogleFit();
      if (token) {
        setGoogleFitStatus('Connected');
        const steps = await fetchGoogleFitSteps(token);
        setFitSteps(steps);
      } else {
        setGoogleFitStatus('Disconnected');
      }
    } catch (error) {
      console.error('GFit Error:', error);
      setGoogleFitStatus('Disconnected');
    }
  };

  const handleConnectWatch = async () => {
    setWatchStatus('Connecting');
    try {
      const device = await requestBluetoothDevice();
      if (device?.connected) {
        setWatchStatus('Connected');
      } else {
        setWatchStatus('Disconnected');
      }
    } catch (error) {
      console.error('BT Error:', error);
      setWatchStatus('Disconnected');
      alert('Bluetooth connection failed. Make sure your device is in pairing mode.');
    }
  };

  return (
    <AuthGate>
      {initializing ? (
        <div className="h-screen w-screen bg-bg-main flex items-center justify-center text-text-muted">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Preparing your space...</p>
          </div>
        </div>
      ) : onboarded === false ? (
        <Onboarding onComplete={() => setOnboarded(true)} />
      ) : (
        <div className="flex h-screen bg-bg-main overflow-hidden text-text-muted">
          {/* Sidebar */}
        <aside className="w-64 bg-bg-card border-r border-border-main flex flex-col hidden md:flex">
          <div className="p-6 border-b border-border-main">
            <button 
              type="button"
              className="flex items-center gap-2 text-accent font-bold tracking-tight cursor-pointer focus:outline-none"
              onClick={() => setActiveView('dashboard')}
            >
              <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center border border-accent/20">
                <Brain className="w-5 h-5" />
              </div>
              <div className="flex flex-col leading-none text-left">
                <span className="text-sm font-bold text-text-main">HabitAI</span>
              </div>
            </button>
          </div>
          
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto no-scrollbar">
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={activeView === 'dashboard' && dashboardTab === 'overview'} 
              onClick={() => navigateToDashboardTab('overview')}
            />
            <SidebarItem 
              icon={CheckCircle2} 
              label="Habits" 
              active={activeView === 'dashboard' && dashboardTab === 'streaks'} 
              onClick={() => navigateToDashboardTab('streaks')}
            />
            
            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/50 mt-4">Insights</div>
            <SidebarItem 
              icon={Network} 
              label="Patterns" 
              active={activeView === 'dashboard' && dashboardTab === 'patterns'} 
              onClick={() => navigateToDashboardTab('patterns')}
            />
            <SidebarItem 
              icon={Bell} 
              label="Alerts" 
              badge={alertCount > 0 ? alertCount.toString() : undefined} 
              active={activeView === 'dashboard' && dashboardTab === 'alerts'} 
              onClick={() => navigateToDashboardTab('alerts')}
            />
            <SidebarItem 
              icon={Lightbulb} 
              label="Suggestions" 
              active={activeView === 'dashboard' && dashboardTab === 'suggestions'} 
              onClick={() => navigateToDashboardTab('suggestions')}
            />

            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted/50 mt-4">System</div>
            <SidebarItem 
              icon={Settings} 
              label="Settings" 
              active={activeView === 'profile'} 
              onClick={() => setActiveView('profile')}
            />
            <SidebarItem 
              icon={Plug} 
              label="APIs" 
              active={activeView === 'api'} 
              onClick={() => setActiveView('api')}
            />
          </nav>

          <div className="p-4 border-t border-border-main">
            <div className="p-4 rounded-xl bg-bg-hover border border-border-main">
              <div className="text-[10px] uppercase font-bold text-accent mb-1">Wellness Pulse</div>
              <div className="text-xs text-text-main flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse"></span>
                Everything is on track
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {activeView === 'dashboard' ? (
              <>
                <header className="mb-8">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
                  >
                    <div>
                      <h1 className="text-3xl font-bold tracking-tight text-text-main mb-1">Health Overview</h1>
                      <p className="text-[11px] text-text-muted">Updated: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} · {new Date().toLocaleTimeString()}</p>
                    </div>
                    <div className="flex gap-3">
                      <Stat label="Habit Score" value="88" change="+4.2%" />
                      <Stat label="Streak" value="12" subtext="DAYS" />
                    </div>
                  </motion.div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8">
                    <InsightsPanel activeTab={dashboardTab} onTabChange={setDashboardTab} />
                  </div>
                  
                  <div className="lg:col-span-4 space-y-6">
                    <section>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Daily Intent</h3>
                      <div className="data-card !bg-accent/5 border-accent/20 group hover:bg-accent/[0.08] transition-all">
                        <p className="text-accent text-[10px] uppercase font-bold tracking-widest mb-1">Current Goal</p>
                        <p className="text-lg font-bold text-text-main mb-4 leading-tight group-hover:text-accent transition-colors">Reduce screen time below 2 hours</p>
                        <div className="w-full bg-border-main/50 h-2 rounded-full overflow-hidden p-0.5 border border-border-main/30">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '65%' }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="bg-accent h-full rounded-full shadow-[0_0_8px_rgba(29,158,117,0.3)]" 
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-[9px] font-bold text-text-muted uppercase">Status: Good</p>
                          <p className="text-[10px] font-mono font-bold text-accent">65.0%</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Integrations</h3>
                      <div className="space-y-2">
                        <IntegrationCard 
                          name="Google Fit" 
                          status={googleFitStatus} 
                          icon={Smartphone}
                          onClick={handleConnectGoogleFit}
                        />
                        {!isGoogleFitConfigured() && (
                          <p className="text-[8px] text-coral/80 font-bold uppercase tracking-tight ml-2">
                             VITE_GOOGLE_CLIENT_ID missing in settings
                          </p>
                        )}
                        <IntegrationCard 
                          name="Apple Health" 
                          status="Manual" 
                          icon={Smartphone}
                          onClick={() => alert('Apple Health sync is currently available only via our mobile companion app. Use "Manual" mode for now.')}
                        />
                        <IntegrationCard 
                          name="Watch (BT)" 
                          status={watchStatus} 
                          icon={Watch}
                          onClick={handleConnectWatch}
                        />
                      </div>
                      {fitSteps !== null && (
                        <div className="mt-2 p-2 bg-accent/5 border border-accent/20 rounded-lg text-[9px] font-mono text-accent">
                          Syncing GFit: {fitSteps} steps today
                        </div>
                      )}
                    </section>

                    <div className="flex-1 bg-accent/5 border border-accent/20 rounded-2xl p-5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles className="w-12 h-12 text-accent" />
                      </div>
                      <div className="flex items-center gap-2 text-accent mb-3">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Daily Wisdom</span>
                      </div>
                      <div className="text-text-main text-sm font-medium italic leading-relaxed">
                        "Small consistent actions lead to better well-being. Try 5 minutes of mindful breathing."
                      </div>
                      <button 
                        type="button"
                        onClick={() => alert('Reminder set in your calendar.')}
                        className="mt-4 w-full py-2 bg-accent text-bg-main text-[10px] font-bold uppercase tracking-widest rounded-lg hover:brightness-110 shadow-lg shadow-accent/20 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Set Reminder
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : activeView === 'profile' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <ProfileSettings />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto py-12 text-center"
              >
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Plug className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-text-main mb-4">Connections Hub</h2>
                <p className="text-text-muted mb-8 text-sm">
                  Connect your wearable devices to keep your health data in one place.
                  Coming soon: Apple HealthKit, Fitbit, and common health exports.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className="p-4 rounded-xl border border-border-main bg-bg-card">
                    <h4 className="text-xs font-bold text-text-main mb-1">Webhooks</h4>
                    <p className="text-[10px] text-text-muted">Push custom events via REST endpoint.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-border-main bg-bg-card opacity-50">
                    <h4 className="text-xs font-bold text-text-main mb-1">SDK (Private Beta)</h4>
                    <p className="text-[10px] text-text-muted">Direct node integration for devs.</p>
                  </div>
                </div>
              </motion.div>
            )}

          </main>
        </div>

        <ActivityLogger />
      </div>
      )}
    </AuthGate>
  );
}

function SidebarItem({ icon: Icon, label, active = false, badge, onClick }: { icon: any, label: string, active?: boolean, badge?: string, onClick?: () => void }) {
  return (
    <button 
      type="button"
      id={`sidebar-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      className={cn(
      "sidebar-item !border-l-2 !rounded-none py-3.5 !w-full transition-all text-left active:bg-bg-hover active:scale-[0.98] group relative overflow-hidden", 
      active ? "active border-accent bg-accent/5 shadow-[inset_4px_0_0_0_rgb(29,158,117)]" : "border-transparent hover:bg-bg-hover/50"
    )}>
      <Icon className={cn("w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110", active ? "text-accent" : "text-text-muted")} />
      <span className={cn("text-xs font-bold uppercase tracking-widest flex-1 truncate transition-colors", active ? "text-text-main" : "text-text-muted/70 group-hover:text-text-main")}>{label}</span>
      {badge && (
        <span className="bg-coral/20 text-coral text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
          {badge}
        </span>
      )}
      {active && !badge && <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 shadow-[0_0_8px_rgba(29,158,117,0.4)]" />}
    </button>
  );
}

function Stat({ label, value, change, subtext }: { label: string, value: string, change?: string, subtext?: string }) {
  return (
    <div className="bg-bg-card px-5 py-4 rounded-xl border border-border-main flex flex-col justify-between min-w-[140px]">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        {change && <span className="text-accent text-[10px] font-bold">{change}</span>}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold text-text-main tracking-tighter">{value}</span>
        {subtext && <span className="text-[10px] font-bold text-text-muted mb-1">{subtext}</span>}
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, disabled, icon: Icon, onClick }: { name: string, status: string, disabled?: boolean, icon: any, onClick?: () => void }) {
  return (
    <div
      role="button"
      onClick={!disabled && status !== 'Connecting' ? onClick : undefined}
      className={cn(
      "w-full p-3 rounded-xl border flex items-center justify-between transition-all group cursor-pointer",
      disabled ? "bg-bg-card/50 border-border-main/50 opacity-40 cursor-not-allowed" : 
      "bg-bg-card border-border-main hover:border-accent/30 active:scale-[0.98]"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
          status === 'Connected' ? "bg-accent/10 text-accent" : "bg-bg-hover text-text-muted group-hover:text-text-main"
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-text-main">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'Connecting' && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
          status === 'Connected' ? "bg-accent/10 text-accent" : 
          status === 'Connecting' ? "bg-accent/5 text-accent/50" :
          "bg-bg-hover text-text-muted"
        )}>{status}</span>
      </div>
    </div>
  );
}


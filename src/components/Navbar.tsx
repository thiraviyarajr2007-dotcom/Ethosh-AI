import React from 'react';
import { auth } from '../lib/firebase';
import { Sparkles, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav id="main-navbar" className="sticky top-0 z-50 bg-bg-main/80 backdrop-blur-xl border-b border-border-main py-4 transition-all duration-300">
      <div className="max-w-full px-8">
        <div className="flex justify-between h-8 items-center">
          <div className="flex items-center gap-2 md:hidden">
            <div className="bg-accent p-1.5 rounded-lg shadow-lg shadow-accent/20">
              <Sparkles className="w-4 h-4 text-bg-main" />
            </div>
            <span className="text-lg font-black tracking-tighter text-text-main">ETHOS</span>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">Personalized Wellness Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end min-w-0">
                  <span id="nav-user-name" className="text-xs font-black text-text-main truncate max-w-[150px] block tracking-tight uppercase">{user.displayName || 'Guest'}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-accent" />
                    <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Active Session</span>
                  </div>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-border-main" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-bg-hover flex items-center justify-center border border-border-main">
                    <UserIcon className="w-4 h-4 text-text-muted" />
                  </div>
                )}
                <div className="w-px h-4 bg-border-main ml-2" />
                <button 
                  type="button"
                  onClick={() => auth.signOut()}
                  className="p-1.5 hover:bg-bg-hover rounded-md transition-colors text-text-muted hover:text-error active:scale-90"
                  title="Sign Out"
                  id="navbar-logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

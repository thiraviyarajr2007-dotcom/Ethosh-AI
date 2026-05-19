import React, { useEffect, useState } from 'react';
import { signInWithGoogle, signInWithFacebook, handleFirestoreError, OperationType } from '../lib/firebase';
import { LogIn, Sparkles, Facebook } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth();
  const [authLoading, setAuthLoading] = useState<string | null>(null);

  useEffect(() => {
    const initializeUserDoc = async () => {
      if (user) {
        // Initialize user document if it doesn't exist
        try {
          const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            const userPath = `users/${user.uid}`;
            const email = user.email || '';
            const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            
            try {
              await setDoc(docRef, {
                userId: user.uid,
                name: user.displayName || 'Anonymous User',
                email: isValidEmail ? email : 'invalid-email@ethos.ai',
                createdAt: serverTimestamp(),
                goals: [],
                onboarded: false
              });
              console.log("User document initialized for:", user.uid);
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, userPath);
            }
          }
        } catch (error) {
          console.error("Error initializing user document:", error);
        }
      }
    };

    if (!loading && user) {
      initializeUserDoc();
    }
  }, [user, loading]);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setAuthLoading(provider);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithFacebook();
      }
    } catch (err: any) {
      console.error(`${provider} Login Error:`, err);
      // Firebase auth error code for unauthorized domain or provider disabled
      let message = err.code === 'auth/operation-not-allowed' 
        ? `${provider} login is not enabled in your Firebase console. Please enable it in Authentication > Sign-in method.` 
        : `Authentication failed. Reference code: ${err.code || 'unknown'}`;
      
      if (err.message) {
        message += `\n\nDetails: ${err.message}`;
      }
      
      alert(message);
      setAuthLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main text-text-muted">
        <div className="animate-pulse flex flex-col items-center">
          <Sparkles className="w-12 h-12 text-accent mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-mono">System Initialization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-main px-4 text-text-muted overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-12 relative z-10"
        >
          <div className="flex justify-center">
            <div className="bg-bg-card p-4 rounded-2xl border border-border-main shadow-2xl">
              <Sparkles className="w-10 h-10 text-accent" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tighter text-text-main">
              ETHOS AI / <span className="text-accent underline underline-offset-8 decoration-accent/30 font-mono">CORE</span>
            </h1>
            <p className="text-sm text-text-muted leading-relaxed max-w-[80%] mx-auto">
              Strategic behavior monitoring and pattern analysis for optimized human performance.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              type="button"
              disabled={!!authLoading}
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-between gap-3 bg-bg-card hover:bg-bg-card/80 text-text-main py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border border-border-main group relative overflow-hidden disabled:opacity-50"
              id="google-login-btn"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg group-hover:scale-110 transition-transform">
                  {authLoading === 'google' ? (
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                </div>
                <span>Sign in with Google</span>
              </div>
              <LogIn className="w-4 h-4 opacity-30 group-hover:opacity-100 group-hover:text-accent transition-all" />
              <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>

            <button
              type="button"
              disabled={!!authLoading}
              onClick={() => handleSocialLogin('facebook')}
              className="w-full flex items-center justify-between gap-3 bg-bg-card hover:bg-bg-card/80 text-text-main py-4 px-6 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border border-border-main group relative overflow-hidden disabled:opacity-50"
              id="facebook-login-btn"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1877F2] rounded-lg group-hover:scale-110 transition-transform">
                  {authLoading === 'facebook' ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Facebook className="w-4 h-4 text-white fill-current" />
                  )}
                </div>
                <span>Sign in with Facebook</span>
              </div>
              <LogIn className="w-4 h-4 opacity-30 group-hover:opacity-100 group-hover:text-[#1877F2] transition-all" />
              <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>

            <p className="text-[9px] uppercase tracking-widest font-bold opacity-30">
              Auth-Protocol: OAuth 2.0 / Firebase
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}

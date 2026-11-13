import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { ArrowLeft, Loader2, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  resolveStaffUser,
  seedInitialDatabaseIfNeeded,
  type StaffSessionUser,
} from '../lib/firestoreService';

interface AdminAuthGateProps {
  children: (staffUser: StaffSessionUser) => ReactNode;
}

export default function AdminAuthGate({ children }: AdminAuthGateProps) {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [staffUser, setStaffUser] = useState<StaffSessionUser | null>(null);
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'unauthenticated' | 'unauthorized' | 'authorized'
  >('loading');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setStaffUser(null);
        setAuthStatus('unauthenticated');
        return;
      }

      try {
        const res = await resolveStaffUser(
          user.uid,
          user.email,
          user.emailVerified,
          user.displayName,
        );
        if (!res.authorized || !res.user) {
          setStaffUser(null);
          setAuthStatus('unauthorized');
          return;
        }
        if (res.user.role === 'owner') {
          await seedInitialDatabaseIfNeeded(res.user);
        }
        setStaffUser(res.user);
        setAuthStatus('authorized');
      } catch (err) {
        setLoginError(
          err instanceof Error
            ? 'Unable to verify staff permissions.'
            : 'Authentication verification failed.',
        );
        setStaffUser(null);
        setAuthStatus('unauthorized');
      }
    });

    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoginError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Sign-in cancelled or failed.';
      setLoginError(message);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (!authReady || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF5A1F]" aria-hidden="true" />
          <p className="text-sm text-[#A1A1AA]">Verifying staff &amp; owner session...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Restricted Operations Console
            </span>
          </div>

          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">
            ASSURE FITNESS CLUB ADMIN
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Sign in with a verified Google account provisioned for Owner, Front-Desk Staff, or
            Trainer access.
          </p>

          {loginError && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs text-white"
            >
              {loginError}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in with Google Account</span>
            )}
          </button>

          <p className="mt-4 text-xs text-[#A1A1AA]">
            Public self-registration is disabled. Access is restricted to active accounts in the
            club staff registry.
          </p>

          <div className="mt-6 border-t border-white/10 pt-5">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Return to Public Website</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized' || !firebaseUser || !staffUser) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Access Denied
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold text-white">
            Active Staff Permission Required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Signed in as <strong className="text-white">{firebaseUser?.email}</strong>, which does
            not hold an active owner, staff, or trainer assignment for Assure Fitness Club LLP.
          </p>
          {loginError && (
            <p className="mt-3 text-xs text-[#FF5A1F]">{loginError}</p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out &amp; Switch Account</span>
            </button>
            <a
              href="/"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-5 py-2.5 text-sm font-medium text-white hover:border-white/30"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Public Website</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(staffUser)}</>;
}

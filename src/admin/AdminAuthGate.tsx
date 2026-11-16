import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  clearLoginSessionMarkers,
  recordLoginEventOncePerSession,
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
    'loading' | 'unauthenticated' | 'unverified' | 'unauthorized' | 'authorized'
  >('loading');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const evaluateUser = async (user: User | null) => {
    setFirebaseUser(user);
    setAuthReady(true);

    if (!user) {
      setStaffUser(null);
      setAuthStatus('unauthenticated');
      return;
    }

    if (!user.emailVerified) {
      setStaffUser(null);
      setAuthStatus('unverified');
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
      const loginMethod = user.providerData.some(
        (p) => p.providerId === 'password',
      )
        ? 'password'
        : 'google';
      void recordLoginEventOncePerSession({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        role: res.user.role,
        portal: 'admin',
        method: loginMethod,
      });
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
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      void evaluateUser(user);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoginError(null);
    setInfoMsg(null);
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

  const handleEmailPasswordSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setInfoMsg(null);
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !passwordInput) {
      setLoginError('Please enter both admin email and password.');
      return;
    }
    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Email/Password sign-in is not yet enabled in Firebase Console -> Authentication -> Sign-in method.',
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setLoginError(
          'Invalid email or password. If you previously signed in only with Google, sign in with Google below and link a password under Publish & Ops, or click "Send Password Setup / Reset Link".',
        );
      } else {
        setLoginError(
          err instanceof Error ? err.message : 'Admin email sign-in failed.',
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendPasswordSetup = async () => {
    setLoginError(null);
    setInfoMsg(null);
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setLoginError('Type your admin email above first, then request a password setup link.');
      return;
    }
    setSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMsg(
        'If an eligible account exists for that email, a password setup / reset link has been sent to its inbox.',
      );
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Could not send password setup link.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendVerification = async () => {
    if (!firebaseUser) return;
    setLoginError(null);
    setInfoMsg(null);
    try {
      await sendEmailVerification(firebaseUser);
      setInfoMsg(
        `Verification email sent to ${firebaseUser.email}. Verify it and click Refresh Session.`,
      );
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Could not send verification email.',
      );
    }
  };

  const handleRefreshSession = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    await evaluateUser(auth.currentUser);
  };

  const handleSignOut = async () => {
    setPasswordInput('');
    clearLoginSessionMarkers();
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
            Sign in with your verified Google account or configured Firebase Email/Password admin
            credentials.
          </p>

          {loginError && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs leading-relaxed text-white"
            >
              {loginError}
            </div>
          )}

          {infoMsg && (
            <div className="mt-5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-200">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleEmailPasswordSignIn} className="mt-6 space-y-3">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="off"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Enter admin email"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Firebase admin password"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-5 text-sm font-semibold text-white hover:border-[#FF5A1F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
              <span>{signingIn ? 'Signing in...' : 'Sign in with Email & Password'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendPasswordSetup}
              disabled={signingIn}
              className="w-full text-center text-xs font-medium text-[#A1A1AA] hover:text-[#FF5A1F] transition-colors cursor-pointer pt-1"
            >
              Forgot or first-time password? Send Password Setup / Reset Link
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-[#A1A1AA]">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 transition-colors cursor-pointer"
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
            club staff registry and verified owner credentials.
          </p>

          <div className="mt-6 border-t border-white/10 pt-5 flex items-center justify-between gap-4">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Website</span>
            </a>
            <a
              href="/trainer"
              className="text-xs font-medium text-[#A1A1AA] hover:text-[#FF5A1F] transition-colors"
            >
              Trainer Portal &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unverified' && firebaseUser) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <MailCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Email Verification Required
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold text-white">
            Verify {firebaseUser.email}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            For security against email spoofing, Firestore RBAC rules require{' '}
            <code className="text-white">email_verified == true</code> before granting admin
            read/write access. Verify this address via the link sent to your inbox (or set{' '}
            <code className="text-white">emailVerified: true</code> on this account via Firebase
            Admin SDK / Cloud Shell), then click Refresh Session.
          </p>
          {infoMsg && (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              {infoMsg}
            </div>
          )}
          {loginError && (
            <div className="mt-4 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 p-3 text-xs text-white">
              {loginError}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRefreshSession}
              className="min-h-[44px] w-full rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white cursor-pointer"
            >
              I&apos;ve Verified &mdash; Refresh Session
            </button>
            <button
              type="button"
              onClick={handleSendVerification}
              className="min-h-[44px] w-full rounded-md border border-white/15 bg-[#080808] px-5 text-sm font-medium text-white cursor-pointer"
            >
              Send Verification Email
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[44px] w-full rounded-md border border-white/10 bg-[#080808] px-5 text-sm font-medium text-[#A1A1AA] cursor-pointer"
            >
              Sign Out &amp; Use Google Sign-In
            </button>
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

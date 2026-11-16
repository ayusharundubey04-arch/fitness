import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Dumbbell,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  clearLoginSessionMarkers,
  recordLoginEventOncePerSession,
  submitMembershipRequest,
  subscribeMyMemberRecords,
  subscribeMyMembershipRequests,
  subscribePublicPlans,
} from '../lib/firestoreService';
import type {
  GymMember,
  MembershipPlanRecord,
  MembershipRequestRecord,
} from '../types/gym';
import { computeMembershipValidity } from '../utils/adminLogic';
import { normalizeIndianPhone } from '../utils/clubLogic';

interface MemberPortalProps {
  onNavigatePublic: () => void;
  onNavigateAdmin: () => void;
}

const MONTH_OPTIONS = [1, 2, 3, 6, 9, 12];

export default function MemberPortal({
  onNavigatePublic,
  onNavigateAdmin,
}: MemberPortalProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [emailVerifiedFlag, setEmailVerifiedFlag] = useState(false);
  const [verificationTick, setVerificationTick] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');

  const [myMembers, setMyMembers] = useState<GymMember[]>([]);
  const [myRequests, setMyRequests] = useState<MembershipRequestRecord[]>([]);
  const [publicPlans, setPublicPlans] = useState<MembershipPlanRecord[]>([]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [claimType, setClaimType] = useState<'Existing Member' | 'New or Renewal'>(
    'Existing Member',
  );
  const [planName, setPlanName] = useState('Quarterly Commitment');
  const [monthsRequested, setMonthsRequested] = useState<number>(3);
  const [existingStartDate, setExistingStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (current) => {
      setUser(current);
      setEmailVerifiedFlag(Boolean(current?.emailVerified));
      setAuthReady(true);
      if (current?.displayName) {
        setFullName((prev) => prev || current.displayName || '');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !emailVerifiedFlag || !user.email) {
      setMyMembers([]);
      setMyRequests([]);
      return;
    }

    const loginMethod = user.providerData.some(
      (p) => p.providerId === 'password',
    )
      ? 'password'
      : 'google';

    void recordLoginEventOncePerSession({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      role: 'member',
      portal: 'member',
      method: loginMethod,
    });

    const unsubMembers = subscribeMyMemberRecords(
      user.uid,
      user.email,
      setMyMembers,
    );
    const unsubRequests = subscribeMyMembershipRequests(user.uid, setMyRequests);
    const unsubPlans = subscribePublicPlans(setPublicPlans);

    return () => {
      unsubMembers();
      unsubRequests();
      unsubPlans();
    };
  }, [user, emailVerifiedFlag, verificationTick]);

  const sortedMembers = useMemo(
    () =>
      [...myMembers].sort((a, b) => b.expiryDate.localeCompare(a.expiryDate)),
    [myMembers],
  );

  const primaryMember = sortedMembers[0] || null;
  const validity = useMemo(
    () =>
      primaryMember
        ? computeMembershipValidity(
            primaryMember.expiryDate,
            primaryMember.memberStatus,
            todayIso,
          )
        : null,
    [primaryMember, todayIso],
  );

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.',
      );
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    const cleanEmail = authEmail.trim();
    if (!cleanEmail || !authPassword) {
      setAuthError('Please enter both your email address and password.');
      return;
    }
    if (authMode === 'signup' && authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setSigningIn(true);
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          authPassword,
        );
        if (authName.trim()) {
          await updateProfile(cred.user, { displayName: authName.trim() });
        }
        await sendEmailVerification(cred.user);
        setAuthInfo(
          `Account created. Verification email sent to ${cleanEmail}. Verify it to unlock your validity status.`,
        );
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, authPassword);
      }
      setAuthPassword('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Email/Password sign-in must first be enabled in Firebase Console -> Authentication -> Sign-in method. You can also sign in immediately with Google / Gmail below.',
        );
      } else if (code === 'auth/email-already-in-use') {
        setAuthError(
          'An account already exists with this email. Switch to Sign In or use Google / Gmail.',
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setAuthError('Invalid email or password.');
      } else if (code === 'auth/weak-password') {
        setAuthError('Password should be at least 6 characters.');
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Email/Password sign-in failed.',
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSendVerification = async () => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) return;
    setAuthError(null);
    setAuthInfo(null);
    try {
      await sendEmailVerification(currentUser);
      setAuthInfo(
        `Verification link sent to ${currentUser.email}. Click it in your inbox, then click Refresh Session.`,
      );
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not send verification email.',
      );
    }
  };

  const handleRefreshSession = async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    setAuthInfo(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setUser(auth.currentUser);
      const verified = Boolean(auth.currentUser.emailVerified);
      setEmailVerifiedFlag(verified);
      setVerificationTick((n) => n + 1);
      if (!verified) {
        setAuthInfo('Email is still not marked verified. Please open the link in your inbox first.');
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not refresh session.',
      );
    }
  };

  const handleSubmitClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !user.email) return;

    setSubmitError(null);
    setSubmitSuccess(null);

    if (fullName.trim().length < 2) {
      setSubmitError('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanPhone = normalizeIndianPhone(phone);
    if (cleanPhone.replace(/\D/g, '').length < 8) {
      setSubmitError('Please enter a valid 10-digit mobile phone number.');
      return;
    }
    if (monthsRequested < 1 || monthsRequested > 36) {
      setSubmitError('Requested duration must be between 1 and 36 months.');
      return;
    }
    if (!consentAccepted) {
      setSubmitError(
        'Please confirm consent so the club owner can verify and link your membership.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitMembershipRequest(user.uid, user.email, {
        fullName,
        phone: cleanPhone,
        claimType,
        planName,
        monthsRequested,
        existingStartDate,
        notes,
        consentAccepted,
      });
      setNotes('');
      setConsentAccepted(false);
      setSubmitSuccess(
        `Submitted ${claimType.toLowerCase()} request for ${monthsRequested} month(s). The club owner can now review and approve it in the Admin Console.`,
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to submit membership request right now.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF5A1F]" aria-hidden="true" />
          <p className="text-sm text-[#A1A1AA]">Loading member portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Member Self-Service Portal
            </span>
          </div>

          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">
            CHECK MEMBERSHIP VALIDITY
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Sign in with Google / Gmail or Email &amp; Password to check how many days remain on
            your membership or submit a verification request.
          </p>

          {authError && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs leading-relaxed text-white"
            >
              {authError}
            </div>
          )}

          {authInfo && (
            <div className="mt-5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
              {authInfo}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-[#080808] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setAuthError(null);
              }}
              className={`min-h-[36px] rounded text-xs font-semibold transition-colors cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
              className={`min-h-[36px] rounded text-xs font-semibold transition-colors cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="mt-4 space-y-3">
            {authMode === 'signup' && (
              <div>
                <label
                  htmlFor="member-auth-name"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1"
                >
                  Full Name
                </label>
                <input
                  id="member-auth-name"
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="member-auth-email"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Email Address
              </label>
              <input
                id="member-auth-email"
                type="email"
                autoComplete="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="member-auth-password"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Password
              </label>
              <input
                id="member-auth-password"
                type="password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder={
                  authMode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'
                }
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-5 text-sm font-semibold text-white hover:border-[#FF5A1F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
              <span>
                {signingIn
                  ? 'Please wait...'
                  : authMode === 'signup'
                  ? 'Create Member Account'
                  : 'Sign in with Email & Password'}
              </span>
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
                <span>Signing in with Gmail...</span>
              </>
            ) : (
              <span>Sign in with Google / Gmail</span>
            )}
          </button>

          <div className="mt-6 border-t border-white/10 pt-5 flex items-center justify-between gap-4">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic();
              }}
              className="inline-flex items-center gap-2 text-xs font-medium text-[#A1A1AA] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Website</span>
            </a>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigateAdmin();
              }}
              className="text-xs font-medium text-[#A1A1AA] hover:text-[#FF5A1F]"
            >
              Staff / Admin Login &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!emailVerifiedFlag) {
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
            Verify {user.email}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Check your inbox for the verification email and click the link to confirm account
            ownership before viewing membership validity or submitting a request.
          </p>
          {authInfo && (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              {authInfo}
            </div>
          )}
          {authError && (
            <div className="mt-4 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 p-3 text-xs text-white">
              {authError}
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
              Resend Verification Email
            </button>
            <button
              type="button"
              onClick={() => {
                clearLoginSessionMarkers();
                void signOut(auth);
              }}
              className="min-h-[44px] w-full rounded-md border border-white/10 bg-[#080808] px-5 text-sm font-medium text-[#A1A1AA] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="border-b border-white/10 bg-[#111111]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FF5A1F] uppercase">
              ASSURE FITNESS CLUB LLP · MEMBER PORTAL
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Welcome, {user.displayName || user.email}
            </h1>
            <p className="text-xs text-[#A1A1AA]">Signed in with Gmail: {user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic();
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-white/15 bg-[#080808] px-4 text-xs font-medium text-white hover:border-[#FF5A1F]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Website</span>
            </a>
            <button
              type="button"
              onClick={() => {
                clearLoginSessionMarkers();
                void signOut(auth);
              }}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-white/10 bg-[#080808] px-4 text-xs font-medium text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Live Membership Validity Status */}
        <section className="rounded-lg border border-white/10 bg-[#111111] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 flex items-center justify-center shrink-0">
                <CalendarClock className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Your Membership Validity
                </h2>
                <p className="text-xs text-[#A1A1AA]">
                  Live status linked to your verified Gmail account ({user.email})
                </p>
              </div>
            </div>

            {primaryMember && validity && (
              <span
                className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-bold uppercase tracking-wider ${
                  validity.badgeTone === 'emerald'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : validity.badgeTone === 'amber'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : validity.badgeTone === 'red'
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : 'border-white/15 bg-[#080808] text-zinc-300'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{validity.validityLabel}</span>
              </span>
            )}
          </div>

          {!primaryMember || !validity ? (
            <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  No active gym membership is linked to {user.email} yet.
                </p>
                <p className="text-sm text-[#A1A1AA]">
                  If you are already a member at our Naroda club or want to join/renew, submit
                  your details below so the club owner can verify and approve your membership
                  duration.
                </p>
              </div>
            </div>
          ) : (
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-md border border-white/10 bg-[#080808] p-4">
                <p className="text-xs text-[#A1A1AA]">Days Valid Remaining</p>
                <p className="mt-1 font-display text-4xl font-bold text-white tabular-nums">
                  {validity.daysRemaining >= 0 ? `${validity.daysRemaining}` : '0'}
                  <span className="ml-1.5 text-sm font-normal text-[#A1A1AA]">days</span>
                </p>
                <p className="mt-1 text-xs text-[#FF5A1F]">{validity.validityLabel}</p>
              </div>

              <div className="rounded-md border border-white/10 bg-[#080808] p-4">
                <p className="text-xs text-[#A1A1AA]">Membership Plan</p>
                <p className="mt-1 text-lg font-bold text-white">{primaryMember.planName}</p>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Status: <span className="text-white">{primaryMember.memberStatus}</span>
                </p>
              </div>

              <div className="rounded-md border border-white/10 bg-[#080808] p-4">
                <p className="text-xs text-[#A1A1AA]">Valid Period</p>
                <p className="mt-1 text-sm font-semibold text-white tabular-nums">
                  {primaryMember.startDate} &rarr; {primaryMember.expiryDate}
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA] tabular-nums">
                  Joined: {primaryMember.joiningDate}
                </p>
              </div>

              <div className="rounded-md border border-white/10 bg-[#080808] p-4">
                <p className="text-xs text-[#A1A1AA]">Desk Payment Status</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {primaryMember.paymentStatus}
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Member: {primaryMember.fullName}
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Submit Existing Member Verification / Renewal Request */}
          <section className="lg:col-span-7 rounded-lg border border-white/10 bg-[#111111] p-6 sm:p-8">
            <div className="flex items-center gap-2.5 text-[#FF5A1F] mb-2">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Existing Member Verification &amp; Renewal
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Add / Claim Your Membership
            </h2>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              Submit your existing membership details or request a renewal duration. The club
              owner will review and approve how many months your membership is valid.
            </p>

            <form onSubmit={handleSubmitClaim} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="member-fullname"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="member-fullname"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="member-phone"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Registered Mobile Number
                  </label>
                  <input
                    id="member-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="member-claim-type"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Request Type
                  </label>
                  <select
                    id="member-claim-type"
                    value={claimType}
                    onChange={(e) =>
                      setClaimType(
                        e.target.value as 'Existing Member' | 'New or Renewal',
                      )
                    }
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="Existing Member">
                      Existing Member (Link My Account)
                    </option>
                    <option value="New or Renewal">
                      New Membership / Renewal Request
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="member-months"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Months Valid / Requested
                  </label>
                  <select
                    id="member-months"
                    value={monthsRequested}
                    onChange={(e) => setMonthsRequested(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? 'Month' : 'Months'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="member-plan"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Plan / Package Name
                  </label>
                  <input
                    id="member-plan"
                    type="text"
                    required
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    list="public-plan-suggestions"
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                  <datalist id="public-plan-suggestions">
                    <option value="Monthly Access" />
                    <option value="Quarterly Commitment" />
                    <option value="Annual Club Pass" />
                    {publicPlans.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="member-start-date"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Existing Start Date (Optional)
                  </label>
                  <input
                    id="member-start-date"
                    type="date"
                    value={existingStartDate}
                    onChange={(e) => setExistingStartDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="member-notes"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                >
                  Desk Receipt / Membership Notes (Optional)
                </label>
                <textarea
                  id="member-notes"
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Share desk receipt number or existing membership details to help owner verify faster..."
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3.5 py-2.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-3 rounded-md border border-white/10 bg-[#080808] p-3 text-xs text-[#A1A1AA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#FF5A1F]"
                />
                <span>
                  I authorize ASSURE FITNESS CLUB LLP to verify my membership record using my
                  Gmail ({user.email}) and display my remaining validity days here.
                </span>
              </label>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs text-white"
                >
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div
                  role="status"
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200"
                >
                  {submitSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-6 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Submitting for Approval...</span>
                  </>
                ) : (
                  <span>Submit for Owner Approval</span>
                )}
              </button>
            </form>
          </section>

          {/* Request Approval Status List */}
          <section className="lg:col-span-5 rounded-lg border border-white/10 bg-[#111111] p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2.5 text-[#FF5A1F]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Approval Queue Status
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-white">
              Your Submitted Requests
            </h2>

            {myRequests.length === 0 ? (
              <p className="text-sm text-[#A1A1AA] py-6 border-t border-white/10">
                No membership verification requests submitted yet under {user.email}.
              </p>
            ) : (
              <div className="space-y-3 border-t border-white/10 pt-4">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-md border border-white/10 bg-[#080808] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {req.planName} · {req.monthsRequested}{' '}
                        {req.monthsRequested === 1 ? 'mo' : 'mos'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                          req.status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : req.status === 'Rejected'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {req.status === 'Approved' ? (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        ) : req.status === 'Rejected' ? (
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{req.status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA]">
                      {req.claimType}
                      {req.existingStartDate ? ` · Start: ${req.existingStartDate}` : ''}
                    </p>
                    {req.status === 'Approved' && req.approvedMonths > 0 && (
                      <p className="text-xs text-emerald-300">
                        Approved for {req.approvedMonths} month(s)
                        {req.approvedBy ? ` by ${req.approvedBy}` : ''}
                      </p>
                    )}
                    {req.reviewerNotes && (
                      <p className="text-xs text-[#A1A1AA]">Note: {req.reviewerNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

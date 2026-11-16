import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Dumbbell,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  clearLoginSessionMarkers,
  createAttendanceEntry,
  recordLoginEventOncePerSession,
  resolveStaffUser,
  subscribeAdminCollection,
  subscribeTrainerAttendance,
  subscribeTrainerMembers,
  type StaffSessionUser,
} from '../lib/firestoreService';
import type { AttendanceRecord, GymMember, TrainerRecord } from '../types/gym';
import {
  computeMembershipValidity,
  hasSameDayAttendance,
  projectMemberForTrainer,
} from '../utils/adminLogic';

interface TrainerPortalProps {
  onNavigatePublic: () => void;
  onNavigateAdmin: () => void;
}

export default function TrainerPortal({
  onNavigatePublic,
  onNavigateAdmin,
}: TrainerPortalProps) {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [staffUser, setStaffUser] = useState<StaffSessionUser | null>(null);
  const [authStatus, setAuthStatus] = useState<
    'loading' | 'unauthenticated' | 'unverified' | 'unauthorized' | 'authorized'
  >('loading');
  const [signingIn, setSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const [members, setMembers] = useState<GymMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [trainerProfiles, setTrainerProfiles] = useState<TrainerRecord[]>([]);
  const [sessionId, setSessionId] = useState('Morning Floor');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const evaluateTrainerUser = async (user: User | null) => {
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
        portal: 'trainer',
        method: loginMethod,
      });
      setStaffUser(res.user);
      setAuthStatus('authorized');
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Unable to verify trainer access.',
      );
      setStaffUser(null);
      setAuthStatus('unauthorized');
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      void evaluateTrainerUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!staffUser) return;

    const unsubProfiles = subscribeAdminCollection<TrainerRecord>(
      'trainers',
      setTrainerProfiles,
    );

    if (staffUser.role === 'trainer') {
      const scopeId = staffUser.assignedTrainerId || staffUser.uid;
      const unsubMembers = subscribeTrainerMembers(scopeId, setMembers);
      const unsubAttendance = subscribeTrainerAttendance(scopeId, setAttendance);
      return () => {
        unsubProfiles();
        unsubMembers();
        unsubAttendance();
      };
    }

    const unsubAllMembers = subscribeAdminCollection<GymMember>('members', setMembers);
    const unsubAllAttendance = subscribeAdminCollection<AttendanceRecord>(
      'attendance',
      setAttendance,
    );
    return () => {
      unsubProfiles();
      unsubAllMembers();
      unsubAllAttendance();
    };
  }, [staffUser]);

  const roster = useMemo(
    () =>
      members
        .filter((m) => !m.archivedAt)
        .map((m) => ({
          ...projectMemberForTrainer(m),
          validity: computeMembershipValidity(m.expiryDate, m.memberStatus, todayIso),
        })),
    [members, todayIso],
  );

  const myTrainerProfile = useMemo(() => {
    if (!staffUser) return null;
    return (
      trainerProfiles.find(
        (t) =>
          t.staffUid === staffUser.uid ||
          (staffUser.assignedTrainerId && t.id === staffUser.assignedTrainerId),
      ) || null
    );
  }, [trainerProfiles, staffUser]);

  const handleGoogleSignIn = async () => {
    setLoginError(null);
    setInfoMsg(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Sign-in cancelled or failed.',
      );
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
      setLoginError('Please enter both trainer email and password.');
      return;
    }
    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
      setPasswordInput('');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError(
          'Email/Password sign-in must first be enabled in Firebase Console -> Authentication -> Sign-in method.',
        );
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
      ) {
        setLoginError('Invalid trainer email or password.');
      } else {
        setLoginError(
          err instanceof Error ? err.message : 'Trainer sign-in failed.',
        );
      }
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
    await evaluateTrainerUser(auth.currentUser);
  };

  const handleCheckIn = async (memberId: string, fullName: string, assignedTrainerId: string) => {
    if (!staffUser) return;
    if (hasSameDayAttendance(attendance, memberId, todayIso)) {
      setActionMsg(`${fullName} already has a check-in logged for ${todayIso}.`);
      return;
    }
    setCheckingInId(memberId);
    setActionMsg(null);
    try {
      const nowTime = new Date().toTimeString().slice(0, 5);
      await createAttendanceEntry(
        {
          memberId,
          memberName: fullName,
          assignedTrainerId: assignedTrainerId || staffUser.assignedTrainerId || staffUser.uid,
          occurredDate: todayIso,
          occurredTime: nowTime,
          recorderUid: staffUser.uid,
          recorderRole: staffUser.role,
          method: 'manual',
          sessionId: sessionId.trim() || 'Floor Session',
          isCorrection: false,
          correctionOf: '',
          reason: '',
        },
        staffUser,
      );
      setActionMsg(`Checked in ${fullName} at ${nowTime}.`);
    } catch (err) {
      setActionMsg(
        err instanceof Error ? err.message : 'Failed to log attendance.',
      );
    } finally {
      setCheckingInId(null);
    }
  };

  if (!authReady || authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF5A1F]" aria-hidden="true" />
          <p className="text-sm text-[#A1A1AA]">Verifying trainer session...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Dedicated Coaching Portal
            </span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">
            ASSURE TRAINER PORTAL
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Sign in with your verified Google or Email/Password trainer account to view your
            assigned member roster, validity countdowns, and log session check-ins.
          </p>

          {loginError && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs leading-relaxed text-white"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleEmailPasswordSignIn} className="mt-6 space-y-3">
            <div>
              <label
                htmlFor="trainer-email"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Trainer Email
              </label>
              <input
                id="trainer-email"
                type="email"
                autoComplete="username"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="trainer@assurefitness.shop"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="trainer-password"
                className="block text-xs font-medium text-[#A1A1AA] mb-1"
              >
                Password
              </label>
              <input
                id="trainer-password"
                type="password"
                autoComplete="current-password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter trainer password"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-5 text-sm font-semibold text-white hover:border-[#FF5A1F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
              <span>{signingIn ? 'Signing in...' : 'Sign in with Email & Password'}</span>
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
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
          >
            {signingIn ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in with Trainer Google Account</span>
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
              Owner / Admin Console &rarr;
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
            Verify your email address before accessing trainer roster data.
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

  if (authStatus === 'unauthorized' || !firebaseUser || !staffUser) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#111111] p-8">
          <div className="flex items-center gap-2.5 text-[#FF5A1F]">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Trainer Role Required
            </span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold text-white">
            Trainer Access Not Provisioned
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
            Signed in as <strong className="text-white">{firebaseUser?.email}</strong>, which is
            not assigned an active Trainer or Staff record. Ask the club owner to provision your
            UID in Staff &amp; RBAC.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                clearLoginSessionMarkers();
                void signOut(auth);
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out &amp; Switch Account</span>
            </button>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic();
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-5 text-sm text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Public Website</span>
            </a>
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
              ASSURE FITNESS CLUB · TRAINER WORKSPACE ({staffUser.role.toUpperCase()})
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {myTrainerProfile?.fullName || staffUser.displayName}
            </h1>
            <p className="text-xs text-[#A1A1AA]">
              {myTrainerProfile
                ? `${myTrainerProfile.specialization} · ${myTrainerProfile.experience}`
                : staffUser.email}
            </p>
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
              <span>Public Site</span>
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

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-lg border border-white/10 bg-[#111111] p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#A1A1AA]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#FF5A1F] shrink-0" aria-hidden="true" />
            <span>
              Least-privilege coaching view: displays assigned members&apos; plan validity &amp;
              attendance only (phone, email, and payment billing remain private).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="trainer-session-name" className="text-[#A1A1AA]">
              Session Slot:
            </label>
            <input
              id="trainer-session-name"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-md border border-white/15 bg-[#080808] px-2.5 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        {actionMsg && (
          <div
            role="status"
            className="rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs text-white"
          >
            {actionMsg}
          </div>
        )}

        {/* Assigned Roster + Validity + Check-in */}
        <section className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-white">
              Assigned Trainee Roster ({roster.length})
            </h2>
            <span className="text-xs text-[#A1A1AA] tabular-nums">Date: {todayIso}</span>
          </div>

          {roster.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#A1A1AA] flex flex-col items-center gap-2">
              <Users className="h-6 w-6 text-[#FF5A1F]" aria-hidden="true" />
              <span>No active members are currently assigned to your coaching roster.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                    <th className="py-3.5 px-4 font-medium">Member Name</th>
                    <th className="py-3.5 px-4 font-medium">Plan</th>
                    <th className="py-3.5 px-4 font-medium">Validity &amp; Expiry</th>
                    <th className="py-3.5 px-4 font-medium">Status</th>
                    <th className="py-3.5 px-4 text-right font-medium">Today Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {roster.map((m) => {
                    const checkedToday = hasSameDayAttendance(attendance, m.id, todayIso);
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4 font-semibold text-white">{m.fullName}</td>
                        <td className="py-3.5 px-4 text-white">{m.planName}</td>
                        <td className="py-3.5 px-4 text-xs tabular-nums">
                          <p className="text-white">{m.expiryDate}</p>
                          <p
                            className={
                              m.validity.badgeTone === 'emerald'
                                ? 'text-emerald-400'
                                : m.validity.badgeTone === 'amber'
                                ? 'text-amber-300'
                                : m.validity.badgeTone === 'red'
                                ? 'text-red-400'
                                : 'text-[#A1A1AA]'
                            }
                          >
                            {m.validity.validityLabel}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-white">
                          {m.memberStatus}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {checkedToday ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Checked In</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={checkingInId === m.id}
                              onClick={() =>
                                handleCheckIn(m.id, m.fullName, m.assignedTrainerId)
                              }
                              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md bg-[#FF5A1F] px-3 text-xs font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                            >
                              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>
                                {checkingInId === m.id ? 'Logging...' : 'Mark Present'}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent Attendance Log */}
        <section className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10">
            <h2 className="font-display text-2xl font-bold text-white">
              Recent Coaching Attendance ({attendance.length})
            </h2>
          </div>
          {attendance.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#A1A1AA]">
              No attendance check-ins logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                    <th className="py-3 px-4 font-medium">Member</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Time</th>
                    <th className="py-3 px-4 font-medium">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {attendance.slice(0, 20).map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 px-4 font-medium text-white">{a.memberName}</td>
                      <td className="py-3 px-4 text-xs text-white tabular-nums">
                        {a.occurredDate}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#A1A1AA] tabular-nums">
                        {a.occurredTime}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#A1A1AA]">
                        {a.sessionId || 'Floor Session'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

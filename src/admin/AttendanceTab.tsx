import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, History, UserCheck, X } from 'lucide-react';
import type { AttendanceRecord, GymMember } from '../types/gym';
import {
  createAttendanceEntry,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { hasSameDayAttendance } from '../utils/adminLogic';

interface AttendanceTabProps {
  attendance: AttendanceRecord[];
  members: GymMember[];
  staffUser: StaffSessionUser;
}

export default function AttendanceTab({
  attendance,
  members,
  staffUser,
}: AttendanceTabProps) {
  const activeMembers = useMemo(
    () => members.filter((m) => !m.archivedAt),
    [members],
  );
  const [selectedMemberId, setSelectedMemberId] = useState(
    activeMembers[0]?.id || '',
  );
  const [occurredDate, setOccurredDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [occurredTime, setOccurredTime] = useState(
    new Date().toTimeString().slice(0, 5),
  );
  const [sessionId, setSessionId] = useState('');
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Append-only correction modal
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionTime, setCorrectionTime] = useState('07:00');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const effectiveMemberId = selectedMemberId || activeMembers[0]?.id || '';
  const selectedMember = activeMembers.find((m) => m.id === effectiveMemberId);
  const duplicateDetected = Boolean(
    effectiveMemberId && hasSameDayAttendance(attendance, effectiveMemberId, occurredDate),
  );

  const sortedRecords = useMemo(
    () =>
      [...attendance].sort((a, b) =>
        `${b.occurredDate}T${b.occurredTime}`.localeCompare(
          `${a.occurredDate}T${a.occurredTime}`,
        ),
      ),
    [attendance],
  );

  const handleCheckIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setError('Select a member to check in.');
      return;
    }
    if (duplicateDetected && !confirmDuplicate) {
      setError(
        'Same-day check-in already logged for this member. Confirm duplicate override below if intentional.',
      );
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMsg(null);
    try {
      await createAttendanceEntry(
        {
          memberId: selectedMember.id,
          memberName: selectedMember.fullName,
          assignedTrainerId: selectedMember.assignedTrainerId || '',
          occurredDate,
          occurredTime,
          recorderUid: staffUser.uid,
          recorderRole: staffUser.role,
          method: 'manual',
          sessionId: sessionId.trim(),
          isCorrection: false,
          correctionOf: '',
          reason: duplicateDetected ? 'Confirmed duplicate same-day check-in' : '',
        },
        staffUser,
      );
      setStatusMsg(`Manual check-in recorded for ${selectedMember.fullName}.`);
      setConfirmDuplicate(false);
      setSessionId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attendance.');
    } finally {
      setSaving(false);
    }
  };

  const handleCorrectionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    if (correctionReason.trim().length < 3) {
      setError('A correction reason (at least 3 characters) is required.');
      return;
    }

    setSavingCorrection(true);
    setError(null);
    try {
      await createAttendanceEntry(
        {
          memberId: correctingRecord.memberId,
          memberName: correctingRecord.memberName,
          assignedTrainerId: correctingRecord.assignedTrainerId,
          occurredDate: correctingRecord.occurredDate,
          occurredTime: correctionTime,
          recorderUid: staffUser.uid,
          recorderRole: staffUser.role,
          method: 'manual',
          sessionId: correctingRecord.sessionId,
          isCorrection: true,
          correctionOf: correctingRecord.id,
          reason: correctionReason.trim().slice(0, 300),
        },
        staffUser,
      );
      setStatusMsg(
        `Append-only correction entry logged for ${correctingRecord.memberName}.`,
      );
      setCorrectingRecord(null);
      setCorrectionReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log correction.');
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">Manual Attendance Log</h2>
        <p className="text-xs text-[#A1A1AA]">
          Desk and trainer manual check-ins with same-day duplicate warning and immutable append-only correction history
        </p>
      </div>

      {/* Manual Check-In Form */}
      <section className="rounded-lg border border-white/10 bg-[#111111] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
          <h3 className="font-display text-2xl font-bold text-white">
            Record Manual Check-In
          </h3>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-[#FF5A1F]">
            {error}
          </p>
        )}
        {statusMsg && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{statusMsg}</span>
          </div>
        )}

        <form onSubmit={handleCheckIn} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Member
              </label>
              <select
                required
                value={effectiveMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setConfirmDuplicate(false);
                }}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              >
                {activeMembers.length === 0 ? (
                  <option value="">No assigned active members</option>
                ) : (
                  activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.planName})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={occurredDate}
                onChange={(e) => {
                  setOccurredDate(e.target.value);
                  setConfirmDuplicate(false);
                }}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Check-In Time
              </label>
              <input
                type="time"
                required
                value={occurredTime}
                onChange={(e) => setOccurredTime(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Session / Slot Note (Optional)
              </label>
              <input
                type="text"
                maxLength={80}
                placeholder="e.g. Morning Strength"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
              />
            </div>
          </div>

          {duplicateDetected && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <span>
                  This member already has a check-in logged on {occurredDate}.
                </span>
              </div>
              <label className="inline-flex items-center gap-2 font-semibold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmDuplicate}
                  onChange={(e) => setConfirmDuplicate(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Allow second check-in today</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || activeMembers.length === 0}
            className="min-h-[42px] rounded-md bg-[#FF5A1F] px-6 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Recording...' : 'Record Manual Check-In'}
          </button>
        </form>
      </section>

      {/* Immutable History */}
      <section className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
          <History className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
          <h3 className="font-display text-xl font-bold text-white">
            Immutable Attendance &amp; Correction History
          </h3>
        </div>

        {sortedRecords.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            No attendance entries recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3 px-4 font-medium">Member</th>
                  <th className="py-3 px-4 font-medium">Date &amp; Time</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Recorded By</th>
                  <th className="py-3 px-4 font-medium">Reason / Session</th>
                  <th className="py-3 px-4 text-right font-medium">Append Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-semibold text-white">{rec.memberName}</td>
                    <td className="py-3 px-4 text-xs text-white tabular-nums">
                      {rec.occurredDate} · {rec.occurredTime}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={
                          rec.isCorrection
                            ? 'font-semibold text-amber-400'
                            : 'font-semibold text-emerald-400'
                        }
                      >
                        {rec.isCorrection ? 'Correction' : 'Check-In'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A1A1AA] uppercase">
                      {rec.recorderRole}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A1A1AA]">
                      {rec.reason || rec.sessionId || 'Manual desk entry'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!rec.isCorrection && (
                        <button
                          type="button"
                          onClick={() => {
                            setCorrectingRecord(rec);
                            setCorrectionTime(rec.occurredTime);
                            setCorrectionReason('');
                          }}
                          className="rounded-md border border-white/15 bg-[#080808] px-3 py-1.5 text-xs text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          Log Correction
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {correctingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Append attendance correction"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="font-display text-2xl font-bold text-white">
                Append-Only Correction
              </h3>
              <button
                type="button"
                onClick={() => setCorrectingRecord(null)}
                aria-label="Close correction modal"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[#A1A1AA] mb-4">
              Original check-in for <strong className="text-white">{correctingRecord.memberName}</strong>{' '}
              on {correctingRecord.occurredDate} remains immutable. This appends a reasoned correction entry.
            </p>
            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Corrected Time
                </label>
                <input
                  type="time"
                  required
                  value={correctionTime}
                  onChange={(e) => setCorrectionTime(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Reason for Correction (Required)
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  maxLength={300}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Logged against wrong evening batch time"
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white cursor-pointer"
                >
                  {savingCorrection ? 'Saving...' : 'Append Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import { CalendarPlus, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import type {
  GymMember,
  MembershipPlanRecord,
  MembershipRecord,
} from '../types/gym';
import {
  removeMembershipRecord,
  saveMember,
  saveMembershipRecord,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { addDaysToIsoDate } from '../utils/adminLogic';

interface MembershipsTabProps {
  memberships: MembershipRecord[];
  members: GymMember[];
  plans: MembershipPlanRecord[];
  staffUser: StaffSessionUser;
}

export default function MembershipsTab({
  memberships,
  members,
  plans,
  staffUser,
}: MembershipsTabProps) {
  const isOwner = staffUser.role === 'owner';
  const activeMembers = useMemo(
    () => members.filter((m) => !m.archivedAt),
    [members],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startAt, setStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [endAt, setEndAt] = useState(
    addDaysToIsoDate(new Date().toISOString().slice(0, 10), 30),
  );
  const [status, setStatus] = useState<MembershipRecord['status']>('Active');
  const [syncMember, setSyncMember] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MembershipRecord | null>(null);

  const openAssign = () => {
    const firstMember = activeMembers[0];
    const firstPlan = plans.find((p) => p.active) || plans[0];
    const today = new Date().toISOString().slice(0, 10);
    setEditingId(null);
    setMemberId(firstMember?.id || '');
    setPlanId(firstPlan?.id || '');
    setStartAt(today);
    setEndAt(addDaysToIsoDate(today, firstPlan?.durationDays || 30));
    setStatus('Active');
    setSyncMember(true);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (rec: MembershipRecord) => {
    setEditingId(rec.id);
    setMemberId(rec.memberId);
    setPlanId(rec.planId);
    setStartAt(rec.startAt);
    setEndAt(rec.endAt);
    setStatus(rec.status);
    setSyncMember(true);
    setError(null);
    setModalOpen(true);
  };

  const handlePlanChange = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    const chosen = plans.find((p) => p.id === nextPlanId);
    if (chosen) {
      setEndAt(addDaysToIsoDate(startAt, chosen.durationDays));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const member = activeMembers.find((m) => m.id === memberId) || members.find((m) => m.id === memberId);
    const plan = plans.find((p) => p.id === planId);
    if (!member) {
      setError('Select a valid member.');
      return;
    }
    if (!plan) {
      setError('Select an existing membership plan.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveMembershipRecord(
        {
          memberId: member.id,
          memberName: member.fullName,
          planId: plan.id,
          planName: plan.name,
          startAt,
          endAt,
          status,
          actorUid: staffUser.uid,
        },
        editingId || undefined,
        staffUser,
      );

      if (syncMember) {
        await saveMember(
          {
            fullName: member.fullName,
            phone: member.phone,
            email: member.email,
            joiningDate: member.joiningDate,
            planId: plan.id,
            planName: plan.name,
            startDate: startAt,
            expiryDate: endAt,
            paymentStatus: member.paymentStatus,
            memberStatus:
              status === 'Cancelled' ? 'Paused' : status,
            assignedTrainerId: member.assignedTrainerId,
            consentConfirmed: member.consentConfirmed,
            archivedAt: member.archivedAt,
            notes: member.notes,
          },
          member.id,
          staffUser,
        );
      }

      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save membership assignment.');
    } finally {
      setSaving(false);
    }
  };

  const sorted = useMemo(
    () => [...memberships].sort((a, b) => b.startAt.localeCompare(a.startAt)),
    [memberships],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Membership Assignments</h2>
          <p className="text-xs text-[#A1A1AA]">
            Assign, renew, pause, or cancel member terms linked directly to club plans
          </p>
        </div>
        <button
          type="button"
          onClick={openAssign}
          disabled={activeMembers.length === 0 || plans.length === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          <span>Assign / Renew Membership</span>
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            No membership assignment records yet. Use Assign / Renew Membership to link a member to
            a plan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Member</th>
                  <th className="py-3.5 px-4 font-medium">Plan</th>
                  <th className="py-3.5 px-4 font-medium">Term Window</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sorted.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4 font-semibold text-white">{rec.memberName}</td>
                    <td className="py-3.5 px-4 text-white">{rec.planName}</td>
                    <td className="py-3.5 px-4 text-xs text-[#A1A1AA] tabular-nums">
                      {rec.startAt} to {rec.endAt}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold ${
                          rec.status === 'Active'
                            ? 'text-emerald-400'
                            : rec.status === 'Expired'
                            ? 'text-red-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(rec)}
                          aria-label={`Edit membership for ${rec.memberName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(rec)}
                            aria-label={`Delete membership for ${rec.memberName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Membership assignment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
                <span>{editingId ? 'Update Membership Term' : 'Assign / Renew Membership'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close membership modal"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-4 text-xs font-medium text-[#FF5A1F]">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Member
                </label>
                <select
                  required
                  disabled={Boolean(editingId)}
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white disabled:opacity-60 focus:border-[#FF5A1F] focus:outline-none"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Membership Plan
                </label>
                <select
                  required
                  value={planId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration} · {p.durationDays}d)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startAt}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartAt(next);
                      const chosen = plans.find((p) => p.id === planId);
                      if (chosen) setEndAt(addDaysToIsoDate(next, chosen.durationDays));
                    }}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Term Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MembershipRecord['status'])}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Expired">Expired</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncMember}
                  onChange={(e) => setSyncMember(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Synchronize linked Member Directory plan &amp; expiry dates</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Membership'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete membership record"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Remove membership term for {confirmDelete.memberName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently removes this membership history entry.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await removeMembershipRecord(confirmDelete.id, staffUser);
                  setConfirmDelete(null);
                }}
                className="min-h-[42px] rounded-md bg-red-600 px-5 text-sm font-semibold text-white cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

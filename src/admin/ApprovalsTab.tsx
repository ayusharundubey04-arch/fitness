import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type {
  GymMember,
  MembershipPlanRecord,
  MembershipRequestRecord,
  MemberStatus,
  PaymentStatus,
  TrainerRecord,
} from '../types/gym';
import {
  approveMembershipRequest,
  rejectMembershipRequest,
  removeMembershipRequest,
  type StaffSessionUser,
} from '../lib/firestoreService';
import {
  addMonthsToIsoDate,
  computeMembershipValidity,
  normalizeEmail,
} from '../utils/adminLogic';

interface ApprovalsTabProps {
  requests: MembershipRequestRecord[];
  members: GymMember[];
  plans: MembershipPlanRecord[];
  trainers: TrainerRecord[];
  staffUser: StaffSessionUser;
}

export default function ApprovalsTab({
  requests,
  members,
  plans,
  trainers,
  staffUser,
}: ApprovalsTabProps) {
  const isOwner = staffUser.role === 'owner';
  const todayIso = new Date().toISOString().slice(0, 10);

  const [statusFilter, setStatusFilter] = useState<'Pending' | 'All' | 'Approved' | 'Rejected'>(
    'Pending',
  );

  const [approvingReq, setApprovingReq] = useState<MembershipRequestRecord | null>(
    null,
  );
  const [approvedMonths, setApprovedMonths] = useState(3);
  const [startDate, setStartDate] = useState(todayIso);
  const [planId, setPlanId] = useState('');
  const [planName, setPlanName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('Active');
  const [assignedTrainerId, setAssignedTrainerId] = useState('');
  const [existingMemberId, setExistingMemberId] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rejectingReq, setRejectingReq] = useState<MembershipRequestRecord | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState('');

  const filteredRequests = useMemo(() => {
    const base =
      statusFilter === 'All'
        ? requests
        : requests.filter((r) => r.status === statusFilter);
    return [...base].sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return b.id.localeCompare(a.id);
    });
  }, [requests, statusFilter]);

  const pendingPaymentMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          !m.archivedAt &&
          (m.paymentStatus === 'Pending' ||
            m.paymentStatus === 'Partial' ||
            m.memberStatus !== 'Active'),
      ),
    [members],
  );

  const openApproveModal = (req: MembershipRequestRecord) => {
    const matchedMember = members.find(
      (m) =>
        !m.archivedAt &&
        ((m.userUid && m.userUid === req.userUid) ||
          (m.email && normalizeEmail(m.email) === normalizeEmail(req.email))),
    );
    const matchedPlan =
      plans.find((p) => p.name.toLowerCase() === req.planName.toLowerCase()) ||
      plans[0];

    setApprovingReq(req);
    setApprovedMonths(req.monthsRequested || 1);
    setStartDate(req.existingStartDate || todayIso);
    setPlanId(matchedPlan?.id || '');
    setPlanName(req.planName || matchedPlan?.name || `${req.monthsRequested} Month Membership`);
    setPaymentStatus('Paid');
    setMemberStatus('Active');
    setAssignedTrainerId(matchedMember?.assignedTrainerId || '');
    setExistingMemberId(matchedMember?.id || '');
    setReviewerNotes('');
    setActionError(null);
  };

  const handleConfirmApprove = async (e: FormEvent) => {
    e.preventDefault();
    if (!approvingReq) return;
    if (approvedMonths < 1 || approvedMonths > 36) {
      setActionError('Approved duration must be between 1 and 36 months.');
      return;
    }

    const linkedExisting = members.find((m) => m.id === existingMemberId);
    const catalogPlan = plans.find((p) => p.id === planId);

    setSubmitting(true);
    setActionError(null);
    try {
      await approveMembershipRequest(
        approvingReq,
        {
          approvedMonths,
          startDate,
          planId: catalogPlan?.id || `custom_${approvedMonths}m`,
          planName: planName.trim() || `${approvedMonths} Month Membership`,
          paymentStatus,
          memberStatus,
          assignedTrainerId,
          existingMemberId: linkedExisting?.id,
          existingJoiningDate: linkedExisting?.joiningDate,
          reviewerNotes,
          planExistsInCatalog: Boolean(catalogPlan),
        },
        staffUser,
      );
      setApprovingReq(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to approve membership request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await rejectMembershipRequest(
        rejectingReq.id,
        rejectReason || 'Declined by club administration',
        staffUser,
      );
      setRejectingReq(null);
      setRejectReason('');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reject membership request.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewExpiry = addMonthsToIsoDate(startDate, approvedMonths);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">
            Pending Membership Approvals
          </h2>
          <p className="text-xs text-[#A1A1AA]">
            Review member Gmail claims and approve exact membership validity in months.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`min-h-[36px] rounded-md px-3 text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#FF5A1F] text-white'
                  : 'border border-white/10 bg-[#111111] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs text-white"
        >
          {actionError}
        </div>
      )}

      {/* Gmail Member Requests Queue */}
      <section className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-white">
              Gmail Verification &amp; Duration Requests ({filteredRequests.length})
            </h3>
          </div>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            No {statusFilter === 'All' ? '' : statusFilter.toLowerCase()} membership requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3 px-4 font-medium">Applicant / Gmail</th>
                  <th className="py-3 px-4 font-medium">Type &amp; Plan</th>
                  <th className="py-3 px-4 font-medium">Months</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{req.fullName}</p>
                      <p className="text-xs text-[#A1A1AA]">{req.email}</p>
                      <p className="text-xs text-[#A1A1AA] tabular-nums">{req.phone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-white">{req.planName}</p>
                      <p className="text-xs text-[#A1A1AA]">
                        {req.claimType}
                        {req.existingStartDate ? ` · Start ${req.existingStartDate}` : ''}
                      </p>
                      {req.notes && (
                        <p className="text-xs text-[#A1A1AA] mt-0.5 max-w-xs truncate">
                          Note: {req.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <span className="font-semibold text-white">
                        {req.monthsRequested} {req.monthsRequested === 1 ? 'month' : 'months'}
                      </span>
                      {req.status === 'Approved' && req.approvedMonths > 0 && (
                        <p className="text-xs text-emerald-400">
                          Approved: {req.approvedMonths} mo(s)
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                          req.status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : req.status === 'Rejected'
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {req.status === 'Pending' && (
                          <Clock className="h-3 w-3" aria-hidden="true" />
                        )}
                        {req.status === 'Approved' && (
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        )}
                        {req.status === 'Rejected' && (
                          <XCircle className="h-3 w-3" aria-hidden="true" />
                        )}
                        <span>{req.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                      {req.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openApproveModal(req)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-md bg-[#FF5A1F] px-3 text-xs font-semibold text-white hover:bg-[#e54c14] cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Approve Months</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingReq(req);
                              setRejectReason('');
                            }}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-white/15 bg-[#080808] px-3 text-xs font-medium text-[#A1A1AA] hover:text-white cursor-pointer"
                          >
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          aria-label={`Delete request from ${req.fullName}`}
                          onClick={() => removeMembershipRequest(req.id, staffUser)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Pending Payment / Non-Active Desk Members */}
      <section className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">
            Existing Members with Pending Payment or Renewal ({pendingPaymentMembers.length})
          </h3>
          <p className="text-xs text-[#A1A1AA]">
            Directory members currently marked Pending/Partial payment or Expired/Paused status.
          </p>
        </div>

        {pendingPaymentMembers.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#A1A1AA]">
            All active directory members are settled and up to date.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3 px-4 font-medium">Member</th>
                  <th className="py-3 px-4 font-medium">Plan</th>
                  <th className="py-3 px-4 font-medium">Expiry &amp; Validity</th>
                  <th className="py-3 px-4 font-medium">Payment</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {pendingPaymentMembers.map((m) => {
                  const v = computeMembershipValidity(m.expiryDate, m.memberStatus, todayIso);
                  return (
                    <tr key={m.id}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-white">{m.fullName}</p>
                        <p className="text-xs text-[#A1A1AA]">
                          {m.email || m.phone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-white">{m.planName}</td>
                      <td className="py-3 px-4 text-xs tabular-nums">
                        <p className="text-white">{m.expiryDate}</p>
                        <p className="text-[#FF5A1F]">{v.validityLabel}</p>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-amber-300">
                        {m.paymentStatus}
                      </td>
                      <td className="py-3 px-4 text-xs text-white">{m.memberStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Approve Request Modal */}
      {approvingReq && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Approve member request and set validity months"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#FF5A1F]">
                  Approve Member Validity
                </p>
                <h3 className="font-display text-2xl font-bold text-white">
                  {approvingReq.fullName}
                </h3>
                <p className="text-xs text-[#A1A1AA]">{approvingReq.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                aria-label="Close approval modal"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmApprove} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="approve-months"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Approve For (Months)
                  </label>
                  <input
                    id="approve-months"
                    type="number"
                    min={1}
                    max={36}
                    required
                    value={approvedMonths}
                    onChange={(e) => setApprovedMonths(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="approve-start"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Membership Start Date
                  </label>
                  <input
                    id="approve-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200 tabular-nums">
                Computed Expiry Date: <strong>{previewExpiry}</strong> ({approvedMonths}{' '}
                {approvedMonths === 1 ? 'month' : 'months'})
              </div>

              <div>
                <label
                  htmlFor="approve-existing-member"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                >
                  Link to Existing Member Record (Optional)
                </label>
                <select
                  id="approve-existing-member"
                  value={existingMemberId}
                  onChange={(e) => setExistingMemberId(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                >
                  <option value="">Create New Member Record</option>
                  {members
                    .filter((m) => !m.archivedAt)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.phone}
                        {m.email ? ` · ${m.email}` : ''})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="approve-plan"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Plan Label
                  </label>
                  <input
                    id="approve-plan"
                    type="text"
                    required
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="approve-payment"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Payment Status
                  </label>
                  <select
                    id="approve-payment"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="approve-trainer"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                >
                  Assign Trainer (Optional)
                </label>
                <select
                  id="approve-trainer"
                  value={assignedTrainerId}
                  onChange={(e) => setAssignedTrainerId(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                >
                  <option value="">Unassigned</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.staffUid || t.id}>
                      {t.fullName} ({t.specialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="approve-notes"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                >
                  Approval Note (Shown to Member)
                </label>
                <input
                  id="approve-notes"
                  type="text"
                  maxLength={300}
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="e.g., Verified desk receipt #104"
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setApprovingReq(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-xs font-medium text-[#A1A1AA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-xs font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Approving...'
                    : `Approve for ${approvedMonths} ${approvedMonths === 1 ? 'Month' : 'Months'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Request Modal */}
      {rejectingReq && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reject membership request"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Reject Request from {rejectingReq.fullName}
            </h3>
            <p className="mt-1 text-xs text-[#A1A1AA]">{rejectingReq.email}</p>
            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="reject-reason"
                  className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                >
                  Reason / Note
                </label>
                <input
                  id="reject-reason"
                  type="text"
                  required
                  maxLength={300}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., No matching reception payment found"
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="min-h-[40px] rounded-md border border-white/15 bg-[#080808] px-4 text-xs text-[#A1A1AA] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[40px] rounded-md bg-red-600 px-5 text-xs font-semibold text-white cursor-pointer"
                >
                  {submitting ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

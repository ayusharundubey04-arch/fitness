import { useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  GymMember,
  MembershipPlanRecord,
  MembershipRecord,
  PaymentMethod,
  PaymentRecord,
  SiteSettingsRecord,
} from '../types/gym';
import { auth } from '../lib/firebase';
import {
  removePayment,
  saveMember,
  savePayment,
  type StaffSessionUser,
} from '../lib/firestoreService';
import {
  computePaymentAmounts,
  formatInr,
  generateReceiptHtml,
} from '../utils/adminLogic';
import { BUSINESS_INFO } from '../data/clubData';

interface PaymentsTabProps {
  payments: PaymentRecord[];
  members: GymMember[];
  plans: MembershipPlanRecord[];
  memberships: MembershipRecord[];
  settings: SiteSettingsRecord | null;
  staffUser: StaffSessionUser;
}

export default function PaymentsTab({
  payments,
  members,
  plans,
  memberships,
  settings,
  staffUser,
}: PaymentsTabProps) {
  const isOwner = staffUser.role === 'owner';
  const activeMembers = useMemo(
    () => members.filter((m) => !m.archivedAt),
    [members],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [membershipId, setMembershipId] = useState('');
  const [planName, setPlanName] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [syncMemberStatus, setSyncMemberStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [previewReceipt, setPreviewReceipt] = useState<PaymentRecord | null>(null);
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PaymentRecord | null>(null);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) =>
        b.transactionDate.localeCompare(a.transactionDate),
      ),
    [payments],
  );

  const totals = useMemo(() => {
    const settled = payments.filter((p) => p.status !== 'Refunded');
    const collected = settled.reduce((sum, p) => sum + Math.max(0, p.paidAmount), 0);
    const pending = settled.reduce((sum, p) => sum + Math.max(0, p.pendingAmount), 0);
    return { collected, pending };
  }, [payments]);

  const memberMemberships = useMemo(
    () => memberships.filter((ms) => ms.memberId === memberId),
    [memberships, memberId],
  );

  const openRecordModal = () => {
    const firstMember = activeMembers[0];
    const matchedPlan = firstMember
      ? plans.find((p) => p.id === firstMember.planId)
      : undefined;
    const firstMembership = firstMember
      ? memberships.find((ms) => ms.memberId === firstMember.id)
      : undefined;
    const defaultTotal = matchedPlan?.priceAmount || 0;
    setMemberId(firstMember?.id || '');
    setMembershipId(firstMembership?.id || '');
    setPlanName(firstMember?.planName || matchedPlan?.name || '');
    setTotalAmount(defaultTotal);
    setPaidAmount(defaultTotal);
    setPaymentMethod('UPI');
    setReference('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setSyncMemberStatus(true);
    setFormError(null);
    setModalOpen(true);
  };

  const handleMemberSelect = (selectedMemberId: string) => {
    setMemberId(selectedMemberId);
    const m = activeMembers.find((mem) => mem.id === selectedMemberId);
    if (!m) return;
    setPlanName(m.planName);
    const matchedMembership = memberships.find((ms) => ms.memberId === m.id);
    setMembershipId(matchedMembership?.id || '');
    const matchedPlan = plans.find((p) => p.id === m.planId);
    if (matchedPlan && matchedPlan.priceAmount > 0) {
      setTotalAmount(matchedPlan.priceAmount);
      setPaidAmount(matchedPlan.priceAmount);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const member = activeMembers.find((m) => m.id === memberId);
    if (!member) {
      setFormError('Please select a valid member before recording payment.');
      return;
    }
    if (totalAmount < 0 || paidAmount < 0 || paidAmount > totalAmount) {
      setFormError('Paid amount must be between ₹0 and total amount.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Staff authentication required.');
      const token = await user.getIdToken();

      const resp = await fetch('/api/validate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create',
          memberId: member.id,
          memberName: member.fullName,
          planName: planName.trim() || member.planName,
          totalAmount,
          paidAmount,
          paymentMethod,
          transactionDate,
        }),
      });

      const result = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        validated?: {
          totalAmount: number;
          paidAmount: number;
          pendingAmount: number;
          status: PaymentRecord['status'];
          receiptNumber: string;
        };
      };

      if (!resp.ok || !result.ok || !result.validated) {
        throw new Error(result.error || 'Server payment validation failed.');
      }

      await savePayment(
        {
          memberId: member.id,
          membershipId,
          memberName: member.fullName,
          planName: (planName.trim() || member.planName).slice(0, 100),
          currency: 'INR',
          totalAmount: result.validated.totalAmount,
          paidAmount: result.validated.paidAmount,
          pendingAmount: result.validated.pendingAmount,
          status: result.validated.status,
          paymentMethod,
          reference: reference.trim().slice(0, 120),
          recorderUid: staffUser.uid,
          reconciled: false,
          reconciledBy: '',
          refundReason: '',
          transactionDate,
          receiptNumber: result.validated.receiptNumber,
          notes: notes.trim().slice(0, 300),
        },
        undefined,
        staffUser,
      );

      if (syncMemberStatus) {
        await saveMember(
          {
            fullName: member.fullName,
            phone: member.phone,
            email: member.email,
            joiningDate: member.joiningDate,
            planId: member.planId,
            planName: member.planName,
            startDate: member.startDate,
            expiryDate: member.expiryDate,
            paymentStatus: result.validated.status,
            memberStatus: member.memberStatus,
            assignedTrainerId: member.assignedTrainerId || '',
            consentConfirmed: Boolean(member.consentConfirmed),
            archivedAt: member.archivedAt || '',
            notes: member.notes || '',
          },
          member.id,
          staffUser,
        );
      }

      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleOwnerReconcile = async (payment: PaymentRecord) => {
    if (!isOwner || payment.reconciled || payment.status === 'Refunded') return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const resp = await fetch('/api/validate-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'reconcile',
        memberId: payment.memberId,
        memberName: payment.memberName,
        planName: payment.planName,
        totalAmount: payment.totalAmount,
        paidAmount: payment.paidAmount,
        paymentMethod: payment.paymentMethod,
        transactionDate: payment.transactionDate,
      }),
    });
    if (!resp.ok) return;

    await savePayment(
      {
        ...payment,
        reconciled: true,
        reconciledBy: staffUser.email,
      },
      payment.id,
      staffUser,
    );
  };

  const handleOwnerRefund = async (e: FormEvent) => {
    e.preventDefault();
    if (!refundTarget || !isOwner) return;
    if (refundReason.trim().length < 3) {
      setRefundError('Refund reason must be at least 3 characters.');
      return;
    }
    setRefunding(true);
    setRefundError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Owner authentication required.');

      const resp = await fetch('/api/validate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'refund',
          memberId: refundTarget.memberId,
          memberName: refundTarget.memberName,
          planName: refundTarget.planName,
          totalAmount: refundTarget.totalAmount,
          paidAmount: 0,
          paymentMethod: refundTarget.paymentMethod,
          transactionDate: refundTarget.transactionDate,
          refundReason: refundReason.trim(),
        }),
      });
      const res = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !res.ok) {
        throw new Error(res.error || 'Refund validation failed.');
      }

      await savePayment(
        {
          ...refundTarget,
          paidAmount: 0,
          pendingAmount: 0,
          status: 'Refunded',
          reconciled: true,
          reconciledBy: staffUser.email,
          refundReason: refundReason.trim().slice(0, 300),
        },
        refundTarget.id,
        staffUser,
      );

      setRefundTarget(null);
      setRefundReason('');
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund failed.');
    } finally {
      setRefunding(false);
    }
  };

  const downloadReceipt = (payment: PaymentRecord) => {
    const approvedPhone = settings?.phoneApproved ? settings.phoneDisplay : '';
    const html = generateReceiptHtml(
      payment,
      settings?.address || BUSINESS_INFO.address,
      approvedPhone,
    );
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${payment.receiptNumber}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const previewComputed = computePaymentAmounts(totalAmount, paidAmount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Payment Ledger</h2>
          <p className="text-xs text-[#A1A1AA]">
            Desk / UPI / card recording with owner-only reconciliation &amp; refunds (no online gateway settlement claimed)
          </p>
        </div>
        <button
          type="button"
          onClick={openRecordModal}
          disabled={activeMembers.length === 0}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
          <p className="text-xs text-[#A1A1AA]">Net Collected (Excl. Refunded)</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-emerald-400 tabular-nums">
            {formatInr(totals.collected)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
          <p className="text-xs text-[#A1A1AA]">Total Pending Balance</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-[#FF5A1F] tabular-nums">
            {formatInr(totals.pending)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#111111] p-5">
          <p className="text-xs text-[#A1A1AA]">Recorded Receipts</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-white tabular-nums">
            {payments.length}
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {sortedPayments.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            {activeMembers.length === 0
              ? 'Add at least one active member in Member Directory before recording payments.'
              : 'No payments recorded yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Receipt #</th>
                  <th className="py-3.5 px-4 font-medium">Member</th>
                  <th className="py-3.5 px-4 font-medium">Plan &amp; Method</th>
                  <th className="py-3.5 px-4 font-medium">Date</th>
                  <th className="py-3.5 px-4 font-medium">Paid / Total</th>
                  <th className="py-3.5 px-4 font-medium">Status &amp; Audit</th>
                  <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4 font-medium text-white tabular-nums">
                      <p>{payment.receiptNumber}</p>
                      {payment.reference && (
                        <p className="text-[11px] text-[#A1A1AA]">Ref: {payment.reference}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-white">{payment.memberName}</td>
                    <td className="py-3.5 px-4">
                      <p className="text-white">{payment.planName}</p>
                      <p className="text-xs text-[#A1A1AA]">{payment.paymentMethod}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#A1A1AA] tabular-nums">
                      {payment.transactionDate}
                    </td>
                    <td className="py-3.5 px-4 text-white tabular-nums">
                      <p>
                        {formatInr(payment.paidAmount)} / {formatInr(payment.totalAmount)}
                      </p>
                      <p className="text-xs text-[#FF5A1F]">
                        Pending: {formatInr(payment.pendingAmount)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-xs font-semibold ${
                          payment.status === 'Paid'
                            ? 'text-emerald-400'
                            : payment.status === 'Partial'
                            ? 'text-amber-400'
                            : payment.status === 'Refunded'
                            ? 'text-zinc-400'
                            : 'text-[#FF5A1F]'
                        }`}
                      >
                        {payment.status}
                      </span>
                      <p className="text-[11px] text-[#A1A1AA]">
                        {payment.reconciled
                          ? `Reconciled (${payment.reconciledBy})`
                          : 'Unreconciled'}
                      </p>
                      {payment.refundReason && (
                        <p className="text-[11px] text-amber-400">
                          Refund: {payment.refundReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOwner && !payment.reconciled && payment.status !== 'Refunded' && (
                          <button
                            type="button"
                            onClick={() => handleOwnerReconcile(payment)}
                            aria-label={`Reconcile ${payment.receiptNumber}`}
                            title="Owner Reconcile"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                        {isOwner && payment.status !== 'Refunded' && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefundTarget(payment);
                              setRefundReason('');
                              setRefundError(null);
                            }}
                            aria-label={`Refund ${payment.receiptNumber}`}
                            title="Owner Refund"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-amber-400 hover:border-amber-400/50 cursor-pointer"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewReceipt(payment)}
                          aria-label={`Preview receipt ${payment.receiptNumber}`}
                          title="Preview Receipt"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadReceipt(payment)}
                          aria-label={`Download receipt ${payment.receiptNumber}`}
                          title="Download Receipt"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#FF5A1F] hover:border-[#FF5A1F] cursor-pointer"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(payment)}
                            aria-label={`Delete receipt ${payment.receiptNumber}`}
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

      {/* Record Payment Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Record payment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white">
                Record Desk / Offline Payment
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close payment form"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <p role="alert" className="mb-4 text-xs font-medium text-[#FF5A1F]">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Member
                </label>
                <select
                  required
                  value={memberId}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              {memberMemberships.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Linked Membership Term (Optional)
                  </label>
                  <select
                    value={membershipId}
                    onChange={(e) => setMembershipId(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="">General / Unlinked</option>
                    {memberMemberships.map((ms) => (
                      <option key={ms.id} value={ms.id}>
                        {ms.planName} ({ms.startAt} to {ms.endAt})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Plan / Bill Description
                </label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Total Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={totalAmount}
                    required
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Recorded Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-[#080808] px-4 py-3 flex items-center justify-between text-xs">
                <span className="text-[#A1A1AA]">
                  Calculated Status: <strong className="text-white">{previewComputed.status}</strong>
                </span>
                <span className="text-[#FF5A1F] tabular-nums font-semibold">
                  Pending: {formatInr(previewComputed.pendingAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Desk Reference / UTR (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Manual UPI slip ref / desk cash book #"
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncMemberStatus}
                  onChange={(e) => setSyncMemberStatus(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Also update linked member payment status to {previewComputed.status}</span>
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
                  {saving ? 'Validating & Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Refund Modal */}
      {refundTarget && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Refund receipt ${refundTarget.receiptNumber}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Refund {refundTarget.receiptNumber}?
            </h3>
            <p className="mt-1 text-xs text-[#A1A1AA]">
              Owner-only action for {refundTarget.memberName} ({formatInr(refundTarget.paidAmount)}).
            </p>
            {refundError && (
              <p role="alert" className="mt-3 text-xs font-medium text-[#FF5A1F]">
                {refundError}
              </p>
            )}
            <form onSubmit={handleOwnerRefund} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Refund Reason (Required, recorded in audit log)
                </label>
                <textarea
                  rows={3}
                  required
                  minLength={3}
                  maxLength={300}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Duplicate desk entry / owner-approved membership cancellation"
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRefundTarget(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="min-h-[42px] rounded-md bg-amber-600 px-5 text-sm font-semibold text-white cursor-pointer"
                >
                  {refunding ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt ${previewReceipt.receiptNumber}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-[#FF5A1F]">
                <Receipt className="h-5 w-5" aria-hidden="true" />
                <span className="font-display text-2xl font-bold text-white">
                  {previewReceipt.receiptNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                aria-label="Close receipt preview"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#A1A1AA]">Member</dt>
                <dd className="font-semibold text-white">{previewReceipt.memberName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#A1A1AA]">Plan</dt>
                <dd className="text-white">{previewReceipt.planName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#A1A1AA]">Date &amp; Method</dt>
                <dd className="text-white tabular-nums">
                  {previewReceipt.transactionDate} · {previewReceipt.paymentMethod}
                </dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-3">
                <dt className="text-[#A1A1AA]">Total Amount</dt>
                <dd className="text-white tabular-nums">
                  {formatInr(previewReceipt.totalAmount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#A1A1AA]">Amount Paid</dt>
                <dd className="font-bold text-emerald-400 tabular-nums">
                  {formatInr(previewReceipt.paidAmount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#A1A1AA]">Pending Balance</dt>
                <dd className="font-semibold text-[#FF5A1F] tabular-nums">
                  {formatInr(previewReceipt.pendingAmount)}
                </dd>
              </div>
            </dl>

            <p className="mt-5 rounded-md border border-white/10 bg-[#080808] p-3 text-xs text-[#A1A1AA]">
              Recorded manually by Assure Fitness Club LLP desk administration. Does not represent
              an automated online payment gateway transaction.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadReceipt(previewReceipt)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Receipt (.html)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner-Only Delete Confirmation */}
      {confirmDelete && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete payment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Delete receipt {confirmDelete.receiptNumber}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently removes this payment record from Firestore.
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
                  await removePayment(confirmDelete.id, staffUser);
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

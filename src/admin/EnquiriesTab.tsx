import { useMemo, useState, type FormEvent } from 'react';
import {
  MessageCircle,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  EnquiryRecord,
  EnquiryStatus,
  MembershipPlanRecord,
  SiteSettingsRecord,
} from '../types/gym';
import {
  removeEnquiry,
  saveMember,
  updateEnquiryRecord,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { addDaysToIsoDate } from '../utils/adminLogic';
import { buildWhatsAppEnquiryUrl } from '../utils/clubLogic';

interface EnquiriesTabProps {
  enquiries: EnquiryRecord[];
  plans: MembershipPlanRecord[];
  settings: SiteSettingsRecord | null;
  staffUser: StaffSessionUser;
  onMemberConverted: () => void;
}

const STATUSES: EnquiryStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Converted',
  'Not interested',
];

export default function EnquiriesTab({
  enquiries,
  plans,
  settings,
  staffUser,
  onMemberConverted,
}: EnquiriesTabProps) {
  const isOwner = staffUser.role === 'owner';
  const whatsappAllowed = Boolean(settings?.whatsappApproved && settings?.whatsappNumber);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | EnquiryStatus>('All');

  const [editingEnquiry, setEditingEnquiry] = useState<EnquiryRecord | null>(null);
  const [editStatus, setEditStatus] = useState<EnquiryStatus>('New');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [convertingEnquiry, setConvertingEnquiry] = useState<EnquiryRecord | null>(null);
  const [convertPlanId, setConvertPlanId] = useState('');
  const [convertStartDate, setConvertStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<EnquiryRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enquiries
      .filter((enq) => {
        if (statusFilter !== 'All' && enq.status !== statusFilter) return false;
        if (!q) return true;
        return (
          enq.customerName.toLowerCase().includes(q) ||
          enq.phone.toLowerCase().includes(q) ||
          enq.email.toLowerCase().includes(q) ||
          enq.interestedPlan.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.enquiryDate.localeCompare(a.enquiryDate));
  }, [enquiries, search, statusFilter]);

  const openEdit = (enq: EnquiryRecord) => {
    setEditingEnquiry(enq);
    setEditStatus(enq.status);
    setEditFollowUpDate(enq.followUpDate || '');
    setEditNotes(enq.internalNotes || '');
  };

  const handleSaveNotes = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEnquiry) return;
    setSaving(true);
    try {
      await updateEnquiryRecord(
        editingEnquiry.id,
        {
          status: editStatus,
          followUpDate: editFollowUpDate,
          assigneeUid: editingEnquiry.assigneeUid || staffUser.uid,
          internalNotes: editNotes.trim().slice(0, 500),
        },
        staffUser,
      );
      setEditingEnquiry(null);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (id: string, status: EnquiryStatus) => {
    await updateEnquiryRecord(id, { status }, staffUser);
  };

  const openConvert = (enq: EnquiryRecord) => {
    const matchedPlan =
      plans.find(
        (p) => p.name.toLowerCase() === enq.interestedPlan.toLowerCase(),
      ) ||
      plans.find((p) => p.active) ||
      plans[0];
    setConvertingEnquiry(enq);
    setConvertPlanId(matchedPlan?.id || 'custom');
    setConvertStartDate(new Date().toISOString().slice(0, 10));
    setConvertError(null);
  };

  const handleConvertSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!convertingEnquiry) return;
    const chosenPlan = plans.find((p) => p.id === convertPlanId);
    const durationDays = chosenPlan?.durationDays || 30;
    const planName = chosenPlan?.name || convertingEnquiry.interestedPlan;
    setConverting(true);
    setConvertError(null);
    try {
      await saveMember(
        {
          fullName: convertingEnquiry.customerName,
          phone: convertingEnquiry.phone,
          email: convertingEnquiry.email || '',
          joiningDate: convertStartDate,
          planId: chosenPlan?.id || 'custom',
          planName,
          startDate: convertStartDate,
          expiryDate: addDaysToIsoDate(convertStartDate, durationDays),
          paymentStatus: 'Pending',
          memberStatus: 'Active',
          assignedTrainerId: '',
          consentConfirmed: Boolean(convertingEnquiry.consentAccepted),
          archivedAt: '',
          notes: convertingEnquiry.internalNotes
            ? `Converted from enquiry: ${convertingEnquiry.internalNotes}`.slice(0, 500)
            : `Converted from website enquiry (${convertingEnquiry.enquiryDate})`,
        },
        undefined,
        staffUser,
      );
      await updateEnquiryRecord(
        convertingEnquiry.id,
        { status: 'Converted' },
        staffUser,
      );
      setConvertingEnquiry(null);
      onMemberConverted();
    } catch (err) {
      setConvertError(
        err instanceof Error ? err.message : 'Failed to convert enquiry to member.',
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">Enquiry CRM</h2>
        <p className="text-xs text-[#A1A1AA]">
          Track consented leads, schedule follow-ups, record internal notes, and convert leads to members
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border border-white/10 bg-[#111111] p-4">
        <div className="md:col-span-8 relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enquiries by name, phone, email, or plan..."
            aria-label="Search enquiries"
            className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] pl-10 pr-4 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
          />
        </div>

        <div className="md:col-span-4">
          <select
            aria-label="Filter enquiries by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | EnquiryStatus)}
            className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
          >
            <option value="All">All Pipeline Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enquiry List */}
      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            {enquiries.length === 0
              ? 'No enquiries received yet. Submissions from the public website contact form will appear here automatically.'
              : 'No enquiries match your current search or filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Customer &amp; Consent</th>
                  <th className="py-3.5 px-4 font-medium">Contact</th>
                  <th className="py-3.5 px-4 font-medium">Interested Plan</th>
                  <th className="py-3.5 px-4 font-medium">Dates</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((enq) => (
                  <tr key={enq.id} className="hover:bg-white/[0.02] align-top">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{enq.customerName}</p>
                      <p className="text-[11px] text-emerald-400/80">
                        Consent: {enq.consentAccepted ? `${enq.consentVersion} (${enq.consentAt.slice(0, 10)})` : 'Missing'}
                      </p>
                      {enq.message && (
                        <p className="mt-1 max-w-xs text-xs text-[#A1A1AA] line-clamp-2">
                          “{enq.message}”
                        </p>
                      )}
                      {enq.internalNotes && (
                        <p className="mt-1 max-w-xs text-xs text-[#FF5A1F]">
                          Note: {enq.internalNotes}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-white tabular-nums">{enq.phone}</p>
                      <p className="text-xs text-[#A1A1AA]">{enq.email || 'No email'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-white">{enq.interestedPlan}</td>
                    <td className="py-3.5 px-4 text-xs text-[#A1A1AA] tabular-nums whitespace-nowrap">
                      <p>Enquiry: {enq.enquiryDate}</p>
                      {enq.followUpDate && (
                        <p className="text-[#FF5A1F]">Follow-up: {enq.followUpDate}</p>
                      )}
                      {enq.retentionReviewDate && (
                        <p>Review: {enq.retentionReviewDate}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        aria-label={`Change status for ${enq.customerName}`}
                        value={enq.status}
                        onChange={(e) =>
                          handleQuickStatus(enq.id, e.target.value as EnquiryStatus)
                        }
                        className="min-h-[36px] rounded-md border border-white/15 bg-[#080808] px-2.5 text-xs font-medium text-white focus:border-[#FF5A1F] focus:outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {whatsappAllowed && (
                          <a
                            href={buildWhatsAppEnquiryUrl({
                              planName: enq.interestedPlan,
                              senderName: enq.customerName,
                              whatsappNumber: settings?.whatsappNumber || '',
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`WhatsApp ${enq.customerName}`}
                            title="Message on WhatsApp"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-emerald-400 hover:border-emerald-400/50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                        {enq.status !== 'Converted' && (
                          <button
                            type="button"
                            onClick={() => openConvert(enq)}
                            aria-label={`Convert ${enq.customerName} to member`}
                            title="Convert to Member"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#FF5A1F] hover:border-[#FF5A1F] cursor-pointer"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(enq)}
                          aria-label={`Edit notes for ${enq.customerName}`}
                          title="Edit Notes & Follow-up"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(enq)}
                            aria-label={`Delete enquiry from ${enq.customerName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 hover:border-red-400/50 cursor-pointer"
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

      {/* Edit Status & Internal Notes Modal */}
      {editingEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Update enquiry for ${editingEnquiry.customerName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <h3 className="font-display text-2xl font-bold text-white">
                  {editingEnquiry.customerName}
                </h3>
                <p className="text-xs text-[#A1A1AA] tabular-nums">
                  {editingEnquiry.phone} · {editingEnquiry.interestedPlan}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEnquiry(null)}
                aria-label="Close enquiry editor"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editingEnquiry.message && (
              <div className="mb-4 rounded-md border border-white/10 bg-[#080808] p-3 text-xs text-[#A1A1AA]">
                <span className="font-semibold text-white">Customer Message:</span>{' '}
                {editingEnquiry.message}
              </div>
            )}

            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Pipeline Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as EnquiryStatus)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={editFollowUpDate}
                    onChange={(e) => setEditFollowUpDate(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Internal Staff Notes
                </label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Call follow-up date, preferred shift, trial session outcome..."
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingEnquiry(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Member Modal */}
      {convertingEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Convert ${convertingEnquiry.customerName} to member`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="font-display text-2xl font-bold text-white">
                Convert Lead to Member
              </h3>
              <button
                type="button"
                onClick={() => setConvertingEnquiry(null)}
                aria-label="Close conversion modal"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {convertError && (
              <p role="alert" className="mb-3 text-xs font-medium text-[#FF5A1F]">
                {convertError}
              </p>
            )}

            <form onSubmit={handleConvertSubmit} className="space-y-4">
              <div className="rounded-md bg-[#080808] border border-white/10 p-3 text-xs space-y-1">
                <p className="text-white font-semibold">{convertingEnquiry.customerName}</p>
                <p className="text-[#A1A1AA] tabular-nums">{convertingEnquiry.phone}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Assign Membership Plan
                </label>
                <select
                  value={convertPlanId}
                  onChange={(e) => setConvertPlanId(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.duration})
                    </option>
                  ))}
                  <option value="custom">Custom / Other ({convertingEnquiry.interestedPlan})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Membership Start Date
                </label>
                <input
                  type="date"
                  required
                  value={convertStartDate}
                  onChange={(e) => setConvertStartDate(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setConvertingEnquiry(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={converting}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                >
                  {converting ? 'Converting...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner-Only Confirm Delete Modal */}
      {confirmDelete && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete enquiry"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Delete enquiry from {confirmDelete.customerName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently removes this enquiry record from Firestore.
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
                  await removeEnquiry(confirmDelete.id, staffUser);
                  setConfirmDelete(null);
                }}
                className="min-h-[42px] rounded-md bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 cursor-pointer"
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

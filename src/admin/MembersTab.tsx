import { useMemo, useState, type FormEvent } from 'react';
import {
  Archive,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  GymMember,
  MemberStatus,
  MembershipPlanRecord,
  PaymentRecord,
  PaymentStatus,
  TrainerRecord,
} from '../types/gym';
import { auth } from '../lib/firebase';
import {
  recordAuditEvent,
  removeMember,
  saveMember,
  type StaffSessionUser,
} from '../lib/firestoreService';
import {
  addDaysToIsoDate,
  buildMembersCsv,
  daysUntilDate,
  formatInr,
} from '../utils/adminLogic';

interface MembersTabProps {
  members: GymMember[];
  plans: MembershipPlanRecord[];
  payments: PaymentRecord[];
  trainers: TrainerRecord[];
  staffUser: StaffSessionUser;
}

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  email: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  planId: '',
  planName: '',
  startDate: new Date().toISOString().slice(0, 10),
  expiryDate: addDaysToIsoDate(new Date().toISOString().slice(0, 10), 30),
  paymentStatus: 'Pending' as PaymentStatus,
  memberStatus: 'Active' as MemberStatus,
  assignedTrainerId: '',
  consentConfirmed: true,
  archivedAt: '',
  notes: '',
};

export default function MembersTab({
  members,
  plans,
  payments,
  trainers,
  staffUser,
}: MembersTabProps) {
  const isOwner = staffUser.role === 'owner';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MemberStatus>('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All');
  const [showArchived, setShowArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [viewingMember, setViewingMember] = useState<GymMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GymMember | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const isArchived = Boolean(m.archivedAt);
      if (!showArchived && isArchived) return false;
      if (statusFilter !== 'All' && m.memberStatus !== statusFilter) return false;
      if (paymentFilter !== 'All' && m.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.planName.toLowerCase().includes(q)
      );
    });
  }, [members, search, statusFilter, paymentFilter, showArchived]);

  const openCreateModal = () => {
    const defaultPlan = plans.find((p) => p.active) || plans[0];
    const start = new Date().toISOString().slice(0, 10);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      joiningDate: start,
      startDate: start,
      planId: defaultPlan?.id || 'custom',
      planName: defaultPlan?.name || 'Custom Plan',
      expiryDate: addDaysToIsoDate(start, defaultPlan?.durationDays || 30),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (member: GymMember) => {
    setEditingId(member.id);
    setForm({
      fullName: member.fullName,
      phone: member.phone,
      email: member.email,
      joiningDate: member.joiningDate,
      planId: member.planId,
      planName: member.planName,
      startDate: member.startDate,
      expiryDate: member.expiryDate,
      paymentStatus: member.paymentStatus,
      memberStatus: member.memberStatus,
      assignedTrainerId: member.assignedTrainerId || '',
      consentConfirmed: Boolean(member.consentConfirmed),
      archivedAt: member.archivedAt || '',
      notes: member.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handlePlanChange = (planId: string) => {
    const chosen = plans.find((p) => p.id === planId);
    if (!chosen) {
      setForm((prev) => ({ ...prev, planId }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      planId: chosen.id,
      planName: chosen.name,
      expiryDate: addDaysToIsoDate(prev.startDate, chosen.durationDays),
    }));
  };

  const handleStartDateChange = (startDate: string) => {
    const chosen = plans.find((p) => p.id === form.planId);
    setForm((prev) => ({
      ...prev,
      startDate,
      expiryDate: chosen
        ? addDaysToIsoDate(startDate, chosen.durationDays)
        : prev.expiryDate,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.fullName.trim().length < 2) {
      setFormError('Full name must be at least 2 characters.');
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 8) {
      setFormError('Please provide a valid phone number.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveMember(
        {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          joiningDate: form.joiningDate,
          planId: form.planId || 'custom',
          planName: form.planName.trim() || 'Custom Plan',
          startDate: form.startDate,
          expiryDate: form.expiryDate,
          paymentStatus: form.paymentStatus,
          memberStatus: form.memberStatus,
          assignedTrainerId: form.assignedTrainerId.trim(),
          consentConfirmed: form.consentConfirmed,
          archivedAt: form.archivedAt,
          notes: form.notes.trim(),
        },
        editingId || undefined,
        staffUser,
      );
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save member.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (member: GymMember) => {
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
        paymentStatus: member.paymentStatus,
        memberStatus: member.memberStatus,
        assignedTrainerId: member.assignedTrainerId || '',
        consentConfirmed: Boolean(member.consentConfirmed),
        archivedAt: member.archivedAt ? '' : todayIso,
        notes: member.notes || '',
      },
      member.id,
      staffUser,
    );
  };

  const handleAuditedCsvExport = async () => {
    if (!isOwner) return;
    setExporting(true);
    setExportError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Owner authentication token required.');

      const resp = await fetch('/api/audit-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope: 'members' }),
      });
      const res = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok || !res.ok) {
        throw new Error(res.error || 'Owner export authorization failed.');
      }

      await recordAuditEvent(staffUser, {
        action: 'export.members_csv',
        resourceType: 'member',
        resourceId: `count_${filteredMembers.length}`,
        changedFields: ['csv_export'],
        reason: `Exported ${filteredMembers.length} member record(s)`,
      });

      const csv = buildMembersCsv(filteredMembers);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `assure-fitness-members-${todayIso}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete || !isOwner) return;
    await removeMember(confirmDelete.id, staffUser);
    if (viewingMember?.id === confirmDelete.id) {
      setViewingMember(null);
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Member Directory</h2>
          <p className="text-xs text-[#A1A1AA]">
            Add, edit, assign trainers, archive inactive profiles, and track expirations
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <button
              type="button"
              onClick={handleAuditedCsvExport}
              disabled={exporting || filteredMembers.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-white/15 bg-[#111111] px-4 py-2.5 text-xs font-semibold text-white hover:border-[#FF5A1F] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
              <span>{exporting ? 'Exporting...' : 'Audited CSV Export'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {exportError && (
        <p role="alert" className="text-xs font-medium text-[#FF5A1F]">
          {exportError}
        </p>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border border-white/10 bg-[#111111] p-4 items-center">
        <div className="md:col-span-5 relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, or plan..."
            aria-label="Search members"
            className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] pl-10 pr-4 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            aria-label="Filter by member status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | MemberStatus)}
            className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
          >
            <option value="All">All Member Statuses</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Paused">Paused</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            aria-label="Filter by payment status"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'All' | PaymentStatus)}
            className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
          >
            <option value="All">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-[#A1A1AA] cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-[#FF5A1F]"
            />
            <span>Show Archived</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {filteredMembers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-[#A1A1AA]">
              {members.length === 0
                ? 'No members added yet. Add your first club member to begin tracking expirations.'
                : 'No members match your current search or filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Member</th>
                  <th className="py-3.5 px-4 font-medium">Contact</th>
                  <th className="py-3.5 px-4 font-medium">Plan &amp; Coach</th>
                  <th className="py-3.5 px-4 font-medium">Start / Expiry</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Payment</th>
                  <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredMembers.map((member) => {
                  const daysLeft = daysUntilDate(member.expiryDate, todayIso);
                  const assignedCoach = trainers.find(
                    (t) =>
                      t.id === member.assignedTrainerId ||
                      t.staffUid === member.assignedTrainerId,
                  );
                  return (
                    <tr
                      key={member.id}
                      className={`hover:bg-white/[0.02] ${member.archivedAt ? 'opacity-60' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white">
                          {member.fullName}
                          {member.archivedAt && (
                            <span className="ml-2 text-[11px] font-normal text-amber-400">
                              (Archived {member.archivedAt})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#A1A1AA] tabular-nums">
                          Joined {member.joiningDate}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-white tabular-nums">{member.phone}</p>
                        <p className="text-xs text-[#A1A1AA]">{member.email || 'No email'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-white">{member.planName}</p>
                        <p className="text-xs text-[#A1A1AA]">
                          {assignedCoach
                            ? `Coach: ${assignedCoach.fullName}`
                            : member.assignedTrainerId
                            ? `Trainer ID: ${member.assignedTrainerId}`
                            : 'No coach assigned'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <p className="text-xs text-[#A1A1AA]">{member.startDate} to</p>
                        <p
                          className={`text-sm font-medium ${
                            daysLeft < 0
                              ? 'text-red-400'
                              : daysLeft <= 7
                              ? 'text-[#FF5A1F]'
                              : 'text-white'
                          }`}
                        >
                          {member.expiryDate}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            member.memberStatus === 'Active'
                              ? 'text-emerald-400'
                              : member.memberStatus === 'Expired'
                              ? 'text-red-400'
                              : 'text-zinc-400'
                          }`}
                        >
                          {member.memberStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            member.paymentStatus === 'Paid'
                              ? 'text-emerald-400'
                              : member.paymentStatus === 'Partial'
                              ? 'text-amber-400'
                              : member.paymentStatus === 'Refunded'
                              ? 'text-zinc-400'
                              : 'text-[#FF5A1F]'
                          }`}
                        >
                          {member.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingMember(member)}
                            aria-label={`View profile for ${member.fullName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-white hover:border-[#FF5A1F] cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            aria-label={`Edit ${member.fullName}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-white hover:border-[#FF5A1F] cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleArchive(member)}
                            aria-label={
                              member.archivedAt
                                ? `Restore ${member.fullName}`
                                : `Archive ${member.fullName}`
                            }
                            title={member.archivedAt ? 'Restore Member' : 'Archive Member'}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-amber-400 cursor-pointer"
                          >
                            {member.archivedAt ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </button>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(member)}
                              aria-label={`Delete ${member.fullName}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 hover:border-red-400/50 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit member' : 'Add member'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-lg border border-white/15 bg-[#111111] p-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white">
                {editingId ? 'Edit Member Profile' : 'Add New Member'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close member form"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Joining Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.joiningDate}
                    onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Membership Plan
                  </label>
                  <select
                    value={form.planId}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.duration})
                      </option>
                    ))}
                    <option value="custom">Custom / Other Plan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Plan Label
                  </label>
                  <input
                    type="text"
                    required
                    value={form.planName}
                    onChange={(e) => setForm({ ...form, planName: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Payment Status
                  </label>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) =>
                      setForm({ ...form, paymentStatus: e.target.value as PaymentStatus })
                    }
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Member Status
                  </label>
                  <select
                    value={form.memberStatus}
                    onChange={(e) =>
                      setForm({ ...form, memberStatus: e.target.value as MemberStatus })
                    }
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Assigned Trainer Scope ID (Optional — determines Trainer Roster visibility)
                  </label>
                  <select
                    value={form.assignedTrainerId}
                    onChange={(e) => setForm({ ...form, assignedTrainerId: e.target.value })}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.staffUid || t.id}>
                        {t.fullName} ({t.staffUid || t.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consentConfirmed}
                  onChange={(e) => setForm({ ...form, consentConfirmed: e.target.checked })}
                  className="accent-[#FF5A1F]"
                />
                <span>Member privacy &amp; data processing consent confirmed at desk</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
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
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Profile Modal */}
      {viewingMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Profile for ${viewingMember.fullName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-xl rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-3xl font-bold text-white">
                  {viewingMember.fullName}
                </h3>
                <p className="text-xs text-[#A1A1AA] tabular-nums">
                  {viewingMember.phone} · {viewingMember.email || 'No email'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingMember(null)}
                aria-label="Close member profile"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-[#A1A1AA]">Plan</dt>
                <dd className="font-medium text-white">{viewingMember.planName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#A1A1AA]">Member Status</dt>
                <dd className="font-medium text-white">{viewingMember.memberStatus}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#A1A1AA]">Start Date</dt>
                <dd className="text-white tabular-nums">{viewingMember.startDate}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#A1A1AA]">Expiry Date</dt>
                <dd className="text-white tabular-nums">{viewingMember.expiryDate}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#A1A1AA]">Assigned Trainer ID</dt>
                <dd className="text-white font-mono text-xs">
                  {viewingMember.assignedTrainerId || 'Unassigned'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#A1A1AA]">Privacy Consent</dt>
                <dd className="text-white text-xs">
                  {viewingMember.consentConfirmed ? 'Confirmed' : 'Pending confirmation'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA] mb-3">
                Payment History
              </h4>
              {payments.filter((p) => p.memberId === viewingMember.id).length === 0 ? (
                <p className="text-xs text-[#A1A1AA]">No recorded payments for this member yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {payments
                    .filter((p) => p.memberId === viewingMember.id)
                    .map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between rounded-md bg-[#080808] px-3 py-2 border border-white/10"
                      >
                        <span className="text-white tabular-nums">
                          {p.transactionDate} · {p.receiptNumber} ({p.status})
                        </span>
                        <span className="font-semibold text-[#FF5A1F] tabular-nums">
                          Paid {formatInr(p.paidAmount)} / {formatInr(p.totalAmount)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Owner-Only Delete Confirmation Modal */}
      {confirmDelete && isOwner && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete member"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Delete {confirmDelete.fullName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently removes this member profile from Firestore. Prefer Archive
              unless erasure is required.
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
                onClick={handleDeleteConfirmed}
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

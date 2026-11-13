import { useState, type FormEvent } from 'react';
import { CheckCircle2, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import type { GymMember, MembershipPlanRecord } from '../types/gym';
import {
  removeMembershipPlan,
  saveMembershipPlan,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { formatInr } from '../utils/adminLogic';

interface PlansTabProps {
  plans: MembershipPlanRecord[];
  members: GymMember[];
  staffUser: StaffSessionUser;
}

export default function PlansTab({ plans, members, staffUser }: PlansTabProps) {
  const isOwner = staffUser.role === 'owner';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('3 Months');
  const [durationDays, setDurationDays] = useState(90);
  const [priceAmount, setPriceAmount] = useState(0);
  const [priceDisplay, setPriceDisplay] = useState('Tariff pending owner confirmation');
  const [featured, setFeatured] = useState(false);
  const [active, setActive] = useState(true);
  const [publicVisibility, setPublicVisibility] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'draft' | 'owner-approved'>('draft');
  const [featuresText, setFeaturesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MembershipPlanRecord | null>(null);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setDuration('1 Month');
    setDurationDays(30);
    setPriceAmount(0);
    setPriceDisplay('Tariff pending owner confirmation');
    setFeatured(false);
    setActive(true);
    setPublicVisibility(false);
    setApprovalStatus('draft');
    setFeaturesText('Full gym floor access\nLocker access');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (plan: MembershipPlanRecord) => {
    setEditingId(plan.id);
    setName(plan.name);
    setDuration(plan.duration);
    setDurationDays(plan.durationDays);
    setPriceAmount(plan.priceAmount);
    setPriceDisplay(plan.priceDisplay);
    setFeatured(plan.featured);
    setActive(plan.active);
    setPublicVisibility(isOwner ? Boolean(plan.publicVisibility) : false);
    setApprovalStatus(isOwner ? plan.approvalStatus : 'draft');
    setFeaturesText(plan.features.join('\n'));
    setFormError(null);
    setModalOpen(true);
  };

  const handlePriceAmountChange = (val: number) => {
    setPriceAmount(val);
    if (val > 0) {
      setPriceDisplay(formatInr(val));
    } else {
      setPriceDisplay('Tariff pending owner confirmation');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const features = featuresText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 12);
      const nextStatus: 'draft' | 'owner-approved' = isOwner ? approvalStatus : 'draft';
      const nextPublic = isOwner ? publicVisibility && nextStatus === 'owner-approved' : false;

      await saveMembershipPlan(
        {
          name: name.trim(),
          duration: duration.trim(),
          durationDays: Math.max(1, Number(durationDays) || 30),
          priceAmount: Math.max(0, Number(priceAmount) || 0),
          priceDisplay: priceDisplay.trim() || 'Tariff pending owner confirmation',
          featured,
          active,
          publicVisibility: nextPublic,
          approvalStatus: nextStatus,
          approvedBy: nextStatus === 'owner-approved' ? staffUser.email : '',
          features,
        },
        editingId || undefined,
        staffUser,
      );
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: MembershipPlanRecord) => {
    await saveMembershipPlan(
      {
        name: plan.name,
        duration: plan.duration,
        durationDays: plan.durationDays,
        priceAmount: plan.priceAmount,
        priceDisplay: plan.priceDisplay,
        featured: plan.featured,
        active: !plan.active,
        publicVisibility: isOwner ? plan.publicVisibility : false,
        approvalStatus: isOwner ? plan.approvalStatus : 'draft',
        approvedBy: isOwner ? plan.approvedBy : '',
        features: plan.features,
      },
      plan.id,
      staffUser,
    );
  };

  const toggleOwnerApprove = async (plan: MembershipPlanRecord) => {
    if (!isOwner) return;
    const approving = plan.approvalStatus !== 'owner-approved';
    await saveMembershipPlan(
      {
        name: plan.name,
        duration: plan.duration,
        durationDays: plan.durationDays,
        priceAmount: plan.priceAmount,
        priceDisplay: plan.priceDisplay,
        featured: plan.featured,
        active: plan.active,
        publicVisibility: approving,
        approvalStatus: approving ? 'owner-approved' : 'draft',
        approvedBy: approving ? staffUser.email : '',
        features: plan.features,
      },
      plan.id,
      staffUser,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Membership Plans</h2>
          <p className="text-xs text-[#A1A1AA]">
            Only active plans marked owner-approved and publicly visible appear on the public website
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Plan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const assignedCount = members.filter((m) => m.planId === plan.id && !m.archivedAt).length;
          const isApproved = plan.approvalStatus === 'owner-approved';
          return (
            <article
              key={plan.id}
              className={`rounded-lg border p-6 flex flex-col justify-between ${
                plan.active
                  ? 'border-white/15 bg-[#111111]'
                  : 'border-white/5 bg-[#111111]/50 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#A1A1AA] tabular-nums">
                    {plan.duration} · {plan.durationDays} days
                  </span>
                  <span
                    className={`font-semibold ${
                      plan.active ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  >
                    {plan.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="mt-2 font-display text-3xl font-bold text-white">
                  {plan.name}
                </h3>
                <p className="mt-2 font-display text-2xl font-bold text-[#FF5A1F] tabular-nums">
                  {plan.priceDisplay}
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA] tabular-nums">
                  Assigned Members: {assignedCount} ·{' '}
                  <span className={isApproved && plan.publicVisibility ? 'text-emerald-400' : 'text-amber-400'}>
                    {isApproved && plan.publicVisibility
                      ? 'Owner-Approved · Public'
                      : isApproved
                      ? 'Owner-Approved · Hidden'
                      : 'Draft (Unpublished)'}
                  </span>
                </p>

                <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-xs text-[#A1A1AA]">
                  {plan.features.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleActive(plan)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-2.5 text-xs font-medium text-white hover:border-[#FF5A1F] cursor-pointer"
                  >
                    <Power className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{plan.active ? 'Deactivate' : 'Activate'}</span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => toggleOwnerApprove(plan)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isApproved ? 'Revert Draft' : 'Approve & Publish'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(plan)}
                    aria-label={`Edit ${plan.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white hover:border-[#FF5A1F] cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(plan)}
                      aria-label={`Delete ${plan.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit membership plan' : 'Create membership plan'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white">
                {editingId ? 'Edit Plan' : 'New Membership Plan'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close plan form"
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
                  Plan Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Duration Label
                  </label>
                  <input
                    type="text"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 3 Months"
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Duration (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Price (₹ Numeric, 0 = Pending)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={priceAmount}
                    onChange={(e) => handlePriceAmountChange(Number(e.target.value))}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Display Price Text
                  </label>
                  <input
                    type="text"
                    required
                    value={priceDisplay}
                    onChange={(e) => setPriceDisplay(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Plan Features (One per line)
                </label>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="space-y-2 text-sm text-white">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Active for desk member assignment</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Highlight as Featured</span>
                </label>
                {isOwner ? (
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalStatus === 'owner-approved'}
                        onChange={(e) =>
                          setApprovalStatus(e.target.checked ? 'owner-approved' : 'draft')
                        }
                        className="accent-[#FF5A1F]"
                      />
                      <span>Owner-Approved Tariff &amp; Copy</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publicVisibility}
                        disabled={approvalStatus !== 'owner-approved'}
                        onChange={(e) => setPublicVisibility(e.target.checked)}
                        className="accent-[#FF5A1F]"
                      />
                      <span>Show on Public Website</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-xs text-amber-400">
                    Staff edits are saved as draft; only the club owner can approve and publish tariffs.
                  </p>
                )}
              </div>

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
                  {saving ? 'Saving...' : isOwner ? 'Save Plan' : 'Save Draft'}
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
          aria-label="Confirm delete plan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Delete {confirmDelete.name}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently removes this plan from Firestore.
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
                  await removeMembershipPlan(confirmDelete.id, staffUser);
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

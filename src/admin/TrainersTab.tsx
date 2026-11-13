import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Pencil, Plus, Power, Trash2, Upload, UserCircle2, X } from 'lucide-react';
import type { StaffAccount, TrainerRecord } from '../types/gym';
import {
  removeTrainer,
  saveTrainer,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { uploadAdminImage } from '../lib/uploadClient';

interface TrainersTabProps {
  trainers: TrainerRecord[];
  staffList: StaffAccount[];
  staffUser: StaffSessionUser;
}

export default function TrainersTab({
  trainers,
  staffList,
  staffUser,
}: TrainersTabProps) {
  const isOwner = staffUser.role === 'owner';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [staffUid, setStaffUid] = useState('');
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [active, setActive] = useState(true);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'draft' | 'owner-approved'>('draft');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TrainerRecord | null>(null);

  const trainerStaffAccounts = staffList.filter((s) => s.role === 'trainer');

  const openNew = () => {
    setEditingId(null);
    setStaffUid('');
    setFullName('');
    setSpecialization('');
    setExperience('');
    setBio('');
    setPhotoUrl('');
    setActive(true);
    setConsentConfirmed(false);
    setApprovalStatus('draft');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (trainer: TrainerRecord) => {
    setEditingId(trainer.id);
    setStaffUid(trainer.staffUid || '');
    setFullName(trainer.fullName);
    setSpecialization(trainer.specialization);
    setExperience(trainer.experience);
    setBio(trainer.bio);
    setPhotoUrl(trainer.photoUrl);
    setActive(trainer.active);
    setConsentConfirmed(Boolean(trainer.consentConfirmed));
    setApprovalStatus(isOwner ? trainer.approvalStatus : 'draft');
    setFormError(null);
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadAdminImage(file);
      setPhotoUrl(url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setFormError('Trainer name must be at least 2 characters.');
      return;
    }
    if (specialization.trim().length < 2) {
      setFormError('Please specify trainer specialization.');
      return;
    }
    if (!experience.trim()) {
      setFormError('Please enter years or summary of experience.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const nextApproval: 'draft' | 'owner-approved' =
        isOwner && consentConfirmed ? approvalStatus : 'draft';
      await saveTrainer(
        {
          staffUid: staffUid.trim(),
          fullName: fullName.trim().slice(0, 80),
          specialization: specialization.trim().slice(0, 100),
          experience: experience.trim().slice(0, 60),
          bio: bio.trim().slice(0, 400),
          photoUrl: photoUrl.trim().slice(0, 500),
          active,
          approvalStatus: nextApproval,
          consentConfirmed,
          approvedBy: nextApproval === 'owner-approved' ? staffUser.email : '',
        },
        editingId || undefined,
        staffUser,
      );
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save trainer.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (trainer: TrainerRecord) => {
    await saveTrainer(
      {
        staffUid: trainer.staffUid || '',
        fullName: trainer.fullName,
        specialization: trainer.specialization,
        experience: trainer.experience,
        bio: trainer.bio,
        photoUrl: trainer.photoUrl,
        active: !trainer.active,
        approvalStatus: isOwner ? trainer.approvalStatus : 'draft',
        consentConfirmed: Boolean(trainer.consentConfirmed),
        approvedBy: isOwner ? trainer.approvedBy : '',
      },
      trainer.id,
      staffUser,
    );
  };

  const toggleOwnerApprove = async (trainer: TrainerRecord) => {
    if (!isOwner || !trainer.consentConfirmed) return;
    const approving = trainer.approvalStatus !== 'owner-approved';
    await saveTrainer(
      {
        staffUid: trainer.staffUid || '',
        fullName: trainer.fullName,
        specialization: trainer.specialization,
        experience: trainer.experience,
        bio: trainer.bio,
        photoUrl: trainer.photoUrl,
        active: trainer.active,
        approvalStatus: approving ? 'owner-approved' : 'draft',
        consentConfirmed: trainer.consentConfirmed,
        approvedBy: approving ? staffUser.email : '',
      },
      trainer.id,
      staffUser,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Trainer Management</h2>
          <p className="text-xs text-[#A1A1AA]">
            Coaches appear on the public website only when active, trainer-consented, and owner-approved
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Add Trainer</span>
        </button>
      </div>

      {trainers.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#111111] p-10 text-center">
          <p className="text-sm text-[#A1A1AA]">
            No trainers added yet. Add verified Assure Fitness Club trainers when ready with portrait
            rights and consent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trainers.map((trainer) => {
            const isApproved = trainer.approvalStatus === 'owner-approved';
            return (
              <article
                key={trainer.id}
                className={`rounded-lg border overflow-hidden flex flex-col justify-between ${
                  trainer.active
                    ? 'border-white/15 bg-[#111111]'
                    : 'border-white/5 bg-[#111111]/50 opacity-75'
                }`}
              >
                <div>
                  <div className="aspect-[4/3] bg-[#080808] overflow-hidden flex items-center justify-center border-b border-white/10">
                    {trainer.photoUrl ? (
                      <img
                        src={trainer.photoUrl}
                        alt={trainer.fullName}
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <UserCircle2 className="h-16 w-16 text-[#A1A1AA]/40" aria-hidden="true" />
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#FF5A1F] font-semibold">
                        {trainer.specialization}
                      </span>
                      <span
                        className={`font-semibold ${
                          trainer.active ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {trainer.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-2xl font-bold text-white">
                      {trainer.fullName}
                    </h3>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">{trainer.experience}</p>
                    <p className="mt-1.5 text-[11px]">
                      <span className={trainer.consentConfirmed ? 'text-emerald-400' : 'text-amber-400'}>
                        {trainer.consentConfirmed ? 'Consent Confirmed' : 'Consent Pending'}
                      </span>
                      {' · '}
                      <span className={isApproved ? 'text-emerald-400' : 'text-amber-400'}>
                        {isApproved ? 'Owner-Approved' : 'Draft'}
                      </span>
                    </p>
                    {trainer.bio && (
                      <p className="mt-3 text-xs leading-relaxed text-[#A1A1AA]">
                        {trainer.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleActive(trainer)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-2.5 text-xs font-medium text-white hover:border-[#FF5A1F] cursor-pointer"
                    >
                      <Power className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{trainer.active ? 'Deactivate' : 'Activate'}</span>
                    </button>
                    {isOwner && trainer.consentConfirmed && (
                      <button
                        type="button"
                        onClick={() => toggleOwnerApprove(trainer)}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isApproved ? 'Unpublish' : 'Approve'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(trainer)}
                      aria-label={`Edit ${trainer.fullName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white hover:border-[#FF5A1F] cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(trainer)}
                        aria-label={`Delete ${trainer.fullName}`}
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
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit trainer profile' : 'Add trainer'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white">
                {editingId ? 'Edit Trainer Profile' : 'Add New Trainer'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close trainer form"
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
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              {trainerStaffAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Linked Staff Auth UID (Optional — scopes Trainer Roster access)
                  </label>
                  <select
                    value={staffUid}
                    onChange={(e) => setStaffUid(e.target.value)}
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  >
                    <option value="">No linked staff login</option>
                    {trainerStaffAccounts.map((acc) => (
                      <option key={acc.uid} value={acc.uid}>
                        {acc.displayName} ({acc.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Specialization
                  </label>
                  <input
                    type="text"
                    required
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Strength & Conditioning"
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Experience
                  </label>
                  <input
                    type="text"
                    required
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g. Verified credentials"
                    className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Trainer Photograph (JPG, PNG, WebP up to 5 MB)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-white/15 bg-[#080808] px-4 text-xs font-medium text-white hover:border-[#FF5A1F] cursor-pointer">
                    <Upload className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                    <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                  {photoUrl && (
                    <span className="text-xs text-emerald-400 truncate max-w-[220px]">
                      Uploaded: {photoUrl}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Trainer Bio (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={400}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
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
                  <span>Active Trainer Profile</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentConfirmed}
                    onChange={(e) => setConsentConfirmed(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Trainer name, bio &amp; photo publication consent confirmed</span>
                </label>
                {isOwner ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!consentConfirmed}
                      checked={approvalStatus === 'owner-approved' && consentConfirmed}
                      onChange={(e) =>
                        setApprovalStatus(e.target.checked ? 'owner-approved' : 'draft')
                      }
                      className="accent-[#FF5A1F]"
                    />
                    <span>Owner-Approved for Public Website Display</span>
                  </label>
                ) : (
                  <p className="text-xs text-amber-400">
                    Staff edits save as draft; owner approval is required to publish publicly.
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
                  disabled={saving || uploading}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : isOwner ? 'Save Trainer' : 'Save Draft'}
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
          aria-label="Confirm delete trainer"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Remove {confirmDelete.fullName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: permanently deletes this trainer profile from Firestore.
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
                  await removeTrainer(confirmDelete.id, staffUser);
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

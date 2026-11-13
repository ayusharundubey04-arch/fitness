import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GalleryPhotoRecord } from '../types/gym';
import {
  removeGalleryPhoto,
  saveGalleryPhoto,
  type StaffSessionUser,
} from '../lib/firestoreService';
import { uploadAdminImage } from '../lib/uploadClient';

interface GalleryTabProps {
  gallery: GalleryPhotoRecord[];
  staffUser: StaffSessionUser;
}

export default function GalleryTab({ gallery, staffUser }: GalleryTabProps) {
  const isOwner = staffUser.role === 'owner';

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GalleryPhotoRecord['category']>('Strength');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [visible, setVisible] = useState(true);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'draft' | 'owner-approved'>('draft');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GalleryPhotoRecord | null>(null);

  const openNew = () => {
    setEditingId(null);
    setTitle('');
    setCategory('Strength');
    setImageUrl('');
    setCaption('');
    setVisible(true);
    setIsPlaceholder(false);
    setRightsConfirmed(false);
    setApprovalStatus('draft');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: GalleryPhotoRecord) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCategory(item.category);
    setImageUrl(item.imageUrl);
    setCaption(item.caption);
    setVisible(item.visible);
    setIsPlaceholder(item.isPlaceholder);
    setRightsConfirmed(Boolean(item.rightsConfirmed));
    setApprovalStatus(isOwner ? item.approvalStatus : 'draft');
    setFormError(null);
    setModalOpen(true);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const url = await uploadAdminImage(file);
      setImageUrl(url);
      setIsPlaceholder(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      setFormError('Title must be at least 2 characters.');
      return;
    }
    if (!imageUrl.trim()) {
      setFormError('Please upload an image before saving.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const canPublish = isPlaceholder || rightsConfirmed;
      const nextApproval: 'draft' | 'owner-approved' =
        isOwner && canPublish ? approvalStatus : 'draft';
      await saveGalleryPhoto(
        {
          title: title.trim().slice(0, 80),
          category,
          imageUrl: imageUrl.trim().slice(0, 500),
          caption: caption.trim().slice(0, 240),
          visible,
          isPlaceholder,
          rightsConfirmed,
          approvalStatus: nextApproval,
        },
        editingId || undefined,
        staffUser,
      );
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save gallery photo.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (item: GalleryPhotoRecord) => {
    await saveGalleryPhoto(
      {
        title: item.title,
        category: item.category,
        imageUrl: item.imageUrl,
        caption: item.caption,
        visible: !item.visible,
        isPlaceholder: item.isPlaceholder,
        rightsConfirmed: Boolean(item.rightsConfirmed),
        approvalStatus: isOwner ? item.approvalStatus : 'draft',
      },
      item.id,
      staffUser,
    );
  };

  const toggleOwnerApprove = async (item: GalleryPhotoRecord) => {
    if (!isOwner) return;
    if (!item.isPlaceholder && !item.rightsConfirmed) return;
    const approving = item.approvalStatus !== 'owner-approved';
    await saveGalleryPhoto(
      {
        title: item.title,
        category: item.category,
        imageUrl: item.imageUrl,
        caption: item.caption,
        visible: item.visible,
        isPlaceholder: item.isPlaceholder,
        rightsConfirmed: Boolean(item.rightsConfirmed),
        approvalStatus: approving ? 'owner-approved' : 'draft',
      },
      item.id,
      staffUser,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Gallery Manager</h2>
          <p className="text-xs text-[#A1A1AA]">
            Real club photos appear publicly only after media rights confirmation and owner approval
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Upload Photo</span>
        </button>
      </div>

      {gallery.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#111111] p-10 text-center text-sm text-[#A1A1AA]">
          No gallery records in Firestore yet. Upload an image to populate the gallery.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gallery.map((item) => {
            const isApproved = item.approvalStatus === 'owner-approved';
            const canApprove = item.isPlaceholder || item.rightsConfirmed;
            return (
              <article
                key={item.id}
                className={`rounded-lg border overflow-hidden flex flex-col justify-between ${
                  item.visible
                    ? 'border-white/15 bg-[#111111]'
                    : 'border-white/5 bg-[#111111]/50 opacity-75'
                }`}
              >
                <div>
                  <div className="aspect-[16/10] bg-[#080808] overflow-hidden border-b border-white/10">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover object-center"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#FF5A1F] font-semibold">
                        {item.category}
                        {item.isPlaceholder ? ' · Placeholder' : ''}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.visible ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {item.visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-2xl font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[11px]">
                      <span className={canApprove ? 'text-emerald-400' : 'text-amber-400'}>
                        {item.isPlaceholder
                          ? 'Placeholder Visual'
                          : item.rightsConfirmed
                          ? 'Rights Confirmed'
                          : 'Rights Pending'}
                      </span>
                      {' · '}
                      <span className={isApproved ? 'text-emerald-400' : 'text-amber-400'}>
                        {isApproved ? 'Owner-Approved' : 'Draft'}
                      </span>
                    </p>
                    {item.caption && (
                      <p className="mt-2 text-xs leading-relaxed text-[#A1A1AA]">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleVisible(item)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-2.5 text-xs font-medium text-white hover:border-[#FF5A1F] cursor-pointer"
                    >
                      {item.visible ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                    {isOwner && canApprove && (
                      <button
                        type="button"
                        onClick={() => toggleOwnerApprove(item)}
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
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${item.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white hover:border-[#FF5A1F] cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
                        aria-label={`Delete ${item.title}`}
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
          aria-label={editingId ? 'Edit gallery photo' : 'Upload gallery photo'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <h3 className="font-display text-2xl font-bold text-white">
                {editingId ? 'Edit Gallery Item' : 'Add Gallery Photo'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close gallery form"
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
                  Photo Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Zone Category
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as GalleryPhotoRecord['category'])
                  }
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                >
                  <option value="Strength">Strength</option>
                  <option value="Conditioning">Conditioning</option>
                  <option value="Studio">Studio</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Image File (JPG, PNG, WebP up to 5 MB)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-white/15 bg-[#080808] px-4 text-xs font-medium text-white hover:border-[#FF5A1F] cursor-pointer">
                    <Upload className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                    <span>{uploading ? 'Uploading...' : 'Choose Image'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                  {imageUrl && (
                    <span className="text-xs text-emerald-400 truncate max-w-[230px]">
                      {imageUrl}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Caption
                </label>
                <textarea
                  rows={2}
                  maxLength={240}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                />
              </div>

              <div className="space-y-2 text-sm text-white">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Visible in Gallery Section</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPlaceholder}
                    onChange={(e) => setIsPlaceholder(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Label Explicitly as Placeholder Visual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    className="accent-[#FF5A1F]"
                  />
                  <span>Real facility media rights &amp; privacy clearance confirmed</span>
                </label>
                {isOwner ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isPlaceholder && !rightsConfirmed}
                      checked={
                        approvalStatus === 'owner-approved' &&
                        (isPlaceholder || rightsConfirmed)
                      }
                      onChange={(e) =>
                        setApprovalStatus(e.target.checked ? 'owner-approved' : 'draft')
                      }
                      className="accent-[#FF5A1F]"
                    />
                    <span>Owner-Approved for Public Gallery</span>
                  </label>
                ) : (
                  <p className="text-xs text-amber-400">
                    Staff uploads save as draft until approved by the club owner.
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
                  {saving ? 'Saving...' : isOwner ? 'Save Photo' : 'Save Draft'}
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
          aria-label="Confirm delete gallery photo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Delete {confirmDelete.title}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Owner action: removes the photo permanently from the gallery.
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
                  await removeGalleryPhoto(confirmDelete.id, staffUser);
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

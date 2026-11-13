import { useState, type FormEvent } from 'react';
import { CheckCircle2, FileCheck2, Pencil, X } from 'lucide-react';
import type { ContentApprovalStatus } from '../data/contentRegister';
import type { SiteContentRecord } from '../types/gym';
import {
  saveSiteContentRecord,
  type StaffSessionUser,
} from '../lib/firestoreService';

interface ContentApprovalTabProps {
  siteContent: SiteContentRecord[];
  staffUser: StaffSessionUser;
}

const ALL_STATUSES: ContentApprovalStatus[] = [
  'verified',
  'owner-approved',
  'draft',
  'unknown',
  'disputed',
];

export default function ContentApprovalTab({
  siteContent,
  staffUser,
}: ContentApprovalTabProps) {
  const isOwner = staffUser.role === 'owner';
  const [editing, setEditing] = useState<SiteContentRecord | null>(null);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<ContentApprovalStatus>('draft');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (item: SiteContentRecord) => {
    setEditing(item);
    setValue(item.value);
    setStatus(isOwner ? item.status : 'draft');
    setSource(item.source);
    setNotes(item.notes);
    setError(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextStatus: ContentApprovalStatus = isOwner ? status : 'draft';
    const isApproved =
      nextStatus === 'verified' || nextStatus === 'owner-approved';

    try {
      await saveSiteContentRecord(
        {
          key: editing.key,
          label: editing.label,
          value: value.trim().slice(0, 500),
          status: nextStatus,
          source: source.trim().slice(0, 160),
          verifiedAt: isApproved ? todayIso : '',
          approvedBy: isApproved ? staffUser.email : '',
          version: (editing.version || 1) + 1,
          editorUid: staffUser.uid,
          publishedAt: isApproved ? todayIso : '',
          notes: notes.trim().slice(0, 500),
        },
        editing.id,
        staffUser,
      );
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update content register.');
    } finally {
      setSaving(false);
    }
  };

  const quickApprove = async (item: SiteContentRecord) => {
    if (!isOwner) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    await saveSiteContentRecord(
      {
        key: item.key,
        label: item.label,
        value: item.value,
        status: 'owner-approved',
        source: item.source,
        verifiedAt: todayIso,
        approvedBy: staffUser.email,
        version: (item.version || 1) + 1,
        editorUid: staffUser.uid,
        publishedAt: todayIso,
        notes: item.notes,
      },
      item.id,
      staffUser,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">
          Content Verification Register
        </h2>
        <p className="text-xs text-[#A1A1AA]">
          Public claims remain unpublished unless marked verified or owner-approved. Staff may submit
          drafts; only the club owner can approve facts for public display.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {siteContent.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA]">
            No content register entries loaded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Item</th>
                  <th className="py-3.5 px-4 font-medium">Current Value</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Source &amp; Audit</th>
                  <th className="py-3.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {siteContent.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] align-top">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-xs text-[#A1A1AA] font-mono">{item.key}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-white max-w-xs">
                      {item.value || <span className="text-[#A1A1AA]">[Unpublished]</span>}
                      {item.notes && (
                        <p className="mt-1 text-[11px] text-[#A1A1AA]">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          item.status === 'verified' || item.status === 'owner-approved'
                            ? 'text-emerald-400'
                            : item.status === 'disputed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#A1A1AA]">
                      <p>{item.source}</p>
                      {item.approvedBy && (
                        <p className="text-[11px] text-emerald-400/80 mt-0.5">
                          Approved by {item.approvedBy} ({item.verifiedAt})
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOwner &&
                          item.status !== 'verified' &&
                          item.status !== 'owner-approved' &&
                          item.value.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => quickApprove(item)}
                              title="Approve entry"
                              className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Approve</span>
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.label}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editing.label}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-[#111111] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
                <h3 className="font-display text-2xl font-bold text-white">
                  {editing.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close register editor"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mb-3 text-xs font-medium text-[#FF5A1F]">
                {error}
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Value
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Approval Status {!isOwner && '(Staff limited to draft)'}
                </label>
                <select
                  disabled={!isOwner}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContentApprovalStatus)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white disabled:opacity-60"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Source
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                  Review Notes
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white cursor-pointer"
                >
                  {saving ? 'Saving...' : isOwner ? 'Save Register Item' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

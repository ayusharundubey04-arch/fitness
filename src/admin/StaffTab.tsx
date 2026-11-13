import { useState, type FormEvent } from 'react';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import type { StaffAccount, StaffRole, TrainerRecord } from '../types/gym';
import { auth } from '../lib/firebase';
import {
  removeStaffAccount,
  saveStaffAccount,
  type StaffSessionUser,
} from '../lib/firestoreService';

interface StaffTabProps {
  staffList: StaffAccount[];
  trainers: TrainerRecord[];
  staffUser: StaffSessionUser;
}

export default function StaffTab({ staffList, trainers, staffUser }: StaffTabProps) {
  const [uid, setUid] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<StaffRole>('staff');
  const [assignedTrainerId, setAssignedTrainerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<StaffAccount | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffAccount | null>(null);

  const handleProvision = async (e: FormEvent) => {
    e.preventDefault();
    const uidTrimmed = uid.trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uidTrimmed)) {
      setError('Firebase Auth UID must contain only letters, numbers, underscores, or hyphens.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Owner authentication token required.');

      const resp = await fetch('/api/staff/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: uidTrimmed,
          email: email.trim(),
          displayName: displayName.trim(),
          role,
          assignedTrainerId: role === 'trainer' ? assignedTrainerId.trim() : '',
          active: true,
        }),
      });
      const res = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        validated?: {
          uid: string;
          email: string;
          displayName: string;
          role: StaffRole;
          assignedTrainerId: string;
          active: boolean;
        };
      };
      if (!resp.ok || !res.ok || !res.validated) {
        throw new Error(res.error || 'Staff provisioning validation failed.');
      }

      const existing = staffList.some((s) => s.uid === res.validated!.uid);
      await saveStaffAccount(
        res.validated.uid,
        {
          email: res.validated.email,
          displayName: res.validated.displayName,
          role: res.validated.role,
          active: res.validated.active,
          assignedTrainerId: res.validated.assignedTrainerId,
        },
        existing,
        staffUser,
      );

      setUid('');
      setEmail('');
      setDisplayName('');
      setAssignedTrainerId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision staff account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">
          Staff &amp; Role-Based Access Control
        </h2>
        <p className="text-xs text-[#A1A1AA]">
          Owner-only registry for granting and revoking Owner, Front-Desk Staff, and Trainer access
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-[#111111] p-6 space-y-6">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              Provisioned Accounts
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Public registration is blocked. Deactivation takes effect immediately in Firestore rules.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-white/10 rounded-md">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#080808] text-xs text-[#A1A1AA]">
                <th className="py-3 px-4 font-medium">Staff Member</th>
                <th className="py-3 px-4 font-medium">UID</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Trainer Scope</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {staffList.map((acc) => (
                <tr key={acc.id}>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{acc.displayName}</p>
                    <p className="text-xs text-[#A1A1AA]">{acc.email}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#A1A1AA] font-mono">{acc.uid}</td>
                  <td className="py-3 px-4 text-xs uppercase font-semibold text-white">
                    {acc.role}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#A1A1AA] font-mono">
                    {acc.assignedTrainerId || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    <span className={acc.active ? 'text-emerald-400' : 'text-zinc-500'}>
                      {acc.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {acc.uid === staffUser.uid ? (
                      <span className="text-xs text-[#A1A1AA]">Current Owner Session</span>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmToggle(acc)}
                          className="rounded-md border border-white/15 bg-[#080808] px-3 py-1.5 text-xs text-white hover:border-[#FF5A1F] cursor-pointer"
                        >
                          {acc.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(acc)}
                          aria-label={`Remove ${acc.displayName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#080808] text-[#A1A1AA] hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleProvision} className="border-t border-white/10 pt-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <UserPlus className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
            <span>Provision Staff or Trainer UID</span>
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-[#FF5A1F]">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="text"
              required
              placeholder="Firebase Auth UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
            />
            <input
              type="email"
              required
              placeholder="Verified Google Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
            />
            <input
              type="text"
              required
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
            />
            <select
              aria-label="Staff role"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
            >
              <option value="staff">Staff (Front Desk)</option>
              <option value="trainer">Trainer (Scoped)</option>
              <option value="owner">Owner (Full Control)</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[42px] rounded-md bg-[#FF5A1F] text-white px-4 text-xs font-semibold hover:bg-[#e54c14] cursor-pointer whitespace-nowrap"
            >
              {saving ? 'Provisioning...' : 'Provision Account'}
            </button>
          </div>

          {role === 'trainer' && (
            <div className="max-w-md">
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Link Trainer Profile Scope ID (optional; defaults to Auth UID if left blank)
              </label>
              <select
                value={assignedTrainerId}
                onChange={(e) => setAssignedTrainerId(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              >
                <option value="">Use Auth UID directly</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.id})
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      </section>

      {confirmToggle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm staff status change"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              {confirmToggle.active ? 'Deactivate' : 'Activate'} {confirmToggle.displayName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              {confirmToggle.active
                ? 'Deactivating immediately revokes Firestore and API access for this account.'
                : 'Activating restores access matching this account role.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmToggle(null)}
                className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-4 text-sm text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveStaffAccount(
                    confirmToggle.uid,
                    {
                      email: confirmToggle.email,
                      displayName: confirmToggle.displayName,
                      role: confirmToggle.role,
                      active: !confirmToggle.active,
                      assignedTrainerId: confirmToggle.assignedTrainerId,
                    },
                    true,
                    staffUser,
                  );
                  setConfirmToggle(null);
                }}
                className="min-h-[42px] rounded-md bg-[#FF5A1F] px-5 text-sm font-semibold text-white cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm remove staff"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#111111] p-6">
            <h3 className="font-display text-2xl font-bold text-white">
              Remove {confirmDelete.displayName}?
            </h3>
            <p className="mt-2 text-sm text-[#A1A1AA]">
              Deletes this staff access record permanently.
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
                  await removeStaffAccount(confirmDelete.uid, staffUser);
                  setConfirmDelete(null);
                }}
                className="min-h-[42px] rounded-md bg-red-600 px-5 text-sm font-semibold text-white cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

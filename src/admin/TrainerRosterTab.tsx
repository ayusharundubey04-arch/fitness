import { useMemo } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import type { GymMember } from '../types/gym';
import { projectMemberForTrainer } from '../utils/adminLogic';
import type { StaffSessionUser } from '../lib/firestoreService';

interface TrainerRosterTabProps {
  members: GymMember[];
  staffUser: StaffSessionUser;
}

export default function TrainerRosterTab({
  members,
  staffUser,
}: TrainerRosterTabProps) {
  const roster = useMemo(
    () => members.filter((m) => !m.archivedAt).map(projectMemberForTrainer),
    [members],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">
          Assigned Member Roster
        </h2>
        <p className="text-xs text-[#A1A1AA]">
          Scoped coaching view for {staffUser.displayName}. Exposes only active assigned coaching
          details (billing, emails, phone numbers, and leads are restricted).
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] p-4 flex items-center gap-2.5 text-xs text-[#A1A1AA]">
        <ShieldCheck className="h-4 w-4 text-[#FF5A1F] shrink-0" aria-hidden="true" />
        <span>
          Trainer least-privilege projection active: {roster.length} active assigned member(s).
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {roster.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA] flex flex-col items-center gap-2">
            <Users className="h-6 w-6 text-[#FF5A1F]" aria-hidden="true" />
            <span>No active members are currently assigned to your trainer profile.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3.5 px-4 font-medium">Member Name</th>
                  <th className="py-3.5 px-4 font-medium">Active Plan</th>
                  <th className="py-3.5 px-4 font-medium">Membership Expiry</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {roster.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4 font-semibold text-white">{m.fullName}</td>
                    <td className="py-3.5 px-4 text-white">{m.planName}</td>
                    <td className="py-3.5 px-4 text-xs text-[#A1A1AA] tabular-nums">
                      {m.expiryDate}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          m.memberStatus === 'Active'
                            ? 'text-emerald-400'
                            : m.memberStatus === 'Expired'
                            ? 'text-red-400'
                            : 'text-zinc-400'
                        }
                      >
                        {m.memberStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import type { AuditEventRecord } from '../types/gym';

interface AuditLogTabProps {
  auditEvents: AuditEventRecord[];
}

export default function AuditLogTab({ auditEvents }: AuditLogTabProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...auditEvents].reverse();
    if (!q) return list;
    return list.filter(
      (ev) =>
        ev.action.toLowerCase().includes(q) ||
        ev.actorEmail.toLowerCase().includes(q) ||
        ev.resourceType.toLowerCase().includes(q) ||
        ev.resourceId.toLowerCase().includes(q) ||
        ev.reason.toLowerCase().includes(q),
    );
  }, [auditEvents, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">
          Immutable Audit Trail
        </h2>
        <p className="text-xs text-[#A1A1AA]">
          Owner-only read-only log of staff actions, content approvals, refunds, attendance corrections, and CSV exports
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] p-4 relative">
        <Search
          className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A1A1AA]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter audit trail by actor, action, resource, or reason..."
          aria-label="Filter audit events"
          className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] pl-10 pr-4 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111111] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#A1A1AA] flex flex-col items-center gap-2">
            <ScrollText className="h-6 w-6 text-[#FF5A1F]" aria-hidden="true" />
            <span>No audit events recorded yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#080808]/60 text-xs text-[#A1A1AA]">
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Actor &amp; Role</th>
                  <th className="py-3 px-4 font-medium">Resource</th>
                  <th className="py-3 px-4 font-medium">Fields / Reason</th>
                  <th className="py-3 px-4 font-medium">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono text-xs text-[#FF5A1F]">
                      {ev.action}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="text-white">{ev.actorEmail}</p>
                      <p className="text-[#A1A1AA] uppercase">{ev.roleSnapshot}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-white">
                      {ev.resourceType}/{ev.resourceId}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#A1A1AA] max-w-xs">
                      <p className="truncate">{ev.changedFields.join(', ')}</p>
                      {ev.reason && <p className="text-white mt-0.5">{ev.reason}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-[#A1A1AA]">
                      {ev.requestId}
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

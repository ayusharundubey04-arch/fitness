import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  LogIn,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { LoginEventRecord, MembershipRequestRecord } from '../types/gym';
import {
  buildRecentActivityFeed,
  formatActivityTimestamp,
  type RecentActivityItem,
} from '../utils/adminLogic';

interface RecentActivityPanelProps {
  requests: MembershipRequestRecord[];
  loginEvents: LoginEventRecord[];
  isOwner: boolean;
  onNavigateTab: (tab: string) => void;
}

type ActivityFilter = 'all' | 'approval' | 'login';

function badgeStyle(tone: RecentActivityItem['badgeTone']): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300';
    case 'amber':
      return 'border-amber-500/35 bg-amber-500/10 text-amber-300';
    case 'red':
      return 'border-red-500/35 bg-red-500/10 text-red-300';
    case 'orange':
      return 'border-[#FF5A1F]/40 bg-[#FF5A1F]/15 text-[#FF5A1F]';
    default:
      return 'border-white/15 bg-white/[0.04] text-[#A1A1AA]';
  }
}

function renderItemIcon(item: RecentActivityItem) {
  if (item.category === 'login') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#FF5A1F]/35 bg-[#FF5A1F]/10 text-[#FF5A1F]">
        <LogIn className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }
  if (item.badgeTone === 'emerald') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-400">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }
  if (item.badgeTone === 'red') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-500/35 bg-red-500/10 text-red-400">
        <XCircle className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-400">
      <Clock className="h-4 w-4" aria-hidden="true" />
    </div>
  );
}

export default function RecentActivityPanel({
  requests,
  loginEvents,
  isOwner,
  onNavigateTab,
}: RecentActivityPanelProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const allItems = useMemo(
    () => buildRecentActivityFeed(requests, loginEvents, 40),
    [requests, loginEvents],
  );

  const visibleItems = useMemo(() => {
    if (filter === 'all') return allItems.slice(0, 14);
    return allItems.filter((item) => item.category === filter).slice(0, 14);
  }, [allItems, filter]);

  const approvalCount = useMemo(
    () => allItems.filter((item) => item.category === 'approval').length,
    [allItems],
  );
  const loginCount = useMemo(
    () => allItems.filter((item) => item.category === 'login').length,
    [allItems],
  );

  return (
    <section
      aria-label="Recent Activity"
      className="rounded-lg border border-white/10 bg-[#111111] p-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 text-[#FF5A1F]">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Recent Activity
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Real-time transparency log for membership approvals and Admin, Trainer &amp; Member portal logins
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter recent activity"
            className="inline-flex rounded-md border border-white/10 bg-[#080808] p-1 gap-1"
          >
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-[34px] rounded px-3 text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'all'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              All ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('approval')}
              className={`min-h-[34px] rounded px-3 text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'approval'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Approvals ({approvalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('login')}
              className={`min-h-[34px] rounded px-3 text-xs font-semibold transition-colors cursor-pointer ${
                filter === 'login'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Logins ({loginCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('approvals')}
            className="min-h-[38px] rounded-md border border-white/15 bg-[#080808] px-3.5 text-xs font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
          >
            Approvals Queue
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => onNavigateTab('audit')}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-3.5 text-xs font-semibold text-[#A1A1AA] hover:border-[#FF5A1F] hover:text-white cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
              <span>Audit Trail</span>
            </button>
          )}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-[#A1A1AA]">
            {filter === 'approval'
              ? 'No membership approvals or requests recorded yet.'
              : filter === 'login'
              ? 'No portal sign-in events recorded yet.'
              : 'No recent membership approvals or portal logins recorded yet.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-white/10">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                {renderItemIcon(item)}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {item.title}
                    </p>
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(
                        item.badgeTone,
                      )}`}
                    >
                      {item.badgeLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#A1A1AA] truncate">
                    {item.subtitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#A1A1AA]/80 truncate">
                    {item.actorLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-12 sm:pl-0">
                <span className="text-xs font-medium text-[#A1A1AA] tabular-nums">
                  {formatActivityTimestamp(item.timestampMs)}
                </span>
                {item.targetTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(item.targetTab!)}
                    className="text-xs font-semibold text-[#FF5A1F] hover:underline cursor-pointer"
                  >
                    Open
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

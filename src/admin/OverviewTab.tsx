import {
  AlertTriangle,
  CalendarClock,
  FileCheck2,
  IndianRupee,
  MessageSquarePlus,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import type {
  EnquiryRecord,
  GymMember,
  PaymentRecord,
  SiteContentRecord,
} from '../types/gym';
import { computeDashboardMetrics, formatInr } from '../utils/adminLogic';

interface OverviewTabProps {
  members: GymMember[];
  enquiries: EnquiryRecord[];
  payments: PaymentRecord[];
  siteContent: SiteContentRecord[];
  onNavigateTab: (tab: string) => void;
}

export default function OverviewTab({
  members,
  enquiries,
  payments,
  siteContent,
  onNavigateTab,
}: OverviewTabProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const metrics = computeDashboardMetrics(members, enquiries, payments, todayIso);
  const maxMonthlyRevenue = Math.max(
    1,
    ...metrics.monthlySeries.map((m) => m.revenue),
  );
  const maxPipelineCount = Math.max(
    1,
    ...metrics.enquiryPipeline.map((p) => p.count),
  );

  const approvedCount = siteContent.filter(
    (c) => c.status === 'verified' || c.status === 'owner-approved',
  ).length;
  const pendingCount = Math.max(0, siteContent.length - approvedCount);

  const kpis = [
    { label: 'Active Directory', value: String(metrics.totalMembers), icon: Users, accent: false },
    { label: 'Active Members', value: String(metrics.activeMembers), icon: UserCheck, accent: false },
    { label: 'Expired Memberships', value: String(metrics.expiredMembers), icon: UserX, accent: true },
    { label: 'New Enquiries', value: String(metrics.newEnquiries), icon: MessageSquarePlus, accent: true },
    { label: 'Monthly Revenue', value: formatInr(metrics.monthlyRevenue), icon: IndianRupee, accent: false },
    { label: 'Pending Payments', value: formatInr(metrics.pendingPayments), icon: AlertTriangle, accent: true },
    {
      label: 'Expiring in 14 Days',
      value: String(metrics.upcomingExpirations.length),
      icon: CalendarClock,
      accent: metrics.upcomingExpirations.length > 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Verification Gate Summary */}
      <div className="rounded-lg border border-white/10 bg-[#111111] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileCheck2 className="h-5 w-5 text-[#FF5A1F] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-white">
              Owner Release Gate Status
            </p>
            <p className="text-xs text-[#A1A1AA] tabular-nums">
              {approvedCount} verified/approved register item(s) · {pendingCount} item(s) pending
              owner confirmation (disputed phone, full hours, Maps pin, dated reviews, and plans stay
              hidden publicly until approved).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('content')}
          className="shrink-0 min-h-[38px] rounded-md border border-white/15 bg-[#080808] px-4 text-xs font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
        >
          Review Register
        </button>
      </div>

      {/* KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-lg border border-white/10 bg-[#111111] p-5 flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-xs font-medium text-[#A1A1AA]">{kpi.label}</p>
                <p className="mt-2 font-display text-3xl font-bold text-white tabular-nums">
                  {kpi.value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
                  kpi.accent
                    ? 'border-[#FF5A1F]/40 bg-[#FF5A1F]/10 text-[#FF5A1F]'
                    : 'border-white/10 bg-[#080808] text-[#A1A1AA]'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Revenue Bar Chart */}
        <section className="lg:col-span-7 rounded-lg border border-white/10 bg-[#111111] p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">
                6-Month Net Collected Revenue
              </h2>
              <p className="text-xs text-[#A1A1AA]">
                Recorded paid amounts across desk/offline transactions (excluding refunded receipts)
              </p>
            </div>
            <span className="text-xs font-semibold text-[#FF5A1F] tabular-nums">
              {formatInr(metrics.monthlyRevenue)} this month
            </span>
          </div>

          <div className="h-56 flex items-end gap-3 sm:gap-5 pt-6 border-t border-white/10">
            {metrics.monthlySeries.map((bar) => {
              const pct = Math.max(4, Math.round((bar.revenue / maxMonthlyRevenue) * 100));
              return (
                <div key={bar.monthKey} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[11px] font-medium text-[#A1A1AA] tabular-nums">
                    {bar.revenue > 0 ? formatInr(bar.revenue) : '₹0'}
                  </span>
                  <div className="w-full max-w-[48px] flex-1 flex items-end">
                    <div
                      style={{ height: `${bar.revenue > 0 ? pct : 4}%` }}
                      className={`w-full rounded-t-sm transition-all ${
                        bar.revenue > 0 ? 'bg-[#FF5A1F]' : 'bg-white/10'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-[#A1A1AA] whitespace-nowrap">
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Enquiry Pipeline & Member Distribution */}
        <section className="lg:col-span-5 rounded-lg border border-white/10 bg-[#111111] p-6 flex flex-col justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Enquiry Pipeline
            </h2>
            <p className="text-xs text-[#A1A1AA] mb-5">
              Lead progression from consented website &amp; walk-in enquiries
            </p>
            <div className="space-y-3">
              {metrics.enquiryPipeline.map((item) => {
                const widthPct = Math.round((item.count / maxPipelineCount) * 100);
                return (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">{item.status}</span>
                      <span className="text-[#A1A1AA] tabular-nums">{item.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#080808] overflow-hidden">
                      <div
                        style={{ width: `${item.count > 0 ? Math.max(8, widthPct) : 0}%` }}
                        className="h-full bg-[#FF5A1F]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold tracking-wider text-[#A1A1AA] uppercase mb-3">
              Active Member Status Split
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-[#080808] p-3 border border-white/10">
                <p className="text-xs text-[#A1A1AA]">Active</p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tabular-nums">
                  {metrics.activeMembers}
                </p>
              </div>
              <div className="rounded-md bg-[#080808] p-3 border border-white/10">
                <p className="text-xs text-[#A1A1AA]">Expired</p>
                <p className="mt-1 font-display text-2xl font-bold text-[#FF5A1F] tabular-nums">
                  {metrics.expiredMembers}
                </p>
              </div>
              <div className="rounded-md bg-[#080808] p-3 border border-white/10">
                <p className="text-xs text-[#A1A1AA]">Paused</p>
                <p className="mt-1 font-display text-2xl font-bold text-zinc-300 tabular-nums">
                  {metrics.pausedMembers}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Upcoming Expirations Table */}
      <section className="rounded-lg border border-white/10 bg-[#111111] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">
              Upcoming Membership Expirations (Next 14 Days)
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              Proactive renewal reminders for active members nearing end date
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('members')}
            className="rounded-md border border-white/15 bg-[#080808] px-4 py-2 text-xs font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
          >
            Manage Members
          </button>
        </div>

        {metrics.upcomingExpirations.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#A1A1AA] border-t border-white/10">
            No active memberships expiring within the next 14 days.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-[#A1A1AA]">
                  <th className="py-3 pr-4 font-medium">Member</th>
                  <th className="py-3 pr-4 font-medium">Phone</th>
                  <th className="py-3 pr-4 font-medium">Plan</th>
                  <th className="py-3 pr-4 font-medium">Expiry Date</th>
                  <th className="py-3 text-right font-medium">Days Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {metrics.upcomingExpirations.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-medium text-white">{m.fullName}</td>
                    <td className="py-3 pr-4 text-[#A1A1AA] tabular-nums">{m.phone}</td>
                    <td className="py-3 pr-4 text-[#A1A1AA]">{m.planName}</td>
                    <td className="py-3 pr-4 text-white tabular-nums">{m.expiryDate}</td>
                    <td className="py-3 text-right font-semibold text-[#FF5A1F] tabular-nums">
                      {m.daysRemaining === 0 ? 'Today' : `${m.daysRemaining}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

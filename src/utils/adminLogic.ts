import type {
  AttendanceRecord,
  EnquiryRecord,
  GymMember,
  LoginEventRecord,
  MembershipRequestRecord,
  MemberStatus,
  PaymentRecord,
  PaymentStatus,
} from '../types/gym';

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + Math.max(1, Math.round(days)));
  return date.toISOString().slice(0, 10);
}

export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const safeMonths = Math.max(1, Math.round(months));
  const targetMonthIndex = month + safeMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, normalizedMonth, clampedDay))
    .toISOString()
    .slice(0, 10);
}

export function daysUntilDate(targetIsoDate: string, referenceIsoDate: string): number {
  const t = Date.parse(`${targetIsoDate}T00:00:00Z`);
  const r = Date.parse(`${referenceIsoDate}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(r)) return 9999;
  return Math.round((t - r) / (1000 * 60 * 60 * 24));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 160);
}

export interface MembershipValiditySummary {
  daysRemaining: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  validityLabel: string;
  badgeTone: 'emerald' | 'amber' | 'red' | 'zinc';
}

export function computeMembershipValidity(
  expiryDate: string,
  memberStatus: MemberStatus,
  referenceIsoDate: string,
): MembershipValiditySummary {
  const daysRemaining = daysUntilDate(expiryDate, referenceIsoDate);
  if (memberStatus === 'Paused') {
    return {
      daysRemaining,
      isExpired: false,
      isExpiringSoon: false,
      validityLabel: 'Membership paused',
      badgeTone: 'zinc',
    };
  }
  if (memberStatus === 'Expired' || daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      daysRemaining,
      isExpired: true,
      isExpiringSoon: false,
      validityLabel:
        daysRemaining < 0
          ? `Expired ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago`
          : 'Membership expired',
      badgeTone: 'red',
    };
  }
  if (daysRemaining === 0) {
    return {
      daysRemaining: 0,
      isExpired: false,
      isExpiringSoon: true,
      validityLabel: 'Expires today (0 days left)',
      badgeTone: 'amber',
    };
  }
  if (daysRemaining <= 14) {
    return {
      daysRemaining,
      isExpired: false,
      isExpiringSoon: true,
      validityLabel: `Valid for ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}`,
      badgeTone: 'amber',
    };
  }
  return {
    daysRemaining,
    isExpired: false,
    isExpiringSoon: false,
    validityLabel: `Valid for ${daysRemaining} days`,
    badgeTone: 'emerald',
  };
}

export function computePaymentAmounts(totalAmount: number, paidAmount: number): {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: PaymentStatus;
} {
  const safeTotal = Math.max(0, Math.round(totalAmount));
  const safePaid = Math.min(safeTotal, Math.max(0, Math.round(paidAmount)));
  const pendingAmount = Math.max(0, safeTotal - safePaid);
  let status: PaymentStatus = 'Pending';
  if (safeTotal > 0 && pendingAmount === 0) {
    status = 'Paid';
  } else if (safePaid > 0 && pendingAmount > 0) {
    status = 'Partial';
  } else if (safeTotal === 0 && safePaid === 0) {
    status = 'Paid';
  }
  return {
    totalAmount: safeTotal,
    paidAmount: safePaid,
    pendingAmount,
    status,
  };
}

export function hasSameDayAttendance(
  records: AttendanceRecord[],
  memberId: string,
  occurredDate: string,
): boolean {
  return records.some(
    (r) =>
      r.memberId === memberId &&
      r.occurredDate === occurredDate &&
      !r.isCorrection,
  );
}

export interface TrainerMemberSummary {
  id: string;
  fullName: string;
  planName: string;
  memberStatus: MemberStatus;
  expiryDate: string;
  assignedTrainerId: string;
  consentConfirmed: boolean;
}

export function projectMemberForTrainer(member: GymMember): TrainerMemberSummary {
  return {
    id: member.id,
    fullName: member.fullName,
    planName: member.planName,
    memberStatus: member.memberStatus,
    expiryDate: member.expiryDate,
    assignedTrainerId: member.assignedTrainerId,
    consentConfirmed: member.consentConfirmed,
  };
}

function escapeCsvCell(raw: string): string {
  const trimmed = raw ?? '';
  const formulaSafe = /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function buildMembersCsv(members: GymMember[]): string {
  const header = [
    'Member ID',
    'Full Name',
    'Phone',
    'Email',
    'Plan',
    'Start Date',
    'Expiry Date',
    'Member Status',
    'Payment Status',
    'Assigned Trainer ID',
    'Archived At',
  ];
  const rows = members.map((m) =>
    [
      m.id,
      m.fullName,
      m.phone,
      m.email,
      m.planName,
      m.startDate,
      m.expiryDate,
      m.memberStatus,
      m.paymentStatus,
      m.assignedTrainerId,
      m.archivedAt,
    ]
      .map((v) => escapeCsvCell(String(v ?? '')))
      .join(','),
  );
  return [header.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export interface DashboardMetrics {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  pausedMembers: number;
  newEnquiries: number;
  monthlyRevenue: number;
  pendingPayments: number;
  upcomingExpirations: Array<GymMember & { daysRemaining: number }>;
  monthlySeries: Array<{ monthKey: string; label: string; revenue: number }>;
  enquiryPipeline: Array<{ status: string; count: number }>;
}

export function computeDashboardMetrics(
  members: GymMember[],
  enquiries: EnquiryRecord[],
  payments: PaymentRecord[],
  referenceIsoDate: string,
): DashboardMetrics {
  const visibleMembers = members.filter((m) => !m.archivedAt);
  const activeMembers = visibleMembers.filter((m) => m.memberStatus === 'Active').length;
  const expiredMembers = visibleMembers.filter((m) => m.memberStatus === 'Expired').length;
  const pausedMembers = visibleMembers.filter((m) => m.memberStatus === 'Paused').length;
  const newEnquiries = enquiries.filter((e) => e.status === 'New').length;

  const settledPayments = payments.filter((p) => p.status !== 'Refunded');
  const currentMonthKey = referenceIsoDate.slice(0, 7);
  const monthlyRevenue = settledPayments
    .filter((p) => p.transactionDate.startsWith(currentMonthKey))
    .reduce((sum, p) => sum + Math.max(0, p.paidAmount), 0);

  const pendingPayments = settledPayments.reduce(
    (sum, p) => sum + Math.max(0, p.pendingAmount),
    0,
  );

  const upcomingExpirations = visibleMembers
    .filter((m) => m.memberStatus === 'Active')
    .map((m) => ({
      ...m,
      daysRemaining: daysUntilDate(m.expiryDate, referenceIsoDate),
    }))
    .filter((m) => m.daysRemaining >= 0 && m.daysRemaining <= 14)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const refYear = Number(referenceIsoDate.slice(0, 4));
  const refMonth = Number(referenceIsoDate.slice(5, 7)) - 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlySeries: Array<{ monthKey: string; label: string; revenue: number }> = [];

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(Date.UTC(refYear, refMonth - offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const revenue = settledPayments
      .filter((p) => p.transactionDate.startsWith(monthKey))
      .reduce((sum, p) => sum + Math.max(0, p.paidAmount), 0);
    monthlySeries.push({
      monthKey,
      label: `${monthNames[m]} '${String(y).slice(2)}`,
      revenue,
    });
  }

  const statuses: Array<EnquiryRecord['status']> = [
    'New',
    'Contacted',
    'Interested',
    'Converted',
    'Not interested',
  ];
  const enquiryPipeline = statuses.map((status) => ({
    status,
    count: enquiries.filter((e) => e.status === status).length,
  }));

  return {
    totalMembers: visibleMembers.length,
    activeMembers,
    expiredMembers,
    pausedMembers,
    newEnquiries,
    monthlyRevenue,
    pendingPayments,
    upcomingExpirations,
    monthlySeries,
    enquiryPipeline,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function generateReceiptHtml(
  payment: PaymentRecord,
  businessAddress: string,
  phone: string,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const contactLine = phone.trim()
    ? `Phone: ${esc(phone)}`
    : 'Phone: Pending owner verification';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt ${esc(payment.receiptNumber)} - ASSURE FITNESS CLUB LLP</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f5; color: #09090b; padding: 32px; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #d4d4d8; border-radius: 8px; padding: 32px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #FF5A1F; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: 0.04em; }
    .muted { color: #52525b; font-size: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e4e4e7; font-size: 14px; }
    th { color: #52525b; font-weight: 600; width: 42%; }
    .total { font-weight: 700; font-size: 16px; }
    .note { margin-top: 24px; font-size: 11px; color: #52525b; background: #fafafa; padding: 12px; border: 1px solid #e4e4e7; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="brand">ASSURE FITNESS CLUB LLP</div>
        <div class="muted">${esc(businessAddress)}<br/>${contactLine}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;font-size:14px;">PAYMENT RECEIPT</div>
        <div class="muted">Receipt #: ${esc(payment.receiptNumber)}<br/>Date: ${esc(payment.transactionDate)}</div>
      </div>
    </div>
    <table>
      <tr><th>Member Name</th><td>${esc(payment.memberName)}</td></tr>
      <tr><th>Membership Plan</th><td>${esc(payment.planName)}</td></tr>
      <tr><th>Recorded Method</th><td>${esc(payment.paymentMethod)}${payment.reference ? ` (${esc(payment.reference)})` : ''}</td></tr>
      <tr><th>Status</th><td>${esc(payment.status)}${payment.reconciled ? ' · Reconciled' : ''}</td></tr>
      <tr><th>Total Plan / Bill Amount</th><td>${formatInr(payment.totalAmount)}</td></tr>
      <tr class="total"><th>Amount Paid</th><td>${formatInr(payment.paidAmount)}</td></tr>
      <tr><th>Pending Balance</th><td>${formatInr(payment.pendingAmount)}</td></tr>
      ${payment.refundReason ? `<tr><th>Refund Note</th><td>${esc(payment.refundReason)}</td></tr>` : ''}
      ${payment.notes ? `<tr><th>Notes</th><td>${esc(payment.notes)}</td></tr>` : ''}
    </table>
    <div class="note">
      Recorded manually by Assure Fitness Club LLP desk administration. This receipt reflects offline/desk payment recording and does not represent an automated online payment gateway settlement.
    </div>
  </div>
</body>
</html>`;
}

export function extractTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? 0 : ts.getTime();
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts === 'object') {
    const maybeObj = ts as {
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };
    if (typeof maybeObj.toMillis === 'function') {
      const ms = maybeObj.toMillis();
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof maybeObj.seconds === 'number' && Number.isFinite(maybeObj.seconds)) {
      const ns = typeof maybeObj.nanoseconds === 'number' ? maybeObj.nanoseconds : 0;
      return Math.round(maybeObj.seconds * 1000 + ns / 1_000_000);
    }
  }
  return 0;
}

export function formatActivityTimestamp(
  timestampMs: number,
  nowMs = Date.now(),
): string {
  if (!timestampMs || timestampMs <= 0) return 'Just now';
  const diffSec = Math.round((nowMs - timestampMs) / 1000);
  if (diffSec >= 0 && diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin >= 1 && diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours >= 1 && diffHours < 24) return `${diffHours}h ago`;

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestampMs));
}

export interface RecentActivityItem {
  id: string;
  category: 'approval' | 'login';
  title: string;
  subtitle: string;
  actorLabel: string;
  badgeLabel: string;
  badgeTone: 'emerald' | 'amber' | 'red' | 'orange' | 'zinc';
  timestampMs: number;
  targetTab?: 'approvals' | 'members';
}

export function buildRecentActivityFeed(
  requests: MembershipRequestRecord[],
  loginEvents: LoginEventRecord[],
  limitCount = 25,
): RecentActivityItem[] {
  const approvalItems: RecentActivityItem[] = requests
    .filter((req) => req.status === 'Approved' || req.status === 'Rejected' || req.status === 'Pending')
    .map((req) => {
      const timestampMs =
        extractTimestampMillis(req.updatedAt) ||
        extractTimestampMillis(req.createdAt) ||
        (req.existingStartDate ? extractTimestampMillis(`${req.existingStartDate}T00:00:00Z`) : 0);

      if (req.status === 'Approved') {
        const months = req.approvedMonths || req.monthsRequested;
        return {
          id: `approval_${req.id}`,
          category: 'approval',
          title: `Approved ${req.fullName}`,
          subtitle: `${months} month${months === 1 ? '' : 's'} · ${req.planName}${req.reviewerNotes ? ` · ${req.reviewerNotes}` : ''}`,
          actorLabel: req.approvedBy ? `Approved by ${req.approvedBy}` : req.email,
          badgeLabel: `Approved · ${months}m`,
          badgeTone: 'emerald',
          timestampMs,
          targetTab: 'approvals',
        };
      }

      if (req.status === 'Rejected') {
        return {
          id: `approval_${req.id}`,
          category: 'approval',
          title: `Declined ${req.fullName}`,
          subtitle: `${req.planName}${req.reviewerNotes ? ` · ${req.reviewerNotes}` : ''}`,
          actorLabel: req.approvedBy ? `Reviewed by ${req.approvedBy}` : req.email,
          badgeLabel: 'Declined',
          badgeTone: 'red',
          timestampMs,
          targetTab: 'approvals',
        };
      }

      return {
        id: `approval_${req.id}`,
        category: 'approval',
        title: `Pending Claim · ${req.fullName}`,
        subtitle: `${req.claimType} · ${req.monthsRequested} month${req.monthsRequested === 1 ? '' : 's'} · ${req.planName}`,
        actorLabel: req.email,
        badgeLabel: 'Pending Review',
        badgeTone: 'amber',
        timestampMs,
        targetTab: 'approvals',
      };
    });

  const loginItems: RecentActivityItem[] = loginEvents.map((ev) => {
    const portalLabel =
      ev.portal === 'admin'
        ? 'Admin Console'
        : ev.portal === 'trainer'
        ? 'Trainer Portal'
        : 'Member Portal';
    const methodLabel = ev.method === 'password' ? 'Email & Password' : 'Google';
    const roleLabel = ev.role.toUpperCase();
    const who = ev.displayName?.trim() || ev.email;

    return {
      id: `login_${ev.id}`,
      category: 'login',
      title: `${who} signed in`,
      subtitle: `${portalLabel} via ${methodLabel} · ${ev.email}`,
      actorLabel: ev.email,
      badgeLabel: `${roleLabel} · /${ev.portal}`,
      badgeTone: ev.role === 'owner' || ev.role === 'staff' ? 'orange' : 'zinc',
      timestampMs: extractTimestampMillis(ev.occurredAt),
    };
  });

  return [...approvalItems, ...loginItems]
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, Math.max(1, limitCount));
}

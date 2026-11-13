import type {
  AttendanceRecord,
  EnquiryRecord,
  GymMember,
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

export function daysUntilDate(targetIsoDate: string, referenceIsoDate: string): number {
  const t = Date.parse(`${targetIsoDate}T00:00:00Z`);
  const r = Date.parse(`${referenceIsoDate}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(r)) return 9999;
  return Math.round((t - r) / (1000 * 60 * 60 * 24));
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

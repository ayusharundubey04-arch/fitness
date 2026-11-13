import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToIsoDate,
  buildMembersCsv,
  computeDashboardMetrics,
  computePaymentAmounts,
  daysUntilDate,
  generateReceiptHtml,
  hasSameDayAttendance,
  projectMemberForTrainer,
} from './adminLogic';
import type {
  AttendanceRecord,
  EnquiryRecord,
  GymMember,
  PaymentRecord,
} from '../types/gym';

test('addDaysToIsoDate computes accurate membership expiry dates', () => {
  assert.equal(addDaysToIsoDate('2026-11-01', 30), '2026-12-01');
  assert.equal(addDaysToIsoDate('2026-01-31', 90), '2026-05-01');
});

test('daysUntilDate calculates positive, zero, and negative day deltas', () => {
  assert.equal(daysUntilDate('2026-11-20', '2026-11-13'), 7);
  assert.equal(daysUntilDate('2026-11-13', '2026-11-13'), 0);
  assert.equal(daysUntilDate('2026-11-10', '2026-11-13'), -3);
});

test('computePaymentAmounts derives pending balance and status accurately', () => {
  assert.deepEqual(computePaymentAmounts(5000, 5000), {
    totalAmount: 5000,
    paidAmount: 5000,
    pendingAmount: 0,
    status: 'Paid',
  });
  assert.deepEqual(computePaymentAmounts(5000, 2000), {
    totalAmount: 5000,
    paidAmount: 2000,
    pendingAmount: 3000,
    status: 'Partial',
  });
  assert.deepEqual(computePaymentAmounts(5000, 0), {
    totalAmount: 5000,
    paidAmount: 0,
    pendingAmount: 5000,
    status: 'Pending',
  });
});

test('computeDashboardMetrics excludes archived members and refunded payments', () => {
  const members: GymMember[] = [
    {
      id: 'm1',
      fullName: 'Rohan Patel',
      phone: '+919000000001',
      email: 'rohan@example.com',
      joiningDate: '2026-08-15',
      planId: 'p1',
      planName: 'Quarterly Commitment',
      startDate: '2026-08-15',
      expiryDate: '2026-11-18',
      paymentStatus: 'Paid',
      memberStatus: 'Active',
      assignedTrainerId: 'trn1',
      consentConfirmed: true,
      archivedAt: '',
      notes: '',
    },
    {
      id: 'm2',
      fullName: 'Sneha Shah',
      phone: '+919000000002',
      email: '',
      joiningDate: '2026-09-01',
      planId: 'p2',
      planName: 'Monthly Access',
      startDate: '2026-09-01',
      expiryDate: '2026-10-01',
      paymentStatus: 'Pending',
      memberStatus: 'Expired',
      assignedTrainerId: '',
      consentConfirmed: true,
      archivedAt: '',
      notes: '',
    },
    {
      id: 'm3',
      fullName: 'Archived Member',
      phone: '+919000000003',
      email: '',
      joiningDate: '2026-01-01',
      planId: 'p2',
      planName: 'Monthly Access',
      startDate: '2026-01-01',
      expiryDate: '2026-11-15',
      paymentStatus: 'Paid',
      memberStatus: 'Active',
      assignedTrainerId: '',
      consentConfirmed: true,
      archivedAt: '2026-11-01',
      notes: '',
    },
  ];
  const enquiries: EnquiryRecord[] = [
    {
      id: 'e1',
      customerName: 'Meet Desai',
      phone: '+919000000004',
      email: '',
      interestedPlan: 'Quarterly Commitment',
      message: 'Evening slot?',
      enquiryDate: '2026-11-13',
      status: 'New',
      assigneeUid: '',
      followUpDate: '',
      retentionReviewDate: '2027-05-12',
      consentAccepted: true,
      consentVersion: 'v1.0-draft',
      consentAt: '2026-11-13T08:00:00Z',
      internalNotes: '',
      source: 'Website',
    },
  ];
  const payments: PaymentRecord[] = [
    {
      id: 'pay1',
      memberId: 'm1',
      membershipId: '',
      memberName: 'Rohan Patel',
      planName: 'Quarterly Commitment',
      currency: 'INR',
      totalAmount: 4500,
      paidAmount: 3000,
      pendingAmount: 1500,
      status: 'Partial',
      paymentMethod: 'UPI',
      reference: 'UTR-1',
      recorderUid: 'uid_owner',
      reconciled: false,
      reconciledBy: '',
      refundReason: '',
      transactionDate: '2026-11-10',
      receiptNumber: 'AFC-20261110-1001',
      notes: '',
    },
    {
      id: 'pay2',
      memberId: 'm2',
      membershipId: '',
      memberName: 'Sneha Shah',
      planName: 'Monthly Access',
      currency: 'INR',
      totalAmount: 1500,
      paidAmount: 1500,
      pendingAmount: 0,
      status: 'Refunded',
      paymentMethod: 'Cash',
      reference: '',
      recorderUid: 'uid_owner',
      reconciled: true,
      reconciledBy: 'owner@example.com',
      refundReason: 'Duplicate desk entry',
      transactionDate: '2026-11-11',
      receiptNumber: 'AFC-20261111-1002',
      notes: '',
    },
  ];

  const metrics = computeDashboardMetrics(members, enquiries, payments, '2026-11-13');
  assert.equal(metrics.totalMembers, 2);
  assert.equal(metrics.activeMembers, 1);
  assert.equal(metrics.expiredMembers, 1);
  assert.equal(metrics.newEnquiries, 1);
  assert.equal(metrics.monthlyRevenue, 3000);
  assert.equal(metrics.pendingPayments, 1500);
  assert.equal(metrics.upcomingExpirations.length, 1);
  assert.equal(metrics.upcomingExpirations[0].daysRemaining, 5);
  assert.equal(metrics.monthlySeries.length, 6);
});

test('hasSameDayAttendance detects existing non-correction entries for the same day', () => {
  const records: AttendanceRecord[] = [
    {
      id: 'att1',
      memberId: 'm1',
      memberName: 'Rohan Patel',
      assignedTrainerId: 'trn1',
      occurredDate: '2026-11-13',
      occurredTime: '07:15',
      recorderUid: 'uid_staff',
      recorderRole: 'staff',
      method: 'manual',
      sessionId: 'Morning',
      isCorrection: false,
      correctionOf: '',
      reason: '',
    },
  ];
  assert.equal(hasSameDayAttendance(records, 'm1', '2026-11-13'), true);
  assert.equal(hasSameDayAttendance(records, 'm1', '2026-11-14'), false);
  assert.equal(hasSameDayAttendance(records, 'm2', '2026-11-13'), false);
});

test('projectMemberForTrainer strips phone, email, paymentStatus, and notes', () => {
  const member: GymMember = {
    id: 'm1',
    fullName: 'Rohan Patel',
    phone: '+919000000001',
    email: 'rohan@example.com',
    joiningDate: '2026-08-15',
    planId: 'p1',
    planName: 'Quarterly Commitment',
    startDate: '2026-08-15',
    expiryDate: '2026-11-18',
    paymentStatus: 'Pending',
    memberStatus: 'Active',
    assignedTrainerId: 'trn1',
    consentConfirmed: true,
    archivedAt: '',
    notes: 'Private billing note',
  };
  const summary = projectMemberForTrainer(member) as unknown as Record<string, unknown>;
  assert.equal(summary.fullName, 'Rohan Patel');
  assert.equal(summary.phone, undefined);
  assert.equal(summary.email, undefined);
  assert.equal(summary.paymentStatus, undefined);
  assert.equal(summary.notes, undefined);
});

test('buildMembersCsv neutralizes formula injection prefixes', () => {
  const csv = buildMembersCsv([
    {
      id: 'm1',
      fullName: '=HYPERLINK("http://bad")',
      phone: '+919000000001',
      email: 'a@b.com',
      joiningDate: '2026-11-01',
      planId: 'p1',
      planName: 'Plan A',
      startDate: '2026-11-01',
      expiryDate: '2026-12-01',
      paymentStatus: 'Paid',
      memberStatus: 'Active',
      assignedTrainerId: '',
      consentConfirmed: true,
      archivedAt: '',
      notes: '',
    },
  ]);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+919000000001"/);
});

test('generateReceiptHtml escapes HTML, masks unverified phone, and includes disclaimer', () => {
  const html = generateReceiptHtml(
    {
      id: 'pay1',
      memberId: 'm1',
      membershipId: '',
      memberName: 'Aarav <Test>',
      planName: 'Annual Club Pass',
      currency: 'INR',
      totalAmount: 10000,
      paidAmount: 10000,
      pendingAmount: 0,
      status: 'Paid',
      paymentMethod: 'Cash',
      reference: 'CASH-01',
      recorderUid: 'uid_owner',
      reconciled: true,
      reconciledBy: 'owner@example.com',
      refundReason: '',
      transactionDate: '2026-11-13',
      receiptNumber: 'AFC-20261113-9001',
      notes: 'Paid at desk',
    },
    'J-601, White Business Hub',
    '',
  );
  assert.match(html, /Aarav &lt;Test&gt;/);
  assert.match(html, /AFC-20261113-9001/);
  assert.match(html, /Pending owner verification/);
  assert.match(html, /does not represent an automated online payment gateway settlement/i);
});

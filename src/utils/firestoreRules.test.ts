import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { computePaymentAmounts } from './adminLogic';
import { validateEnquiryForm } from './clubLogic';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf8');

test('firestore.rules enforces default deny-all, verified-email 3-tier RBAC, and valid IDs', () => {
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /function isOwner\(\)/);
  assert.match(rulesText, /function isStaff\(\)/);
  assert.match(rulesText, /function isTrainer\(\)/);
  assert.match(rulesText, /function isAssignedTrainerMember\(memberData\)/);
  assert.match(rulesText, /function isValidId\(id\)/);
});

test('firestore.rules enforces approval gates for plans, trainers, gallery, and siteContent', () => {
  assert.match(
    rulesText,
    /existing\(\)\.publicVisibility == true && existing\(\)\.approvalStatus == 'owner-approved'/,
  );
  assert.match(
    rulesText,
    /existing\(\)\.approvalStatus == 'owner-approved' && existing\(\)\.consentConfirmed == true/,
  );
  assert.match(
    rulesText,
    /\(existing\(\)\.isPlaceholder == true \|\| existing\(\)\.rightsConfirmed == true\)/,
  );
  assert.match(
    rulesText,
    /existing\(\)\.status in \['verified', 'owner-approved'\]/,
  );
});

test('firestore.rules locks PII collections, enforces member self-read & consent on requests/enquiries, and makes attendance, auditEvents & loginEvents append-only', () => {
  assert.match(rulesText, /match \/members\/\{memberId\}[\s\S]*isTrainer\(\) && existing\(\)\.archivedAt == '' && isAssignedTrainerMember\(existing\(\)\)/);
  assert.match(rulesText, /match \/members\/\{memberId\}[\s\S]*existing\(\)\.email == request\.auth\.token\.email/);
  assert.match(rulesText, /match \/membershipRequests\/\{requestId\}[\s\S]*incoming\(\)\.userUid == request\.auth\.uid[\s\S]*incoming\(\)\.status == 'Pending'[\s\S]*incoming\(\)\.approvedMonths == 0/);
  assert.match(rulesText, /match \/payments\/\{paymentId\}[\s\S]*allow update: if isOwner\(\)/);
  assert.match(rulesText, /match \/attendance\/\{attendanceId\}[\s\S]*allow update, delete: if false;/);
  assert.match(rulesText, /match \/auditEvents\/\{eventId\}[\s\S]*allow update, delete: if false;/);
  assert.match(
    rulesText,
    /match \/loginEvents\/\{eventId\}[\s\S]*allow list: if isStaff\(\);[\s\S]*incoming\(\)\.uid == request\.auth\.uid[\s\S]*incoming\(\)\.email == request\.auth\.token\.email[\s\S]*allow update, delete: if false;/,
  );
  assert.match(
    rulesText,
    /incoming\(\)\.consentAccepted == true[\s\S]*incoming\(\)\.status == 'New'\s*&& incoming\(\)\.internalNotes == ''/,
  );
});

test('firestore.rules enforces strict field allowlists (hasOnly + affectedKeys) across all 14 collections', () => {
  const hasOnlyMatches = rulesText.match(/\.keys\(\)\.hasOnly\(/g) || [];
  const affectedMatches = rulesText.match(/\.affectedKeys\(\)\.hasOnly\(/g) || [];
  assert.ok(hasOnlyMatches.length >= 14, 'All 14 collection validators must check keys().hasOnly');
  assert.ok(affectedMatches.length >= 10, 'Mutable update rules must restrict affectedKeys().hasOnly');
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
});

test('enquiry & payment validation reject missing consent, oversized messages, and overpayments', () => {
  const longMessage = 'x'.repeat(501);
  const badEnquiry = validateEnquiryForm({
    name: 'Test User',
    phone: '9898989533',
    membership: 'Monthly Access',
    message: longMessage,
    consentAccepted: false,
  });
  assert.equal(badEnquiry.valid, false);
  assert.ok(badEnquiry.errors.message);
  assert.ok(badEnquiry.errors.consentAccepted);

  const clamped = computePaymentAmounts(4000, 9999);
  assert.equal(clamped.paidAmount, 4000);
  assert.equal(clamped.pendingAmount, 0);
  assert.equal(clamped.status, 'Paid');
});

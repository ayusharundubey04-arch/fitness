# Security & Data Architecture Specification — ASSURE FITNESS CLUB LLP

## 1. Environment & Project Binding
- **Firebase Project**: `gen-lang-client-0011088266`
- **Named Firestore Database**: `ai-studio-assurefitnessclu-48e58296-290c-41b9-896f-593a5a9a4480`
- **Bootstrapped Owner**: `ayusharundubey04@gmail.com`

## 2. Three-Tier Least-Privilege RBAC (`staff/{uid}`)
Public self-registration is blocked. Only verified Google accounts present in `/staff/{uid}` with `active == true` (or the bootstrapped owner email) may access private routes or collections:
- **Public / Unauthenticated**:
  - Read `settings/public`
  - Read `membershipPlans` ONLY where `active == true && publicVisibility == true && approvalStatus == 'owner-approved'`
  - Read `trainers` ONLY where `active == true && approvalStatus == 'owner-approved' && consentConfirmed == true`
  - Read `gallery` ONLY where `visible == true && approvalStatus == 'owner-approved' && (isPlaceholder == true || rightsConfirmed == true)`
  - Read `siteContent` ONLY where `status in ['verified', 'owner-approved']`
  - Create `enquiries` ONLY when `consentAccepted == true`, `status == 'New'`, `internalNotes == ''`, `assigneeUid == ''`, `followUpDate == ''`
- **`trainer` role**:
  - Read non-archived `members` ONLY where `assignedTrainerId == request.auth.uid` or matching `staff/{uid}.assignedTrainerId`
  - UI projects minimal coaching fields only (strips email, notes, payment/billing data)
  - Read and create manual `attendance` entries and append-only corrections (`isCorrection == true`, `reason.size() >= 3`) ONLY for assigned members
  - Denied access to `enquiries`, `payments`, `memberships`, `settings/operations`, `staff`, and `auditEvents`
- **`staff` role (Front Desk / Operations)**:
  - Read & manage `members`, `memberships`, `attendance`, and `enquiries` (no permanent delete)
  - Read `payments` and record offline desk payments (`status != 'Refunded'`, `reconciled == false`)
  - Create/edit `draft` entries in `membershipPlans`, `trainers`, `gallery`, and `siteContent` (`approvalStatus == 'draft'`, `publicVisibility == false`)
  - Denied access to `staff` writes, `payments` reconcile/refund/delete, `settings` writes, `auditEvents` reads, and bulk member CSV exports
- **`owner` role**:
  - Full read/write/approval across all collections
  - Approve & publish `settings/public` toggles (phone, WhatsApp, hours, Maps pin, dated reviews), `membershipPlans`, `trainers`, `gallery`, and `siteContent`
  - Provision/deactivate `staff/{uid}` accounts, reconcile or refund payments, delete records, and inspect/export `auditEvents` and member CSV exports

## 3. Server-Side Guardrails (`server.ts`)
- `POST /api/validate-enquiry`: Enforces IP rate limiting (HTTP `429`), schema validation, and mandatory `consentAccepted === true`
- `POST /api/validate-payment`: Verifies Firebase ID token + `owner` or `staff` role (`403` for public/trainer); enforces `owner`-only refunds and reconciliation
- `POST /api/staff/provision`: Verifies `owner` role before validating staff role payloads
- `POST /api/audit-export`: Verifies `owner` role before issuing audited CSV export confirmation
- `POST /api/upload`: Verifies `owner` or `staff` role and restricts image uploads to JPG/PNG/WebP <= 5 MB

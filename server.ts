import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import { ENQUIRY_CONSENT_VERSION, validateEnquiryForm } from './src/utils/clubLogic.ts';
import { computePaymentAmounts } from './src/utils/adminLogic.ts';
import type { StaffRole } from './src/types/gym.ts';

const PORT = Number(process.env.PORT || 3000);
const BOOTSTRAPPED_OWNER_EMAIL = 'ayusharundubey04@gmail.com';
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

interface AuthorizedStaffUser extends VerifiedFirebaseUser {
  role: StaffRole;
}

// Sliding-window in-memory IP rate limiter for public enquiry validation
const enquiryRateWindowMs = 10 * 60 * 1000;
const enquiryMaxRequestsPerWindow = 8;
const enquiryIpHits = new Map<string, number[]>();

function isEnquiryRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (enquiryIpHits.get(ip) || []).filter(
    (t) => now - t < enquiryRateWindowMs,
  );
  if (timestamps.length >= enquiryMaxRequestsPerWindow) {
    enquiryIpHits.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  enquiryIpHits.set(ip, timestamps);
  return false;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || !firebaseConfig.apiKey) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user.email) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName,
    };
  } catch {
    return null;
  }
}

async function resolveAuthorizedStaffToken(
  idToken: string,
): Promise<AuthorizedStaffUser | null> {
  const user = await verifyFirebaseIdToken(idToken);
  if (!user || !user.emailVerified) return null;
  if (user.email.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL.toLowerCase()) {
    return { ...user, role: 'owner' };
  }

  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId,
    )}/databases/${encodeURIComponent(dbId)}/documents/staff/${encodeURIComponent(user.uid)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    const docData = (await resp.json()) as {
      fields?: {
        role?: { stringValue?: string };
        active?: { booleanValue?: boolean };
      };
    };
    const role = docData.fields?.role?.stringValue;
    const active = docData.fields?.active?.booleanValue;
    if (
      active === true &&
      (role === 'owner' || role === 'staff' || role === 'trainer')
    ) {
      return { ...user, role };
    }
    return null;
  } catch {
    return null;
  }
}

function extractBearerToken(authHeader: string | undefined): string {
  const h = authHeader || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'assure-fitness-club' });
  });

  // Server-side validation + IP rate limit + mandatory consent check for public enquiries
  app.post('/api/validate-enquiry', (req, res) => {
    const clientIp = String(
      req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
    );
    if (isEnquiryRateLimited(clientIp)) {
      res.status(429).json({
        ok: false,
        error: 'Too many enquiry requests from this address. Please wait a few minutes and try again.',
      });
      return;
    }

    const body = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      membership?: string;
      message?: string;
      consentAccepted?: boolean;
      consentVersion?: string;
    };

    const result = validateEnquiryForm({
      name: String(body?.name ?? ''),
      phone: String(body?.phone ?? ''),
      email: String(body?.email ?? ''),
      membership: String(body?.membership ?? ''),
      message: String(body?.message ?? ''),
      consentAccepted: body?.consentAccepted === true,
    });

    if (!result.valid) {
      res.status(400).json({ ok: false, errors: result.errors });
      return;
    }

    res.json({
      ok: true,
      sanitized: {
        customerName: String(body.name).trim().slice(0, 80),
        phone: result.normalizedPhone,
        email: String(body.email ?? '').trim().slice(0, 160),
        interestedPlan: String(body.membership).trim().slice(0, 80),
        message: String(body.message ?? '').trim().slice(0, 500),
        consentAccepted: true,
        consentVersion: String(body?.consentVersion || ENQUIRY_CONSENT_VERSION).slice(0, 40),
      },
    });
  });

  // Server-side validation for desk payments (owner & staff) and refunds/reconcile (owner-only)
  app.post('/api/validate-payment', async (req, res) => {
    const staff = await resolveAuthorizedStaffToken(
      extractBearerToken(req.headers.authorization),
    );
    if (!staff || (staff.role !== 'owner' && staff.role !== 'staff')) {
      res.status(403).json({
        ok: false,
        error: 'Owner or desk staff authorization required for payment operations.',
      });
      return;
    }

    const body = req.body as {
      action?: 'create' | 'refund' | 'reconcile';
      memberId?: string;
      memberName?: string;
      planName?: string;
      totalAmount?: number;
      paidAmount?: number;
      paymentMethod?: string;
      transactionDate?: string;
      refundReason?: string;
    };

    const action = body?.action || 'create';
    if ((action === 'refund' || action === 'reconcile') && staff.role !== 'owner') {
      res.status(403).json({
        ok: false,
        error: 'Only the club owner can reconcile or refund payment records.',
      });
      return;
    }

    if (action === 'refund' && String(body?.refundReason || '').trim().length < 3) {
      res.status(400).json({
        ok: false,
        error: 'A refund reason of at least 3 characters is required.',
      });
      return;
    }

    const total = Number(body?.totalAmount ?? 0);
    const paid = Number(body?.paidAmount ?? 0);
    const allowedMethods = new Set(['Cash', 'UPI', 'Card', 'Bank Transfer']);

    if (
      !body?.memberId ||
      !body?.memberName ||
      !body?.planName ||
      Number.isNaN(total) ||
      Number.isNaN(paid) ||
      total < 0 ||
      paid < 0 ||
      paid > total ||
      !allowedMethods.has(String(body?.paymentMethod)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(body?.transactionDate))
    ) {
      res.status(400).json({ ok: false, error: 'Invalid payment payload or amount values.' });
      return;
    }

    const computed = computePaymentAmounts(total, paid);
    const dateStamp = String(body.transactionDate).replace(/-/g, '');
    const suffix = crypto.randomInt(1000, 9999);
    const receiptNumber = `AFC-${dateStamp}-${suffix}`;

    res.json({
      ok: true,
      validated: {
        ...computed,
        currency: 'INR',
        receiptNumber,
        recorderUid: staff.uid,
        verifiedBy: staff.email,
      },
    });
  });

  // Owner-only staff provisioning validation
  app.post('/api/staff/provision', async (req, res) => {
    const staff = await resolveAuthorizedStaffToken(
      extractBearerToken(req.headers.authorization),
    );
    if (!staff || staff.role !== 'owner') {
      res.status(403).json({
        ok: false,
        error: 'Only the club owner can provision or update staff accounts.',
      });
      return;
    }

    const body = req.body as {
      uid?: string;
      email?: string;
      displayName?: string;
      role?: string;
      assignedTrainerId?: string;
      active?: boolean;
    };

    const uid = String(body?.uid || '').trim();
    const email = String(body?.email || '').trim();
    const displayName = String(body?.displayName || '').trim();
    const role = String(body?.role || '');

    if (
      !/^[a-zA-Z0-9_-]{1,128}$/.test(uid) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      displayName.length < 1 ||
      displayName.length > 100 ||
      !['owner', 'staff', 'trainer'].includes(role)
    ) {
      res.status(400).json({ ok: false, error: 'Invalid staff account payload.' });
      return;
    }

    res.json({
      ok: true,
      validated: {
        uid,
        email: email.slice(0, 160),
        displayName: displayName.slice(0, 100),
        role: role as StaffRole,
        assignedTrainerId: String(body?.assignedTrainerId || '').trim().slice(0, 128),
        active: body?.active !== false,
      },
    });
  });

  // Owner-only audited export authorization
  app.post('/api/audit-export', async (req, res) => {
    const staff = await resolveAuthorizedStaffToken(
      extractBearerToken(req.headers.authorization),
    );
    if (!staff || staff.role !== 'owner') {
      res.status(403).json({
        ok: false,
        error: 'Bulk data exports are restricted to the club owner.',
      });
      return;
    }

    const body = req.body as { scope?: string };
    const scope = String(body?.scope || '');
    if (!['members', 'payments', 'auditEvents'].includes(scope)) {
      res.status(400).json({ ok: false, error: 'Unsupported export scope.' });
      return;
    }

    res.json({
      ok: true,
      authorizedBy: staff.email,
      scope,
      timestamp: new Date().toISOString(),
    });
  });

  // Secure image upload for Owner & Desk Staff (Gallery & Trainer photos)
  app.post('/api/upload', async (req, res) => {
    const staff = await resolveAuthorizedStaffToken(
      extractBearerToken(req.headers.authorization),
    );
    if (!staff || (staff.role !== 'owner' && staff.role !== 'staff')) {
      res.status(403).json({
        ok: false,
        error: 'Owner or desk staff authentication required for uploads.',
      });
      return;
    }

    const body = req.body as {
      mimeType?: string;
      dataBase64?: string;
    };

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    const ext = body?.mimeType ? mimeToExt[body.mimeType.toLowerCase()] : undefined;
    if (!ext || !body?.dataBase64) {
      res.status(400).json({ ok: false, error: 'Only JPG, PNG, or WebP images are supported.' });
      return;
    }

    const cleanBase64 = body.dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ ok: false, error: 'Image size must be between 1 byte and 5 MB.' });
      return;
    }

    const fileName = `${crypto.randomUUID()}.${ext}`;
    const targetPath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(targetPath, buffer);

    res.json({
      ok: true,
      url: `/uploads/${fileName}`,
      sizeBytes: buffer.length,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Assure Fitness Club server listening on http://localhost:${PORT}`);
  });
}

startServer();

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  BUSINESS_INFO,
  GALLERY_ITEMS,
  MEMBERSHIP_PLANS,
} from '../data/clubData';
import { INITIAL_CONTENT_REGISTER } from '../data/contentRegister';
import type {
  AttendanceRecord,
  AuditEventRecord,
  EnquiryRecord,
  GalleryPhotoRecord,
  GymMember,
  LoginEventRecord,
  LoginEventRole,
  LoginMethod,
  LoginPortal,
  MembershipPlanRecord,
  MembershipRecord,
  MembershipRequestRecord,
  MemberStatus,
  OperationsSettingsRecord,
  PaymentRecord,
  PaymentStatus,
  SiteContentRecord,
  SiteSettingsRecord,
  StaffAccount,
  StaffRole,
  TrainerRecord,
} from '../types/gym';
import { ENQUIRY_CONSENT_VERSION } from '../utils/clubLogic';
import {
  addDaysToIsoDate,
  addMonthsToIsoDate,
  normalizeEmail,
} from '../utils/adminLogic';
import {
  db,
  handleFirestoreError,
  isBootstrappedOwnerEmail,
  OperationType,
} from './firebase';

export interface StaffSessionUser {
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  assignedTrainerId: string;
  active: boolean;
}

function makeDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return `${prefix}_${rand}`;
}

export async function resolveStaffUser(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean,
  displayName?: string | null,
): Promise<{ authorized: boolean; user: StaffSessionUser | null }> {
  if (!emailVerified || !email) return { authorized: false, user: null };

  const path = `staff/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'staff', uid));
    const isBootstrappedOwner = isBootstrappedOwnerEmail(email);

    if (snap.exists()) {
      const data = snap.data() as Partial<StaffAccount>;
      if (isBootstrappedOwner || data.active === true) {
        const role: StaffRole = isBootstrappedOwner
          ? 'owner'
          : data.role === 'owner' || data.role === 'staff' || data.role === 'trainer'
          ? data.role
          : 'staff';
        return {
          authorized: true,
          user: {
            uid,
            email: data.email || email,
            displayName: data.displayName || displayName || 'Club Staff',
            role,
            assignedTrainerId: data.assignedTrainerId || (role === 'trainer' ? uid : ''),
            active: isBootstrappedOwner ? true : Boolean(data.active),
          },
        };
      }
      return { authorized: false, user: null };
    }

    if (isBootstrappedOwner) {
      return {
        authorized: true,
        user: {
          uid,
          email,
          displayName: displayName || 'Club Owner',
          role: 'owner',
          assignedTrainerId: '',
          active: true,
        },
      };
    }

    return { authorized: false, user: null };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function recordAuditEvent(
  actor: StaffSessionUser,
  payload: {
    action: string;
    resourceType: string;
    resourceId: string;
    changedFields: string[];
    reason?: string;
  },
): Promise<void> {
  const id = makeDocId('aud');
  const path = `auditEvents/${id}`;
  try {
    await setDoc(doc(db, 'auditEvents', id), {
      actorUid: actor.uid,
      actorEmail: actor.email.slice(0, 160),
      roleSnapshot: actor.role,
      action: payload.action.slice(0, 80),
      resourceType: payload.resourceType.slice(0, 60),
      resourceId: payload.resourceId.slice(0, 128),
      changedFields: payload.changedFields.slice(0, 30),
      reason: (payload.reason || '').slice(0, 300),
      requestId: makeDocId('req'),
      occurredAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Public website live listeners — strictly enforce owner-approval gates
export function subscribePublicSettings(
  onData: (settings: SiteSettingsRecord | null) => void,
): Unsubscribe {
  const path = 'settings/public';
  return onSnapshot(
    doc(db, 'settings', 'public'),
    (snap) => {
      onData(snap.exists() ? (snap.data() as SiteSettingsRecord) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export function subscribePublicPlans(
  onData: (plans: MembershipPlanRecord[]) => void,
): Unsubscribe {
  const path = 'membershipPlans';
  const q = query(
    collection(db, path),
    where('active', '==', true),
    where('publicVisibility', '==', true),
    where('approvalStatus', '==', 'owner-approved'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MembershipPlanRecord, 'id'>),
      }));
      rows.sort((a, b) => a.durationDays - b.durationDays);
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribePublicGallery(
  onData: (items: GalleryPhotoRecord[]) => void,
): Unsubscribe {
  const path = 'gallery';
  const q = query(
    collection(db, path),
    where('visible', '==', true),
    where('approvalStatus', '==', 'owner-approved'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GalleryPhotoRecord, 'id'>),
        }))
        .filter((item) => item.isPlaceholder || item.rightsConfirmed);
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribePublicTrainers(
  onData: (trainers: TrainerRecord[]) => void,
): Unsubscribe {
  const path = 'trainers';
  const q = query(
    collection(db, path),
    where('active', '==', true),
    where('approvalStatus', '==', 'owner-approved'),
    where('consentConfirmed', '==', true),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TrainerRecord, 'id'>),
      }));
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribePublicSiteContent(
  onData: (items: SiteContentRecord[]) => void,
): Unsubscribe {
  const path = 'siteContent';
  const q = query(
    collection(db, path),
    where('status', 'in', ['verified', 'owner-approved']),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SiteContentRecord, 'id'>),
        })),
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

// Public website enquiry submission with explicit consent capture
export async function submitPublicEnquiry(payload: {
  customerName: string;
  phone: string;
  email: string;
  interestedPlan: string;
  message: string;
  consentAccepted: boolean;
  consentVersion?: string;
}): Promise<string> {
  const id = makeDocId('enq');
  const path = `enquiries/${id}`;
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  const retentionReviewDate = addDaysToIsoDate(todayIso, 180);

  try {
    await setDoc(doc(db, 'enquiries', id), {
      customerName: payload.customerName.slice(0, 80),
      phone: payload.phone.slice(0, 20),
      email: payload.email.slice(0, 160),
      interestedPlan: payload.interestedPlan.slice(0, 80),
      message: payload.message.slice(0, 500),
      enquiryDate: todayIso,
      status: 'New',
      assigneeUid: '',
      followUpDate: '',
      retentionReviewDate,
      consentAccepted: Boolean(payload.consentAccepted),
      consentVersion: (payload.consentVersion || ENQUIRY_CONSENT_VERSION).slice(0, 40),
      consentAt: nowIso.slice(0, 40),
      internalNotes: '',
      source: 'Website',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Seed initial safe defaults (Owner only) — never auto-publishes disputed/unverified facts
export async function seedInitialDatabaseIfNeeded(
  ownerUser: StaffSessionUser,
): Promise<void> {
  if (ownerUser.role !== 'owner') return;
  try {
    const staffRef = doc(db, 'staff', ownerUser.uid);
    const staffSnap = await getDoc(staffRef);
    if (!staffSnap.exists()) {
      await setDoc(staffRef, {
        uid: ownerUser.uid,
        email: ownerUser.email,
        displayName: ownerUser.displayName || 'Club Owner',
        role: 'owner',
        active: true,
        assignedTrainerId: ownerUser.assignedTrainerId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const publicSettingsRef = doc(db, 'settings', 'public');
    const publicSettingsSnap = await getDoc(publicSettingsRef);
    if (!publicSettingsSnap.exists()) {
      await setDoc(publicSettingsRef, {
        businessName: BUSINESS_INFO.legalName,
        address: BUSINESS_INFO.address,
        phoneDisplay: '',
        phoneApproved: false,
        whatsappNumber: '',
        whatsappApproved: false,
        openingHours: BUSINESS_INFO.hoursPlaceholder,
        closingHours: BUSINESS_INFO.closingHours,
        hoursApproved: false,
        mapsUrl: '',
        mapsApproved: false,
        plusCodeNote: '3MMG+57 Ahmedabad · Unique Innovation wording pending owner confirmation',
        ratingValue: '4.7',
        reviewCount: '494',
        reviewSnapshotDate: '',
        reviewsApproved: false,
        privacyContact: 'Pending owner privacy contact email',
        retentionPolicySummary: 'Website enquiries reviewed every 180 days; members archived upon request.',
        announcementText: '',
        announcementActive: false,
        updatedAt: serverTimestamp(),
      });
    }

    const opsRef = doc(db, 'settings', 'operations');
    const opsSnap = await getDoc(opsRef);
    if (!opsSnap.exists()) {
      await setDoc(opsRef, {
        enquiryRecipientsNote: 'Desk staff and owner via /admin console',
        exportRequiresOwner: true,
        defaultRetentionDays: 180,
        appCheckEnabledNote: 'Enable Firebase App Check (reCAPTCHA Enterprise) in Firebase Console before launch.',
        updatedAt: serverTimestamp(),
      });
    }

    const plansSnap = await getDocs(collection(db, 'membershipPlans'));
    if (plansSnap.empty) {
      const defaults = [
        { id: 'plan_monthly', days: 30, priceAmount: 0, plan: MEMBERSHIP_PLANS[0] },
        { id: 'plan_quarterly', days: 90, priceAmount: 0, plan: MEMBERSHIP_PLANS[1] },
        { id: 'plan_annual', days: 365, priceAmount: 0, plan: MEMBERSHIP_PLANS[2] },
      ];
      for (const item of defaults) {
        await setDoc(doc(db, 'membershipPlans', item.id), {
          name: item.plan.name,
          duration: item.plan.duration,
          durationDays: item.days,
          priceDisplay: item.plan.pricePlaceholder,
          priceAmount: item.priceAmount,
          featured: Boolean(item.plan.featured),
          active: true,
          publicVisibility: false,
          approvalStatus: 'draft',
          approvedBy: '',
          features: item.plan.features,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const gallerySnap = await getDocs(collection(db, 'gallery'));
    if (gallerySnap.empty) {
      for (const g of GALLERY_ITEMS) {
        await setDoc(
          doc(db, 'gallery', `gal_${g.id.replace(/[^a-zA-Z0-9_-]/g, '')}`),
          {
            title: g.title,
            category: g.category,
            imageUrl: g.image,
            caption: g.caption,
            visible: true,
            isPlaceholder: true,
            rightsConfirmed: false,
            approvalStatus: 'owner-approved',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        );
      }
    }

    const contentSnap = await getDocs(collection(db, 'siteContent'));
    if (contentSnap.empty) {
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const entry of INITIAL_CONTENT_REGISTER) {
        await setDoc(doc(db, 'siteContent', `cnt_${entry.key}`), {
          key: entry.key,
          label: entry.label,
          value: entry.value,
          status: entry.status,
          source: entry.source,
          verifiedAt: entry.verifiedAt,
          approvedBy: entry.approvedBy,
          version: 1,
          editorUid: ownerUser.uid,
          publishedAt:
            entry.status === 'verified' || entry.status === 'owner-approved'
              ? todayIso
              : '',
          notes: entry.notes,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_init');
  }
}

// Admin / Staff live collection subscriptions
export function subscribeAdminCollection<T extends { id: string }>(
  collectionName: string,
  onData: (rows: T[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, collectionName),
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<T, 'id'>),
      })) as T[];
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    },
  );
}

export function subscribeOperationsSettings(
  onData: (ops: OperationsSettingsRecord | null) => void,
): Unsubscribe {
  const path = 'settings/operations';
  return onSnapshot(
    doc(db, 'settings', 'operations'),
    (snap) => {
      onData(snap.exists() ? (snap.data() as OperationsSettingsRecord) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

// Scoped trainer subscriptions (enforced by Firestore rules)
export function subscribeTrainerMembers(
  assignedTrainerId: string,
  onData: (rows: GymMember[]) => void,
): Unsubscribe {
  const path = 'members';
  const q = query(
    collection(db, path),
    where('assignedTrainerId', '==', assignedTrainerId),
    where('archivedAt', '==', ''),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GymMember, 'id'>),
        })),
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeTrainerAttendance(
  assignedTrainerId: string,
  onData: (rows: AttendanceRecord[]) => void,
): Unsubscribe {
  const path = 'attendance';
  const q = query(
    collection(db, path),
    where('assignedTrainerId', '==', assignedTrainerId),
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AttendanceRecord, 'id'>),
        })),
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

// CRUD: Members
export async function saveMember(
  data: Omit<GymMember, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('mem');
  const path = `members/${id}`;
  const cleanPayload = {
    userUid: (data.userUid || '').slice(0, 128),
    fullName: data.fullName.slice(0, 100),
    phone: data.phone.slice(0, 20),
    email: normalizeEmail(data.email || ''),
    joiningDate: data.joiningDate,
    planId: data.planId.slice(0, 128),
    planName: data.planName.slice(0, 100),
    startDate: data.startDate,
    expiryDate: data.expiryDate,
    paymentStatus: data.paymentStatus,
    memberStatus: data.memberStatus,
    assignedTrainerId: (data.assignedTrainerId || '').slice(0, 128),
    consentConfirmed: Boolean(data.consentConfirmed),
    archivedAt: (data.archivedAt || '').slice(0, 40),
    notes: (data.notes || '').slice(0, 500),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'members', id), {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'members', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: existingId ? 'member.updated' : 'member.created',
        resourceType: 'member',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeMember(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `members/${id}`;
  try {
    await deleteDoc(doc(db, 'members', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'member.deleted',
        resourceType: 'member',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Memberships
export async function saveMembershipRecord(
  data: Omit<MembershipRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('msh');
  const path = `memberships/${id}`;
  const cleanPayload = {
    memberId: data.memberId,
    memberName: data.memberName.slice(0, 100),
    planId: data.planId,
    planName: data.planName.slice(0, 100),
    startAt: data.startAt,
    endAt: data.endAt,
    status: data.status,
    actorUid: data.actorUid,
  };
  try {
    if (existingId) {
      await updateDoc(doc(db, 'memberships', id), {
        memberName: cleanPayload.memberName,
        planId: cleanPayload.planId,
        planName: cleanPayload.planName,
        startAt: cleanPayload.startAt,
        endAt: cleanPayload.endAt,
        status: cleanPayload.status,
        actorUid: cleanPayload.actorUid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'memberships', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: existingId ? 'membership.updated' : 'membership.assigned',
        resourceType: 'membership',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeMembershipRecord(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `memberships/${id}`;
  try {
    await deleteDoc(doc(db, 'memberships', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'membership.deleted',
        resourceType: 'membership',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Attendance (Append-only)
export async function createAttendanceEntry(
  data: Omit<AttendanceRecord, 'id' | 'createdAt'>,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = makeDocId('att');
  const path = `attendance/${id}`;
  try {
    await setDoc(doc(db, 'attendance', id), {
      memberId: data.memberId,
      memberName: data.memberName.slice(0, 100),
      assignedTrainerId: (data.assignedTrainerId || '').slice(0, 128),
      occurredDate: data.occurredDate,
      occurredTime: data.occurredTime.slice(0, 16),
      recorderUid: data.recorderUid,
      recorderRole: data.recorderRole,
      method: 'manual',
      sessionId: (data.sessionId || '').slice(0, 128),
      isCorrection: Boolean(data.isCorrection),
      correctionOf: (data.correctionOf || '').slice(0, 128),
      reason: (data.reason || '').slice(0, 300),
      createdAt: serverTimestamp(),
    });
    if (actor) {
      await recordAuditEvent(actor, {
        action: data.isCorrection ? 'attendance.corrected' : 'attendance.checked_in',
        resourceType: 'attendance',
        resourceId: id,
        changedFields: ['memberId', 'occurredDate', 'isCorrection'],
        reason: data.reason,
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// CRUD: Membership Plans
export async function saveMembershipPlan(
  data: Omit<MembershipPlanRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('plan');
  const path = `membershipPlans/${id}`;
  const isOwner = actor?.role === 'owner';
  const cleanPayload = {
    name: data.name.slice(0, 80),
    duration: data.duration.slice(0, 60),
    durationDays: data.durationDays,
    priceDisplay: data.priceDisplay.slice(0, 40),
    priceAmount: data.priceAmount,
    featured: Boolean(data.featured),
    active: Boolean(data.active),
    publicVisibility: isOwner ? Boolean(data.publicVisibility) : false,
    approvalStatus: isOwner ? data.approvalStatus : ('draft' as const),
    approvedBy: isOwner ? (data.approvedBy || '').slice(0, 160) : '',
    features: data.features.slice(0, 12),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'membershipPlans', id), {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'membershipPlans', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: existingId ? 'plan.updated' : 'plan.created',
        resourceType: 'membershipPlan',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeMembershipPlan(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `membershipPlans/${id}`;
  try {
    await deleteDoc(doc(db, 'membershipPlans', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'plan.deleted',
        resourceType: 'membershipPlan',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Enquiries
export async function updateEnquiryRecord(
  id: string,
  updates: Partial<Omit<EnquiryRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `enquiries/${id}`;
  try {
    await updateDoc(doc(db, 'enquiries', id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'enquiry.updated',
        resourceType: 'enquiry',
        resourceId: id,
        changedFields: Object.keys(updates),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeEnquiry(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `enquiries/${id}`;
  try {
    await deleteDoc(doc(db, 'enquiries', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'enquiry.deleted',
        resourceType: 'enquiry',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Trainers
export async function saveTrainer(
  data: Omit<TrainerRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('trn');
  const path = `trainers/${id}`;
  const isOwner = actor?.role === 'owner';
  const cleanPayload = {
    staffUid: (data.staffUid || '').slice(0, 128),
    fullName: data.fullName.slice(0, 80),
    specialization: data.specialization.slice(0, 100),
    experience: data.experience.slice(0, 60),
    bio: (data.bio || '').slice(0, 400),
    photoUrl: (data.photoUrl || '').slice(0, 500),
    active: Boolean(data.active),
    approvalStatus: isOwner ? data.approvalStatus : ('draft' as const),
    consentConfirmed: Boolean(data.consentConfirmed),
    approvedBy: isOwner ? (data.approvedBy || '').slice(0, 160) : '',
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'trainers', id), {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'trainers', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: existingId ? 'trainer.updated' : 'trainer.created',
        resourceType: 'trainer',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeTrainer(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `trainers/${id}`;
  try {
    await deleteDoc(doc(db, 'trainers', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'trainer.deleted',
        resourceType: 'trainer',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Payments
export async function savePayment(
  data: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('pay');
  const path = `payments/${id}`;
  const cleanPayload = {
    memberId: data.memberId,
    membershipId: (data.membershipId || '').slice(0, 128),
    memberName: data.memberName.slice(0, 100),
    planName: data.planName.slice(0, 100),
    currency: 'INR' as const,
    totalAmount: data.totalAmount,
    paidAmount: data.paidAmount,
    pendingAmount: data.pendingAmount,
    status: data.status,
    paymentMethod: data.paymentMethod,
    reference: (data.reference || '').slice(0, 120),
    recorderUid: data.recorderUid,
    reconciled: Boolean(data.reconciled),
    reconciledBy: (data.reconciledBy || '').slice(0, 160),
    refundReason: (data.refundReason || '').slice(0, 300),
    transactionDate: data.transactionDate,
    receiptNumber: data.receiptNumber.slice(0, 40),
    notes: (data.notes || '').slice(0, 300),
  };

  try {
    if (existingId) {
      const { recorderUid: _ignored, memberId: _m, ...updateFields } = cleanPayload;
      await updateDoc(doc(db, 'payments', id), {
        ...updateFields,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'payments', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action:
          cleanPayload.status === 'Refunded'
            ? 'payment.refunded'
            : cleanPayload.reconciled
            ? 'payment.reconciled'
            : 'payment.recorded',
        resourceType: 'payment',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
        reason: cleanPayload.refundReason || cleanPayload.notes,
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removePayment(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `payments/${id}`;
  try {
    await deleteDoc(doc(db, 'payments', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'payment.deleted',
        resourceType: 'payment',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Gallery
export async function saveGalleryPhoto(
  data: Omit<GalleryPhotoRecord, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || makeDocId('gal');
  const path = `gallery/${id}`;
  const isOwner = actor?.role === 'owner';
  const cleanPayload = {
    title: data.title.slice(0, 80),
    category: data.category,
    imageUrl: data.imageUrl.slice(0, 500),
    caption: (data.caption || '').slice(0, 240),
    visible: Boolean(data.visible),
    isPlaceholder: Boolean(data.isPlaceholder),
    rightsConfirmed: Boolean(data.rightsConfirmed),
    approvalStatus: isOwner ? data.approvalStatus : ('draft' as const),
  };
  try {
    if (existingId) {
      await updateDoc(doc(db, 'gallery', id), {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'gallery', id), {
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: existingId ? 'gallery.updated' : 'gallery.created',
        resourceType: 'gallery',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeGalleryPhoto(
  id: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `gallery/${id}`;
  try {
    await deleteDoc(doc(db, 'gallery', id));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'gallery.deleted',
        resourceType: 'gallery',
        resourceId: id,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// CRUD: Site Content Register
export async function saveSiteContentRecord(
  data: Omit<SiteContentRecord, 'id' | 'updatedAt'>,
  existingId?: string,
  actor?: StaffSessionUser,
): Promise<string> {
  const id = existingId || `cnt_${data.key.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const path = `siteContent/${id}`;
  const isOwner = actor?.role === 'owner';
  const cleanPayload = {
    key: data.key.slice(0, 80),
    label: data.label.slice(0, 120),
    value: data.value.slice(0, 500),
    status: isOwner ? data.status : ('draft' as const),
    source: data.source.slice(0, 160),
    verifiedAt: data.verifiedAt.slice(0, 40),
    approvedBy: isOwner ? data.approvedBy.slice(0, 160) : '',
    version: Math.max(1, data.version),
    editorUid: data.editorUid,
    publishedAt: isOwner ? data.publishedAt.slice(0, 40) : '',
    notes: data.notes.slice(0, 500),
  };
  try {
    await setDoc(doc(db, 'siteContent', id), {
      ...cleanPayload,
      updatedAt: serverTimestamp(),
    });
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'siteContent.updated',
        resourceType: 'siteContent',
        resourceId: id,
        changedFields: Object.keys(cleanPayload),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Settings & Staff RBAC (Owner-only)
export async function saveSiteSettings(
  data: Omit<SiteSettingsRecord, 'updatedAt'>,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = 'settings/public';
  try {
    await setDoc(doc(db, 'settings', 'public'), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'settings.public_updated',
        resourceType: 'settings',
        resourceId: 'public',
        changedFields: Object.keys(data),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveOperationsSettings(
  data: Omit<OperationsSettingsRecord, 'updatedAt'>,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = 'settings/operations';
  try {
    await setDoc(doc(db, 'settings', 'operations'), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'settings.operations_updated',
        resourceType: 'settings',
        resourceId: 'operations',
        changedFields: Object.keys(data),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveStaffAccount(
  uid: string,
  data: Omit<StaffAccount, 'id' | 'uid' | 'createdAt' | 'updatedAt'>,
  isUpdate: boolean,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `staff/${uid}`;
  const cleanPayload = {
    email: data.email.slice(0, 160),
    displayName: data.displayName.slice(0, 100),
    role: data.role,
    active: Boolean(data.active),
    assignedTrainerId: (data.assignedTrainerId || '').slice(0, 128),
  };
  try {
    if (isUpdate) {
      await updateDoc(doc(db, 'staff', uid), {
        ...cleanPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'staff', uid), {
        uid,
        ...cleanPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (actor) {
      await recordAuditEvent(actor, {
        action: isUpdate ? 'staff.updated' : 'staff.provisioned',
        resourceType: 'staff',
        resourceId: uid,
        changedFields: Object.keys(cleanPayload),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isUpdate ? OperationType.UPDATE : OperationType.CREATE,
      path,
    );
  }
}

export async function removeStaffAccount(
  uid: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `staff/${uid}`;
  try {
    await deleteDoc(doc(db, 'staff', uid));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'staff.removed',
        resourceType: 'staff',
        resourceId: uid,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Member Self-Service Portal (Gmail-authenticated)
export function subscribeMyMemberRecords(
  uid: string,
  verifiedEmail: string,
  onData: (rows: GymMember[]) => void,
): Unsubscribe {
  const path = 'members';
  const normalizedEmail = normalizeEmail(verifiedEmail);
  let byUidRows: GymMember[] = [];
  let byEmailRows: GymMember[] = [];

  const emitMerged = () => {
    const merged = new Map<string, GymMember>();
    for (const row of byEmailRows) merged.set(row.id, row);
    for (const row of byUidRows) merged.set(row.id, row);
    onData(Array.from(merged.values()));
  };

  const qUid = query(
    collection(db, path),
    where('archivedAt', '==', ''),
    where('userUid', '==', uid),
  );
  const unsubUid = onSnapshot(
    qUid,
    (snap) => {
      byUidRows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GymMember, 'id'>),
      }));
      emitMerged();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );

  let unsubEmail: Unsubscribe = () => {};
  if (normalizedEmail) {
    const qEmail = query(
      collection(db, path),
      where('archivedAt', '==', ''),
      where('email', '==', normalizedEmail),
    );
    unsubEmail = onSnapshot(
      qEmail,
      (snap) => {
        byEmailRows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GymMember, 'id'>),
        }));
        emitMerged();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      },
    );
  }

  return () => {
    unsubUid();
    unsubEmail();
  };
}

export function subscribeMyMembershipRequests(
  uid: string,
  onData: (rows: MembershipRequestRecord[]) => void,
): Unsubscribe {
  const path = 'membershipRequests';
  const q = query(collection(db, path), where('userUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MembershipRequestRecord, 'id'>),
      }));
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function submitMembershipRequest(
  uid: string,
  verifiedEmail: string,
  payload: {
    fullName: string;
    phone: string;
    claimType: 'Existing Member' | 'New or Renewal';
    planName: string;
    monthsRequested: number;
    existingStartDate: string;
    notes: string;
    consentAccepted: boolean;
  },
): Promise<string> {
  const id = makeDocId('req');
  const path = `membershipRequests/${id}`;
  const months = Math.min(36, Math.max(1, Math.round(payload.monthsRequested)));
  try {
    await setDoc(doc(db, 'membershipRequests', id), {
      userUid: uid,
      email: normalizeEmail(verifiedEmail),
      fullName: payload.fullName.trim().slice(0, 100),
      phone: payload.phone.trim().slice(0, 20),
      claimType: payload.claimType,
      planName: payload.planName.trim().slice(0, 100),
      monthsRequested: months,
      existingStartDate: payload.existingStartDate.trim().slice(0, 10),
      notes: payload.notes.trim().slice(0, 500),
      consentAccepted: Boolean(payload.consentAccepted),
      status: 'Pending',
      approvedMonths: 0,
      approvedBy: '',
      reviewerNotes: '',
      linkedMemberId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function approveMembershipRequest(
  req: MembershipRequestRecord,
  approval: {
    approvedMonths: number;
    startDate: string;
    planId: string;
    planName: string;
    paymentStatus: PaymentStatus;
    memberStatus: MemberStatus;
    assignedTrainerId: string;
    existingMemberId?: string;
    existingJoiningDate?: string;
    reviewerNotes: string;
    planExistsInCatalog: boolean;
  },
  actor: StaffSessionUser,
): Promise<string> {
  const safeMonths = Math.min(36, Math.max(1, Math.round(approval.approvedMonths)));
  const expiryDate = addMonthsToIsoDate(approval.startDate, safeMonths);
  const memberId = approval.existingMemberId || makeDocId('mem');
  const memberPath = `members/${memberId}`;

  try {
    const memberPayload = {
      userUid: req.userUid,
      fullName: req.fullName.slice(0, 100),
      phone: req.phone.slice(0, 20),
      email: normalizeEmail(req.email),
      joiningDate: approval.existingJoiningDate || approval.startDate,
      planId: (approval.planId || `custom_${safeMonths}m`).slice(0, 128),
      planName: (approval.planName || `${safeMonths} Month Membership`).slice(0, 100),
      startDate: approval.startDate,
      expiryDate,
      paymentStatus: approval.paymentStatus,
      memberStatus: approval.memberStatus,
      assignedTrainerId: (approval.assignedTrainerId || '').slice(0, 128),
      consentConfirmed: true,
      archivedAt: '',
      notes: approval.reviewerNotes
        ? `Approved for ${safeMonths} month(s): ${approval.reviewerNotes}`.slice(0, 500)
        : `Approved via Gmail member request (${safeMonths} month(s))`,
    };

    if (approval.existingMemberId) {
      await updateDoc(doc(db, 'members', memberId), {
        ...memberPayload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'members', memberId), {
        ...memberPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (approval.planExistsInCatalog && approval.planId) {
      const mshId = makeDocId('msh');
      await setDoc(doc(db, 'memberships', mshId), {
        memberId,
        memberName: memberPayload.fullName,
        planId: approval.planId,
        planName: memberPayload.planName,
        startAt: approval.startDate,
        endAt: expiryDate,
        status: approval.memberStatus === 'Active' ? 'Active' : 'Paused',
        actorUid: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(doc(db, 'membershipRequests', req.id), {
      status: 'Approved',
      approvedMonths: safeMonths,
      approvedBy: actor.email.slice(0, 160),
      reviewerNotes: approval.reviewerNotes.trim().slice(0, 300),
      linkedMemberId: memberId,
      planName: memberPayload.planName,
      updatedAt: serverTimestamp(),
    });

    await recordAuditEvent(actor, {
      action: 'membershipRequest.approved',
      resourceType: 'membershipRequest',
      resourceId: req.id,
      changedFields: ['status', 'approvedMonths', 'linkedMemberId'],
      reason: `Approved ${safeMonths} month(s) until ${expiryDate}`,
    });

    return memberId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }
}

export async function rejectMembershipRequest(
  requestId: string,
  reviewerNotes: string,
  actor: StaffSessionUser,
): Promise<void> {
  const path = `membershipRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'membershipRequests', requestId), {
      status: 'Rejected',
      approvedMonths: 0,
      approvedBy: actor.email.slice(0, 160),
      reviewerNotes: reviewerNotes.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    await recordAuditEvent(actor, {
      action: 'membershipRequest.rejected',
      resourceType: 'membershipRequest',
      resourceId: requestId,
      changedFields: ['status', 'reviewerNotes'],
      reason: reviewerNotes,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeMembershipRequest(
  requestId: string,
  actor?: StaffSessionUser,
): Promise<void> {
  const path = `membershipRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'membershipRequests', requestId));
    if (actor) {
      await recordAuditEvent(actor, {
        action: 'membershipRequest.deleted',
        resourceType: 'membershipRequest',
        resourceId: requestId,
        changedFields: ['deleted'],
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const recordedLoginSessions = new Set<string>();
const LOGIN_SESSION_PREFIX = 'assure_login_recorded:';

export async function recordLoginEvent(payload: {
  uid: string;
  email: string;
  displayName?: string;
  role: LoginEventRole;
  portal: LoginPortal;
  method: LoginMethod;
}): Promise<string> {
  const id = makeDocId('lgn');
  const path = `loginEvents/${id}`;
  try {
    await setDoc(doc(db, 'loginEvents', id), {
      uid: payload.uid.slice(0, 128),
      email: normalizeEmail(payload.email),
      displayName: (payload.displayName || '').trim().slice(0, 100),
      role: payload.role,
      portal: payload.portal,
      method: payload.method,
      occurredAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordLoginEventOncePerSession(payload: {
  uid: string;
  email: string;
  displayName?: string;
  role: LoginEventRole;
  portal: LoginPortal;
  method: LoginMethod;
}): Promise<void> {
  if (!payload.uid || !payload.email) return;
  const key = `${payload.portal}:${payload.uid}:${payload.role}`;
  if (recordedLoginSessions.has(key)) return;
  try {
    if (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(`${LOGIN_SESSION_PREFIX}${key}`) === '1'
    ) {
      recordedLoginSessions.add(key);
      return;
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }

  recordedLoginSessions.add(key);
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(`${LOGIN_SESSION_PREFIX}${key}`, '1');
    }
  } catch {
    // Ignore storage restriction errors
  }

  try {
    await recordLoginEvent(payload);
  } catch (err) {
    recordedLoginSessions.delete(key);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(`${LOGIN_SESSION_PREFIX}${key}`);
      }
    } catch {
      // Ignore
    }
    console.warn('Unable to log portal sign-in event:', err);
  }
}

export function clearLoginSessionMarkers(): void {
  recordedLoginSessions.clear();
  try {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const k = window.sessionStorage.key(i);
        if (k && k.startsWith(LOGIN_SESSION_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.sessionStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export function subscribeLoginEvents(
  onData: (rows: LoginEventRecord[]) => void,
  maxRows = 50,
): Unsubscribe {
  const path = 'loginEvents';
  const q = query(
    collection(db, path),
    orderBy('occurredAt', 'desc'),
    limit(Math.min(100, Math.max(1, maxRows))),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoginEventRecord, 'id'>),
      }));
      onData(rows);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export type { AuditEventRecord };

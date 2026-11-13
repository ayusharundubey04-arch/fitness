import type { ContentApprovalStatus } from '../data/contentRegister';

export type StaffRole = 'owner' | 'staff' | 'trainer';

export interface StaffAccount {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  assignedTrainerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial' | 'Refunded';
export type MemberStatus = 'Active' | 'Expired' | 'Paused';

export interface GymMember {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  joiningDate: string;
  planId: string;
  planName: string;
  startDate: string;
  expiryDate: string;
  paymentStatus: PaymentStatus;
  memberStatus: MemberStatus;
  assignedTrainerId: string;
  consentConfirmed: boolean;
  archivedAt: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MembershipRecord {
  id: string;
  memberId: string;
  memberName: string;
  planId: string;
  planName: string;
  startAt: string;
  endAt: string;
  status: 'Active' | 'Expired' | 'Paused' | 'Cancelled';
  actorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MembershipPlanRecord {
  id: string;
  name: string;
  duration: string;
  durationDays: number;
  priceDisplay: string;
  priceAmount: number;
  featured: boolean;
  active: boolean;
  publicVisibility: boolean;
  approvalStatus: 'draft' | 'owner-approved';
  approvedBy: string;
  features: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  assignedTrainerId: string;
  occurredDate: string;
  occurredTime: string;
  recorderUid: string;
  recorderRole: StaffRole;
  method: 'manual';
  sessionId: string;
  isCorrection: boolean;
  correctionOf: string;
  reason: string;
  createdAt?: unknown;
}

export type EnquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Converted'
  | 'Not interested';

export interface EnquiryRecord {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  interestedPlan: string;
  message: string;
  enquiryDate: string;
  status: EnquiryStatus;
  assigneeUid: string;
  followUpDate: string;
  retentionReviewDate: string;
  consentAccepted: boolean;
  consentVersion: string;
  consentAt: string;
  internalNotes: string;
  source: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrainerRecord {
  id: string;
  staffUid: string;
  fullName: string;
  specialization: string;
  experience: string;
  bio: string;
  photoUrl: string;
  active: boolean;
  approvalStatus: 'draft' | 'owner-approved';
  consentConfirmed: boolean;
  approvedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';

export interface PaymentRecord {
  id: string;
  memberId: string;
  membershipId: string;
  memberName: string;
  planName: string;
  currency: 'INR';
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  reference: string;
  recorderUid: string;
  reconciled: boolean;
  reconciledBy: string;
  refundReason: string;
  transactionDate: string;
  receiptNumber: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GalleryPhotoRecord {
  id: string;
  title: string;
  category: 'Strength' | 'Conditioning' | 'Studio';
  imageUrl: string;
  caption: string;
  visible: boolean;
  isPlaceholder: boolean;
  rightsConfirmed: boolean;
  approvalStatus: 'draft' | 'owner-approved';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SiteContentRecord {
  id: string;
  key: string;
  label: string;
  value: string;
  status: ContentApprovalStatus;
  source: string;
  verifiedAt: string;
  approvedBy: string;
  version: number;
  editorUid: string;
  publishedAt: string;
  notes: string;
  updatedAt?: unknown;
}

export interface AuditEventRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  roleSnapshot: StaffRole;
  action: string;
  resourceType: string;
  resourceId: string;
  changedFields: string[];
  reason: string;
  requestId: string;
  occurredAt?: unknown;
}

export interface SiteSettingsRecord {
  businessName: string;
  address: string;
  phoneDisplay: string;
  phoneApproved: boolean;
  whatsappNumber: string;
  whatsappApproved: boolean;
  openingHours: string;
  closingHours: string;
  hoursApproved: boolean;
  mapsUrl: string;
  mapsApproved: boolean;
  plusCodeNote: string;
  ratingValue: string;
  reviewCount: string;
  reviewSnapshotDate: string;
  reviewsApproved: boolean;
  privacyContact: string;
  retentionPolicySummary: string;
  announcementText: string;
  announcementActive: boolean;
  updatedAt?: unknown;
}

export interface OperationsSettingsRecord {
  enquiryRecipientsNote: string;
  exportRequiresOwner: boolean;
  defaultRetentionDays: number;
  appCheckEnabledNote: string;
  updatedAt?: unknown;
}

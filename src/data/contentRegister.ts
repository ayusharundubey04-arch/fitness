export type ContentApprovalStatus =
  | 'verified'
  | 'owner-approved'
  | 'draft'
  | 'unknown'
  | 'disputed';

export interface ContentRegisterEntry {
  key: string;
  label: string;
  value: string;
  status: ContentApprovalStatus;
  source: string;
  verifiedAt: string;
  approvedBy: string;
  notes: string;
}

export function isPubliclyApprovedStatus(status: ContentApprovalStatus): boolean {
  return status === 'verified' || status === 'owner-approved';
}

export const INITIAL_CONTENT_REGISTER: ContentRegisterEntry[] = [
  {
    key: 'businessName',
    label: 'Legal Business Name',
    value: 'ASSURE FITNESS CLUB LLP',
    status: 'verified',
    source: 'Owner / Conversation Brief',
    verifiedAt: '2026-11-13',
    approvedBy: 'Brief Verified',
    notes: 'Official LLP name.',
  },
  {
    key: 'address',
    label: 'Primary Club Address',
    value:
      'J-601, White Business Hub, Near Hanspura Gam, Degam Road, Naroda, Ahmedabad, Gujarat 382330, India',
    status: 'verified',
    source: 'Owner / Conversation Brief',
    verifiedAt: '2026-11-13',
    approvedBy: 'Brief Verified',
    notes: 'Confirmed street address.',
  },
  {
    key: 'domain',
    label: 'Primary Domain',
    value: 'assurefitness.shop',
    status: 'verified',
    source: 'Owner / Conversation Brief',
    verifiedAt: '2026-11-13',
    approvedBy: 'Brief Verified',
    notes: 'Confirm DNS/HTTPS/redirects prior to production cutover.',
  },
  {
    key: 'phone',
    label: 'Public Phone Number',
    value: '',
    status: 'disputed',
    source: 'Brief (+91 98989 89533) vs Prior Site (+91 98640 24533)',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Disputed between two numbers. Unpublished until owner confirms exact number.',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Business Destination',
    value: '',
    status: 'unknown',
    source: 'Pending owner destination verification',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Keep WhatsApp links unpublished until destination number is owner-verified.',
  },
  {
    key: 'hours',
    label: 'Complete Opening & Closing Schedule',
    value: 'Closes at 11 PM (complete daily hours pending owner confirmation)',
    status: 'draft',
    source: 'Google Maps listing snapshot',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Opening time and Sunday/holiday schedule unknown.',
  },
  {
    key: 'mapsPin',
    label: 'Google Maps Pin, Plus Code 3MMG+57 & Unique Innovation Wording',
    value: '',
    status: 'unknown',
    source: 'User-supplied listing snippet',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Maps embed and directions link unpublished until owner verifies exact pin/entrance.',
  },
  {
    key: 'googleReviews',
    label: 'Google Rating Snapshot (4.7/5, 494 reviews)',
    value: '4.7/5 across 494 reviews (snapshot pending date & owner approval)',
    status: 'draft',
    source: 'User-provided Maps snapshot',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Dated/unverified snapshot; only publish after owner approval with snapshot date.',
  },
  {
    key: 'plansAndPricing',
    label: 'Membership Plans, Fees, Classes & Schedules',
    value: 'Draft placeholders only',
    status: 'unknown',
    source: 'Pending owner rate card',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Never invent prices or schedules.',
  },
  {
    key: 'privacyAndLegal',
    label: 'Privacy Contact, Retention Policy & Legal Text',
    value: 'Draft collection notice active on enquiry form',
    status: 'draft',
    source: 'System draft notice (requires local legal review)',
    verifiedAt: '',
    approvedBy: '',
    notes: 'Owner to confirm official privacy email/contact and local Indian privacy counsel.',
  },
];

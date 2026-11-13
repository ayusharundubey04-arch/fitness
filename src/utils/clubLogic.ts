import type { GalleryItem } from '../data/clubData';

export const ENQUIRY_CONSENT_VERSION = 'v1.0-draft';

export interface EnquiryFormInput {
  name: string;
  phone: string;
  email?: string;
  membership: string;
  message: string;
  consentAccepted?: boolean;
}

export interface EnquiryValidationErrors {
  name?: string;
  phone?: string;
  email?: string;
  membership?: string;
  message?: string;
  consentAccepted?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: EnquiryValidationErrors;
  normalizedPhone: string;
}

export function normalizeIndianPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return digits ? `+${digits}` : '';
}

export function validateEnquiryForm(input: EnquiryFormInput): ValidationResult {
  const errors: EnquiryValidationErrors = {};
  const trimmedName = input.name.trim();
  const rawPhone = input.phone.trim();
  const digitsOnly = rawPhone.replace(/\D/g, '');
  const trimmedEmail = (input.email ?? '').trim();
  const trimmedMembership = input.membership.trim();
  const trimmedMessage = input.message.trim();

  if (trimmedName.length < 2) {
    errors.name = 'Please enter your full name (at least 2 characters).';
  } else if (trimmedName.length > 80) {
    errors.name = 'Name must be 80 characters or fewer.';
  }

  if (!rawPhone) {
    errors.phone = 'Please enter your contact phone number.';
  } else if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    errors.phone = 'Please enter a valid 10-digit mobile number.';
  }

  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address or leave it blank.';
  }

  if (!trimmedMembership) {
    errors.membership = 'Please select the membership or program you are interested in.';
  }

  if (trimmedMessage.length > 500) {
    errors.message = 'Message must be 500 characters or fewer.';
  }

  if (input.consentAccepted !== true) {
    errors.consentAccepted =
      'Please confirm your consent so our Naroda reception team may contact you regarding this enquiry.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalizedPhone: normalizeIndianPhone(rawPhone),
  };
}

export interface WhatsAppEnquiryOptions {
  planName?: string;
  programName?: string;
  senderName?: string;
  senderPhone?: string;
  customMessage?: string;
  whatsappNumber?: string;
}

export function buildWhatsAppEnquiryUrl(options: WhatsAppEnquiryOptions = {}): string {
  const cleanNumber = options.whatsappNumber
    ? options.whatsappNumber.replace(/\D/g, '')
    : '';
  if (cleanNumber.length < 8) {
    return '';
  }

  const lines: string[] = [
    'Hello Assure Fitness Club LLP (Naroda, Ahmedabad),',
    '',
  ];

  if (options.planName) {
    lines.push(`I would like to enquire about the ${options.planName} membership plan.`);
  } else if (options.programName) {
    lines.push(`I would like to know more about ${options.programName} availability and timings.`);
  } else {
    lines.push('I am interested in joining Assure Fitness Club and would like membership details.');
  }

  if (options.senderName?.trim()) {
    lines.push(`Name: ${options.senderName.trim()}`);
  }
  if (options.senderPhone?.trim()) {
    lines.push(`Phone: ${options.senderPhone.trim()}`);
  }
  if (options.customMessage?.trim()) {
    lines.push(`Message: ${options.customMessage.trim()}`);
  }

  lines.push('', 'Please share current fee details and opening hours.');

  const encoded = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${cleanNumber}?text=${encoded}`;
}

export type GalleryFilter = 'All' | 'Strength' | 'Conditioning' | 'Studio';

export function filterGalleryItems(
  items: GalleryItem[],
  category: GalleryFilter,
): GalleryItem[] {
  if (category === 'All') {
    return items;
  }
  return items.filter((item) => item.category === category);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppEnquiryUrl,
  filterGalleryItems,
  normalizeIndianPhone,
  validateEnquiryForm,
} from './clubLogic';
import { GALLERY_ITEMS } from '../data/clubData';

test('normalizeIndianPhone handles 10-digit, 0-prefixed, and +91 formats', () => {
  assert.equal(normalizeIndianPhone('9898989533'), '+919898989533');
  assert.equal(normalizeIndianPhone('098989 89533'), '+919898989533');
  assert.equal(normalizeIndianPhone('+91 98989-89533'), '+919898989533');
});

test('validateEnquiryForm rejects empty inputs, short phones, and missing privacy consent', () => {
  const emptyResult = validateEnquiryForm({
    name: '',
    phone: '',
    membership: '',
    message: '',
    consentAccepted: false,
  });
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.errors.name);
  assert.ok(emptyResult.errors.phone);
  assert.ok(emptyResult.errors.membership);
  assert.ok(emptyResult.errors.consentAccepted);

  const missingConsentResult = validateEnquiryForm({
    name: 'Aarav Patel',
    phone: '9898989533',
    membership: 'General Club Enquiry',
    message: 'Looking for evening slot',
    consentAccepted: false,
  });
  assert.equal(missingConsentResult.valid, false);
  assert.ok(missingConsentResult.errors.consentAccepted);
  assert.equal(missingConsentResult.errors.name, undefined);
  assert.equal(missingConsentResult.errors.phone, undefined);
});

test('validateEnquiryForm accepts valid Indian phone, optional email, membership details, and explicit consent', () => {
  const validResult = validateEnquiryForm({
    name: 'Riya Shah',
    phone: '+91 98989 89533',
    email: 'riya@example.com',
    membership: 'Monthly Access',
    message: 'Please share opening time.',
    consentAccepted: true,
  });
  assert.equal(validResult.valid, true);
  assert.deepEqual(validResult.errors, {});
  assert.equal(validResult.normalizedPhone, '+919898989533');

  const badEmailResult = validateEnquiryForm({
    name: 'Riya Shah',
    phone: '9898989533',
    email: 'not-an-email',
    membership: 'Monthly Access',
    message: '',
    consentAccepted: true,
  });
  assert.equal(badEmailResult.valid, false);
  assert.ok(badEmailResult.errors.email);
});

test('buildWhatsAppEnquiryUrl returns empty string unless an approved WhatsApp number is provided', () => {
  assert.equal(buildWhatsAppEnquiryUrl({ whatsappNumber: '' }), '');

  const planUrl = buildWhatsAppEnquiryUrl({
    planName: 'Annual Club Pass',
    senderName: 'Karan Desai',
    senderPhone: '+919898989533',
    whatsappNumber: '919999999999',
  });
  assert.ok(planUrl.startsWith('https://wa.me/919999999999?text='));
  const decodedPlan = decodeURIComponent(planUrl.split('?text=')[1]);
  assert.match(decodedPlan, /Annual Club Pass/);
  assert.match(decodedPlan, /Karan Desai/);
});

test('filterGalleryItems returns expected subsets per category', () => {
  const all = filterGalleryItems(GALLERY_ITEMS, 'All');
  assert.equal(all.length, GALLERY_ITEMS.length);

  const strength = filterGalleryItems(GALLERY_ITEMS, 'Strength');
  assert.ok(strength.length > 0);
  assert.ok(strength.every((item) => item.category === 'Strength'));

  const studio = filterGalleryItems(GALLERY_ITEMS, 'Studio');
  assert.ok(studio.length > 0);
  assert.ok(studio.every((item) => item.category === 'Studio'));
});

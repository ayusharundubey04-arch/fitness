import { ExternalLink, Lock, MessageCircle, Phone, X } from 'lucide-react';
import { BUSINESS_INFO, NAV_LINKS } from '../data/clubData';
import type { SiteSettingsRecord } from '../types/gym';
import { buildWhatsAppEnquiryUrl } from '../utils/clubLogic';

interface FooterProps {
  settings?: SiteSettingsRecord | null;
  onOpenAdmin: () => void;
  legalModalTab: 'privacy' | 'terms' | null;
  onOpenLegalModal: (tab: 'privacy' | 'terms' | null) => void;
}

export default function Footer({
  settings,
  onOpenAdmin,
  legalModalTab,
  onOpenLegalModal,
}: FooterProps) {
  const legalName = settings?.businessName || BUSINESS_INFO.legalName;
  const address = settings?.address || BUSINESS_INFO.address;
  const phoneApproved =
    Boolean(settings?.phoneApproved) && Boolean(settings?.phoneDisplay);
  const phoneDisplay = phoneApproved && settings ? settings.phoneDisplay : '';
  const phoneHref = phoneDisplay
    ? `tel:${phoneDisplay.replace(/[^+\d]/g, '')}`
    : '';
  const hoursApproved =
    Boolean(settings?.hoursApproved) && Boolean(settings?.closingHours);
  const whatsappApproved =
    Boolean(settings?.whatsappApproved) && Boolean(settings?.whatsappNumber);
  const mapsApproved =
    Boolean(settings?.mapsApproved) && Boolean(settings?.mapsUrl);

  return (
    <>
      <footer className="border-t border-white/10 bg-[#080808] py-14 sm:py-16">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
            <div className="lg:col-span-4">
              <a
                href="#home"
                className="font-display text-2xl font-bold tracking-wider text-white"
              >
                {BUSINESS_INFO.brandName}
              </a>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#A1A1AA]">
                {legalName} — Fitness and strength training club located at White Business Hub,
                Degam Road, Naroda, Ahmedabad.
              </p>
              <p className="mt-3 text-xs text-[#A1A1AA]">
                Website: <span className="text-white">{BUSINESS_INFO.website}</span>
              </p>
            </div>

            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold tracking-wider text-white">Navigation</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#A1A1AA]">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="hover:text-[#FF5A1F] transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h3 className="text-xs font-semibold tracking-wider text-white">
                Address &amp; Verification
              </h3>
              <div className="mt-4 space-y-3 text-sm text-[#A1A1AA]">
                <p className="leading-relaxed">{address}</p>
                {phoneApproved && phoneDisplay ? (
                  <p>
                    <a
                      href={phoneHref}
                      className="inline-flex items-center gap-2 text-white hover:text-[#FF5A1F] transition-colors tabular-nums"
                    >
                      <Phone className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                      <span>{phoneDisplay}</span>
                    </a>
                  </p>
                ) : (
                  <p className="text-xs">Phone: Pending owner verification</p>
                )}
                <p className="text-xs text-[#A1A1AA]">
                  {hoursApproved && settings
                    ? `${settings.closingHours} · ${settings.openingHours}`
                    : 'Hours: Pending owner confirmation'}
                </p>
              </div>
            </div>

            <div className="lg:col-span-3">
              <h3 className="text-xs font-semibold tracking-wider text-white">
                Policies &amp; Operations
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm text-[#A1A1AA]">
                {whatsappApproved && settings?.whatsappNumber && (
                  <li>
                    <a
                      href={buildWhatsAppEnquiryUrl({
                        whatsappNumber: settings.whatsappNumber,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-white hover:text-[#FF5A1F] transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                      <span>WhatsApp Enquiry</span>
                    </a>
                  </li>
                )}
                {mapsApproved && settings?.mapsUrl && (
                  <li>
                    <a
                      href={settings.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-white hover:text-[#FF5A1F] transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-[#FF5A1F]" aria-hidden="true" />
                      <span>Google Maps Directions</span>
                    </a>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenLegalModal('privacy')}
                    className="text-xs text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                  >
                    Privacy &amp; Collection Notice (Draft)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenLegalModal('terms')}
                    className="text-xs text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
                  >
                    Terms &amp; Pre-Launch Notice (Draft)
                  </button>
                </li>
                <li className="pt-2 border-t border-white/10">
                  <a
                    href="/admin"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenAdmin();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1AA] hover:text-[#FF5A1F] transition-colors"
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>Operations &amp; Staff Portal</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#A1A1AA]">
            <p>&copy; 2026 {legalName}. All rights reserved.</p>
            <p>J-601, White Business Hub, Naroda, Ahmedabad 382330</p>
          </div>
        </div>
      </footer>

      {legalModalTab && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            legalModalTab === 'privacy'
              ? 'Privacy and Data Collection Notice'
              : 'Terms and Pre-Launch Safeguards'
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-2xl rounded-lg border border-white/15 bg-[#111111] p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#FF5A1F] uppercase">
                  Draft Notice · Requires Owner &amp; Legal Review
                </p>
                <h2 className="mt-1 font-display text-3xl font-bold text-white">
                  {legalModalTab === 'privacy'
                    ? 'Privacy & Collection Notice'
                    : 'Website Terms & Safeguards'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenLegalModal(null)}
                aria-label="Close legal notice"
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#080808] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {legalModalTab === 'privacy' ? (
              <div className="space-y-4 text-sm leading-relaxed text-[#A1A1AA]">
                <p>
                  <strong className="text-white">Data Fiduciary (Draft):</strong> {legalName},{' '}
                  {address}.
                </p>
                <p>
                  <strong className="text-white">Purpose of Collection:</strong> Information
                  submitted via our membership enquiry form (name, phone number, optional email,
                  program interest, and consent timestamp) is used solely by authorized reception
                  staff and the club owner to respond to your enquiry.
                </p>
                <p>
                  <strong className="text-white">Retention &amp; Security:</strong> Enquiries carry
                  a scheduled 180-day retention review target. We do not collect payment card
                  numbers, government identity numbers, biometric identifiers, or medical history on
                  this website.
                </p>
                <p>
                  <strong className="text-white">Privacy Contact &amp; Rights:</strong>{' '}
                  {settings?.privacyContact ||
                    'Official privacy officer contact is pending owner confirmation.'}{' '}
                  You may request access, correction, or deletion of your enquiry details at the
                  Naroda reception desk or via the confirmed privacy contact once published.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-sm leading-relaxed text-[#A1A1AA]">
                <p>
                  <strong className="text-white">Draft Content Disclosure:</strong> Sections marked
                  Draft, Editable, or Visual Placeholder do not constitute binding tariffs, class
                  timetables, or fitness outcome guarantees until approved by the club owner.
                </p>
                <p>
                  <strong className="text-white">No Online Payment Processing:</strong> This website
                  does not process online card or UPI payments. Any membership fee payments are
                  recorded manually at the Naroda desk.
                </p>
                <p>
                  <strong className="text-white">Not Legal Advice:</strong> This policy text is an
                  operational template pending review by the club owner and qualified local counsel
                  in India.
                </p>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-4">
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('privacy')}
                  className={`cursor-pointer ${
                    legalModalTab === 'privacy' ? 'text-[#FF5A1F] font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  Privacy Notice
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLegalModal('terms')}
                  className={`cursor-pointer ${
                    legalModalTab === 'terms' ? 'text-[#FF5A1F] font-semibold' : 'text-[#A1A1AA]'
                  }`}
                >
                  Terms Notice
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenLegalModal(null)}
                className="min-h-[40px] rounded-md bg-[#FF5A1F] px-5 text-xs font-semibold text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

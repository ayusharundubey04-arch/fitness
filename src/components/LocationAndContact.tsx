import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { BUSINESS_INFO, MEMBERSHIP_PLANS, TRAINING_PROGRAMS } from '../data/clubData';
import type { MembershipPlanRecord, SiteSettingsRecord } from '../types/gym';
import { submitPublicEnquiry } from '../lib/firestoreService';
import {
  buildWhatsAppEnquiryUrl,
  ENQUIRY_CONSENT_VERSION,
  validateEnquiryForm,
  type EnquiryValidationErrors,
} from '../utils/clubLogic';

interface LocationAndContactProps {
  selectedPlan: string;
  settings?: SiteSettingsRecord | null;
  livePlans?: MembershipPlanRecord[];
  onOpenPrivacyModal: () => void;
}

export default function LocationAndContact({
  selectedPlan,
  settings,
  livePlans,
  onOpenPrivacyModal,
}: LocationAndContactProps) {
  const planNames =
    livePlans && livePlans.length > 0
      ? livePlans.map((p) => p.name)
      : MEMBERSHIP_PLANS.map((p) => p.name);

  const membershipOptions = [
    ...planNames,
    ...TRAINING_PROGRAMS.map((t) => `${t.name} Enquiry`),
    'General Club Visit / Tour',
  ];

  const displayAddress = settings?.address || BUSINESS_INFO.address;
  const phoneApproved =
    Boolean(settings?.phoneApproved) && Boolean(settings?.phoneDisplay);
  const displayPhone = phoneApproved && settings ? settings.phoneDisplay : '';
  const phoneHref = displayPhone
    ? `tel:${displayPhone.replace(/[^+\d]/g, '')}`
    : '';
  const whatsappApproved =
    Boolean(settings?.whatsappApproved) && Boolean(settings?.whatsappNumber);
  const whatsappNumber =
    whatsappApproved && settings ? settings.whatsappNumber : '';
  const hoursApproved =
    Boolean(settings?.hoursApproved) && Boolean(settings?.closingHours);
  const mapsApproved =
    Boolean(settings?.mapsApproved) && Boolean(settings?.mapsUrl);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [membership, setMembership] = useState(
    selectedPlan || planNames[1] || planNames[0] || 'Monthly Access',
  );
  const [message, setMessage] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [errors, setErrors] = useState<EnquiryValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const [whatsappFollowUpUrl, setWhatsappFollowUpUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPlan) {
      setMembership(selectedPlan);
      setStatus('idle');
    }
  }, [selectedPlan]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    const validation = validateEnquiryForm({
      name,
      phone,
      email,
      membership,
      message,
      consentAccepted,
    });

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setStatus('submitting');

    try {
      const resp = await fetch('/api/validate-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          membership,
          message,
          consentAccepted,
          consentVersion: ENQUIRY_CONSENT_VERSION,
        }),
      });

      const serverResult = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        errors?: EnquiryValidationErrors;
        sanitized?: {
          customerName: string;
          phone: string;
          email: string;
          interestedPlan: string;
          message: string;
          consentAccepted: boolean;
          consentVersion: string;
        };
      };

      if (resp.status === 429) {
        setSubmitError(
          serverResult.error ||
            'Too many enquiry attempts. Please wait a few minutes and try again.',
        );
        setStatus('idle');
        return;
      }

      if (!resp.ok || !serverResult.ok || !serverResult.sanitized) {
        if (serverResult.errors) {
          setErrors(serverResult.errors);
        } else {
          setSubmitError(
            serverResult.error || 'Please check your enquiry details and try again.',
          );
        }
        setStatus('idle');
        return;
      }

      await submitPublicEnquiry(serverResult.sanitized);

      if (whatsappApproved && whatsappNumber) {
        setWhatsappFollowUpUrl(
          buildWhatsAppEnquiryUrl({
            planName: serverResult.sanitized.interestedPlan,
            senderName: serverResult.sanitized.customerName,
            senderPhone: serverResult.sanitized.phone,
            customMessage: serverResult.sanitized.message,
            whatsappNumber,
          }),
        );
      } else {
        setWhatsappFollowUpUrl(null);
      }

      setStatus('submitted');
    } catch {
      setSubmitError(
        'Unable to submit enquiry right now. Please try again in a moment.',
      );
      setStatus('idle');
    }
  };

  const handleReset = () => {
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setConsentAccepted(false);
    setErrors({});
    setSubmitError(null);
    setWhatsappFollowUpUrl(null);
    setStatus('idle');
  };

  return (
    <>
      {/* J. Location Section */}
      <section
        id="location"
        className="border-t border-white/10 bg-[#111111] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                  07. Visit the Club
                </p>
                <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
                  White Business Hub, Naroda.
                </h2>

                <dl className="mt-8 space-y-6 border-t border-white/10 pt-6">
                  <div className="flex items-start gap-3.5">
                    <MapPin
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A1F]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#A1A1AA]">
                        Verified Club Address
                      </dt>
                      <dd className="mt-1 text-sm sm:text-base leading-relaxed text-white">
                        {displayAddress}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <Phone
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A1F]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#A1A1AA]">
                        Phone &amp; WhatsApp Desk
                      </dt>
                      {phoneApproved && displayPhone ? (
                        <dd className="mt-1">
                          <a
                            href={phoneHref}
                            className="text-base font-semibold text-white hover:text-[#FF5A1F] transition-colors tabular-nums"
                          >
                            {displayPhone}
                          </a>
                        </dd>
                      ) : (
                        <dd className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">
                          Public phone number is pending owner verification before direct click-to-call
                          publishing. Please use the enquiry form below.
                        </dd>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <Clock
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#FF5A1F]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-[#A1A1AA]">
                        Business Hours
                      </dt>
                      {hoursApproved && settings ? (
                        <>
                          <dd className="mt-1 text-base font-medium text-white">
                            {settings.closingHours}
                          </dd>
                          <dd className="mt-1 text-xs text-[#A1A1AA]">
                            {settings.openingHours}
                          </dd>
                        </>
                      ) : (
                        <dd className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">
                          Complete daily opening and closing hours are pending final owner confirmation.
                        </dd>
                      )}
                    </div>
                  </div>
                </dl>
              </div>

              {mapsApproved && settings?.mapsUrl && (
                <div className="mt-8 pt-6 border-t border-white/10">
                  <a
                    href={settings.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors whitespace-nowrap"
                  >
                    <span>Get Directions on Google Maps</span>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>

            <div className="lg:col-span-7">
              {mapsApproved && settings?.mapsUrl ? (
                <div className="h-[340px] sm:h-[420px] lg:h-full min-h-[380px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#080808]">
                  <iframe
                    title="Assure Fitness Club LLP Naroda Ahmedabad Map"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(displayAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="h-[340px] sm:h-[420px] lg:h-full min-h-[380px] w-full rounded-lg border border-white/10 bg-[#080808] p-8 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#FF5A1F] uppercase">
                      Map Pin Verification Gate
                    </p>
                    <h3 className="mt-3 font-display text-3xl font-bold text-white">
                      Interactive Map Pending Owner Pin Approval
                    </h3>
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#A1A1AA]">
                      Exact Google Maps pin coordinates, Plus Code wording, and building entrance
                      markers remain unpublished until verified by the club owner in the Operations
                      Console.
                    </p>
                  </div>
                  <div className="border-t border-white/10 pt-5 text-xs text-[#A1A1AA]">
                    <p className="font-semibold text-white">Verified Street Address:</p>
                    <p className="mt-1">{displayAddress}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* K. Contact & Membership Enquiry Form */}
      <section
        id="contact"
        className="border-t border-white/10 bg-[#080808] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                08. Membership Enquiry
              </p>
              <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
                Start Your Enquiry Today.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#A1A1AA]">
                Submit your enquiry directly to our Naroda reception desk. Our staff will contact
                you with verified fee details and current operating hours.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row lg:flex-col gap-4">
                {phoneApproved && displayPhone && (
                  <a
                    href={phoneHref}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-md border border-white/20 bg-[#111111] px-6 py-3.5 text-sm font-semibold text-white hover:border-[#FF5A1F] transition-colors whitespace-nowrap"
                  >
                    <Phone className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                    <span className="tabular-nums">Call {displayPhone}</span>
                  </a>
                )}

                {whatsappApproved && whatsappNumber && (
                  <a
                    href={buildWhatsAppEnquiryUrl({ whatsappNumber })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-md bg-[#FF5A1F] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Message on WhatsApp</span>
                  </a>
                )}

                {!phoneApproved && !whatsappApproved && (
                  <div className="rounded-lg border border-white/10 bg-[#111111] p-4 text-xs leading-relaxed text-[#A1A1AA]">
                    <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                      <span>Direct Contact Verification Active</span>
                    </p>
                    Click-to-call and WhatsApp links are temporarily withheld until the owner
                    confirms the official reception number. Use this encrypted form for desk follow-up.
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-lg border border-white/10 bg-[#111111] p-6 sm:p-8">
                {status === 'submitted' ? (
                  <div role="status" aria-live="polite" className="space-y-5 py-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-6 w-6 shrink-0 text-[#FF5A1F]"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="font-display text-3xl font-bold text-white">
                          Thank You. Enquiry Received.
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
                          Your enquiry has been recorded securely for our Naroda reception team.
                          {settings?.privacyContact
                            ? ` Data requests: ${settings.privacyContact}.`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-2">
                      {whatsappFollowUpUrl && (
                        <a
                          href={whatsappFollowUpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors whitespace-nowrap"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Send via WhatsApp Now</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={handleReset}
                        className="inline-flex min-h-[48px] items-center justify-center rounded-md border border-white/20 bg-[#080808] px-5 py-3 text-sm font-medium text-white hover:border-white/40 transition-colors cursor-pointer"
                      >
                        Submit Another Enquiry
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {submitError && (
                      <p
                        role="alert"
                        className="rounded-md border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-4 py-3 text-xs font-medium text-white"
                      >
                        {submitError}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="enquiry-name"
                          className="block text-sm font-medium text-white mb-2"
                        >
                          Full Name
                        </label>
                        <input
                          id="enquiry-name"
                          name="name"
                          type="text"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                          }}
                          placeholder="Enter your name"
                          aria-invalid={Boolean(errors.name)}
                          aria-describedby={errors.name ? 'enquiry-name-error' : undefined}
                          className="w-full min-h-[46px] rounded-md border border-white/15 bg-[#080808] px-4 py-2.5 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
                        />
                        {errors.name && (
                          <p
                            id="enquiry-name-error"
                            role="alert"
                            className="mt-1.5 text-xs font-medium text-[#FF5A1F]"
                          >
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="enquiry-phone"
                          className="block text-sm font-medium text-white mb-2"
                        >
                          Mobile Phone Number
                        </label>
                        <input
                          id="enquiry-phone"
                          name="phone"
                          type="tel"
                          required
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                          }}
                          placeholder="10-digit mobile number"
                          aria-invalid={Boolean(errors.phone)}
                          aria-describedby={errors.phone ? 'enquiry-phone-error' : undefined}
                          className="w-full min-h-[46px] rounded-md border border-white/15 bg-[#080808] px-4 py-2.5 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none tabular-nums"
                        />
                        {errors.phone && (
                          <p
                            id="enquiry-phone-error"
                            role="alert"
                            className="mt-1.5 text-xs font-medium text-[#FF5A1F]"
                          >
                            {errors.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="enquiry-email"
                          className="block text-sm font-medium text-white mb-2"
                        >
                          Email Address (Optional)
                        </label>
                        <input
                          id="enquiry-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          placeholder="you@example.com"
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? 'enquiry-email-error' : undefined}
                          className="w-full min-h-[46px] rounded-md border border-white/15 bg-[#080808] px-4 py-2.5 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
                        />
                        {errors.email && (
                          <p
                            id="enquiry-email-error"
                            role="alert"
                            className="mt-1.5 text-xs font-medium text-[#FF5A1F]"
                          >
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="enquiry-membership"
                          className="block text-sm font-medium text-white mb-2"
                        >
                          Interested Membership or Program
                        </label>
                        <select
                          id="enquiry-membership"
                          name="membership"
                          value={membership}
                          onChange={(e) => {
                            setMembership(e.target.value);
                            if (errors.membership) {
                              setErrors((prev) => ({ ...prev, membership: undefined }));
                            }
                          }}
                          aria-invalid={Boolean(errors.membership)}
                          aria-describedby={
                            errors.membership ? 'enquiry-membership-error' : undefined
                          }
                          className="w-full min-h-[46px] rounded-md border border-white/15 bg-[#080808] px-4 py-2.5 text-sm text-white focus:border-[#FF5A1F] focus:outline-none"
                        >
                          {membershipOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        {errors.membership && (
                          <p
                            id="enquiry-membership-error"
                            role="alert"
                            className="mt-1.5 text-xs font-medium text-[#FF5A1F]"
                          >
                            {errors.membership}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="enquiry-message"
                        className="block text-sm font-medium text-white mb-2"
                      >
                        Message (Optional)
                      </label>
                      <textarea
                        id="enquiry-message"
                        name="message"
                        rows={4}
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          if (errors.message) {
                            setErrors((prev) => ({ ...prev, message: undefined }));
                          }
                        }}
                        placeholder="Share preferred workout shift or questions about fees and opening hours..."
                        aria-invalid={Boolean(errors.message)}
                        aria-describedby={errors.message ? 'enquiry-message-error' : undefined}
                        className="w-full rounded-md border border-white/15 bg-[#080808] px-4 py-3 text-sm text-white placeholder:text-[#A1A1AA]/60 focus:border-[#FF5A1F] focus:outline-none"
                      />
                      {errors.message && (
                        <p
                          id="enquiry-message-error"
                          role="alert"
                          className="mt-1.5 text-xs font-medium text-[#FF5A1F]"
                        >
                          {errors.message}
                        </p>
                      )}
                    </div>

                    <div className="rounded-md border border-white/10 bg-[#080808] p-4 space-y-2">
                      <label className="flex items-start gap-3 text-xs leading-relaxed text-[#A1A1AA] cursor-pointer">
                        <input
                          id="enquiry-consent"
                          type="checkbox"
                          checked={consentAccepted}
                          onChange={(e) => {
                            setConsentAccepted(e.target.checked);
                            if (errors.consentAccepted) {
                              setErrors((prev) => ({ ...prev, consentAccepted: undefined }));
                            }
                          }}
                          aria-invalid={Boolean(errors.consentAccepted)}
                          aria-describedby={
                            errors.consentAccepted ? 'enquiry-consent-error' : undefined
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF5A1F]"
                        />
                        <span>
                          I consent to <strong className="text-white">ASSURE FITNESS CLUB LLP</strong>{' '}
                          collecting and using my contact details solely to respond to this membership
                          enquiry ({ENQUIRY_CONSENT_VERSION}).{' '}
                          <button
                            type="button"
                            onClick={onOpenPrivacyModal}
                            className="text-[#FF5A1F] underline hover:text-white cursor-pointer"
                          >
                            Read Privacy &amp; Collection Notice
                          </button>
                        </span>
                      </label>
                      {errors.consentAccepted && (
                        <p
                          id="enquiry-consent-error"
                          role="alert"
                          className="text-xs font-medium text-[#FF5A1F]"
                        >
                          {errors.consentAccepted}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-7 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-70 transition-colors cursor-pointer"
                    >
                      {status === 'submitting' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Submitting Enquiry...</span>
                        </>
                      ) : (
                        <span>Submit Membership Enquiry</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

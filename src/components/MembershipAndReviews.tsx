import { ArrowUpRight, Check, MessageCircle, ShieldAlert, Star } from 'lucide-react';
import { MEMBERSHIP_PLANS } from '../data/clubData';
import type { MembershipPlanRecord, SiteSettingsRecord } from '../types/gym';
import { buildWhatsAppEnquiryUrl } from '../utils/clubLogic';

interface MembershipAndReviewsProps {
  onSelectPlanForForm: (planName: string) => void;
  livePlans?: MembershipPlanRecord[];
  settings?: SiteSettingsRecord | null;
}

export default function MembershipAndReviews({
  onSelectPlanForForm,
  livePlans,
  settings,
}: MembershipAndReviewsProps) {
  const hasApprovedLivePlans = Boolean(livePlans && livePlans.length > 0);
  const plans = hasApprovedLivePlans && livePlans
    ? livePlans.map((p) => ({
        id: p.id,
        name: p.name,
        duration: p.duration,
        pricePlaceholder: p.priceDisplay,
        priceNote:
          p.priceAmount > 0
            ? 'Owner-approved branch tariff · Confirm terms at reception'
            : 'Owner-approved structure · Confirm current tariff via enquiry form',
        featured: p.featured,
        features: p.features,
      }))
    : MEMBERSHIP_PLANS;

  const phoneApproved =
    Boolean(settings?.phoneApproved) && Boolean(settings?.phoneDisplay);
  const whatsappApproved =
    Boolean(settings?.whatsappApproved) && Boolean(settings?.whatsappNumber);
  const reviewsApproved =
    Boolean(settings?.reviewsApproved) &&
    Boolean(settings?.ratingValue) &&
    Boolean(settings?.reviewCount);
  const mapsApproved =
    Boolean(settings?.mapsApproved) && Boolean(settings?.mapsUrl);

  return (
    <>
      {/* H. Membership Section */}
      <section
        id="membership"
        className="border-t border-white/10 bg-[#111111] py-20 sm:py-28"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                05. Membership Plans
              </p>
              <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
                {hasApprovedLivePlans
                  ? 'Membership Options. Confirmed at Reception.'
                  : 'Draft Preview — Plans Pending Owner Approval.'}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[#A1A1AA]">
              {phoneApproved && settings
                ? `Call ${settings.phoneDisplay} or submit the enquiry form below for current Naroda branch tariffs and inclusions.`
                : 'Tariffs, class schedules, and refund policies are pending final owner confirmation. Submit an enquiry below to request verified rate details.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className={`flex flex-col justify-between rounded-lg border p-6 sm:p-8 ${
                  plan.featured
                    ? 'border-[#FF5A1F] bg-[#080808]'
                    : 'border-white/10 bg-[#080808]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs text-[#A1A1AA]">
                    <span className="tabular-nums">{plan.duration}</span>
                    {plan.featured && (
                      <span className="font-semibold text-[#FF5A1F]">
                        {hasApprovedLivePlans ? 'Popular Choice' : 'Draft Template'}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
                    {plan.name}
                  </h3>

                  <div className="mt-5 border-y border-white/10 py-5">
                    <p className="font-display text-4xl font-bold tracking-tight text-white tabular-nums">
                      {plan.pricePlaceholder}
                    </p>
                    <p className="mt-1.5 text-xs text-[#A1A1AA]">{plan.priceNote}</p>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-[#A1A1AA]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]"
                          aria-hidden="true"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  {whatsappApproved && settings?.whatsappNumber && (
                    <a
                      href={buildWhatsAppEnquiryUrl({
                        planName: plan.name,
                        whatsappNumber: settings.whatsappNumber,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                        plan.featured
                          ? 'bg-[#FF5A1F] text-white hover:bg-[#e54c14]'
                          : 'bg-white text-[#080808] hover:bg-neutral-200'
                      }`}
                    >
                      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Enquire on WhatsApp</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectPlanForForm(plan.name)}
                    className={`inline-flex min-h-[46px] w-full items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      whatsappApproved
                        ? 'border border-white/15 bg-[#111111] text-white hover:border-[#FF5A1F]'
                        : plan.featured
                        ? 'bg-[#FF5A1F] text-white hover:bg-[#e54c14]'
                        : 'border border-white/15 bg-[#111111] text-white hover:border-[#FF5A1F]'
                    }`}
                  >
                    Request Details via Form
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* I. Community Feedback & Verification Status */}
      <section
        aria-labelledby="reviews-heading"
        className="border-t border-white/10 bg-[#080808] py-20 sm:py-24"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          {reviewsApproved && settings ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-6">
                <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                  06. Community Feedback
                </p>
                <h2
                  id="reviews-heading"
                  className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance"
                >
                  Rated {settings.ratingValue} Out of 5 Across{' '}
                  <span className="tabular-nums">{settings.reviewCount}</span> Reviews.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-[#A1A1AA]">
                  Owner-approved Google Maps snapshot
                  {settings.reviewSnapshotDate ? ` recorded on ${settings.reviewSnapshotDate}` : ''}.
                </p>

                {mapsApproved && settings.mapsUrl && (
                  <div className="mt-7">
                    <a
                      href={settings.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors whitespace-nowrap"
                    >
                      <span>View Google Listing</span>
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>

              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-[#111111] p-6">
                  <div className="flex items-center gap-1 text-[#FF5A1F]" aria-label="Owner-approved review score">
                    {[0, 1, 2, 3, 4].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className="h-4 w-4 fill-[#FF5A1F] text-[#FF5A1F]"
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="mt-4 font-display text-5xl font-bold text-white tabular-nums">
                    {settings.ratingValue}
                    <span className="text-2xl text-[#A1A1AA]"> / 5</span>
                  </p>
                  <p className="mt-2 text-sm text-[#A1A1AA]">
                    Based on <strong className="text-white tabular-nums">{settings.reviewCount}</strong>{' '}
                    reviews{settings.reviewSnapshotDate ? ` (${settings.reviewSnapshotDate})` : ''}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#111111] p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-[#FF5A1F]">
                      Editable Member Stories Slot
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[#A1A1AA]">
                      Placeholder: Add verified, owner-approved member testimonials and transformation
                      stories here once written member consent is confirmed.
                    </p>
                  </div>
                  <p className="mt-4 text-xs text-[#A1A1AA] border-t border-white/10 pt-3">
                    Assure Fitness Club LLP · Naroda
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-[#111111] p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#FF5A1F]">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  <span>06. Community Feedback &amp; Testimonials</span>
                </div>
                <h2
                  id="reviews-heading"
                  className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white"
                >
                  Reviews &amp; Member Stories Pending Owner Verification.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#A1A1AA]">
                  To avoid publishing unverified claims or undated rating snapshots, review counts
                  and member testimonials remain unpublished until approved with a verified date in
                  the Operations Console.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectPlanForForm('General Club Visit / Tour')}
                className="inline-flex min-h-[46px] shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#080808] px-6 py-3 text-sm font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
              >
                Schedule a Club Visit
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

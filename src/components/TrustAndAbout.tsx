import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Star, ShieldCheck, MapPin, Clock, Dumbbell } from 'lucide-react';
import { ABOUT_MEDIA, BUSINESS_INFO } from '../data/clubData';
import type { SiteSettingsRecord } from '../types/gym';

interface TrustAndAboutProps {
  settings?: SiteSettingsRecord | null;
}

export default function TrustAndAbout({ settings }: TrustAndAboutProps) {
  const prefersReducedMotion = useReducedMotion();
  const [imgError, setImgError] = useState(false);

  const showReviews =
    Boolean(settings?.reviewsApproved) &&
    Boolean(settings?.ratingValue) &&
    Boolean(settings?.reviewCount);
  const showHours =
    Boolean(settings?.hoursApproved) && Boolean(settings?.closingHours);

  const trustItems = [
    {
      label: 'Community Rating',
      value: showReviews && settings ? `${settings.ratingValue} / 5` : 'Pending Review',
      detail:
        showReviews && settings
          ? `${settings.reviewCount} reviews${settings.reviewSnapshotDate ? ` · Snapshot ${settings.reviewSnapshotDate}` : ''}`
          : 'Awaiting dated snapshot & owner approval',
      icon: Star,
    },
    {
      label: 'Club Location',
      value: 'Naroda, 382330',
      detail: 'J-601 White Business Hub, Degam Road',
      icon: MapPin,
    },
    {
      label: 'Operating Schedule',
      value: showHours && settings ? settings.closingHours : 'Hours Pending',
      detail:
        showHours && settings
          ? settings.openingHours
          : 'Full daily timetable awaiting owner confirmation',
      icon: Clock,
    },
    {
      label: 'Official Domain',
      value: BUSINESS_INFO.website,
      detail: 'ASSURE FITNESS CLUB LLP',
      icon: ShieldCheck,
    },
  ];

  return (
    <>
      {/* C. Trust & Credibility Strip */}
      <section
        aria-label="Trust and verified club details"
        className="border-y border-white/10 bg-[#111111]"
      >
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-4 lg:border-r lg:last:border-r-0 border-white/10 lg:pr-6"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-[#080808] text-[#FF5A1F]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-[#A1A1AA]">
                      {item.label}
                    </p>
                    <p className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-[#A1A1AA]">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* D. About Us */}
      <section id="about" className="bg-[#080808] py-20 sm:py-28">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                  01. About Assure Fitness Club
                </p>
                <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold leading-[1.02] tracking-tight text-white text-balance">
                  Built for Consistent Progress in Naroda.
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-[#A1A1AA]">
                  Located at White Business Hub near Hanspura Gam on Degam Road,{' '}
                  <span className="text-white font-medium">
                    {settings?.businessName || BUSINESS_INFO.legalName}
                  </span>{' '}
                  is focused on delivering a clean, organized, and motivating fitness
                  environment for the Naroda and Ahmedabad community.
                </p>
                <p className="mt-4 text-base leading-relaxed text-[#A1A1AA]">
                  Whether you are stepping onto a training floor for the first time or maintaining
                  a structured strength routine, our aim is simple: provide a welcoming space where
                  every member can train safely and stay accountable.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-white/10 pt-8">
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">
                    Supportive Environment
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
                    Designed so beginners and experienced lifters alike feel comfortable, focused,
                    and respected on the floor.
                  </p>
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">
                    Club Philosophy
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#A1A1AA]">
                    Editable placeholder: Add the founder&apos;s personal training philosophy and
                    story after owner review.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col"
            >
              <div className="relative flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#111111] min-h-[340px]">
                {imgError ? (
                  <div className="flex h-full min-h-[340px] flex-col items-center justify-center bg-gradient-to-br from-[#18181b] to-[#080808] p-8 text-center">
                    <Dumbbell className="h-10 w-10 text-[#FF5A1F] mb-3" aria-hidden="true" />
                    <p className="font-display text-xl text-white">Assure Fitness Club Visual</p>
                    <p className="mt-1 text-xs text-[#A1A1AA]">{ABOUT_MEDIA.caption}</p>
                  </div>
                ) : (
                  <img
                    src={ABOUT_MEDIA.image}
                    alt={ABOUT_MEDIA.alt}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="h-full w-full lg:h-full object-cover object-center"
                  />
                )}
              </div>
              <p className="mt-3 text-xs text-[#A1A1AA]">{ABOUT_MEDIA.caption}</p>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
}

import { Suspense, lazy } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, MapPin } from 'lucide-react';
import { BUSINESS_INFO, HERO_MEDIA } from '../data/clubData';
import type { SiteSettingsRecord } from '../types/gym';

const HeroScene3D = lazy(() => import('./HeroScene3D'));

interface HeroSectionProps {
  onJoinClub: () => void;
  onExploreGym: () => void;
  settings?: SiteSettingsRecord | null;
}

export default function HeroSection({
  onJoinClub,
  onExploreGym,
  settings,
}: HeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const showApprovedRating =
    Boolean(settings?.reviewsApproved) &&
    Boolean(settings?.ratingValue) &&
    Boolean(settings?.reviewCount);
  const showApprovedHours =
    Boolean(settings?.hoursApproved) && Boolean(settings?.closingHours);

  return (
    <section
      id="home"
      className="relative min-h-[92vh] lg:min-h-screen flex items-center overflow-hidden bg-[#080808] pt-20 pb-16"
    >
      {/* Background Gym Atmosphere Layer (Illustrative Placeholder) */}
      <div className="absolute inset-0 z-0">
        <img
          src={HERO_MEDIA.backdrop}
          alt={HERO_MEDIA.alt}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center opacity-45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/85 to-[#080808]/40"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/60"
        />
      </div>

      {/* Three.js 3D Interactive Scene (lazy-loaded, desktop/tablet only & reduced-motion safe) */}
      <div className="hidden md:block absolute inset-0 z-[1] pointer-events-none">
        <Suspense fallback={null}>
          <HeroScene3D className="h-full w-full" />
        </Suspense>
      </div>

      {/* Semantic Foreground Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium tracking-wider text-[#A1A1AA] mb-5"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#FF5A1F] shrink-0" aria-hidden="true" />
              <span>{BUSINESS_INFO.shortLocation}</span>
            </div>
            {showApprovedRating && settings && (
              <>
                <span className="hidden sm:inline" aria-hidden="true">·</span>
                <span className="text-white tabular-nums pl-6 sm:pl-0">
                  {settings.ratingValue}/5 Google Rating ({settings.reviewCount} reviews
                  {settings.reviewSnapshotDate ? ` · ${settings.reviewSnapshotDate}` : ''})
                </span>
              </>
            )}
          </motion.div>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-lg sm:text-xl font-semibold tracking-[0.14em] text-[#FF5A1F] mb-3"
          >
            {BUSINESS_INFO.tagline}
          </motion.p>

          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl sm:text-6xl lg:text-[4.75rem] font-bold leading-[0.95] tracking-tight text-white text-balance"
          >
            {BUSINESS_INFO.heroHeadline}
          </motion.h1>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#A1A1AA]"
          >
            Welcome to{' '}
            <strong className="font-semibold text-white">
              {settings?.businessName || BUSINESS_INFO.legalName}
            </strong>{' '}
            at White Business Hub, Degam Road, Naroda. A dedicated training space built for
            consistency and measurable effort
            {showApprovedHours && settings
              ? `, ${settings.closingHours.toLowerCase()}.`
              : '. Operating schedule and membership tariffs are pending final owner confirmation.'}
          </motion.p>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <button
              type="button"
              onClick={onJoinClub}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#FF5A1F] px-7 py-3.5 text-sm sm:text-base font-semibold text-white hover:bg-[#e54c14] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span>Join the Club</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onExploreGym}
              className="inline-flex min-h-[48px] items-center justify-center rounded-md border border-white/25 bg-[#111111]/80 px-7 py-3.5 text-sm sm:text-base font-semibold text-white hover:border-[#FF5A1F] hover:bg-[#111111] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
            >
              Explore Our Gym
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, MessageCircle, UserCircle2 } from 'lucide-react';
import { TRAINING_PROGRAMS } from '../data/clubData';
import type { SiteSettingsRecord, TrainerRecord } from '../types/gym';
import { buildWhatsAppEnquiryUrl } from '../utils/clubLogic';

interface TrainingSectionProps {
  trainers?: TrainerRecord[];
  settings?: SiteSettingsRecord | null;
  onSelectProgramForForm: (programName: string) => void;
}

export default function TrainingSection({
  trainers = [],
  settings,
  onSelectProgramForForm,
}: TrainingSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const whatsappApproved =
    Boolean(settings?.whatsappApproved) && Boolean(settings?.whatsappNumber);

  return (
    <section
      id="training"
      className="border-t border-white/10 bg-[#111111] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12"
        >
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
              03. Training Programs
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
              Proposed Coaching &amp; Fitness Tracks.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#A1A1AA]">
            These categories are editable draft tracks pending owner confirmation of batch
            schedules, coaching formats, and class availability.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRAINING_PROGRAMS.map((program, idx) => (
            <motion.article
              key={program.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.4,
                delay: prefersReducedMotion ? 0 : idx * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col justify-between rounded-lg border border-white/10 bg-[#080808] p-6 sm:p-8 hover:border-[#FF5A1F]/60 transition-colors duration-150"
            >
              <div>
                <div className="flex items-center justify-between gap-4 text-xs text-[#A1A1AA]">
                  <span className="font-semibold text-[#FF5A1F] tabular-nums">
                    {program.index}
                  </span>
                  <span>{program.categoryNote}</span>
                </div>

                <h3 className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
                  {program.name}
                </h3>

                <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#A1A1AA]">
                  {program.summary}
                </p>

                <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs sm:text-sm text-[#A1A1AA]">
                  {program.focusPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#FF5A1F]"
                        aria-hidden="true"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                {whatsappApproved && settings?.whatsappNumber ? (
                  <a
                    href={buildWhatsAppEnquiryUrl({
                      programName: program.name,
                      whatsappNumber: settings.whatsappNumber,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-white hover:text-[#FF5A1F] transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                    <span>Ask About {program.name}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectProgramForForm(`${program.name} Enquiry`)}
                    className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-white hover:text-[#FF5A1F] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Enquire About {program.name}</span>
                    <ArrowRight className="h-4 w-4 text-[#FF5A1F]" aria-hidden="true" />
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </div>

        {trainers.length > 0 && (
          <div className="mt-16 border-t border-white/10 pt-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
                  Owner-Approved Coaching Team
                </p>
                <h3 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
                  Club Trainers
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trainers.map((trainer) => (
                <article
                  key={trainer.id}
                  className="rounded-lg border border-white/10 bg-[#080808] overflow-hidden"
                >
                  <div className="aspect-[4/3] bg-[#111111] overflow-hidden flex items-center justify-center border-b border-white/10">
                    {trainer.photoUrl ? (
                      <img
                        src={trainer.photoUrl}
                        alt={trainer.fullName}
                        loading="lazy"
                        className="h-full w-full object-cover object-center"
                      />
                    ) : (
                      <UserCircle2 className="h-14 w-14 text-[#A1A1AA]/40" aria-hidden="true" />
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-[#FF5A1F]">
                      {trainer.specialization}
                    </p>
                    <h4 className="mt-1 font-display text-2xl font-bold text-white">
                      {trainer.fullName}
                    </h4>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">{trainer.experience}</p>
                    {trainer.bio && (
                      <p className="mt-3 text-xs leading-relaxed text-[#A1A1AA]">
                        {trainer.bio}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

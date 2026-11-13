import { useState, type MouseEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Dumbbell } from 'lucide-react';
import { FACILITIES, type FacilityItem } from '../data/clubData';

function FacilityCard({ item }: { item: FacilityItem }) {
  const prefersReducedMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [imgFailed, setImgFailed] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion || window.innerWidth < 1024) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: -y * 5,
      rotateY: x * 5,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0 });
  };

  return (
    <article
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        prefersReducedMotion
          ? undefined
          : {
              transform: `perspective(1100px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
              transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }
      }
      className={`group flex flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-[#111111] hover:border-[#FF5A1F]/60 ${
        item.spanWide ? 'lg:col-span-2' : 'lg:col-span-1'
      }`}
    >
      {item.image && (
        <div className="relative h-56 sm:h-64 w-full overflow-hidden border-b border-white/10 bg-[#080808]">
          {imgFailed ? (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1d] to-[#080808]">
              <Dumbbell className="h-8 w-8 text-[#FF5A1F]" aria-hidden="true" />
            </div>
          ) : (
            <img
              src={item.image}
              alt={item.imageAlt || item.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent opacity-80"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#A1A1AA]">
            <span className="text-[#FF5A1F] font-semibold tabular-nums">{item.index}</span>
            <span aria-hidden="true">·</span>
            <span>{item.zoneLabel}</span>
          </div>

          <h3 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {item.title}
          </h3>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#A1A1AA]">
            {item.description}
          </p>

          <ul className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs sm:text-sm text-[#A1A1AA]">
            {item.highlights.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#FF5A1F]" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-xs font-medium text-[#FF5A1F]/90">
          {item.placeholderNotice}
        </p>
      </div>
    </article>
  );
}

export default function FacilitiesSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="facilities"
      className="border-t border-white/10 bg-[#080808] py-20 sm:py-28"
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
              02. Gym Facilities
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
              Training Zones &amp; Floor Amenities.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#A1A1AA]">
            Editable placeholders shown below. Confirm exact equipment inventory, machine brands,
            and locker amenities with the Assure Fitness Club team before final launch.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {FACILITIES.map((item) => (
            <FacilityCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

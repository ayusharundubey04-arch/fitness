import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, X } from 'lucide-react';
import { GALLERY_ITEMS, type GalleryItem } from '../data/clubData';
import type { GalleryPhotoRecord } from '../types/gym';
import { filterGalleryItems, type GalleryFilter } from '../utils/clubLogic';

const FILTERS: GalleryFilter[] = ['All', 'Strength', 'Conditioning', 'Studio'];

interface GallerySectionProps {
  liveItems?: GalleryPhotoRecord[];
}

export default function GallerySection({ liveItems }: GallerySectionProps) {
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('All');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const sourceItems: GalleryItem[] =
    liveItems && liveItems.length > 0
      ? liveItems.map((item) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          image: item.imageUrl,
          alt: item.caption || item.title,
          caption: item.caption,
          placeholderNotice: item.isPlaceholder ? 'Visual Placeholder' : 'Official Club Photo',
        }))
      : GALLERY_ITEMS;

  const visibleItems = filterGalleryItems(sourceItems, activeFilter);

  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev === null ? null : (prev + 1) % visibleItems.length,
        );
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + visibleItems.length) % visibleItems.length,
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, visibleItems.length]);

  const activeItem: GalleryItem | null =
    selectedIndex !== null && visibleItems[selectedIndex]
      ? visibleItems[selectedIndex]
      : null;

  return (
    <section
      id="gallery"
      className="border-t border-white/10 bg-[#080808] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wider text-[#FF5A1F]">
              04. Club Gallery
            </p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white text-balance">
              Space &amp; Atmosphere Preview.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#A1A1AA]">
              Editable photo collection: the frames below are illustrative visual placeholders and
              do not depict the actual Naroda interior until replaced with official club photos.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter gallery by zone"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#111111] p-1 self-start lg:self-auto"
          >
            {FILTERS.map((category) => {
              const isActive = activeFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setActiveFilter(category);
                    setSelectedIndex(null);
                  }}
                  className={`min-h-[40px] rounded-md px-4 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#FF5A1F] text-white'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item, idx) => {
            const isFeaturedWide = idx === 0 && activeFilter === 'All';
            const hasFailed = Boolean(failedImages[item.id]);

            return (
              <figure
                key={item.id}
                className={`group overflow-hidden rounded-lg border border-white/10 bg-[#111111] ${
                  isFeaturedWide ? 'md:col-span-2' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  aria-label={`Inspect ${item.title} in gallery viewer`}
                  className="relative block w-full overflow-hidden bg-[#080808] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
                >
                  <div className={isFeaturedWide ? 'aspect-[16/9]' : 'aspect-[4/3]'}>
                    {hasFailed ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#18181b] to-[#080808] p-6 text-center">
                        <ImageIcon className="h-8 w-8 text-[#FF5A1F] mb-2" aria-hidden="true" />
                        <span className="text-sm font-medium text-white">{item.title}</span>
                      </div>
                    ) : (
                      <img
                        src={item.image}
                        alt={item.alt}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    )}
                  </div>
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80"
                  />
                  <span className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-black/70 text-white border border-white/15 opacity-90 group-hover:bg-[#FF5A1F] group-hover:border-[#FF5A1F] transition-colors">
                    <Expand className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>

                <figcaption className="p-5">
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                    <span className="text-[#FF5A1F] font-medium">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.placeholderNotice}</span>
                  </div>
                  <p className="mt-1 font-display text-2xl font-bold text-white">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#A1A1AA]">
                    {item.caption}
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {/* Lightbox Modal */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 sm:p-8"
        >
          <div className="relative w-full max-w-5xl rounded-lg border border-white/15 bg-[#111111] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-4 sm:px-6 py-3">
              <div className="text-xs sm:text-sm text-[#A1A1AA]">
                <span className="font-semibold text-white">{activeItem.title}</span>
                <span className="mx-2" aria-hidden="true">·</span>
                <span>{activeItem.placeholderNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                aria-label="Close gallery viewer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-[#080808] text-white hover:border-[#FF5A1F] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative bg-[#080808]">
              <img
                src={activeItem.image}
                alt={activeItem.alt}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-full object-contain mx-auto"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 px-4 sm:px-6 py-4">
              <p className="text-xs sm:text-sm text-[#A1A1AA]">{activeItem.caption}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous gallery image"
                  onClick={() =>
                    setSelectedIndex((prev) =>
                      prev === null
                        ? 0
                        : (prev - 1 + visibleItems.length) % visibleItems.length,
                    )
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-xs font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  aria-label="Next gallery image"
                  onClick={() =>
                    setSelectedIndex((prev) =>
                      prev === null ? 0 : (prev + 1) % visibleItems.length,
                    )
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-xs font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BUSINESS_INFO, NAV_LINKS } from '../data/clubData';

interface NavbarProps {
  onJoinClick: () => void;
  onNavigateMember: () => void;
  onNavigateTrainer: () => void;
  announcement?: string | null;
}

export default function Navbar({
  onJoinClick,
  onNavigateMember,
  onNavigateTrainer,
  announcement,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled || mobileOpen
          ? 'bg-[#080808]/95 border-b border-white/10'
          : 'bg-gradient-to-b from-[#080808]/90 to-transparent border-b border-transparent'
      }`}
    >
      {announcement && (
        <div className="border-b border-[#FF5A1F]/30 bg-[#FF5A1F]/15 px-4 py-1.5 text-center text-xs font-medium text-white">
          {announcement}
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <a
          href="#home"
          onClick={handleNavClick}
          className="font-display text-xl sm:text-2xl font-bold tracking-wider text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
        >
          {BUSINESS_INFO.brandName}
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#A1A1AA]"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative py-1 text-[#A1A1AA] hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] after:bg-[#FF5A1F] after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-150 after:origin-left focus-visible:outline-none focus-visible:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/member"
            onClick={(e) => {
              e.preventDefault();
              setMobileOpen(false);
              onNavigateMember();
            }}
            className="hidden sm:inline-flex items-center justify-center rounded-md border border-white/15 bg-[#111111]/80 px-3.5 py-2 text-xs font-semibold text-white hover:border-[#FF5A1F] hover:text-[#FF5A1F] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            Member Login
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onJoinClick();
            }}
            className="hidden sm:inline-flex items-center justify-center rounded-md bg-[#FF5A1F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Join Now
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex lg:hidden items-center justify-center h-11 w-11 rounded-md border border-white/15 bg-[#111111] text-white hover:border-[#FF5A1F] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav-drawer"
          aria-label="Mobile navigation"
          className="lg:hidden border-t border-white/10 bg-[#080808] px-4 py-5"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={handleNavClick}
                  className="flex min-h-[44px] items-center rounded-md px-3 text-base font-medium text-[#A1A1AA] hover:bg-[#111111] hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="/member"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  onNavigateMember();
                }}
                className="flex min-h-[44px] items-center justify-center rounded-md border border-white/15 bg-[#111111] px-3 text-xs font-semibold text-white hover:border-[#FF5A1F] transition-colors"
              >
                Member Login
              </a>
              <a
                href="/trainer"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileOpen(false);
                  onNavigateTrainer();
                }}
                className="flex min-h-[44px] items-center justify-center rounded-md border border-white/15 bg-[#111111] px-3 text-xs font-semibold text-[#A1A1AA] hover:border-[#FF5A1F] hover:text-white transition-colors"
              >
                Trainer Portal
              </a>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onJoinClick();
              }}
              className="w-full min-h-[44px] rounded-md bg-[#FF5A1F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e54c14] transition-colors cursor-pointer"
            >
              Join Now
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

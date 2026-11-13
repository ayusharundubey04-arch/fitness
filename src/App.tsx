/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TrustAndAbout from './components/TrustAndAbout';
import FacilitiesSection from './components/FacilitiesSection';
import TrainingSection from './components/TrainingSection';
import GallerySection from './components/GallerySection';
import MembershipAndReviews from './components/MembershipAndReviews';
import LocationAndContact from './components/LocationAndContact';
import Footer from './components/Footer';
import {
  subscribePublicGallery,
  subscribePublicPlans,
  subscribePublicSettings,
  subscribePublicTrainers,
} from './lib/firestoreService';
import type {
  GalleryPhotoRecord,
  MembershipPlanRecord,
  SiteSettingsRecord,
  TrainerRecord,
} from './types/gym';

const AdminAuthGate = lazy(() => import('./admin/AdminAuthGate'));
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export default function App() {
  const [routePath, setRoutePath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  const [selectedPlan, setSelectedPlan] = useState('Quarterly Commitment');
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms' | null>(null);

  const [settings, setSettings] = useState<SiteSettingsRecord | null>(null);
  const [livePlans, setLivePlans] = useState<MembershipPlanRecord[]>([]);
  const [liveGallery, setLiveGallery] = useState<GalleryPhotoRecord[]>([]);
  const [liveTrainers, setLiveTrainers] = useState<TrainerRecord[]>([]);

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const onAdminRoute = isAdminPath(routePath);

  useEffect(() => {
    if (onAdminRoute) return;
    const unsubs = [
      subscribePublicSettings(setSettings),
      subscribePublicPlans(setLivePlans),
      subscribePublicGallery(setLiveGallery),
      subscribePublicTrainers(setLiveTrainers),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [onAdminRoute]);

  const navigateTo = (path: '/' | '/admin') => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setRoutePath(path);
      window.scrollTo({ top: 0 });
    }
  };

  if (onAdminRoute) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center text-sm text-[#A1A1AA]">
            Loading operations console...
          </div>
        }
      >
        <AdminAuthGate>
          {(staffUser) => (
            <AdminDashboard
              staffUser={staffUser}
              onNavigatePublic={() => navigateTo('/')}
            />
          )}
        </AdminAuthGate>
      </Suspense>
    );
  }

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectPlanForForm = (planName: string) => {
    setSelectedPlan(planName);
    scrollToSection('contact');
  };

  const announcement =
    settings?.announcementActive && settings.announcementText.trim()
      ? settings.announcementText.trim()
      : null;

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Navbar
        onJoinClick={() => scrollToSection('membership')}
        announcement={announcement}
      />
      <main>
        <HeroSection
          onJoinClub={() => scrollToSection('membership')}
          onExploreGym={() => scrollToSection('about')}
          settings={settings}
        />
        <TrustAndAbout settings={settings} />
        <FacilitiesSection />
        <TrainingSection
          trainers={liveTrainers}
          settings={settings}
          onSelectProgramForForm={handleSelectPlanForForm}
        />
        <GallerySection liveItems={liveGallery} />
        <MembershipAndReviews
          onSelectPlanForForm={handleSelectPlanForForm}
          livePlans={livePlans}
          settings={settings}
        />
        <LocationAndContact
          selectedPlan={selectedPlan}
          settings={settings}
          livePlans={livePlans}
          onOpenPrivacyModal={() => setLegalModalTab('privacy')}
        />
      </main>
      <Footer
        settings={settings}
        onOpenAdmin={() => navigateTo('/admin')}
        legalModalTab={legalModalTab}
        onOpenLegalModal={setLegalModalTab}
      />
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import type { OperationsSettingsRecord, SiteSettingsRecord } from '../types/gym';
import { BUSINESS_INFO } from '../data/clubData';
import {
  saveOperationsSettings,
  saveSiteSettings,
  type StaffSessionUser,
} from '../lib/firestoreService';

interface SettingsTabProps {
  settings: SiteSettingsRecord | null;
  operationsSettings: OperationsSettingsRecord | null;
  staffUser: StaffSessionUser;
}

export default function SettingsTab({
  settings,
  operationsSettings,
  staffUser,
}: SettingsTabProps) {
  const [businessName, setBusinessName] = useState(
    settings?.businessName || BUSINESS_INFO.legalName,
  );
  const [address, setAddress] = useState(settings?.address || BUSINESS_INFO.address);
  const [phoneDisplay, setPhoneDisplay] = useState(settings?.phoneDisplay || '');
  const [phoneApproved, setPhoneApproved] = useState(Boolean(settings?.phoneApproved));
  const [whatsappNumber, setWhatsappNumber] = useState(settings?.whatsappNumber || '');
  const [whatsappApproved, setWhatsappApproved] = useState(
    Boolean(settings?.whatsappApproved),
  );
  const [openingHours, setOpeningHours] = useState(
    settings?.openingHours || BUSINESS_INFO.hoursPlaceholder,
  );
  const [closingHours, setClosingHours] = useState(
    settings?.closingHours || BUSINESS_INFO.closingHours,
  );
  const [hoursApproved, setHoursApproved] = useState(Boolean(settings?.hoursApproved));
  const [mapsUrl, setMapsUrl] = useState(settings?.mapsUrl || '');
  const [mapsApproved, setMapsApproved] = useState(Boolean(settings?.mapsApproved));
  const [plusCodeNote, setPlusCodeNote] = useState(
    settings?.plusCodeNote ||
      '3MMG+57 Ahmedabad · Unique Innovation wording pending owner confirmation',
  );
  const [ratingValue, setRatingValue] = useState(settings?.ratingValue || '4.7');
  const [reviewCount, setReviewCount] = useState(settings?.reviewCount || '494');
  const [reviewSnapshotDate, setReviewSnapshotDate] = useState(
    settings?.reviewSnapshotDate || '',
  );
  const [reviewsApproved, setReviewsApproved] = useState(
    Boolean(settings?.reviewsApproved),
  );
  const [privacyContact, setPrivacyContact] = useState(
    settings?.privacyContact || 'Pending owner privacy contact email',
  );
  const [retentionPolicySummary, setRetentionPolicySummary] = useState(
    settings?.retentionPolicySummary ||
      'Website enquiries reviewed every 180 days; members archived upon request.',
  );
  const [announcementText, setAnnouncementText] = useState(
    settings?.announcementText || '',
  );
  const [announcementActive, setAnnouncementActive] = useState(
    Boolean(settings?.announcementActive),
  );

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Operations settings (Owner-only private config)
  const [enquiryRecipientsNote, setEnquiryRecipientsNote] = useState(
    operationsSettings?.enquiryRecipientsNote ||
      'Desk staff and owner via /admin console',
  );
  const [exportRequiresOwner, setExportRequiresOwner] = useState(
    operationsSettings?.exportRequiresOwner ?? true,
  );
  const [defaultRetentionDays, setDefaultRetentionDays] = useState(
    operationsSettings?.defaultRetentionDays ?? 180,
  );
  const [appCheckEnabledNote, setAppCheckEnabledNote] = useState(
    operationsSettings?.appCheckEnabledNote ||
      'Enable Firebase App Check (reCAPTCHA Enterprise) in Firebase Console before launch.',
  );
  const [savingOps, setSavingOps] = useState(false);
  const [opsSaved, setOpsSaved] = useState(false);
  const [opsError, setOpsError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setBusinessName(settings.businessName);
    setAddress(settings.address);
    setPhoneDisplay(settings.phoneDisplay);
    setPhoneApproved(Boolean(settings.phoneApproved));
    setWhatsappNumber(settings.whatsappNumber);
    setWhatsappApproved(Boolean(settings.whatsappApproved));
    setOpeningHours(settings.openingHours);
    setClosingHours(settings.closingHours);
    setHoursApproved(Boolean(settings.hoursApproved));
    setMapsUrl(settings.mapsUrl);
    setMapsApproved(Boolean(settings.mapsApproved));
    setPlusCodeNote(settings.plusCodeNote);
    setRatingValue(settings.ratingValue);
    setReviewCount(settings.reviewCount);
    setReviewSnapshotDate(settings.reviewSnapshotDate);
    setReviewsApproved(Boolean(settings.reviewsApproved));
    setPrivacyContact(settings.privacyContact);
    setRetentionPolicySummary(settings.retentionPolicySummary);
    setAnnouncementText(settings.announcementText);
    setAnnouncementActive(Boolean(settings.announcementActive));
  }, [settings]);

  useEffect(() => {
    if (!operationsSettings) return;
    setEnquiryRecipientsNote(operationsSettings.enquiryRecipientsNote);
    setExportRequiresOwner(Boolean(operationsSettings.exportRequiresOwner));
    setDefaultRetentionDays(operationsSettings.defaultRetentionDays);
    setAppCheckEnabledNote(operationsSettings.appCheckEnabledNote);
  }, [operationsSettings]);

  const handleSavePublic = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError(null);
    try {
      await saveSiteSettings(
        {
          businessName: businessName.trim(),
          address: address.trim(),
          phoneDisplay: phoneDisplay.trim(),
          phoneApproved,
          whatsappNumber: whatsappNumber.replace(/\D/g, ''),
          whatsappApproved,
          openingHours: openingHours.trim(),
          closingHours: closingHours.trim(),
          hoursApproved,
          mapsUrl: mapsUrl.trim(),
          mapsApproved,
          plusCodeNote: plusCodeNote.trim(),
          ratingValue: ratingValue.trim(),
          reviewCount: reviewCount.trim(),
          reviewSnapshotDate: reviewSnapshotDate.trim(),
          reviewsApproved,
          privacyContact: privacyContact.trim(),
          retentionPolicySummary: retentionPolicySummary.trim(),
          announcementText: announcementText.trim().slice(0, 240),
          announcementActive,
        },
        staffUser,
      );
      setSettingsSaved(true);
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : 'Failed to save public site settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveOperations = async (e: FormEvent) => {
    e.preventDefault();
    setSavingOps(true);
    setOpsSaved(false);
    setOpsError(null);
    try {
      await saveOperationsSettings(
        {
          enquiryRecipientsNote: enquiryRecipientsNote.trim().slice(0, 240),
          exportRequiresOwner,
          defaultRetentionDays: Math.max(30, Math.min(3650, Number(defaultRetentionDays) || 180)),
          appCheckEnabledNote: appCheckEnabledNote.trim().slice(0, 240),
        },
        staffUser,
      );
      setOpsSaved(true);
    } catch (err) {
      setOpsError(
        err instanceof Error ? err.message : 'Failed to save operations settings.',
      );
    } finally {
      setSavingOps(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-3xl font-bold text-white">
          Website Publication Gates &amp; Operations Settings
        </h2>
        <p className="text-xs text-[#A1A1AA]">
          Owner-only settings. Disputed phone numbers, unconfirmed WhatsApp destinations, hours,
          Maps pins, and rating snapshots remain hidden from `/` until explicitly checked approved.
        </p>
      </div>

      {/* Public Website Content & Approval Gates */}
      <section className="rounded-lg border border-white/10 bg-[#111111] p-6">
        <h3 className="font-display text-2xl font-bold text-white mb-5">
          Public Website Settings (`settings/public`)
        </h3>

        {settingsError && (
          <p role="alert" className="mb-4 text-xs font-medium text-[#FF5A1F]">
            {settingsError}
          </p>
        )}
        {settingsSaved && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Public website settings and approval flags updated.</span>
          </div>
        )}

        <form onSubmit={handleSavePublic} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Legal Business Name
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Privacy Contact Email / Desk Note
              </label>
              <input
                type="text"
                maxLength={160}
                value={privacyContact}
                onChange={(e) => setPrivacyContact(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Verified Club Address
            </label>
            <textarea
              rows={2}
              required
              minLength={10}
              maxLength={240}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-white/15 bg-[#080808] px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Phone & WhatsApp Gate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-5">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#A1A1AA]">
                Confirmed Public Phone (Leave blank until resolved)
              </label>
              <input
                type="text"
                maxLength={30}
                placeholder="Resolve +91 98989 89533 vs +91 98640 24533"
                value={phoneDisplay}
                onChange={(e) => setPhoneDisplay(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
              />
              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={phoneApproved}
                  onChange={(e) => setPhoneApproved(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Owner-approved to publish public phone number</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#A1A1AA]">
                Confirmed WhatsApp Destination (Digits only, e.g. 91XXXXXXXXXX)
              </label>
              <input
                type="text"
                maxLength={20}
                placeholder="Pending owner confirmation"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
              />
              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappApproved}
                  onChange={(e) => setWhatsappApproved(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Owner-approved to enable public WhatsApp links</span>
              </label>
            </div>
          </div>

          {/* Operating Hours Gate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-5">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Full Operating Hours
              </label>
              <input
                type="text"
                maxLength={120}
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Closing Time Note
              </label>
              <input
                type="text"
                maxLength={80}
                value={closingHours}
                onChange={(e) => setClosingHours(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={hoursApproved}
                  onChange={(e) => setHoursApproved(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Owner-approved full operating hours (including Sunday/holidays)</span>
              </label>
            </div>
          </div>

          {/* Maps & Reviews Gate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/10 pt-5">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#A1A1AA]">
                Confirmed Google Maps URL
              </label>
              <input
                type="url"
                maxLength={500}
                placeholder="https://maps.google.com/..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
              <input
                type="text"
                maxLength={160}
                value={plusCodeNote}
                onChange={(e) => setPlusCodeNote(e.target.value)}
                placeholder="Plus Code / Unique Innovation confirmation note"
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-xs text-white"
              />
              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={mapsApproved}
                  onChange={(e) => setMapsApproved(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Owner-approved Maps pin &amp; directions link</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#A1A1AA]">
                Dated Google Review Snapshot (Rating / Count / Snapshot Date)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  maxLength={16}
                  placeholder="4.7"
                  value={ratingValue}
                  onChange={(e) => setRatingValue(e.target.value)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
                />
                <input
                  type="text"
                  maxLength={20}
                  placeholder="494"
                  value={reviewCount}
                  onChange={(e) => setReviewCount(e.target.value)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
                />
                <input
                  type="text"
                  maxLength={40}
                  placeholder="YYYY-MM-DD"
                  value={reviewSnapshotDate}
                  onChange={(e) => setReviewSnapshotDate(e.target.value)}
                  className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewsApproved}
                  onChange={(e) => setReviewsApproved(e.target.checked)}
                  className="accent-[#FF5A1F]"
                />
                <span>Owner-approved dated Google review snapshot (requires snapshot date)</span>
              </label>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Public Data Retention Summary
              </label>
              <input
                type="text"
                maxLength={300}
                value={retentionPolicySummary}
                onChange={(e) => setRetentionPolicySummary(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                checked={announcementActive}
                onChange={(e) => setAnnouncementActive(e.target.checked)}
                className="accent-[#FF5A1F]"
              />
              <span>Show Homepage Announcement Banner</span>
            </label>

            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Homepage Announcement Text (Max 240 chars)
              </label>
              <input
                type="text"
                maxLength={240}
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="e.g. Verified holiday schedule or club notice..."
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="min-h-[44px] rounded-md bg-[#FF5A1F] px-6 text-sm font-semibold text-white hover:bg-[#e54c14] disabled:opacity-60 cursor-pointer"
            >
              {savingSettings ? 'Saving...' : 'Save Public Publication Gates'}
            </button>
          </div>
        </form>
      </section>

      {/* Owner-Only Private Operations Settings */}
      <section className="rounded-lg border border-white/10 bg-[#111111] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" />
          <div>
            <h3 className="font-display text-2xl font-bold text-white">
              Private Operations Settings (`settings/operations`)
            </h3>
            <p className="text-xs text-[#A1A1AA]">
              Never exposed to public visitors or non-owner staff
            </p>
          </div>
        </div>

        {opsError && (
          <p role="alert" className="text-xs font-medium text-[#FF5A1F]">
            {opsError}
          </p>
        )}
        {opsSaved && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-medium text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Private operations settings saved.</span>
          </div>
        )}

        <form onSubmit={handleSaveOperations} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Enquiry Notification Recipients Note
              </label>
              <input
                type="text"
                maxLength={240}
                value={enquiryRecipientsNote}
                onChange={(e) => setEnquiryRecipientsNote(e.target.value)}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                Default Enquiry Retention Review Window (Days)
              </label>
              <input
                type="number"
                min={30}
                max={3650}
                value={defaultRetentionDays}
                onChange={(e) => setDefaultRetentionDays(Number(e.target.value))}
                className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              Firebase App Check Status Note
            </label>
            <input
              type="text"
              maxLength={240}
              value={appCheckEnabledNote}
              onChange={(e) => setAppCheckEnabledNote(e.target.value)}
              className="w-full min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-3 text-sm text-white"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={exportRequiresOwner}
              onChange={(e) => setExportRequiresOwner(e.target.checked)}
              className="accent-[#FF5A1F]"
            />
            <span>Require Owner role for bulk CSV exports</span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingOps}
              className="min-h-[42px] rounded-md border border-white/15 bg-[#080808] px-5 text-sm font-semibold text-white hover:border-[#FF5A1F] cursor-pointer"
            >
              {savingOps ? 'Saving...' : 'Save Operations Settings'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

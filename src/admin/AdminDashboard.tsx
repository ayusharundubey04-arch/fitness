import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  CalendarCheck,
  CreditCard,
  Dumbbell,
  ExternalLink,
  FileCheck2,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  RefreshCw,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import {
  subscribeAdminCollection,
  subscribeOperationsSettings,
  subscribePublicSettings,
  subscribeTrainerAttendance,
  subscribeTrainerMembers,
  type StaffSessionUser,
} from '../lib/firestoreService';
import type {
  AttendanceRecord,
  AuditEventRecord,
  EnquiryRecord,
  GalleryPhotoRecord,
  GymMember,
  MembershipPlanRecord,
  MembershipRecord,
  OperationsSettingsRecord,
  PaymentRecord,
  SiteContentRecord,
  SiteSettingsRecord,
  StaffAccount,
  StaffRole,
  TrainerRecord,
} from '../types/gym';
import OverviewTab from './OverviewTab';
import TrainerRosterTab from './TrainerRosterTab';
import MembersTab from './MembersTab';
import MembershipsTab from './MembershipsTab';
import AttendanceTab from './AttendanceTab';
import PlansTab from './PlansTab';
import EnquiriesTab from './EnquiriesTab';
import TrainersTab from './TrainersTab';
import PaymentsTab from './PaymentsTab';
import GalleryTab from './GalleryTab';
import ContentApprovalTab from './ContentApprovalTab';
import StaffTab from './StaffTab';
import AuditLogTab from './AuditLogTab';
import SettingsTab from './SettingsTab';

interface AdminDashboardProps {
  staffUser: StaffSessionUser;
  onNavigatePublic: () => void;
}

type AdminTabId =
  | 'overview'
  | 'roster'
  | 'members'
  | 'memberships'
  | 'attendance'
  | 'plans'
  | 'enquiries'
  | 'trainers'
  | 'payments'
  | 'gallery'
  | 'content'
  | 'staff'
  | 'audit'
  | 'settings';

interface NavItem {
  id: AdminTabId;
  label: string;
  icon: typeof LayoutDashboard;
  roles: StaffRole[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'staff'] },
  { id: 'roster', label: 'Assigned Roster', icon: UserCheck, roles: ['trainer'] },
  { id: 'members', label: 'Members', icon: Users, roles: ['owner', 'staff'] },
  { id: 'memberships', label: 'Memberships', icon: RefreshCw, roles: ['owner', 'staff'] },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, roles: ['owner', 'staff', 'trainer'] },
  { id: 'plans', label: 'Membership Plans', icon: ShieldCheck, roles: ['owner', 'staff'] },
  { id: 'enquiries', label: 'Enquiries', icon: MessageSquare, roles: ['owner', 'staff'] },
  { id: 'trainers', label: 'Trainers', icon: Dumbbell, roles: ['owner', 'staff'] },
  { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['owner', 'staff'] },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon, roles: ['owner', 'staff'] },
  { id: 'content', label: 'Content Register', icon: FileCheck2, roles: ['owner', 'staff'] },
  { id: 'staff', label: 'Staff & RBAC', icon: Shield, roles: ['owner'] },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText, roles: ['owner'] },
  { id: 'settings', label: 'Publish & Ops', icon: Settings, roles: ['owner'] },
];

export default function AdminDashboard({
  staffUser,
  onNavigatePublic,
}: AdminDashboardProps) {
  const allowedNav = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(staffUser.role)),
    [staffUser.role],
  );

  const [activeTab, setActiveTab] = useState<AdminTabId>(
    staffUser.role === 'trainer' ? 'roster' : 'overview',
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const [members, setMembers] = useState<GymMember[]>([]);
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [trainers, setTrainers] = useState<TrainerRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [gallery, setGallery] = useState<GalleryPhotoRecord[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContentRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [settings, setSettings] = useState<SiteSettingsRecord | null>(null);
  const [operationsSettings, setOperationsSettings] =
    useState<OperationsSettingsRecord | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (staffUser.role === 'trainer') {
      const scopeId = staffUser.assignedTrainerId || staffUser.uid;
      const unsubs = [
        subscribeTrainerMembers(scopeId, setMembers),
        subscribeTrainerAttendance(scopeId, setAttendance),
      ];
      return () => {
        for (const unsub of unsubs) unsub();
      };
    }

    const unsubs = [
      subscribeAdminCollection<GymMember>('members', setMembers),
      subscribeAdminCollection<MembershipRecord>('memberships', setMemberships),
      subscribeAdminCollection<AttendanceRecord>('attendance', setAttendance),
      subscribeAdminCollection<MembershipPlanRecord>('membershipPlans', (rows) =>
        setPlans([...rows].sort((a, b) => a.durationDays - b.durationDays)),
      ),
      subscribeAdminCollection<EnquiryRecord>('enquiries', setEnquiries),
      subscribeAdminCollection<TrainerRecord>('trainers', setTrainers),
      subscribeAdminCollection<PaymentRecord>('payments', setPayments),
      subscribeAdminCollection<GalleryPhotoRecord>('gallery', setGallery),
      subscribeAdminCollection<SiteContentRecord>('siteContent', setSiteContent),
      subscribePublicSettings(setSettings),
    ];

    if (staffUser.role === 'owner') {
      unsubs.push(
        subscribeAdminCollection<StaffAccount>('staff', setStaffList),
        subscribeAdminCollection<AuditEventRecord>('auditEvents', setAuditEvents),
        subscribeOperationsSettings(setOperationsSettings),
      );
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [staffUser.role, staffUser.uid, staffUser.assignedTrainerId]);

  const newEnquiryCount = enquiries.filter((e) => e.status === 'New').length;

  const handleSelectTab = (tab: AdminTabId) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-white/10 bg-[#111111]">
        <div className="p-6 border-b border-white/10">
          <p className="text-xs font-semibold tracking-wider text-[#FF5A1F] uppercase">
            {staffUser.role === 'owner'
              ? 'Owner Console'
              : staffUser.role === 'staff'
              ? 'Front Desk Console'
              : 'Trainer Console'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-wide text-white">
            ASSURE FITNESS
          </h1>
        </div>

        <nav aria-label="Admin sections" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full min-h-[42px] flex items-center justify-between gap-3 rounded-md px-3.5 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#FF5A1F] text-white'
                    : 'text-[#A1A1AA] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'enquiries' && newEnquiryCount > 0 && (
                  <span
                    className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-black/25 text-white' : 'bg-[#FF5A1F]/15 text-[#FF5A1F]'
                    }`}
                  >
                    {newEnquiryCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-white truncate">
              {staffUser.displayName}
            </p>
            <p className="text-[11px] text-[#A1A1AA] truncate">
              {staffUser.email} · {staffUser.role.toUpperCase()}
            </p>
          </div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigatePublic();
            }}
            className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-md border border-white/15 bg-[#080808] px-3 text-xs font-medium text-white hover:border-[#FF5A1F]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View Public Website</span>
          </a>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-md border border-white/10 bg-[#080808] px-3 text-xs font-medium text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#111111] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-wider text-[#FF5A1F] uppercase">
            {staffUser.role} Console
          </p>
          <h1 className="font-display text-xl font-bold text-white">ASSURE FITNESS</h1>
        </div>
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close admin menu' : 'Open admin menu'}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="h-10 w-10 inline-flex items-center justify-center rounded-md border border-white/15 bg-[#080808] text-white cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-white/10 bg-[#111111] p-4 space-y-1">
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full min-h-[42px] flex items-center justify-between gap-3 rounded-md px-3 text-sm font-medium cursor-pointer ${
                  isActive ? 'bg-[#FF5A1F] text-white' : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'enquiries' && newEnquiryCount > 0 && (
                  <span className="text-xs font-bold tabular-nums">{newEnquiryCount}</span>
                )}
              </button>
            );
          })}
          <div className="pt-3 mt-3 border-t border-white/10 flex gap-2">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePublic();
              }}
              className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-md border border-white/15 bg-[#080808] text-xs font-medium text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Public Site</span>
            </a>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-[#080808] text-xs font-medium text-[#A1A1AA] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {!isOnline && (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
            >
              <WifiOff className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <span>
                You are currently offline. Cached records remain visible, and Firestore desk
                updates will synchronize automatically when connectivity resumes.
              </span>
            </div>
          )}

          {activeTab === 'overview' && staffUser.role !== 'trainer' && (
            <OverviewTab
              members={members}
              enquiries={enquiries}
              payments={payments}
              siteContent={siteContent}
              onNavigateTab={(tab) => setActiveTab(tab as AdminTabId)}
            />
          )}
          {activeTab === 'roster' && staffUser.role === 'trainer' && (
            <TrainerRosterTab members={members} staffUser={staffUser} />
          )}
          {activeTab === 'members' && staffUser.role !== 'trainer' && (
            <MembersTab
              members={members}
              plans={plans}
              payments={payments}
              trainers={trainers}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'memberships' && staffUser.role !== 'trainer' && (
            <MembershipsTab
              memberships={memberships}
              members={members}
              plans={plans}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'attendance' && (
            <AttendanceTab
              attendance={attendance}
              members={members}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'plans' && staffUser.role !== 'trainer' && (
            <PlansTab plans={plans} members={members} staffUser={staffUser} />
          )}
          {activeTab === 'enquiries' && staffUser.role !== 'trainer' && (
            <EnquiriesTab
              enquiries={enquiries}
              plans={plans}
              settings={settings}
              staffUser={staffUser}
              onMemberConverted={() => setActiveTab('members')}
            />
          )}
          {activeTab === 'trainers' && staffUser.role !== 'trainer' && (
            <TrainersTab
              trainers={trainers}
              staffList={staffList}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'payments' && staffUser.role !== 'trainer' && (
            <PaymentsTab
              payments={payments}
              members={members}
              plans={plans}
              memberships={memberships}
              settings={settings}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'gallery' && staffUser.role !== 'trainer' && (
            <GalleryTab gallery={gallery} staffUser={staffUser} />
          )}
          {activeTab === 'content' && staffUser.role !== 'trainer' && (
            <ContentApprovalTab siteContent={siteContent} staffUser={staffUser} />
          )}
          {activeTab === 'staff' && staffUser.role === 'owner' && (
            <StaffTab
              staffList={staffList}
              trainers={trainers}
              staffUser={staffUser}
            />
          )}
          {activeTab === 'audit' && staffUser.role === 'owner' && (
            <AuditLogTab auditEvents={auditEvents} />
          )}
          {activeTab === 'settings' && staffUser.role === 'owner' && (
            <SettingsTab
              settings={settings}
              operationsSettings={operationsSettings}
              staffUser={staffUser}
            />
          )}
        </div>
      </main>
    </div>
  );
}

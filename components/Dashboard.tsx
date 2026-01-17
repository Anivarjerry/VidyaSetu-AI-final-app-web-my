
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardData, LoginRequest, Role, PeriodData, ParentHomework, SchoolSummary, SchoolUser } from '../types';
import { fetchDashboardData, submitPeriodData, updateParentHomeworkStatus, getISTDate, updateVehicleLocation, fetchSchoolSummary, fetchSchoolUserList } from '../services/dashboardService';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { SkeletonSchoolCard } from './Skeletons';
import { ProfileView } from './ProfileView';
import { SchoolInfoCard } from './SchoolInfoCard';
import { PeriodModal } from './PeriodModal';
import { AttendanceModal } from './AttendanceModal';
import { ParentHomeworkModal } from './ParentHomeworkModal';
import { HomeworkListModal } from './HomeworkListModal';
import { SettingsModal, AboutModal, HelpModal } from './MenuModals';
import { NoticeModal } from './NoticeModal';
import { NoticeListModal } from './NoticeListModal';
import { AnalyticsModal } from './AnalyticsModal';
import { HomeworkAnalyticsModal } from './HomeworkAnalyticsModal';
import { TransportTrackerModal } from './TransportTrackerModal';
import { LeaveRequestModal, StaffLeaveManagementModal, StudentLeaveRequestModal } from './LeaveModals';
import { TeacherHistoryModal } from './TeacherHistoryModal';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { ChevronRight, CheckCircle2, RefreshCw, UserCheck, Bell, BarChart2, BookOpen, MapPin, Truck, CalendarRange, Play, Square, Loader2, Megaphone, School as SchoolIcon, Sparkles, User, Smartphone, History, Lock, AlertCircle, Bot, X } from 'lucide-react';
import { SubscriptionModal } from './SubscriptionModal';
import { Modal } from './Modal';
import { AIChatModal } from './AIChatModal';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface DashboardProps {
  credentials: LoginRequest;
  role: Role;
  userName?: string;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ credentials, role, userName, onLogout }) => {
  const { t } = useThemeLanguage();
  const [currentView, setCurrentView] = useState<'home' | 'profile'>('home');

  // Navigation Stacks
  const [principalStack, setPrincipalStack] = useState<string[]>([]);
  const [teacherStack, setTeacherStack] = useState<string[]>([]);
  const [parentStack, setParentStack] = useState<string[]>([]); 

  // Combined Back Handler for all modals and stacks
  const isAnyModalOpen = principalStack.length > 0 || teacherStack.length > 0 || parentStack.length > 0;
  
  useModalBackHandler(isAnyModalOpen, () => {
    if (principalStack.length > 0) setPrincipalStack(prev => prev.slice(0, -1));
    if (teacherStack.length > 0) setTeacherStack(prev => prev.slice(0, -1));
    if (parentStack.length > 0) setParentStack(prev => prev.slice(0, -1));
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [isSchoolActive, setIsSchoolActive] = useState(true);
  const [isUserActive, setIsUserActive] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showLockPopup, setShowLockPopup] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedHomework, setSelectedHomework] = useState<ParentHomework | null>(null);
  const [activeMenuModal, setActiveMenuModal] = useState<'settings' | 'about' | 'help' | null>(null);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isNoticeListOpen, setIsNoticeListOpen] = useState(false);
  const [isSchoolDetailOpen, setIsSchoolDetailOpen] = useState(false);
  const [schoolSummary, setSchoolSummary] = useState<SchoolSummary | null>(null);
  const [loadingSchoolSummary, setLoadingSchoolSummary] = useState(false);

  // Sync Data Logic
  const syncDashboard = useCallback(async (targetId?: string) => {
    try {
      const res = await fetchDashboardData(credentials.school_id, credentials.mobile, role, credentials.password, targetId);
      if (res) {
        setData(res);
        setIsSchoolActive(res.school_subscription_status === 'active');
        setIsUserActive(res.subscription_status === 'active');
        setInitialLoading(false);
      }
    } catch (e) {
      setInitialLoading(false);
    }
  }, [credentials, role]);

  // Fix: useEffect effect callback must return void or a cleanup function.
  // Using a block to prevent implicit return of the Promise from syncDashboard().
  useEffect(() => { 
    syncDashboard(); 
  }, [syncDashboard]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await syncDashboard();
    setRefreshTrigger(v => v + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSchoolCardClick = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!data?.school_db_id) return;
    setIsSchoolDetailOpen(true);
    setLoadingSchoolSummary(true);
    const summary = await fetchSchoolSummary(data.school_db_id);
    setSchoolSummary(summary);
    setLoadingSchoolSummary(false);
  };

  return (
    <div className="fixed inset-0 h-full w-full bg-[#F8FAFC] dark:bg-dark-950 flex flex-col overflow-hidden">
      <Header 
        // Fix: Explicitly wrap async call to return void
        onRefresh={() => { handleManualRefresh(); }} 
        onOpenSettings={() => setActiveMenuModal('settings')} 
        onOpenAbout={() => setActiveMenuModal('about')} 
        onOpenHelp={() => setActiveMenuModal('help')} 
        onOpenNotices={() => setIsNoticeListOpen(true)} 
        onLogout={onLogout} 
      />

      <main className="flex-1 overflow-hidden relative" style={{ marginTop: 'calc(5.5rem + env(safe-area-inset-top, 0px))', marginBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-10">
          <div className="max-w-4xl mx-auto pt-3 space-y-4">
            
            {currentView === 'home' ? (
              <>
                {/* Fix: Wrapped handleSchoolCardClick in a block to prevent returning Promise<void> on line 124 */}
                {initialLoading ? <SkeletonSchoolCard /> : <SchoolInfoCard schoolName={data?.school_name || ''} schoolCode={data?.school_code || ''} onClick={(e) => { handleSchoolCardClick(e); }} />}
                
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t('student_hub')}</h3>
                   {/* Fix: Explicitly wrap async call to return void */}
                   <button onClick={() => { handleManualRefresh(); }} disabled={isRefreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/10 text-brand-500 text-[9px] font-black uppercase">
                      <RefreshCw size={10} className={isRefreshing ? "animate-spin" : ""} /> {t('sync')}
                   </button>
                </div>

                {/* Grid of Actions based on role */}
                <div className="grid gap-3">
                  {role === 'principal' && (
                    <>
                      <ActionCard title={t('publish_notice')} icon={<Megaphone />} onClick={() => setPrincipalStack(s => [...s, 'notice'])} active={isSchoolActive} />
                      <ActionCard title={t('transport_tracking')} icon={<MapPin />} onClick={() => setPrincipalStack(s => [...s, 'transport'])} active={isSchoolActive} />
                      <ActionCard title={t('teacher_report')} icon={<BarChart2 />} onClick={() => setPrincipalStack(s => [...s, 'teacher_analytics'])} active={isSchoolActive} />
                    </>
                  )}
                  {role === 'teacher' && (
                    <>
                      <ActionCard title={t('attendance')} icon={<UserCheck />} onClick={() => setTeacherStack(s => [...s, 'attendance'])} active={isSchoolActive} />
                      <ActionCard title="Submit Homework" icon={<BookOpen />} onClick={() => setTeacherStack(s => [...s, 'homework'])} active={isSchoolActive} />
                    </>
                  )}
                  {(role === 'parent' || role === 'student') && (
                    <>
                      <ActionCard title={t('attendance_status')} icon={<UserCheck />} onClick={() => setParentStack(s => [...s, 'attendance_history'])} active={isSchoolActive} />
                      <ActionCard title={t('daily_tasks')} icon={<BookOpen />} onClick={() => setParentStack(s => [...s, 'daily_tasks'])} active={isSchoolActive && isUserActive} />
                    </>
                  )}
                </div>
              </>
            ) : (
              <ProfileView data={data} isLoading={initialLoading} onLogout={onLogout} onOpenSubscription={() => setShowPayModal(true)} onOpenHelp={() => setActiveMenuModal('help')} onOpenAbout={() => setActiveMenuModal('about')} />
            )}
          </div>
        </div>
      </main>

      <BottomNav currentView={currentView} onChangeView={setCurrentView} onOpenAIChat={() => setIsAIChatOpen(true)} />

      {/* MODALS */}
      <Modal isOpen={isSchoolDetailOpen} onClose={() => setIsSchoolDetailOpen(false)} title="INSTITUTION INFO">
         {loadingSchoolSummary ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-brand-500" /></div> : schoolSummary && (
           <div className="space-y-4 text-center">
              <h2 className="text-xl font-black uppercase text-slate-800 dark:text-white">{schoolSummary.school_name}</h2>
              <div className="grid grid-cols-2 gap-3">
                 <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl"><p className="text-[10px] font-black text-slate-400">TEACHERS</p><p className="text-xl font-black">{schoolSummary.total_teachers}</p></div>
                 <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl"><p className="text-[10px] font-black text-slate-400">STUDENTS</p><p className="text-xl font-black">{schoolSummary.total_students}</p></div>
              </div>
           </div>
         )}
      </Modal>

      <AIChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} userName={data?.user_name || 'User'} role={role} dashboardData={data} />
      <SettingsModal isOpen={activeMenuModal === 'settings'} onClose={() => setActiveMenuModal(null)} />
      <AboutModal isOpen={activeMenuModal === 'about'} onClose={() => setActiveMenuModal(null)} />
      <HelpModal isOpen={activeMenuModal === 'help'} onClose={() => setActiveMenuModal(null)} />
      <NoticeListModal isOpen={isNoticeListOpen} onClose={() => setIsNoticeListOpen(false)} schoolId={credentials.school_id} role={role} />

      {/* STACK MODALS */}
      <NoticeModal isOpen={principalStack.includes('notice')} onClose={() => setPrincipalStack(p => p.filter(x => x !== 'notice'))} credentials={credentials} />
      <AnalyticsModal isOpen={principalStack.includes('teacher_analytics')} onClose={() => setPrincipalStack(p => p.filter(x => x !== 'teacher_analytics'))} schoolCode={credentials.school_id} />
      <AttendanceModal isOpen={teacherStack.includes('attendance')} onClose={() => setTeacherStack(p => p.filter(x => x !== 'attendance'))} schoolId={data?.school_db_id || ''} teacherId={data?.user_id || ''} />
      {/* Fix: Explicitly wrap async call to return void */}
      <HomeworkListModal isOpen={parentStack.includes('daily_tasks')} onClose={() => setParentStack(p => p.filter(x => x !== 'daily_tasks'))} dashboardData={data} credentials={credentials} isSubscribed={isUserActive} onLockClick={() => setShowPayModal(true)} onViewHomework={(hw) => { setSelectedHomework(hw); setParentStack(p => [...p, 'hw_detail']); }} onRefresh={() => { handleManualRefresh(); }} isRefreshing={isRefreshing} refreshTrigger={refreshTrigger} />
    </div>
  );
};

// Reusable Small Action Card
const ActionCard = ({ title, icon, onClick, active }: any) => (
  <div onClick={active ? onClick : undefined} className={`glass-card p-5 rounded-[2.2rem] flex items-center justify-between cursor-pointer active:scale-95 transition-all ${!active ? 'opacity-50 grayscale' : ''}`}>
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 flex items-center justify-center shadow-inner">{icon}</div>
      <h4 className="font-black text-slate-800 dark:text-white uppercase text-sm">{title}</h4>
    </div>
    {active ? <ChevronRight size={18} className="text-slate-300" /> : <Lock size={16} className="text-slate-400" />}
  </div>
);

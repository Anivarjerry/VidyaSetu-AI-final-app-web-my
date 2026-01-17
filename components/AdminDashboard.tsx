
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Button } from './Button';
import { 
  School, CreditCard, Plus, Search, Calendar, UserCog, 
  Users, Trash2, ChevronRight, Check, 
  X, AlertCircle, ShieldAlert, Key, Star, Clock, MoreVertical, Settings, Info, LogOut,
  UserCheck, UserPlus, Mail, Hash, Layers, LayoutGrid, GraduationCap, MapPin, Truck,
  ShieldCheck, BookOpen, RefreshCw, Home, Zap, ArrowLeft, Loader2, MinusCircle, PlusCircle, HelpCircle, Save, Lock, Unlock, Phone, Eye, EyeOff
} from 'lucide-react';
import { Modal } from './Modal';
import { SettingsModal, AboutModal, HelpModal } from './MenuModals';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { upsertVehicle, fetchSchoolClasses, addSchoolClass, fetchClassSubjects, addClassSubject, fetchSubjectLessons, addSubjectLesson, fetchLessonHomework, addLessonHomework, updateSchoolPeriods } from '../services/dashboardService';

interface AdminDashboardProps {
  onLogout: () => void;
  userName: string;
}

// Helper to manage cache
const getCache = (key: string) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch { return null; }
};
const setCache = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, userName }) => {
  const { t } = useThemeLanguage();
  
  const [adminView, setAdminView] = useState<'home' | 'action'>(() => {
    return (window.history.state?.adminView === 'action') ? 'action' : 'home';
  });
  const [activeTab, setActiveTab] = useState<'schools' | 'users' | 'transport'>(() => {
    return window.history.state?.activeTab || 'schools';
  });

  // --- DATA STATE ---
  const [schools, setSchools] = useState<any[]>(getCache('admin_schools') || []);
  const [users, setUsers] = useState<any[]>(getCache('admin_users') || []);
  const [vehicles, setVehicles] = useState<any[]>(getCache('admin_vehicles') || []);
  
  // New States for Student-Parent Linking
  const [parentsList, setParentsList] = useState<any[]>([]);
  const [studentOptions, setStudentOptions] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- NAVIGATION STACK (Home Tab Drill Down) ---
  const [navStack, setNavStack] = useState<any[]>([]);

  // --- MODAL STATES ---
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  
  // Detail/Action Modals
  const [selectedSchoolDetails, setSelectedSchoolDetails] = useState<any>(null);
  const [schoolStats, setSchoolStats] = useState({ teachers: 0, drivers: 0, students: 0, parents: 0, principal: 'N/A' });
  const [selectedUserDetails, setSelectedUserDetails] = useState<any>(null);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<any>(null);
  
  const [deleteModalStep, setDeleteModalStep] = useState<'none' | 'auth' | 'confirm' | 'deleting'>('none');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenuModal, setActiveMenuModal] = useState<'settings' | 'about' | 'help' | null>(null);

  // Curriculum State
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState(false);
  const [currStep, setCurrStep] = useState<'select_school' | 'manage_classes' | 'manage_subjects' | 'manage_lessons' | 'manage_homework'>('select_school');
  const [currSchool, setCurrSchool] = useState<any>(null);
  const [currClass, setCurrClass] = useState<any>(null);
  const [currSubject, setCurrSubject] = useState<any>(null);
  const [currLesson, setCurrLesson] = useState<any>(null);
  const [currList, setCurrList] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [currLoading, setCurrLoading] = useState(false);

  // Dynamic Periods State
  const [isPeriodsModalOpen, setIsPeriodsModalOpen] = useState(false);
  const [selectedSchoolForPeriods, setSelectedSchoolForPeriods] = useState<any>(null);
  const [periodCount, setPeriodCount] = useState(8);
  const [updatingPeriods, setUpdatingPeriods] = useState(false);

  // Form States
  const [newSchool, setNewSchool] = useState({ name: '', school_code: '' });
  const [newUser, setNewUser] = useState({ name: '', mobile: '', password: '', role: '', school_id: '', class_name: '', student_name: '', parent_id: '', selected_student_id: '' });
  const [parentStudents, setParentStudents] = useState<{name: string, class_name: string}[]>([{name: '', class_name: ''}]);
  const [driversForSelectedSchool, setDriversForSelectedSchool] = useState<any[]>([]);
  const [newVehicle, setNewVehicle] = useState<{
    vehicle_number: string;
    vehicle_type: 'bus' | 'van' | 'auto';
    school_id: string;
    driver_id: string;
  }>({ vehicle_number: '', vehicle_type: 'bus', school_id: '', driver_id: '' });
  const [hasPrincipal, setHasPrincipal] = useState(false);
  const [checkingPrincipal, setCheckingPrincipal] = useState(false);
  
  // Deletion/Action Helpers
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string, type: 'school' | 'user' | 'vehicle'} | null>(null);
  const [expiryDate, setExpiryDate] = useState(''); 

  // --- BACK HANDLER ---
  useModalBackHandler(
    isMenuOpen || !!activeMenuModal || navStack.length > 0 || !!selectedSchoolDetails || !!selectedUserDetails || !!selectedVehicleDetails || isSchoolModalOpen || isUserModalOpen || isVehicleModalOpen || deleteModalStep !== 'none' || isCurriculumModalOpen || isPeriodsModalOpen,
    () => {
        if (activeMenuModal) setActiveMenuModal(null);
        else if (isMenuOpen) setIsMenuOpen(false);
        else if (navStack.length > 0) {
            setNavStack(prev => prev.slice(0, -1)); 
        }
        else if (isPeriodsModalOpen) {
            if (selectedSchoolForPeriods) setSelectedSchoolForPeriods(null);
            else setIsPeriodsModalOpen(false);
        }
        else if (selectedSchoolDetails) setSelectedSchoolDetails(null);
        else if (selectedUserDetails) setSelectedUserDetails(null);
        else if (selectedVehicleDetails) setSelectedVehicleDetails(null);
        else if (isSchoolModalOpen) setIsSchoolModalOpen(false);
        else if (isUserModalOpen) setIsUserModalOpen(false);
        else if (isVehicleModalOpen) setIsVehicleModalOpen(false);
        else if (deleteModalStep !== 'none') setDeleteModalStep('none');
        else if (isCurriculumModalOpen) {
            if (currStep === 'select_school') setIsCurriculumModalOpen(false);
            else if (currStep === 'manage_classes') setCurrStep('select_school');
            else if (currStep === 'manage_subjects') setCurrStep('manage_classes');
            else if (currStep === 'manage_lessons') setCurrStep('manage_subjects');
            else if (currStep === 'manage_homework') setCurrStep('manage_lessons');
        }
    }
  );

  // --- NAVIGATION HELPERS ---
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.adminView) setAdminView(e.state.adminView);
        if (e.state.activeTab) setActiveTab(e.state.activeTab);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // --- PARENT & STUDENT FETCHING FOR DROPDOWNS ---
  useEffect(() => {
      const fetchSchoolParents = async () => {
          if (newUser.school_id && newUser.role === 'student') {
              const { data } = await supabase.from('users')
                  .select('id, name, mobile')
                  .eq('school_id', newUser.school_id)
                  .eq('role', 'parent')
                  .order('name');
              setParentsList(data || []);
          } else {
              setParentsList([]);
          }
      };
      fetchSchoolParents();
  }, [newUser.school_id, newUser.role]);

  useEffect(() => {
      const fetchParentChildren = async () => {
          if (newUser.parent_id) {
              const { data } = await supabase.from('students')
                  .select('id, name, class_name')
                  .eq('parent_user_id', newUser.parent_id);
              setStudentOptions(data || []);
          } else {
              setStudentOptions([]);
          }
      };
      fetchParentChildren();
  }, [newUser.parent_id]);

  const handleAdminViewChange = (view: 'home' | 'action') => {
    if (view !== adminView) {
      window.history.pushState({ adminView: view, activeTab }, '', window.location.href);
      setAdminView(view);
      setNavStack([]);
    }
  };

  const handleTabChange = (tab: 'schools' | 'users' | 'transport') => {
    if (tab !== activeTab) {
      window.history.pushState({ adminView, activeTab: tab }, '', window.location.href);
      setActiveTab(tab);
    }
  };

  // --- DATA FETCHING ---
  const fetchData = useCallback(async (background = true) => {
    if (!background) setLoading(true);
    try {
      const { data: schoolsData } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
      if (schoolsData) {
          setSchools(schoolsData);
          setCache('admin_schools', schoolsData);
      }
      
      const { data: usersData } = await supabase
        .from('users')
        .select('*, schools(name, school_code), students!parent_user_id(id, name, class_name)')
        .order('created_at', { ascending: false });
        
      if (usersData) {
          setUsers(usersData);
          setCache('admin_users', usersData);
      }

      const { data: vehiclesData } = await supabase.from('vehicles').select('*, schools(name), users!driver_id(name, subscription_end_date)');
      if (vehiclesData) {
          const mapped = vehiclesData.map((v: any) => ({ 
              ...v, 
              school_name: v.schools?.name, 
              driver_name: v.users?.name,
              driver_sub: v.users?.subscription_end_date 
          }));
          setVehicles(mapped);
          setCache('admin_vehicles', mapped);
      }
    } catch (e) {} finally { if(!background) setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
      setIsRefreshing(true);
      await fetchData(false);
      setIsRefreshing(false);
  };

  // --- STATS & DETAIL FETCHING ---
  const fetchSchoolStats = async (schoolId: string) => {
      setSchoolStats({ teachers: 0, drivers: 0, students: 0, parents: 0, principal: 'Searching...' });
      const { count: teachers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher');
      const { count: drivers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'driver');
      const { count: parents } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'parent');
      const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId);
      const { data: principal } = await supabase.from('users').select('name').eq('school_id', schoolId).eq('role', 'principal').maybeSingle();
      
      setSchoolStats({ 
          teachers: teachers || 0, 
          drivers: drivers || 0, 
          parents: parents || 0, 
          students: students || 0, 
          principal: principal?.name || 'Not Assigned' 
      });
  };

  const openSchoolDetails = async (school: any) => {
      setSelectedSchoolDetails(school);
      setExpiryDate(school.subscription_end_date || '');
      await fetchSchoolStats(school.id);
  };

  const isUserActive = (expiry: string | null) => { if (!expiry) return false; return new Date(expiry) >= new Date(); };

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (activeTab === 'schools') return schools.filter(s => (s.name || '').toLowerCase().includes(term));
    if (activeTab === 'users') return users.filter(u => (u.name || '').toLowerCase().includes(term) || (u.mobile || '').includes(term));
    return vehicles.filter(v => (v.vehicle_number || '').toLowerCase().includes(term) || (v.driver_name || '').toLowerCase().includes(term));
  }, [schools, users, vehicles, activeTab, searchTerm]);

  // --- HELPER FOR ADDING PARENT STUDENTS ---
  const addParentStudent = () => {
      setParentStudents([...parentStudents, {name: '', class_name: ''}]);
  };
  const updateParentStudent = (index: number, field: 'name' | 'class_name', value: string) => {
      const newStudents = [...parentStudents];
      newStudents[index][field] = value;
      setParentStudents(newStudents);
  };
  const removeParentStudent = (index: number) => {
      if (parentStudents.length > 1) {
          const newStudents = [...parentStudents];
          newStudents.splice(index, 1);
          setParentStudents(newStudents);
      }
  };

  // --- ACTIONS ---
  const initiateDelete = (type: any, id: string, name: string) => { setItemToDelete({ id, name, type }); setDeleteModalStep('auth'); };
  
  const finalDelete = async () => { 
      if (!itemToDelete) return;
      setDeleteModalStep('deleting'); 
      
      try {
          // --- CASE 1: SCHOOL DELETE (Full Cascade) ---
          if (itemToDelete.type === 'school') {
              const sid = itemToDelete.id;
              // Clean dependent tables manually first to be safe, though SQL Cascade helps
              await supabase.from('daily_periods').delete().eq('school_id', sid);
              await supabase.from('attendance').delete().eq('school_id', sid);
              await supabase.from('notices').delete().eq('school_id', sid);
              await supabase.from('staff_leaves').delete().eq('school_id', sid);
              await supabase.from('student_leaves').delete().eq('school_id', sid);
              await supabase.from('bus_locations').delete().eq('school_id', sid);
              
              // Remove users and students
              await supabase.from('students').delete().eq('school_id', sid);
              await supabase.from('users').delete().eq('school_id', sid);
              await supabase.from('vehicles').delete().eq('school_id', sid);

              // Remove structure
              const { data: classes } = await supabase.from('school_classes').select('id').eq('school_id', sid);
              if (classes) await supabase.from('class_subjects').delete().in('class_id', classes.map(c => c.id));
              await supabase.from('school_classes').delete().eq('school_id', sid);

              const { error } = await supabase.from('schools').delete().eq('id', sid);
              if(error) throw error;
          } 
          
          // --- CASE 2: USER DELETE (Role Based Logic) ---
          else if (itemToDelete.type === 'user') {
              // Find the user object to check role
              const userObj = users.find(u => u.id === itemToDelete.id);
              const role = userObj?.role || 'teacher';

              if (role === 'parent') {
                  // PARENT: Delete user. SQL Cascade will delete linked students.
                  await supabase.from('users').delete().eq('id', itemToDelete.id);
                  // Note: SQL `students` -> `parent_user_id` should be ON DELETE CASCADE
              } 
              else if (role === 'student' as any) {
                  // STUDENT (User Login): Only delete the login ID from users table.
                  // The academic record in `students` table stays, but `student_user_id` becomes NULL (via SQL).
                  await supabase.from('users').delete().eq('id', itemToDelete.id);
              } 
              else if (role === 'driver') {
                  // DRIVER: Unlink vehicles first (just in case), then delete user.
                  await supabase.from('vehicles').update({ driver_id: null }).eq('driver_id', itemToDelete.id);
                  await supabase.from('users').delete().eq('id', itemToDelete.id);
              } 
              else {
                  // PRINCIPAL / TEACHER: 
                  // Delete user only. History (Attendance/Homework) stays because FKs are set to SET NULL in SQL.
                  await supabase.from('users').delete().eq('id', itemToDelete.id);
              }
          } 
          
          // --- CASE 3: VEHICLE DELETE ---
          else if (itemToDelete.type === 'vehicle') {
              // Delete vehicle only. Driver user stays.
              await supabase.from('bus_locations').delete().eq('bus_number', itemToDelete.name);
              await supabase.from('vehicles').delete().eq('id', itemToDelete.id);
          }

      } catch (error: any) {
          alert("Delete Operation Failed: " + (error.message || "Unknown Error"));
      }
      
      setDeleteModalStep('none'); 
      fetchData(); 
      setSelectedSchoolDetails(null); 
      setSelectedUserDetails(null);
      setSelectedVehicleDetails(null);
  };
  
  const handleUpdateSubscription = async (id: string, type: 'school' | 'user') => { 
      if(type === 'school') await supabase.from('schools').update({subscription_end_date: expiryDate}).eq('id', id); 
      else await supabase.from('users').update({subscription_end_date: expiryDate}).eq('id', id);
      alert("Subscription Updated");
      fetchData(); 
  };

  // --- CURRICULUM ---
  const loadCurriculumData = async () => {
    setCurrLoading(true);
    let data: any[] = [];
    if (currStep === 'select_school') data = schools;
    else if (currStep === 'manage_classes' && currSchool) data = await fetchSchoolClasses(currSchool.id);
    else if (currStep === 'manage_subjects' && currClass) data = await fetchClassSubjects(currClass.id);
    else if (currStep === 'manage_lessons' && currSubject) data = await fetchSubjectLessons(currSubject.id);
    else if (currStep === 'manage_homework' && currLesson) data = await fetchLessonHomework(currLesson.id);
    setCurrList(data);
    setCurrLoading(false);
  };

  const handleAddCurriculumItem = async () => {
    if (!newItemName) return;
    setCurrLoading(true);
    if (currStep === 'manage_classes') await addSchoolClass(currSchool.id, newItemName);
    else if (currStep === 'manage_subjects') await addClassSubject(currClass.id, newItemName);
    else if (currStep === 'manage_lessons') await addSubjectLesson(currSubject.id, newItemName);
    else if (currStep === 'manage_homework') await addLessonHomework(currLesson.id, newItemName);
    setNewItemName('');
    await loadCurriculumData();
    setCurrLoading(false);
  };

  // --- ADD FUNCTIONS ---
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchool.name || !newSchool.school_code) { alert("Enter details"); return; }
    const { error } = await supabase.from('schools').insert([{ name: newSchool.name, school_code: newSchool.school_code.toUpperCase(), is_active: true, subscription_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] }]);
    if (!error) { setIsSchoolModalOpen(false); setNewSchool({ name: '', school_code: '' }); fetchData(); }
  };
  
  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      // Ensure mobile is exactly 10 digits
      if (!/^\d{10}$/.test(newUser.mobile)) {
          alert("Mobile number must be exactly 10 digits.");
          return;
      }

      // Create the USER account first
      const { data: user, error } = await supabase.from('users').insert([{ 
          name: newUser.name, 
          mobile: newUser.mobile, 
          password: newUser.password, 
          role: newUser.role, 
          school_id: newUser.school_id, 
          subscription_end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0] 
      }]).select();
      
      if(error) { alert(error.message); return; }
      
      // Dynamic Parent Student Add
      if (newUser.role === 'parent' && user && user.length > 0) {
         for (const student of parentStudents) {
             if(student.name && student.class_name) {
                 await supabase.from('students').insert([{ 
                     school_id: newUser.school_id, 
                     name: student.name, 
                     class_name: student.class_name, 
                     parent_user_id: user[0].id 
                 }]);
             }
         }
      }
      
      // If STUDENT Role, link to existing child record
      if (newUser.role === 'student' as any && user && user.length > 0) {
         if (newUser.selected_student_id) {
             await supabase.from('students')
                .update({ student_user_id: user[0].id })
                .eq('id', newUser.selected_student_id);
         } else {
             // Fallback for direct student add without parent link (Legacy)
             await supabase.from('students').insert([{ school_id: newUser.school_id, name: newUser.name, class_name: newUser.class_name || 'Class 9', student_user_id: user[0].id, father_name: newUser.student_name }]);
         }
      }
      
      setIsUserModalOpen(false); 
      setNewUser({ name: '', mobile: '', password: '', role: '', school_id: '', class_name: '', student_name: '', parent_id: '', selected_student_id: '' }); 
      setParentStudents([{name: '', class_name: ''}]);
      fetchData();
  };

  // CHECK PRINCIPAL STATUS (MANUAL & AUTOMATIC)
  const checkPrincipalStatus = async (schoolId: string) => {
      if(!schoolId) return;
      setCheckingPrincipal(true);
      // Fetch directly from DB to get fresh status
      const { data } = await supabase.from('users').select('id').eq('school_id', schoolId).eq('role', 'principal').maybeSingle();
      setHasPrincipal(!!data);
      if(!!data && newUser.role === 'principal') {
          // Reset role if principal exists and was selected
          setNewUser(prev => ({...prev, role: ''}));
      }
      setTimeout(() => setCheckingPrincipal(false), 500);
  };

  useEffect(() => {
      if(newUser.school_id) {
          checkPrincipalStatus(newUser.school_id);
      } else {
          setHasPrincipal(false);
      }
  }, [newUser.school_id]);

  const handleSchoolSelectForVehicle = async (schoolId: string) => {
      setNewVehicle({...newVehicle, school_id: schoolId, driver_id: ''});
      if(schoolId) {
          const drivers = users.filter(u => u.school_id === schoolId && u.role === 'driver');
          setDriversForSelectedSchool(drivers);
      } else {
          setDriversForSelectedSchool([]);
      }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await upsertVehicle(newVehicle as any);
    if (success) { setIsVehicleModalOpen(false); setNewVehicle({ vehicle_number: '', vehicle_type: 'bus', school_id: '', driver_id: '' }); fetchData(); } 
    else alert("Failed");
  };

  const handleUpdatePeriods = async () => {
      if (!selectedSchoolForPeriods) return;
      setUpdatingPeriods(true);
      await updateSchoolPeriods(selectedSchoolForPeriods.id, periodCount);
      setIsPeriodsModalOpen(false);
      fetchData();
      setUpdatingPeriods(false);
  };

  const handleMenuAction = (action: () => void) => { setIsMenuOpen(false); setTimeout(action, 150); };

  // --- HOME TAB DRILL DOWN ---
  const openSummary = (type: 'total_schools' | 'total_users' | 'active_schools' | 'active_users') => {
      let data = [];
      if (type === 'total_schools') data = schools;
      else if (type === 'active_schools') data = schools.filter(s => s.is_active);
      else if (type === 'total_users') data = users;
      else if (type === 'active_users') data = users.filter(u => isUserActive(u.subscription_end_date));
      pushToStack({ type: 'summary', data: data, title: t(type), readonly: true });
  };
  const pushToStack = (view: any) => { setNavStack([...navStack, view]); };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-white dark:bg-dark-950 flex flex-col overflow-hidden transition-colors">
      
      {/* Header */}
      <header className="h-[calc(5.5rem+env(safe-area-inset-top,0px))] bg-white/80 dark:bg-dark-900/60 backdrop-blur-3xl shadow-sm z-[100] px-6 flex items-end justify-between border-b border-slate-100 dark:border-white/5 flex-shrink-0 relative pb-4 safe-padding-top">
        <div className="flex items-center gap-3"><div className="w-11 h-11 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner border border-emerald-500/10"><ShieldAlert size={26} /></div><div><h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight uppercase leading-none">VidyaSetu</h1><p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-1">System Admin</p></div></div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2.5 transition-all rounded-full active:scale-90 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 z-[110] relative"><MoreVertical size={24} /></button>
      </header>

      {isMenuOpen && (
        <>
            <div className="fixed inset-0 z-[105]" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute top-[calc(6rem+env(safe-area-inset-top,0px))] right-6 w-48 bg-white dark:bg-dark-900 rounded-[1.5rem] shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden z-[110] animate-in fade-in zoom-in-95 duration-200">
                <div className="py-2">
                    <button onClick={() => handleMenuAction(() => setActiveMenuModal('settings'))} className="w-full text-left px-5 py-3 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 uppercase tracking-widest transition-colors"><Settings size={16} /> {t('settings')}</button>
                    <button onClick={() => handleMenuAction(() => setActiveMenuModal('about'))} className="w-full text-left px-5 py-3 text-xs font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 uppercase tracking-widest transition-colors"><Info size={16} /> {t('about')}</button>
                    <div className="h-px bg-slate-100 dark:bg-white/5 my-1 mx-4"></div>
                    <button onClick={() => handleMenuAction(onLogout)} className="w-full text-left px-5 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 flex items-center gap-3 uppercase tracking-widest transition-colors"><LogOut size={16} /> {t('logout')}</button>
                </div>
            </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          
          {/* HOME VIEW */}
          {adminView === 'home' && (
            <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6 pb-20">
              {navStack.length === 0 ? (
                  <>
                    <div className="relative w-full rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-900 shadow-[0_15px_40px_-10px_rgba(16,185,129,0.3)] border border-emerald-500/20 group transition-transform duration-500 active:scale-[0.98] h-40 flex flex-col justify-center">
                        <div className="absolute top-[-40%] right-[-20%] w-[120%] h-[120%] bg-gradient-to-br from-white/10 via-transparent to-transparent rounded-full blur-[80px] pointer-events-none"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
                        <div className="relative h-full flex flex-col justify-between px-6 py-5 text-white z-10">
                        <div className="flex justify-between items-start"><div className="space-y-0.5"><p className="text-[8px] font-black text-emerald-200 uppercase tracking-[0.3em] drop-shadow-sm">System Authority</p><h2 className="text-xl font-black uppercase tracking-tighter italic drop-shadow-lg text-white">VidyaSetu AI</h2></div><div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white/90 shadow-2xl"><Key size={20} strokeWidth={1.5} /></div></div>
                        <div className="space-y-1.5"><div><p className="text-[8px] font-black text-emerald-100/60 uppercase tracking-[0.2em]">Master Controller</p><h3 className="text-lg font-black uppercase tracking-tight text-white truncate">{userName}</h3></div></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[{ label: t('total_schools'), value: schools.length, id: 'total_schools' }, { label: t('total_users'), value: users.length, id: 'total_users' }, { label: t('active_schools'), value: schools.filter(s => s.is_active).length, id: 'active_schools' }, { label: t('active_users'), value: users.filter(u => isUserActive(u.subscription_end_date)).length, id: 'active_users' }].map((stat, i) => (
                        <button key={i} onClick={() => openSummary(stat.id as any)} className="p-5 rounded-[2rem] border-2 bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10 shadow-sm min-h-[110px] flex flex-col justify-center transition-all hover:border-emerald-400 active:scale-95 text-left"><p className="text-[9px] font-black uppercase tracking-widest mb-1 text-emerald-600 opacity-70">{stat.label}</p><p className="text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">{stat.value}</p></button>
                        ))}
                    </div>

                    <div className="space-y-3">
                        <div onClick={() => { setIsCurriculumModalOpen(true); setCurrStep('select_school'); }} className="p-6 rounded-[2.5rem] bg-emerald-600 text-white shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-emerald-700">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md"><BookOpen size={32} /></div>
                                <div><h3 className="text-xl font-black uppercase leading-tight">Academic Setup</h3><p className="text-[10px] font-black text-emerald-100/60 uppercase tracking-widest mt-1">Manage Class & Subjects</p></div>
                            </div>
                            <ChevronRight size={24} />
                        </div>
                        <div onClick={() => { setIsPeriodsModalOpen(true); }} className="p-6 rounded-[2.5rem] bg-indigo-600 text-white shadow-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-indigo-700">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md"><LayoutGrid size={32} /></div>
                                <div><h3 className="text-xl font-black uppercase leading-tight">School Periods</h3><p className="text-[10px] font-black text-indigo-100/60 uppercase tracking-widest mt-1">Set Dynamic Period Counts</p></div>
                            </div>
                            <ChevronRight size={24} />
                        </div>
                    </div>
                  </>
              ) : (
                  <div className="space-y-4 premium-subview-enter">
                      <div className="flex items-center gap-2">
                          <button onClick={() => setNavStack(prev => prev.slice(0, -1))} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl active:scale-90 transition-all"><ArrowLeft size={20} /></button>
                          <h3 className="font-black text-lg uppercase dark:text-white">{navStack[navStack.length-1].title}</h3>
                      </div>
                      <div className="space-y-3">
                          {navStack[navStack.length-1].data.map((item: any) => (
                              <div key={item.id} className="p-4 bg-white dark:bg-dark-900 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm">
                                  <h4 className="font-black text-slate-800 dark:text-white uppercase">{item.name || item.vehicle_number}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.school_code || item.mobile || item.school_name}</p>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
            </div>
          )}

          {/* ACTION VIEW */}
          {adminView === 'action' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="sticky top-0 z-50 bg-white/50 dark:bg-dark-950/50 backdrop-blur-3xl pt-2 pb-6 space-y-4">
                 <div className="flex bg-slate-50 dark:bg-white/5 p-1 rounded-[2.2rem] border border-slate-100 dark:border-white/5 shadow-inner">
                   <button onClick={() => handleTabChange('schools')} className={`flex-1 py-4 rounded-[1.8rem] text-[10px] font-black uppercase transition-all ${activeTab === 'schools' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-md' : 'text-slate-400'}`}>{t('schools_tab')}</button>
                   <button onClick={() => handleTabChange('users')} className={`flex-1 py-4 rounded-[1.8rem] text-[10px] font-black uppercase transition-all ${activeTab === 'users' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-md' : 'text-slate-400'}`}>{t('users_tab')}</button>
                   <button onClick={() => handleTabChange('transport')} className={`flex-1 py-4 rounded-[1.8rem] text-[10px] font-black uppercase transition-all ${activeTab === 'transport' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-md' : 'text-slate-400'}`}>{t('transport_tab')}</button>
                 </div>
                 <div className="flex gap-3">
                   <div className="flex-1 relative"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder={t('quick_search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white dark:bg-dark-900 border border-slate-100 dark:border-white/5 rounded-3xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-800 dark:text-white" /></div>
                   <button onClick={handleSync} disabled={isRefreshing} className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-emerald-500/10 ${isRefreshing ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'}`}><RefreshCw size={24} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} /></button>
                   <button onClick={() => { if (activeTab === 'schools') setIsSchoolModalOpen(true); else if (activeTab === 'users') setIsUserModalOpen(true); else setIsVehicleModalOpen(true); }} className="px-6 h-14 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-emerald-500/10"><Plus size={24} strokeWidth={3} /></button>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-20">
                   {filteredItems.map(item => (
                       <div key={item.id} onClick={() => { 
                           if(activeTab === 'schools') openSchoolDetails(item); 
                           else if(activeTab === 'users') { setSelectedUserDetails(item); setExpiryDate(item.subscription_end_date || ''); } 
                           else if(activeTab === 'transport') { setSelectedVehicleDetails(item); } 
                       }} className="bg-white dark:bg-dark-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-lg transition-all relative cursor-pointer group active:scale-[0.98]">
                           <div className="flex justify-between items-start mb-4">
                               <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                   {activeTab === 'schools' ? <School size={24} /> : activeTab === 'users' ? <span className="font-black text-xl">{item.name?.charAt(0)}</span> : <Truck size={24} />}
                               </div>
                               <button onClick={(e) => { e.stopPropagation(); initiateDelete(activeTab === 'schools' ? 'school' : activeTab === 'users' ? 'user' : 'vehicle', item.id, item.name || item.vehicle_number); }} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                           </div>
                           <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase truncate">{item.name || item.vehicle_number}</h3>
                           
                           {/* SHOW PARENT CHILDREN COUNT IF PARENT */}
                           {activeTab === 'users' && item.role === 'parent' && (
                               <div className="mt-2 flex items-center gap-1.5 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg w-fit">
                                   <Users size={12} />
                                   <span className="text-[9px] font-black uppercase tracking-widest">{item.students?.length || 0} Children</span>
                               </div>
                           )}

                           <div className="mt-4 pt-3 border-t border-slate-50 dark:border-white/5 flex justify-between items-center">
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${activeTab === 'schools' ? (item.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600') : (activeTab === 'users' ? (isUserActive(item.subscription_end_date) ? t('active') : t('expired')) : (item.driver_name ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'))}`}>
                                   {activeTab === 'schools' ? (item.is_active ? t('active') : t('blocked')) : (activeTab === 'users' ? (isUserActive(item.subscription_end_date) ? t('active') : t('expired')) : (item.driver_name ? 'ASSIGNED' : 'NO DRIVER'))}
                               </span>
                               <div className="p-1 bg-slate-50 dark:bg-white/5 rounded-lg"><ChevronRight size={14} className="text-slate-300" /></div>
                           </div>
                       </div>
                   ))}
               </div>
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 glass-nav border-t border-slate-100 dark:border-white/5 flex flex-col items-center justify-center z-[60] safe-padding-bottom h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] transition-all duration-300 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-[320px] flex justify-around items-center h-[4.5rem] px-8 relative">
            <button onClick={() => handleAdminViewChange('home')} className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-90 w-16 group ${adminView === 'home' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'}`}><div className="relative"><Home size={28} strokeWidth={adminView === 'home' ? 2.5 : 2} className="transition-all duration-300 drop-shadow-sm" />{adminView === 'home' && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full animate-in fade-in zoom-in"></span>}</div><span className="text-[9px] font-black uppercase mt-1">Home</span></button>
            <button onClick={() => handleAdminViewChange('action')} className={`flex flex-col items-center justify-center transition-all duration-300 active:scale-90 w-16 group ${adminView === 'action' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400'}`}><div className="relative"><Zap size={28} strokeWidth={adminView === 'action' ? 2.5 : 2} className="transition-all duration-300 drop-shadow-sm" />{adminView === 'action' && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-500 rounded-full animate-in fade-in zoom-in"></span>}</div><span className="text-[9px] font-black uppercase mt-1">Action</span></button>
        </div>
      </nav>

      {/* --- ADD MODALS --- */}
      
      {/* 1. Add School */}
      <Modal isOpen={isSchoolModalOpen} onClose={() => setIsSchoolModalOpen(false)} title="ADD SCHOOL">
          <form onSubmit={handleAddSchool} className="space-y-4">
              <input type="text" placeholder="School Name" value={newSchool.name} onChange={e => setNewSchool({...newSchool, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required />
              <input type="text" placeholder="School Code (ID)" value={newSchool.school_code} onChange={e => setNewSchool({...newSchool, school_code: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required />
              <button type="submit" className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase">Create School</button>
          </form>
      </Modal>

      {/* 2. Add User (Updated with Password & Parent Logic & Validations) */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="ADD USER">
          <form onSubmit={handleAddUser} className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
              <div className="space-y-3">
                  <select value={newUser.school_id} onChange={e => setNewUser({...newUser, school_id: e.target.value, parent_id: '', selected_student_id: ''})} className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required>
                      <option value="">Select School</option>
                      {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  
                  <div className="flex gap-2 items-center">
                      <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value, parent_id: '', selected_student_id: ''})} className="flex-1 p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required>
                          <option value="">Select Role</option>
                          <option value="principal" disabled={hasPrincipal}>Principal {hasPrincipal ? '(Exists)' : ''}</option>
                          <option value="teacher">Teacher</option>
                          <option value="student">Student</option>
                          <option value="parent">Parent</option>
                          <option value="driver">Driver</option>
                      </select>
                      {/* Refresh Principal Status Button */}
                      {newUser.school_id && (
                          <button 
                              type="button" 
                              onClick={() => checkPrincipalStatus(newUser.school_id)} 
                              className={`p-3 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-emerald-500 border border-slate-200 dark:border-white/10 transition-all ${checkingPrincipal ? 'animate-spin text-emerald-500' : ''}`}
                              title="Refresh Principal Check"
                          >
                              <RefreshCw size={18} />
                          </button>
                      )}
                  </div>

                  {/* STUDENT-SPECIFIC PARENT & CHILD SELECTION */}
                  {newUser.role === 'student' && (
                      <div className="p-4 bg-brand-50/50 dark:bg-brand-500/10 rounded-2xl border border-brand-100 dark:border-brand-500/20 space-y-3">
                          <p className="text-[10px] font-black uppercase text-brand-600 tracking-widest">Link to Parent</p>
                          <select 
                              value={newUser.parent_id} 
                              onChange={e => setNewUser({...newUser, parent_id: e.target.value, selected_student_id: ''})} 
                              className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs" 
                              required
                          >
                              <option value="">Select Parent</option>
                              {parentsList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.mobile})</option>)}
                          </select>

                          <select 
                              value={newUser.selected_student_id} 
                              onChange={e => {
                                  const student = studentOptions.find(s => s.id === e.target.value);
                                  setNewUser({
                                      ...newUser, 
                                      selected_student_id: e.target.value,
                                      name: student ? student.name : '', // Auto-fill name
                                      class_name: student ? student.class_name : ''
                                  });
                              }} 
                              className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold text-xs" 
                              required
                              disabled={!newUser.parent_id}
                          >
                              <option value="">Select Child</option>
                              {studentOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class_name})</option>)}
                          </select>
                      </div>
                  )}

                  <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={newUser.name} 
                      onChange={e => setNewUser({...newUser, name: e.target.value})} 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" 
                      required 
                      readOnly={newUser.role === 'student'} // Lock name if student
                  />
                  
                  <input 
                      type="text" 
                      placeholder="Mobile (10 digits)" 
                      value={newUser.mobile} 
                      onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setNewUser({...newUser, mobile: val});
                      }} 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" 
                      required 
                  />
                  
                  <input type="text" placeholder="Set Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required />
              </div>

              {/* Dynamic Parent Logic */}
              {newUser.role === 'parent' && (
                  <div className="space-y-3 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add Children</p>
                      {parentStudents.map((child, idx) => (
                          <div key={idx} className="flex gap-2">
                              <input type="text" placeholder="Student Name" value={child.name} onChange={e => updateParentStudent(idx, 'name', e.target.value)} className="flex-1 p-2 rounded-xl text-xs font-bold border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white" />
                              <input type="text" placeholder="Class" value={child.class_name} onChange={e => updateParentStudent(idx, 'class_name', e.target.value)} className="w-20 p-2 rounded-xl text-xs font-bold border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white" />
                              {parentStudents.length > 1 && <button type="button" onClick={() => removeParentStudent(idx)} className="p-2 bg-rose-100 text-rose-500 rounded-xl"><Trash2 size={14} /></button>}
                          </div>
                      ))}
                      <button type="button" onClick={addParentStudent} className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-slate-400 text-[10px] font-black uppercase flex items-center justify-center gap-2"><UserPlus size={14} /> Add Another Child</button>
                  </div>
              )}

              <button type="submit" className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase mt-2">Register User</button>
          </form>
      </Modal>

      {/* 3. Add Vehicle Modal (Dependent Dropdowns) */}
      <Modal isOpen={isVehicleModalOpen} onClose={() => setIsVehicleModalOpen(false)} title="ADD VEHICLE">
          <form onSubmit={handleAddVehicle} className="space-y-4">
              <select value={newVehicle.school_id} onChange={e => handleSchoolSelectForVehicle(e.target.value)} className="w-full p-4 rounded-2xl border dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required>
                  <option value="">Select School</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={newVehicle.driver_id} onChange={e => setNewVehicle({...newVehicle, driver_id: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required disabled={!newVehicle.school_id}>
                  <option value="">Select Driver</option>
                  {driversForSelectedSchool.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input type="text" placeholder="Vehicle Number (RJ-19-PB-1234)" value={newVehicle.vehicle_number} onChange={e => setNewVehicle({...newVehicle, vehicle_number: e.target.value})} className="w-full p-4 rounded-2xl border dark:bg-dark-900 dark:border-white/10 text-slate-800 dark:text-white font-bold" required disabled={!newVehicle.driver_id} />
              <button type="submit" className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase" disabled={!newVehicle.vehicle_number}>Add Transport</button>
          </form>
      </Modal>

      {/* 4. DETAIL MODALS (Action Tab Interactions) */}
      
      {/* School Detail Modal */}
      <Modal isOpen={!!selectedSchoolDetails} onClose={() => setSelectedSchoolDetails(null)} title="SCHOOL DETAILS">
          {selectedSchoolDetails && (
              <div className="space-y-5">
                  <div className="p-5 bg-emerald-50 dark:bg-brand-500/10 rounded-[2rem] border border-emerald-100 dark:border-white/10">
                      <h3 className="font-black uppercase text-xl leading-tight text-slate-800 dark:text-white">{selectedSchoolDetails.name}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {selectedSchoolDetails.school_code}</p>
                      
                      <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="bg-white dark:bg-dark-900 p-3 rounded-2xl text-center"><p className="text-[8px] uppercase text-slate-400 font-black">Teachers</p><p className="text-xl font-black text-emerald-600">{schoolStats.teachers}</p></div>
                          <div className="bg-white dark:bg-dark-900 p-3 rounded-2xl text-center"><p className="text-[8px] uppercase text-slate-400 font-black">Students</p><p className="text-xl font-black text-indigo-600">{schoolStats.students}</p></div>
                          <div className="bg-white dark:bg-dark-900 p-3 rounded-2xl text-center"><p className="text-[8px] uppercase text-slate-400 font-black">Drivers</p><p className="text-xl font-black text-orange-600">{schoolStats.drivers}</p></div>
                          <div className="bg-white dark:bg-dark-900 p-3 rounded-2xl text-center"><p className="text-[8px] uppercase text-slate-400 font-black">Parents</p><p className="text-xl font-black text-brand-600">{schoolStats.parents}</p></div>
                      </div>
                      <div className="mt-3 text-center bg-white/50 dark:bg-white/5 p-2 rounded-xl border border-dashed border-slate-300 dark:border-white/10"><p className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">Principal: {schoolStats.principal}</p></div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Update Subscription</label>
                      <div className="flex gap-2">
                          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="flex-1 p-3 rounded-2xl border border-slate-200 dark:bg-dark-900 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-white" />
                          <button onClick={() => handleUpdateSubscription(selectedSchoolDetails.id, 'school')} className="px-4 bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-md"><RefreshCw size={14} /></button>
                      </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-3">
                      <button onClick={() => initiateDelete('school', selectedSchoolDetails.id, selectedSchoolDetails.name)} className="w-full py-4 rounded-[1.8rem] font-black uppercase text-xs bg-rose-500 text-white shadow-xl shadow-rose-500/20 active:scale-95 transition-all">DELETE SCHOOL PERMANENTLY</button>
                  </div>
              </div>
          )}
      </Modal>

      {/* User Detail Modal (Updated with Phone, Pass, School Code, Children) */}
      <Modal isOpen={!!selectedUserDetails} onClose={() => setSelectedUserDetails(null)} title="USER PROFILE">
          {selectedUserDetails && (
              <div className="space-y-5">
                  <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10 text-center relative overflow-hidden">
                      <div className="w-20 h-20 bg-white dark:bg-dark-900 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black text-slate-300 shadow-inner">{selectedUserDetails.name.charAt(0)}</div>
                      <h3 className="font-black uppercase text-lg text-slate-800 dark:text-white">{selectedUserDetails.name}</h3>
                      <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest px-3 py-1 bg-brand-500/10 rounded-full inline-block mt-1">{selectedUserDetails.role}</p>
                      
                      {/* Detailed Credentials Block */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-left bg-white dark:bg-dark-900 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
                          <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black">Mobile</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-white">{selectedUserDetails.mobile}</p>
                          </div>
                          <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black">Password</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-white">{selectedUserDetails.password || '****'}</p>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-50 dark:border-white/5">
                              <p className="text-[8px] text-slate-400 uppercase font-black">School Name & Code</p>
                              <p className="text-xs font-bold text-slate-700 dark:text-white">{selectedUserDetails.schools?.name}</p>
                              <p className="text-[10px] font-bold text-slate-400">{selectedUserDetails.schools?.school_code}</p>
                          </div>
                      </div>
                  </div>
                  
                  {/* PARENT SPECIFIC: SHOW CHILDREN */}
                  {selectedUserDetails.role === 'parent' && selectedUserDetails.students && selectedUserDetails.students.length > 0 && (
                      <div className="bg-brand-50/50 dark:bg-brand-500/10 p-4 rounded-[2rem] border border-brand-100 dark:border-brand-500/10">
                          <p className="text-[9px] font-black text-brand-600 uppercase tracking-widest mb-2 pl-1">Linked Students</p>
                          <div className="space-y-2">
                              {selectedUserDetails.students.map((child: any) => (
                                  <div key={child.id} className="flex justify-between items-center bg-white dark:bg-dark-900 p-3 rounded-xl border border-brand-100 dark:border-white/5">
                                      <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">{child.name}</span>
                                      <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-lg">{child.class_name}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Subscription Context</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                          {(selectedUserDetails.role === 'parent' || selectedUserDetails.role === 'student') ? "Linked to Personal Plan" : "Linked to School Principal Plan"}
                      </p>
                      <div className="mt-3 flex gap-2">
                          <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="flex-1 p-2 rounded-xl border border-slate-200 dark:bg-dark-950 dark:border-white/10 text-[10px] font-bold text-slate-800 dark:text-white" />
                          <button onClick={() => handleUpdateSubscription(selectedUserDetails.id, 'user')} className="px-3 bg-brand-500 text-white rounded-xl font-black text-[9px] uppercase">Update</button>
                      </div>
                  </div>

                  <button onClick={() => initiateDelete('user', selectedUserDetails.id, selectedUserDetails.name)} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-rose-500 text-white shadow-lg">Delete User</button>
              </div>
          )}
      </Modal>

      {/* Vehicle Detail Modal */}
      <Modal isOpen={!!selectedVehicleDetails} onClose={() => setSelectedVehicleDetails(null)} title="TRANSPORT INFO">
          {selectedVehicleDetails && (
              <div className="space-y-5">
                  <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl text-center relative overflow-hidden">
                      <div className="relative z-10">
                          <Truck size={32} className="mx-auto mb-2 text-brand-400" />
                          <h3 className="font-black uppercase text-2xl tracking-tight">{selectedVehicleDetails.vehicle_number}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Bus / Van</p>
                      </div>
                  </div>

                  <div className="space-y-3">
                      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Driver</span>
                          <span className="font-black text-sm uppercase dark:text-white">{selectedVehicleDetails.driver_name || 'N/A'}</span>
                      </div>
                      <div 
                          onClick={() => {
                              // Find school object and open details
                              const linkedSchool = schools.find(s => s.name === selectedVehicleDetails.school_name);
                              if(linkedSchool) { setSelectedVehicleDetails(null); openSchoolDetails(linkedSchool); }
                          }}
                          className="flex justify-between items-center p-4 bg-brand-50/50 dark:bg-brand-500/10 rounded-2xl border border-brand-100 dark:border-brand-500/20 cursor-pointer active:scale-95 transition-all"
                      >
                          <span className="text-[10px] font-black text-brand-600/70 uppercase">Linked School</span>
                          <div className="flex items-center gap-1 text-brand-700 dark:text-brand-400">
                              <span className="font-black text-xs uppercase underline">{selectedVehicleDetails.school_name}</span>
                              <ChevronRight size={14} />
                          </div>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                          <span className="text-[10px] font-black text-slate-400 uppercase">Subs. Link</span>
                          <span className="font-black text-xs uppercase dark:text-white">{selectedVehicleDetails.driver_sub ? new Date(selectedVehicleDetails.driver_sub).toLocaleDateString() : 'N/A'}</span>
                      </div>
                  </div>

                  <button onClick={() => initiateDelete('vehicle', selectedVehicleDetails.id, selectedVehicleDetails.vehicle_number)} className="w-full py-4 rounded-2xl font-black uppercase text-xs bg-rose-500 text-white shadow-lg">Delete Vehicle</button>
              </div>
          )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalStep !== 'none'} onClose={() => setDeleteModalStep('none')} title="CONFIRM DELETE">
          <div className="space-y-4">
              <p className="text-sm font-bold text-rose-600">Are you sure you want to delete "{itemToDelete?.name}"? <br/> This cannot be undone.</p>
              {itemToDelete?.type === 'school' && <p className="text-xs font-bold text-slate-500 bg-slate-100 p-3 rounded-xl border border-slate-200">Warning: This will cascade delete ALL Users, Students, and Vehicles associated with this school.</p>}
              
              {deleteModalStep === 'auth' && (
                  <button onClick={() => setDeleteModalStep('confirm')} className="w-full py-3 bg-rose-500 text-white rounded-xl font-black uppercase">Yes, Proceed</button>
              )}
              
              {deleteModalStep === 'confirm' && (
                  <button onClick={finalDelete} className="w-full py-3 bg-rose-600 text-white rounded-xl font-black uppercase">Confirm Delete</button>
              )}

              {deleteModalStep === 'deleting' && (
                  <div className="w-full py-6 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-rose-500" size={32} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Removing Records...</p>
                  </div>
              )}
          </div>
      </Modal>

      {/* Curriculum Modal */}
      <Modal isOpen={isCurriculumModalOpen} onClose={() => setIsCurriculumModalOpen(false)} title="ACADEMIC CONFIG">
         <div className="flex flex-col h-[70vh]">
            {currStep === 'select_school' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Step 1: Select Institution</p>
                        <button 
                            onClick={() => fetchData(false)} 
                            disabled={loading}
                            className={`p-2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-emerald-500 transition-all active:scale-90 ${loading ? 'animate-spin text-emerald-500' : ''}`}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                        {schools.map(s => (
                            <button key={s.id} onClick={() => { setCurrSchool(s); setCurrStep('manage_classes'); loadCurriculumData(); }} className="w-full p-5 bg-white dark:bg-dark-900 border border-slate-100 dark:border-white/5 rounded-[2rem] text-left active:scale-95 transition-all shadow-sm flex justify-between items-center group">
                                <span className="font-black text-slate-800 dark:text-white uppercase">{s.name}</span>
                                <ChevronRight className="text-slate-300 group-hover:text-emerald-500" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {currStep !== 'select_school' && (
                <div className="flex flex-col h-full premium-subview-enter">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-3">
                            <button onClick={() => {
                                if(currStep === 'manage_classes') setCurrStep('select_school');
                                if(currStep === 'manage_subjects') setCurrStep('manage_classes');
                                if(currStep === 'manage_lessons') setCurrStep('manage_subjects');
                                if(currStep === 'manage_homework') setCurrStep('manage_lessons');
                            }} className="p-2 bg-slate-100 dark:bg-white/5 rounded-xl"><ArrowLeft size={18} /></button>
                            <h4 className="font-black uppercase text-sm dark:text-white tracking-widest">{currStep.replace('manage_', '')}</h4>
                        </div>
                        
                        <button 
                            onClick={loadCurriculumData} 
                            disabled={currLoading}
                            className={`p-2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-emerald-500 transition-all active:scale-90 ${currLoading ? 'animate-spin text-emerald-500' : ''}`}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Add New..." className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border-none outline-none font-bold text-xs text-slate-800 dark:text-white" />
                        <button onClick={handleAddCurriculumItem} className="p-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-xs shadow-lg active:scale-90 transition-all"><Plus size={18} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                        {currLoading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-emerald-500" /></div> : currList.length === 0 ? <p className="text-center py-10 opacity-30 text-[10px] font-black uppercase">No items found</p> : currList.map((item, i) => (
                            <div key={i} onClick={() => {
                                if(currStep === 'manage_classes') { setCurrClass(item); setCurrStep('manage_subjects'); }
                                if(currStep === 'manage_subjects') { setCurrSubject(item); setCurrStep('manage_lessons'); }
                                if(currStep === 'manage_lessons') { setCurrLesson(item); setCurrStep('manage_homework'); }
                            }} className="p-4 bg-white dark:bg-dark-900 rounded-2xl border border-slate-100 dark:border-white/5 font-bold text-xs uppercase cursor-pointer flex justify-between items-center active:scale-95 transition-all text-slate-800 dark:text-white">
                                {item.class_name || item.subject_name || item.lesson_name || item.homework_template}
                                {currStep !== 'manage_homework' && <ChevronRight size={16} className="opacity-30" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
         </div>
      </Modal>

      <Modal isOpen={isPeriodsModalOpen} onClose={() => setIsPeriodsModalOpen(false)} title="SCHOOL PERIODS">
          <div className="flex flex-col h-[70vh]">
              <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar">
                  {!selectedSchoolForPeriods ? (
                      <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select School to Configure</p>
                          {schools.map(s => (
                              <div key={s.id} onClick={() => { setSelectedSchoolForPeriods(s); setPeriodCount(s.total_periods || 8); }} className="p-5 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/5 flex items-center justify-between cursor-pointer active:scale-95 transition-all">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black uppercase shadow-inner"><School size={20} /></div>
                                      <div><p className="font-black text-xs uppercase dark:text-white">{s.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Current: {s.total_periods || 8} Periods</p></div>
                                  </div>
                                  <ChevronRight size={18} className="text-slate-300" />
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="premium-subview-enter space-y-8 py-4">
                          <button onClick={() => setSelectedSchoolForPeriods(null)} className="flex items-center gap-2 text-indigo-500 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={14} /> Back to Schools</button>
                          
                          <div className="p-8 bg-indigo-50 dark:bg-indigo-500/5 rounded-[3rem] border border-indigo-100 dark:border-indigo-500/10 text-center">
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-2">School Configuration</p>
                              <h4 className="text-xl font-black uppercase text-slate-800 dark:text-indigo-400 truncate mb-8">{selectedSchoolForPeriods.name}</h4>
                              
                              <div className="flex items-center justify-center gap-8 mb-8">
                                  <button onClick={() => setPeriodCount(Math.max(1, periodCount - 1))} className="w-14 h-14 rounded-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-rose-500 shadow-md active:scale-90 transition-all"><MinusCircle size={28} /></button>
                                  <div className="flex flex-col">
                                      <span className="text-6xl font-black text-slate-800 dark:text-white tabular-nums">{periodCount}</span>
                                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Periods</span>
                                  </div>
                                  <button onClick={() => setPeriodCount(Math.min(15, periodCount + 1))} className="w-14 h-14 rounded-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-emerald-500 shadow-md active:scale-90 transition-all"><PlusCircle size={28} /></button>
                              </div>

                              <p className="text-[10px] font-bold italic text-slate-400">"This will update the Homework and Daily Task portals for all users of this school instantly."</p>
                          </div>
                          
                          <button 
                              onClick={handleUpdatePeriods} 
                              disabled={updatingPeriods}
                              className="w-full py-6 rounded-[2rem] bg-indigo-600 text-white font-black uppercase text-[10px] shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
                          >
                              {updatingPeriods ? <Loader2 className="animate-spin mx-auto" /> : 'SAVE CONFIGURATION'}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      </Modal>

      <SettingsModal isOpen={activeMenuModal === 'settings'} onClose={() => setActiveMenuModal(null)} />
      <AboutModal isOpen={activeMenuModal === 'about'} onClose={() => setActiveMenuModal(null)} />
      <HelpModal isOpen={activeMenuModal === 'help'} onClose={() => setActiveMenuModal(null)} />

    </div>
  );
};

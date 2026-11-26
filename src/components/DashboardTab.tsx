import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  ListChecks,
  User as UserIcon,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  AttendanceByMonth,
  ClassSettings,
  Student,
  getMonthKey,
} from '../types/gradebook';
import { UserProfileData } from '../services/userProfile';
import { computeDailyAttendanceSummary } from '../utils/calculations';
import { toKhmerDigits } from '../utils/khmerCalendar';
import { UserAvatar } from './UserProfileMenu';

type NavTabTarget = 'attendance' | 'monthly' | 'semester' | 'roster';

interface DashboardTabProps {
  user: User | null;
  userProfile: UserProfileData | null;
  settings: ClassSettings;
  students: Student[];
  attendanceByMonth: AttendanceByMonth;
  onNavigateTab: (tab: NavTabTarget) => void;
  onEditProfile: () => void;
  onSignIn: () => void;
}

function getKhmerTimeGreeting(hour: number): string {
  if (hour >= 4 && hour < 12) return 'អរុណសួស្តី';
  if (hour >= 12 && hour < 17) return 'ទិវាសួស្តី';
  return 'សាយ័ន្តសួស្តី';
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  user,
  userProfile,
  settings,
  students,
  attendanceByMonth,
  onNavigateTab,
  onEditProfile,
  onSignIn,
}) => {
  const quickScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const now = useMemo(() => new Date(), []);
  const greeting = getKhmerTimeGreeting(now.getHours());
  const todayIsoDate = formatLocalIsoDate(now);

  const teacherDisplayName =
    userProfile?.displayName?.trim() ||
    settings.teacherName?.trim() ||
    user?.displayName?.trim() ||
    (user ? 'គណនីគ្រូបន្ទុកថ្នាក់' : 'សូមស្វាគមន៍');

  const schoolDisplayName = settings.schoolName?.trim() || 'សាលាបឋមសិក្សា';
  const classDisplayName = settings.className?.trim() || 'មិនទាន់កំណត់ថ្នាក់';

  const femaleCount = useMemo(
    () => students.filter((s) => s.gender === 'ស្រី').length,
    [students]
  );

  const todaySummary = useMemo(() => {
    const monthKey = getMonthKey(now.getFullYear(), now.getMonth() + 1);
    const todayAttendanceMap = attendanceByMonth[monthKey] || {};
    return computeDailyAttendanceSummary(
      students,
      todayAttendanceMap,
      now.getDate()
    );
  }, [attendanceByMonth, now, students]);

  const attendanceRate = useMemo(() => {
    if (students.length === 0) return 0;
    return (todaySummary.present / students.length) * 100;
  }, [students.length, todaySummary.present]);

  const updateScrollEdges = useCallback(() => {
    const el = quickScrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = quickScrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    const onScroll = () => updateScrollEdges();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateScrollEdges());
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [updateScrollEdges]);

  const scrollQuickAccess = (dir: 'left' | 'right') => {
    const el = quickScrollerRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.65));
    el.scrollBy({
      left: dir === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  // Donut progress metrics
  const ringRadius = 56;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clampedRate = Math.min(100, Math.max(0, attendanceRate));
  const strokeDashoffset =
    ringCircumference * (1 - clampedRate / 100);

  const quickActions: Array<{
    key: NavTabTarget;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    gradientClass: string;
    shadowClass: string;
  }> = [
    {
      key: 'attendance',
      label: 'អវត្តមានសិស្ស',
      Icon: UserCheck,
      gradientClass:
        'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
      shadowClass: 'shadow-blue-600/20 hover:shadow-blue-600/30',
    },
    {
      key: 'monthly',
      label: 'ពិន្ទុប្រឡងប្រចាំខែ',
      Icon: ListChecks,
      gradientClass:
        'bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-600',
      shadowClass: 'shadow-emerald-600/20 hover:shadow-emerald-600/30',
    },
    {
      key: 'semester',
      label: 'ពិន្ទុប្រឡងឆមាស',
      Icon: ClipboardList,
      gradientClass:
        'bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600',
      shadowClass: 'shadow-orange-600/20 hover:shadow-orange-600/30',
    },
    {
      key: 'roster',
      label: 'ព័ត៌មានគ្រូ/សិស្ស',
      Icon: Users,
      gradientClass:
        'bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600',
      shadowClass: 'shadow-violet-600/20 hover:shadow-violet-600/30',
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Top Hero Card: Teacher Greeting Banner + School Metadata */}
      <section className="surface-card rounded-2xl overflow-hidden">
        {/* Deep Blue Angkor Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#13397d] via-[#1a499e] to-[#235bc2] dark:from-[#0e2757] dark:via-[#15397a] dark:to-[#1d4ba1] px-4 sm:px-6 py-4 sm:py-5">
          {/* Subtle Angkor Wat Silhouette Backdrop */}
          <svg
            aria-hidden="true"
            viewBox="0 0 420 120"
            fill="none"
            className="pointer-events-none absolute right-0 bottom-0 h-full w-auto max-w-[75%] text-white/15"
            preserveAspectRatio="xMaxYMax slice"
          >
            <circle cx="315" cy="48" r="24" fill="currentColor" opacity="0.28" />
            <circle cx="315" cy="48" r="38" stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" strokeDasharray="3 4" />
            <path
              d="M0 120V102H48V90H88V78H126V60L136 42L146 60V78H182V50L192 22L202 50V78H228V38L240 12L252 38V78H278V50L288 22L298 50V78H334V60L344 42L354 60V78H392V92H420V120H0Z"
              fill="currentColor"
            />
            <path
              d="M150 120V92H172V120M228 120V86H252V120M306 120V92H328V120"
              fill="currentColor"
              opacity="0.45"
            />
          </svg>

          <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
            <button
              type="button"
              onClick={user ? onEditProfile : onSignIn}
              title={user ? 'កែប្រែព័ត៌មានគណនី' : 'ចូលគណនី'}
              className="shrink-0 rounded-full ring-2 ring-white/85 shadow-md hover:ring-blue-200 transition-all cursor-pointer active:scale-95"
            >
              {user ? (
                <UserAvatar
                  user={user}
                  sizeClass="w-15 h-15 sm:w-18 sm:h-18"
                  textClass="text-xl"
                />
              ) : (
                <div className="w-15 h-15 sm:w-18 sm:h-18 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center text-white">
                  <UserIcon className="w-7 h-7" />
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-blue-100/95">
                {greeting}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate mt-0.5">
                {teacherDisplayName}
              </h2>
            </div>
          </div>
        </div>

        {/* School & Class Info Section */}
        <div className="relative overflow-hidden px-4 sm:px-6 py-4 bg-white dark:bg-slate-900/95">
          {/* Subtle Khmer Kbach corner flourish on right */}
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="pointer-events-none absolute right-1 bottom-0 w-24 h-24 text-amber-700/10 dark:text-amber-300/10"
            fill="currentColor"
          >
            <path d="M90 12L102 24L90 36L78 24ZM66 36L78 48L66 60L54 48ZM90 60L102 72L90 84L78 72ZM66 84L78 96L66 108L54 96ZM102 48L114 60L102 72L90 60Z" />
          </svg>

          <div className="relative z-10">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              សាលារៀន
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {schoolDisplayName}
            </p>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {classDisplayName}
              </span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                សិស្សសរុប {toKhmerDigits(students.length)} នាក់ / ស្រី{' '}
                {toKhmerDigits(femaleCount)} នាក់
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Access Section */}
      <section aria-labelledby="quick-access-heading">
        <h3
          id="quick-access-heading"
          className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          ការចូលប្រើរហ័ស
        </h3>

        <div className="relative">
          <div
            ref={quickScrollerRef}
            className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory pb-1 md:pb-0"
          >
            {quickActions.map(({ key, label, Icon, gradientClass, shadowClass }) => (
              <button
                key={key}
                type="button"
                onClick={() => onNavigateTab(key)}
                className={`group relative overflow-hidden shrink-0 w-[39%] min-w-[132px] sm:w-[31%] md:w-auto snap-start rounded-2xl px-3 py-5 sm:py-6 flex flex-col items-center justify-center gap-2.5 text-white shadow-md ${gradientClass} ${shadowClass} hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer`}
              >
                {/* Decorative subtle corner pattern */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 64 64"
                  className="pointer-events-none absolute -right-1 -top-1 w-14 h-14 text-white/15"
                  fill="currentColor"
                >
                  <path d="M40 8L48 16L40 24L32 16ZM24 24L32 32L24 40L16 32ZM48 24L56 32L48 40L40 32Z" />
                </svg>

                <div className="relative z-10 w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="relative z-10 text-xs sm:text-sm font-bold text-center leading-snug whitespace-nowrap">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Mobile horizontal scroll indicators */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollQuickAccess('left')}
              aria-label="រំកិលទៅឆ្វេង"
              className="md:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollQuickAccess('right')}
              aria-label="រំកិលទៅស្តាំ"
              className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* 3. Today's Attendance Summary Card */}
      <section className="surface-card rounded-2xl p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            ការចុះអវត្តមានថ្ងៃនេះ
          </h3>
          <span className="font-mono-num text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            {todayIsoDate}
          </span>
        </div>

        {/* Center Donut Ring */}
        <div className="my-5 flex items-center justify-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg
              viewBox="0 0 140 140"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label={`អត្រាវត្តមាន ${attendanceRate.toFixed(1)}%`}
            >
              <circle
                cx="70"
                cy="70"
                r={ringRadius}
                fill="none"
                strokeWidth="12"
                className="stroke-slate-200 dark:stroke-slate-800"
              />
              {clampedRate > 0 && (
                <circle
                  cx="70"
                  cy="70"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  className="stroke-emerald-500 dark:stroke-emerald-400 transition-all duration-500 ease-out"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono-num text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
                {attendanceRate.toFixed(1)}%
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
                អត្រាវត្តមាន
              </span>
            </div>
          </div>
        </div>

        {/* 2x2 Attendance Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Students */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-blue-50/75 dark:bg-blue-950/35 border border-blue-200/80 dark:border-blue-800/50">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                សិស្សសរុប
              </p>
              <p className="font-mono-num text-lg font-bold text-blue-700 dark:text-blue-200 leading-tight mt-0.5">
                {students.length}
              </p>
            </div>
          </div>

          {/* Present */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-emerald-50/75 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/50">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                មករៀន
              </p>
              <p className="font-mono-num text-lg font-bold text-emerald-700 dark:text-emerald-200 leading-tight mt-0.5">
                {todaySummary.present}
              </p>
            </div>
          </div>

          {/* Excused */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-amber-50/75 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/50">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock3 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                ច្បាប់
              </p>
              <p className="font-mono-num text-lg font-bold text-amber-700 dark:text-amber-200 leading-tight mt-0.5">
                {todaySummary.excused}
              </p>
            </div>
          </div>

          {/* Unexcused */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-rose-50/75 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-800/50">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                អត់ច្បាប់
              </p>
              <p className="font-mono-num text-lg font-bold text-rose-700 dark:text-rose-200 leading-tight mt-0.5">
                {todaySummary.unexcused}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

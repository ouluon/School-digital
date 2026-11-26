import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  Pencil,
  Search,
  Smartphone,
  Table2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { TelegramButton } from './TelegramButton';
import { AnnualHolidaysModal } from './AnnualHolidaysModal';
import { HorizontalScrollStrip } from './HorizontalScrollStrip';
import {
  CambodiaHoliday,
  CustomHolidayEntry,
  addUserCustomHolidays,
  fetchCambodiaHolidays,
  getHolidayByDate,
  getHolidaysInMonth,
  getInitialCambodiaHolidays,
  loadCachedCustomHolidays,
  mergeWithCustomHolidays,
  removeUserCustomHoliday,
  subscribeUserCustomHolidays,
} from '../services/cambodiaHolidays';
import {
  AttendanceMap,
  AttendanceMark,
  AttendanceReasonMap,
  ClassSettings,
  KHMER_MONTHS,
  RemarksMap,
  Student,
  getAttendanceMonthYear,
} from '../types/gradebook';
import {
  computeDailyAttendanceSummary,
  computeStudentAttendanceSummary,
  getMonthCalendarDays,
  getYearOptions,
} from '../utils/calculations';
import { toKhmerDigits } from '../utils/khmerCalendar';

const LEAVE_REASON_PRESETS = [
  'ធុរៈគ្រួសារ',
  'ឈឺ / ទៅពេទ្យ',
  'ពិធីបុណ្យ / ការងារផ្ទះ',
  'អាណាព្យាបាលសុំច្បាប់',
];

const KHMER_FULL_WEEKDAYS = [
  'អាទិត្យ',
  'ចន្ទ',
  'អង្គារ',
  'ពុធ',
  'ព្រហស្បតិ៍',
  'សុក្រ',
  'សៅរ៍',
] as const;

interface AttendanceTabProps {
  user: User | null;
  isLoggingIn?: boolean;
  settings: ClassSettings;
  students: Student[];
  attendance: AttendanceMap;
  attendanceReasons: AttendanceReasonMap;
  remarks: RemarksMap;
  isPreparingShare?: boolean;
  onSignIn: () => void;
  onChangeMark: (studentId: string, day: number, mark: AttendanceMark) => void;
  onChangeLeaveReason: (studentId: string, day: number, reason: string) => void;
  onClearDayAllPresent: (day: number) => void;
  onChangeMonthYear: (month: number, year: number) => void;
  onShareTelegram: () => void;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  user,
  isLoggingIn = false,
  settings,
  students,
  attendance,
  attendanceReasons,
  remarks,
  isPreparingShare = false,
  onSignIn,
  onChangeMark,
  onChangeLeaveReason,
  onClearDayAllPresent,
  onChangeMonthYear,
  onShareTelegram,
}) => {
  const { month: activeMonth, year: activeYear } = getAttendanceMonthYear(settings);

  const calendarDays = useMemo(
    () => getMonthCalendarDays(activeYear, activeMonth),
    [activeYear, activeMonth]
  );

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();
  const isCurrentMonthYear =
    todayMonth === activeMonth && todayYear === activeYear;

  const initialDay = isCurrentMonthYear ? todayDate : 1;

  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'mobile' | 'sheet'>('mobile');
  const [officialHolidays, setOfficialHolidays] = useState<CambodiaHoliday[]>(() =>
    getInitialCambodiaHolidays(activeYear)
  );
  const [customEntries, setCustomEntries] = useState<CustomHolidayEntry[]>(() =>
    loadCachedCustomHolidays(user?.uid)
  );
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isSavingCustomHoliday, setIsSavingCustomHoliday] = useState(false);
  const [deletingCustomId, setDeletingCustomId] = useState<string | null>(null);
  const [customHolidayError, setCustomHolidayError] = useState<string | null>(null);
  const [showAnnualHolidays, setShowAnnualHolidays] = useState(false);
  const [editingLeaveStudentId, setEditingLeaveStudentId] = useState<string | null>(null);
  const dayScrollerRef = useRef<HTMLDivElement>(null);

  const scrollerDays = useMemo(() => {
    if (!isCurrentMonthYear) return calendarDays;
    const todayIndex = calendarDays.findIndex((d) => d.day === todayDate);
    if (todayIndex <= 0) return calendarDays;
    return [
      ...calendarDays.slice(todayIndex),
      ...calendarDays.slice(0, todayIndex),
    ];
  }, [calendarDays, isCurrentMonthYear, todayDate]);

  useEffect(() => {
    setSelectedDay(isCurrentMonthYear ? todayDate : 1);
    if (dayScrollerRef.current) {
      dayScrollerRef.current.scrollLeft = 0;
    }
  }, [activeMonth, activeYear, isCurrentMonthYear, todayDate]);

  useEffect(() => {
    const uid = user?.uid;
    setCustomHolidayError(null);
    if (!uid) {
      setCustomEntries([]);
      return;
    }
    setCustomEntries(loadCachedCustomHolidays(uid));
    const unsub = subscribeUserCustomHolidays(
      uid,
      (entries) => {
        setCustomEntries(entries);
        setCustomHolidayError(null);
      },
      () => {
        setCustomHolidayError(
          'មិនអាចទាញថ្ងៃឈប់សម្រាកផ្ទាល់ខ្លួនពីគណនីបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត ឬការភ្ជាប់គណនី Google។'
        );
      }
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    setOfficialHolidays(getInitialCambodiaHolidays(activeYear));
    setIsLoadingHolidays(true);
    fetchCambodiaHolidays(activeYear)
      .then((list) => {
        if (active) setOfficialHolidays(list);
      })
      .finally(() => {
        if (active) setIsLoadingHolidays(false);
      });
    return () => {
      active = false;
    };
  }, [activeYear]);

  const holidays = useMemo(
    () =>
      mergeWithCustomHolidays(
        officialHolidays,
        user?.uid ? customEntries : [],
        activeYear
      ),
    [officialHolidays, customEntries, activeYear, user?.uid]
  );

  const handleRefreshHolidays = () => {
    setIsLoadingHolidays(true);
    fetchCambodiaHolidays(activeYear, true)
      .then((list) => setOfficialHolidays(list))
      .finally(() => setIsLoadingHolidays(false));
  };

  const formatCustomHolidayError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : String(err || '');
    if (raw.includes('Quota exceeded')) {
      return 'កូតាប្រើប្រាស់មូលដ្ឋានទិន្នន័យប្រចាំថ្ងៃពេញហើយ (Quota exceeded)។ សូមព្យាយាមម្តងទៀតនៅថ្ងៃស្អែក។';
    }
    if (raw.includes('the client is offline') || raw.includes('unavailable')) {
      return 'មិនអាចភ្ជាប់អ៊ីនធឺណិតទៅមូលដ្ឋានទិន្នន័យបានទេ។ សូមពិនិត្យអ៊ីនធឺណិត រួចសាកល្បងម្តងទៀត។';
    }
    if (raw.includes('Missing or insufficient permissions') || raw.includes('permission-denied')) {
      return 'មិនមានសិទ្ធិរក្សាទុកក្នុងគណនីនេះទេ។ សូមប្រាកដថាបានបញ្ជាក់អ៊ីមែលរួច ឬចូលគណនីម្តងទៀត។';
    }
    return fallback;
  };

  const handleAddCustomHoliday = async (params: {
    startDate: string;
    endDate?: string;
    title: string;
  }): Promise<boolean> => {
    if (!user?.uid) {
      setCustomHolidayError(
        'សូមចូលគណនី ឬបង្កើតគណនីជាមុនសិន ដើម្បីកត់ត្រាថ្ងៃឈប់សម្រាកតាមគណនី។'
      );
      return false;
    }
    if (!user.emailVerified) {
      setCustomHolidayError(
        'សូមបញ្ជាក់អ៊ីមែលរបស់អ្នកជាមុនសិន មុននឹងរក្សាទុកថ្ងៃឈប់សម្រាកទៅ Cloud។'
      );
      return false;
    }
    setIsSavingCustomHoliday(true);
    setCustomHolidayError(null);
    try {
      await addUserCustomHolidays(user.uid, params, customEntries);
      return true;
    } catch (err) {
      setCustomHolidayError(
        formatCustomHolidayError(
          err,
          'មិនអាចរក្សាទុកថ្ងៃឈប់សម្រាកទៅគណនីបានទេ។ សូមសាកល្បងម្តងទៀត។'
        )
      );
      return false;
    } finally {
      setIsSavingCustomHoliday(false);
    }
  };

  const handleDeleteCustomHoliday = async (id: string): Promise<void> => {
    if (!user?.uid) {
      setCustomHolidayError('សូមចូលគណនីជាមុនសិន។');
      return;
    }
    if (!user.emailVerified) {
      setCustomHolidayError('សូមបញ្ជាក់អ៊ីមែលរបស់អ្នកជាមុនសិន។');
      return;
    }
    setDeletingCustomId(id);
    setCustomHolidayError(null);
    try {
      await removeUserCustomHoliday(user.uid, id);
    } catch (err) {
      setCustomHolidayError(
        formatCustomHolidayError(
          err,
          'មិនអាចលុបថ្ងៃឈប់សម្រាកពីគណនីបានទេ។ សូមសាកល្បងម្តងទៀត។'
        )
      );
    } finally {
      setDeletingCustomId(null);
    }
  };

  const activeDay = Math.min(selectedDay, calendarDays.length);

  useEffect(() => {
    if (viewMode !== 'mobile') return;
    const container = dayScrollerRef.current;
    if (!container) return;
    const btn = container.querySelector<HTMLButtonElement>(
      `button[data-day="${activeDay}"]`
    );
    if (!btn) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const btnLeft = btnRect.left - containerRect.left + container.scrollLeft;
    const btnRight = btnLeft + btnRect.width;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (btnLeft < viewLeft) {
      container.scrollTo({ left: btnLeft, behavior: 'smooth' });
    } else if (btnRight > viewRight) {
      container.scrollTo({
        left: btnRight - container.clientWidth,
        behavior: 'smooth',
      });
    }
  }, [activeDay, viewMode]);

  const activeDayInfo = calendarDays[activeDay - 1] || calendarDays[0];
  const activeWeekdayFull =
    KHMER_FULL_WEEKDAYS[activeDayInfo?.weekdayIndex ?? 0] || '';
  const activeDateFormatted = `${activeWeekdayFull}_${String(activeDay).padStart(
    2,
    '0'
  )}-${String(activeMonth).padStart(2, '0')}-${activeYear}`;
  const monthLabel =
    KHMER_MONTHS.find((m) => m.value === activeMonth)?.label || '';
  const activeKhmerDateHeader = `${activeWeekdayFull}_${toKhmerDigits(
    String(activeDay).padStart(2, '0')
  )} ${monthLabel} ${toKhmerDigits(activeYear)}`;
  const activeHoliday = useMemo(
    () => getHolidayByDate(holidays, activeYear, activeMonth, activeDay),
    [holidays, activeYear, activeMonth, activeDay]
  );
  const monthHolidays = useMemo(
    () => getHolidaysInMonth(holidays, activeYear, activeMonth),
    [holidays, activeYear, activeMonth]
  );

  const dailySummary = useMemo(
    () => computeDailyAttendanceSummary(students, attendance, activeDay),
    [students, attendance, activeDay]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);


  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Top Toolbar: Month Selector & View Mode */}
      <div className="w-full min-w-0 flex flex-wrap items-center justify-between gap-3 surface-card rounded-2xl p-3.5">
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <select
            aria-label="ជ្រើសរើសខែ"
            value={activeMonth}
            onChange={(e) => onChangeMonthYear(Number(e.target.value), activeYear)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {KHMER_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                ខែ {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="ជ្រើសរើសឆ្នាំ"
            value={activeYear}
            onChange={(e) => onChangeMonthYear(activeMonth, Number(e.target.value))}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 text-sm font-semibold font-mono-num text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {getYearOptions(activeYear).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAnnualHolidays(true)}
            className="btn-secondary min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <CalendarDays className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>ឈប់សម្រាក {activeYear}</span>
            {monthHolidays.length > 0 && (
              <span className="font-mono-num text-[11px] font-bold text-rose-700 dark:text-rose-400">
                ({monthHolidays.length})
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 rounded-xl max-w-full">
            <button
              type="button"
              onClick={() => setViewMode('mobile')}
              className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                viewMode === 'mobile'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>បញ្ចូលរហ័ស</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sheet')}
              className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                viewMode === 'sheet'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>តារាង Sheet</span>
            </button>
          </div>

          <TelegramButton
            onClick={onShareTelegram}
            isLoading={isPreparingShare}
          />
        </div>
      </div>

      {viewMode === 'mobile' ? (
        <>
          {/* Daily Summary 4 Separate Soft-Colored Cards in 1 Row */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/85 dark:bg-blue-950/35 px-1.5 py-2.5 sm:px-3 sm:py-3 flex flex-col items-center justify-center text-center shadow-xs min-w-0">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100/90 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1 shrink-0">
                <Users className="w-4 h-4" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-blue-900/85 dark:text-blue-200 leading-tight truncate max-w-full">
                សិស្សសរុប
              </span>
              <span className="text-base sm:text-xl font-bold font-mono-num text-blue-700 dark:text-blue-300 leading-tight mt-0.5">
                {students.length}
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/85 dark:bg-emerald-950/35 px-1.5 py-2.5 sm:px-3 sm:py-3 flex flex-col items-center justify-center text-center shadow-xs min-w-0">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1 shrink-0">
                <UserCheck className="w-4 h-4" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-800 dark:text-emerald-200 leading-tight truncate max-w-full">
                មករៀន
              </span>
              <span className="text-base sm:text-xl font-bold font-mono-num text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5">
                {dailySummary.present}
              </span>
            </div>

            <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/85 dark:bg-amber-950/35 px-1.5 py-2.5 sm:px-3 sm:py-3 flex flex-col items-center justify-center text-center shadow-xs min-w-0">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-100/90 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1 shrink-0">
                <Clock3 className="w-4 h-4" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-amber-800 dark:text-amber-200 leading-tight truncate max-w-full">
                ច្បាប់/ឈឺ
              </span>
              <span className="text-base sm:text-xl font-bold font-mono-num text-amber-700 dark:text-amber-300 leading-tight mt-0.5">
                {dailySummary.excused}
              </span>
            </div>

            <div className="rounded-2xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50/85 dark:bg-rose-950/35 px-1.5 py-2.5 sm:px-3 sm:py-3 flex flex-col items-center justify-center text-center shadow-xs min-w-0">
              <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-100/90 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-1 shrink-0">
                <UserX className="w-4 h-4" />
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-rose-800 dark:text-rose-200 leading-tight truncate max-w-full">
                អត់ច្បាប់
              </span>
              <span className="text-base sm:text-xl font-bold font-mono-num text-rose-700 dark:text-rose-300 leading-tight mt-0.5">
                {dailySummary.unexcused}
              </span>
            </div>
          </div>

          {/* Horizontal Date Scroller */}
          <div className="w-full min-w-0 surface-card rounded-2xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                {activeKhmerDateHeader}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {activeDayInfo?.isSunday && (
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    ថ្ងៃអាទិត្យ (ឈប់សម្រាក)
                  </span>
                )}
                {activeHoliday && (
                  <span
                    className={`text-xs font-semibold ${
                      activeHoliday.isCustom && !activeHoliday.hasOfficialHoliday
                        ? 'text-violet-700 dark:text-violet-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {activeHoliday.isCustom && !activeHoliday.hasOfficialHoliday
                      ? 'ថ្ងៃឈប់៖ '
                      : 'ថ្ងៃឈប់សម្រាក៖ '}
                    {activeHoliday.khmerName}
                  </span>
                )}
              </div>
            </div>
            <HorizontalScrollStrip
              scrollerRef={dayScrollerRef}
              className="pb-1"
              ariaLabel={`ជ្រើសរើសថ្ងៃក្នុងខែ${monthLabel}`}
            >
              {scrollerDays.map((d) => {
                const isSelected = d.day === activeDay;
                const isToday = isCurrentMonthYear && d.day === todayDate;
                const holiday = getHolidayByDate(
                  holidays,
                  activeYear,
                  activeMonth,
                  d.day
                );
                const isCustomOnly = Boolean(
                  holiday?.isCustom && !holiday.hasOfficialHoliday
                );
                const buttonTitle = [
                  isToday ? 'ថ្ងៃបច្ចុប្បន្ន' : '',
                  holiday
                    ? holiday.khmerName
                    : d.isSunday
                    ? 'ថ្ងៃអាទិត្យ (ឈប់សម្រាក)'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <button
                    key={d.day}
                    data-day={d.day}
                    type="button"
                    onClick={() => setSelectedDay(d.day)}
                    title={buttonTitle || undefined}
                    className={`min-w-[46px] min-h-[58px] px-2 py-1.5 rounded-xl flex flex-col items-center justify-center transition-all duration-150 active:scale-95 shrink-0 border relative ${
                      isSelected
                        ? d.isSunday
                          ? 'bg-gradient-to-b from-red-500 to-red-600 text-white border-red-600 shadow-[0_4px_10px_-2px_rgba(220,38,38,0.4)]'
                          : isCustomOnly
                          ? 'bg-gradient-to-b from-violet-500 to-violet-600 text-white border-violet-600 shadow-[0_4px_10px_-2px_rgba(124,58,237,0.4)]'
                          : holiday
                          ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white border-rose-600 shadow-[0_4px_10px_-2px_rgba(225,29,72,0.4)]'
                          : 'btn-primary border-blue-600'
                        : d.isSunday
                        ? 'bg-red-50/90 dark:bg-red-950/45 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/70 hover:bg-red-100 dark:hover:bg-red-900/50'
                        : isCustomOnly
                        ? 'bg-violet-50/95 dark:bg-violet-950/45 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800/70 hover:bg-violet-100 dark:hover:bg-violet-900/50'
                        : holiday
                        ? 'bg-rose-50/95 dark:bg-rose-950/45 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/70 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                        : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    <span className="text-[11px] font-medium leading-none mb-1">
                      {d.khmerDay}
                    </span>
                    <span className="text-sm font-bold font-mono-num leading-none">
                      {d.day}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 w-1.5 h-1.5 rounded-full ${
                        holiday
                          ? isSelected
                            ? 'bg-white'
                            : isCustomOnly
                            ? 'bg-violet-500 dark:bg-violet-400'
                            : 'bg-rose-500 dark:bg-rose-400'
                          : 'bg-transparent'
                      }`}
                    />
                  </button>
                );
              })}
            </HorizontalScrollStrip>
          </div>

          {/* Search & Bulk Action */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ស្វែងរកឈ្មោះ ឬអត្តលេខសិស្ស..."
                className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={() => onClearDayAllPresent(activeDay)}
              className="min-h-[46px] px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shrink-0 whitespace-nowrap border border-blue-600 dark:border-blue-500 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-sm transition-all active:scale-[0.98]"
            >
              <CheckCheck className="w-4.5 h-4.5 text-white shrink-0" />
              <span>កំណត់មករៀនទាំងអស់ ({activeDateFormatted})</span>
            </button>
          </div>

          {/* Student List for Thumb Tapping */}
          {students.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center space-y-1.5">
              <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                គ្មានទិន្នន័យសិស្ស
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                សូមចូលគណនី ឬចូលទៅផ្ទាំង «គ្រូ/សិស្ស» ដើម្បីបន្ថែមសិស្ស។
              </p>
            </div>
          ) : (
            <div className="surface-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((stu) => {
                const idx = students.findIndex((s) => s.id === stu.id);
                const mark = attendance[stu.id]?.[activeDay] || '';
                const leaveReason = attendanceReasons[stu.id]?.[activeDay] || '';
                const totals = computeStudentAttendanceSummary(
                  stu.id,
                  attendance,
                  calendarDays.length
                );

                return (
                  <div
                    key={stu.id}
                    className="px-2.5 sm:px-3.5 py-2.5 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] sm:text-xs font-bold font-mono-num flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {stu.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
                            ច្ប {totals.excused} / អច្ប {totals.unexcused}
                          </div>
                        </div>
                      </div>

                      {/* 4-State Compact Single-Row Toggle */}
                      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 rounded-xl w-[172px] sm:w-[236px] shrink-0">
                        <button
                          type="button"
                          onClick={() => onChangeMark(stu.id, activeDay, '')}
                          aria-label="មករៀន"
                          title="មករៀន"
                          className={`min-h-[40px] sm:min-h-[42px] rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150 active:scale-[0.97] whitespace-nowrap ${
                            mark === ''
                              ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_2px_8px_-2px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          <Check className="w-4.5 h-4.5 stroke-[2.75]" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeMark(stu.id, activeDay, 'ច្ប')}
                          className={`min-h-[40px] sm:min-h-[42px] rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150 active:scale-[0.97] whitespace-nowrap ${
                            mark === 'ច្ប'
                              ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-[0_2px_8px_-2px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          ច្ប
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeMark(stu.id, activeDay, 'ឈ')}
                          className={`min-h-[40px] sm:min-h-[42px] rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150 active:scale-[0.97] whitespace-nowrap ${
                            mark === 'ឈ'
                              ? 'bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_2px_8px_-2px_rgba(2,132,199,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          ឈ
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeMark(stu.id, activeDay, 'អច្ប')}
                          className={`min-h-[40px] sm:min-h-[42px] rounded-lg text-xs font-semibold flex items-center justify-center transition-all duration-150 active:scale-[0.97] whitespace-nowrap ${
                            mark === 'អច្ប'
                              ? 'bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-[0_2px_8px_-2px_rgba(225,29,72,0.45),inset_0_1px_0_rgba(255,255,255,0.22)]'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          អច្ប
                        </button>
                      </div>
                    </div>

                    {/* Inline Leave Reason Input when student is marked សុំច្បាប់ ('ច្ប') */}
                    {mark === 'ច្ប' && (
                      <div className="sm:pl-10">
                        <div className="rounded-xl border border-amber-200/90 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35 p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                              មូលហេតុសុំច្បាប់ (ថ្ងៃទី {activeDay})
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={leaveReason}
                              maxLength={120}
                              onChange={(e) =>
                                onChangeLeaveReason(stu.id, activeDay, e.target.value)
                              }
                              placeholder="សរសេរមូលហេតុសុំច្បាប់ (ឧ. ធុរៈគ្រួសារ, ជូនដំណឹងតាមទូរស័ព្ទ...)"
                              aria-label={`មូលហេតុសុំច្បាប់របស់ ${stu.name} ថ្ងៃទី ${activeDay}`}
                              className="w-full min-h-[40px] px-3 pr-9 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {leaveReason && (
                              <button
                                type="button"
                                onClick={() => onChangeLeaveReason(stu.id, activeDay, '')}
                                aria-label="សម្អាតមូលហេតុសុំច្បាប់"
                                className="absolute right-1.5 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {LEAVE_REASON_PRESETS.map((preset) => {
                              const isSelected = leaveReason.trim() === preset;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    onChangeLeaveReason(stu.id, activeDay, preset)
                                  }
                                  className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                    isSelected
                                      ? 'bg-amber-500 text-white border-amber-500'
                                      : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/70 hover:bg-amber-100/70 dark:hover:bg-amber-900/50'
                                  }`}
                                >
                                  {preset}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Exact Sheet 1 Matrix Preview matching Screenshot 1 */
        <div className="w-full min-w-0 surface-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              ទម្រង់តារាង Google Sheet: អវត្តមានប្រចាំខែ ({monthLabel} {activeYear})
            </span>
            <span>ចុចលើប្រអប់ដើម្បីប្តូរ (ទទេ → ច្ប → ឈ → អច្ប)</span>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-900 dark:text-slate-100">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center w-9">
                    ល.រ
                  </th>
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center w-20">
                    អត្តលេខ
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-left min-w-[150px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10"
                  >
                    គោត្តនាម និងនាម
                  </th>
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center w-12">
                    ភេទ
                  </th>
                  {calendarDays.map((d) => {
                    const holiday = getHolidayByDate(
                      holidays,
                      activeYear,
                      activeMonth,
                      d.day
                    );
                    const isCustomOnly = Boolean(
                      holiday?.isCustom && !holiday.hasOfficialHoliday
                    );
                    return (
                      <th
                        key={`d-${d.day}`}
                        title={holiday?.khmerName}
                        className={`border border-slate-300 dark:border-slate-700 px-1 py-1 text-center font-mono-num min-w-[26px] ${
                          d.isSunday
                            ? 'bg-red-600 text-white'
                            : isCustomOnly
                            ? 'bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-200'
                            : holiday
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200'
                            : ''
                        }`}
                      >
                        {d.day}
                      </th>
                    );
                  })}
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 w-3 bg-white dark:bg-slate-900" />
                  <th colSpan={3} className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-center">
                    ចំនួនអវត្តមាន
                  </th>
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center min-w-[72px]">
                    ផ្សេងៗ
                  </th>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
                  {calendarDays.map((d) => {
                    const holiday = getHolidayByDate(
                      holidays,
                      activeYear,
                      activeMonth,
                      d.day
                    );
                    const isCustomOnly = Boolean(
                      holiday?.isCustom && !holiday.hasOfficialHoliday
                    );
                    return (
                      <th
                        key={`wk-${d.day}`}
                        title={holiday?.khmerName}
                        className={`border border-slate-300 dark:border-slate-700 px-1 py-1 text-center text-[11px] ${
                          d.isSunday
                            ? 'bg-red-600 text-white'
                            : isCustomOnly
                            ? 'bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-200'
                            : holiday
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200'
                            : ''
                        }`}
                      >
                        {d.khmerDay}
                      </th>
                    );
                  })}
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center">ច្ប</th>
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center">អច្ប</th>
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center">សរុប</th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, idx) => {
                  const totals = computeStudentAttendanceSummary(
                    stu.id,
                    attendance,
                    calendarDays.length
                  );
                  return (
                    <tr key={stu.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                        {stu.studentCode}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1 text-left font-medium sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap">
                        {stu.name}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center">
                        {stu.gender}
                      </td>
                      {calendarDays.map((d) => {
                        const holiday = getHolidayByDate(
                          holidays,
                          activeYear,
                          activeMonth,
                          d.day
                        );
                        const isCustomOnly = Boolean(
                          holiday?.isCustom && !holiday.hasOfficialHoliday
                        );
                        const mark = attendance[stu.id]?.[d.day] || '';
                        const cellReason =
                          mark === 'ច្ប' ? (attendanceReasons[stu.id]?.[d.day] || '').trim() : '';
                        const nextMark: AttendanceMark =
                          mark === ''
                            ? 'ច្ប'
                            : mark === 'ច្ប'
                            ? 'ឈ'
                            : mark === 'ឈ'
                            ? 'អច្ប'
                            : '';
                        const cellTitle = [
                          holiday?.khmerName,
                          cellReason ? `មូលហេតុសុំច្បាប់៖ ${cellReason}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <td
                            key={d.day}
                            title={cellTitle || undefined}
                            onClick={() =>
                              !d.isSunday && onChangeMark(stu.id, d.day, nextMark)
                            }
                            className={`border border-slate-300 dark:border-slate-700 px-0.5 py-1 text-center text-[11px] font-semibold select-none relative ${
                              d.isSunday
                                ? 'bg-red-600 text-white'
                                : mark === 'ច្ប'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 cursor-pointer'
                                : mark === 'ឈ'
                                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 cursor-pointer'
                                : mark === 'អច្ប'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 cursor-pointer'
                                : isCustomOnly
                                ? 'bg-violet-50/75 dark:bg-violet-950/45 text-violet-800 dark:text-violet-300 cursor-pointer hover:bg-violet-100/70 dark:hover:bg-violet-900/50'
                                : holiday
                                ? 'bg-rose-50/75 dark:bg-rose-950/45 text-rose-800 dark:text-rose-300 cursor-pointer hover:bg-rose-100/70 dark:hover:bg-rose-900/50'
                                : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/50'
                            }`}
                          >
                            {d.isSunday ? '' : mark}
                            {!d.isSunday && cellReason && (
                              <span
                                aria-hidden="true"
                                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400"
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                        {totals.excused}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                        {totals.unexcused}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num font-bold">
                        {totals.totalAbsent}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-left text-slate-600 dark:text-slate-300">
                        {(() => {
                          const hasExcusedLeave = calendarDays.some(
                            (d) => !d.isSunday && attendance[stu.id]?.[d.day] === 'ច្ប'
                          );
                          return (
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[11px] leading-snug break-words">
                                {remarks[stu.id] || ''}
                              </span>
                              {hasExcusedLeave && (
                                <button
                                  type="button"
                                  onClick={() => setEditingLeaveStudentId(stu.id)}
                                  title="សរសេរ ឬកែមូលហេតុសុំច្បាប់"
                                  aria-label={`សរសេរមូលហេតុសុំច្បាប់របស់ ${stu.name}`}
                                  className="min-w-[26px] min-h-[26px] px-1.5 rounded-md border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-1 text-[10px] font-semibold shrink-0"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>មូលហេតុ</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
                {/* Daily Summary Footer Row */}
                <tr className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-100">
                  <td colSpan={4} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    ចំនួនសិស្សមករៀនប្រចាំថ្ងៃ
                  </td>
                  {calendarDays.map((d) => {
                    const holiday = getHolidayByDate(
                      holidays,
                      activeYear,
                      activeMonth,
                      d.day
                    );
                    const isCustomOnly = Boolean(
                      holiday?.isCustom && !holiday.hasOfficialHoliday
                    );
                    const ds = computeDailyAttendanceSummary(students, attendance, d.day);
                    return (
                      <td
                        key={`sum-${d.day}`}
                        title={holiday?.khmerName}
                        className={`border border-slate-300 dark:border-slate-700 px-0.5 py-1 text-center font-mono-num text-[11px] ${
                          d.isSunday
                            ? 'bg-red-600 text-white'
                            : isCustomOnly
                            ? 'bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-200'
                            : holiday
                            ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200'
                            : ''
                        }`}
                      >
                        {d.isSunday ? '' : ds.present}
                      </td>
                    );
                  })}
                  <td className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                  <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                    {students.reduce(
                      (acc, s) =>
                        acc +
                        computeStudentAttendanceSummary(s.id, attendance, calendarDays.length)
                          .excused,
                      0
                    )}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num">
                    {students.reduce(
                      (acc, s) =>
                        acc +
                        computeStudentAttendanceSummary(s.id, attendance, calendarDays.length)
                          .unexcused,
                      0
                    )}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1 text-center font-mono-num font-bold">
                    {students.reduce(
                      (acc, s) =>
                        acc +
                        computeStudentAttendanceSummary(s.id, attendance, calendarDays.length)
                          .totalAbsent,
                      0
                    )}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700" />
                </tr>
              </tbody>
            </table>
          </div>
          {monthHolidays.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-950/35 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rose-900 dark:text-rose-200">
              <span className="font-bold">ថ្ងៃឈប់សម្រាកប្រចាំខែ{monthLabel}៖</span>
              {monthHolidays.map((h) => (
                <span key={h.date} className="font-medium">
                  <span className="font-mono-num font-bold">ទី {h.day}</span> — {h.khmerName}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <AnnualHolidaysModal
        open={showAnnualHolidays}
        user={user}
        isLoggingIn={isLoggingIn}
        year={activeYear}
        activeMonth={activeMonth}
        activeDay={activeDay}
        holidays={holidays}
        customEntries={customEntries}
        isLoading={isLoadingHolidays}
        isSavingCustom={isSavingCustomHoliday}
        deletingCustomId={deletingCustomId}
        customError={customHolidayError}
        onSignIn={onSignIn}
        onRefresh={handleRefreshHolidays}
        onClearCustomError={() => setCustomHolidayError(null)}
        onAddCustomHoliday={handleAddCustomHoliday}
        onDeleteCustomHoliday={handleDeleteCustomHoliday}
        onSelectHolidayDate={(month, day) => {
          onChangeMonthYear(month, activeYear);
          setSelectedDay(day);
        }}
        onClose={() => setShowAnnualHolidays(false)}
      />

      {/* Leave Reason Editor Modal (accessible from Sheet Table view) */}
      {editingLeaveStudentId &&
        (() => {
          const targetStudent = students.find((s) => s.id === editingLeaveStudentId);
          if (!targetStudent) return null;
          const leaveDays = calendarDays.filter(
            (d) => !d.isSunday && attendance[targetStudent.id]?.[d.day] === 'ច្ប'
          );
          return (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-reason-modal-title"
            >
              <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0">
                    <h3
                      id="leave-reason-modal-title"
                      className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate"
                    >
                      មូលហេតុសុំច្បាប់ — {targetStudent.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ខែ{monthLabel} {activeYear} · ចំនួន {leaveDays.length} ថ្ងៃសុំច្បាប់ (ច្ប)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLeaveStudentId(null)}
                    aria-label="បិទផ្ទាំងមូលហេតុសុំច្បាប់"
                    className="min-w-[38px] min-h-[38px] -mr-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto p-4 sm:p-5 space-y-3 flex-1">
                  {leaveDays.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                      មិនមានថ្ងៃសុំច្បាប់ (ច្ប) ក្នុងខែនេះទេ។
                    </p>
                  ) : (
                    leaveDays.map((d) => {
                      const val = attendanceReasons[targetStudent.id]?.[d.day] || '';
                      return (
                        <div
                          key={d.day}
                          className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/35 p-3 space-y-2"
                        >
                          <div className="text-xs font-bold text-amber-950 dark:text-amber-200 font-mono-num">
                            ថ្ងៃ{d.khmerDay} ទី {d.day} {monthLabel} {activeYear}
                          </div>
                          <input
                            type="text"
                            value={val}
                            maxLength={120}
                            onChange={(e) =>
                              onChangeLeaveReason(targetStudent.id, d.day, e.target.value)
                            }
                            placeholder="សរសេរមូលហេតុសុំច្បាប់..."
                            className="w-full min-h-[40px] px-3 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {LEAVE_REASON_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  onChangeLeaveReason(targetStudent.id, d.day, preset)
                                }
                                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  val.trim() === preset
                                    ? 'bg-amber-500 text-white border-amber-500'
                                    : 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/70 hover:bg-amber-100/70 dark:hover:bg-amber-900/50'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingLeaveStudentId(null)}
                    className="btn-primary min-h-[40px] px-4 rounded-xl text-xs font-semibold"
                  >
                    រួចរាល់
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  CalendarDays,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { KHMER_MONTHS } from '../types/gradebook';
import {
  CambodiaHoliday,
  CustomHolidayEntry,
  MAX_CUSTOM_HOLIDAY_TITLE_LENGTH,
  buildHolidayDateKey,
} from '../services/cambodiaHolidays';
import { UserAvatar } from './UserProfileMenu';

interface AnnualHolidaysModalProps {
  open: boolean;
  user: User | null;
  isLoggingIn?: boolean;
  year: number;
  activeMonth: number;
  activeDay: number;
  holidays: CambodiaHoliday[];
  customEntries: CustomHolidayEntry[];
  isLoading: boolean;
  isSavingCustom?: boolean;
  deletingCustomId?: string | null;
  customError?: string | null;
  onSignIn: () => void;
  onRefresh: () => void;
  onClearCustomError?: () => void;
  onAddCustomHoliday: (params: {
    startDate: string;
    endDate?: string;
    title: string;
  }) => Promise<boolean>;
  onDeleteCustomHoliday: (id: string) => Promise<void>;
  onSelectHolidayDate: (month: number, day: number) => void;
  onClose: () => void;
}

const KHMER_FULL_WEEKDAYS = [
  'អាទិត្យ',
  'ចន្ទ',
  'អង្គារ',
  'ពុធ',
  'ព្រហស្បតិ៍',
  'សុក្រ',
  'សៅរ៍',
];

const QUICK_OFF_DAY_PRESETS = [
  'វិស្សមកាលតូច',
  'ប្រជុំគ្រូបង្រៀន',
  'កម្មវិធីសាលារៀន',
  'ប្រឡងឆមាស',
];

export const AnnualHolidaysModal: React.FC<AnnualHolidaysModalProps> = ({
  open,
  user,
  isLoggingIn = false,
  year,
  activeMonth,
  activeDay,
  holidays,
  customEntries,
  isLoading,
  isSavingCustom = false,
  deletingCustomId = null,
  customError = null,
  onSignIn,
  onRefresh,
  onClearCustomError,
  onAddCustomHoliday,
  onDeleteCustomHoliday,
  onSelectHolidayDate,
  onClose,
}) => {
  const defaultDate = buildHolidayDateKey(year, activeMonth, activeDay);
  const [showAddForm, setShowAddForm] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) {
      const nextDate = buildHolidayDateKey(year, activeMonth, activeDay);
      setStartDate(nextDate);
      setEndDate(nextDate);
    }
  }, [open, year, activeMonth, activeDay]);

  if (!open) return null;

  const customForYear = user
    ? customEntries.filter((c) => c.date.startsWith(`${year}-`))
    : [];

  const groupedByMonth = KHMER_MONTHS.map((m) => ({
    ...m,
    items: holidays.filter((h) => h.month === m.value),
  })).filter((g) => g.items.length > 0);

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSavingCustom || !title.trim() || !startDate) return;
    const saved = await onAddCustomHoliday({
      startDate,
      endDate: endDate || startDate,
      title: title.trim(),
    });
    if (saved) {
      setTitle('');
      setShowAddForm(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="annual-holidays-title"
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="annual-holidays-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                ប្រតិទិនថ្ងៃឈប់សម្រាកប្រចាំឆ្នាំ {year}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono-num truncate">
                {user
                  ? `${user.displayName || user.email || 'គណនី'} · សរុប ${holidays.length} ថ្ងៃ · ផ្ទាល់ខ្លួន ${customForYear.length} ថ្ងៃ`
                  : `ផ្លូវការ ${holidays.length} ថ្ងៃ · សូមចូលគណនីដើម្បីកត់ត្រាថ្ងៃឈប់ផ្ទាល់ខ្លួន`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClearCustomError?.();
                setShowAddForm((prev) => !prev);
              }}
              className="btn-primary min-h-[38px] px-2.5 sm:px-3 rounded-xl text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>បន្ថែមថ្ងៃឈប់</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="ទាញប្រតិទិនឡើងវិញ"
              aria-label="ទាញប្រតិទិនឡើងវិញ"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="បិទផ្ទាំងប្រតិទិន"
              className="min-w-[38px] min-h-[38px] -mr-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 flex-1">
          {customError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:text-rose-200 flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
                <span>{customError}</span>
              </div>
              {onClearCustomError && (
                <button
                  type="button"
                  onClick={onClearCustomError}
                  className="text-xs underline shrink-0"
                >
                  បិទ
                </button>
              )}
            </div>
          )}

          {/* Account Gate when logged out */}
          {!user && (
            <div className="border border-blue-200 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl p-3.5 sm:p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {showAddForm
                      ? 'សូមចូល ឬបង្កើតគណនីជាមុនសិន ដើម្បីបន្ថែមថ្ងៃឈប់សម្រាក'
                      : 'ថ្ងៃឈប់សម្រាកផ្ទាល់ខ្លួនតាមគណនីគ្រូម្នាក់ៗ'}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    ការបន្ថែម និងរក្សាទុកថ្ងៃឈប់សម្រាកផ្សេងៗរបស់គ្រូម្នាក់ៗ ត្រូវបានកត់ត្រាដាច់ដោយឡែកតាមគណនីដែលបាន Login ប៉ុណ្ណោះ។
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-10">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                  disabled={isLoggingIn}
                  className="btn-primary min-h-[40px] px-4 rounded-xl text-xs font-semibold"
                >
                  {isLoggingIn ? 'កំពុងភ្ជាប់...' : 'ចូល / បង្កើតគណនី'}
                </button>
                {showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
                  >
                    បិទ
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Email verification gate if signed up with unverified email */}
          {user && !user.emailVerified && showAddForm && (
            <div className="border border-amber-200 dark:border-amber-800/70 bg-amber-50/90 dark:bg-amber-950/50 rounded-2xl p-3.5 sm:p-4 space-y-2 text-xs text-amber-950 dark:text-amber-200">
              <div className="font-bold">
                សូមបញ្ជាក់អ៊ីមែល ({user.email}) ជាមុនសិន
              </div>
              <p className="leading-relaxed">
                ដើម្បីរក្សាទុកថ្ងៃឈប់សម្រាកផ្ទាល់ខ្លួនលើ Cloud សូមបើកតំណបញ្ជាក់ក្នុងអ៊ីមែលរបស់អ្នក រួចចុច «បានបញ្ជាក់រួចហើយ (ផ្ទុកឡើងវិញ)» នៅផ្ទាំងខាងលើ។
              </p>
            </div>
          )}

          {/* Add Custom Off-day Form (Authenticated & Verified User Only) */}
          {user && user.emailVerified && showAddForm && (
            <form
              onSubmit={handleSubmitCustom}
              className="border border-violet-200 dark:border-violet-800/70 bg-violet-50/60 dark:bg-violet-950/35 rounded-2xl p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-bold text-violet-950 dark:text-violet-200">
                  បន្ថែមថ្ងៃឈប់ផ្សេងទៀត (ក្រៅពីថ្ងៃបុណ្យជាតិ)
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  បិទ
                </button>
              </div>

              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-violet-200/80 dark:border-violet-800/60 text-[11px] text-slate-700 dark:text-slate-300">
                <UserAvatar user={user} sizeClass="w-5 h-5" textClass="text-[10px]" />
                <span className="truncate">
                  កត់ត្រាក្នុងគណនី៖{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {user.email || user.displayName || 'Google'}
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="block space-y-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ចាប់ពីថ្ងៃទី
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!endDate || e.target.value > endDate) {
                        setEndDate(e.target.value);
                      }
                    }}
                    required
                    disabled={isSavingCustom}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
                <label className="block space-y-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ដល់ថ្ងៃទី (បើឈប់ច្រើនថ្ងៃ)
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isSavingCustom}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono-num text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    មូលហេតុ ឬឈ្មោះថ្ងៃឈប់សម្រាក
                  </span>
                  <input
                    type="text"
                    value={title}
                    maxLength={MAX_CUSTOM_HOLIDAY_TITLE_LENGTH}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ឧ. វិស្សមកាលតូច, ប្រជុំគណៈគ្រប់គ្រង, កម្មវិធីសាលា..."
                    required
                    disabled={isSavingCustom}
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-600"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {QUICK_OFF_DAY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isSavingCustom}
                      onClick={() => setTitle(preset)}
                      className="px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-[11px] font-medium text-violet-800 dark:text-violet-300 hover:bg-violet-100/70 dark:hover:bg-violet-900/50 transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSavingCustom}
                  onClick={() => setShowAddForm(false)}
                  className="btn-secondary flex-1 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold"
                >
                  បោះបង់
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustom}
                  className="btn-primary flex-1 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-60"
                >
                  {isSavingCustom ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកថ្ងៃឈប់'}
                </button>
              </div>
            </form>
          )}

          {/* User-Added Custom Holidays List (Authenticated User Only) */}
          {user && customForYear.length > 0 && (
            <div className="border border-violet-200 dark:border-violet-800/70 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="px-3.5 py-2 bg-violet-50 dark:bg-violet-950/50 border-b border-violet-200 dark:border-violet-800/70 flex items-center justify-between gap-2 text-xs font-bold text-violet-900 dark:text-violet-200">
                <span className="truncate">
                  ថ្ងៃឈប់ផ្សេងទៀតរបស់គណនីនេះ ({year})
                </span>
                <span className="font-mono-num shrink-0">{customForYear.length} ថ្ងៃ</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {customForYear.map((c) => {
                  const [, mStr, dStr] = c.date.split('-');
                  const mNum = Number(mStr);
                  const dNum = Number(dStr);
                  const monthLbl =
                    KHMER_MONTHS.find((km) => km.value === mNum)?.label || mStr;
                  const isDeleting = deletingCustomId === c.id;
                  return (
                    <div
                      key={c.id}
                      className="px-3.5 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectHolidayDate(mNum, dNum);
                          onClose();
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      >
                        <span className="px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs font-bold font-mono-num shrink-0">
                          {dNum} {monthLbl}
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {c.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => void onDeleteCustomHoliday(c.id)}
                        aria-label={`លុប ${c.title}`}
                        title="លុបថ្ងៃឈប់នេះ"
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors shrink-0 disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Grouped Annual Holiday Calendar */}
          {groupedByMonth.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              មិនមានទិន្នន័យថ្ងៃឈប់សម្រាកសម្រាប់ឆ្នាំ {year} ទេ។
            </div>
          ) : (
            groupedByMonth.map((group) => (
              <div
                key={group.value}
                className="border border-slate-200 dark:border-slate-700/90 rounded-2xl overflow-hidden bg-white dark:bg-slate-900"
              >
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>
                    ខែ{group.label} {year}
                  </span>
                  <span className="font-mono-num text-rose-700 dark:text-rose-400">
                    {group.items.length} ថ្ងៃ
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.items.map((h) => {
                    const weekdayIdx = new Date(year, h.month - 1, h.day).getDay();
                    const weekdayKh = KHMER_FULL_WEEKDAYS[weekdayIdx] || '';
                    const isCurrentDay =
                      h.month === activeMonth && h.day === activeDay;
                    const isCustomOnly = h.isCustom && !h.hasOfficialHoliday;
                    const isDeletingAny = Boolean(
                      deletingCustomId && h.customIds?.includes(deletingCustomId)
                    );

                    return (
                      <div
                        key={h.date}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                          isCurrentDay
                            ? isCustomOnly
                              ? 'bg-violet-50/90 dark:bg-violet-950/50'
                              : 'bg-rose-50/90 dark:bg-rose-950/50'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectHolidayDate(h.month, h.day);
                            onClose();
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <div
                            className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                              weekdayIdx === 0
                                ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-700 dark:text-red-300'
                                : isCustomOnly
                                ? 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800/70 text-violet-700 dark:text-violet-300'
                                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <span className="text-sm font-bold font-mono-num leading-none">
                              {h.day}
                            </span>
                            <span className="text-[10px] font-medium mt-0.5 leading-none">
                              {weekdayKh}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                              {h.khmerName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {isCustomOnly
                                ? 'ថ្ងៃឈប់ផ្សេងទៀត (គណនីរបស់អ្នក)'
                                : h.englishName}
                            </div>
                          </div>
                        </button>

                        {user && h.customIds && h.customIds.length > 0 ? (
                          <button
                            type="button"
                            disabled={isDeletingAny}
                            onClick={() => {
                              void Promise.all(
                                (h.customIds || []).map((cid) =>
                                  onDeleteCustomHoliday(cid)
                                )
                              );
                            }}
                            aria-label={`លុប ${h.khmerName}`}
                            title="លុបថ្ងៃឈប់ដែលបានបន្ថែម"
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors shrink-0 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <Sparkles className="w-4 h-4 text-rose-400 shrink-0 mr-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary w-full min-h-[44px] rounded-xl text-sm font-semibold"
          >
            បិទ
          </button>
        </div>
      </div>
    </div>
  );
};

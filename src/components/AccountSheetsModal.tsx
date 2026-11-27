import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  LogIn,
  LogOut,
  Mail,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ClassSettings,
  KHMER_MONTHS,
  SpreadsheetInfo,
  getMonthlyScoresMonthYear,
} from '../types/gradebook';
import { canUseRedirectFlow, isInAppBrowser } from '../services/googleAuth';
import { DriveSheetFile } from '../services/googleSheets';
import { UserProfileData } from '../services/userProfile';
import { GoogleSignInButton } from './GoogleSignInButton';
import { UserAvatar } from './UserProfileMenu';

interface AccountSheetsModalProps {
  open: boolean;
  user: User | null;
  userProfile?: UserProfileData | null;
  hasToken: boolean;
  isLoggingIn: boolean;
  activeSheet: SpreadsheetInfo | null;
  driveFiles: DriveSheetFile[];
  isLoadingFiles: boolean;
  settings: ClassSettings;
  onClose: () => void;
  onSignIn: () => void;
  onSignInRedirect?: () => void;
  onOpenAuthModal?: (mode: 'signin' | 'signup') => void;
  onEditProfile?: () => void;
  onResendVerification?: () => void;
  onRefreshVerification?: () => void;
  isCheckingVerification?: boolean;
  onSignOut: () => void;
  onRefreshDriveFiles: () => void;
  onRequestCreateSheet: (title: string) => void;
  onLoadSheetById: (idOrUrl: string) => void;
}

export const AccountSheetsModal: React.FC<AccountSheetsModalProps> = ({
  open,
  user,
  userProfile,
  hasToken,
  isLoggingIn,
  activeSheet,
  driveFiles,
  isLoadingFiles,
  settings,
  onClose,
  onSignIn,
  onSignInRedirect,
  onOpenAuthModal,
  onEditProfile,
  onResendVerification,
  onRefreshVerification,
  isCheckingVerification = false,
  onSignOut,
  onRefreshDriveFiles,
  onRequestCreateSheet,
  onLoadSheetById,
}) => {
  const { month: monMonth, year: monYear } = getMonthlyScoresMonthYear(settings);
  const monMonthLabel =
    KHMER_MONTHS.find((m) => m.value === monMonth)?.label || '';

  const [newSheetTitle, setNewSheetTitle] = useState(
    `បញ្ជីពិន្ទុ និងអវត្តមាន${
      settings.className.trim() ? ` ${settings.className.trim()}` : ''
    } - ${monMonthLabel} ${monYear}`
  );
  const [sheetUrlInput, setSheetUrlInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewSheetTitle(
      `បញ្ជីពិន្ទុ និងអវត្តមាន${
        settings.className.trim() ? ` ${settings.className.trim()}` : ''
      } - ${monMonthLabel} ${monYear}`
    );
  }, [open, settings.className, monMonthLabel, monYear]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-sheets-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="account-sheets-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              គណនី និង Google Sheets
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              រក្សាទុកទិន្នន័យលើ Cloud ដោយស្វ័យប្រវត្តិ និងភ្ជាប់ Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user && hasToken && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignOut();
                }}
                className="btn-secondary min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ចេញ</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="បិទផ្ទាំងព័ត៌មានគណនី និង Google Sheets"
              className="min-w-[40px] min-h-[40px] -mr-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!hasToken ? (
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
              {user && (
                <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={user} sizeClass="w-11 h-11" textClass="text-sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {userProfile?.displayName ||
                            user.displayName ||
                            user.email?.split('@')[0] ||
                            'គណនីគ្រូបន្ទុកថ្នាក់'}
                        </div>
                        {(userProfile?.roleTitle || userProfile?.schoolName) && (
                          <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 truncate">
                            {[userProfile.roleTitle, userProfile.schoolName]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                        {user.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {user.email}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              user.emailVerified ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span
                            className={
                              user.emailVerified
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {user.emailVerified
                              ? 'គណនី Cloud បានបើក'
                              : 'រង់ចាំបញ្ជាក់អ៊ីមែល'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className="btn-secondary min-h-[36px] px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ចេញ</span>
                    </button>
                  </div>

                  {(userProfile?.phone || userProfile?.address || onEditProfile) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[userProfile?.phone, userProfile?.address]
                          .filter(Boolean)
                          .join(' · ') || 'បន្ថែមរូបថត និងព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក'}
                      </div>
                      {onEditProfile && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEditProfile();
                          }}
                          className="min-h-[34px] px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span>កែប្រែគណនី / រូបថត</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {user && !user.emailVerified && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs text-amber-950 dark:text-amber-100 leading-relaxed">
                    សូមបើកអ៊ីមែល <strong>{user.email}</strong> រួចចុចតំណបញ្ជាក់ ដើម្បីបើកការរក្សាទុកទិន្នន័យលើ Cloud។
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {onRefreshVerification && (
                      <button
                        type="button"
                        onClick={onRefreshVerification}
                        disabled={isCheckingVerification}
                        className="btn-primary min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isCheckingVerification
                            ? 'កំពុងពិនិត្យ...'
                            : 'បានបញ្ជាក់រួចហើយ (ផ្ទុកឡើងវិញ)'}
                        </span>
                      </button>
                    )}
                    {onResendVerification && (
                      <button
                        type="button"
                        onClick={onResendVerification}
                        className="btn-secondary min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>ផ្ញើតំណម្តងទៀត</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!user && onOpenAuthModal && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    ប្រសិនបើ Browser រារាំង ឬមិនអាច Sign in Google បាន សូមបង្កើតគណនីដោយអ៊ីមែលផ្ទាល់ខ្លួន ដើម្បីចូលប្រើ និងរក្សាទុកទិន្នន័យលើ Cloud ភ្លាមៗ៖
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuthModal('signup');
                      }}
                      className="btn-primary min-h-[44px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>បង្កើតគណនីថ្មី (Sign up)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuthModal('signin');
                      }}
                      className="btn-secondary min-h-[44px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>ចូលគណនីអ៊ីមែល</span>
                    </button>
                  </div>
                  <div className="relative flex items-center py-0.5">
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                    <span className="px-2.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      ឬភ្ជាប់ Google
                    </span>
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                  </div>
                </div>
              )}

              {(!user || !user.emailVerified) && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {user
                    ? 'ឬភ្ជាប់ Google Account ដោយផ្ទាល់ដើម្បីប្រើជាមួយ Google Sheets៖'
                    : 'ភ្ជាប់ Google Account ប្រសិនបើអ្នកចង់បង្កើត និងធ្វើបច្ចុប្បន្នភាពទៅកាន់ Google Sheets៖'}
                </p>
              )}
              <GoogleSignInButton
                onClick={onSignIn}
                disabled={isLoggingIn}
                label={
                  isLoggingIn
                    ? 'កំពុងភ្ជាប់...'
                    : user
                    ? 'ភ្ជាប់ Google Sheets (ស្រេចចិត្ត)'
                    : 'Sign in with Google'
                }
                className="w-full"
              />
              {onSignInRedirect && canUseRedirectFlow() && (
                <button
                  type="button"
                  onClick={onSignInRedirect}
                  disabled={isLoggingIn}
                  className="btn-secondary w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold"
                >
                  ចូល Google តាមទំព័រផ្ទាល់ (ប្រសិនបើ Popup មានបញ្ហា)
                </button>
              )}
              {isInAppBrowser() && (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-lg px-2.5 py-2 leading-relaxed">
                  គន្លឹះ៖ អ្នកកំពុងបើកក្នុង Browser របស់ App (ដូចជា Telegram/Facebook)។ អ្នកអាចប្រើ «បង្កើតគណនីថ្មី (Sign up)» ខាងលើបានភ្លាម ឬចុច ⋮ រួចជ្រើស «Open in Chrome / Safari»។
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {user && (
                <div className="bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <UserAvatar user={user} sizeClass="w-12 h-12" textClass="text-sm" />
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {userProfile?.displayName ||
                          user.displayName ||
                          user.email?.split('@')[0] ||
                          'គណនី Google'}
                      </div>
                      {(userProfile?.roleTitle || userProfile?.schoolName) && (
                        <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 truncate">
                          {[userProfile.roleTitle, userProfile.schoolName]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      )}
                      {user.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.email}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                      បានភ្ជាប់
                    </span>
                  </div>

                  {(userProfile?.phone || userProfile?.address || onEditProfile) && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {[userProfile?.phone, userProfile?.address]
                          .filter(Boolean)
                          .join(' · ') || 'បន្ថែមរូបថត និងព័ត៌មានផ្ទាល់ខ្លួនរបស់អ្នក'}
                      </div>
                      {onEditProfile && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEditProfile();
                          }}
                          className="min-h-[34px] px-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span>កែប្រែគណនី / រូបថត</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSheet ? (
                <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-medium text-blue-800 dark:text-blue-300">
                    ឯកសារ Google Sheet កំពុងភ្ជាប់
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeSheet.title}
                  </div>
                  <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400 truncate">
                    ID: {activeSheet.spreadsheetId}
                  </div>
                  <a
                    href={activeSheet.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-1"
                  >
                    <span>បើកមើលក្នុង Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3">
                  មិនទាន់ភ្ជាប់ឯកសារ Google Sheet ណាមួយទេ។ សូមបង្កើតឯកសារថ្មី ឬជ្រើសរើសខាងក្រោម។
                </div>
              )}

              {/* Create New Formatted Sheet */}
              <div className="pt-2 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                  បង្កើត Google Sheet ថ្មី (ទម្រង់ ៣ ផ្ទាំងដូចគំរូ)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    placeholder="ឈ្មោះឯកសារ Google Sheet..."
                    className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestCreateSheet(
                        newSheetTitle.trim() || `សៀវភៅតាមដានសិស្ស ${settings.className}`
                      );
                    }}
                    className="btn-primary min-h-[44px] px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FilePlus2 className="w-4 h-4" />
                    <span>បង្កើតថ្មី</span>
                  </button>
                </div>
              </div>

              {/* Open by URL / ID */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block">
                  ឬភ្ជាប់ Google Sheet ដែលមានស្រាប់ (ដាក់ URL ឬ Sheet ID)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (sheetUrlInput.trim()) onLoadSheetById(sheetUrlInput.trim());
                    }}
                    className="btn-secondary min-h-[44px] px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>ទាញទិន្នន័យ</span>
                  </button>
                </div>
              </div>

              {/* Drive Recent Sheets List */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    ឯកសារ Google Sheets របស់កម្មវិធី
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshDriveFiles}
                    disabled={isLoadingFiles}
                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline min-h-[32px] px-2 cursor-pointer"
                  >
                    {isLoadingFiles ? 'កំពុងទាញ...' : 'ផ្ទុកឡើងវិញ'}
                  </button>
                </div>
                {driveFiles.length === 0 ? (
                  <div className="text-xs text-slate-400 dark:text-slate-500 py-2">
                    មិនទាន់មានឯកសារដែលបានបង្កើតពីកម្មវិធីនេះនៅឡើយទេ។
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    {driveFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => onLoadSheetById(file.id)}
                        className={`w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer ${
                          activeSheet?.spreadsheetId === file.id
                            ? 'bg-blue-50/60 dark:bg-blue-950/40'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {file.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 shrink-0">
                          បើក
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Close Action */}
          <div className="pt-3 flex items-center justify-end border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary min-h-[42px] px-5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              បិទ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

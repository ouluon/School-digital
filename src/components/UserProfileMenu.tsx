import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  LogOut,
  Mail,
  UserCog,
} from 'lucide-react';
import { useUserProfileContext } from '../contexts/UserProfileContext';

interface UserAvatarProps {
  user: User;
  sizeClass?: string;
  textClass?: string;
  photoUrlOverride?: string | null;
  displayNameOverride?: string | null;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  sizeClass = 'w-9 h-9',
  textClass = 'text-xs',
  photoUrlOverride,
  displayNameOverride,
}) => {
  const { profile } = useUserProfileContext();
  const [imgError, setImgError] = useState(false);

  const effectivePhotoUrl =
    photoUrlOverride !== undefined
      ? photoUrlOverride
      : profile?.photoDataUrl || user.photoURL || null;

  const effectiveName =
    displayNameOverride !== undefined
      ? displayNameOverride
      : profile?.displayName || user.displayName || user.email || 'G';

  useEffect(() => {
    setImgError(false);
  }, [effectivePhotoUrl]);

  const initialSource = (effectiveName || user.email || 'G').trim();
  const initial = initialSource.charAt(0).toUpperCase();

  if (effectivePhotoUrl && !imgError) {
    return (
      <img
        src={effectivePhotoUrl}
        alt={effectiveName || user.email || 'User profile'}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} ${textClass} rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0 border border-blue-700/20`}
    >
      {initial}
    </div>
  );
};

interface UserProfileMenuProps {
  user: User;
  hasToken: boolean;
  autoSaveState?: 'idle' | 'saving' | 'saved_local' | 'saved_cloud' | 'synced_sheet';
  onEditProfile?: () => void;
  onSignOut: () => void;
  onRefreshVerification?: () => void;
  onResendVerification?: () => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  user,
  hasToken,
  autoSaveState = 'idle',
  onEditProfile,
  onSignOut,
  onRefreshVerification,
  onResendVerification,
}) => {
  const { profile } = useUserProfileContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const displayName =
    profile?.displayName ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'គណនីគ្រូបន្ទុកថ្នាក់';
  const profileSubtitle = [profile?.roleTitle, profile?.schoolName]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(' · ');
  const isVerified = user.emailVerified;
  const isCloudActive = isVerified;

  const statusText = !isVerified
    ? 'មិនទាន់បញ្ជាក់អ៊ីមែល'
    : hasToken
    ? 'បានភ្ជាប់ Cloud & Google Sheets'
    : 'គណនី Cloud បានបើក';

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`គណនី ${displayName}`}
        className="min-h-[40px] p-1 sm:pr-2.5 rounded-full border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.98] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
      >
        <div className="relative shrink-0">
          <UserAvatar user={user} sizeClass="w-8 h-8" textClass="text-xs" />
          {autoSaveState === 'saving' ? (
            <span
              title="កំពុងរក្សាទុកស្វ័យប្រវត្តិ..."
              aria-label="កំពុងរក្សាទុកស្វ័យប្រវត្តិ"
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs"
            >
              <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
            </span>
          ) : isCloudActive &&
            (autoSaveState === 'saved_cloud' || autoSaveState === 'synced_sheet') ? (
            <span
              title="បានរក្សាទុកក្នុងគណនីស្វ័យប្រវត្តិ"
              aria-label="បានរក្សាទុកក្នុងគណនីស្វ័យប្រវត្តិ"
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-800 flex items-center justify-center shadow-xs"
            >
              <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${
                isCloudActive ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          )}
        </div>
        <span className="hidden lg:inline-block text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`hidden sm:block w-3.5 h-3.5 text-slate-400 dark:text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-76 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xl z-50 overflow-hidden"
        >
          <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-800/80 dark:to-blue-950/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="relative shrink-0">
              <UserAvatar user={user} sizeClass="w-12 h-12" textClass="text-base" />
              {onEditProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onEditProfile();
                  }}
                  aria-label="ផ្លាស់ប្តូររូបថត Profile"
                  title="ផ្លាស់ប្តូររូបថត Profile"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white dark:border-slate-900 shadow-xs flex items-center justify-center cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </div>
              {profileSubtitle && (
                <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400 truncate mt-0.5">
                  {profileSubtitle}
                </div>
              )}
              {user.email && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {user.email}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                {isCloudActive &&
                (autoSaveState === 'saved_cloud' || autoSaveState === 'synced_sheet') ? (
                  <span
                    aria-hidden="true"
                    className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"
                  >
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCloudActive ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                )}
                <span
                  className={
                    isCloudActive
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }
                >
                  {isCloudActive &&
                  (autoSaveState === 'saved_cloud' || autoSaveState === 'synced_sheet')
                    ? 'បានរក្សាទុកក្នុងគណនីស្វ័យប្រវត្តិ'
                    : statusText}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2 space-y-1">
            {onEditProfile && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEditProfile();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/60 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
              >
                <UserCog className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>កែប្រែព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត</span>
              </button>
            )}

            {!isVerified && onRefreshVerification && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRefreshVerification();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 flex items-center gap-2.5 transition-colors text-left"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>បានបញ្ជាក់រួចហើយ (ផ្ទុកឡើងវិញ)</span>
              </button>
            )}

            {!isVerified && onResendVerification && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onResendVerification();
                }}
                className="w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100/80 dark:hover:bg-amber-900/60 flex items-center gap-2.5 transition-colors text-left"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>ផ្ញើតំណបញ្ជាក់អ៊ីមែលម្តងទៀត</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="w-full min-h-[42px] px-3 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2.5 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>ចាកចេញពីគណនី (Sign out)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  compressProfileImage,
  PROFILE_LIMITS,
  ProfileGender,
  UserProfileData,
} from '../services/userProfile';
import { UserAvatar } from './UserProfileMenu';

interface AccountProfileModalProps {
  open: boolean;
  user: User | null;
  initialProfile: UserProfileData | null;
  defaultSchoolName?: string;
  defaultTeacherName?: string;
  onClose: () => void;
  onSave: (
    nextProfile: UserProfileData,
    options: { syncToClassSettings: boolean }
  ) => Promise<void>;
}

const ROLE_SUGGESTIONS = [
  'គ្រូបន្ទុកថ្នាក់',
  'គ្រូបង្រៀន',
  'នាយកសាលា',
  'នាយករង',
];

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  open,
  user,
  initialProfile,
  defaultSchoolName = '',
  defaultTeacherName = '',
  onClose,
  onSave,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [gender, setGender] = useState<ProfileGender>('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [syncToClassSettings, setSyncToClassSettings] = useState(true);

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setDisplayName(
      initialProfile?.displayName ||
        user.displayName ||
        defaultTeacherName ||
        user.email?.split('@')[0] ||
        ''
    );
    setRoleTitle(initialProfile?.roleTitle || '');
    setSchoolName(initialProfile?.schoolName || defaultSchoolName || '');
    setGender(initialProfile?.gender || '');
    setPhone(initialProfile?.phone || '');
    setAddress(initialProfile?.address || '');
    setBio(initialProfile?.bio || '');
    setPhotoDataUrl(initialProfile?.photoDataUrl || '');
    setSyncToClassSettings(true);
    setErrorMsg(null);
    setIsProcessingPhoto(false);
    setIsSaving(false);
  }, [open, user, initialProfile, defaultSchoolName, defaultTeacherName]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isSaving, onClose]);

  if (!open || !user) return null;

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressProfileImage(file);
      setPhotoDataUrl(compressed);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'មិនអាចបញ្ចូលរូបថតនេះបានទេ។ សូមសាកល្បងរូបភាពផ្សេងទៀត។'
      );
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isProcessingPhoto) return;
    setErrorMsg(null);

    const cleanName = displayName.trim();
    if (!cleanName) {
      setErrorMsg('សូមបញ្ចូលឈ្មោះរបស់អ្នក។');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(
        {
          displayName: cleanName.slice(0, PROFILE_LIMITS.DISPLAY_NAME_MAX),
          roleTitle: roleTitle.trim().slice(0, PROFILE_LIMITS.ROLE_TITLE_MAX),
          schoolName: schoolName.trim().slice(0, PROFILE_LIMITS.SCHOOL_NAME_MAX),
          gender,
          phone: phone.trim().slice(0, PROFILE_LIMITS.PHONE_MAX),
          address: address.trim().slice(0, PROFILE_LIMITS.ADDRESS_MAX),
          bio: bio.trim().slice(0, PROFILE_LIMITS.BIO_MAX),
          photoDataUrl: photoDataUrl || '',
          updatedAtMs: Date.now(),
        },
        { syncToClassSettings }
      );
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'មិនអាចរក្សាទុកព័ត៌មានគណនីបានទេ។ សូមសាកល្បងម្តងទៀត។'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const effectivePreviewPhoto = photoDataUrl || user.photoURL || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-profile-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="account-profile-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              ព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              កែប្រែព័ត៌មានគណនី និងរូបភាពតំណាងរបស់អ្នក
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="បិទផ្ទាំងព័ត៌មានគណនី"
            className="min-w-[40px] min-h-[40px] -mr-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Profile Photo Picker Card */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/80 dark:to-blue-950/30 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              {effectivePreviewPhoto ? (
                <UserAvatar
                  user={user}
                  photoUrlOverride={effectivePreviewPhoto}
                  displayNameOverride={displayName || user.displayName}
                  sizeClass="w-24 h-24 ring-4 ring-white dark:ring-slate-900 shadow-md"
                  textClass="text-2xl"
                />
              ) : (
                <UserAvatar
                  user={user}
                  photoUrlOverride=""
                  displayNameOverride={displayName || user.displayName}
                  sizeClass="w-24 h-24 ring-4 ring-white dark:ring-slate-900 shadow-md"
                  textClass="text-2xl"
                />
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto || isSaving}
                aria-label="ប្តូររូបថត Profile"
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              >
                {isProcessingPhoto ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {displayName.trim() || user.displayName || 'គណនីគ្រូបន្ទុកថ្នាក់'}
                </div>
                {user.email && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 mt-0.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                    {user.emailVerified && (
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                        aria-label="អ៊ីមែលបានបញ្ជាក់"
                      />
                    )}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                onChange={(e) => void handlePickPhoto(e)}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingPhoto || isSaving}
                  className="btn-secondary min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessingPhoto ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span>
                    {isProcessingPhoto
                      ? 'កំពុងបង្រួមរូបភាព...'
                      : photoDataUrl
                      ? 'ផ្លាស់ប្តូររូបថត'
                      : 'បញ្ចូលរូបថត Profile'}
                  </span>
                </button>

                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isProcessingPhoto || isSaving}
                    className="min-h-[38px] px-3 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>លុបរូប</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                គាំទ្រ JPG, PNG, WebP · ប្រព័ន្ធនឹងកាត់រូបភាពជារាងការ៉េស្វ័យប្រវត្តិ
              </p>
            </div>
          </div>

          {/* Personal Info Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ឈ្មោះពេញ / ឈ្មោះគ្រូ *
              </span>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={PROFILE_LIMITS.DISPLAY_NAME_MAX}
                  placeholder="ឧ. លោកគ្រូ អ៊ូ លួន"
                  required
                  disabled={isSaving}
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                តួនាទី / មុខតំណែង
              </span>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  list="profile-role-suggestions"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  maxLength={PROFILE_LIMITS.ROLE_TITLE_MAX}
                  placeholder="ឧ. គ្រូបន្ទុកថ្នាក់"
                  disabled={isSaving}
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="profile-role-suggestions">
                  {ROLE_SUGGESTIONS.map((role) => (
                    <option key={role} value={role} />
                  ))}
                </datalist>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ភេទ
              </span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as ProfileGender)}
                disabled={isSaving}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">មិនបញ្ជាក់</option>
                <option value="ប្រុស">ប្រុស</option>
                <option value="ស្រី">ស្រី</option>
              </select>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ឈ្មោះសាលារៀន
              </span>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  maxLength={PROFILE_LIMITS.SCHOOL_NAME_MAX}
                  placeholder="ឧ. សាលាបឋមសិក្សា..."
                  disabled={isSaving}
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                លេខទូរស័ព្ទ
              </span>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={PROFILE_LIMITS.PHONE_MAX}
                  placeholder="012 345 678"
                  disabled={isSaving}
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                អាសយដ្ឋាន / ខេត្ត-រាជធានី
              </span>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={PROFILE_LIMITS.ADDRESS_MAX}
                  placeholder="ឧ. ភ្នំពេញ"
                  disabled={isSaving}
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ព័ត៌មានបន្ថែម / កំណត់ចំណាំ
              </span>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={PROFILE_LIMITS.BIO_MAX}
                placeholder="កំណត់ចំណាំផ្ទាល់ខ្លួន ឬបន្ទុកបង្រៀន..."
                disabled={isSaving}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </label>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer">
            <input
              type="checkbox"
              checked={syncToClassSettings}
              onChange={(e) => setSyncToClassSettings(e.target.checked)}
              disabled={isSaving}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              ធ្វើបច្ចុប្បន្នភាពឈ្មោះគ្រូ និងឈ្មោះសាលារៀនទៅក្នុងព័ត៌មានថ្នាក់រៀន (Excel / បំណិនសម្បទា) ដោយស្វ័យប្រវត្តិ
            </span>
          </label>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary min-h-[42px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              disabled={isSaving || isProcessingPhoto}
              className="btn-primary min-h-[42px] px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកព័ត៌មាន'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

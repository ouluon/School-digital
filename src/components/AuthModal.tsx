import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { canUseRedirectFlow } from '../services/googleAuth';
import { GoogleSignInButton } from './GoogleSignInButton';

export type AuthModalMode = 'signin' | 'signup' | 'reset';

interface AuthModalProps {
  open: boolean;
  initialMode?: AuthModalMode;
  isGoogleLoading?: boolean;
  onClose: () => void;
  onEmailSignUp: (params: {
    displayName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onEmailSignIn: (params: { email: string; password: string }) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onGoogleSignIn: () => void;
  onGoogleRedirect?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'signup',
  isGoogleLoading = false,
  onClose,
  onEmailSignUp,
  onEmailSignIn,
  onResetPassword,
  onGoogleSignIn,
  onGoogleRedirect,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrorMsg(null);
      setResetSentEmail(null);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isSubmitting, onClose]);

  if (!open) return null;

  const switchMode = (next: AuthModalMode) => {
    setMode(next);
    setErrorMsg(null);
    setResetSentEmail(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក។');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await onResetPassword(cleanEmail);
        setResetSentEmail(cleanEmail);
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'មិនអាចផ្ញើអ៊ីមែលកំណត់ពាក្យសម្ងាត់ថ្មីបានទេ។'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setErrorMsg('សូមបញ្ចូលឈ្មោះគ្រូបន្ទុកថ្នាក់។');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។ សូមពិនិត្យម្តងទៀត។');
        return;
      }

      setIsSubmitting(true);
      try {
        await onEmailSignUp({
          displayName: displayName.trim(),
          email: cleanEmail,
          password,
        });
        onClose();
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error ? err.message : 'មិនអាចបង្កើតគណនីបានទេ។'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Sign in
    if (!password) {
      setErrorMsg('សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នក។');
      return;
    }
    setIsSubmitting(true);
    try {
      await onEmailSignIn({ email: cleanEmail, password });
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'មិនអាចចូលគណនីបានទេ។'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="auth-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {mode === 'signup'
                ? 'បង្កើតគណនីថ្មី (Sign up)'
                : mode === 'reset'
                ? 'កំណត់ពាក្យសម្ងាត់ថ្មី'
                : 'ចូលគណនី (Sign in)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ប្រើអ៊ីមែលផ្ទាល់ខ្លួន ដើម្បីរក្សាទុកទិន្នន័យលើ Cloud គ្រប់ Browser
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="បិទផ្ទាំងចូលគណនី"
            className="min-w-[40px] min-h-[40px] -mr-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode Switcher (Sign in / Sign up) */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 rounded-xl">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                disabled={isSubmitting}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'signin'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>ចូលគណនី</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                disabled={isSubmitting}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>បង្កើតគណនីថ្មី</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {resetSentEmail && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                បានផ្ញើតំណកំណត់ពាក្យសម្ងាត់ថ្មីទៅកាន់{' '}
                <strong>{resetSentEmail}</strong> រួចរាល់។ សូមពិនិត្យ Inbox ឬ Spam។
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ឈ្មោះគ្រូបន្ទុកថ្នាក់ *
                </span>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ឧ. លោកគ្រូ អ៊ូ លួន"
                    autoComplete="name"
                    disabled={isSubmitting}
                    required
                    className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </label>
            )}

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                អ៊ីមែល (Email) *
              </span>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  autoComplete="email"
                  inputMode="email"
                  disabled={isSubmitting}
                  required
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            {mode !== 'reset' && (
              <label className="block space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ពាក្យសម្ងាត់ (Password) *
                  </span>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      ភ្លេចពាក្យសម្ងាត់?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'signup'
                        ? 'យ៉ាងតិច ៦ តួអក្សរ'
                        : 'បញ្ចូលពាក្យសម្ងាត់'
                    }
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    disabled={isSubmitting}
                    required
                    className="w-full min-h-[44px] pl-9 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'លាក់ពាក្យសម្ងាត់' : 'បង្ហាញពាក្យសម្ងាត់'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </label>
            )}

            {mode === 'signup' && (
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  បញ្ជាក់ពាក្យសម្ងាត់ *
                </span>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="វាយពាក្យសម្ងាត់ម្តងទៀត"
                    autoComplete="new-password"
                    disabled={isSubmitting}
                    required
                    className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </label>
            )}

            {mode === 'signup' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 leading-relaxed">
                បន្ទាប់ពីបង្កើតគណនី ប្រព័ន្ធនឹងផ្ញើតំណបញ្ជាក់ទៅអ៊ីមែលរបស់អ្នក ដើម្បីបើកសិទ្ធិរក្សាទុកទិន្នន័យលើ Cloud ដោយស្វ័យប្រវត្តិ។
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full min-h-[44px] px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isSubmitting
                  ? 'កំពុងដំណើរការ...'
                  : mode === 'signup'
                  ? 'បង្កើតគណនីថ្មី (Sign up)'
                  : mode === 'reset'
                  ? 'ផ្ញើតំណកំណត់ពាក្យសម្ងាត់ថ្មី'
                  : 'ចូលគណនី (Sign in)'}
              </span>
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                disabled={isSubmitting}
                className="btn-secondary w-full min-h-[42px] px-4 rounded-xl text-xs font-semibold"
              >
                ត្រឡប់ទៅផ្ទាំងចូលគណនី
              </button>
            )}
          </form>

          {/* Secondary Google Sign-In Option */}
          {mode !== 'reset' && (
            <>
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                <span className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  ឬភ្ជាប់ជាមួយ Google
                </span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              </div>

              <div className="space-y-2">
                <GoogleSignInButton
                  onClick={() => {
                    onClose();
                    onGoogleSignIn();
                  }}
                  disabled={isSubmitting || isGoogleLoading}
                  label={
                    isGoogleLoading ? 'កំពុងភ្ជាប់...' : 'Sign in with Google'
                  }
                  className="w-full"
                />
                {onGoogleRedirect && canUseRedirectFlow() && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoogleRedirect();
                    }}
                    disabled={isSubmitting || isGoogleLoading}
                    className="btn-secondary w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold"
                  >
                    ចូល Google តាមទំព័រផ្ទាល់ (Redirect)
                  </button>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                  Google Sign-In ជួយភ្ជាប់ Google Sheets បន្ថែម (ប្រសិនបើ Browser និងគណនីអនុញ្ញាត)។
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

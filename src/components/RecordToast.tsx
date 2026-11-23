import React from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';

export type RecordToastCategory = 'attendance' | 'scores';
export type RecordToastPhase =
  | 'recording'
  | 'saved_local'
  | 'saved_cloud'
  | 'synced_sheet';

export interface RecordToastState {
  id: number;
  category: RecordToastCategory;
  phase: RecordToastPhase;
  detail?: string;
}

interface RecordToastProps {
  toast: RecordToastState | null;
  onDismiss: () => void;
  onPauseAutoDismiss?: () => void;
  onResumeAutoDismiss?: () => void;
}

export const RecordToast: React.FC<RecordToastProps> = ({
  toast,
  onDismiss,
  onPauseAutoDismiss,
  onResumeAutoDismiss,
}) => {
  if (!toast) return null;

  const isRecording = toast.phase === 'recording';

  const title = isRecording
    ? toast.category === 'attendance'
      ? 'កំពុងកត់ត្រាអវត្តមាន...'
      : 'កំពុងកត់ត្រាពិន្ទុ...'
    : toast.phase === 'synced_sheet'
    ? 'បានកត់ត្រា និងផ្ទុកទៅ Sheet រួចរាល់'
    : toast.phase === 'saved_cloud'
    ? 'បានកត់ត្រាចូលគណនី Cloud រួចរាល់'
    : 'បានកត់ត្រាក្នុងឧបករណ៍រួចរាល់';

  const fallbackSubtitle =
    toast.category === 'attendance'
      ? 'ទិន្នន័យអវត្តមានត្រូវបានរក្សាទុកដោយស្វ័យប្រវត្តិ'
      : 'ទិន្នន័យពិន្ទុត្រូវបានរក្សាទុកដោយស្វ័យប្រវត្តិ';

  return (
    <div
      className="fixed z-40 pointer-events-none bottom-20 left-3 right-3 md:bottom-6 md:left-auto md:right-6 flex justify-center md:justify-end"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={toast.id}
        role="status"
        onMouseEnter={onPauseAutoDismiss}
        onMouseLeave={onResumeAutoDismiss}
        className={`pointer-events-auto animate-toast-enter w-full max-w-sm rounded-2xl border backdrop-blur-md shadow-xl overflow-hidden transition-colors duration-200 ${
          isRecording
            ? 'bg-white/95 dark:bg-slate-900/95 border-blue-200/90 dark:border-blue-800/80 shadow-blue-950/10 dark:shadow-black/40'
            : 'bg-white/95 dark:bg-slate-900/95 border-emerald-200/90 dark:border-emerald-800/80 shadow-emerald-950/10 dark:shadow-black/40'
        }`}
      >
        <div className="px-3.5 py-2.5 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
              isRecording
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {isRecording ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={`text-xs sm:text-[13px] font-bold leading-snug truncate ${
                isRecording
                  ? 'text-slate-900 dark:text-slate-100'
                  : 'text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {title}
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
              {toast.detail || fallbackSubtitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="បិទការជូនដំណឹង"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          className={`h-[2.5px] w-full transition-colors duration-200 ${
            isRecording
              ? 'bg-blue-500/80 dark:bg-blue-400/80 animate-pulse'
              : 'bg-emerald-500/85 dark:bg-emerald-400/85'
          }`}
        />
      </div>
    </div>
  );
};

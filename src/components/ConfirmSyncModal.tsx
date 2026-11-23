import React from 'react';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';

export interface PendingSyncSummary {
  mode: 'create' | 'update';
  title: string;
  spreadsheetId?: string;
  studentCount: number;
  attendanceChangesCount: number;
  monthlyScoreCount: number;
  semesterScoreCount: number;
  tabNames: string[];
}

interface ConfirmSyncModalProps {
  open: boolean;
  summary: PendingSyncSummary | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmSyncModal: React.FC<ConfirmSyncModalProps> = ({
  open,
  summary,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  if (!open || !summary) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sync-title"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3" />

        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="confirm-sync-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {summary.mode === 'create'
                  ? 'បញ្ជាក់ការបង្កើត Google Sheet ថ្មី'
                  : 'បញ្ជាក់ការផ្ទុកទិន្នន័យទៅ Google Sheets'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                សូមពិនិត្យព័ត៌មានមុននឹងកែប្រែឯកសារ Google Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="បិទ"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">ឈ្មោះឯកសារ</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-right truncate max-w-[210px]">
                {summary.title}
              </span>
            </div>
            {summary.spreadsheetId && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Sheet ID</span>
                <span className="font-mono-num text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                  {summary.spreadsheetId}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ផ្ទាំងទិន្នន័យដែលនឹងកែប្រែ</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono-num">
                  {summary.tabNames.length} ផ្ទាំង (Tabs)
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {summary.tabNames.join(' · ')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-lg font-bold font-mono-num text-slate-900 dark:text-slate-100">
                {summary.studentCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">សិស្សសរុប</div>
            </div>
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-lg font-bold font-mono-num text-amber-700 dark:text-amber-400">
                {summary.attendanceChangesCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">អវត្តមានបានកត់</div>
            </div>
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
              <div className="text-lg font-bold font-mono-num text-blue-700 dark:text-blue-400">
                {summary.monthlyScoreCount + summary.semesterScoreCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">ពិន្ទុបានបញ្ចូល</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {summary.mode === 'create'
              ? 'កម្មវិធីនឹងបង្កើតឯកសារ Google Sheets ថ្មីដែលមានទម្រង់តារាង រូបមន្តគណនាស្វ័យប្រវត្តិ និងពណ៌ដូចគំរូ។'
              : 'ទិន្នន័យក្នុងផ្ទាំងខាងលើនៃឯកសារ Google Sheet នេះនឹងត្រូវធ្វើបច្ចុប្បន្នភាពដោយស្វ័យប្រវត្តិ។'}
          </p>
        </div>

        <div className="px-5 pb-6 pt-3 sm:pb-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-secondary flex-1 min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            បោះបង់
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="btn-primary flex-1 min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>កំពុងផ្ទុក...</span>
              </>
            ) : (
              <span>
                {summary.mode === 'create' ? 'បង្កើត និងផ្ទុកឡើង' : 'បញ្ជាក់ និងរក្សាទុក'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

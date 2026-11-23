import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { canNativeShareFile, triggerExcelDownload } from '../services/excelExport';

interface ShareExcelModalProps {
  open: boolean;
  file: File | null;
  sourceLabel: string;
  summaryText: string;
  googleSheetUrl?: string;
  hasUnsavedChanges: boolean;
  canUseGoogleDriveExport: boolean;
  isSwitchingSource: boolean;
  onSwitchToGoogleDriveExport?: () => void;
  onClose: () => void;
}

export const ShareExcelModal: React.FC<ShareExcelModalProps> = ({
  open,
  file,
  sourceLabel,
  summaryText,
  googleSheetUrl,
  hasUnsavedChanges,
  canUseGoogleDriveExport,
  isSwitchingSource,
  onSwitchToGoogleDriveExport,
  onClose,
}) => {
  const [shareError, setShareError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  if (!open || !file) return null;

  const nativeShareAvailable = canNativeShareFile(file);
  const sizeKb = Math.max(1, Math.round(file.size / 1024));

  const telegramHref = googleSheetUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(
        googleSheetUrl
      )}&text=${encodeURIComponent(summaryText)}`
    : `https://t.me/`;

  const handleDirectNativeShare = async () => {
    setShareError(null);
    try {
      await navigator.share({
        files: [file],
        title: file.name,
        text: summaryText,
      });
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setShareError(
        'កម្មវិធីរុករកនៅលើឧបករណ៍នេះមិនអនុញ្ញាតឱ្យបើកផ្ទាំង Share ផ្ទាល់ទេ។ សូមទាញយកឯកសារ Excel (.xlsx) រួចផ្ញើចូល Telegram។'
      );
    }
  };

  const handleDownload = () => {
    triggerExcelDownload(file, file.name);
    setDownloaded(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-excel-title"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-sky-700 dark:text-sky-400" />
            </div>
            <div className="min-w-0">
              <h3
                id="share-excel-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                ចែករំលែក Excel ទៅ Telegram
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sourceLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទផ្ទាំងចែករំលែក"
            className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Info Card */}
        <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-1.5">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">
            {file.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num flex items-center gap-2">
            <span>Excel (.xlsx)</span>
            <span aria-hidden="true">·</span>
            <span>{sizeKb} KB</span>
          </div>
        </div>

        {hasUnsavedChanges && canUseGoogleDriveExport && (
          <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3 flex items-center justify-between gap-2">
            <span>
              ឯកសារនេះត្រូវបានបង្កើតរួមទាំងទិន្នន័យកែប្រែថ្មីៗដែលមិនទាន់ផ្ទុកទៅ Google Sheet។
            </span>
            {onSwitchToGoogleDriveExport && (
              <button
                type="button"
                onClick={onSwitchToGoogleDriveExport}
                disabled={isSwitchingSource}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-1"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSwitchingSource ? 'animate-spin' : ''}`}
                />
                <span>ទាញពី Google Sheet</span>
              </button>
            )}
          </div>
        )}

        {shareError && (
          <div className="text-xs text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 rounded-xl p-3">
            {shareError}
          </div>
        )}

        {downloaded && (
          <div className="text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>
              បានទាញយកឯកសារ Excel រួចរាល់! សូមបើក Telegram រួចជ្រើស Chat និងភ្ជាប់ឯកសារនេះដើម្បី Send។
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {nativeShareAvailable && (
            <button
              type="button"
              onClick={handleDirectNativeShare}
              className="w-full min-h-[46px] px-4 rounded-xl bg-gradient-to-b from-[#2AA8E8] to-[#1A8AC5] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(34,158,217,0.38),inset_0_1px_0_rgba(255,255,255,0.28)] hover:brightness-105 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share with កម្មវិធី (Telegram...)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className={`w-full min-h-[46px] px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${
              nativeShareAvailable ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>ទាញយកឯកសារ Excel (.xlsx)</span>
          </button>

          <a
            href={telegramHref}
            target="_blank"
            rel="noreferrer"
            className="w-full min-h-[46px] px-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/90 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 text-sm font-semibold hover:bg-sky-100 dark:hover:bg-sky-900/60 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>បើក Telegram ដើម្បីជ្រើស Chat</span>
          </a>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
          នៅលើទូរស័ព្ទដៃ ការចុច «Share with កម្មវិធី» នឹងបើកផ្ទាំងជ្រើសរើស Telegram ដើម្បីរើស Chat និងចុច Send ដោយផ្ទាល់។ នៅលើកុំព្យូទ័រ សូមទាញយកឯកសារ .xlsx រួចភ្ជាប់ផ្ញើក្នុង Telegram។
        </p>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  getNativeFileSharePayloads,
  triggerExcelDownload,
} from '../services/excelExport';

interface ShareExcelModalProps {
  open: boolean;
  file: File | null;
  csvFile?: File | null;
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
  csvFile = null,
  sourceLabel,
  summaryText,
  googleSheetUrl,
  hasUnsavedChanges,
  canUseGoogleDriveExport,
  isSwitchingSource,
  onSwitchToGoogleDriveExport,
  onClose,
}) => {
  const [shareFallbackNotice, setShareFallbackNotice] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    setShareFallbackNotice(null);
    setDownloaded(false);
  }, [open, file]);

  if (!open || !file) return null;

  const sizeKb = Math.max(1, Math.round(file.size / 1024));

  const telegramHref = googleSheetUrl
    ? `https://t.me/share/url?url=${encodeURIComponent(
        googleSheetUrl
      )}&text=${encodeURIComponent(summaryText)}`
    : `https://t.me/`;

  const handleDownload = () => {
    setShareFallbackNotice(null);
    triggerExcelDownload(file, file.name);
    setDownloaded(true);
  };

  const handleSendToTelegram = async () => {
    setShareFallbackNotice(null);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      // 1) Try native .xlsx file share (supported on iOS Safari and compatible browsers)
      // 2) Fall back to native .csv spreadsheet file share (permitted by Android Chrome Web Share API)
      // 3) Fall back to native text/link share sheet (universal Android Chrome / WebView fallback)
      const candidates: Array<{ payload: ShareData; isFile: boolean }> = [
        ...getNativeFileSharePayloads(file, file.name, summaryText).map((payload) => ({
          payload,
          isFile: true,
        })),
        ...(csvFile
          ? getNativeFileSharePayloads(csvFile, csvFile.name, summaryText).map(
              (payload) => ({
                payload,
                isFile: true,
              })
            )
          : []),
        {
          payload: {
            title: file.name,
            text: summaryText,
            ...(googleSheetUrl ? { url: googleSheetUrl } : {}),
          },
          isFile: false,
        },
      ];

      for (const candidate of candidates) {
        try {
          await navigator.share(candidate.payload);
          if (!candidate.isFile) {
            triggerExcelDownload(file, file.name);
          }
          onClose();
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }
    }

    // Final fallback when native share is unavailable (e.g., Desktop or restricted iframe):
    // download the Excel file first and offer a direct Telegram link.
    triggerExcelDownload(file, file.name);
    setDownloaded(true);
    setShareFallbackNotice(
      'កម្មវិធីរុករកនៅលើឧបករណ៍នេះមិនអនុញ្ញាតឱ្យបើកផ្ទាំង Share ផ្ទាល់ទេ។ ឯកសារ Excel ត្រូវបានទាញយករួចរាល់ — សូមចុចប៊ូតុងខាងក្រោមដើម្បីបើក Telegram រួចភ្ជាប់ឯកសារនេះផ្ញើ។'
    );
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
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3
                id="share-excel-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                ទាញយក ឬផ្ញើឯកសារ Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {sourceLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទផ្ទាំងជម្រើស"
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

        {shareFallbackNotice && (
          <div className="text-xs text-sky-900 dark:text-sky-100 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/70 rounded-xl p-3 space-y-2.5">
            <p className="leading-relaxed">{shareFallbackNotice}</p>
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors"
            >
              <span>បើក Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {downloaded && !shareFallbackNotice && (
          <div className="text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>បានទាញយកឯកសារ File Excel (.xlsx) រួចរាល់!</span>
          </div>
        )}

        {/* 2 Action Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            className="w-full min-h-[48px] px-4 rounded-xl btn-primary text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>ទាញយក File Excel</span>
          </button>

          <button
            type="button"
            onClick={handleSendToTelegram}
            className="w-full min-h-[48px] px-4 rounded-xl bg-gradient-to-b from-[#2AA8E8] to-[#1A8AC5] hover:from-[#34B2F0] hover:to-[#1E94D1] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(34,158,217,0.38),inset_0_1px_0_rgba(255,255,255,0.28)] active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="w-4 h-4 shrink-0"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            <span>ផ្ញើទៅ Telegram</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
          នៅលើទូរស័ព្ទ Android និង iOS ការចុច «ផ្ញើទៅ Telegram» នឹងបើកផ្ទាំងចែករំលែកដើម្បីជ្រើស Telegram និងផ្ញើដោយផ្ទាល់។
        </p>
      </div>
    </div>
  );
};

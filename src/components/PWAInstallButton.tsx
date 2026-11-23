import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="ដំឡើងកម្មវិធី ឬ បន្ថែមទៅអេក្រង់ដើម"
        title="ដំឡើងកម្មវិធី (Add to Home Screen / Shortcut)"
        className="h-10 px-2.5 sm:px-3 rounded-xl border border-blue-200/90 dark:border-blue-800/80 bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-300 text-xs font-semibold active:scale-95 transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="hidden lg:inline whitespace-nowrap">ដំឡើងកម្មវិធី</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="បន្ថែមទៅអេក្រង់ដើមលើ iPhone/iPad"
          title="បន្ថែមទៅអេក្រង់ដើម (Add to Home Screen)"
          className="h-10 px-2.5 sm:px-3 rounded-xl border border-blue-200/90 dark:border-blue-800/80 bg-blue-50/90 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-300 text-xs font-semibold active:scale-95 transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">ដំឡើង</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="ណែនាំបន្ថែមកម្មវិធីទៅអេក្រង់ដើម"
          >
            <div className="w-full sm:max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/aistudio/Gemini_Generated_Image_32m1mh32m1mh32m1_fc5b9cee.jpg"
                    alt="Khmer Classbook Icon"
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      បន្ថែមទៅអេក្រង់ដើម (iOS)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Add to Home Screen
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="បិទ"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    ១
                  </span>
                  <span>
                    ចុចប៊ូតុង <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-slate-100"><Share className="w-3.5 h-3.5 text-blue-600" /> Share</strong> នៅរបារខាងក្រោម ឬខាងលើក្នុងកម្មវិធី Safari។
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    ២
                  </span>
                  <span>
                    អូសចុះក្រោម រួចជ្រើសរើស <strong className="text-slate-900 dark:text-slate-100">Add to Home Screen</strong> បន្ទាប់មកចុច <strong className="text-slate-900 dark:text-slate-100">Add</strong>។
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="btn-primary w-full min-h-[42px] rounded-xl text-xs font-semibold"
              >
                យល់ព្រម
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

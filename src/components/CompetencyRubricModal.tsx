import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileSpreadsheet, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { ClassSettings, Student } from '../types/gradebook';
import { downloadCompetencyExcel } from '../services/competencyExcelExport';
import {
  ATTITUDE_COMPETENCY_SECTIONS,
  ATTITUDE_ITEM_IDS,
  COMPETENCY_STATUS_LABELS,
  CompetencyType,
  SKILL_COMPETENCY_ACTIVITIES,
  SKILL_ITEM_IDS,
  SKILL_SCALE_OPTIONS,
  evaluateCompetencyRubric,
} from '../constants/competencyRubrics';

interface CompetencyRubricModalProps {
  open: boolean;
  type: CompetencyType;
  student: Student | null;
  settings: ClassSettings;
  monthLabel: string;
  year: number;
  periodLabel?: string;
  periodFileSlug?: string;
  initialScores?: Record<string, number>;
  onSave: (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => void;
  onClose: () => void;
}

export const CompetencyRubricModal: React.FC<CompetencyRubricModalProps> = ({
  open,
  type,
  student,
  settings,
  monthLabel,
  year,
  periodLabel,
  periodFileSlug,
  initialScores,
  onSave,
  onClose,
}) => {
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (open && student) {
      setDraftScores({ ...(initialScores || {}) });
      setExportError(null);
    }
  }, [open, student?.id, type, initialScores]);

  const summary = useMemo(
    () => evaluateCompetencyRubric(type, draftScores),
    [type, draftScores]
  );

  if (!open || !student) return null;

  const isSkills = type === 'skills';
  const title = isSkills
    ? 'ឧបករណ៍វាយតម្លៃពិន្ទុបំណិនសម្បទា'
    : 'ឧបករណ៍វាយតម្លៃពិន្ទុចរិយាសម្បទា';

  const handleToggleItem = (itemId: string, value: number) => {
    setDraftScores((prev) => {
      const next = { ...prev };
      if (next[itemId] === value) {
        delete next[itemId];
      } else {
        next[itemId] = value;
      }
      return next;
    });
  };

  const handleFillAll = (value: number) => {
    const ids = isSkills ? SKILL_ITEM_IDS : ATTITUDE_ITEM_IDS;
    const next: Record<string, number> = {};
    for (const id of ids) {
      next[id] = value;
    }
    setDraftScores(next);
  };

  const handleFillSection = (itemIds: string[], value: number | null) => {
    setDraftScores((prev) => {
      const next = { ...prev };
      for (const id of itemIds) {
        if (value === null) {
          delete next[id];
        } else {
          next[id] = value;
        }
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setDraftScores({});
  };

  const handleConfirmSave = () => {
    onSave(student.id, type, draftScores);
    onClose();
  };

  const handleDownloadExcel = async () => {
    if (!student || isExportingExcel) return;
    setIsExportingExcel(true);
    setExportError(null);
    try {
      await downloadCompetencyExcel({
        type,
        student,
        settings,
        scores: draftScores,
        monthLabel,
        year,
        periodLabel,
        periodFileSlug,
      });
    } catch (err) {
      console.error('Competency Excel export failed:', err);
      setExportError('មិនអាចបង្កើត File Excel បានទេ។ សូមព្យាយាមម្ដងទៀត។');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const statusBadgeClass =
    summary.status === 'completed'
      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      : summary.status === 'in_progress'
      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              ការអនុវត្តកម្មវិធីក្រៅម៉ោងសិក្សា · {periodLabel || `ខែ${monthLabel} ${year}`}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {title}
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span>
                ឈ្មោះសិស្ស៖{' '}
                <strong className="text-slate-900 dark:text-slate-100">{student.name}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>ភេទ {student.gender}</span>
              <span aria-hidden="true">·</span>
              <span>{settings.className}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="បិទ"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Calculation & Status Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadgeClass}`}
            >
              {summary.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Clock className="w-3.5 h-3.5" />
              )}
              <span>{COMPETENCY_STATUS_LABELS[summary.status]}</span>
              <span className="font-mono-num">
                ({summary.filledCount}/{summary.totalCount})
              </span>
            </span>

            <div className="text-xs text-slate-700 dark:text-slate-200 font-mono-num">
              ពិន្ទុសរុប៖{' '}
              <strong className="text-slate-900 dark:text-white">{summary.rawSum}</strong>
            </div>

            <div className="text-xs text-slate-700 dark:text-slate-200 font-mono-num">
              ធៀបមធ្យម ១០៖{' '}
              <strong className="text-blue-700 dark:text-blue-400 text-sm">
                {(summary.score10 ?? 0).toFixed(2)}
              </strong>
            </div>

            {summary.filledCount > 0 && (
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                និទ្ទេស៖ {summary.gradeLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {isSkills ? (
              <>
                <button
                  type="button"
                  onClick={() => handleFillAll(4)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>ដាក់ 4 ទាំងអស់</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFillAll(3)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  ដាក់ 3 ទាំងអស់
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleFillAll(1)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>ដាក់ 1 ទាំងអស់</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>សម្អាត</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {isSkills ? (
            <>
              {/* Scale legend */}
              <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-blue-800 dark:text-blue-300">កម្រិតពិន្ទុ៖</span>
                {SKILL_SCALE_OPTIONS.map((opt) => (
                  <span key={opt.value} className="font-mono-num">
                    <strong>{opt.shortLabel}</strong> = {opt.label}
                  </span>
                ))}
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                {SKILL_COMPETENCY_ACTIVITIES.map((act) => {
                  const val = draftScores[act.id];
                  return (
                    <div
                      key={act.id}
                      className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono-num flex items-center justify-center shrink-0 mt-0.5">
                          {act.order}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                          {act.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        {SKILL_SCALE_OPTIONS.map((opt) => {
                          const active = val === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleToggleItem(act.id, opt.value)}
                              title={`${opt.label} (${opt.value})`}
                              className={`min-w-[38px] h-9 px-2 rounded-lg text-xs font-bold font-mono-num border transition-all active:scale-95 ${
                                active
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                              }`}
                            >
                              {opt.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                កំណត់ចំណាំ៖ សកម្មភាពខាងលើ ជាការចូលរួមអនុវត្តរបស់សិស្សម្នាក់ៗ ។ ការផ្តល់ពិន្ទុត្រូវមានភស្តុតាងច្បាស់លាស់។ ពិន្ទុសរុបមិនឱ្យលើសពី ១(មួយ) ធៀបនឹងមធ្យមភាគ ១០,០០។
              </p>
            </>
          ) : (
            <>
              <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-blue-800 dark:text-blue-300">ការដាក់ពិន្ទុ៖</strong>{' '}
                  ១ = បានអនុវត្ត · ០ = មិនបានអនុវត្ត (សរុប ៧៨ សូចនករ មិនឱ្យលើសពី ១.០០ ធៀបនឹងមធ្យមភាគ ១០,០០)
                </span>
              </div>

              <div className="space-y-4">
                {ATTITUDE_COMPETENCY_SECTIONS.map((sec, sIdx) => {
                  const secIds = sec.items.map((i) => i.id);
                  const secFilled = sec.items.filter(
                    (i) => typeof draftScores[i.id] === 'number'
                  ).length;
                  const secSum = sec.items.reduce(
                    (acc, i) => acc + (typeof draftScores[i.id] === 'number' ? draftScores[i.id] : 0),
                    0
                  );

                  return (
                    <div
                      key={sec.key}
                      className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                    >
                      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {sIdx + 1}. {sec.title}
                          </span>
                          <span className="text-[11px] font-mono-num px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            ពិន្ទុសរុប = {secSum} ({secFilled}/{sec.items.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFillSection(secIds, 1)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                          >
                            ១ ទាំងអស់
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFillSection(secIds, 0)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                          >
                            ០ ទាំងអស់
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFillSection(secIds, null)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            សម្អាត
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sec.items.map((item) => {
                          const val = draftScores[item.id];
                          return (
                            <div
                              key={item.id}
                              className="px-3.5 py-2 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold font-mono-num flex items-center justify-center shrink-0 mt-0.5">
                                  {item.order}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                                  {item.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {[0, 1].map((optVal) => {
                                  const active = val === optVal;
                                  return (
                                    <button
                                      key={optVal}
                                      type="button"
                                      onClick={() => handleToggleItem(item.id, optVal)}
                                      className={`min-w-[40px] h-8 px-2 rounded-lg text-xs font-bold font-mono-num border transition-all active:scale-95 ${
                                        active
                                          ? optVal === 1
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                            : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                                      }`}
                                    >
                                      {optVal}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-white dark:bg-slate-900">
          <div className="min-w-0">
            <div className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
              លទ្ធផល៖{' '}
              <strong className="text-blue-700 dark:text-blue-400">
                {summary.filledCount > 0 ? (summary.score10 ?? 0).toFixed(2) : 'មិនទាន់រៀបចំ'}
              </strong>
            </div>
            {exportError && (
              <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                {exportError}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={isExportingExcel}
              className="min-h-[42px] px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 disabled:opacity-60 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
              )}
              <span>{isExportingExcel ? 'កំពុងបង្កើត Excel...' : 'ទាញយក Excel'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary min-h-[42px] px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              បោះបង់
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="btn-primary min-h-[42px] px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap"
            >
              រក្សាទុកពិន្ទុ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

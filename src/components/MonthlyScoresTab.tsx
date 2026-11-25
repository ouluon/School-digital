import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  RotateCcw,
  Search,
  Smartphone,
  Table2,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { TelegramButton } from './TelegramButton';
import { CompetencyRubricModal } from './CompetencyRubricModal';
import { HorizontalScrollStrip } from './HorizontalScrollStrip';
import { ScoreSummaryTable, buildScoreSummaryEntry } from './ScoreSummaryTable';
import {
  COMPETENCY_STATUS_LABELS,
  CompetencyType,
  evaluateCompetencyRubric,
} from '../constants/competencyRubrics';
import {
  COMPETENCY_SUBJECT_KEYS,
  ClassSettings,
  CompetencyRubricMap,
  KHMER_MONTHS,
  MONTHLY_SUBJECT_GROUPS,
  RemarksMap,
  ScoreMap,
  Student,
  getMonthlyScoresMonthYear,
  getResolvedMonthlySubjectGroups,
  getVisibleMonthlySubjectGroups,
  subjectHasScoresInMonth,
} from '../types/gradebook';
import { computeMonthlyResults, getYearOptions } from '../utils/calculations';

interface MonthlyScoresTabProps {
  settings: ClassSettings;
  students: Student[];
  monthlyScores: ScoreMap;
  competencyRubrics: CompetencyRubricMap;
  remarks: RemarksMap;
  isPreparingShare?: boolean;
  onChangeScore: (studentId: string, subjectKey: string, value: number | undefined) => void;
  onToggleAllKnowledge: (enable: boolean) => void;
  onSaveCompetencyRubric: (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => void;
  onChangeRemark: (studentId: string, value: string) => void;
  onChangeMonthYear: (month: number, year: number) => void;
  onChangeCustomSubjectLabels: (nextLabels: Record<string, string>) => void;
  onChangeHiddenMonthlySubjects: (nextHiddenKeys: string[]) => void;
  onClearMonthlySubjectColumn: (subjectKey: string) => void;
  onShareTelegram: () => void;
}

export const MonthlyScoresTab: React.FC<MonthlyScoresTabProps> = ({
  settings,
  students,
  monthlyScores,
  competencyRubrics,
  remarks,
  isPreparingShare = false,
  onChangeScore,
  onToggleAllKnowledge,
  onSaveCompetencyRubric,
  onChangeRemark,
  onChangeMonthYear,
  onChangeCustomSubjectLabels,
  onChangeHiddenMonthlySubjects,
  onClearMonthlySubjectColumn,
  onShareTelegram,
}) => {
  const [entryMode, setEntryMode] = useState<'bySubject' | 'byStudent' | 'sheet'>('bySubject');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(MONTHLY_SUBJECT_GROUPS[0].key);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(
    MONTHLY_SUBJECT_GROUPS[0].subjects[0].key
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [rubricModalState, setRubricModalState] = useState<{
    open: boolean;
    type: CompetencyType;
    student: Student | null;
  }>({ open: false, type: 'skills', student: null });
  const [showEditLabelsModal, setShowEditLabelsModal] = useState(false);
  const [editingGroupKey, setEditingGroupKey] = useState<string>(MONTHLY_SUBJECT_GROUPS[0].key);
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [showManageColumnsModal, setShowManageColumnsModal] = useState(false);
  const [manageGroupKey, setManageGroupKey] = useState<string>('all');
  const [columnActionNotice, setColumnActionNotice] = useState<{
    subjectKey: string;
    message: string;
    tone: 'warning' | 'success';
  } | null>(null);
  const [confirmClearColumnKey, setConfirmClearColumnKey] = useState<string | null>(null);

  const resolvedGroups = useMemo(
    () => getResolvedMonthlySubjectGroups(settings),
    [settings]
  );
  const visibleGroups = useMemo(
    () =>
      getVisibleMonthlySubjectGroups(
        settings,
        monthlyScores,
        students,
        competencyRubrics
      ),
    [settings, monthlyScores, students, competencyRubrics]
  );
  const visibleSubjects = useMemo(
    () => visibleGroups.flatMap((g) => g.subjects),
    [visibleGroups]
  );
  const visibleAcademicCount = useMemo(
    () =>
      visibleSubjects.filter((s) => !COMPETENCY_SUBJECT_KEYS.has(s.key)).length,
    [visibleSubjects]
  );
  const hiddenKeySet = useMemo(
    () => new Set(settings.hiddenMonthlySubjectKeys || []),
    [settings.hiddenMonthlySubjectKeys]
  );
  const effectivelyHiddenCount = useMemo(() => {
    let count = 0;
    for (const grp of resolvedGroups) {
      for (const sub of grp.subjects) {
        if (
          hiddenKeySet.has(sub.key) &&
          !subjectHasScoresInMonth(
            sub.key,
            students,
            monthlyScores,
            competencyRubrics
          ).hasScores
        ) {
          count++;
        }
      }
    }
    return count;
  }, [resolvedGroups, hiddenKeySet, students, monthlyScores, competencyRubrics]);

  const editableGroups = useMemo(
    () => resolvedGroups.filter((g) => g.subjects.length > 1 && !g.isCompetencyGroup),
    [resolvedGroups]
  );

  const defaultSubjectLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const grp of MONTHLY_SUBJECT_GROUPS) {
      for (const sub of grp.subjects) {
        map[sub.key] = sub.label;
      }
    }
    return map;
  }, []);

  const results = useMemo(
    () => computeMonthlyResults(students, monthlyScores, settings.maxScore),
    [students, monthlyScores, settings.maxScore]
  );

  useEffect(() => {
    const validGroup = visibleGroups.find((g) => g.key === selectedGroupKey);
    if (!validGroup) {
      const firstGrp = visibleGroups[0];
      if (firstGrp) {
        setSelectedGroupKey(firstGrp.key);
        if (firstGrp.subjects[0]) {
          setSelectedSubjectKey(firstGrp.subjects[0].key);
        }
      }
      return;
    }
    if (!validGroup.subjects.some((s) => s.key === selectedSubjectKey)) {
      if (validGroup.subjects[0]) {
        setSelectedSubjectKey(validGroup.subjects[0].key);
      }
    }
  }, [visibleGroups, selectedGroupKey, selectedSubjectKey]);

  const selectedGroup =
    visibleGroups.find((g) => g.key === selectedGroupKey) ||
    visibleGroups[0] ||
    resolvedGroups[0];

  const selectedSubject =
    selectedGroup.subjects.find((s) => s.key === selectedSubjectKey) ||
    selectedGroup.subjects[0] ||
    visibleSubjects[0];

  const handleSelectGroup = (groupKey: string) => {
    setSelectedGroupKey(groupKey);
    const grp = visibleGroups.find((g) => g.key === groupKey);
    if (grp && grp.subjects.length > 0) {
      setSelectedSubjectKey(grp.subjects[0].key);
    }
  };

  const openEditLabelsModal = (preferredGroupKey?: string) => {
    const targetKey =
      preferredGroupKey && editableGroups.some((g) => g.key === preferredGroupKey)
        ? preferredGroupKey
        : editableGroups[0]?.key || MONTHLY_SUBJECT_GROUPS[0].key;
    const initialDraft: Record<string, string> = {};
    for (const grp of editableGroups) {
      for (const sub of grp.subjects) {
        initialDraft[sub.key] = sub.label;
      }
    }
    setEditingGroupKey(targetKey);
    setDraftLabels(initialDraft);
    setShowEditLabelsModal(true);
  };

  const handleDraftLabelChange = (subKey: string, rawValue: string) => {
    setDraftLabels((prev) => ({ ...prev, [subKey]: rawValue }));
    const trimmed = rawValue.trim().slice(0, 60);
    if (!trimmed) return;
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    const nextCustom = { ...(settings.customSubjectLabels || {}) };
    if (trimmed === defaultLabel) {
      delete nextCustom[subKey];
    } else {
      nextCustom[subKey] = trimmed;
    }
    onChangeCustomSubjectLabels(nextCustom);
  };

  const handleBlurDraftLabel = (subKey: string) => {
    const current = draftLabels[subKey] ?? '';
    const trimmed = current.trim().slice(0, 60);
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    if (!trimmed) {
      setDraftLabels((prev) => ({ ...prev, [subKey]: defaultLabel }));
      if (settings.customSubjectLabels?.[subKey]) {
        const nextCustom = { ...(settings.customSubjectLabels || {}) };
        delete nextCustom[subKey];
        onChangeCustomSubjectLabels(nextCustom);
      }
    } else if (trimmed !== current) {
      setDraftLabels((prev) => ({ ...prev, [subKey]: trimmed }));
    }
  };

  const handleResetSingleLabel = (subKey: string) => {
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    setDraftLabels((prev) => ({ ...prev, [subKey]: defaultLabel }));
    if (settings.customSubjectLabels?.[subKey]) {
      const nextCustom = { ...(settings.customSubjectLabels || {}) };
      delete nextCustom[subKey];
      onChangeCustomSubjectLabels(nextCustom);
    }
  };

  const handleResetGroupLabels = (groupKey: string) => {
    const defaultGrp = MONTHLY_SUBJECT_GROUPS.find((g) => g.key === groupKey);
    if (!defaultGrp) return;
    const nextCustom = { ...(settings.customSubjectLabels || {}) };
    const nextDraft = { ...draftLabels };
    for (const sub of defaultGrp.subjects) {
      delete nextCustom[sub.key];
      nextDraft[sub.key] = sub.label;
    }
    setDraftLabels(nextDraft);
    onChangeCustomSubjectLabels(nextCustom);
  };

  const closeEditLabelsModal = () => {
    const nextCustom = { ...(settings.customSubjectLabels || {}) };
    let changed = false;
    for (const grp of editableGroups) {
      for (const sub of grp.subjects) {
        const val = (draftLabels[sub.key] ?? '').trim().slice(0, 60);
        const def = defaultSubjectLabelMap[sub.key] || '';
        if (!val || val === def) {
          if (sub.key in nextCustom) {
            delete nextCustom[sub.key];
            changed = true;
          }
        } else if (nextCustom[sub.key] !== val) {
          nextCustom[sub.key] = val;
          changed = true;
        }
      }
    }
    if (changed) {
      onChangeCustomSubjectLabels(nextCustom);
    }
    setShowEditLabelsModal(false);
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const parseScoreInput = (raw: string): number | undefined => {
    if (raw.trim() === '') return undefined;
    const num = Number(raw);
    if (Number.isNaN(num)) return undefined;
    return Math.max(0, Math.min(settings.maxScore, num));
  };

  const { month: activeMonth, year: activeYear } = getMonthlyScoresMonthYear(settings);

  const monthLabel =
    KHMER_MONTHS.find((m) => m.value === activeMonth)?.label || '';

  const summaryEntries = useMemo(
    () => [
      buildScoreSummaryEntry('monthly', `ខែ${monthLabel}`, students, (stu) => {
        const res = results[stu.id];
        const hasScore = (res?.enteredCount ?? 0) > 0 || (res?.average ?? 0) > 0;
        return {
          average: res?.average ?? 0,
          grade: res?.grade ?? 'F',
          hasScore,
        };
      }),
    ],
    [monthLabel, students, results]
  );

  const isKnowledgeSubject = selectedSubject.key === 'comp_knowledge';
  const isSkillsSubject = selectedSubject.key === 'comp_skills';
  const isAttitudeSubject = selectedSubject.key === 'comp_attitude';
  const isRubricSubject = isSkillsSubject || isAttitudeSubject;

  const allKnowledgeEnabled =
    students.length > 0 &&
    students.every((s) => monthlyScores[s.id]?.['comp_knowledge'] === 80);

  const openCompetencyRubric = (student: Student, type: CompetencyType) => {
    setRubricModalState({ open: true, type, student });
  };

  const getCompetencyStatusUi = (studentId: string, type: CompetencyType) => {
    const scoreKey = type === 'skills' ? 'comp_skills' : 'comp_attitude';
    const rawRubric = competencyRubrics[studentId]?.[type];
    const fallbackVal = monthlyScores[studentId]?.[scoreKey];
    const evalRes = evaluateCompetencyRubric(type, rawRubric, fallbackVal);
    const badgeClass =
      evalRes.status === 'completed'
        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
        : evalRes.status === 'in_progress'
        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
        : 'bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    return {
      ...evalRes,
      badgeClass,
      label: COMPETENCY_STATUS_LABELS[evalRes.status],
    };
  };

  const openManageColumnsModal = (preferredGroupKey?: string) => {
    setManageGroupKey(preferredGroupKey || 'all');
    setColumnActionNotice(null);
    setConfirmClearColumnKey(null);
    setShowManageColumnsModal(true);
  };

  const handleToggleHideSubject = (subKey: string, subLabel: string) => {
    setConfirmClearColumnKey(null);
    const { hasScores, count } = subjectHasScoresInMonth(
      subKey,
      students,
      monthlyScores,
      competencyRubrics
    );
    const isCurrentlyHidden = hiddenKeySet.has(subKey) && !hasScores;

    if (isCurrentlyHidden) {
      const next = (settings.hiddenMonthlySubjectKeys || []).filter(
        (k) => k !== subKey
      );
      onChangeHiddenMonthlySubjects(next);
      setColumnActionNotice(null);
      return;
    }

    if (hasScores) {
      setColumnActionNotice({
        subjectKey: subKey,
        tone: 'warning',
        message: `មិនអាចលាក់ជួរ «${subLabel}» បានទេ ព្រោះមានពិន្ទុសិស្សចំនួន ${count} នាក់ក្នុងខែ${monthLabel}។ សូមលុបពិន្ទុក្នុងជួរនេះជាមុនសិន!`,
      });
      return;
    }

    if (visibleSubjects.length <= 1) {
      setColumnActionNotice({
        subjectKey: subKey,
        tone: 'warning',
        message: 'ត្រូវរក្សាទុកយ៉ាងតិច ១ មុខវិជ្ជារងសម្រាប់បង្ហាញក្នុងតារាង។',
      });
      return;
    }

    const nextSet = new Set(settings.hiddenMonthlySubjectKeys || []);
    nextSet.add(subKey);
    onChangeHiddenMonthlySubjects(Array.from(nextSet));
    setColumnActionNotice(null);
  };

  const handleConfirmClearColumn = (subKey: string, subLabel: string) => {
    if (confirmClearColumnKey !== subKey) {
      setConfirmClearColumnKey(subKey);
      return;
    }
    onClearMonthlySubjectColumn(subKey);
    setConfirmClearColumnKey(null);
    setColumnActionNotice({
      subjectKey: subKey,
      tone: 'success',
      message: `ពិន្ទុក្នុងជួរ «${subLabel}» ត្រូវបានលុបរួចរាល់។ ឥឡូវអ្នកអាចចុច «លាក់ជួរនេះ» បានហើយ។`,
    });
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Top Mode & Month/Year Selector Bar */}
      <div className="w-full min-w-0 surface-card rounded-2xl p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap max-w-full">
            <select
              aria-label="ជ្រើសរើសខែបញ្ចូលពិន្ទុ"
              value={activeMonth}
              onChange={(e) => onChangeMonthYear(Number(e.target.value), activeYear)}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {KHMER_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  ខែ{m.label}
                </option>
              ))}
            </select>
            <select
              aria-label="ជ្រើសរើសឆ្នាំ"
              value={activeYear}
              onChange={(e) => onChangeMonthYear(activeMonth, Number(e.target.value))}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 text-sm font-semibold font-mono-num text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {getYearOptions(activeYear).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="min-h-[44px] px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              <span>ឆ្នាំសិក្សា</span>
              <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                {settings.academicYear}
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              ពិន្ទុអតិបរមា{' '}
              <span className="font-mono-num font-bold text-blue-700 dark:text-blue-400">
                {settings.maxScore}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap max-w-full">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 rounded-xl max-w-full">
              <button
                type="button"
                onClick={() => setEntryMode('bySubject')}
                className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  entryMode === 'bySubject'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>តាមមុខវិជ្ជា</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('byStudent')}
                className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  entryMode === 'byStudent'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>តាមសិស្ស</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('sheet')}
                className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  entryMode === 'sheet'
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>តារាង Sheet</span>
              </button>
            </div>

            <TelegramButton
              onClick={onShareTelegram}
              isLoading={isPreparingShare}
            />
          </div>
        </div>
      </div>

      {entryMode === 'bySubject' && (
        <>
          <ScoreSummaryTable
            subtitle={`ខែ${monthLabel} ${activeYear}`}
            maxScore={settings.maxScore}
            entries={summaryEntries}
          />

          {/* Subject Group & Sub-skill Selector */}
          <div className="w-full min-w-0 surface-card rounded-2xl p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ១. ជ្រើសរើសក្រុមមុខវិជ្ជា (ខែ{monthLabel} {activeYear})
                </div>
                <button
                  type="button"
                  onClick={() => openManageColumnsModal('all')}
                  className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>
                    លាក់/បង្ហាញមុខវិជ្ជារង
                    {effectivelyHiddenCount > 0 ? ` (${effectivelyHiddenCount})` : ''}
                  </span>
                </button>
              </div>
              <HorizontalScrollStrip className="pb-0.5" ariaLabel="ជ្រើសរើសក្រុមមុខវិជ្ជា">
                {visibleGroups.map((grp) => (
                  <button
                    key={grp.key}
                    type="button"
                    onClick={() => handleSelectGroup(grp.key)}
                    className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 ${
                      selectedGroup.key === grp.key
                        ? 'btn-primary border-blue-600'
                        : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    {grp.label}
                  </button>
                ))}
              </HorizontalScrollStrip>
            </div>

            {(selectedGroup.subjects.length > 1 ||
              (!selectedGroup.standalone && !selectedGroup.isCompetencyGroup)) && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    ២. ជ្រើសរើសមុខវិជ្ជារង ({selectedGroup.label})
                  </div>
                  {!selectedGroup.isCompetencyGroup && (
                    <button
                      type="button"
                      onClick={() => openEditLabelsModal(selectedGroup.key)}
                      className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>កែចំណងជើងមុខវិជ្ជារង</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedGroup.subjects.map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setSelectedSubjectKey(sub.key)}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap ${
                        selectedSubject.key === sub.key
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-300 dark:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.5)]'
                          : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះសិស្ស..."
              className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Fast Score List */}
          {students.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center space-y-1.5">
              <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                គ្មានទិន្នន័យសិស្ស
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                សូមចូលគណនី ឬចូលទៅផ្ទាំង «គ្រូ/សិស្ស» ដើម្បីបន្ថែមសិស្ស។
              </p>
            </div>
          ) : (
            <div className="surface-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">
                    ខែ{monthLabel} · {selectedGroup.label} — {selectedSubject.label}
                  </span>
                  {selectedGroup.subjects.length > 1 && !selectedGroup.isCompetencyGroup && (
                    <button
                      type="button"
                      onClick={() => openEditLabelsModal(selectedGroup.key)}
                      title="កែចំណងជើងមុខវិជ្ជារង"
                      aria-label="កែចំណងជើងមុខវិជ្ជារង"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isKnowledgeSubject ? (
                  <button
                    type="button"
                    onClick={() => onToggleAllKnowledge(!allKnowledgeEnabled)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors shrink-0 ${
                      allKnowledgeEnabled
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {allKnowledgeEnabled ? 'លុប 80% ទាំងអស់' : 'ដាក់ 80% ទាំងអស់'}
                  </button>
                ) : isRubricSubject ? (
                  <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 shrink-0">
                    ចុចលើជួរឈ្មោះសិស្សដើម្បីបំពេញសូចនករ
                  </span>
                ) : (
                  <span className="font-mono-num text-slate-500 dark:text-slate-400 shrink-0">
                    ០ – {settings.maxScore}
                  </span>
                )}
              </div>
              {filteredStudents.map((stu) => {
                const idx = students.findIndex((s) => s.id === stu.id);
                const val = monthlyScores[stu.id]?.[selectedSubject.key];
                const res = results[stu.id];
                const rubricType: CompetencyType = isSkillsSubject ? 'skills' : 'attitude';
                const statusUi = isRubricSubject
                  ? getCompetencyStatusUi(stu.id, rubricType)
                  : null;
                const is80Set = val === 80;

                return (
                  <div
                    key={stu.id}
                    onClick={
                      isRubricSubject
                        ? () => openCompetencyRubric(stu, rubricType)
                        : undefined
                    }
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                      isRubricSubject
                        ? 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold font-mono-num flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {stu.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>{stu.gender}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num text-red-600 dark:text-red-400 font-semibold">
                            មធ្យម {res?.average.toFixed(2) ?? '0.00'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                            ចំណាត់ #{res?.rank ?? 1} ({res?.grade ?? 'F'})
                          </span>
                        </div>
                      </div>
                    </div>

                    {isKnowledgeSubject ? (
                      <button
                        type="button"
                        onClick={() =>
                          onChangeScore(
                            stu.id,
                            'comp_knowledge',
                            is80Set ? undefined : 80
                          )
                        }
                        aria-pressed={is80Set}
                        aria-label={`វិជ្ជាសម្បទា សម្រាប់ ${stu.name}`}
                        className={`min-w-[96px] min-h-[46px] px-3 rounded-xl border text-center text-sm sm:text-base font-bold font-mono-num transition-all active:scale-95 shrink-0 ${
                          is80Set
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/90 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500'
                        }`}
                      >
                        {is80Set ? '80%' : '—'}
                      </button>
                    ) : isRubricSubject && statusUi ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCompetencyRubric(stu, rubricType);
                        }}
                        aria-label={`${selectedSubject.label} សម្រាប់ ${stu.name}: ${statusUi.label}`}
                        className={`min-w-[132px] min-h-[46px] px-3 py-1.5 rounded-xl border text-center transition-all active:scale-95 shrink-0 flex flex-col items-center justify-center ${statusUi.badgeClass}`}
                      >
                        <span className="text-xs font-bold leading-tight">
                          {statusUi.label}
                        </span>
                        {statusUi.status !== 'not_started' && (
                          <span className="text-[10px] font-mono-num font-semibold opacity-90 mt-0.5">
                            {statusUi.filledCount > 0
                              ? `${statusUi.filledCount}/${statusUi.totalCount} · ${(statusUi.score10 ?? 0).toFixed(2)}`
                              : `${(statusUi.score10 ?? 0).toFixed(2)}`}
                          </span>
                        )}
                      </button>
                    ) : (
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.25"
                        min={0}
                        max={settings.maxScore}
                        value={val === undefined ? '' : val}
                        onChange={(e) =>
                          onChangeScore(
                            stu.id,
                            selectedSubject.key,
                            parseScoreInput(e.target.value)
                          )
                        }
                        placeholder="0"
                        aria-label={`ពិន្ទុ ${selectedSubject.label} សម្រាប់ ${stu.name}`}
                        className="w-24 min-h-[46px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-center text-base font-bold font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {entryMode === 'byStudent' && (
        <>
          <ScoreSummaryTable
            subtitle={`ខែ${monthLabel} ${activeYear}`}
            maxScore={settings.maxScore}
            entries={summaryEntries}
          />

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះសិស្សដើម្បីបញ្ចូលពិន្ទុ..."
              className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {students.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center space-y-1.5">
              <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                គ្មានទិន្នន័យសិស្ស
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                សូមចូលគណនី ឬចូលទៅផ្ទាំង «គ្រូ/សិស្ស» ដើម្បីបន្ថែមសិស្ស។
              </p>
            </div>
          ) : (
            <div className="surface-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((stu) => {
                const idx = students.findIndex((s) => s.id === stu.id);
                const res = results[stu.id];
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => setActiveStudent(stu)}
                    className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold font-mono-num flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {stu.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                          ខែ{monthLabel} · បានបញ្ចូល {res?.enteredCount ?? 0}/{visibleAcademicCount} · សរុប{' '}
                          {res?.total.toFixed(2) ?? '0.00'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono-num text-red-600 dark:text-red-400">
                          {res?.average.toFixed(2) ?? '0.00'}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 font-mono-num">
                          #{res?.rank ?? 1} · {res?.grade ?? 'F'}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {entryMode === 'sheet' && (
        /* Exact Sheet 2 Preview matching Screenshot 2 */
        <div className="w-full min-w-0 surface-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              ទម្រង់តារាង Google Sheet: ពិន្ទុប្រចាំខែ (ខែ{monthLabel} {activeYear})
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span>ចុចលើឈ្មោះសិស្សដើម្បីបញ្ចូលពិន្ទុ</span>
              <button
                type="button"
                onClick={() => openManageColumnsModal('all')}
                className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <EyeOff className="w-3 h-3" />
                <span>
                  លាក់/បង្ហាញមុខវិជ្ជារង
                  {effectivelyHiddenCount > 0 ? ` (${effectivelyHiddenCount})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => openEditLabelsModal(selectedGroup.key)}
                className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <Pencil className="w-3 h-3" />
                <span>កែមុខវិជ្ជារង</span>
              </button>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-900 dark:text-slate-100">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">លេខរៀង</span>
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-left min-w-[150px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10"
                  >
                    គោត្តនាម និងនាម
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center"
                  >
                    ភេទ
                  </th>
                  {visibleGroups.map((grp) =>
                    grp.standalone ? (
                      <th
                        key={grp.key}
                        rowSpan={2}
                        onClick={() => openManageColumnsModal(grp.key)}
                        title="ចុចដើម្បីលាក់ ឬបង្ហាញមុខវិជ្ជានេះ"
                        className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors"
                      >
                        <span className="vertical-th inline-block max-h-[120px]">
                          {grp.subjects[0]?.label || grp.label}
                        </span>
                      </th>
                    ) : (
                      <th
                        key={grp.key}
                        colSpan={grp.subjects.length}
                        className={`border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center ${
                          grp.isCompetencyGroup
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                            : ''
                        }`}
                      >
                        {grp.label}
                      </th>
                    )
                  )}
                  <th colSpan={4} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    លទ្ធផលប្រចាំខែ
                  </th>
                  <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">សេចក្តីផ្សេងៗ</span>
                  </th>
                </tr>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                  {visibleGroups
                    .filter((g) => !g.standalone)
                    .flatMap((g) => g.subjects)
                    .map((sub) => (
                      <th
                        key={sub.key}
                        onClick={() => openManageColumnsModal(sub.groupKey)}
                        title="ចុចដើម្បីលាក់ ឬបង្ហាញជួរមុខវិជ្ជារងនេះ"
                        className="border border-slate-300 dark:border-slate-700 px-1 py-2 text-center h-[128px] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors"
                      >
                        <span className="vertical-th inline-block">{sub.label}</span>
                      </th>
                    ))}
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">ពិន្ទុសរុប</span>
                  </th>
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">មធ្យមភាគ</span>
                  </th>
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">ចំណាត់ថ្នាក់</span>
                  </th>
                  <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                    <span className="vertical-th inline-block">និទ្ទេស</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((stu, idx) => {
                  const sScores = monthlyScores[stu.id] || {};
                  const res = results[stu.id];
                  return (
                    <tr
                      key={stu.id}
                      onClick={() => setActiveStudent(stu)}
                      className="hover:bg-blue-50/40 dark:hover:bg-blue-950/40 cursor-pointer"
                    >
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center font-mono-num">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-left font-medium sticky left-0 bg-white dark:bg-slate-900 z-10 whitespace-nowrap">
                        {stu.name}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center">
                        {stu.gender}
                      </td>
                      {visibleSubjects.map((sub) => {
                        const rawVal = sScores[sub.key];
                        let displayVal: string | number = '';
                        if (sub.key === 'comp_knowledge') {
                          displayVal = rawVal === 80 ? '80%' : '';
                        } else if (
                          sub.key === 'comp_skills' ||
                          sub.key === 'comp_attitude'
                        ) {
                          displayVal =
                            typeof rawVal === 'number' && !Number.isNaN(rawVal)
                              ? rawVal.toFixed(2)
                              : '';
                        } else {
                          displayVal = rawVal ?? '';
                        }
                        return (
                          <td
                            key={sub.key}
                            className={`border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center font-mono-num ${
                              sub.key === 'comp_knowledge' && rawVal === 80
                                ? 'text-blue-700 dark:text-blue-400 font-semibold'
                                : ''
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num text-slate-700 dark:text-slate-300">
                        {res?.total.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.average.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.rank ?? 1}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-bold text-red-600 dark:text-red-400">
                        {res?.grade ?? 'F'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center text-slate-600 dark:text-slate-300">
                        {remarks[stu.id] || ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Detail Score Entry Bottom Sheet / Modal */}
      {activeStudent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeStudent.name} · ខែ{monthLabel}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono-num">
                  <span>{activeStudent.gender}</span>
                  <span>·</span>
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    មធ្យមភាគ {results[activeStudent.id]?.average.toFixed(2) ?? '0.00'}
                  </span>
                  <span>·</span>
                  <span>និទ្ទេស {results[activeStudent.id]?.grade ?? 'F'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                aria-label="បិទ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {visibleGroups.map((grp) => (
                <div key={grp.key} className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 pb-1 border-b border-slate-100 dark:border-slate-800">
                    {grp.label}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {grp.subjects.map((sub) => {
                      const val = monthlyScores[activeStudent.id]?.[sub.key];
                      if (sub.key === 'comp_knowledge') {
                        const is80Set = val === 80;
                        return (
                          <div
                            key={sub.key}
                            className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                          >
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {sub.label}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeScore(
                                  activeStudent.id,
                                  'comp_knowledge',
                                  is80Set ? undefined : 80
                                )
                              }
                              className={`w-24 min-h-[40px] px-2 rounded-lg border text-center text-sm font-bold font-mono-num transition-all active:scale-95 ${
                                is80Set
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {is80Set ? '80%' : '—'}
                            </button>
                          </div>
                        );
                      }
                      if (sub.key === 'comp_skills' || sub.key === 'comp_attitude') {
                        const rType: CompetencyType =
                          sub.key === 'comp_skills' ? 'skills' : 'attitude';
                        const statusUi = getCompetencyStatusUi(activeStudent.id, rType);
                        return (
                          <div
                            key={sub.key}
                            className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                          >
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {sub.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => openCompetencyRubric(activeStudent, rType)}
                              className={`min-w-[110px] min-h-[40px] px-2.5 py-1 rounded-lg border text-center transition-all active:scale-95 flex flex-col items-center justify-center ${statusUi.badgeClass}`}
                            >
                              <span className="text-[11px] font-bold leading-tight">
                                {statusUi.label}
                              </span>
                              {statusUi.status !== 'not_started' && (
                                <span className="text-[10px] font-mono-num opacity-90">
                                  {(statusUi.score10 ?? 0).toFixed(2)}
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <label
                          key={sub.key}
                          className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                        >
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {sub.label}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            min={0}
                            max={settings.maxScore}
                            value={val === undefined ? '' : val}
                            onChange={(e) =>
                              onChangeScore(
                                activeStudent.id,
                                sub.key,
                                parseScoreInput(e.target.value)
                              )
                            }
                            placeholder="0"
                            className="w-20 min-h-[40px] px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  សេចក្តីផ្សេងៗ
                </label>
                <input
                  type="text"
                  value={remarks[activeStudent.id] || ''}
                  onChange={(e) => onChangeRemark(activeStudent.id, e.target.value)}
                  placeholder="កំណត់សម្គាល់បន្ថែម..."
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="btn-primary w-full min-h-[46px] rounded-xl text-sm font-semibold"
              >
                រួចរាល់
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Sub-Subject Titles Modal (Per Teacher Account) */}
      {showEditLabelsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="កែប្រែចំណងជើងមុខវិជ្ជារង"
        >
          <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  កែប្រែចំណងជើងមុខវិជ្ជារង
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  រក្សាទុកសម្រាប់តែគណនីរបស់អ្នកប៉ុណ្ណោះ មិនប៉ះពាល់ដល់គណនីគ្រូផ្សេងទេ។
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditLabelsModal}
                aria-label="បិទ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject Group Selector Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {editableGroups.map((grp) => (
                <button
                  key={grp.key}
                  type="button"
                  onClick={() => setEditingGroupKey(grp.key)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    editingGroupKey === grp.key
                      ? 'btn-primary border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>

            {/* Sub-Subject Inputs for Selected Group */}
            {(() => {
              const activeEditGroup =
                MONTHLY_SUBJECT_GROUPS.find((g) => g.key === editingGroupKey) ||
                MONTHLY_SUBJECT_GROUPS[0];
              const hasGroupOverrides = activeEditGroup.subjects.some(
                (s) => Boolean(settings.customSubjectLabels?.[s.key])
              );
              return (
                <div className="overflow-y-auto p-5 space-y-3.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      មុខវិជ្ជារងក្នុង «{activeEditGroup.label}»
                    </span>
                    {hasGroupOverrides && (
                      <button
                        type="button"
                        onClick={() => handleResetGroupLabels(activeEditGroup.key)}
                        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ស្ដារឈ្មោះដើមក្រុមនេះ</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {activeEditGroup.subjects.map((defaultSub, idx) => {
                      const draftVal = draftLabels[defaultSub.key] ?? defaultSub.label;
                      const isModified = draftVal.trim() !== defaultSub.label;
                      return (
                        <div key={defaultSub.key} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>
                              {idx + 1}. លំនាំដើម៖ {defaultSub.label}
                            </span>
                            {isModified && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleLabel(defaultSub.key)}
                                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>ដើម</span>
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            maxLength={60}
                            value={draftVal}
                            onChange={(e) =>
                              handleDraftLabelChange(defaultSub.key, e.target.value)
                            }
                            onBlur={() => handleBlurDraftLabel(defaultSub.key)}
                            placeholder={defaultSub.label}
                            aria-label={`ចំណងជើងមុខវិជ្ជារង ${defaultSub.label}`}
                            className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={closeEditLabelsModal}
                className="btn-primary w-full min-h-[46px] rounded-xl text-sm font-semibold"
              >
                រួចរាល់
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Hidden / Visible Sub-Subject Columns Modal */}
      {showManageColumnsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="លាក់ ឬបង្ហាញជួរមុខវិជ្ជារង"
        >
          <div className="w-full sm:max-w-xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  លាក់ ឬបង្ហាញជួរមុខវិជ្ជារង (ខែ{monthLabel} {activeYear})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  អាចលាក់បានតែជួរមុខវិជ្ជារងដែលគ្មានពិន្ទុ។ បើមានពិន្ទុ ត្រូវលុបពិន្ទុជាមុនសិន។
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageColumnsModal(false)}
                aria-label="បិទ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Filter Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setManageGroupKey('all')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  manageGroupKey === 'all'
                    ? 'btn-primary border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                }`}
              >
                ទាំងអស់
              </button>
              {resolvedGroups.map((grp) => (
                <button
                  key={grp.key}
                  type="button"
                  onClick={() => setManageGroupKey(grp.key)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    manageGroupKey === grp.key
                      ? 'btn-primary border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              {columnActionNotice && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border flex items-start gap-2 ${
                    columnActionNotice.tone === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{columnActionNotice.message}</span>
                </div>
              )}

              {resolvedGroups
                .filter((g) => manageGroupKey === 'all' || g.key === manageGroupKey)
                .map((grp) => (
                  <div
                    key={grp.key}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100">
                      {grp.label}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {grp.subjects.map((sub) => {
                        const { hasScores, count } = subjectHasScoresInMonth(
                          sub.key,
                          students,
                          monthlyScores,
                          competencyRubrics
                        );
                        const isHidden = hiddenKeySet.has(sub.key) && !hasScores;
                        const isConfirmingClear = confirmClearColumnKey === sub.key;
                        const isLastVisible = !isHidden && visibleSubjects.length <= 1;

                        return (
                          <div
                            key={sub.key}
                            className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 ${
                              isHidden
                                ? 'bg-slate-50/70 dark:bg-slate-900/50'
                                : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <div className="min-w-0">
                              <div
                                className={`text-xs sm:text-sm font-semibold ${
                                  isHidden
                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {sub.label}
                              </div>
                              <div className="text-[11px] mt-0.5">
                                {isHidden ? (
                                  <span className="text-slate-500 dark:text-slate-400">
                                    កំពុងលាក់ពីតារាង
                                  </span>
                                ) : hasScores ? (
                                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                                    មានពិន្ទុ {count} នាក់ · ត្រូវលុបពិន្ទុជាមុនសិនទើបអាចលាក់បាន
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    គ្មានពិន្ទុ (អាចលាក់បាន)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasScores && !isHidden && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleConfirmClearColumn(sub.key, sub.label)
                                  }
                                  className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1 whitespace-nowrap ${
                                    isConfirmingClear
                                      ? 'bg-rose-600 text-white border-rose-600 hover:bg-rose-700'
                                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60'
                                  }`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>
                                    {isConfirmingClear
                                      ? 'ចុចម្ដងទៀតដើម្បីលុប'
                                      : 'លុបពិន្ទុជួរនេះ'}
                                  </span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleToggleHideSubject(sub.key, sub.label)}
                                disabled={isLastVisible}
                                className={`min-h-[34px] px-3 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                                  isHidden
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/70'
                                    : hasScores || isLastVisible
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                              >
                                {isHidden ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>បង្ហាញវិញ</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>លាក់ជួរនេះ</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
              {effectivelyHiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onChangeHiddenMonthlySubjects([]);
                    setColumnActionNotice(null);
                    setConfirmClearColumnKey(null);
                  }}
                  className="btn-secondary min-h-[44px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>បង្ហាញទាំងអស់វិញ</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  បង្ហាញគ្រប់ជួរ ({visibleSubjects.length}/{resolvedGroups.flatMap((g) => g.subjects).length})
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowManageColumnsModal(false)}
                className="btn-primary min-h-[44px] px-6 rounded-xl text-sm font-semibold ml-auto"
              >
                រួចរាល់
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Competency Indicator Rubric Modal (បំណិនសម្បទា / ចរិយាសម្បទា) */}
      <CompetencyRubricModal
        open={rubricModalState.open}
        type={rubricModalState.type}
        student={rubricModalState.student}
        settings={settings}
        monthLabel={monthLabel}
        year={activeYear}
        initialScores={
          rubricModalState.student
            ? competencyRubrics[rubricModalState.student.id]?.[rubricModalState.type]
            : undefined
        }
        onSave={onSaveCompetencyRubric}
        onClose={() =>
          setRubricModalState((prev) => ({ ...prev, open: false }))
        }
      />
    </div>
  );
};

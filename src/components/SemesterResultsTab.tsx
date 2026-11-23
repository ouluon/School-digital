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
  DOMAIN_GRADES,
  DomainGradeMap,
  KHMER_MONTHS,
  MonthlyScoresByMonth,
  RemarksMap,
  SEMESTER_COMPETENCY_SUBJECTS,
  SEMESTER_EXAM_SUBJECTS,
  ScoreMap,
  Student,
  getResolvedSemesterExamSubjects,
  getVisibleAnnualCompetencySubjects,
  getVisibleSemesterSubjects,
  subjectHasScoresInSemester,
} from '../types/gradebook';
import {
  computeAnnualResults,
  computeCombinedMonthlyResults,
  computeSemesterResults,
  getCalendarYearForAcademicMonth,
} from '../utils/calculations';

interface SemesterResultsTabProps {
  settings: ClassSettings;
  students: Student[];
  monthlyScoresByMonth: MonthlyScoresByMonth;
  semesterScores: ScoreMap;
  competencyRubrics: CompetencyRubricMap;
  domainGrades: DomainGradeMap;
  semester1Scores: ScoreMap;
  annualScores: ScoreMap;
  annualCompetencyRubrics: CompetencyRubricMap;
  annualDomainGrades: DomainGradeMap;
  remarks: RemarksMap;
  isPreparingShare?: boolean;
  onChangeSemester: (semester: 1 | 2) => void;
  onToggleSemesterMonth: (semester: 1 | 2, month: number) => void;
  onChangeSemesterScore: (studentId: string, subjectKey: string, value: number | undefined) => void;
  onToggleAllSemesterKnowledge: (enable: boolean) => void;
  onSaveSemesterCompetencyRubric: (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => void;
  onChangeDomainGrade: (studentId: string, domainKey: string, value: string) => void;
  onChangeAnnualScore: (studentId: string, subjectKey: string, value: number | undefined) => void;
  onToggleAllAnnualKnowledge: (enable: boolean) => void;
  onSaveAnnualCompetencyRubric: (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => void;
  onChangeAnnualDomainGrade: (studentId: string, domainKey: string, value: string) => void;
  onChangeRemark: (studentId: string, value: string) => void;
  onChangeCustomSemesterSubjectLabels: (nextLabels: Record<string, string>) => void;
  onChangeHiddenSemesterSubjects: (nextHiddenKeys: string[]) => void;
  onClearSemesterSubjectColumn: (subjectKey: string) => void;
  onChangeHiddenAnnualCompetencies: (nextHiddenKeys: string[]) => void;
  onClearAnnualSubjectColumn: (subjectKey: string) => void;
  onShareTelegram: () => void;
}

const DOMAIN_OPTIONS = ['', 'A', 'B', 'C', 'D', 'E', 'F'];

export const SemesterResultsTab: React.FC<SemesterResultsTabProps> = ({
  settings,
  students,
  monthlyScoresByMonth,
  semesterScores,
  competencyRubrics,
  domainGrades,
  semester1Scores,
  annualScores,
  annualCompetencyRubrics,
  annualDomainGrades,
  remarks,
  isPreparingShare = false,
  onChangeSemester,
  onToggleSemesterMonth,
  onChangeSemesterScore,
  onToggleAllSemesterKnowledge,
  onSaveSemesterCompetencyRubric,
  onChangeDomainGrade,
  onChangeAnnualScore,
  onToggleAllAnnualKnowledge,
  onSaveAnnualCompetencyRubric,
  onChangeAnnualDomainGrade,
  onChangeRemark,
  onChangeCustomSemesterSubjectLabels,
  onChangeHiddenSemesterSubjects,
  onClearSemesterSubjectColumn,
  onChangeHiddenAnnualCompetencies,
  onClearAnnualSubjectColumn,
  onShareTelegram,
}) => {
  const [entryMode, setEntryMode] = useState<'bySubject' | 'byStudent' | 'sheet'>('bySubject');
  const [selectedSubKey, setSelectedSubKey] = useState<string>(SEMESTER_EXAM_SUBJECTS[0].key);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [rubricModalState, setRubricModalState] = useState<{
    open: boolean;
    type: CompetencyType;
    student: Student | null;
    scope: 'semester' | 'annual';
  }>({ open: false, type: 'skills', student: null, scope: 'semester' });
  const [showEditLabelsModal, setShowEditLabelsModal] = useState(false);
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const [showManageColumnsModal, setShowManageColumnsModal] = useState(false);
  const [manageGroupKey, setManageGroupKey] = useState<'all' | 'exam' | 'comp' | 'annual_comp'>('all');
  const [columnActionNotice, setColumnActionNotice] = useState<{
    actionKey: string;
    message: string;
    tone: 'warning' | 'success';
  } | null>(null);
  const [confirmClearColumnKey, setConfirmClearColumnKey] = useState<string | null>(null);

  const resolvedSubjects = useMemo(
    () => getResolvedSemesterExamSubjects(settings),
    [settings]
  );

  const { examSubjects: visibleExamSubjects, competencySubjects: visibleCompSubjects } =
    useMemo(
      () =>
        getVisibleSemesterSubjects(
          settings,
          semesterScores,
          students,
          competencyRubrics
        ),
      [settings, semesterScores, students, competencyRubrics]
    );

  const visibleAnnualCompSubjects = useMemo(
    () =>
      getVisibleAnnualCompetencySubjects(
        settings,
        annualScores,
        students,
        annualCompetencyRubrics
      ),
    [settings, annualScores, students, annualCompetencyRubrics]
  );

  const allVisibleSubjects = useMemo(
    () => [...visibleExamSubjects, ...visibleCompSubjects],
    [visibleExamSubjects, visibleCompSubjects]
  );

  const hiddenKeySet = useMemo(
    () => new Set(settings.hiddenSemesterSubjectKeys || []),
    [settings.hiddenSemesterSubjectKeys]
  );

  const hiddenAnnualKeySet = useMemo(
    () => new Set(settings.hiddenAnnualCompetencyKeys || []),
    [settings.hiddenAnnualCompetencyKeys]
  );

  const isSem2 = settings.semester === 2;

  const effectivelyHiddenCount = useMemo(() => {
    let count = 0;
    for (const sub of [...resolvedSubjects, ...SEMESTER_COMPETENCY_SUBJECTS]) {
      if (
        hiddenKeySet.has(sub.key) &&
        !subjectHasScoresInSemester(
          sub.key,
          students,
          semesterScores,
          competencyRubrics
        ).hasScores
      ) {
        count++;
      }
    }
    if (isSem2) {
      for (const sub of SEMESTER_COMPETENCY_SUBJECTS) {
        if (
          hiddenAnnualKeySet.has(sub.key) &&
          !subjectHasScoresInSemester(
            sub.key,
            students,
            annualScores,
            annualCompetencyRubrics
          ).hasScores
        ) {
          count++;
        }
      }
    }
    return count;
  }, [
    resolvedSubjects,
    hiddenKeySet,
    hiddenAnnualKeySet,
    isSem2,
    students,
    semesterScores,
    competencyRubrics,
    annualScores,
    annualCompetencyRubrics,
  ]);

  const isAnnualCompetencySelected = isSem2 && selectedSubKey.startsWith('annual_comp_');

  useEffect(() => {
    if (!isSem2 && selectedSubKey.startsWith('annual_')) {
      setSelectedSubKey(allVisibleSubjects[0]?.key || SEMESTER_EXAM_SUBJECTS[0].key);
      return;
    }
    if (isSem2 && selectedSubKey.startsWith('annual_comp_')) {
      const stillVisible = visibleAnnualCompSubjects.some(
        (s) => `annual_${s.key}` === selectedSubKey
      );
      if (!stillVisible) {
        setSelectedSubKey(
          visibleAnnualCompSubjects.length > 0
            ? `annual_${visibleAnnualCompSubjects[0].key}`
            : allVisibleSubjects[0]?.key || SEMESTER_EXAM_SUBJECTS[0].key
        );
      }
      return;
    }
    if (
      !selectedSubKey.startsWith('annual_comp_') &&
      allVisibleSubjects.length > 0 &&
      !allVisibleSubjects.some((s) => s.key === selectedSubKey)
    ) {
      setSelectedSubKey(allVisibleSubjects[0].key);
    }
  }, [isSem2, allVisibleSubjects, visibleAnnualCompSubjects, selectedSubKey]);

  const defaultSubjectLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sub of SEMESTER_EXAM_SUBJECTS) {
      map[sub.key] = sub.label;
    }
    return map;
  }, []);

  const selectedMonths =
    settings.semester === 1 ? settings.semester1Months : settings.semester2Months;

  const { results: monthlyResults, activeMonthsCount } = useMemo(
    () =>
      computeCombinedMonthlyResults(
        students,
        monthlyScoresByMonth,
        settings.academicYear,
        settings.year,
        selectedMonths,
        settings.maxScore
      ),
    [students, monthlyScoresByMonth, settings.academicYear, settings.year, selectedMonths, settings.maxScore]
  );

  const semesterResults = useMemo(
    () =>
      computeSemesterResults(students, semesterScores, monthlyResults, settings.maxScore),
    [students, semesterScores, monthlyResults, settings.maxScore]
  );

  const { results: sem1MonthlyResults } = useMemo(
    () =>
      computeCombinedMonthlyResults(
        students,
        monthlyScoresByMonth,
        settings.academicYear,
        settings.year,
        settings.semester1Months,
        settings.maxScore
      ),
    [students, monthlyScoresByMonth, settings.academicYear, settings.year, settings.semester1Months, settings.maxScore]
  );

  const semester1Results = useMemo(
    () =>
      isSem2
        ? computeSemesterResults(students, semester1Scores, sem1MonthlyResults, settings.maxScore)
        : semesterResults,
    [isSem2, students, semester1Scores, sem1MonthlyResults, settings.maxScore, semesterResults]
  );

  const annualResults = useMemo(
    () =>
      computeAnnualResults(
        students,
        semester1Results,
        semesterResults,
        annualScores,
        settings.maxScore
      ),
    [students, semester1Results, semesterResults, annualScores, settings.maxScore]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const normalizedSubKey = isAnnualCompetencySelected
    ? selectedSubKey.replace(/^annual_/, '')
    : selectedSubKey;
  const isCompetencyGroupSelected =
    !isAnnualCompetencySelected && COMPETENCY_SUBJECT_KEYS.has(selectedSubKey);
  const selectedCompSubject =
    (isAnnualCompetencySelected
      ? visibleAnnualCompSubjects.find((s) => s.key === normalizedSubKey)
      : visibleCompSubjects.find((s) => s.key === selectedSubKey)) ||
    (isAnnualCompetencySelected ? visibleAnnualCompSubjects[0] : visibleCompSubjects[0]) ||
    SEMESTER_COMPETENCY_SUBJECTS[0];
  const selectedSubject =
    visibleExamSubjects.find((s) => s.key === selectedSubKey) ||
    visibleExamSubjects[0] ||
    resolvedSubjects[0];

  const isKnowledgeSubject = normalizedSubKey === 'comp_knowledge';
  const isSkillsSubject = normalizedSubKey === 'comp_skills';
  const isAttitudeSubject = normalizedSubKey === 'comp_attitude';
  const isRubricSubject = isSkillsSubject || isAttitudeSubject;

  const activeScoreMapForSubject = isAnnualCompetencySelected ? annualScores : semesterScores;
  const allKnowledgeEnabled =
    students.length > 0 &&
    students.every((s) => activeScoreMapForSubject[s.id]?.['comp_knowledge'] === 80);

  const openCompetencyRubric = (
    student: Student,
    type: CompetencyType,
    scope: 'semester' | 'annual' = 'semester'
  ) => {
    setRubricModalState({ open: true, type, student, scope });
  };

  const getCompetencyStatusUi = (
    studentId: string,
    type: CompetencyType,
    scope: 'semester' | 'annual' = 'semester'
  ) => {
    const scoreKey = type === 'skills' ? 'comp_skills' : 'comp_attitude';
    const rawRubric =
      scope === 'annual'
        ? annualCompetencyRubrics[studentId]?.[type]
        : competencyRubrics[studentId]?.[type];
    const fallbackVal =
      scope === 'annual'
        ? annualScores[studentId]?.[scoreKey]
        : semesterScores[studentId]?.[scoreKey];
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

  const openEditLabelsModal = () => {
    const initialDraft: Record<string, string> = {};
    for (const sub of resolvedSubjects) {
      initialDraft[sub.key] = sub.label;
    }
    setDraftLabels(initialDraft);
    setShowEditLabelsModal(true);
  };

  const handleDraftLabelChange = (subKey: string, rawValue: string) => {
    setDraftLabels((prev) => ({ ...prev, [subKey]: rawValue }));
    const trimmed = rawValue.trim().slice(0, 60);
    if (!trimmed) return;
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    const nextCustom = { ...(settings.customSemesterSubjectLabels || {}) };
    if (trimmed === defaultLabel) {
      delete nextCustom[subKey];
    } else {
      nextCustom[subKey] = trimmed;
    }
    onChangeCustomSemesterSubjectLabels(nextCustom);
  };

  const handleBlurDraftLabel = (subKey: string) => {
    const current = draftLabels[subKey] ?? '';
    const trimmed = current.trim().slice(0, 60);
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    if (!trimmed) {
      setDraftLabels((prev) => ({ ...prev, [subKey]: defaultLabel }));
      if (settings.customSemesterSubjectLabels?.[subKey]) {
        const nextCustom = { ...(settings.customSemesterSubjectLabels || {}) };
        delete nextCustom[subKey];
        onChangeCustomSemesterSubjectLabels(nextCustom);
      }
    } else if (trimmed !== current) {
      setDraftLabels((prev) => ({ ...prev, [subKey]: trimmed }));
    }
  };

  const handleResetSingleLabel = (subKey: string) => {
    const defaultLabel = defaultSubjectLabelMap[subKey] || '';
    setDraftLabels((prev) => ({ ...prev, [subKey]: defaultLabel }));
    if (settings.customSemesterSubjectLabels?.[subKey]) {
      const nextCustom = { ...(settings.customSemesterSubjectLabels || {}) };
      delete nextCustom[subKey];
      onChangeCustomSemesterSubjectLabels(nextCustom);
    }
  };

  const handleResetAllLabels = () => {
    const resetDraft: Record<string, string> = {};
    for (const sub of SEMESTER_EXAM_SUBJECTS) {
      resetDraft[sub.key] = sub.label;
    }
    setDraftLabels(resetDraft);
    onChangeCustomSemesterSubjectLabels({});
  };

  const closeEditLabelsModal = () => {
    const nextCustom = { ...(settings.customSemesterSubjectLabels || {}) };
    let changed = false;
    for (const sub of SEMESTER_EXAM_SUBJECTS) {
      const val = (draftLabels[sub.key] ?? '').trim().slice(0, 60);
      const def = sub.label;
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
    if (changed) {
      onChangeCustomSemesterSubjectLabels(nextCustom);
    }
    setShowEditLabelsModal(false);
  };

  const parseScoreInput = (raw: string): number | undefined => {
    if (raw.trim() === '') return undefined;
    const num = Number(raw);
    if (Number.isNaN(num)) return undefined;
    return Math.max(0, Math.min(settings.maxScore, num));
  };

  const semesterLabel = settings.semester === 1 ? 'ឆមាសទី ១' : 'ឆមាសទី ២';

  const summaryEntries = useMemo(() => {
    const semEntry = buildScoreSummaryEntry('semester', semesterLabel, students, (stu) => {
      const res = semesterResults[stu.id];
      const hasScore =
        (res?.enteredCount ?? 0) > 0 ||
        (res?.semesterAverage ?? 0) > 0 ||
        (res?.examAverage ?? 0) > 0 ||
        (res?.monthlyAverage ?? 0) > 0;
      return {
        average: res?.semesterAverage ?? 0,
        grade: res?.grade ?? 'F',
        hasScore,
      };
    });

    if (!isSem2) {
      return [semEntry];
    }

    const annualEntry = buildScoreSummaryEntry(
      'annual',
      'ប្រចាំឆ្នាំ',
      students,
      (stu) => {
        const s1 = semester1Results[stu.id];
        const s2 = semesterResults[stu.id];
        const ann = annualResults[stu.id];
        const hasSem1 =
          (s1?.enteredCount ?? 0) > 0 ||
          (s1?.semesterAverage ?? 0) > 0 ||
          (s1?.examAverage ?? 0) > 0 ||
          (s1?.monthlyAverage ?? 0) > 0;
        const hasSem2 =
          (s2?.enteredCount ?? 0) > 0 ||
          (s2?.semesterAverage ?? 0) > 0 ||
          (s2?.examAverage ?? 0) > 0 ||
          (s2?.monthlyAverage ?? 0) > 0;
        const hasScore = hasSem1 || hasSem2 || (ann?.annualAverage ?? 0) > 0;
        return {
          average: ann?.annualAverage ?? 0,
          grade: ann?.grade ?? 'F',
          hasScore,
        };
      },
      'blue'
    );

    return [semEntry, annualEntry];
  }, [semesterLabel, students, semesterResults, isSem2, semester1Results, annualResults]);

  const openManageColumnsModal = (
    preferredGroupKey?: 'all' | 'exam' | 'comp' | 'annual_comp'
  ) => {
    const safeGroupKey =
      preferredGroupKey === 'annual_comp' && !isSem2
        ? 'all'
        : preferredGroupKey || 'all';
    setManageGroupKey(safeGroupKey);
    setColumnActionNotice(null);
    setConfirmClearColumnKey(null);
    setShowManageColumnsModal(true);
  };

  const handleToggleHideSubject = (
    subKey: string,
    subLabel: string,
    scope: 'semester' | 'annual' = 'semester'
  ) => {
    setConfirmClearColumnKey(null);
    const actionKey = scope === 'annual' ? `annual:${subKey}` : subKey;

    if (scope === 'annual') {
      const { hasScores, count } = subjectHasScoresInSemester(
        subKey,
        students,
        annualScores,
        annualCompetencyRubrics
      );
      const isCurrentlyHidden = hiddenAnnualKeySet.has(subKey) && !hasScores;

      if (isCurrentlyHidden) {
        const next = (settings.hiddenAnnualCompetencyKeys || []).filter(
          (k) => k !== subKey
        );
        onChangeHiddenAnnualCompetencies(next);
        setColumnActionNotice(null);
        return;
      }

      if (hasScores) {
        setColumnActionNotice({
          actionKey,
          tone: 'warning',
          message: `មិនអាចលាក់ជួរ «${subLabel}» (ប្រចាំឆ្នាំ) បានទេ ព្រោះមានពិន្ទុសិស្សចំនួន ${count} នាក់។ សូមលុបពិន្ទុក្នុងជួរនេះជាមុនសិន!`,
        });
        return;
      }

      const nextSet = new Set(settings.hiddenAnnualCompetencyKeys || []);
      nextSet.add(subKey);
      onChangeHiddenAnnualCompetencies(Array.from(nextSet));
      setColumnActionNotice(null);
      return;
    }

    const { hasScores, count } = subjectHasScoresInSemester(
      subKey,
      students,
      semesterScores,
      competencyRubrics
    );
    const isCurrentlyHidden = hiddenKeySet.has(subKey) && !hasScores;

    if (isCurrentlyHidden) {
      const next = (settings.hiddenSemesterSubjectKeys || []).filter(
        (k) => k !== subKey
      );
      onChangeHiddenSemesterSubjects(next);
      setColumnActionNotice(null);
      return;
    }

    if (hasScores) {
      setColumnActionNotice({
        actionKey,
        tone: 'warning',
        message: `មិនអាចលាក់ជួរ «${subLabel}» បានទេ ព្រោះមានពិន្ទុសិស្សចំនួន ${count} នាក់ក្នុង${semesterLabel}។ សូមលុបពិន្ទុក្នុងជួរនេះជាមុនសិន!`,
      });
      return;
    }

    if (allVisibleSubjects.length <= 1) {
      setColumnActionNotice({
        actionKey,
        tone: 'warning',
        message: 'ត្រូវរក្សាទុកយ៉ាងតិច ១ មុខវិជ្ជា ឬមុខវិជ្ជារងសម្រាប់បង្ហាញក្នុងតារាង។',
      });
      return;
    }

    const nextSet = new Set(settings.hiddenSemesterSubjectKeys || []);
    nextSet.add(subKey);
    onChangeHiddenSemesterSubjects(Array.from(nextSet));
    setColumnActionNotice(null);
  };

  const handleConfirmClearColumn = (
    subKey: string,
    subLabel: string,
    scope: 'semester' | 'annual' = 'semester'
  ) => {
    const actionKey = scope === 'annual' ? `annual:${subKey}` : subKey;
    if (confirmClearColumnKey !== actionKey) {
      setConfirmClearColumnKey(actionKey);
      return;
    }
    if (scope === 'annual') {
      onClearAnnualSubjectColumn(subKey);
    } else {
      onClearSemesterSubjectColumn(subKey);
    }
    setConfirmClearColumnKey(null);
    setColumnActionNotice({
      actionKey,
      tone: 'success',
      message: `ពិន្ទុក្នុងជួរ «${subLabel}»${scope === 'annual' ? ' (ប្រចាំឆ្នាំ)' : ''} ត្រូវបានលុបរួចរាល់។ ឥឡូវអ្នកអាចចុច «លាក់ជួរនេះ» បានហើយ។`,
    });
  };

  const selectedMonthNames = selectedMonths
    .map((m) => {
      const lbl = KHMER_MONTHS.find((km) => km.value === m)?.label;
      if (!lbl) return null;
      const calYear = getCalendarYearForAcademicMonth(
        settings.academicYear,
        m,
        settings.year
      );
      return `${lbl} ${calYear}`;
    })
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Top Semester Selector, Month Configuration & Entry Mode Bar */}
      <div className="w-full min-w-0 surface-card rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap max-w-full">
            {/* Semester 1 / Semester 2 Segmented Selector */}
            <div
              role="group"
              aria-label="ជ្រើសរើសឆមាស"
              className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 rounded-xl"
            >
              <button
                type="button"
                onClick={() => onChangeSemester(1)}
                className={`min-h-[40px] px-4 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                  settings.semester === 1
                    ? 'btn-primary'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                ឆមាសទី ១
              </button>
              <button
                type="button"
                onClick={() => onChangeSemester(2)}
                className={`min-h-[40px] px-4 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap shrink-0 ${
                  settings.semester === 2
                    ? 'btn-primary'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                ឆមាសទី ២
              </button>
            </div>

            <div className="min-h-[44px] px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/90 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
              <span>ឆ្នាំសិក្សា</span>
              <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                {settings.academicYear}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>
                {visibleExamSubjects.length} មុខវិជ្ជាប្រឡង
                {visibleCompSubjects.length > 0 ? ' + សម្បទាទាំង៣' : ''}
              </span>
              {activeMonthsCount > 0 && (
                <>
                  <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                  <span>
                    មានពិន្ទុ{' '}
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">
                      {activeMonthsCount}/{selectedMonths.length}
                    </span>{' '}
                    ខែ
                  </span>
                </>
              )}
            </div>
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

        {/* User-Configurable Months for Monthly Average Calculation */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              ខែដែលត្រូវគិតមធ្យមសម្រាប់{semesterLabel}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {selectedMonths.length > 0
                ? `បានជ្រើស៖ ${selectedMonthNames}`
                : 'សូមជ្រើសរើសយ៉ាងតិច ១ ខែ'}
            </span>
          </div>
          <HorizontalScrollStrip className="pb-0.5" ariaLabel={`ខែដែលត្រូវគិតមធ្យមសម្រាប់${semesterLabel}`}>
            {KHMER_MONTHS.map((m) => {
              const isSelected = selectedMonths.includes(m.value);
              const calYear = getCalendarYearForAcademicMonth(
                settings.academicYear,
                m.value,
                settings.year
              );
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => onToggleSemesterMonth(settings.semester, m.value)}
                  aria-pressed={isSelected}
                  className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'btn-primary border-blue-600'
                      : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
                  }`}
                >
                  {m.label}{' '}
                  <span
                    className={`font-mono-num text-[10px] ${
                      isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {calYear}
                  </span>
                </button>
              );
            })}
          </HorizontalScrollStrip>
        </div>
      </div>

      {entryMode === 'bySubject' && (
        <>
          <ScoreSummaryTable
            subtitle={isSem2 ? 'ឆមាសទី ២ និងប្រចាំឆ្នាំ' : semesterLabel}
            maxScore={settings.maxScore}
            entries={summaryEntries}
          />

          <div className="w-full min-w-0 surface-card rounded-2xl p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  ជ្រើសរើសមុខវិជ្ជាប្រឡង ({semesterLabel})
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => openManageColumnsModal('all')}
                    className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>
                      លាក់/បង្ហាញមុខវិជ្ជា
                      {effectivelyHiddenCount > 0 ? ` (${effectivelyHiddenCount})` : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openEditLabelsModal}
                    className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>កែចំណងជើងមុខវិជ្ជា</span>
                  </button>
                </div>
              </div>
              <HorizontalScrollStrip className="pb-0.5" ariaLabel={`ជ្រើសរើសមុខវិជ្ជាប្រឡង (${semesterLabel})`}>
                {visibleExamSubjects.map((sub) => (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setSelectedSubKey(sub.key)}
                    className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 ${
                      selectedSubKey === sub.key
                        ? 'btn-primary border-blue-600'
                        : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
                {visibleCompSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCompetencyGroupSelected) {
                        setSelectedSubKey(visibleCompSubjects[0].key);
                      }
                    }}
                    className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 ${
                      isCompetencyGroupSelected
                        ? 'btn-primary border-blue-600'
                        : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    សម្បទាទាំង៣
                  </button>
                )}
                {isSem2 && visibleAnnualCompSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAnnualCompetencySelected) {
                        setSelectedSubKey(`annual_${visibleAnnualCompSubjects[0].key}`);
                      }
                    }}
                    className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap shrink-0 ${
                      isAnnualCompetencySelected
                        ? 'btn-primary border-blue-600'
                        : 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/70 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                    }`}
                  >
                    ប្រចាំឆ្នាំ (សម្បទាទាំង៣)
                  </button>
                )}
              </HorizontalScrollStrip>
            </div>

            {isCompetencyGroupSelected && visibleCompSubjects.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  ២. ជ្រើសរើសមុខវិជ្ជារង (សម្បទាទាំង៣)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleCompSubjects.map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setSelectedSubKey(sub.key)}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap ${
                        selectedSubKey === sub.key
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

            {isAnnualCompetencySelected && visibleAnnualCompSubjects.length > 0 && (
              <div>
                <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">
                  ២. ជ្រើសរើសមុខវិជ្ជារង (ប្រចាំឆ្នាំ — សម្បទាទាំង៣)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleAnnualCompSubjects.map((sub) => {
                    const annualKey = `annual_${sub.key}`;
                    return (
                      <button
                        key={annualKey}
                        type="button"
                        onClick={() => setSelectedSubKey(annualKey)}
                        className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-95 whitespace-nowrap ${
                          selectedSubKey === annualKey
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-300 dark:shadow-[0_2px_12px_-2px_rgba(16,185,129,0.5)]'
                            : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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

          {students.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              មិនទាន់មានបញ្ជីឈ្មោះសិស្សទេ។ សូមចូលទៅផ្ទាំង «សិស្ស & Sheet» ដើម្បីបន្ថែមសិស្ស។
            </div>
          ) : (
            <div className="surface-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">
                    {isAnnualCompetencySelected
                      ? `ប្រចាំឆ្នាំ · សម្បទាទាំង៣ — ${selectedCompSubject.label}`
                      : isCompetencyGroupSelected
                      ? `${semesterLabel} · សម្បទាទាំង៣ — ${selectedCompSubject.label}`
                      : `${semesterLabel} · មុខវិជ្ជាប្រឡង៖ ${selectedSubject.label}`}
                  </span>
                  {!isCompetencyGroupSelected && !isAnnualCompetencySelected && (
                    <button
                      type="button"
                      onClick={openEditLabelsModal}
                      title="កែចំណងជើងមុខវិជ្ជា"
                      aria-label="កែចំណងជើងមុខវិជ្ជា"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isKnowledgeSubject ? (
                  <button
                    type="button"
                    onClick={() =>
                      isAnnualCompetencySelected
                        ? onToggleAllAnnualKnowledge(!allKnowledgeEnabled)
                        : onToggleAllSemesterKnowledge(!allKnowledgeEnabled)
                    }
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
                const val = isAnnualCompetencySelected
                  ? annualScores[stu.id]?.[normalizedSubKey]
                  : semesterScores[stu.id]?.[selectedSubKey];
                const res = semesterResults[stu.id];
                const annRes = annualResults[stu.id];
                const rubricType: CompetencyType = isSkillsSubject ? 'skills' : 'attitude';
                const scope: 'semester' | 'annual' = isAnnualCompetencySelected ? 'annual' : 'semester';
                const statusUi = isRubricSubject
                  ? getCompetencyStatusUi(stu.id, rubricType, scope)
                  : null;
                const is80Set = val === 80;

                return (
                  <div
                    key={stu.id}
                    onClick={
                      isRubricSubject
                        ? () => openCompetencyRubric(stu, rubricType, scope)
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
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono-num flex-wrap">
                          <span>ប្រឡង {res?.examAverage.toFixed(2) ?? '0.00'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-600 dark:text-red-400 font-bold">
                            ឆមាស {res?.semesterAverage.toFixed(2) ?? '0.00'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            #{res?.rank ?? 1} ({res?.grade ?? 'F'})
                          </span>
                          {isSem2 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-blue-700 dark:text-blue-400 font-bold">
                                ឆ្នាំ {annRes?.annualAverage.toFixed(2) ?? '0.00'} (#{annRes?.rank ?? 1} · {annRes?.grade ?? 'F'})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isKnowledgeSubject ? (
                      <button
                        type="button"
                        onClick={() =>
                          isAnnualCompetencySelected
                            ? onChangeAnnualScore(
                                stu.id,
                                'comp_knowledge',
                                is80Set ? undefined : 80
                              )
                            : onChangeSemesterScore(
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
                          openCompetencyRubric(stu, rubricType, scope);
                        }}
                        aria-label={`${selectedCompSubject.label} សម្រាប់ ${stu.name}: ${statusUi.label}`}
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
                          onChangeSemesterScore(
                            stu.id,
                            selectedSubject.key,
                            parseScoreInput(e.target.value)
                          )
                        }
                        placeholder="0"
                        aria-label={`ពិន្ទុប្រឡង ${selectedSubject.label} សម្រាប់ ${stu.name}`}
                        className="w-24 min-h-[46px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-base font-bold font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shrink-0"
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
            subtitle={isSem2 ? 'ឆមាសទី ២ និងប្រចាំឆ្នាំ' : semesterLabel}
            maxScore={settings.maxScore}
            entries={summaryEntries}
          />

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ស្វែងរកឈ្មោះសិស្សដើម្បីបញ្ចូលពិន្ទុ និងនិទ្ទេស..."
              className="w-full min-h-[46px] pl-10 pr-4 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 shadow-xs text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="surface-card rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStudents.map((stu) => {
              const idx = students.findIndex((s) => s.id === stu.id);
              const res = semesterResults[stu.id];
              const annRes = annualResults[stu.id];
              return (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => setActiveStudent(stu)}
                  className="w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors"
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
                        {semesterLabel} · ប្រឡង {res?.examAverage.toFixed(2) ?? '0.00'} · ប្រចាំខែ{' '}
                        {res?.monthlyAverage.toFixed(2) ?? '0.00'}
                        {isSem2 && (
                          <span className="text-blue-700 dark:text-blue-400 font-semibold">
                            {' '}· ប្រចាំឆ្នាំ {annRes?.annualAverage.toFixed(2) ?? '0.00'} (#{annRes?.rank ?? 1} · {annRes?.grade ?? 'F'})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono-num text-red-600 dark:text-red-400">
                        {res?.semesterAverage.toFixed(2) ?? '0.00'}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 font-mono-num">
                        #{res?.rank ?? 1} · {res?.grade ?? 'F'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {entryMode === 'sheet' && (
        <div className="w-full min-w-0 surface-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {isSem2
                ? 'ទម្រង់តារាង Google Sheet: លទ្ធផលប្រចាំឆមាសទី ២ និងប្រចាំឆ្នាំ'
                : `ទម្រង់តារាង Google Sheet: លទ្ធផលប្រចាំ${semesterLabel}`}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span>ចុចលើឈ្មោះសិស្សដើម្បីបញ្ចូលពិន្ទុ និងនិទ្ទេសតាមផ្នែក</span>
              <button
                type="button"
                onClick={() => openManageColumnsModal('all')}
                className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <EyeOff className="w-3 h-3" />
                <span>
                  លាក់/បង្ហាញមុខវិជ្ជា
                  {effectivelyHiddenCount > 0 ? ` (${effectivelyHiddenCount})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={openEditLabelsModal}
                className="min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <Pencil className="w-3 h-3" />
                <span>កែមុខវិជ្ជា</span>
              </button>
            </div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-800 dark:text-slate-200">
              <thead>
                {isSem2 ? (
                  <>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold">
                      <th rowSpan={3} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">លេខរៀង</span>
                      </th>
                      <th
                        rowSpan={3}
                        className="border border-slate-300 dark:border-slate-700 px-2.5 py-2 text-left min-w-[150px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10"
                      >
                        គោត្តនាម និងនាម
                      </th>
                      <th rowSpan={3} className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center">
                        ភេទ
                      </th>
                      <th
                        colSpan={visibleExamSubjects.length + visibleCompSubjects.length + 5 + DOMAIN_GRADES.length}
                        className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center"
                      >
                        ឆមាសទី ២
                      </th>
                      <th
                        colSpan={visibleAnnualCompSubjects.length + 3 + DOMAIN_GRADES.length}
                        className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                      >
                        ប្រចាំឆ្នាំ
                      </th>
                      <th rowSpan={3} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">សេចក្តីផ្សេងៗ</span>
                      </th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold">
                      {visibleExamSubjects.length > 0 && (
                        <th
                          colSpan={visibleExamSubjects.length}
                          className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center"
                        >
                          ពិន្ទុប្រឡងឆមាស
                        </th>
                      )}
                      {visibleCompSubjects.length > 0 && (
                        <th
                          colSpan={visibleCompSubjects.length}
                          className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                        >
                          សម្បទាទាំង៣
                        </th>
                      )}
                      <th colSpan={5} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        លទ្ធផលប្រចាំឆមាស
                      </th>
                      <th colSpan={4} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        និទ្ទេសតាមផ្នែក
                      </th>
                      {visibleAnnualCompSubjects.length > 0 && (
                        <th
                          colSpan={visibleAnnualCompSubjects.length}
                          className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center"
                        >
                          សម្បទាទាំង៣
                        </th>
                      )}
                      <th colSpan={3} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        លទ្ធផល
                      </th>
                      <th colSpan={4} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        និទ្ទេសតាមផ្នែក
                      </th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                      {visibleExamSubjects.map((sub) => (
                        <th
                          key={sub.key}
                          onClick={() => openManageColumnsModal('exam')}
                          title="ចុចដើម្បីលាក់ ឬបង្ហាញមុខវិជ្ជានេះ"
                          className="border border-slate-300 dark:border-slate-700 px-1 py-2 text-center h-[128px] cursor-pointer transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-950/50"
                        >
                          <span className="vertical-th inline-block">{sub.label}</span>
                        </th>
                      ))}
                      {visibleCompSubjects.map((sub) => (
                        <th
                          key={sub.key}
                          onClick={() => openManageColumnsModal('comp')}
                          title="ចុចដើម្បីលាក់ ឬបង្ហាញជួរមុខវិជ្ជារងនេះ"
                          className="border border-slate-300 dark:border-slate-700 px-1 py-2 text-center h-[128px] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <span className="vertical-th inline-block">{sub.label}</span>
                        </th>
                      ))}
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រឡងឆមាស</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រចាំខែ</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រចាំឆមាស</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ចំណាត់ថ្នាក់</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">និទ្ទេស</span>
                      </th>
                      {DOMAIN_GRADES.map((dom) => (
                        <th key={dom.key} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                          <span className="vertical-th inline-block">{dom.label}</span>
                        </th>
                      ))}
                      {visibleAnnualCompSubjects.map((sub) => (
                        <th
                          key={`ann_${sub.key}`}
                          onClick={() => openManageColumnsModal('annual_comp')}
                          title="ចុចដើម្បីលាក់ ឬបង្ហាញជួរមុខវិជ្ជារងប្រចាំឆ្នាំនេះ"
                          className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center h-[128px] text-blue-700 dark:text-blue-400 font-semibold cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <span className="vertical-th inline-block">{sub.label}</span>
                        </th>
                      ))}
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center text-blue-700 dark:text-blue-400 font-semibold">
                        <span className="vertical-th inline-block">មធ្យមភាគ</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center text-blue-700 dark:text-blue-400 font-semibold">
                        <span className="vertical-th inline-block">ចំណាត់ថ្នាក់</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center text-blue-700 dark:text-blue-400 font-semibold">
                        <span className="vertical-th inline-block">និទ្ទេស</span>
                      </th>
                      {DOMAIN_GRADES.map((dom) => (
                        <th key={`ann_${dom.key}`} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                          <span className="vertical-th inline-block">{dom.label}</span>
                        </th>
                      ))}
                    </tr>
                  </>
                ) : (
                  <>
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
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-2 py-2 text-center">
                        ភេទ
                      </th>
                      {visibleExamSubjects.length > 0 && (
                        <th
                          colSpan={visibleExamSubjects.length}
                          className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center"
                        >
                          ពិន្ទុប្រឡងឆមាស
                        </th>
                      )}
                      {visibleCompSubjects.length > 0 && (
                        <th
                          colSpan={visibleCompSubjects.length}
                          className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
                        >
                          សម្បទាទាំង៣
                        </th>
                      )}
                      <th colSpan={5} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        លទ្ធផលប្រចាំឆមាស
                      </th>
                      <th colSpan={4} className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                        និទ្ទេសតាមផ្នែក
                      </th>
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">សេចក្តីផ្សេងៗ</span>
                      </th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium">
                      {visibleExamSubjects.map((sub) => (
                        <th
                          key={sub.key}
                          onClick={() => openManageColumnsModal('exam')}
                          title="ចុចដើម្បីលាក់ ឬបង្ហាញមុខវិជ្ជានេះ"
                          className="border border-slate-300 dark:border-slate-700 px-1 py-2 text-center h-[128px] cursor-pointer transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-950/50"
                        >
                          <span className="vertical-th inline-block">{sub.label}</span>
                        </th>
                      ))}
                      {visibleCompSubjects.map((sub) => (
                        <th
                          key={sub.key}
                          onClick={() => openManageColumnsModal('comp')}
                          title="ចុចដើម្បីលាក់ ឬបង្ហាញជួរមុខវិជ្ជារងនេះ"
                          className="border border-slate-300 dark:border-slate-700 px-1 py-2 text-center h-[128px] cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/50 transition-colors"
                        >
                          <span className="vertical-th inline-block">{sub.label}</span>
                        </th>
                      ))}
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រឡងឆមាស</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រចាំខែ</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ម. ប្រចាំឆមាស</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">ចំណាត់ថ្នាក់</span>
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                        <span className="vertical-th inline-block">និទ្ទេស</span>
                      </th>
                      {DOMAIN_GRADES.map((dom) => (
                        <th key={dom.key} className="border border-slate-300 dark:border-slate-700 px-1.5 py-2 text-center">
                          <span className="vertical-th inline-block">{dom.label}</span>
                        </th>
                      ))}
                    </tr>
                  </>
                )}
              </thead>
              <tbody>
                {students.map((stu, idx) => {
                  const sScores = semesterScores[stu.id] || {};
                  const dGrades = domainGrades[stu.id] || {};
                  const res = semesterResults[stu.id];
                  const annScores = annualScores[stu.id] || {};
                  const annDoms = annualDomainGrades[stu.id] || {};
                  const annRes = annualResults[stu.id];
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
                      {visibleExamSubjects.map((sub) => (
                        <td
                          key={sub.key}
                          className="border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center font-mono-num"
                        >
                          {sScores[sub.key] ?? ''}
                        </td>
                      ))}
                      {visibleCompSubjects.map((sub) => {
                        const rawVal = sScores[sub.key];
                        let displayVal: string | number = '';
                        if (sub.key === 'comp_knowledge') {
                          displayVal = rawVal === 80 ? '80%' : '';
                        } else {
                          displayVal =
                            typeof rawVal === 'number' && !Number.isNaN(rawVal)
                              ? rawVal.toFixed(2)
                              : '';
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
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.examAverage.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.monthlyAverage.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.semesterAverage.toFixed(2) ?? '0.00'}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                        {res?.rank ?? 1}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-bold text-red-600 dark:text-red-400">
                        {res?.grade ?? 'F'}
                      </td>
                      {DOMAIN_GRADES.map((dom) => (
                        <td
                          key={dom.key}
                          className="border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center font-semibold text-slate-800 dark:text-slate-100"
                        >
                          {dGrades[dom.key] || ''}
                        </td>
                      ))}
                      {isSem2 && (
                        <>
                          {visibleAnnualCompSubjects.map((sub) => {
                            const rawVal = annScores[sub.key];
                            let displayVal: string | number = '';
                            if (sub.key === 'comp_knowledge') {
                              displayVal = rawVal === 80 ? '80%' : '';
                            } else {
                              displayVal =
                                typeof rawVal === 'number' && !Number.isNaN(rawVal)
                                  ? rawVal.toFixed(2)
                                  : '';
                            }
                            return (
                              <td
                                key={`ann_${sub.key}`}
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
                          <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                            {annRes?.annualAverage.toFixed(2) ?? '0.00'}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-mono-num font-bold text-red-600 dark:text-red-400">
                            {annRes?.rank ?? 1}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center font-bold text-red-600 dark:text-red-400">
                            {annRes?.grade ?? 'F'}
                          </td>
                          {DOMAIN_GRADES.map((dom) => (
                            <td
                              key={`ann_${dom.key}`}
                              className="border border-slate-300 dark:border-slate-700 px-1.5 py-1.5 text-center font-semibold text-slate-800 dark:text-slate-100"
                            >
                              {annDoms[dom.key] || ''}
                            </td>
                          ))}
                        </>
                      )}
                      <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center text-slate-600 dark:text-slate-400">
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

      {/* Student Detail Semester Modal */}
      {activeStudent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeStudent.name} · {semesterLabel}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono-num flex-wrap">
                  <span className="text-red-600 dark:text-red-400 font-bold">
                    ម. ប្រចាំឆមាស {semesterResults[activeStudent.id]?.semesterAverage.toFixed(2) ?? '0.00'}
                  </span>
                  <span>·</span>
                  <span>និទ្ទេស {semesterResults[activeStudent.id]?.grade ?? 'F'}</span>
                  {isSem2 && (
                    <>
                      <span>·</span>
                      <span className="text-blue-700 dark:text-blue-400 font-bold">
                        ប្រចាំឆ្នាំ {annualResults[activeStudent.id]?.annualAverage.toFixed(2) ?? '0.00'} ({annualResults[activeStudent.id]?.grade ?? 'F'})
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                aria-label="បិទ"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {visibleExamSubjects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-800">
                    ពិន្ទុប្រឡង{semesterLabel} ({visibleExamSubjects.length} មុខវិជ្ជា)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {visibleExamSubjects.map((sub) => {
                      const val = semesterScores[activeStudent.id]?.[sub.key];
                      return (
                        <label
                          key={sub.key}
                          className="flex items-center justify-between gap-2 border rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                        >
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
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
                              onChangeSemesterScore(
                                activeStudent.id,
                                sub.key,
                                parseScoreInput(e.target.value)
                              )
                            }
                            placeholder="0"
                            className="w-20 min-h-[40px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {visibleCompSubjects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-800">
                    សម្បទាទាំង៣
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {visibleCompSubjects.map((sub) => {
                      const val = semesterScores[activeStudent.id]?.[sub.key];
                      if (sub.key === 'comp_knowledge') {
                        const is80Set = val === 80;
                        return (
                          <div
                            key={sub.key}
                            className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                          >
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {sub.label}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeSemesterScore(
                                  activeStudent.id,
                                  'comp_knowledge',
                                  is80Set ? undefined : 80
                                )
                              }
                              className={`w-24 min-h-[40px] px-2 rounded-lg border text-center text-sm font-bold font-mono-num transition-all active:scale-95 ${
                                is80Set
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {is80Set ? '80%' : '—'}
                            </button>
                          </div>
                        );
                      }
                      const rType: CompetencyType =
                        sub.key === 'comp_skills' ? 'skills' : 'attitude';
                      const statusUi = getCompetencyStatusUi(activeStudent.id, rType);
                      return (
                        <div
                          key={sub.key}
                          className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                        >
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
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
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-800">
                  និទ្ទេសតាមផ្នែក ({semesterLabel})
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {DOMAIN_GRADES.map((dom) => (
                    <label
                      key={dom.key}
                      className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {dom.label}
                      </span>
                      <select
                        value={domainGrades[activeStudent.id]?.[dom.key] || ''}
                        onChange={(e) =>
                          onChangeDomainGrade(activeStudent.id, dom.key, e.target.value)
                        }
                        className="min-h-[38px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {DOMAIN_OPTIONS.map((opt) => (
                          <option key={opt || 'empty'} value={opt}>
                            {opt || '—'}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {isSem2 && (
                <>
                  {visibleAnnualCompSubjects.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 pb-1 border-b border-blue-100 dark:border-blue-900/60">
                        ប្រចាំឆ្នាំ — សម្បទាទាំង៣
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {visibleAnnualCompSubjects.map((sub) => {
                          const val = annualScores[activeStudent.id]?.[sub.key];
                          if (sub.key === 'comp_knowledge') {
                            const is80Set = val === 80;
                            return (
                              <div
                                key={`modal_ann_${sub.key}`}
                                className="flex items-center justify-between gap-2 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 rounded-xl px-3 py-2"
                              >
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                  {sub.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChangeAnnualScore(
                                      activeStudent.id,
                                      'comp_knowledge',
                                      is80Set ? undefined : 80
                                    )
                                  }
                                  className={`w-24 min-h-[40px] px-2 rounded-lg border text-center text-sm font-bold font-mono-num transition-all active:scale-95 ${
                                    is80Set
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {is80Set ? '80%' : '—'}
                                </button>
                              </div>
                            );
                          }
                          const rType: CompetencyType =
                            sub.key === 'comp_skills' ? 'skills' : 'attitude';
                          const statusUi = getCompetencyStatusUi(activeStudent.id, rType, 'annual');
                          return (
                            <div
                              key={`modal_ann_${sub.key}`}
                              className="flex items-center justify-between gap-2 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 rounded-xl px-3 py-2"
                            >
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {sub.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => openCompetencyRubric(activeStudent, rType, 'annual')}
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
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 pb-1 border-b border-blue-100 dark:border-blue-900/60">
                      ប្រចាំឆ្នាំ — និទ្ទេសតាមផ្នែក
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {DOMAIN_GRADES.map((dom) => (
                        <label
                          key={`modal_ann_${dom.key}`}
                          className="flex flex-col gap-1 bg-blue-50/40 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 rounded-xl px-3 py-2"
                        >
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {dom.label}
                          </span>
                          <select
                            value={annualDomainGrades[activeStudent.id]?.[dom.key] || ''}
                            onChange={(e) =>
                              onChangeAnnualDomainGrade(activeStudent.id, dom.key, e.target.value)
                            }
                            className="min-h-[38px] px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {DOMAIN_OPTIONS.map((opt) => (
                              <option key={opt || 'empty'} value={opt}>
                                {opt || '—'}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  សេចក្តីផ្សេងៗ
                </label>
                <input
                  type="text"
                  value={remarks[activeStudent.id] || ''}
                  onChange={(e) => onChangeRemark(activeStudent.id, e.target.value)}
                  placeholder="កំណត់សម្គាល់បន្ថែម..."
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
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
      {/* Edit Semester Subject Titles Modal (Per Teacher Account) */}
      {showEditLabelsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="កែប្រែចំណងជើងមុខវិជ្ជាប្រឡងឆមាស"
        >
          <div className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  កែប្រែចំណងជើងមុខវិជ្ជាឆមាស
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

            <div className="overflow-y-auto p-5 space-y-3.5 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  មុខវិជ្ជាប្រឡងឆមាស (១៣ មុខវិជ្ជា)
                </span>
                {Object.keys(settings.customSemesterSubjectLabels || {}).length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllLabels}
                    className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>ស្ដារឈ្មោះដើមទាំងអស់</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {SEMESTER_EXAM_SUBJECTS.map((defaultSub, idx) => {
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
                        aria-label={`ចំណងជើងមុខវិជ្ជាឆមាស ${defaultSub.label}`}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

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
      {/* Manage Hidden / Visible Semester Subject & Sub-Subject Columns Modal */}
      {showManageColumnsModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="លាក់ ឬបង្ហាញមុខវិជ្ជា និងមុខវិជ្ជារង"
        >
          <div className="w-full sm:max-w-xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
            <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  លាក់ ឬបង្ហាញមុខវិជ្ជា និងមុខវិជ្ជារង ({semesterLabel})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  អាចលាក់បានតែជួរដែលគ្មានពិន្ទុ។ បើមានពិន្ទុ ត្រូវលុបពិន្ទុជាមុនសិន។
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

            {/* Category Filter Tabs */}
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
              <button
                type="button"
                onClick={() => setManageGroupKey('exam')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  manageGroupKey === 'exam'
                    ? 'btn-primary border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                }`}
              >
                មុខវិជ្ជាប្រឡង ({resolvedSubjects.length})
              </button>
              <button
                type="button"
                onClick={() => setManageGroupKey('comp')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  manageGroupKey === 'comp'
                    ? 'btn-primary border-blue-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'
                }`}
              >
                សម្បទាទាំង៣ ({SEMESTER_COMPETENCY_SUBJECTS.length})
              </button>
              {isSem2 && (
                <button
                  type="button"
                  onClick={() => setManageGroupKey('annual_comp')}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    manageGroupKey === 'annual_comp'
                      ? 'btn-primary border-blue-600'
                      : 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800/70 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  ប្រចាំឆ្នាំ · សម្បទាទាំង៣ ({SEMESTER_COMPETENCY_SUBJECTS.length})
                </button>
              )}
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

              {[
                {
                  key: 'exam' as const,
                  scope: 'semester' as const,
                  title: 'មុខវិជ្ជាប្រឡងឆមាស',
                  items: resolvedSubjects,
                },
                {
                  key: 'comp' as const,
                  scope: 'semester' as const,
                  title: `សម្បទាទាំង៣ (${semesterLabel})`,
                  items: SEMESTER_COMPETENCY_SUBJECTS,
                },
                ...(isSem2
                  ? [
                      {
                        key: 'annual_comp' as const,
                        scope: 'annual' as const,
                        title: 'សម្បទាទាំង៣ (ប្រចាំឆ្នាំ)',
                        items: SEMESTER_COMPETENCY_SUBJECTS,
                      },
                    ]
                  : []),
              ]
                .filter((sec) => manageGroupKey === 'all' || sec.key === manageGroupKey)
                .map((sec) => (
                  <div
                    key={sec.key}
                    className={`border rounded-xl overflow-hidden ${
                      sec.scope === 'annual'
                        ? 'border-blue-200 dark:border-blue-800/70'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2 border-b text-xs font-bold ${
                        sec.scope === 'annual'
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70 text-blue-900 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {sec.title}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sec.items.map((sub) => {
                        const isAnnualSec = sec.scope === 'annual';
                        const actionKey = isAnnualSec ? `annual:${sub.key}` : sub.key;
                        const { hasScores, count } = subjectHasScoresInSemester(
                          sub.key,
                          students,
                          isAnnualSec ? annualScores : semesterScores,
                          isAnnualSec ? annualCompetencyRubrics : competencyRubrics
                        );
                        const isHidden =
                          (isAnnualSec
                            ? hiddenAnnualKeySet.has(sub.key)
                            : hiddenKeySet.has(sub.key)) && !hasScores;
                        const isConfirmingClear = confirmClearColumnKey === actionKey;
                        const isLastVisible =
                          !isAnnualSec && !isHidden && allVisibleSubjects.length <= 1;

                        return (
                          <div
                            key={actionKey}
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
                                    handleConfirmClearColumn(sub.key, sub.label, sec.scope)
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
                                onClick={() =>
                                  handleToggleHideSubject(sub.key, sub.label, sec.scope)
                                }
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
                    onChangeHiddenSemesterSubjects([]);
                    if (isSem2) {
                      onChangeHiddenAnnualCompetencies([]);
                    }
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
                  បង្ហាញគ្រប់ជួរ (
                  {allVisibleSubjects.length + (isSem2 ? visibleAnnualCompSubjects.length : 0)}/
                  {resolvedSubjects.length +
                    SEMESTER_COMPETENCY_SUBJECTS.length * (isSem2 ? 2 : 1)}
                  )
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
        monthLabel={rubricModalState.scope === 'annual' ? 'ប្រចាំឆ្នាំ' : semesterLabel}
        year={settings.year}
        periodLabel={rubricModalState.scope === 'annual' ? 'ប្រចាំឆ្នាំ' : semesterLabel}
        periodFileSlug={
          rubricModalState.scope === 'annual'
            ? `ប្រចាំឆ្នាំ_${settings.academicYear}`
            : `${semesterLabel}_${settings.academicYear}`
        }
        initialScores={
          rubricModalState.student
            ? (rubricModalState.scope === 'annual' ? annualCompetencyRubrics : competencyRubrics)[
                rubricModalState.student.id
              ]?.[rubricModalState.type]
            : undefined
        }
        onSave={
          rubricModalState.scope === 'annual'
            ? onSaveAnnualCompetencyRubric
            : onSaveSemesterCompetencyRubric
        }
        onClose={() =>
          setRubricModalState((prev) => ({ ...prev, open: false }))
        }
      />
    </div>
  );
};

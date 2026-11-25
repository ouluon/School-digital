export type Gender = 'ប្រុស' | 'ស្រី';

export type AttendanceMark = '' | 'ច្ប' | 'ឈ' | 'អច្ប';

export interface Student {
  id: string;
  studentCode: string;
  name: string;
  gender: Gender;
  lastName?: string;
  firstName?: string;
  latinName?: string;
  dob?: string;
  age?: string;
  pob?: string;
  fatherName?: string;
  fatherJob?: string;
  motherName?: string;
  motherJob?: string;
  address?: string;
  ethnicity?: string;
  specialCondition?: string;
}

export interface SubjectItem {
  key: string;
  label: string;
  groupKey: string;
}

export interface SubjectGroup {
  key: string;
  label: string;
  subjects: SubjectItem[];
  standalone?: boolean;
  isCompetencyGroup?: boolean;
}

export const MONTHLY_SUBJECT_GROUPS: SubjectGroup[] = [
  {
    key: 'khmer',
    label: 'ភាសាខ្មែរ',
    subjects: [
      { key: 'kh_listen', label: 'សមត្ថភាពស្តាប់', groupKey: 'khmer' },
      { key: 'kh_write', label: 'សមត្ថភាពសរសេរ', groupKey: 'khmer' },
      { key: 'kh_read', label: 'សមត្ថភាពអាន', groupKey: 'khmer' },
      { key: 'kh_speak', label: 'សមត្ថភាពនិយាយ', groupKey: 'khmer' },
    ],
  },
  {
    key: 'math',
    label: 'គណិតវិទ្យា',
    subjects: [
      { key: 'math_num', label: 'ចំនួន', groupKey: 'math' },
      { key: 'math_meas', label: 'រង្វាស់រង្វាល់', groupKey: 'math' },
      { key: 'math_geo', label: 'ធរណីមាត្រ', groupKey: 'math' },
      { key: 'math_alg', label: 'ពីជគណិត', groupKey: 'math' },
      { key: 'math_stat', label: 'ស្ថិតិ', groupKey: 'math' },
    ],
  },
  {
    key: 'science',
    label: 'វិទ្យាសាស្ត្រ',
    subjects: [
      { key: 'sci_phys', label: 'រូបវិទ្យា', groupKey: 'science' },
      { key: 'sci_chem', label: 'គីមីវិទ្យា', groupKey: 'science' },
      { key: 'sci_bio', label: 'ជីវវិទ្យា', groupKey: 'science' },
      { key: 'sci_earth', label: 'ផែនដី-បរិស្ថានវិជ្ជា', groupKey: 'science' },
    ],
  },
  {
    key: 'social',
    label: 'សិក្សាសង្គម',
    subjects: [
      { key: 'soc_moral', label: 'សីលធម៌-ពលរដ្ឋវិជ្ជា', groupKey: 'social' },
      { key: 'soc_geo', label: 'ភូមិវិទ្យា', groupKey: 'social' },
      { key: 'soc_hist', label: 'ប្រវត្តិវិទ្យា', groupKey: 'social' },
      { key: 'soc_art', label: 'គេហវិទ្យា-អប់រំសិល្បៈ', groupKey: 'social' },
    ],
  },
  {
    key: 'health',
    label: 'សុខភាព កីឡា',
    subjects: [
      { key: 'hlth_pe', label: 'អប់រំកាយ-កីឡា', groupKey: 'health' },
      { key: 'hlth_hyg', label: 'សុខភាព-អនាម័យ', groupKey: 'health' },
    ],
  },
  {
    key: 'life_skill',
    label: 'អប់រំបំណិនជីវិត',
    standalone: true,
    subjects: [{ key: 'life_skill', label: 'អប់រំបំណិនជីវិត', groupKey: 'life_skill' }],
  },
  {
    key: 'foreign_lang',
    label: 'ភាសាបរទេស',
    standalone: true,
    subjects: [{ key: 'foreign_lang', label: 'ភាសាបរទេស', groupKey: 'foreign_lang' }],
  },
  {
    key: 'three_competencies',
    label: 'សម្បទាទាំង៣',
    isCompetencyGroup: true,
    subjects: [
      { key: 'comp_knowledge', label: 'វិជ្ជាសម្បទា', groupKey: 'three_competencies' },
      { key: 'comp_skills', label: 'បំណិនសម្បទា', groupKey: 'three_competencies' },
      { key: 'comp_attitude', label: 'ចរិយាសម្បទា', groupKey: 'three_competencies' },
    ],
  },
];

export const ACADEMIC_MONTHLY_SUBJECTS: SubjectItem[] = MONTHLY_SUBJECT_GROUPS.filter(
  (g) => !g.isCompetencyGroup
).flatMap((g) => g.subjects);

export const ALL_MONTHLY_SUBJECTS: SubjectItem[] = MONTHLY_SUBJECT_GROUPS.flatMap(
  (g) => g.subjects
);

export const COMPETENCY_SUBJECT_KEYS = new Set([
  'comp_knowledge',
  'comp_skills',
  'comp_attitude',
]);

const VALID_MONTHLY_SUBJECT_KEYS = new Set(
  ALL_MONTHLY_SUBJECTS.map((s) => s.key)
);

export function sanitizeCustomSubjectLabels(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_MONTHLY_SUBJECT_KEYS.has(k) || typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, 60);
    if (trimmed) {
      out[k] = trimmed;
    }
  }
  return out;
}

export function sanitizeHiddenMonthlySubjectKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const maxHidden = Math.max(0, VALID_MONTHLY_SUBJECT_KEYS.size - 1);
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!VALID_MONTHLY_SUBJECT_KEYS.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxHidden) break;
  }
  return out;
}

export function subjectHasScoresInMonth(
  subjectKey: string,
  students: Student[],
  monthlyScores: ScoreMap,
  competencyRubrics?: CompetencyRubricMap
): { hasScores: boolean; count: number } {
  let count = 0;
  for (const stu of students) {
    const val = monthlyScores[stu.id]?.[subjectKey];
    if (typeof val === 'number' && !Number.isNaN(val)) {
      count++;
      continue;
    }
    if (subjectKey === 'comp_skills' || subjectKey === 'comp_attitude') {
      const rubricType = subjectKey === 'comp_skills' ? 'skills' : 'attitude';
      const rubricScores = competencyRubrics?.[stu.id]?.[rubricType];
      if (
        rubricScores &&
        Object.values(rubricScores).some(
          (rv) => typeof rv === 'number' && !Number.isNaN(rv)
        )
      ) {
        count++;
      }
    }
  }
  return { hasScores: count > 0, count };
}

export function getResolvedMonthlySubjectGroups(
  settings?: Pick<ClassSettings, 'customSubjectLabels'> | null
): SubjectGroup[] {
  const custom = settings?.customSubjectLabels;
  if (!custom) return MONTHLY_SUBJECT_GROUPS;
  return MONTHLY_SUBJECT_GROUPS.map((grp) => ({
    ...grp,
    subjects: grp.subjects.map((sub) => ({
      ...sub,
      label: custom[sub.key]?.trim() || sub.label,
    })),
  }));
}

export function getResolvedMonthlySubjects(
  settings?: Pick<ClassSettings, 'customSubjectLabels'> | null
): SubjectItem[] {
  return getResolvedMonthlySubjectGroups(settings).flatMap((g) => g.subjects);
}

export function getVisibleMonthlySubjectGroups(
  settings?: Pick<
    ClassSettings,
    'customSubjectLabels' | 'hiddenMonthlySubjectKeys'
  > | null,
  monthlyScores?: ScoreMap,
  students?: Student[],
  competencyRubrics?: CompetencyRubricMap
): SubjectGroup[] {
  const resolved = getResolvedMonthlySubjectGroups(settings);
  const hiddenKeys = settings?.hiddenMonthlySubjectKeys;
  if (!hiddenKeys || hiddenKeys.length === 0) {
    return resolved;
  }
  const hiddenSet = new Set(hiddenKeys);
  const filtered = resolved
    .map((grp) => ({
      ...grp,
      subjects: grp.subjects.filter((sub) => {
        if (!hiddenSet.has(sub.key)) return true;
        if (monthlyScores && students) {
          return subjectHasScoresInMonth(
            sub.key,
            students,
            monthlyScores,
            competencyRubrics
          ).hasScores;
        }
        return false;
      }),
    }))
    .filter((grp) => grp.subjects.length > 0);

  return filtered.length > 0 ? filtered : resolved;
}

export const SEMESTER_EXAM_SUBJECTS: { key: string; label: string; highlight?: boolean }[] = [
  { key: 'sem_read', label: 'អំណាន' },
  { key: 'sem_listen_speak', label: 'ស្តាប់ និងនិយាយ' },
  { key: 'sem_dictation', label: 'សរសេរតាមអាន' },
  { key: 'sem_essay', label: 'តែងសេចក្តី' },
  { key: 'sem_math', label: 'គណិតវិទ្យា' },
  { key: 'sem_science', label: 'វិទ្យាសាស្ត្រ', highlight: true },
  { key: 'sem_moral', label: 'សីលធម៌-ពលរដ្ឋវិជ្ជា' },
  { key: 'sem_geo', label: 'ភូមិវិទ្យា' },
  { key: 'sem_hist', label: 'ប្រវត្តិវិទ្យា' },
  { key: 'sem_art', label: 'គេហវិទ្យា-អប់រំសិល្បៈ' },
  { key: 'sem_pe_health', label: 'អប់រំកាយ-សុខភាព' },
  { key: 'sem_life', label: 'អប់រំបំណិនជីវិត' },
  { key: 'sem_foreign', label: 'ភាសាបរទេស' },
];

export const SEMESTER_COMPETENCY_SUBJECTS: SubjectItem[] = [
  { key: 'comp_knowledge', label: 'វិជ្ជាសម្បទា', groupKey: 'three_competencies' },
  { key: 'comp_skills', label: 'បំណិនសម្បទា', groupKey: 'three_competencies' },
  { key: 'comp_attitude', label: 'ចរិយាសម្បទា', groupKey: 'three_competencies' },
];

const VALID_SEMESTER_SUBJECT_KEYS = new Set(
  SEMESTER_EXAM_SUBJECTS.map((s) => s.key)
);

const VALID_SEMESTER_HIDEABLE_KEYS = new Set([
  ...SEMESTER_EXAM_SUBJECTS.map((s) => s.key),
  ...SEMESTER_COMPETENCY_SUBJECTS.map((s) => s.key),
]);

export function sanitizeCustomSemesterSubjectLabels(
  raw: unknown
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_SEMESTER_SUBJECT_KEYS.has(k) || typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, 60);
    if (trimmed) {
      out[k] = trimmed;
    }
  }
  return out;
}

const VALID_ANNUAL_COMPETENCY_KEYS = new Set(
  SEMESTER_COMPETENCY_SUBJECTS.map((s) => s.key)
);

export function sanitizeHiddenSemesterSubjectKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const maxHidden = Math.max(0, VALID_SEMESTER_HIDEABLE_KEYS.size - 1);
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!VALID_SEMESTER_HIDEABLE_KEYS.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxHidden) break;
  }
  return out;
}

export function sanitizeHiddenAnnualCompetencyKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!VALID_ANNUAL_COMPETENCY_KEYS.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function subjectHasScoresInSemester(
  subjectKey: string,
  students: Student[],
  semesterScores: ScoreMap,
  competencyRubrics?: CompetencyRubricMap
): { hasScores: boolean; count: number } {
  let count = 0;
  for (const stu of students) {
    const val = semesterScores[stu.id]?.[subjectKey];
    if (typeof val === 'number' && !Number.isNaN(val)) {
      count++;
      continue;
    }
    if (subjectKey === 'comp_skills' || subjectKey === 'comp_attitude') {
      const rubricType = subjectKey === 'comp_skills' ? 'skills' : 'attitude';
      const rubricScores = competencyRubrics?.[stu.id]?.[rubricType];
      if (
        rubricScores &&
        Object.values(rubricScores).some(
          (rv) => typeof rv === 'number' && !Number.isNaN(rv)
        )
      ) {
        count++;
      }
    }
  }
  return { hasScores: count > 0, count };
}

export function getResolvedSemesterExamSubjects(
  settings?: Pick<ClassSettings, 'customSemesterSubjectLabels'> | null
): { key: string; label: string; highlight?: boolean }[] {
  const custom = settings?.customSemesterSubjectLabels;
  if (!custom) return SEMESTER_EXAM_SUBJECTS;
  return SEMESTER_EXAM_SUBJECTS.map((sub) => ({
    ...sub,
    label: custom[sub.key]?.trim() || sub.label,
  }));
}

export function getVisibleSemesterSubjects(
  settings?: Pick<
    ClassSettings,
    'customSemesterSubjectLabels' | 'hiddenSemesterSubjectKeys'
  > | null,
  semesterScores?: ScoreMap,
  students?: Student[],
  competencyRubrics?: CompetencyRubricMap
): {
  examSubjects: { key: string; label: string; highlight?: boolean }[];
  competencySubjects: SubjectItem[];
} {
  const resolvedExams = getResolvedSemesterExamSubjects(settings);
  const hiddenKeys = settings?.hiddenSemesterSubjectKeys;
  if (!hiddenKeys || hiddenKeys.length === 0) {
    return {
      examSubjects: resolvedExams,
      competencySubjects: SEMESTER_COMPETENCY_SUBJECTS,
    };
  }
  const hiddenSet = new Set(hiddenKeys);
  const isVisible = (key: string) => {
    if (!hiddenSet.has(key)) return true;
    if (semesterScores && students) {
      return subjectHasScoresInSemester(
        key,
        students,
        semesterScores,
        competencyRubrics
      ).hasScores;
    }
    return false;
  };
  const examSubjects = resolvedExams.filter((sub) => isVisible(sub.key));
  const competencySubjects = SEMESTER_COMPETENCY_SUBJECTS.filter((sub) =>
    isVisible(sub.key)
  );
  if (examSubjects.length === 0 && competencySubjects.length === 0) {
    return {
      examSubjects: resolvedExams,
      competencySubjects: SEMESTER_COMPETENCY_SUBJECTS,
    };
  }
  return { examSubjects, competencySubjects };
}

export function getVisibleAnnualCompetencySubjects(
  settings?: Pick<ClassSettings, 'hiddenAnnualCompetencyKeys'> | null,
  annualScores?: ScoreMap,
  students?: Student[],
  annualCompetencyRubrics?: CompetencyRubricMap
): SubjectItem[] {
  const hiddenKeys = settings?.hiddenAnnualCompetencyKeys;
  if (!hiddenKeys || hiddenKeys.length === 0) {
    return SEMESTER_COMPETENCY_SUBJECTS;
  }
  const hiddenSet = new Set(hiddenKeys);
  return SEMESTER_COMPETENCY_SUBJECTS.filter((sub) => {
    if (!hiddenSet.has(sub.key)) return true;
    if (annualScores && students) {
      return subjectHasScoresInSemester(
        sub.key,
        students,
        annualScores,
        annualCompetencyRubrics
      ).hasScores;
    }
    return false;
  });
}

export const DOMAIN_GRADES: { key: string; label: string }[] = [
  { key: 'dom_knowledge', label: 'ចំណេះដឹង' },
  { key: 'dom_skills', label: 'បំណិន-ចំណេះធ្វើ' },
  { key: 'dom_values', label: 'តម្លៃ-សីលធម៌' },
  { key: 'dom_solidarity', label: 'សាមគ្គី-ការចូលរួម' },
];

export const KHMER_MONTHS = [
  { value: 1, label: 'មករា' },
  { value: 2, label: 'កុម្ភៈ' },
  { value: 3, label: 'មីនា' },
  { value: 4, label: 'មេសា' },
  { value: 5, label: 'ឧសភា' },
  { value: 6, label: 'មិថុនា' },
  { value: 7, label: 'កក្កដា' },
  { value: 8, label: 'សីហា' },
  { value: 9, label: 'កញ្ញា' },
  { value: 10, label: 'តុលា' },
  { value: 11, label: 'វិច្ឆិកា' },
  { value: 12, label: 'ធ្នូ' },
];

export const DEFAULT_SEMESTER_1_MONTHS = [12, 1, 2];
export const DEFAULT_SEMESTER_2_MONTHS = [5, 6, 7];

export interface ClassSettings {
  schoolName: string;
  districtAdmin?: string;
  educationOffice?: string;
  schoolCluster?: string;
  className: string;
  teacherName: string;
  academicYear: string;
  month: number; // 1-12 (legacy/default month)
  year: number;
  attendanceMonth?: number; // 1-12 (independent month for Attendance tab)
  attendanceYear?: number;
  monthlyMonth?: number; // 1-12 (independent month for Monthly Scores tab)
  monthlyYear?: number;
  semester: 1 | 2;
  maxScore: 10 | 100;
  semester1Months: number[];
  semester2Months: number[];
  customSubjectLabels?: Record<string, string>;
  customSemesterSubjectLabels?: Record<string, string>;
  hiddenMonthlySubjectKeys?: string[];
  hiddenSemesterSubjectKeys?: string[];
  hiddenAnnualCompetencyKeys?: string[];
}

export function getAttendanceMonthYear(settings: ClassSettings): {
  month: number;
  year: number;
} {
  return {
    month: settings.attendanceMonth ?? settings.month,
    year: settings.attendanceYear ?? settings.year,
  };
}

export function getMonthlyScoresMonthYear(settings: ClassSettings): {
  month: number;
  year: number;
} {
  return {
    month: settings.monthlyMonth ?? settings.month,
    year: settings.monthlyYear ?? settings.year,
  };
}

// Keyed by studentId -> day (1..31) -> AttendanceMark
export type AttendanceMap = Record<string, Record<number, AttendanceMark>>;

// Keyed by `${year}-${month}` -> AttendanceMap
export type AttendanceByMonth = Record<string, AttendanceMap>;

// Keyed by studentId -> day (1..31) -> leave reason string (for 'ច្ប')
export type AttendanceReasonMap = Record<string, Record<number, string>>;

// Keyed by `${year}-${month}` -> AttendanceReasonMap
export type AttendanceReasonsByMonth = Record<string, AttendanceReasonMap>;

// Keyed by studentId -> subjectKey -> number | undefined
export type ScoreMap = Record<string, Record<string, number | undefined>>;

// Keyed by `${year}-${month}` -> ScoreMap
export type MonthlyScoresByMonth = Record<string, ScoreMap>;

// Per-student competency rubric indicator scores
export interface CompetencyRubricEntry {
  skills?: Record<string, number>;
  attitude?: Record<string, number>;
}

// Keyed by studentId -> CompetencyRubricEntry
export type CompetencyRubricMap = Record<string, CompetencyRubricEntry>;

// Keyed by `${year}-${month}` -> CompetencyRubricMap
export type CompetencyRubricsByMonth = Record<string, CompetencyRubricMap>;

// Keyed by '1' | '2' -> CompetencyRubricMap
export type CompetencyRubricsByTerm = Record<string, CompetencyRubricMap>;

// Keyed by '1' | '2' -> ScoreMap
export type SemesterScoresByTerm = Record<string, ScoreMap>;

// Keyed by studentId -> domainKey -> string ('A' | 'B' | 'C' | 'D' | 'E' | 'F' or custom)
export type DomainGradeMap = Record<string, Record<string, string>>;

// Keyed by '1' | '2' -> DomainGradeMap
export type DomainGradesByTerm = Record<string, DomainGradeMap>;

// Keyed by studentId -> remark string
export type RemarksMap = Record<string, string>;

export function getMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  url: string;
}

export const SHEET_TABS = {
  ATTENDANCE: 'អវត្តមានប្រចាំខែ',
  MONTHLY_SCORES: 'ពិន្ទុប្រចាំខែ',
  SEMESTER_RESULTS: 'លទ្ធផលប្រចាំឆមាស',
} as const;

export const SAMPLE_STUDENTS: Student[] = [
  { id: 'stu-1', studentCode: '2601310', name: 'កេត សម្បត្តិរាជ', gender: 'ប្រុស' },
  { id: 'stu-2', studentCode: '2601311', name: 'ជន មុនី', gender: 'ប្រុស' },
  { id: 'stu-3', studentCode: '2601312', name: 'ជុម សុធាន្នី', gender: 'ស្រី' },
  { id: 'stu-4', studentCode: '2601313', name: 'ឈ្លី ចាន់ថា', gender: 'ស្រី' },
  { id: 'stu-5', studentCode: '2601314', name: 'ចឹម ហ្សាសែ', gender: 'ស្រី' },
  { id: 'stu-6', studentCode: '2601315', name: 'ធុន វត្តី', gender: 'ស្រី' },
  { id: 'stu-7', studentCode: '2601316', name: 'ជីន រ៉ា', gender: 'ស្រី' },
  { id: 'stu-8', studentCode: '2601317', name: 'ញ៉ាន ណារីន', gender: 'ស្រី' },
  { id: 'stu-9', studentCode: '2501257', name: 'ដែម ឆានុន', gender: 'ប្រុស' },
  { id: 'stu-10', studentCode: '2601319', name: 'ណឹម ច័ន្ទស្រីកា', gender: 'ស្រី' },
  { id: 'stu-11', studentCode: '2601320', name: 'ថន ណារិន', gender: 'ប្រុស' },
  { id: 'stu-12', studentCode: '2601321', name: 'ប៊ុនទី មេត្តា', gender: 'ប្រុស' },
  { id: 'stu-13', studentCode: '', name: 'ផល កីតូន', gender: 'ប្រុស' },
  { id: 'stu-14', studentCode: '2601323', name: 'ផាន់ ម៉ូលីកា', gender: 'ស្រី' },
  { id: 'stu-15', studentCode: '2601324', name: 'ផុន តុលា', gender: 'ប្រុស' },
  { id: 'stu-16', studentCode: '2601325', name: 'ម៉ាញ មុន្នីរិទ្ធ', gender: 'ប្រុស' },
  { id: 'stu-17', studentCode: '2601326', name: 'រ៉ន រ៉ាវ៉ាត់ត្រា', gender: 'ប្រុស' },
  { id: 'stu-18', studentCode: '2601327', name: 'រ៉ស៊ិក រាវីហ្សន', gender: 'ប្រុស' },
  { id: 'stu-19', studentCode: '2601328', name: 'រី សុខរ៉ាត់', gender: 'ប្រុស' },
  { id: 'stu-20', studentCode: '2601330', name: 'សាំង សិលា', gender: 'ប្រុស' },
  { id: 'stu-21', studentCode: '2601331', name: 'សុខ រតនា', gender: 'ប្រុស' },
  { id: 'stu-22', studentCode: '2601332', name: 'សុទ្ធ សុធារ៉ា', gender: 'ប្រុស' },
  { id: 'stu-23', studentCode: '2601333', name: 'សែន សិលា', gender: 'ស្រី' },
  { id: 'stu-24', studentCode: '2601334', name: 'ស្រៀង ស្រីទូច', gender: 'ស្រី' },
  { id: 'stu-25', studentCode: '2501275', name: 'ហាប់ តុលា', gender: 'ប្រុស' },
  { id: 'stu-26', studentCode: '2601335', name: 'ហៀន រិទ្ធី', gender: 'ប្រុស' },
  { id: 'stu-27', studentCode: '2601336', name: 'ឡ ផានុ', gender: 'ប្រុស' },
  { id: 'stu-28', studentCode: '2601337', name: 'អ៊ឹង ប៊ុនលាប', gender: 'ប្រុស' },
  { id: 'stu-29', studentCode: '2601338', name: 'អ៊ុក ចាន់លិក', gender: 'ស្រី' },
  { id: 'stu-30', studentCode: '2601339', name: 'អ៊ុក សុខលី', gender: 'ប្រុស' },
];

import {
  ACADEMIC_MONTHLY_SUBJECTS,
  ALL_MONTHLY_SUBJECTS,
  AttendanceByMonth,
  AttendanceMap,
  COMPETENCY_SUBJECT_KEYS,
  ClassSettings,
  DOMAIN_GRADES,
  DomainGradeMap,
  DomainGradesByTerm,
  KHMER_MONTHS,
  MonthlyScoresByMonth,
  RemarksMap,
  SEMESTER_COMPETENCY_SUBJECTS,
  SEMESTER_EXAM_SUBJECTS,
  SHEET_TABS,
  ScoreMap,
  SemesterScoresByTerm,
  SpreadsheetInfo,
  Student,
  SubjectGroup,
  SubjectItem,
  getAttendanceMonthYear,
  getEffectivelyHiddenAnnualCompetencyKeySet,
  getEffectivelyHiddenMonthlySubjectKeySet,
  getEffectivelyHiddenSemesterSubjectKeySet,
  getMonthlyScoresMonthYear,
  getMonthKey,
  getResolvedMonthlySubjectGroups,
  getResolvedMonthlySubjects,
  getResolvedSemesterExamSubjects,
} from '../types/gradebook';
import {
  SemesterResult,
  colIndexToLetter,
  computeCombinedMonthlyResults,
  computeSemesterResults,
  getCalendarYearForAcademicMonth,
  getMonthCalendarDays,
  resolveMonthScoreMap,
} from '../utils/calculations';

export class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}

async function googleFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `Google API Error (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (text) msg = text;
    }
    throw new GoogleApiError(msg, res.status);
  }
  return res.json();
}

export interface DriveSheetFile {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export async function listAppSpreadsheets(token: string): Promise<DriveSheetFile[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=20`;
  const data = await googleFetch(url, token);
  return data.files || [];
}

export async function getSpreadsheetMetadata(
  token: string,
  spreadsheetId: string
): Promise<{
  spreadsheetId: string;
  title: string;
  url: string;
  sheets: { sheetId: number; title: string }[];
}> {
  const id = extractSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`;
  const data = await googleFetch(url, token);
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Google Sheet',
    url:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheets: (data.sheets || []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    })),
  };
}

export function getAttendanceTabName(month: number): string {
  const m = KHMER_MONTHS.find((item) => item.value === month)?.label || `${month}`;
  return `អវត្តមាន_${m}`;
}

export function getMonthlyTabName(month: number): string {
  const m = KHMER_MONTHS.find((item) => item.value === month)?.label || `${month}`;
  return `ពិន្ទុ_${m}`;
}

export function getSemesterTabName(semester: 1 | 2): string {
  return semester === 1 ? 'ឆមាសទី_១' : 'ឆមាសទី_២';
}

function hasAnyAttendance(map?: AttendanceMap): boolean {
  if (!map) return false;
  return Object.values(map).some((days) =>
    Object.values(days).some((mark) => mark === 'ច្ប' || mark === 'ឈ' || mark === 'អច្ប')
  );
}

function hasAnyScores(map?: ScoreMap): boolean {
  if (!map) return false;
  return Object.values(map).some((scores) =>
    Object.values(scores).some((v) => typeof v === 'number' && !Number.isNaN(v))
  );
}

function hasAnyDomains(map?: DomainGradeMap): boolean {
  if (!map) return false;
  return Object.values(map).some((doms) =>
    Object.values(doms).some((v) => Boolean(v && v.trim()))
  );
}

export interface SyncPlan {
  monthsToSyncAttendance: number[];
  monthsToSyncMonthly: number[];
  semestersToSync: (1 | 2)[];
  tabNames: string[];
}

export function buildSyncPlan(
  settings: ClassSettings,
  attendanceByMonth: AttendanceByMonth,
  monthlyScoresByMonth: MonthlyScoresByMonth,
  semesterScoresByTerm: SemesterScoresByTerm,
  domainGradesByTerm: DomainGradesByTerm
): SyncPlan {
  const attPeriod = getAttendanceMonthYear(settings);
  const monPeriod = getMonthlyScoresMonthYear(settings);
  const attMonthsSet = new Set<number>([attPeriod.month]);
  const monMonthsSet = new Set<number>([monPeriod.month]);
  const semSet = new Set<1 | 2>([settings.semester]);

  for (const m of KHMER_MONTHS) {
    const attCalYear = getCalendarYearForAcademicMonth(
      settings.academicYear,
      m.value,
      attPeriod.year
    );
    const monCalYear = getCalendarYearForAcademicMonth(
      settings.academicYear,
      m.value,
      monPeriod.year
    );
    if (
      hasAnyAttendance(attendanceByMonth[getMonthKey(attCalYear, m.value)]) ||
      hasAnyAttendance(attendanceByMonth[getMonthKey(attPeriod.year, m.value)])
    ) {
      attMonthsSet.add(m.value);
    }
    if (
      hasAnyScores(monthlyScoresByMonth[getMonthKey(monCalYear, m.value)]) ||
      hasAnyScores(monthlyScoresByMonth[getMonthKey(monPeriod.year, m.value)])
    ) {
      monMonthsSet.add(m.value);
    }
  }

  for (const term of [1, 2] as const) {
    const k = String(term);
    if (hasAnyScores(semesterScoresByTerm[k]) || hasAnyDomains(domainGradesByTerm[k])) {
      semSet.add(term);
    }
  }
  if (hasAnyScores(semesterScoresByTerm['annual']) || hasAnyDomains(domainGradesByTerm['annual'])) {
    semSet.add(2);
  }

  const monthsToSyncAttendance = Array.from(attMonthsSet).sort((a, b) => a - b);
  const monthsToSyncMonthly = Array.from(monMonthsSet).sort((a, b) => a - b);
  const semestersToSync = Array.from(semSet).sort((a, b) => a - b);

  const tabNames = [
    ...monthsToSyncAttendance.map(getAttendanceTabName),
    ...monthsToSyncMonthly.map(getMonthlyTabName),
    ...semestersToSync.map(getSemesterTabName),
  ];

  return {
    monthsToSyncAttendance,
    monthsToSyncMonthly,
    semestersToSync,
    tabNames,
  };
}

const BORDER_THIN = {
  style: 'SOLID',
  width: 1,
  color: { red: 0.15, green: 0.2, blue: 0.3 },
};

const ALL_BORDERS = {
  top: BORDER_THIN,
  bottom: BORDER_THIN,
  left: BORDER_THIN,
  right: BORDER_THIN,
};

const HEADER_BG = { red: 0.94, green: 0.96, blue: 0.99 };
const RED_BG = { red: 1, green: 0, blue: 0 };
const WHITE_TEXT = { red: 1, green: 1, blue: 1 };
const DARK_TEXT = { red: 0.08, green: 0.11, blue: 0.18 };
const RED_TEXT = { red: 0.88, green: 0.06, blue: 0.06 };
const BLUE_TEXT = { red: 0.11, green: 0.31, blue: 0.85 };
const LAVENDER_BG = { red: 0.96, green: 0.93, blue: 1 };

function buildAttendanceValues(
  year: number,
  month: number,
  students: Student[],
  attendance: AttendanceMap,
  remarks: RemarksMap
): (string | number)[][] {
  const calendarDays = getMonthCalendarDays(year, month);
  const daysCount = calendarDays.length;
  const lastDayCol = colIndexToLetter(4 + daysCount - 1);
  const excCol = colIndexToLetter(5 + daysCount);
  const unexcCol = colIndexToLetter(6 + daysCount);
  const totCol = colIndexToLetter(7 + daysCount);

  const row0: (string | number)[] = [
    'ល.រ',
    'អត្តលេខ',
    'គោត្តនាម និងនាម',
    'ភេទ',
    ...calendarDays.map((d) => d.day),
    '',
    'ចំនួនអវត្តមាន',
    '',
    '',
    'ផ្សេងៗ',
  ];

  const row1: (string | number)[] = [
    '',
    '',
    '',
    '',
    ...calendarDays.map((d) => d.khmerDay),
    '',
    'ច្ប',
    'អច្ប',
    'សរុប',
    '',
  ];

  const lastStudentRow = Math.max(3, students.length + 2);
  const studentRows = students.map((stu, idx) => {
    const r = idx + 3;
    const stuAtt = attendance[stu.id] || {};
    return [
      idx + 1,
      stu.studentCode || '',
      stu.name,
      stu.gender,
      ...calendarDays.map((d) => stuAtt[d.day] || ''),
      '',
      `=COUNTIF(E${r}:${lastDayCol}${r},"ច្ប")+COUNTIF(E${r}:${lastDayCol}${r},"ឈ")`,
      `=COUNTIF(E${r}:${lastDayCol}${r},"អច្ប")`,
      `=SUM(${excCol}${r}:${unexcCol}${r})`,
      remarks[stu.id] || '',
    ];
  });

  const summaryRow: (string | number)[] = [
    'ចំនួនសិស្សមករៀនប្រចាំថ្ងៃ',
    '',
    '',
    '',
    ...calendarDays.map((d, idx) => {
      if (d.isSunday) return '';
      const colL = colIndexToLetter(4 + idx);
      if (students.length === 0) return 0;
      return `=COUNTA($C$3:$C$${lastStudentRow})-COUNTIF(${colL}3:${colL}${lastStudentRow},"ច្ប")-COUNTIF(${colL}3:${colL}${lastStudentRow},"ឈ")-COUNTIF(${colL}3:${colL}${lastStudentRow},"អច្ប")`;
    }),
    '',
    students.length > 0 ? `=SUM(${excCol}3:${excCol}${lastStudentRow})` : 0,
    students.length > 0 ? `=SUM(${unexcCol}3:${unexcCol}${lastStudentRow})` : 0,
    students.length > 0 ? `=SUM(${totCol}3:${totCol}${lastStudentRow})` : 0,
    '',
  ];

  return [row0, row1, ...studentRows, summaryRow];
}

function buildMonthlyScoreValues(
  settings: ClassSettings,
  students: Student[],
  monthlyScores: ScoreMap,
  remarks: RemarksMap
): {
  values: (string | number)[][];
  visibleGroups: SubjectGroup[];
  visibleSubjects: SubjectItem[];
  hiddenColIndices: number[];
  avgColLetter: string;
} {
  const maxScore = settings.maxScore;
  const visibleGroups = getResolvedMonthlySubjectGroups(settings);
  const visibleSubjects = visibleGroups.flatMap((g) => g.subjects);
  const hiddenMonthlyKeys = getEffectivelyHiddenMonthlySubjectKeySet(
    settings,
    monthlyScores,
    students
  );
  const hiddenColIndices: number[] = [];
  visibleSubjects.forEach((sub, idx) => {
    if (hiddenMonthlyKeys.has(sub.key)) {
      hiddenColIndices.push(3 + idx);
    }
  });
  const row0: (string | number)[] = ['លេខរៀង', 'គោត្តនាម និងនាម', 'ភេទ'];
  const row1: (string | number)[] = ['', '', ''];

  for (const grp of visibleGroups) {
    if (grp.standalone) {
      row0.push(grp.subjects[0]?.label || grp.label);
      row1.push('');
    } else {
      grp.subjects.forEach((sub, idx) => {
        row0.push(idx === 0 ? grp.label : '');
        row1.push(sub.label);
      });
    }
  }

  row0.push('លទ្ធផលប្រចាំខែ', '', '', '', 'សេចក្តីផ្សេងៗ');
  row1.push('ពិន្ទុសរុប', 'មធ្យមភាគ', 'ចំណាត់ថ្នាក់', 'និទ្ទេស', '');

  const lastStudentRow = Math.max(3, students.length + 2);
  const t9 = maxScore === 100 ? 90 : 9;
  const t8 = maxScore === 100 ? 80 : 8;
  const t7 = maxScore === 100 ? 70 : 7;
  const t6 = maxScore === 100 ? 60 : 6;
  const t5 = maxScore === 100 ? 50 : 5;
  const compScale = maxScore === 100 ? '*10' : '';

  const academicCount = visibleSubjects.filter(
    (s) => !COMPETENCY_SUBJECT_KEYS.has(s.key)
  ).length;
  const firstAcademicLetter = colIndexToLetter(3); // D
  const lastAcademicLetter =
    academicCount > 0 ? colIndexToLetter(3 + academicCount - 1) : '';
  const knowledgeIdx = visibleSubjects.findIndex((s) => s.key === 'comp_knowledge');
  const skillsIdx = visibleSubjects.findIndex((s) => s.key === 'comp_skills');
  const attitudeIdx = visibleSubjects.findIndex((s) => s.key === 'comp_attitude');
  const knowledgeLetter =
    knowledgeIdx >= 0 ? colIndexToLetter(3 + knowledgeIdx) : '';
  const skillsLetter = skillsIdx >= 0 ? colIndexToLetter(3 + skillsIdx) : '';
  const attitudeLetter =
    attitudeIdx >= 0 ? colIndexToLetter(3 + attitudeIdx) : '';
  const resStartIdx = 3 + visibleSubjects.length;
  const avgColLetter = colIndexToLetter(resStartIdx + 1);

  const studentRows = students.map((stu, idx) => {
    const r = idx + 3;
    const stuScores = monthlyScores[stu.id] || {};
    const scoreCells = visibleSubjects.map((sub) => {
      const v = stuScores[sub.key];
      if (sub.key === 'comp_knowledge') {
        return v === 80 ? '80%' : '';
      }
      if (sub.key === 'comp_skills' || sub.key === 'comp_attitude') {
        return typeof v === 'number' && !Number.isNaN(v) ? Number(v.toFixed(2)) : '';
      }
      return typeof v === 'number' && !Number.isNaN(v) ? v : '';
    });

    const academicRange =
      academicCount > 0 ? `${firstAcademicLetter}${r}:${lastAcademicLetter}${r}` : '';
    const totalFormula = academicRange ? `=SUM(${academicRange})` : 0;
    const academicAvgExpr = academicRange
      ? `IF(COUNT(${academicRange})=0,0,AVERAGE(${academicRange}))`
      : '0';
    const bonusParts: string[] = [];
    if (skillsLetter) bonusParts.push(`N(${skillsLetter}${r})${compScale}`);
    if (attitudeLetter) bonusParts.push(`N(${attitudeLetter}${r})${compScale}`);
    const bonusExpr = bonusParts.length > 0 ? bonusParts.join('+') : '0';
    const avgFormula = knowledgeLetter
      ? `=MIN(${maxScore},IF(${knowledgeLetter}${r}="80%",(${academicAvgExpr})*0.8+${bonusExpr},(${academicAvgExpr})+${bonusExpr}))`
      : `=MIN(${maxScore},(${academicAvgExpr})+${bonusExpr})`;

    return [
      idx + 1,
      stu.name,
      stu.gender,
      ...scoreCells,
      totalFormula,
      avgFormula,
      `=RANK(${avgColLetter}${r},$${avgColLetter}$3:$${avgColLetter}$${lastStudentRow})`,
      `=IF(${avgColLetter}${r}>=${t9},"A",IF(${avgColLetter}${r}>=${t8},"B",IF(${avgColLetter}${r}>=${t7},"C",IF(${avgColLetter}${r}>=${t6},"D",IF(${avgColLetter}${r}>=${t5},"E","F")))))`,
      remarks[stu.id] || '',
    ];
  });

  return {
    values: [row0, row1, ...studentRows],
    visibleGroups,
    visibleSubjects,
    hiddenColIndices,
    avgColLetter,
  };
}

function buildSemesterResultValues(
  term: 1 | 2,
  settings: ClassSettings,
  students: Student[],
  semesterScores: ScoreMap,
  domainGrades: DomainGradeMap,
  remarks: RemarksMap,
  monthlyTabsForAvg: { tabName: string; avgColLetter: string }[],
  annualOptions?: {
    annualScores: ScoreMap;
    annualDomains: DomainGradeMap;
    sem1TabName?: string;
    sem1AvgColLetter?: string;
    sem1Results?: Record<string, SemesterResult>;
  }
): {
  values: (string | number)[][];
  visibleExamSubjects: { key: string; label: string; highlight?: boolean }[];
  visibleCompSubjects: SubjectItem[];
  visibleAnnualCompSubjects: SubjectItem[];
  hiddenColIndices: number[];
  semAvgColLetter: string;
} {
  const isSem2 = term === 2;
  const maxScore = settings.maxScore;
  const visibleExamSubjects = getResolvedSemesterExamSubjects(settings);
  const visibleCompSubjects = SEMESTER_COMPETENCY_SUBJECTS;
  const visibleAnnualCompSubjects = isSem2 ? SEMESTER_COMPETENCY_SUBJECTS : [];
  const hiddenSemesterKeys = getEffectivelyHiddenSemesterSubjectKeySet(
    settings,
    semesterScores,
    students
  );
  const hiddenAnnualKeys = isSem2
    ? getEffectivelyHiddenAnnualCompetencyKeySet(
        settings,
        annualOptions?.annualScores,
        students
      )
    : new Set<string>();

  const examCount = visibleExamSubjects.length;
  const compCount = visibleCompSubjects.length;
  const annCompCount = visibleAnnualCompSubjects.length;
  const semSectionCount = examCount + compCount + 5 + DOMAIN_GRADES.length;
  const annualSectionCount = isSem2 ? annCompCount + 3 + DOMAIN_GRADES.length : 0;

  const row0: (string | number)[] = ['លេខរៀង', 'គោត្តនាម និងនាម', 'ភេទ'];
  const row1: (string | number)[] = ['', '', ''];
  const row2: (string | number)[] = ['', '', ''];

  const groupRow = isSem2 ? row1 : row0;
  const leafRow = isSem2 ? row2 : row1;

  if (isSem2) {
    for (let i = 0; i < semSectionCount; i++) {
      row0.push(i === 0 ? 'ឆមាសទី ២' : '');
    }
    for (let i = 0; i < annualSectionCount; i++) {
      row0.push(i === 0 ? 'ប្រចាំឆ្នាំ' : '');
    }
    row0.push('សេចក្តីផ្សេងៗ');
  }

  visibleExamSubjects.forEach((sub, idx) => {
    groupRow.push(idx === 0 ? 'ពិន្ទុប្រឡងឆមាស' : '');
    leafRow.push(sub.label);
  });

  visibleCompSubjects.forEach((sub, idx) => {
    groupRow.push(idx === 0 ? 'សម្បទាទាំង៣' : '');
    leafRow.push(sub.label);
  });

  const resultCols = [
    'ម. ប្រឡងឆមាស',
    'ម. ប្រចាំខែ',
    'ម. ប្រចាំឆមាស',
    'ចំណាត់ថ្នាក់',
    'និទ្ទេស',
  ];
  resultCols.forEach((label, idx) => {
    groupRow.push(idx === 0 ? 'លទ្ធផលប្រចាំឆមាស' : '');
    leafRow.push(label);
  });

  DOMAIN_GRADES.forEach((dom, idx) => {
    groupRow.push(idx === 0 ? 'និទ្ទេសតាមផ្នែក' : '');
    leafRow.push(dom.label);
  });

  if (isSem2) {
    visibleAnnualCompSubjects.forEach((sub, idx) => {
      row1.push(idx === 0 ? 'សម្បទាទាំង៣' : '');
      row2.push(sub.label);
    });
    ['មធ្យមភាគ', 'ចំណាត់ថ្នាក់', 'និទ្ទេស'].forEach((label, idx) => {
      row1.push(idx === 0 ? 'លទ្ធផល' : '');
      row2.push(label);
    });
    DOMAIN_GRADES.forEach((dom, idx) => {
      row1.push(idx === 0 ? 'និទ្ទេសតាមផ្នែក' : '');
      row2.push(dom.label);
    });
    row1.push('');
    row2.push('');
  } else {
    row0.push('សេចក្តីផ្សេងៗ');
    row1.push('');
  }

  const firstDataRow = isSem2 ? 4 : 3;
  const lastStudentRow = Math.max(firstDataRow, students.length + firstDataRow - 1);
  const t9 = maxScore === 100 ? 90 : 9;
  const t8 = maxScore === 100 ? 80 : 8;
  const t7 = maxScore === 100 ? 70 : 7;
  const t6 = maxScore === 100 ? 60 : 6;
  const t5 = maxScore === 100 ? 50 : 5;
  const compScale = maxScore === 100 ? '*10' : '';

  const examStartIdx = 3;
  const compStartIdx = examStartIdx + examCount;
  const resStartIdx = compStartIdx + compCount;

  const firstExamLetter = examCount > 0 ? colIndexToLetter(examStartIdx) : '';
  const lastExamLetter =
    examCount > 0 ? colIndexToLetter(examStartIdx + examCount - 1) : '';
  const knowledgeIdx = visibleCompSubjects.findIndex(
    (s) => s.key === 'comp_knowledge'
  );
  const skillsIdx = visibleCompSubjects.findIndex(
    (s) => s.key === 'comp_skills'
  );
  const attitudeIdx = visibleCompSubjects.findIndex(
    (s) => s.key === 'comp_attitude'
  );
  const knowledgeLetter =
    knowledgeIdx >= 0 ? colIndexToLetter(compStartIdx + knowledgeIdx) : '';
  const skillsLetter =
    skillsIdx >= 0 ? colIndexToLetter(compStartIdx + skillsIdx) : '';
  const attitudeLetter =
    attitudeIdx >= 0 ? colIndexToLetter(compStartIdx + attitudeIdx) : '';

  const examAvgLetter = colIndexToLetter(resStartIdx);
  const monthAvgLetter = colIndexToLetter(resStartIdx + 1);
  const semAvgColLetter = colIndexToLetter(resStartIdx + 2);

  const annCompStartIdx = 3 + semSectionCount;
  const annResStartIdx = annCompStartIdx + annCompCount;
  const annKnowledgeIdx = visibleAnnualCompSubjects.findIndex(
    (s) => s.key === 'comp_knowledge'
  );
  const annSkillsIdx = visibleAnnualCompSubjects.findIndex(
    (s) => s.key === 'comp_skills'
  );
  const annAttitudeIdx = visibleAnnualCompSubjects.findIndex(
    (s) => s.key === 'comp_attitude'
  );
  const annKnowledgeLetter =
    isSem2 && annKnowledgeIdx >= 0
      ? colIndexToLetter(annCompStartIdx + annKnowledgeIdx)
      : '';
  const annSkillsLetter =
    isSem2 && annSkillsIdx >= 0
      ? colIndexToLetter(annCompStartIdx + annSkillsIdx)
      : '';
  const annAttitudeLetter =
    isSem2 && annAttitudeIdx >= 0
      ? colIndexToLetter(annCompStartIdx + annAttitudeIdx)
      : '';
  const annAvgLetter = isSem2 ? colIndexToLetter(annResStartIdx) : '';

  const annualScores = annualOptions?.annualScores || {};
  const annualDomains = annualOptions?.annualDomains || {};

  const studentRows = students.map((stu, idx) => {
    const r = idx + firstDataRow;
    const stuScores = semesterScores[stu.id] || {};
    const stuDomains = domainGrades[stu.id] || {};

    const examCells = visibleExamSubjects.map((sub) => {
      const v = stuScores[sub.key];
      return typeof v === 'number' && !Number.isNaN(v) ? v : '';
    });

    const compCells = visibleCompSubjects.map((sub) => {
      const v = stuScores[sub.key];
      if (sub.key === 'comp_knowledge') {
        return v === 80 ? '80%' : '';
      }
      return typeof v === 'number' && !Number.isNaN(v) ? Number(v.toFixed(2)) : '';
    });

    const domainCells = DOMAIN_GRADES.map((dom) => stuDomains[dom.key] || '');

    let monthlyAvgFormula = '0';
    if (monthlyTabsForAvg.length === 1) {
      const { tabName, avgColLetter } = monthlyTabsForAvg[0];
      monthlyAvgFormula = `=IFERROR('${tabName}'!${avgColLetter}${r},0)`;
    } else if (monthlyTabsForAvg.length > 1) {
      const args = monthlyTabsForAvg
        .map(
          ({ tabName, avgColLetter }) =>
            `IF(IFERROR('${tabName}'!${avgColLetter}${r},0)>0,'${tabName}'!${avgColLetter}${r},"")`
        )
        .join(',');
      monthlyAvgFormula = `=IFERROR(AVERAGE(${args}),0)`;
    }

    const examRange =
      examCount > 0 ? `${firstExamLetter}${r}:${lastExamLetter}${r}` : '';
    const rawExamAvgExpr = examRange
      ? `IF(COUNT(${examRange})=0,0,AVERAGE(${examRange}))`
      : '0';
    const bonusParts: string[] = [];
    if (skillsLetter) bonusParts.push(`N(${skillsLetter}${r})${compScale}`);
    if (attitudeLetter) bonusParts.push(`N(${attitudeLetter}${r})${compScale}`);
    const bonusExpr = bonusParts.length > 0 ? bonusParts.join('+') : '0';
    const examAvgFormula = knowledgeLetter
      ? `=MIN(${maxScore},IF(${knowledgeLetter}${r}="80%",(${rawExamAvgExpr})*0.8+${bonusExpr},(${rawExamAvgExpr})+${bonusExpr}))`
      : `=MIN(${maxScore},(${rawExamAvgExpr})+${bonusExpr})`;

    const annualCells: (string | number)[] = [];
    if (isSem2) {
      const stuAnnScores = annualScores[stu.id] || {};
      const stuAnnDomains = annualDomains[stu.id] || {};
      visibleAnnualCompSubjects.forEach((sub) => {
        const v = stuAnnScores[sub.key];
        if (sub.key === 'comp_knowledge') {
          annualCells.push(v === 80 ? '80%' : '');
        } else {
          annualCells.push(
            typeof v === 'number' && !Number.isNaN(v) ? Number(v.toFixed(2)) : ''
          );
        }
      });

      const sem1Static = Number(
        (annualOptions?.sem1Results?.[stu.id]?.semesterAverage ?? 0).toFixed(4)
      );
      const sem1Expr =
        annualOptions?.sem1TabName && annualOptions?.sem1AvgColLetter
          ? `IFERROR('${annualOptions.sem1TabName}'!${annualOptions.sem1AvgColLetter}${r - 1},${sem1Static})`
          : `${sem1Static}`;
      const baseAnnExpr = `IF(AND(${sem1Expr}=0,${semAvgColLetter}${r}=0),0,IF(${semAvgColLetter}${r}=0,${sem1Expr},IF(${sem1Expr}=0,${semAvgColLetter}${r},(${sem1Expr}+${semAvgColLetter}${r})/2)))`;
      const annBonusParts: string[] = [];
      if (annSkillsLetter) annBonusParts.push(`N(${annSkillsLetter}${r})${compScale}`);
      if (annAttitudeLetter) annBonusParts.push(`N(${annAttitudeLetter}${r})${compScale}`);
      const annBonusExpr = annBonusParts.length > 0 ? annBonusParts.join('+') : '0';
      const annAvgFormula = annKnowledgeLetter
        ? `=MIN(${maxScore},IF(${annKnowledgeLetter}${r}="80%",(${baseAnnExpr})*0.8+${annBonusExpr},(${baseAnnExpr})+${annBonusExpr}))`
        : `=MIN(${maxScore},(${baseAnnExpr})+${annBonusExpr})`;
      const annRankFormula = `=RANK(${annAvgLetter}${r},$${annAvgLetter}$${firstDataRow}:$${annAvgLetter}$${lastStudentRow})`;
      const annGradeFormula = `=IF(${annAvgLetter}${r}>=${t9},"A",IF(${annAvgLetter}${r}>=${t8},"B",IF(${annAvgLetter}${r}>=${t7},"C",IF(${annAvgLetter}${r}>=${t6},"D",IF(${annAvgLetter}${r}>=${t5},"E","F")))))`;

      annualCells.push(annAvgFormula, annRankFormula, annGradeFormula);
      DOMAIN_GRADES.forEach((dom) => annualCells.push(stuAnnDomains[dom.key] || ''));
    }

    return [
      idx + 1,
      stu.name,
      stu.gender,
      ...examCells,
      ...compCells,
      examAvgFormula,
      monthlyAvgFormula,
      `=IF(AND(${examAvgLetter}${r}=0,${monthAvgLetter}${r}=0),0,IF(${monthAvgLetter}${r}=0,${examAvgLetter}${r},IF(${examAvgLetter}${r}=0,${monthAvgLetter}${r},(${examAvgLetter}${r}+${monthAvgLetter}${r})/2)))`,
      `=RANK(${semAvgColLetter}${r},$${semAvgColLetter}$${firstDataRow}:$${semAvgColLetter}$${lastStudentRow})`,
      `=IF(${semAvgColLetter}${r}>=${t9},"A",IF(${semAvgColLetter}${r}>=${t8},"B",IF(${semAvgColLetter}${r}>=${t7},"C",IF(${semAvgColLetter}${r}>=${t6},"D",IF(${semAvgColLetter}${r}>=${t5},"E","F")))))`,
      ...domainCells,
      ...annualCells,
      remarks[stu.id] || '',
    ];
  });

  const hiddenColIndices: number[] = [];
  visibleExamSubjects.forEach((sub, idx) => {
    if (hiddenSemesterKeys.has(sub.key)) {
      hiddenColIndices.push(examStartIdx + idx);
    }
  });
  visibleCompSubjects.forEach((sub, idx) => {
    if (hiddenSemesterKeys.has(sub.key)) {
      hiddenColIndices.push(compStartIdx + idx);
    }
  });
  if (isSem2) {
    visibleAnnualCompSubjects.forEach((sub, idx) => {
      if (hiddenAnnualKeys.has(sub.key)) {
        hiddenColIndices.push(annCompStartIdx + idx);
      }
    });
  }

  const headerRows = isSem2 ? [row0, row1, row2] : [row0, row1];
  return {
    values: [...headerRows, ...studentRows],
    visibleExamSubjects,
    visibleCompSubjects,
    visibleAnnualCompSubjects,
    hiddenColIndices,
    semAvgColLetter,
  };
}

function buildAttendanceFormattingRequests(
  attId: number,
  year: number,
  month: number,
  studentCount: number
): any[] {
  const requests: any[] = [];
  const calendarDays = getMonthCalendarDays(year, month);
  const daysCount = calendarDays.length;
  const attCols = 9 + daysCount;
  const attRows = 3 + studentCount;

  requests.push(
    {
      unmergeCells: {
        range: {
          sheetId: attId,
          startRowIndex: 0,
          endRowIndex: attRows + 10,
          startColumnIndex: 0,
          endColumnIndex: attCols + 5,
        },
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId: attId,
          gridProperties: { frozenRowCount: 2, frozenColumnCount: 3 },
        },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    },
    ...[0, 1, 2, 3, 8 + daysCount].map((col) => ({
      mergeCells: {
        range: {
          sheetId: attId,
          startRowIndex: 0,
          endRowIndex: 2,
          startColumnIndex: col,
          endColumnIndex: col + 1,
        },
        mergeType: 'MERGE_ALL',
      },
    })),
    {
      mergeCells: {
        range: {
          sheetId: attId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 5 + daysCount,
          endColumnIndex: 8 + daysCount,
        },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: {
          sheetId: attId,
          startRowIndex: 2 + studentCount,
          endRowIndex: 3 + studentCount,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: attId,
          startRowIndex: 0,
          endRowIndex: attRows,
          startColumnIndex: 0,
          endColumnIndex: attCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            borders: ALL_BORDERS,
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            textFormat: {
              fontFamily: 'Kantumruy Pro',
              fontSize: 10,
              foregroundColor: DARK_TEXT,
            },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,borders,verticalAlignment,horizontalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId: attId,
          startRowIndex: 0,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: attCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: {
              fontFamily: 'Kantumruy Pro',
              fontSize: 10,
              bold: true,
              foregroundColor: DARK_TEXT,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    ...(studentCount > 0
      ? [
          {
            repeatCell: {
              range: {
                sheetId: attId,
                startRowIndex: 2,
                endRowIndex: 2 + studentCount,
                startColumnIndex: 2,
                endColumnIndex: 3,
              },
              cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
              fields: 'userEnteredFormat.horizontalAlignment',
            },
          },
        ]
      : []),
    {
      repeatCell: {
        range: {
          sheetId: attId,
          startRowIndex: 2 + studentCount,
          endRowIndex: 3 + studentCount,
          startColumnIndex: 0,
          endColumnIndex: attCols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: {
              fontFamily: 'Kantumruy Pro',
              fontSize: 10,
              bold: true,
              foregroundColor: DARK_TEXT,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 78 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 165 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 4, endIndex: 4 + daysCount }, properties: { pixelSize: 32 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 4 + daysCount, endIndex: 5 + daysCount }, properties: { pixelSize: 16 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 5 + daysCount, endIndex: 8 + daysCount }, properties: { pixelSize: 46 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: attId, dimension: 'COLUMNS', startIndex: 8 + daysCount, endIndex: 9 + daysCount }, properties: { pixelSize: 95 }, fields: 'pixelSize' } }
  );

  calendarDays.forEach((d, idx) => {
    if (d.isSunday) {
      const col = 4 + idx;
      requests.push(
        {
          repeatCell: {
            range: { sheetId: attId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: RED_BG,
                textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: WHITE_TEXT },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          repeatCell: {
            range: { sheetId: attId, startRowIndex: 2, endRowIndex: attRows, startColumnIndex: col, endColumnIndex: col + 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: RED_BG,
                textFormat: { foregroundColor: WHITE_TEXT },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        }
      );
    }
  });

  return requests;
}

function buildMonthlyFormattingRequests(
  mId: number,
  studentCount: number,
  visibleGroups: SubjectGroup[],
  visibleSubjects: SubjectItem[],
  hiddenColIndices: number[] = []
): any[] {
  const subCount = visibleSubjects.length;
  const resStartIdx = 3 + subCount;
  const remarkIdx = resStartIdx + 4;
  const mCols = remarkIdx + 1;
  const mRows = 2 + studentCount;

  const verticalMergeCols: number[] = [0, 1, 2, remarkIdx];
  const groupHeaderMerges: { start: number; end: number }[] = [];
  let cursor = 3;
  for (const grp of visibleGroups) {
    if (grp.standalone) {
      verticalMergeCols.push(cursor);
      cursor += 1;
    } else {
      const start = cursor;
      const end = cursor + grp.subjects.length;
      if (end - start > 1) {
        groupHeaderMerges.push({ start, end });
      }
      cursor = end;
    }
  }
  groupHeaderMerges.push({ start: resStartIdx, end: resStartIdx + 4 });

  const decimalFormatCols: number[] = [resStartIdx, resStartIdx + 1];
  visibleSubjects.forEach((s, idx) => {
    if (s.key === 'comp_skills' || s.key === 'comp_attitude') {
      decimalFormatCols.push(3 + idx);
    }
  });

  const requests: any[] = [
    {
      unmergeCells: {
        range: { sheetId: mId, startRowIndex: 0, endRowIndex: mRows + 10, startColumnIndex: 0, endColumnIndex: Math.max(mCols + 5, 37) },
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: mId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 3 } },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    },
    ...verticalMergeCols.map((col) => ({
      mergeCells: {
        range: { sheetId: mId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: col, endColumnIndex: col + 1 },
        mergeType: 'MERGE_ALL',
      },
    })),
    ...groupHeaderMerges.map(({ start, end }) => ({
      mergeCells: {
        range: { sheetId: mId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: start, endColumnIndex: end },
        mergeType: 'MERGE_ALL',
      },
    })),
    {
      repeatCell: {
        range: { sheetId: mId, startRowIndex: 0, endRowIndex: mRows, startColumnIndex: 0, endColumnIndex: mCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            borders: ALL_BORDERS,
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, foregroundColor: DARK_TEXT },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,borders,verticalAlignment,horizontalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: mId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: mCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: DARK_TEXT },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: mId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 3, endColumnIndex: remarkIdx },
        cell: { userEnteredFormat: { textRotation: { angle: 90 } } },
        fields: 'userEnteredFormat.textRotation',
      },
    },
    ...verticalMergeCols
      .filter((col) => col !== 1 && col !== 2)
      .map((col) => ({
        repeatCell: {
          range: { sheetId: mId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { textRotation: { angle: 90 } } },
          fields: 'userEnteredFormat.textRotation',
        },
      })),
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 44 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 165 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    ...(subCount > 0
      ? [{ updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: 3, endIndex: resStartIdx }, properties: { pixelSize: 42 }, fields: 'pixelSize' } }]
      : []),
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: resStartIdx, endIndex: remarkIdx }, properties: { pixelSize: 56 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: remarkIdx, endIndex: mCols }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: mId, dimension: 'COLUMNS', startIndex: 0, endIndex: mCols }, properties: { hiddenByUser: false }, fields: 'hiddenByUser' } },
    ...hiddenColIndices.map((colIdx) => ({
      updateDimensionProperties: {
        range: { sheetId: mId, dimension: 'COLUMNS', startIndex: colIdx, endIndex: colIdx + 1 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    })),
  ];

  if (studentCount > 0) {
    requests.push(
      {
        repeatCell: {
          range: { sheetId: mId, startRowIndex: 2, endRowIndex: mRows, startColumnIndex: 1, endColumnIndex: 2 },
          cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      },
      ...decimalFormatCols.map((colIdx) => ({
        repeatCell: {
          range: { sheetId: mId, startRowIndex: 2, endRowIndex: mRows, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })),
      {
        repeatCell: {
          range: { sheetId: mId, startRowIndex: 2, endRowIndex: mRows, startColumnIndex: resStartIdx + 1, endColumnIndex: remarkIdx },
          cell: {
            userEnteredFormat: {
              textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: RED_TEXT },
            },
          },
          fields: 'userEnteredFormat.textFormat',
        },
      }
    );
  }

  return requests;
}

function buildSemesterFormattingRequests(
  sId: number,
  studentCount: number,
  visibleExamSubjects: { key: string; label: string; highlight?: boolean }[],
  visibleCompSubjects: SubjectItem[],
  visibleAnnualCompSubjects: SubjectItem[],
  isSem2: boolean,
  hiddenColIndices: number[] = []
): any[] {
  const headerRowCount = isSem2 ? 3 : 2;
  const groupRowIdx = isSem2 ? 1 : 0;
  const leafRowIdx = isSem2 ? 2 : 1;

  const examCount = visibleExamSubjects.length;
  const compCount = visibleCompSubjects.length;
  const annCompCount = isSem2 ? visibleAnnualCompSubjects.length : 0;
  const examStartIdx = 3;
  const compStartIdx = examStartIdx + examCount;
  const resStartIdx = compStartIdx + compCount;
  const domStartIdx = resStartIdx + 5;
  const domEndIdx = domStartIdx + 4;

  const annStartIdx = domEndIdx;
  const annCompStartIdx = annStartIdx;
  const annResStartIdx = annCompStartIdx + annCompCount;
  const annDomStartIdx = annResStartIdx + 3;
  const annDomEndIdx = annDomStartIdx + 4;

  const remarkIdx = isSem2 ? annDomEndIdx : domEndIdx;
  const sCols = remarkIdx + 1;
  const sRows = headerRowCount + studentCount;

  const groupHeaderMerges: { start: number; end: number }[] = [];
  if (examCount > 1) {
    groupHeaderMerges.push({ start: examStartIdx, end: compStartIdx });
  }
  if (compCount > 1) {
    groupHeaderMerges.push({ start: compStartIdx, end: resStartIdx });
  }
  groupHeaderMerges.push({ start: resStartIdx, end: domStartIdx });
  groupHeaderMerges.push({ start: domStartIdx, end: domEndIdx });
  if (isSem2) {
    if (annCompCount > 1) {
      groupHeaderMerges.push({ start: annCompStartIdx, end: annResStartIdx });
    }
    groupHeaderMerges.push({ start: annResStartIdx, end: annDomStartIdx });
    groupHeaderMerges.push({ start: annDomStartIdx, end: annDomEndIdx });
  }

  const scienceIdx = visibleExamSubjects.findIndex((s) => s.key === 'sem_science');
  const decimalFormatCols: number[] = [
    resStartIdx,
    resStartIdx + 1,
    resStartIdx + 2,
  ];
  visibleCompSubjects.forEach((s, idx) => {
    if (s.key === 'comp_skills' || s.key === 'comp_attitude') {
      decimalFormatCols.push(compStartIdx + idx);
    }
  });
  if (isSem2) {
    visibleAnnualCompSubjects.forEach((s, idx) => {
      if (s.key === 'comp_skills' || s.key === 'comp_attitude') {
        decimalFormatCols.push(annCompStartIdx + idx);
      }
    });
    decimalFormatCols.push(annResStartIdx);
  }

  const requests: any[] = [
    {
      unmergeCells: {
        range: {
          sheetId: sId,
          startRowIndex: 0,
          endRowIndex: sRows + 10,
          startColumnIndex: 0,
          endColumnIndex: Math.max(sCols + 5, 45),
        },
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: sId, gridProperties: { frozenRowCount: headerRowCount, frozenColumnCount: 3 } },
        fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount',
      },
    },
    ...[0, 1, 2, remarkIdx].map((col) => ({
      mergeCells: {
        range: { sheetId: sId, startRowIndex: 0, endRowIndex: headerRowCount, startColumnIndex: col, endColumnIndex: col + 1 },
        mergeType: 'MERGE_ALL',
      },
    })),
    ...(isSem2
      ? [
          {
            mergeCells: {
              range: { sheetId: sId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: examStartIdx, endColumnIndex: domEndIdx },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            mergeCells: {
              range: { sheetId: sId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: annStartIdx, endColumnIndex: remarkIdx },
              mergeType: 'MERGE_ALL',
            },
          },
        ]
      : []),
    ...groupHeaderMerges.map(({ start, end }) => ({
      mergeCells: {
        range: { sheetId: sId, startRowIndex: groupRowIdx, endRowIndex: groupRowIdx + 1, startColumnIndex: start, endColumnIndex: end },
        mergeType: 'MERGE_ALL',
      },
    })),
    {
      repeatCell: {
        range: { sheetId: sId, startRowIndex: 0, endRowIndex: sRows, startColumnIndex: 0, endColumnIndex: sCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
            borders: ALL_BORDERS,
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
            textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, foregroundColor: DARK_TEXT },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,borders,verticalAlignment,horizontalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId: sId, startRowIndex: 0, endRowIndex: headerRowCount, startColumnIndex: 0, endColumnIndex: sCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: DARK_TEXT },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    },
    ...(isSem2
      ? [
          {
            repeatCell: {
              range: {
                sheetId: sId,
                startRowIndex: leafRowIdx,
                endRowIndex: leafRowIdx + 1,
                startColumnIndex: annCompStartIdx,
                endColumnIndex: annDomStartIdx,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: BLUE_TEXT },
                },
              },
              fields: 'userEnteredFormat.textFormat',
            },
          },
        ]
      : []),
    {
      repeatCell: {
        range: { sheetId: sId, startRowIndex: leafRowIdx, endRowIndex: leafRowIdx + 1, startColumnIndex: 3, endColumnIndex: remarkIdx },
        cell: { userEnteredFormat: { textRotation: { angle: 90 } } },
        fields: 'userEnteredFormat.textRotation',
      },
    },
    ...[0, remarkIdx].map((col) => ({
      repeatCell: {
        range: { sheetId: sId, startRowIndex: 0, endRowIndex: headerRowCount, startColumnIndex: col, endColumnIndex: col + 1 },
        cell: { userEnteredFormat: { textRotation: { angle: 90 } } },
        fields: 'userEnteredFormat.textRotation',
      },
    })),
    ...(scienceIdx >= 0
      ? [
          {
            repeatCell: {
              range: {
                sheetId: sId,
                startRowIndex: leafRowIdx,
                endRowIndex: sRows,
                startColumnIndex: examStartIdx + scienceIdx,
                endColumnIndex: examStartIdx + scienceIdx + 1,
              },
              cell: { userEnteredFormat: { backgroundColor: LAVENDER_BG } },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ]
      : []),
    ...(isSem2
      ? [
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 32 }, fields: 'pixelSize' } },
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 30 }, fields: 'pixelSize' } },
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
        ]
      : [
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 38 }, fields: 'pixelSize' } },
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
        ]),
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 44 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 165 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    ...(examCount > 0
      ? [{ updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: examStartIdx, endIndex: compStartIdx }, properties: { pixelSize: 44 }, fields: 'pixelSize' } }]
      : []),
    ...(compCount > 0
      ? [{ updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: compStartIdx, endIndex: resStartIdx }, properties: { pixelSize: 42 }, fields: 'pixelSize' } }]
      : []),
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: resStartIdx, endIndex: domStartIdx }, properties: { pixelSize: 56 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: domStartIdx, endIndex: domEndIdx }, properties: { pixelSize: 52 }, fields: 'pixelSize' } },
    ...(isSem2
      ? [
          ...(annCompCount > 0
            ? [{ updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: annCompStartIdx, endIndex: annResStartIdx }, properties: { pixelSize: 42 }, fields: 'pixelSize' } }]
            : []),
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: annResStartIdx, endIndex: annDomStartIdx }, properties: { pixelSize: 54 }, fields: 'pixelSize' } },
          { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: annDomStartIdx, endIndex: annDomEndIdx }, properties: { pixelSize: 52 }, fields: 'pixelSize' } },
        ]
      : []),
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: remarkIdx, endIndex: sCols }, properties: { pixelSize: 90 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: sId, dimension: 'COLUMNS', startIndex: 0, endIndex: sCols }, properties: { hiddenByUser: false }, fields: 'hiddenByUser' } },
    ...hiddenColIndices.map((colIdx) => ({
      updateDimensionProperties: {
        range: { sheetId: sId, dimension: 'COLUMNS', startIndex: colIdx, endIndex: colIdx + 1 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    })),
  ];

  if (studentCount > 0) {
    requests.push(
      {
        repeatCell: {
          range: { sheetId: sId, startRowIndex: headerRowCount, endRowIndex: sRows, startColumnIndex: 1, endColumnIndex: 2 },
          cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
          fields: 'userEnteredFormat.horizontalAlignment',
        },
      },
      ...decimalFormatCols.map((colIdx) => ({
        repeatCell: {
          range: { sheetId: sId, startRowIndex: headerRowCount, endRowIndex: sRows, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '0.00' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      })),
      {
        repeatCell: {
          range: { sheetId: sId, startRowIndex: headerRowCount, endRowIndex: sRows, startColumnIndex: resStartIdx, endColumnIndex: domStartIdx },
          cell: {
            userEnteredFormat: {
              textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: RED_TEXT },
            },
          },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      ...(isSem2
        ? [
            {
              repeatCell: {
                range: { sheetId: sId, startRowIndex: headerRowCount, endRowIndex: sRows, startColumnIndex: annResStartIdx, endColumnIndex: annDomStartIdx },
                cell: {
                  userEnteredFormat: {
                    textFormat: { fontFamily: 'Kantumruy Pro', fontSize: 10, bold: true, foregroundColor: RED_TEXT },
                  },
                },
                fields: 'userEnteredFormat.textFormat',
              },
            },
          ]
        : [])
    );
  }

  return requests;
}

export async function createFormattedGradebookSheet(
  token: string,
  title: string,
  settings: ClassSettings,
  students: Student[],
  attendanceByMonth: AttendanceByMonth,
  monthlyScoresByMonth: MonthlyScoresByMonth,
  semesterScoresByTerm: SemesterScoresByTerm,
  domainGradesByTerm: DomainGradesByTerm,
  remarks: RemarksMap
): Promise<SpreadsheetInfo> {
  const plan = buildSyncPlan(
    settings,
    attendanceByMonth,
    monthlyScoresByMonth,
    semesterScoresByTerm,
    domainGradesByTerm
  );

  const createPayload = {
    properties: { title, locale: 'en_US' },
    sheets: plan.tabNames.map((tabTitle, i) => ({
      properties: { title: tabTitle, sheetId: 101 + i },
    })),
  };

  const created = await googleFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    token,
    {
      method: 'POST',
      body: JSON.stringify(createPayload),
    }
  );

  const spreadsheetId = created.spreadsheetId;

  await syncDataToSpreadsheet(
    token,
    spreadsheetId,
    settings,
    students,
    attendanceByMonth,
    monthlyScoresByMonth,
    semesterScoresByTerm,
    domainGradesByTerm,
    remarks
  );

  return {
    spreadsheetId,
    title: created.properties?.title || title,
    url:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function syncDataToSpreadsheet(
  token: string,
  spreadsheetId: string,
  settings: ClassSettings,
  students: Student[],
  attendanceByMonth: AttendanceByMonth,
  monthlyScoresByMonth: MonthlyScoresByMonth,
  semesterScoresByTerm: SemesterScoresByTerm,
  domainGradesByTerm: DomainGradesByTerm,
  remarks: RemarksMap
): Promise<SpreadsheetInfo> {
  const plan = buildSyncPlan(
    settings,
    attendanceByMonth,
    monthlyScoresByMonth,
    semesterScoresByTerm,
    domainGradesByTerm
  );

  const meta = await getSpreadsheetMetadata(token, spreadsheetId);
  const existingMap = new Map(meta.sheets.map((s) => [s.title, s.sheetId]));

  // Add any missing month/semester tabs
  const addSheetRequests: any[] = [];
  for (const tabTitle of plan.tabNames) {
    if (!existingMap.has(tabTitle)) {
      addSheetRequests.push({ addSheet: { properties: { title: tabTitle } } });
    }
  }

  let updatedMeta = meta;
  if (addSheetRequests.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}:batchUpdate`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ requests: addSheetRequests }),
      }
    );
    updatedMeta = await getSpreadsheetMetadata(token, meta.spreadsheetId);
  }

  const sheetMap = new Map(updatedMeta.sheets.map((s) => [s.title, s.sheetId]));

  // Clear synced ranges cleanly
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}/values:batchClear`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: plan.tabNames.map((t) => `'${t}'!A1:AZ200`),
      }),
    }
  );

  const valueData: { range: string; values: (string | number)[][] }[] = [];
  const formatRequests: any[] = [];

  const attPeriod = getAttendanceMonthYear(settings);
  const monPeriod = getMonthlyScoresMonthYear(settings);

  for (const m of plan.monthsToSyncAttendance) {
    const tabName = getAttendanceTabName(m);
    const sheetId = sheetMap.get(tabName)!;
    const academicCalYear = getCalendarYearForAcademicMonth(
      settings.academicYear,
      m,
      attPeriod.year
    );
    const customAttKey = getMonthKey(attPeriod.year, m);
    const academicAttKey = getMonthKey(academicCalYear, m);
    const calYear =
      m === attPeriod.month &&
      (hasAnyAttendance(attendanceByMonth[customAttKey]) ||
        !hasAnyAttendance(attendanceByMonth[academicAttKey]))
        ? attPeriod.year
        : hasAnyAttendance(attendanceByMonth[customAttKey]) &&
          !hasAnyAttendance(attendanceByMonth[academicAttKey])
        ? attPeriod.year
        : academicCalYear;
    const key = getMonthKey(calYear, m);
    valueData.push({
      range: `'${tabName}'!A1`,
      values: buildAttendanceValues(
        calYear,
        m,
        students,
        attendanceByMonth[key] || {},
        remarks
      ),
    });
    formatRequests.push(
      ...buildAttendanceFormattingRequests(sheetId, calYear, m, students.length)
    );
  }

  const monthlyAvgColByTabName: Record<string, string> = {};

  for (const m of plan.monthsToSyncMonthly) {
    const tabName = getMonthlyTabName(m);
    const sheetId = sheetMap.get(tabName)!;
    const academicScoreMap = resolveMonthScoreMap(
      monthlyScoresByMonth,
      settings.academicYear,
      monPeriod.year,
      m
    );
    const customScoreMap = monthlyScoresByMonth[getMonthKey(monPeriod.year, m)];
    const scoreMap =
      (m === monPeriod.month && hasAnyScores(customScoreMap)
        ? customScoreMap
        : academicScoreMap || customScoreMap) || {};
    const built = buildMonthlyScoreValues(
      settings,
      students,
      scoreMap,
      remarks
    );
    monthlyAvgColByTabName[tabName] = built.avgColLetter;
    valueData.push({
      range: `'${tabName}'!A1`,
      values: built.values,
    });
    formatRequests.push(
      ...buildMonthlyFormattingRequests(
        sheetId,
        students.length,
        built.visibleGroups,
        built.visibleSubjects,
        built.hiddenColIndices
      )
    );
  }

  const { results: sem1CombinedMonthly } = computeCombinedMonthlyResults(
    students,
    monthlyScoresByMonth,
    settings.academicYear,
    settings.year,
    settings.semester1Months,
    settings.maxScore
  );
  const sem1Results = computeSemesterResults(
    students,
    semesterScoresByTerm['1'] || {},
    sem1CombinedMonthly,
    settings.maxScore
  );

  let sem1SyncedTabName: string | undefined;
  let sem1SyncedAvgColLetter: string | undefined;

  for (const term of plan.semestersToSync) {
    const tabName = getSemesterTabName(term);
    const sheetId = sheetMap.get(tabName)!;
    const k = String(term);
    const configuredMonths =
      term === 1 ? settings.semester1Months : settings.semester2Months;
    const termMonthlyTabsForAvg = configuredMonths
      .filter((m) => plan.monthsToSyncMonthly.includes(m))
      .map((m) => {
        const mTab = getMonthlyTabName(m);
        return {
          tabName: mTab,
          avgColLetter: monthlyAvgColByTabName[mTab] || 'AC',
        };
      });
    const builtSem = buildSemesterResultValues(
      term,
      settings,
      students,
      semesterScoresByTerm[k] || {},
      domainGradesByTerm[k] || {},
      remarks,
      termMonthlyTabsForAvg,
      term === 2
        ? {
            annualScores: semesterScoresByTerm['annual'] || {},
            annualDomains: domainGradesByTerm['annual'] || {},
            sem1TabName: sem1SyncedTabName,
            sem1AvgColLetter: sem1SyncedAvgColLetter,
            sem1Results,
          }
        : undefined
    );
    if (term === 1) {
      sem1SyncedTabName = tabName;
      sem1SyncedAvgColLetter = builtSem.semAvgColLetter;
    }
    valueData.push({
      range: `'${tabName}'!A1`,
      values: builtSem.values,
    });
    formatRequests.push(
      ...buildSemesterFormattingRequests(
        sheetId,
        students.length,
        builtSem.visibleExamSubjects,
        builtSem.visibleCompSubjects,
        builtSem.visibleAnnualCompSubjects,
        term === 2,
        builtSem.hiddenColIndices
      )
    );
  }

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ requests: formatRequests }),
    }
  );

  return {
    spreadsheetId: updatedMeta.spreadsheetId,
    title: updatedMeta.title,
    url: updatedMeta.url,
  };
}

export async function loadDataFromSpreadsheet(
  token: string,
  spreadsheetId: string,
  settings: ClassSettings
): Promise<{
  info: SpreadsheetInfo;
  students: Student[];
  attendanceByMonth: AttendanceByMonth;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  semesterScoresByTerm: SemesterScoresByTerm;
  domainGradesByTerm: DomainGradesByTerm;
  remarks: RemarksMap;
}> {
  const meta = await getSpreadsheetMetadata(token, spreadsheetId);
  const availableTabs = meta.sheets.map((s) => s.title);

  const tabsToRead = availableTabs.filter(
    (t) =>
      t === SHEET_TABS.ATTENDANCE ||
      t === SHEET_TABS.MONTHLY_SCORES ||
      t === SHEET_TABS.SEMESTER_RESULTS ||
      t.startsWith('អវត្តមាន_') ||
      t.startsWith('ពិន្ទុ_') ||
      t.startsWith('ឆមាសទី_')
  );

  if (tabsToRead.length === 0) {
    return {
      info: { spreadsheetId: meta.spreadsheetId, title: meta.title, url: meta.url },
      students: [],
      attendanceByMonth: {},
      monthlyScoresByMonth: {},
      semesterScoresByTerm: {},
      domainGradesByTerm: {},
      remarks: {},
    };
  }

  const query = tabsToRead
    .map((t) => `ranges=${encodeURIComponent(`'${t}'!A1:AZ200`)}`)
    .join('&');
  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.spreadsheetId}/values:batchGet?${query}`,
    token
  );

  const valueRanges: any[] = res.valueRanges || [];
  const getRowsByTab = (tabName: string): any[][] => {
    const found = valueRanges.find((vr) => vr.range?.includes(tabName));
    return found?.values || [];
  };

  const students: Student[] = [];
  const studentByName = new Map<string, Student>();
  const attendanceByMonth: AttendanceByMonth = {};
  const monthlyScoresByMonth: MonthlyScoresByMonth = {};
  const semesterScoresByTerm: SemesterScoresByTerm = {};
  const domainGradesByTerm: DomainGradesByTerm = {};
  const remarks: RemarksMap = {};

  const ensureStudentFromAttendance = (rows: any[][]) => {
    if (students.length > 0 || rows.length <= 2) return;
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[2] || String(row[0]).includes('ចំនួនសិស្ស')) break;
      const name = String(row[2] || '').trim();
      const stu: Student = {
        id: `stu-${i - 1}`,
        studentCode: String(row[1] || '').trim(),
        name,
        gender: String(row[3] || '').trim() === 'ស្រី' ? 'ស្រី' : 'ប្រុស',
      };
      students.push(stu);
      studentByName.set(name, stu);
    }
  };

  const isThreeRowSemesterHeader = (rows: any[][]) => {
    const r0 = rows[0] || [];
    return (
      rows.length >= 3 &&
      (String(r0[3] || '').includes('ឆមាសទី') ||
        r0.some((c: any) => String(c || '').trim() === 'ប្រចាំឆ្នាំ'))
    );
  };

  const ensureStudentFromScoreRows = (rows: any[][]) => {
    const startIdx = isThreeRowSemesterHeader(rows) ? 3 : 2;
    if (students.length > 0 || rows.length <= startIdx) return;
    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[1]) continue;
      const name = String(row[1] || '').trim();
      const stu: Student = {
        id: `stu-${i - startIdx + 1}`,
        studentCode: '',
        name,
        gender: String(row[2] || '').trim() === 'ស្រី' ? 'ស្រី' : 'ប្រុស',
      };
      students.push(stu);
      studentByName.set(name, stu);
    }
  };

  // First pass: extract student roster from attendance tabs (or fallback to score tabs)
  for (const t of tabsToRead) {
    if (t === SHEET_TABS.ATTENDANCE || t.startsWith('អវត្តមាន_')) {
      ensureStudentFromAttendance(getRowsByTab(t));
    }
  }
  for (const t of tabsToRead) {
    if (
      t === SHEET_TABS.MONTHLY_SCORES ||
      t.startsWith('ពិន្ទុ_') ||
      t === SHEET_TABS.SEMESTER_RESULTS ||
      t.startsWith('ឆមាសទី_')
    ) {
      ensureStudentFromScoreRows(getRowsByTab(t));
    }
  }

  // Second pass: parse each tab's data
  for (const t of tabsToRead) {
    const rows = getRowsByTab(t);
    if (rows.length <= 2) continue;

    if (t === SHEET_TABS.ATTENDANCE || t.startsWith('អវត្តមាន_')) {
      const monthObj = KHMER_MONTHS.find((m) => t === `អវត្តមាន_${m.label}`);
      const monthNum = monthObj ? monthObj.value : settings.month;
      const calYear = getCalendarYearForAcademicMonth(
        settings.academicYear,
        monthNum,
        settings.year
      );
      const daysCount = getMonthCalendarDays(calYear, monthNum).length;
      const attMap: AttendanceMap = {};

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[2] || String(row[0]).includes('ចំនួនសិស្ស')) break;
        const name = String(row[2]).trim();
        const stu = students[i - 2]?.name === name ? students[i - 2] : studentByName.get(name);
        if (!stu) continue;
        const stuAtt: Record<number, '' | 'ច្ប' | 'ឈ' | 'អច្ប'> = {};
        for (let d = 1; d <= daysCount; d++) {
          const val = String(row[3 + d] || '').trim();
          if (val === 'ច្ប' || val === 'ឈ' || val === 'អច្ប') stuAtt[d] = val;
        }
        attMap[stu.id] = stuAtt;
        const remarkCol = 8 + daysCount;
        if (row[remarkCol] && !remarks[stu.id]) {
          remarks[stu.id] = String(row[remarkCol]).trim();
        }
      }
      const mKey = getMonthKey(calYear, monthNum);
      attendanceByMonth[mKey] = attMap;
    } else if (t === SHEET_TABS.MONTHLY_SCORES || t.startsWith('ពិន្ទុ_')) {
      const monthObj = KHMER_MONTHS.find((m) => t === `ពិន្ទុ_${m.label}`);
      const monthNum = monthObj ? monthObj.value : settings.month;
      const calYear = getCalendarYearForAcademicMonth(
        settings.academicYear,
        monthNum,
        settings.year
      );
      const scoreMap: ScoreMap = {};
      const labelToSubjectKey = new Map<string, string>();
      ALL_MONTHLY_SUBJECTS.forEach((s) => labelToSubjectKey.set(s.label.trim(), s.key));
      getResolvedMonthlySubjects(settings).forEach((s) =>
        labelToSubjectKey.set(s.label.trim(), s.key)
      );

      const colToSubjectKey: { colIdx: number; subjectKey: string }[] = [];
      const row0 = rows[0] || [];
      const row1 = rows[1] || [];
      const maxHeaders = Math.max(row0.length, row1.length);
      for (let c = 3; c < maxHeaders; c++) {
        const topLabel = String(row0[c] || '').trim();
        const subLabel = String(row1[c] || '').trim();
        if (topLabel === 'លទ្ធផលប្រចាំខែ' || subLabel === 'ពិន្ទុសរុប') break;
        const matchedKey =
          labelToSubjectKey.get(subLabel) || labelToSubjectKey.get(topLabel);
        if (matchedKey) {
          colToSubjectKey.push({ colIdx: c, subjectKey: matchedKey });
        }
      }

      const fallbackHasThreeCompetenciesCols =
        String(rows[0]?.[24] || '').includes('សម្បទា') ||
        String(rows[1]?.[24] || '').includes('វិជ្ជា');
      const fallbackSubjectsToRead = fallbackHasThreeCompetenciesCols
        ? ALL_MONTHLY_SUBJECTS
        : ACADEMIC_MONTHLY_SUBJECTS;

      for (let i = 2; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;
        const name = String(row[1]).trim();
        const stu = students[i - 2]?.name === name ? students[i - 2] : studentByName.get(name);
        if (!stu) continue;
        const sMap: Record<string, number | undefined> = {};
        if (colToSubjectKey.length > 0) {
          for (const { colIdx, subjectKey } of colToSubjectKey) {
            const raw = row[colIdx];
            if (subjectKey === 'comp_knowledge') {
              const rawStr = String(raw ?? '').trim();
              if (rawStr === '80%' || rawStr === '80' || rawStr === '0.8') {
                sMap[subjectKey] = 80;
              }
            } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
              sMap[subjectKey] = Number(raw);
            }
          }
        } else {
          fallbackSubjectsToRead.forEach((sub, sIdx) => {
            const raw = row[3 + sIdx];
            if (sub.key === 'comp_knowledge') {
              const rawStr = String(raw ?? '').trim();
              if (rawStr === '80%' || rawStr === '80' || rawStr === '0.8') {
                sMap[sub.key] = 80;
              }
            } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
              sMap[sub.key] = Number(raw);
            }
          });
        }
        scoreMap[stu.id] = sMap;
      }
      monthlyScoresByMonth[getMonthKey(calYear, monthNum)] = scoreMap;
    } else if (t === SHEET_TABS.SEMESTER_RESULTS || t.startsWith('ឆមាសទី_')) {
      const termKey = t.includes('២') ? '2' : t.includes('១') ? '1' : String(settings.semester);
      const isThreeRow = isThreeRowSemesterHeader(rows);
      const dataStartIdx = isThreeRow ? 3 : 2;
      if (rows.length <= dataStartIdx) continue;

      const semMap: ScoreMap = {};
      const domMap: DomainGradeMap = {};
      const annScoreMap: ScoreMap = {};
      const annDomMap: DomainGradeMap = {};

      const labelToSemSubjectKey = new Map<string, string>();
      SEMESTER_EXAM_SUBJECTS.forEach((s) => labelToSemSubjectKey.set(s.label.trim(), s.key));
      getResolvedSemesterExamSubjects(settings).forEach((s) =>
        labelToSemSubjectKey.set(s.label.trim(), s.key)
      );
      SEMESTER_COMPETENCY_SUBJECTS.forEach((s) =>
        labelToSemSubjectKey.set(s.label.trim(), s.key)
      );

      const labelToCompKey = new Map<string, string>();
      SEMESTER_COMPETENCY_SUBJECTS.forEach((s) =>
        labelToCompKey.set(s.label.trim(), s.key)
      );

      const labelToDomainKey = new Map<string, string>();
      DOMAIN_GRADES.forEach((d) => labelToDomainKey.set(d.label.trim(), d.key));

      const semSubjectCols: { colIdx: number; subjectKey: string }[] = [];
      const domainCols: { colIdx: number; domainKey: string }[] = [];
      const annCompCols: { colIdx: number; subjectKey: string }[] = [];
      const annDomainCols: { colIdx: number; domainKey: string }[] = [];
      let remarkColIdx = -1;

      const row0 = rows[0] || [];
      const groupRow = (isThreeRow ? rows[1] : rows[0]) || [];
      const leafRow = (isThreeRow ? rows[2] : rows[1]) || [];
      const maxHeaders = Math.max(row0.length, groupRow.length, leafRow.length);

      let inResultsOrDomains = false;
      let inAnnualSection = false;
      let annualSubSection: 'none' | 'comp' | 'res' | 'dom' = 'none';

      for (let c = 3; c < maxHeaders; c++) {
        const superLabel = String(row0[c] || '').trim();
        const topLabel = String(groupRow[c] || '').trim();
        const subLabel = String(leafRow[c] || '').trim();

        if (superLabel === 'សេចក្តីផ្សេងៗ' || topLabel === 'សេចក្តីផ្សេងៗ' || subLabel === 'សេចក្តីផ្សេងៗ') {
          remarkColIdx = c;
          break;
        }

        if (superLabel === 'ប្រចាំឆ្នាំ') {
          inAnnualSection = true;
          annualSubSection = 'comp';
        }

        if (inAnnualSection) {
          if (topLabel === 'សម្បទាទាំង៣') annualSubSection = 'comp';
          else if (topLabel === 'លទ្ធផល' || subLabel === 'មធ្យមភាគ') annualSubSection = 'res';
          else if (topLabel === 'និទ្ទេសតាមផ្នែក') annualSubSection = 'dom';

          if (annualSubSection === 'comp') {
            const matchedComp = labelToCompKey.get(subLabel);
            if (matchedComp) {
              annCompCols.push({ colIdx: c, subjectKey: matchedComp });
            }
          } else if (annualSubSection === 'dom') {
            const matchedDom = labelToDomainKey.get(subLabel);
            if (matchedDom) {
              annDomainCols.push({ colIdx: c, domainKey: matchedDom });
            }
          }
          continue;
        }

        if (
          topLabel === 'លទ្ធផលប្រចាំឆមាស' ||
          topLabel === 'និទ្ទេសតាមផ្នែក' ||
          subLabel === 'ម. ប្រឡងឆមាស'
        ) {
          inResultsOrDomains = true;
        }

        if (!inResultsOrDomains) {
          const matchedKey =
            labelToSemSubjectKey.get(subLabel) || labelToSemSubjectKey.get(topLabel);
          if (matchedKey) {
            semSubjectCols.push({ colIdx: c, subjectKey: matchedKey });
          }
        } else {
          const matchedDom = labelToDomainKey.get(subLabel);
          if (matchedDom) {
            domainCols.push({ colIdx: c, domainKey: matchedDom });
          }
        }
      }

      const hasThreeCompetenciesCols =
        String(groupRow[16] || '').includes('សម្បទា') ||
        String(leafRow[16] || '').includes('វិជ្ជា');
      const domStartColIdx = hasThreeCompetenciesCols ? 24 : 21;

      for (let i = dataStartIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[1]) continue;
        const name = String(row[1]).trim();
        const stu =
          students[i - dataStartIdx]?.name === name
            ? students[i - dataStartIdx]
            : studentByName.get(name);
        if (!stu) continue;

        const sMap: Record<string, number | undefined> = {};
        if (semSubjectCols.length > 0) {
          for (const { colIdx, subjectKey } of semSubjectCols) {
            const raw = row[colIdx];
            if (subjectKey === 'comp_knowledge') {
              const rawStr = String(raw ?? '').trim();
              if (rawStr === '80%' || rawStr === '80' || rawStr === '0.8') {
                sMap[subjectKey] = 80;
              }
            } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
              sMap[subjectKey] = Number(raw);
            }
          }
        } else {
          SEMESTER_EXAM_SUBJECTS.forEach((sub, sIdx) => {
            const raw = row[3 + sIdx];
            if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
              sMap[sub.key] = Number(raw);
            }
          });
          if (hasThreeCompetenciesCols) {
            SEMESTER_COMPETENCY_SUBJECTS.forEach((sub, cIdx) => {
              const raw = row[16 + cIdx];
              if (sub.key === 'comp_knowledge') {
                const rawStr = String(raw ?? '').trim();
                if (rawStr === '80%' || rawStr === '80' || rawStr === '0.8') {
                  sMap[sub.key] = 80;
                }
              } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
                sMap[sub.key] = Number(raw);
              }
            });
          }
        }
        semMap[stu.id] = sMap;

        const dMap: Record<string, string> = {};
        if (domainCols.length > 0) {
          for (const { colIdx, domainKey } of domainCols) {
            const raw = row[colIdx];
            if (raw !== undefined && String(raw).trim() !== '') {
              dMap[domainKey] = String(raw).trim();
            }
          }
        } else {
          DOMAIN_GRADES.forEach((dom, dIdx) => {
            const raw = row[domStartColIdx + dIdx];
            if (raw !== undefined && String(raw).trim() !== '') {
              dMap[dom.key] = String(raw).trim();
            }
          });
        }
        domMap[stu.id] = dMap;

        if (isThreeRow && (annCompCols.length > 0 || annDomainCols.length > 0)) {
          const aScores: Record<string, number | undefined> = {};
          for (const { colIdx, subjectKey } of annCompCols) {
            const raw = row[colIdx];
            if (subjectKey === 'comp_knowledge') {
              const rawStr = String(raw ?? '').trim();
              if (rawStr === '80%' || rawStr === '80' || rawStr === '0.8') {
                aScores[subjectKey] = 80;
              }
            } else if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
              aScores[subjectKey] = Number(raw);
            }
          }
          annScoreMap[stu.id] = aScores;

          const aDoms: Record<string, string> = {};
          for (const { colIdx, domainKey } of annDomainCols) {
            const raw = row[colIdx];
            if (raw !== undefined && String(raw).trim() !== '') {
              aDoms[domainKey] = String(raw).trim();
            }
          }
          annDomMap[stu.id] = aDoms;
        }

        if (remarkColIdx >= 0 && row[remarkColIdx] && !remarks[stu.id]) {
          remarks[stu.id] = String(row[remarkColIdx]).trim();
        }
      }
      semesterScoresByTerm[termKey] = semMap;
      domainGradesByTerm[termKey] = domMap;
      if (isThreeRow && (annCompCols.length > 0 || annDomainCols.length > 0)) {
        semesterScoresByTerm['annual'] = annScoreMap;
        domainGradesByTerm['annual'] = annDomMap;
      }
    }
  }

  return {
    info: { spreadsheetId: meta.spreadsheetId, title: meta.title, url: meta.url },
    students,
    attendanceByMonth,
    monthlyScoresByMonth,
    semesterScoresByTerm,
    domainGradesByTerm,
    remarks,
  };
}

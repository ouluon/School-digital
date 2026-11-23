import {
  ACADEMIC_MONTHLY_SUBJECTS,
  AttendanceMap,
  AttendanceMark,
  SEMESTER_EXAM_SUBJECTS,
  ScoreMap,
  Student,
} from '../types/gradebook';

const KHMER_WEEKDAYS = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'] as const;

export interface CalendarDay {
  day: number;
  weekdayIndex: number; // 0 = Sunday
  khmerDay: string;
  isSunday: boolean;
}

export function parseAcademicYear(
  academicYear: string,
  fallbackYear: number
): { startYear: number; endYear: number } {
  const match = academicYear.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
  if (match) {
    return { startYear: Number(match[1]), endYear: Number(match[2]) };
  }
  return { startYear: fallbackYear, endYear: fallbackYear + 1 };
}

export function getCalendarYearForAcademicMonth(
  academicYear: string,
  month: number,
  fallbackYear: number
): number {
  const { startYear, endYear } = parseAcademicYear(academicYear, fallbackYear);
  // Cambodian school year (10 months): Nov (11) & Dec (12) belong to startYear; Jan (1)..Oct (10) belong to endYear
  return month >= 11 ? startYear : endYear;
}

export function getAcademicYearOptions(
  currentAcademicYear: string,
  fallbackYear: number
): string[] {
  const { startYear } = parseAcademicYear(currentAcademicYear, fallbackYear);
  const nowYear = new Date().getFullYear();
  const minStart = Math.min(2024, nowYear - 2, startYear);
  const maxStart = Math.max(nowYear + 2, startYear + 1);
  const options: string[] = [];
  for (let y = minStart; y <= maxStart; y++) {
    options.push(`${y}-${y + 1}`);
  }
  if (currentAcademicYear && !options.includes(currentAcademicYear)) {
    options.unshift(currentAcademicYear);
  }
  return options;
}

export function getYearOptions(selectedYear: number): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = Math.min(2025, currentYear - 1, selectedYear);
  const endYear = Math.max(currentYear + 1, selectedYear + 1);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }
  return years;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthCalendarDays(year: number, month: number): CalendarDay[] {
  const count = getDaysInMonth(year, month);
  const days: CalendarDay[] = [];
  for (let d = 1; d <= count; d++) {
    const weekdayIndex = new Date(year, month - 1, d).getDay();
    days.push({
      day: d,
      weekdayIndex,
      khmerDay: KHMER_WEEKDAYS[weekdayIndex],
      isSunday: weekdayIndex === 0,
    });
  }
  return days;
}

export function computeLetterGrade(average: number, maxScore: 10 | 100): string {
  const ratio = maxScore === 100 ? average / 10 : average;
  if (ratio >= 9) return 'A';
  if (ratio >= 8) return 'B';
  if (ratio >= 7) return 'C';
  if (ratio >= 6) return 'D';
  if (ratio >= 5) return 'E';
  return 'F';
}

export function computeStudentAttendanceSummary(
  studentId: string,
  attendance: AttendanceMap,
  daysCount: number
): { excused: number; unexcused: number; totalAbsent: number } {
  const stuAtt = attendance[studentId] || {};
  let excused = 0;
  let unexcused = 0;
  for (let d = 1; d <= daysCount; d++) {
    if (stuAtt[d] === 'ច្ប' || stuAtt[d] === 'ឈ') excused++;
    else if (stuAtt[d] === 'អច្ប') unexcused++;
  }
  return { excused, unexcused, totalAbsent: excused + unexcused };
}

export function computeDailyAttendanceSummary(
  students: Student[],
  attendance: AttendanceMap,
  day: number
): { present: number; excused: number; unexcused: number } {
  let excused = 0;
  let unexcused = 0;
  for (const stu of students) {
    const mark = attendance[stu.id]?.[day] || '';
    if (mark === 'ច្ប' || mark === 'ឈ') excused++;
    else if (mark === 'អច្ប') unexcused++;
  }
  return {
    present: Math.max(0, students.length - excused - unexcused),
    excused,
    unexcused,
  };
}

export interface MonthlyResult {
  total: number;
  academicAverage: number;
  average: number;
  rank: number;
  grade: string;
  enteredCount: number;
}

export function computeMonthlyResults(
  students: Student[],
  monthlyScores: ScoreMap,
  maxScore: 10 | 100
): Record<string, MonthlyResult> {
  const scale = maxScore === 100 ? 10 : 1;

  const raw = students.map((stu) => {
    const scores = monthlyScores[stu.id] || {};
    let total = 0;
    let enteredCount = 0;
    for (const sub of ACADEMIC_MONTHLY_SUBJECTS) {
      const val = scores[sub.key];
      if (typeof val === 'number' && !Number.isNaN(val)) {
        total += val;
        enteredCount++;
      }
    }
    const academicAverage = enteredCount > 0 ? total / enteredCount : 0;

    const compKnowledge = scores['comp_knowledge'];
    const compSkillsVal = scores['comp_skills'];
    const compAttitudeVal = scores['comp_attitude'];

    const compSkills =
      typeof compSkillsVal === 'number' && !Number.isNaN(compSkillsVal)
        ? compSkillsVal * scale
        : 0;
    const compAttitude =
      typeof compAttitudeVal === 'number' && !Number.isNaN(compAttitudeVal)
        ? compAttitudeVal * scale
        : 0;

    const rawAverage =
      compKnowledge === 80
        ? academicAverage * 0.8 + compSkills + compAttitude
        : academicAverage + compSkills + compAttitude;
    const average = Math.min(maxScore, Math.max(0, rawAverage));

    return { id: stu.id, total, academicAverage, average, enteredCount };
  });

  // Standard competition ranking (1, 1, 3...)
  const sortedAverages = [...raw].map((r) => r.average).sort((a, b) => b - a);
  const results: Record<string, MonthlyResult> = {};

  for (const item of raw) {
    const rank = sortedAverages.findIndex((avg) => Math.abs(avg - item.average) < 1e-9) + 1;
    results[item.id] = {
      total: item.total,
      academicAverage: item.academicAverage,
      average: item.average,
      rank: rank > 0 ? rank : 1,
      grade: computeLetterGrade(item.average, maxScore),
      enteredCount: item.enteredCount,
    };
  }
  return results;
}

function mapHasAnyScores(map?: ScoreMap): boolean {
  if (!map) return false;
  return Object.values(map).some((stuScores) =>
    Object.values(stuScores).some((v) => typeof v === 'number' && !Number.isNaN(v))
  );
}

export function resolveMonthScoreMap(
  monthlyScoresByMonth: Record<string, ScoreMap>,
  academicYear: string,
  fallbackYear: number,
  month: number
): ScoreMap | undefined {
  const targetYear = getCalendarYearForAcademicMonth(academicYear, month, fallbackYear);
  return monthlyScoresByMonth[`${targetYear}-${month}`];
}

export function computeCombinedMonthlyResults(
  students: Student[],
  monthlyScoresByMonth: Record<string, ScoreMap>,
  academicYear: string,
  fallbackYear: number,
  selectedMonths: number[],
  maxScore: 10 | 100
): { results: Record<string, MonthlyResult>; activeMonthsCount: number; usedMonths: number[] } {
  const usedMonths: number[] = [];
  const perMonthResults: Record<string, MonthlyResult>[] = [];

  for (const m of selectedMonths) {
    const scoreMap = resolveMonthScoreMap(monthlyScoresByMonth, academicYear, fallbackYear, m);
    if (mapHasAnyScores(scoreMap)) {
      usedMonths.push(m);
      perMonthResults.push(computeMonthlyResults(students, scoreMap || {}, maxScore));
    }
  }

  if (perMonthResults.length === 0) {
    return {
      results: computeMonthlyResults(students, {}, maxScore),
      activeMonthsCount: 0,
      usedMonths: [],
    };
  }

  const raw = students.map((stu) => {
    let sumAvg = 0;
    let sumAcademicAvg = 0;
    let sumTotal = 0;
    let countWithScores = 0;
    let totalEntered = 0;
    for (const mRes of perMonthResults) {
      const r = mRes[stu.id];
      if (r && (r.enteredCount > 0 || r.average > 0)) {
        sumAvg += r.average;
        sumAcademicAvg += r.academicAverage;
        sumTotal += r.total;
        totalEntered += r.enteredCount;
        countWithScores++;
      }
    }
    const average = countWithScores > 0 ? sumAvg / countWithScores : 0;
    const academicAverage = countWithScores > 0 ? sumAcademicAvg / countWithScores : 0;
    return { id: stu.id, total: sumTotal, academicAverage, average, enteredCount: totalEntered };
  });

  const sortedAverages = [...raw].map((r) => r.average).sort((a, b) => b - a);
  const combined: Record<string, MonthlyResult> = {};
  for (const item of raw) {
    const rank =
      sortedAverages.findIndex((avg) => Math.abs(avg - item.average) < 1e-9) + 1;
    combined[item.id] = {
      total: item.total,
      academicAverage: item.academicAverage,
      average: item.average,
      rank: rank > 0 ? rank : 1,
      grade: computeLetterGrade(item.average, maxScore),
      enteredCount: item.enteredCount,
    };
  }

  return {
    results: combined,
    activeMonthsCount: usedMonths.length,
    usedMonths,
  };
}

export interface SemesterResult {
  examAverage: number;
  monthlyAverage: number;
  semesterAverage: number;
  rank: number;
  grade: string;
  enteredCount: number;
}

export function computeSemesterResults(
  students: Student[],
  semesterScores: ScoreMap,
  monthlyResults: Record<string, MonthlyResult>,
  maxScore: 10 | 100
): Record<string, SemesterResult> {
  const scale = maxScore === 100 ? 10 : 1;

  const raw = students.map((stu) => {
    const scores = semesterScores[stu.id] || {};
    let sum = 0;
    let enteredCount = 0;
    for (const sub of SEMESTER_EXAM_SUBJECTS) {
      const val = scores[sub.key];
      if (typeof val === 'number' && !Number.isNaN(val)) {
        sum += val;
        enteredCount++;
      }
    }
    const rawExamAverage = enteredCount > 0 ? sum / enteredCount : 0;

    const compKnowledge = scores['comp_knowledge'];
    const compSkillsVal = scores['comp_skills'];
    const compAttitudeVal = scores['comp_attitude'];

    const compSkills =
      typeof compSkillsVal === 'number' && !Number.isNaN(compSkillsVal)
        ? compSkillsVal * scale
        : 0;
    const compAttitude =
      typeof compAttitudeVal === 'number' && !Number.isNaN(compAttitudeVal)
        ? compAttitudeVal * scale
        : 0;

    const rawWithComp =
      compKnowledge === 80
        ? rawExamAverage * 0.8 + compSkills + compAttitude
        : rawExamAverage + compSkills + compAttitude;
    const examAverage = Math.min(maxScore, Math.max(0, rawWithComp));

    const monthlyAverage = monthlyResults[stu.id]?.average ?? 0;
    let semesterAverage = 0;
    if (examAverage > 0 && monthlyAverage > 0) {
      semesterAverage = (examAverage + monthlyAverage) / 2;
    } else if (examAverage > 0) {
      semesterAverage = examAverage;
    } else if (monthlyAverage > 0) {
      semesterAverage = monthlyAverage;
    }
    return { id: stu.id, examAverage, monthlyAverage, semesterAverage, enteredCount };
  });

  const sorted = [...raw].map((r) => r.semesterAverage).sort((a, b) => b - a);
  const results: Record<string, SemesterResult> = {};
  for (const item of raw) {
    const rank = sorted.findIndex((avg) => Math.abs(avg - item.semesterAverage) < 1e-9) + 1;
    results[item.id] = {
      examAverage: item.examAverage,
      monthlyAverage: item.monthlyAverage,
      semesterAverage: item.semesterAverage,
      rank: rank > 0 ? rank : 1,
      grade: computeLetterGrade(item.semesterAverage, maxScore),
      enteredCount: item.enteredCount,
    };
  }
  return results;
}

export interface AnnualResult {
  semester1Average: number;
  semester2Average: number;
  baseAverage: number;
  annualAverage: number;
  rank: number;
  grade: string;
}

export function computeAnnualResults(
  students: Student[],
  semester1Results: Record<string, SemesterResult>,
  semester2Results: Record<string, SemesterResult>,
  annualScores: ScoreMap,
  maxScore: 10 | 100
): Record<string, AnnualResult> {
  const scale = maxScore === 100 ? 10 : 1;

  const raw = students.map((stu) => {
    const sem1Avg = semester1Results[stu.id]?.semesterAverage ?? 0;
    const sem2Avg = semester2Results[stu.id]?.semesterAverage ?? 0;

    let baseAverage = 0;
    if (sem1Avg > 0 && sem2Avg > 0) {
      baseAverage = (sem1Avg + sem2Avg) / 2;
    } else if (sem1Avg > 0) {
      baseAverage = sem1Avg;
    } else if (sem2Avg > 0) {
      baseAverage = sem2Avg;
    }

    const scores = annualScores[stu.id] || {};
    const compKnowledge = scores['comp_knowledge'];
    const compSkillsVal = scores['comp_skills'];
    const compAttitudeVal = scores['comp_attitude'];

    const compSkills =
      typeof compSkillsVal === 'number' && !Number.isNaN(compSkillsVal)
        ? compSkillsVal * scale
        : 0;
    const compAttitude =
      typeof compAttitudeVal === 'number' && !Number.isNaN(compAttitudeVal)
        ? compAttitudeVal * scale
        : 0;

    const rawWithComp =
      compKnowledge === 80
        ? baseAverage * 0.8 + compSkills + compAttitude
        : baseAverage + compSkills + compAttitude;
    const annualAverage = Math.min(maxScore, Math.max(0, rawWithComp));

    return {
      id: stu.id,
      semester1Average: sem1Avg,
      semester2Average: sem2Avg,
      baseAverage,
      annualAverage,
    };
  });

  const sorted = [...raw].map((r) => r.annualAverage).sort((a, b) => b - a);
  const results: Record<string, AnnualResult> = {};
  for (const item of raw) {
    const rank =
      sorted.findIndex((avg) => Math.abs(avg - item.annualAverage) < 1e-9) + 1;
    results[item.id] = {
      semester1Average: item.semester1Average,
      semester2Average: item.semester2Average,
      baseAverage: item.baseAverage,
      annualAverage: item.annualAverage,
      rank: rank > 0 ? rank : 1,
      grade: computeLetterGrade(item.annualAverage, maxScore),
    };
  }
  return results;
}

export function colIndexToLetter(index: number): string {
  let n = index;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function formatStudentLeaveReasons(
  studentAtt?: Record<number, AttendanceMark>,
  studentReasons?: Record<number, string>
): { day: number; reason: string }[] {
  if (!studentAtt || !studentReasons) return [];
  const items: { day: number; reason: string }[] = [];
  for (const [dayKey, rawReason] of Object.entries(studentReasons)) {
    const day = Number(dayKey);
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';
    if (day >= 1 && day <= 31 && studentAtt[day] === 'ច្ប' && reason) {
      items.push({ day, reason });
    }
  }
  return items.sort((a, b) => a.day - b.day);
}

export function buildAttendanceRemarkCell(
  studentRemark: string | undefined,
  studentAtt?: Record<number, AttendanceMark>,
  studentReasons?: Record<number, string>
): string {
  const parts: string[] = [];
  const cleanRemark = (studentRemark || '').trim();
  if (cleanRemark) parts.push(cleanRemark);

  const leaveItems = formatStudentLeaveReasons(studentAtt, studentReasons);
  for (const item of leaveItems) {
    parts.push(`ច្ប(ទី${item.day}): ${item.reason}`);
  }
  return parts.join(' | ');
}

export function parseAttendanceRemarkCell(rawCell: string): {
  cleanRemark: string;
  reasonsByDay: Record<number, string>;
} {
  const reasonsByDay: Record<number, string> = {};
  const remarkParts: string[] = [];
  const segments = String(rawCell || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    const match = seg.match(/^ច្ប\(ទី(\d{1,2})\)\s*:\s*(.+)$/);
    if (match) {
      const day = Number(match[1]);
      const reason = match[2].trim();
      if (day >= 1 && day <= 31 && reason) {
        reasonsByDay[day] = reason;
        continue;
      }
    }
    remarkParts.push(seg);
  }

  return {
    cleanRemark: remarkParts.join(' | '),
    reasonsByDay,
  };
}


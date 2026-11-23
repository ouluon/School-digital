import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { Student } from '../types/gradebook';

export type LetterGradeKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

const GRADE_KEYS: LetterGradeKey[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface ScoreSummaryEntry {
  id: string;
  label: string;
  accent?: 'default' | 'blue';
  totalStudents: number;
  totalFemale: number;
  scoredCount: number;
  scoredFemale: number;
  passedCount: number;
  passedFemale: number;
  failedCount: number;
  failedFemale: number;
  classAverage: number;
  highestAverage: number;
  topStudentNames: string[];
  grades: Record<LetterGradeKey, { total: number; female: number }>;
}

export interface StudentScoreMetric {
  average: number;
  grade: string;
  hasScore: boolean;
}

export function buildScoreSummaryEntry(
  id: string,
  label: string,
  students: Student[],
  getMetric: (student: Student) => StudentScoreMetric,
  accent: 'default' | 'blue' = 'default'
): ScoreSummaryEntry {
  const grades: Record<LetterGradeKey, { total: number; female: number }> = {
    A: { total: 0, female: 0 },
    B: { total: 0, female: 0 },
    C: { total: 0, female: 0 },
    D: { total: 0, female: 0 },
    E: { total: 0, female: 0 },
    F: { total: 0, female: 0 },
  };

  let totalFemale = 0;
  let scoredCount = 0;
  let scoredFemale = 0;
  let passedCount = 0;
  let passedFemale = 0;
  let failedCount = 0;
  let failedFemale = 0;
  let sumAverage = 0;
  let highestAverage = 0;
  let topStudentNames: string[] = [];

  for (const stu of students) {
    const isFemale = stu.gender === 'ស្រី';
    if (isFemale) totalFemale++;

    const metric = getMetric(stu);
    if (!metric.hasScore) continue;

    scoredCount++;
    if (isFemale) scoredFemale++;

    const avg = Number.isFinite(metric.average) ? metric.average : 0;
    sumAverage += avg;

    const normalizedGrade = (
      GRADE_KEYS.includes(metric.grade as LetterGradeKey) ? metric.grade : 'F'
    ) as LetterGradeKey;

    grades[normalizedGrade].total++;
    if (isFemale) grades[normalizedGrade].female++;

    if (normalizedGrade === 'F') {
      failedCount++;
      if (isFemale) failedFemale++;
    } else {
      passedCount++;
      if (isFemale) passedFemale++;
    }

    if (scoredCount === 1 || avg > highestAverage + 1e-9) {
      highestAverage = avg;
      topStudentNames = [stu.name];
    } else if (Math.abs(avg - highestAverage) <= 1e-9) {
      topStudentNames.push(stu.name);
    }
  }

  return {
    id,
    label,
    accent,
    totalStudents: students.length,
    totalFemale,
    scoredCount,
    scoredFemale,
    passedCount,
    passedFemale,
    failedCount,
    failedFemale,
    classAverage: scoredCount > 0 ? sumAverage / scoredCount : 0,
    highestAverage,
    topStudentNames,
    grades,
  };
}

interface ScoreSummaryTableProps {
  title?: string;
  subtitle?: string;
  maxScore: 10 | 100;
  entries: ScoreSummaryEntry[];
}

const GRADE_HEADER_COLORS: Record<LetterGradeKey, string> = {
  A: 'text-emerald-700 dark:text-emerald-400',
  B: 'text-blue-700 dark:text-blue-400',
  C: 'text-cyan-700 dark:text-cyan-400',
  D: 'text-amber-700 dark:text-amber-400',
  E: 'text-orange-700 dark:text-orange-400',
  F: 'text-rose-700 dark:text-rose-400',
};

export const ScoreSummaryTable: React.FC<ScoreSummaryTableProps> = ({
  title = 'តារាងសង្ខេបពិន្ទុសិស្ស',
  subtitle,
  maxScore,
  entries,
}) => {
  const [expanded, setExpanded] = useState(true);
  const showPeriodCol = entries.length > 1;
  const primary = entries[0];
  const passRate =
    primary && primary.scoredCount > 0
      ? ((primary.passedCount / primary.scoredCount) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="surface-card rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/70 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          </span>
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          {subtitle && (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200/70 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200">
              {subtitle}
            </span>
          )}
          <span className="hidden sm:inline-block text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
            (ពិន្ទុពេញ {maxScore})
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {primary && (
            <span className="text-[11px] font-mono-num font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/70 px-2 py-0.5 rounded-md">
              ជាប់ {primary.passedCount}/{primary.scoredCount} ({passRate}%)
            </span>
          )}
          <span className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 dark:text-slate-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-xs text-slate-800 dark:text-slate-100">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  {showPeriodCol && (
                    <th className="px-2.5 py-2 text-left whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80">
                      ប្រភេទ
                    </th>
                  )}
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80">
                    សរុប (ស្រី)
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80">
                    មានពិន្ទុ
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-emerald-700 dark:text-emerald-400">
                    ជាប់ (ស្រី)
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-rose-700 dark:text-rose-400">
                    ធ្លាក់ (ស្រី)
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-blue-700 dark:text-blue-400">
                    មធ្យមថ្នាក់
                  </th>
                  <th className="px-2 py-2 text-center whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-amber-700 dark:text-amber-400">
                    ខ្ពស់បំផុត
                  </th>
                  {GRADE_KEYS.map((g) => (
                    <th
                      key={g}
                      className={`px-2 py-2 text-center whitespace-nowrap border-r last:border-r-0 border-slate-200/80 dark:border-slate-700/80 font-bold ${GRADE_HEADER_COLORS[g]}`}
                    >
                      និទ្ទេស {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry) => {
                  const entryPassPct =
                    entry.scoredCount > 0
                      ? ((entry.passedCount / entry.scoredCount) * 100).toFixed(0)
                      : '0';
                  return (
                    <tr
                      key={entry.id}
                      className={
                        entry.accent === 'blue'
                          ? 'bg-blue-50/35 dark:bg-blue-950/25'
                          : 'bg-white dark:bg-slate-900/40'
                      }
                    >
                      {showPeriodCol && (
                        <td
                          className={`px-2.5 py-2 font-bold whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 ${
                            entry.accent === 'blue'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {entry.label}
                        </td>
                      )}
                      <td className="px-2 py-2 text-center font-mono-num whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80">
                        <span className="font-bold">{entry.totalStudents}</span>{' '}
                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                          ({entry.totalFemale})
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono-num font-semibold whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80">
                        {entry.scoredCount}
                      </td>
                      <td className="px-2 py-2 text-center font-mono-num whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-emerald-700 dark:text-emerald-400">
                        <span className="font-bold">{entry.passedCount}</span>{' '}
                        <span className="text-[11px] opacity-85">
                          ({entry.passedFemale}) · {entryPassPct}%
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono-num whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-rose-700 dark:text-rose-400">
                        <span className="font-bold">{entry.failedCount}</span>{' '}
                        <span className="text-[11px] opacity-85">({entry.failedFemale})</span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono-num font-bold whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-blue-700 dark:text-blue-400">
                        {entry.classAverage.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center font-mono-num font-bold whitespace-nowrap border-r border-slate-200/80 dark:border-slate-700/80 text-amber-700 dark:text-amber-400">
                        {entry.highestAverage.toFixed(2)}
                      </td>
                      {GRADE_KEYS.map((g) => {
                        const cell = entry.grades[g];
                        return (
                          <td
                            key={g}
                            className="px-2 py-2 text-center font-mono-num whitespace-nowrap border-r last:border-r-0 border-slate-200/80 dark:border-slate-700/80"
                          >
                            <span
                              className={`font-bold ${
                                cell.total > 0
                                  ? GRADE_HEADER_COLORS[g]
                                  : 'text-slate-400 dark:text-slate-600 font-normal'
                              }`}
                            >
                              {cell.total}
                            </span>
                            {cell.female > 0 && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-0.5">
                                ({cell.female})
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {entries.map((entry) => {
                const topText =
                  entry.scoredCount === 0
                    ? 'មិនទាន់មានទិន្នន័យពិន្ទុ'
                    : entry.topStudentNames.length > 2
                    ? `${entry.topStudentNames.slice(0, 2).join(', ')} (+${entry.topStudentNames.length - 2} នាក់)`
                    : entry.topStudentNames.join(', ');
                return (
                  <div key={`top_${entry.id}`} className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      {showPeriodCol ? `${entry.label} ` : ''}លេខ ១៖{' '}
                      <strong className="text-slate-900 dark:text-slate-100">{topText}</strong>
                      {entry.scoredCount > 0 && (
                        <span className="font-mono-num font-semibold text-amber-700 dark:text-amber-400 ml-1">
                          ({entry.highestAverage.toFixed(2)})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              តួលេខក្នុងវង់ក្រចក ( ) គឺចំនួនសិស្សស្រី
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

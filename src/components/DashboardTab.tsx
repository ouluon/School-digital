import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AreaChart,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  GraduationCap,
  ListChecks,
  PieChart,
  TrendingUp,
  User as UserIcon,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  AttendanceByMonth,
  ClassSettings,
  KHMER_MONTHS,
  MonthlyScoresByMonth,
  Student,
  getMonthKey,
  getMonthlyScoresMonthYear,
  getResolvedMonthlySubjectGroups,
} from '../types/gradebook';
import { UserProfileData } from '../services/userProfile';
import {
  computeDailyAttendanceSummary,
  computeMonthlyResults,
} from '../utils/calculations';
import { toKhmerDigits } from '../utils/khmerCalendar';
import { UserAvatar } from './UserProfileMenu';
import angkorWatBanner from '../assets/images/angkor_wat_banner_1795683560244.jpg';

type NavTabTarget = 'attendance' | 'monthly' | 'semester' | 'roster';
type DashboardChartType = 'line' | 'area' | 'bar' | 'donut';
type ProgressMetricType = 'subjects' | 'monthly' | 'grades';

interface DashboardTabProps {
  user: User | null;
  userProfile: UserProfileData | null;
  settings: ClassSettings;
  students: Student[];
  attendanceByMonth: AttendanceByMonth;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  onNavigateTab: (tab: NavTabTarget) => void;
  onEditProfile: () => void;
  onSignIn: () => void;
}

interface DashboardChartPrefs {
  attendanceChartType: DashboardChartType;
  progressChartType: DashboardChartType;
  progressMetric: ProgressMetricType;
}

const DEFAULT_CHART_PREFS: DashboardChartPrefs = {
  attendanceChartType: 'line',
  progressChartType: 'bar',
  progressMetric: 'subjects',
};

const CHART_TYPE_OPTIONS: Array<{
  key: DashboardChartType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'line', label: 'បន្ទាត់', Icon: TrendingUp },
  { key: 'area', label: 'ផ្ទៃ', Icon: AreaChart },
  { key: 'bar', label: 'សសរ', Icon: BarChart3 },
  { key: 'donut', label: 'រង្វង់', Icon: PieChart },
];

const PROGRESS_METRIC_OPTIONS: Array<{
  key: ProgressMetricType;
  label: string;
}> = [
  { key: 'subjects', label: 'តាមមុខវិជ្ជា' },
  { key: 'monthly', label: 'តាមខែ' },
  { key: 'grades', label: 'និទ្ទេស A–F' },
];

const KHMER_WEEKDAYS_SHORT = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស'] as const;

const SUBJECT_SHORT_LABELS: Record<string, string> = {
  khmer: 'ខ្មែរ',
  math: 'គណិត',
  science: 'វិទ្យា.',
  social: 'សង្គម',
  health: 'សុខភាព',
  life_skill: 'បំណិន',
  foreign_lang: 'បរទេស',
};

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#2563eb',
  C: '#0ea5e9',
  D: '#f59e0b',
  E: '#f97316',
  F: '#ef4444',
};

const SUBJECT_PALETTE = [
  '#2563eb',
  '#0ea5e9',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
];

function getChartPrefsStorageKey(uid?: string | null): string {
  return `khmer_classbook_dashboard_charts_v1_${uid || 'guest'}`;
}

function loadChartPrefs(uid?: string | null): DashboardChartPrefs {
  if (typeof window === 'undefined') return DEFAULT_CHART_PREFS;
  try {
    const raw = window.localStorage.getItem(getChartPrefsStorageKey(uid));
    if (!raw) return DEFAULT_CHART_PREFS;
    const parsed = JSON.parse(raw) as Partial<DashboardChartPrefs>;
    const validChartTypes: DashboardChartType[] = ['line', 'area', 'bar', 'donut'];
    const validMetrics: ProgressMetricType[] = ['subjects', 'monthly', 'grades'];
    return {
      attendanceChartType: validChartTypes.includes(
        parsed.attendanceChartType as DashboardChartType
      )
        ? (parsed.attendanceChartType as DashboardChartType)
        : DEFAULT_CHART_PREFS.attendanceChartType,
      progressChartType: validChartTypes.includes(
        parsed.progressChartType as DashboardChartType
      )
        ? (parsed.progressChartType as DashboardChartType)
        : DEFAULT_CHART_PREFS.progressChartType,
      progressMetric: validMetrics.includes(
        parsed.progressMetric as ProgressMetricType
      )
        ? (parsed.progressMetric as ProgressMetricType)
        : DEFAULT_CHART_PREFS.progressMetric,
    };
  } catch {
    return DEFAULT_CHART_PREFS;
  }
}

function getKhmerTimeGreeting(hour: number): string {
  if (hour >= 4 && hour < 12) return 'អរុណសួស្តី';
  if (hour >= 12 && hour < 17) return 'ទិវាសួស្តី';
  return 'សាយ័ន្តសួស្តី';
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getKhmerMonthLabel(monthNum: number): string {
  return (
    KHMER_MONTHS.find((m) => m.value === monthNum)?.label || String(monthNum)
  );
}

interface ProgressDatum {
  id: string;
  shortLabel: string;
  fullLabel: string;
  value: number;
  displayValue: string;
  subText: string;
  color: string;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  user,
  userProfile,
  settings,
  students,
  attendanceByMonth,
  monthlyScoresByMonth,
  onNavigateTab,
  onEditProfile,
  onSignIn,
}) => {
  const quickScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [chartPrefs, setChartPrefs] = useState<DashboardChartPrefs>(() =>
    loadChartPrefs(user?.uid)
  );
  const [hoveredAttIdx, setHoveredAttIdx] = useState<number | null>(null);
  const [hoveredProgIdx, setHoveredProgIdx] = useState<number | null>(null);
  const [selectedProgressMonthKey, setSelectedProgressMonthKey] =
    useState<string>('');

  useEffect(() => {
    setChartPrefs(loadChartPrefs(user?.uid));
  }, [user?.uid]);

  const updateChartPrefs = useCallback(
    (patch: Partial<DashboardChartPrefs>) => {
      setChartPrefs((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(
            getChartPrefsStorageKey(user?.uid),
            JSON.stringify(next)
          );
        } catch {
          // ignore storage quota failures
        }
        return next;
      });
    },
    [user?.uid]
  );

  const now = useMemo(() => new Date(), []);
  const greeting = getKhmerTimeGreeting(now.getHours());
  const todayIsoDate = formatLocalIsoDate(now);

  const teacherDisplayName =
    userProfile?.displayName?.trim() ||
    settings.teacherName?.trim() ||
    user?.displayName?.trim() ||
    (user ? 'គណនីគ្រូបន្ទុកថ្នាក់' : 'សូមស្វាគមន៍');

  const schoolDisplayName = settings.schoolName?.trim() || 'សាលាបឋមសិក្សា';
  const classDisplayName = settings.className?.trim() || 'មិនទាន់កំណត់ថ្នាក់';

  const femaleCount = useMemo(
    () => students.filter((s) => s.gender === 'ស្រី').length,
    [students]
  );

  const todaySummary = useMemo(() => {
    const monthKey = getMonthKey(now.getFullYear(), now.getMonth() + 1);
    const todayAttendanceMap = attendanceByMonth[monthKey] || {};
    return computeDailyAttendanceSummary(
      students,
      todayAttendanceMap,
      now.getDate()
    );
  }, [attendanceByMonth, now, students]);

  const attendanceRate = useMemo(() => {
    if (students.length === 0) return 0;
    return (todaySummary.present / students.length) * 100;
  }, [students.length, todaySummary.present]);

  const updateScrollEdges = useCallback(() => {
    const el = quickScrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(maxScroll > 4 && el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = quickScrollerRef.current;
    if (!el) return;
    updateScrollEdges();
    const onScroll = () => updateScrollEdges();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateScrollEdges());
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [updateScrollEdges]);

  const scrollQuickAccess = (dir: 'left' | 'right') => {
    const el = quickScrollerRef.current;
    if (!el) return;
    const step = Math.max(160, Math.round(el.clientWidth * 0.65));
    el.scrollBy({
      left: dir === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

  // 7-day Attendance History
  const attendanceTrendDays = useMemo(() => {
    const days: Array<{
      dateStr: string;
      shortDay: string;
      dayNum: number;
      rate: number;
      present: number;
      excused: number;
      unexcused: number;
    }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      const mk = getMonthKey(d.getFullYear(), d.getMonth() + 1);
      const map = attendanceByMonth[mk] || {};
      const summary = computeDailyAttendanceSummary(students, map, d.getDate());
      const rate =
        students.length > 0 ? (summary.present / students.length) * 100 : 0;
      days.push({
        dateStr: formatLocalIsoDate(d),
        shortDay: KHMER_WEEKDAYS_SHORT[d.getDay()],
        dayNum: d.getDate(),
        rate,
        present: summary.present,
        excused: summary.excused,
        unexcused: summary.unexcused,
      });
    }
    return days;
  }, [attendanceByMonth, now, students]);

  const trendRates = useMemo(
    () => attendanceTrendDays.map((d) => d.rate),
    [attendanceTrendDays]
  );

  const yesterdayRate = trendRates[trendRates.length - 2] ?? 0;
  const attendanceDelta = attendanceRate - yesterdayRate;
  const formattedDelta = Number.isInteger(
    Number(Math.abs(attendanceDelta).toFixed(1))
  )
    ? Math.abs(attendanceDelta).toFixed(0)
    : Math.abs(attendanceDelta).toFixed(1);

  const deltaArrow =
    students.length === 0 || Math.abs(attendanceDelta) < 0.05
      ? ''
      : attendanceDelta > 0
      ? '↑ '
      : '↓ ';

  const sparkGeometry = useMemo(() => {
    const width = 320;
    const height = 72;
    const padX = 10;
    const padY = 12;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const minR = Math.min(...trendRates);
    const maxR = Math.max(...trendRates);
    const span = maxR - minR;

    const coords = trendRates.map((rate, idx) => {
      const x =
        trendRates.length > 1
          ? padX + (idx / (trendRates.length - 1)) * usableW
          : width / 2;
      let y: number;
      if (span < 0.01) {
        y = rate > 0 ? padY + usableH * 0.34 : padY + usableH * 0.72;
      } else {
        const normalized = (rate - minR) / span;
        y = padY + (1 - normalized) * usableH;
      }
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const areaPoints =
      coords.length > 0
        ? `${coords[0].x},${height} ${polylinePoints} ${
            coords[coords.length - 1].x
          },${height}`
        : '';

    return { width, height, coords, polylinePoints, areaPoints };
  }, [trendRates]);

  // Academic Progress Data (Monthly Scores)
  const recordedMonths = useMemo(() => {
    const items: Array<{ key: string; year: number; month: number; label: string }> =
      [];
    for (const [key, scoreMap] of Object.entries(monthlyScoresByMonth)) {
      const [yStr, mStr] = key.split('-');
      const year = Number(yStr);
      const month = Number(mStr);
      if (!year || !month || month < 1 || month > 12 || !scoreMap) continue;
      const hasScores = Object.values(scoreMap).some((stuScores) =>
        Object.values(stuScores || {}).some(
          (val) => typeof val === 'number' && !Number.isNaN(val)
        )
      );
      if (!hasScores) continue;
      items.push({
        key,
        year,
        month,
        label: `ខែ${getKhmerMonthLabel(month)} ${toKhmerDigits(year)}`,
      });
    }
    return items.sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
  }, [monthlyScoresByMonth]);

  const activeMonthlyTarget = useMemo(() => {
    const settingsMonthly = getMonthlyScoresMonthYear(settings);
    const settingsKey = getMonthKey(settingsMonthly.year, settingsMonthly.month);
    const matchedSettings = recordedMonths.find((m) => m.key === settingsKey);
    if (selectedProgressMonthKey) {
      const explicit = recordedMonths.find(
        (m) => m.key === selectedProgressMonthKey
      );
      if (explicit) return explicit;
    }
    if (matchedSettings) return matchedSettings;
    return recordedMonths[recordedMonths.length - 1] || null;
  }, [recordedMonths, selectedProgressMonthKey, settings]);

  useEffect(() => {
    setHoveredProgIdx(null);
  }, [chartPrefs.progressMetric, chartPrefs.progressChartType, activeMonthlyTarget?.key]);

  const progressAnalytics = useMemo(() => {
    if (!activeMonthlyTarget || students.length === 0) {
      return {
        hasData: false,
        classAverage: 0,
        passCount: 0,
        gradedCount: 0,
        passRate: 0,
        topABCount: 0,
        subjectData: [] as ProgressDatum[],
        monthlyTrendData: [] as ProgressDatum[],
        gradeDistData: [] as ProgressDatum[],
      };
    }

    const activeMap = monthlyScoresByMonth[activeMonthlyTarget.key] || {};
    const results = computeMonthlyResults(students, activeMap, 10);
    const gradedResults = students
      .map((s) => results[s.id])
      .filter((r) => r && r.enteredCount > 0);

    const gradedCount = gradedResults.length;
    const classAverage =
      gradedCount > 0
        ? gradedResults.reduce((acc, r) => acc + r.average, 0) / gradedCount
        : 0;
    const passCount = gradedResults.filter((r) => r.average >= 5).length;
    const passRate = gradedCount > 0 ? (passCount / gradedCount) * 100 : 0;
    const topABCount = gradedResults.filter(
      (r) => r.grade === 'A' || r.grade === 'B'
    ).length;

    // 1. Subject Group Averages for active month
    const subjectGroups = getResolvedMonthlySubjectGroups(settings).filter(
      (g) => !g.isCompetencyGroup
    );
    const hiddenSet = new Set(settings.hiddenMonthlySubjectKeys || []);
    const subjectData: ProgressDatum[] = [];

    subjectGroups.forEach((grp, idx) => {
      const activeSubs = grp.subjects.filter((s) => !hiddenSet.has(s.key));
      const targetSubs = activeSubs.length > 0 ? activeSubs : grp.subjects;
      let sum = 0;
      let count = 0;
      for (const stu of students) {
        const stuScores = activeMap[stu.id];
        if (!stuScores) continue;
        let stuSum = 0;
        let stuSubCount = 0;
        for (const sub of targetSubs) {
          const val = stuScores[sub.key];
          if (typeof val === 'number' && !Number.isNaN(val)) {
            stuSum += val;
            stuSubCount++;
          }
        }
        if (stuSubCount > 0) {
          sum += stuSum / stuSubCount;
          count++;
        }
      }
      const avg = count > 0 ? sum / count : 0;
      subjectData.push({
        id: grp.key,
        shortLabel: SUBJECT_SHORT_LABELS[grp.key] || grp.label.slice(0, 6),
        fullLabel: grp.label,
        value: Number(avg.toFixed(2)),
        displayValue: `${avg.toFixed(2)}`,
        subText:
          count > 0
            ? `សិស្សមានពិន្ទុ ${toKhmerDigits(count)} នាក់`
            : 'មិនទាន់មានពិន្ទុ',
        color: SUBJECT_PALETTE[idx % SUBJECT_PALETTE.length],
      });
    });

    // 2. Monthly Class Average Progression across recorded months
    const monthlyTrendData: ProgressDatum[] = recordedMonths.map((rm, idx) => {
      const mMap = monthlyScoresByMonth[rm.key] || {};
      const mRes = computeMonthlyResults(students, mMap, 10);
      const valid = students
        .map((s) => mRes[s.id])
        .filter((r) => r && r.enteredCount > 0);
      const avg =
        valid.length > 0
          ? valid.reduce((acc, r) => acc + r.average, 0) / valid.length
          : 0;
      const passC = valid.filter((r) => r.average >= 5).length;
      const pRate = valid.length > 0 ? (passC / valid.length) * 100 : 0;
      return {
        id: rm.key,
        shortLabel: getKhmerMonthLabel(rm.month),
        fullLabel: rm.label,
        value: Number(avg.toFixed(2)),
        displayValue: `${avg.toFixed(2)}`,
        subText: `ជាប់ ${pRate.toFixed(0)}% (${toKhmerDigits(passC)}/${toKhmerDigits(valid.length)} នាក់)`,
        color: SUBJECT_PALETTE[idx % SUBJECT_PALETTE.length],
      };
    });

    // 3. Grade Distribution A-F for active month
    const gradeCounts: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
    };
    for (const r of gradedResults) {
      if (r.grade in gradeCounts) {
        gradeCounts[r.grade]++;
      }
    }
    const gradeDistData: ProgressDatum[] = GRADE_ORDER.map((g) => {
      const count = gradeCounts[g];
      const pct = gradedCount > 0 ? (count / gradedCount) * 100 : 0;
      return {
        id: g,
        shortLabel: `និទ្ទេស ${g}`,
        fullLabel: `និទ្ទេស ${g}`,
        value: count,
        displayValue: `${count} នាក់`,
        subText: `${pct.toFixed(1)}% នៃសិស្សមានពិន្ទុ`,
        color: GRADE_COLORS[g],
      };
    });

    return {
      hasData: gradedCount > 0,
      classAverage,
      passCount,
      gradedCount,
      passRate,
      topABCount,
      subjectData,
      monthlyTrendData,
      gradeDistData,
    };
  }, [activeMonthlyTarget, monthlyScoresByMonth, recordedMonths, settings, students]);

  const activeProgressSeries = useMemo(() => {
    if (chartPrefs.progressMetric === 'monthly') {
      if (progressAnalytics.monthlyTrendData.length > 0) {
        return {
          items: progressAnalytics.monthlyTrendData,
          maxVal: 10,
          unitSuffix: '/10',
          isScore: true,
        };
      }
    }
    if (chartPrefs.progressMetric === 'grades') {
      const maxCount = Math.max(
        4,
        ...progressAnalytics.gradeDistData.map((d) => d.value)
      );
      return {
        items: progressAnalytics.gradeDistData,
        maxVal: maxCount,
        unitSuffix: ' នាក់',
        isScore: false,
      };
    }
    return {
      items: progressAnalytics.subjectData,
      maxVal: 10,
      unitSuffix: '/10',
      isScore: true,
    };
  }, [chartPrefs.progressMetric, progressAnalytics]);

  const quickActions: Array<{
    key: NavTabTarget;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    gradientClass: string;
    shadowClass: string;
  }> = [
    {
      key: 'attendance',
      label: 'អវត្តមានសិស្ស',
      Icon: UserCheck,
      gradientClass:
        'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
      shadowClass: 'shadow-blue-600/20 hover:shadow-blue-600/30',
    },
    {
      key: 'monthly',
      label: 'ពិន្ទុប្រឡងប្រចាំខែ',
      Icon: ListChecks,
      gradientClass:
        'bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-600',
      shadowClass: 'shadow-emerald-600/20 hover:shadow-emerald-600/30',
    },
    {
      key: 'semester',
      label: 'ពិន្ទុប្រឡងឆមាស',
      Icon: ClipboardList,
      gradientClass:
        'bg-gradient-to-br from-orange-400 via-orange-500 to-amber-600',
      shadowClass: 'shadow-orange-600/20 hover:shadow-orange-600/30',
    },
    {
      key: 'roster',
      label: 'ព័ត៌មានសិស្ស',
      Icon: Users,
      gradientClass:
        'bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600',
      shadowClass: 'shadow-violet-600/20 hover:shadow-violet-600/30',
    },
  ];

  // Donut Geometry for Today's Attendance
  const attendanceDonutSegments = useMemo(() => {
    const total = students.length;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    if (total === 0) {
      return { radius, circumference, segments: [] as Array<{ key: string; label: string; count: number; pct: number; color: string; dashArray: string; dashOffset: number }> };
    }
    const items = [
      {
        key: 'present',
        label: 'មករៀន',
        count: todaySummary.present,
        color: '#10b981',
      },
      {
        key: 'excused',
        label: 'ច្បាប់',
        count: todaySummary.excused,
        color: '#f59e0b',
      },
      {
        key: 'unexcused',
        label: 'អត់ច្បាប់',
        count: todaySummary.unexcused,
        color: '#ef4444',
      },
    ];
    let cumulative = 0;
    const segments = items.map((item) => {
      const pct = (item.count / total) * 100;
      const len = (item.count / total) * circumference;
      const seg = {
        ...item,
        pct,
        dashArray: `${len} ${circumference - len}`,
        dashOffset: -cumulative,
      };
      cumulative += len;
      return seg;
    });
    return { radius, circumference, segments };
  }, [students.length, todaySummary.excused, todaySummary.present, todaySummary.unexcused]);

  // Progress Chart SVG Geometry (for Bar, Line, Area)
  const progressChartGeom = useMemo(() => {
    const items = activeProgressSeries.items;
    const width = 560;
    const height = 210;
    const padLeft = 36;
    const padRight = 18;
    const padTop = 26;
    const padBottom = 38;
    const usableW = width - padLeft - padRight;
    const usableH = height - padTop - padBottom;
    const maxVal = activeProgressSeries.maxVal || 10;

    const points = items.map((item, idx) => {
      const slotW = items.length > 0 ? usableW / items.length : usableW;
      const xCenter =
        items.length === 1
          ? padLeft + usableW / 2
          : padLeft + slotW * idx + slotW / 2;
      const xLine =
        items.length > 1
          ? padLeft + (idx / (items.length - 1)) * usableW
          : padLeft + usableW / 2;
      const ratio = Math.min(1, Math.max(0, item.value / maxVal));
      const barH = ratio * usableH;
      const yBar = padTop + (usableH - barH);
      const yLine = padTop + (1 - ratio) * usableH;
      const barW = Math.min(44, Math.max(20, slotW * 0.52));
      return {
        item,
        idx,
        xCenter,
        xLine,
        yBar,
        yLine,
        barH,
        barW,
        baselineY: padTop + usableH,
      };
    });

    const polylinePoints = points
      .map((p) => `${p.xLine.toFixed(1)},${p.yLine.toFixed(1)}`)
      .join(' ');

    const areaPoints =
      points.length > 0
        ? `${points[0].xLine.toFixed(1)},${(padTop + usableH).toFixed(
            1
          )} ${polylinePoints} ${points[points.length - 1].xLine.toFixed(
            1
          )},${(padTop + usableH).toFixed(1)}`
        : '';

    const gridTicks = activeProgressSeries.isScore
      ? [0, 2.5, 5, 7.5, 10]
      : [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      usableW,
      usableH,
      maxVal,
      points,
      polylinePoints,
      areaPoints,
      gridTicks,
    };
  }, [activeProgressSeries]);

  // Progress Donut Geometry
  const progressDonutSegments = useMemo(() => {
    const items = activeProgressSeries.items;
    const totalVal = items.reduce((acc, it) => acc + Math.max(0, it.value), 0);
    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;
    const segments = items.map((item, idx) => {
      const share = totalVal > 0 ? Math.max(0, item.value) / totalVal : 0;
      const len = share * circumference;
      const seg = {
        item,
        idx,
        sharePct: share * 100,
        dashArray: `${len} ${circumference - len}`,
        dashOffset: -cumulative,
      };
      cumulative += len;
      return seg;
    });
    return { radius, circumference, totalVal, segments };
  }, [activeProgressSeries.items]);

  const activeAttDay =
    hoveredAttIdx !== null
      ? attendanceTrendDays[hoveredAttIdx]
      : attendanceTrendDays[attendanceTrendDays.length - 1];

  const activeProgDatum =
    hoveredProgIdx !== null
      ? activeProgressSeries.items[hoveredProgIdx]
      : null;

  return (
    <div className="space-y-5">
      {/* 1. Top Hero Card: Teacher Greeting Banner + School Metadata */}
      <section className="surface-card rounded-2xl overflow-hidden">
        {/* Deep Blue Angkor Banner */}
        <div className="relative overflow-hidden bg-[#0e2757] px-4 sm:px-6 py-5 sm:py-6">
          <img
            src={angkorWatBanner}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover object-[78%_38%] sm:object-[72%_36%] select-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0c2352]/92 via-[#123678]/65 to-[#1a499e]/20"
          />

          <div className="relative z-10 flex items-center gap-3.5 sm:gap-4">
            <button
              type="button"
              onClick={user ? onEditProfile : onSignIn}
              title={user ? 'កែប្រែព័ត៌មានគណនី' : 'ចូលគណនី'}
              className="shrink-0 rounded-full ring-2 ring-white/85 shadow-md hover:ring-blue-200 transition-all cursor-pointer active:scale-95"
            >
              {user ? (
                <UserAvatar
                  user={user}
                  sizeClass="w-15 h-15 sm:w-18 sm:h-18"
                  textClass="text-xl"
                />
              ) : (
                <div className="w-15 h-15 sm:w-18 sm:h-18 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center text-white">
                  <UserIcon className="w-7 h-7" />
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-blue-100/95">
                {greeting}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate mt-0.5 drop-shadow-xs">
                {teacherDisplayName}
              </h2>
            </div>
          </div>
        </div>

        {/* School & Class Info Section */}
        <div className="relative overflow-hidden px-4 sm:px-6 py-4 bg-white dark:bg-slate-900/95">
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            className="pointer-events-none absolute right-1 bottom-0 w-24 h-24 text-amber-700/10 dark:text-amber-300/10"
            fill="currentColor"
          >
            <path d="M90 12L102 24L90 36L78 24ZM66 36L78 48L66 60L54 48ZM90 60L102 72L90 84L78 72ZM66 84L78 96L66 108L54 96ZM102 48L114 60L102 72L90 60Z" />
          </svg>

          <div className="relative z-10">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              សាលារៀន
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {schoolDisplayName}
            </p>

            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {classDisplayName}
              </span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                សិស្សសរុប {toKhmerDigits(students.length)} នាក់ / ស្រី{' '}
                {toKhmerDigits(femaleCount)} នាក់
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Access Section */}
      <section aria-labelledby="quick-access-heading">
        <h3
          id="quick-access-heading"
          className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-3"
        >
          ការចូលប្រើរហ័ស
        </h3>

        <div className="relative">
          <div
            ref={quickScrollerRef}
            className="flex md:grid md:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory pb-1 md:pb-0"
          >
            {quickActions.map(
              ({ key, label, Icon, gradientClass, shadowClass }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigateTab(key)}
                  className={`group relative overflow-hidden shrink-0 w-[39%] min-w-[132px] sm:w-[31%] md:w-auto snap-start rounded-2xl px-3 py-5 sm:py-6 flex flex-col items-center justify-center gap-2.5 text-white shadow-md ${gradientClass} ${shadowClass} hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 64 64"
                    className="pointer-events-none absolute -right-1 -top-1 w-14 h-14 text-white/15"
                    fill="currentColor"
                  >
                    <path d="M40 8L48 16L40 24L32 16ZM24 24L32 32L24 40L16 32ZM48 24L56 32L48 40L40 32Z" />
                  </svg>

                  <div className="relative z-10 w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="relative z-10 text-xs sm:text-sm font-bold text-center leading-snug whitespace-nowrap">
                    {label}
                  </span>
                </button>
              )
            )}
          </div>

          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollQuickAccess('left')}
              aria-label="រំកិលទៅឆ្វេង"
              className="md:hidden absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollQuickAccess('right')}
              aria-label="រំកិលទៅស្តាំ"
              className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md flex items-center justify-center active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* 3. Today's Attendance Summary Card with Selectable Chart Type */}
      <section className="surface-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              ការចុះអវត្តមានថ្ងៃនេះ
            </h3>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="font-mono-num text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              {todayIsoDate}
            </span>
          </div>

          {/* Chart Type Selector */}
          <div
            role="group"
            aria-label="ជ្រើសរើសប្រភេទក្រាបអវត្តមាន"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 self-start sm:self-auto overflow-x-auto max-w-full"
          >
            {CHART_TYPE_OPTIONS.map(({ key, label, Icon }) => {
              const active = chartPrefs.attendanceChartType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateChartPrefs({ attendanceChartType: key })}
                  aria-pressed={active}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Chart Rendering */}
        {chartPrefs.attendanceChartType === 'line' && (
          <div className="my-4 rounded-2xl bg-gradient-to-br from-[#0b40aa] via-[#1353cf] to-[#1f68eb] dark:from-[#0b348a] dark:via-[#1146b3] dark:to-[#1957cf] p-5 sm:p-6 text-white shadow-md shadow-blue-900/15">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono-num text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
                  {attendanceRate.toFixed(1)}%
                </div>
                <p className="mt-2 text-sm font-medium text-blue-100/95">
                  <span className="font-mono-num font-semibold">
                    {todaySummary.present}
                  </span>{' '}
                  នៃ{' '}
                  <span className="font-mono-num font-semibold">
                    {students.length}
                  </span>{' '}
                  នាក់ មករៀន
                </p>
              </div>
              {activeAttDay && (
                <div className="text-right text-xs text-blue-100/90 font-medium">
                  <div>
                    ថ្ងៃ{activeAttDay.shortDay} ទី{' '}
                    <span className="font-mono-num">{activeAttDay.dayNum}</span>
                  </div>
                  <div className="font-mono-num font-bold text-white mt-0.5">
                    {activeAttDay.rate.toFixed(1)}% ({activeAttDay.present}/
                    {students.length})
                  </div>
                </div>
              )}
            </div>

            <div className="my-4">
              <svg
                viewBox={`0 0 ${sparkGeometry.width} ${sparkGeometry.height}`}
                preserveAspectRatio="none"
                className="w-full h-16 sm:h-20 overflow-visible"
                role="img"
                aria-label={`និន្នាការអត្រាវត្តមាន ៧ ថ្ងៃចុងក្រោយ ${attendanceRate.toFixed(
                  1
                )}%`}
              >
                <polyline
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.96)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={sparkGeometry.polylinePoints}
                />
                {sparkGeometry.coords.map((pt, idx) => {
                  const isFocused =
                    hoveredAttIdx === idx ||
                    (hoveredAttIdx === null &&
                      idx === sparkGeometry.coords.length - 1);
                  return (
                    <g key={attendanceTrendDays[idx].dateStr}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isFocused ? 5.2 : 3.2}
                        fill={isFocused ? '#ffffff' : 'rgba(255,255,255,0.75)'}
                        stroke="rgba(19, 83, 207, 0.85)"
                        strokeWidth={isFocused ? 2 : 0}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={14}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAttIdx(idx)}
                        onMouseLeave={() => setHoveredAttIdx(null)}
                        onClick={() => setHoveredAttIdx(idx)}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] font-medium text-blue-100/85">
                {attendanceTrendDays.map((d, idx) => (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setHoveredAttIdx(idx)}
                    className={`px-1 py-0.5 rounded transition-colors cursor-pointer ${
                      hoveredAttIdx === idx
                        ? 'bg-white/20 text-white font-bold'
                        : 'hover:text-white'
                    }`}
                  >
                    {d.shortDay} <span className="font-mono-num">{d.dayNum}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xs px-3 py-1 text-xs font-medium text-white">
              <span className="font-mono-num font-semibold">
                {deltaArrow}
                {formattedDelta}%
              </span>
              <span>ធៀបម្សិលមិញ</span>
            </div>
          </div>
        )}

        {chartPrefs.attendanceChartType === 'area' && (
          <div className="my-4 rounded-2xl bg-gradient-to-br from-[#0b40aa] via-[#1353cf] to-[#1f68eb] dark:from-[#0b348a] dark:via-[#1146b3] dark:to-[#1957cf] p-5 sm:p-6 text-white shadow-md shadow-blue-900/15">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono-num text-4xl sm:text-5xl font-extrabold tracking-tight leading-none">
                  {attendanceRate.toFixed(1)}%
                </div>
                <p className="mt-2 text-sm font-medium text-blue-100/95">
                  <span className="font-mono-num font-semibold">
                    {todaySummary.present}
                  </span>{' '}
                  នៃ{' '}
                  <span className="font-mono-num font-semibold">
                    {students.length}
                  </span>{' '}
                  នាក់ មករៀន
                </p>
              </div>
              {activeAttDay && (
                <div className="text-right text-xs text-blue-100/90 font-medium">
                  <div>
                    ថ្ងៃ{activeAttDay.shortDay} ទី{' '}
                    <span className="font-mono-num">{activeAttDay.dayNum}</span>
                  </div>
                  <div className="font-mono-num font-bold text-white mt-0.5">
                    {activeAttDay.rate.toFixed(1)}% ({activeAttDay.present}/
                    {students.length})
                  </div>
                </div>
              )}
            </div>

            <div className="my-4">
              <svg
                viewBox={`0 0 ${sparkGeometry.width} ${sparkGeometry.height}`}
                preserveAspectRatio="none"
                className="w-full h-20 sm:h-24 overflow-visible"
                role="img"
                aria-label={`ក្រាបផ្ទៃអត្រាវត្តមាន ៧ ថ្ងៃចុងក្រោយ ${attendanceRate.toFixed(
                  1
                )}%`}
              >
                <defs>
                  <linearGradient id="attAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <line
                  x1="10"
                  y1={sparkGeometry.height * 0.5}
                  x2={sparkGeometry.width - 10}
                  y2={sparkGeometry.height * 0.5}
                  stroke="rgba(255,255,255,0.16)"
                  strokeDasharray="4 4"
                />
                {sparkGeometry.areaPoints && (
                  <polygon
                    fill="url(#attAreaGrad)"
                    points={sparkGeometry.areaPoints}
                  />
                )}
                <polyline
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.96)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={sparkGeometry.polylinePoints}
                />
                {sparkGeometry.coords.map((pt, idx) => {
                  const isFocused =
                    hoveredAttIdx === idx ||
                    (hoveredAttIdx === null &&
                      idx === sparkGeometry.coords.length - 1);
                  return (
                    <g key={attendanceTrendDays[idx].dateStr}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isFocused ? 5.2 : 3.2}
                        fill="#ffffff"
                        stroke="rgba(19, 83, 207, 0.9)"
                        strokeWidth={isFocused ? 2 : 1}
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={14}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAttIdx(idx)}
                        onMouseLeave={() => setHoveredAttIdx(null)}
                        onClick={() => setHoveredAttIdx(idx)}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] font-medium text-blue-100/85">
                {attendanceTrendDays.map((d, idx) => (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setHoveredAttIdx(idx)}
                    className={`px-1 py-0.5 rounded transition-colors cursor-pointer ${
                      hoveredAttIdx === idx
                        ? 'bg-white/20 text-white font-bold'
                        : 'hover:text-white'
                    }`}
                  >
                    {d.shortDay} <span className="font-mono-num">{d.dayNum}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-xs px-3 py-1 text-xs font-medium text-white">
              <span className="font-mono-num font-semibold">
                {deltaArrow}
                {formattedDelta}%
              </span>
              <span>ធៀបម្សិលមិញ</span>
            </div>
          </div>
        )}

        {chartPrefs.attendanceChartType === 'bar' && (
          <div className="my-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="font-mono-num text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-none">
                  {activeAttDay ? `${activeAttDay.rate.toFixed(1)}%` : '0.0%'}
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {activeAttDay
                    ? `ថ្ងៃ${activeAttDay.shortDay} ទី ${toKhmerDigits(
                        activeAttDay.dayNum
                      )} · មករៀន ${activeAttDay.present} · ច្បាប់ ${
                        activeAttDay.excused
                      } · អត់ច្បាប់ ${activeAttDay.unexcused}`
                    : 'មិនទាន់មានទិន្នន័យ'}
                </p>
              </div>
              <span className="font-mono-num text-xs font-semibold text-blue-700 dark:text-blue-300">
                {deltaArrow}
                {formattedDelta}% ធៀបម្សិលមិញ
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-36 pt-5">
              {attendanceTrendDays.map((d, idx) => {
                const isSelected =
                  hoveredAttIdx === idx ||
                  (hoveredAttIdx === null &&
                    idx === attendanceTrendDays.length - 1);
                const barHeightPct =
                  students.length > 0 ? Math.max(6, Math.round(d.rate)) : 6;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onMouseEnter={() => setHoveredAttIdx(idx)}
                    onMouseLeave={() => setHoveredAttIdx(null)}
                    onClick={() => setHoveredAttIdx(idx)}
                    className="h-full flex flex-col items-center justify-end gap-1.5 group cursor-pointer focus:outline-none"
                  >
                    <span
                      className={`font-mono-num text-[11px] font-bold transition-colors ${
                        isSelected
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {Math.round(d.rate)}%
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className={`w-full max-w-[34px] rounded-t-lg transition-all duration-150 ${
                          isSelected
                            ? 'bg-gradient-to-t from-blue-600 to-blue-400 shadow-sm shadow-blue-600/25'
                            : 'bg-blue-200/90 dark:bg-blue-800/60 group-hover:bg-blue-400 dark:group-hover:bg-blue-600'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[11px] whitespace-nowrap ${
                        isSelected
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'font-medium text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {d.shortDay} {d.dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {chartPrefs.attendanceChartType === 'donut' && (
          <div className="my-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/70 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6">
              <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                <svg
                  viewBox="0 0 140 140"
                  className="w-full h-full -rotate-90"
                  role="img"
                  aria-label={`ក្រាបរង្វង់អវត្តមានថ្ងៃនេះ ${attendanceRate.toFixed(
                    1
                  )}%`}
                >
                  <circle
                    cx="70"
                    cy="70"
                    r={attendanceDonutSegments.radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="16"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  {attendanceDonutSegments.segments.map((seg) =>
                    seg.count > 0 ? (
                      <circle
                        key={seg.key}
                        cx="70"
                        cy="70"
                        r={attendanceDonutSegments.radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="16"
                        strokeDasharray={seg.dashArray}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="butt"
                        className="transition-all duration-200"
                      />
                    ) : null
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {attendanceRate.toFixed(1)}%
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                    អត្រាវត្តមាន
                  </span>
                </div>
              </div>

              <div className="w-full sm:flex-1 space-y-2.5">
                {attendanceDonutSegments.segments.map((seg) => (
                  <div
                    key={seg.key}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-200/70 dark:border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {seg.label}
                      </span>
                    </div>
                    <div className="font-mono-num text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {seg.count} នាក់{' '}
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        ({seg.pct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2x2 Attendance Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Students */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-blue-50/75 dark:bg-blue-950/35 border border-blue-200/80 dark:border-blue-800/50">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                សិស្សសរុប
              </p>
              <p className="font-mono-num text-lg font-bold text-blue-700 dark:text-blue-200 leading-tight mt-0.5">
                {students.length}
              </p>
            </div>
          </div>

          {/* Present */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-emerald-50/75 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/50">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                មករៀន
              </p>
              <p className="font-mono-num text-lg font-bold text-emerald-700 dark:text-emerald-200 leading-tight mt-0.5">
                {todaySummary.present}
              </p>
            </div>
          </div>

          {/* Excused */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-amber-50/75 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/50">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Clock3 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                ច្បាប់
              </p>
              <p className="font-mono-num text-lg font-bold text-amber-700 dark:text-amber-200 leading-tight mt-0.5">
                {todaySummary.excused}
              </p>
            </div>
          </div>

          {/* Unexcused */}
          <div className="rounded-xl px-3.5 py-3 flex items-center gap-3 bg-rose-50/75 dark:bg-rose-950/35 border border-rose-200/80 dark:border-rose-800/50">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                អត់ច្បាប់
              </p>
              <p className="font-mono-num text-lg font-bold text-rose-700 dark:text-rose-200 leading-tight mt-0.5">
                {todaySummary.unexcused}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Student Academic Progress Card with Chart Type & Metric Selectors */}
      <section
        aria-labelledby="student-progress-heading"
        className="surface-card rounded-2xl p-4 sm:p-6"
      >
        {/* Header + Chart Type Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="student-progress-heading"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              វឌ្ឍនភាពការសិក្សាសិស្ស
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeMonthlyTarget
                ? `${activeMonthlyTarget.label} · ឆ្នាំសិក្សា ${settings.academicYear}`
                : `ឆ្នាំសិក្សា ${settings.academicYear}`}
            </p>
          </div>

          <div
            role="group"
            aria-label="ជ្រើសរើសប្រភេទក្រាបវឌ្ឍនភាពសិស្ស"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 self-start lg:self-auto overflow-x-auto max-w-full"
          >
            {CHART_TYPE_OPTIONS.map(({ key, label, Icon }) => {
              const active = chartPrefs.progressChartType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateChartPrefs({ progressChartType: key })}
                  aria-pressed={active}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Metric Tabs & Optional Recorded Month Selector */}
        {progressAnalytics.hasData ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5">
              <div
                role="group"
                aria-label="ជ្រើសរើសទិន្នន័យវឌ្ឍនភាព"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 overflow-x-auto max-w-full"
              >
                {PROGRESS_METRIC_OPTIONS.map(({ key, label }) => {
                  const active = chartPrefs.progressMetric === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateChartPrefs({ progressMetric: key })}
                      aria-pressed={active}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        active
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {recordedMonths.length > 1 &&
                chartPrefs.progressMetric !== 'monthly' && (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>ខែ៖</span>
                    <select
                      value={activeMonthlyTarget?.key || ''}
                      onChange={(e) => setSelectedProgressMonthKey(e.target.value)}
                      className="min-h-[34px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {recordedMonths.map((rm) => (
                        <option key={rm.key} value={rm.key}>
                          {rm.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
            </div>

            {/* 4-Column Academic KPI Strip */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  មធ្យមភាគថ្នាក់
                </p>
                <p className="font-mono-num text-lg font-extrabold text-blue-700 dark:text-blue-300 mt-0.5">
                  {progressAnalytics.classAverage.toFixed(2)}
                  <span className="text-xs font-medium text-slate-400"> / 10</span>
                </p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  អត្រាជាប់ (≥ ៥.០)
                </p>
                <p className="font-mono-num text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {progressAnalytics.passRate.toFixed(1)}%
                </p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  និទ្ទេសល្អ (A–B)
                </p>
                <p className="font-mono-num text-lg font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {progressAnalytics.topABCount}{' '}
                  <span className="text-xs font-medium text-slate-400">នាក់</span>
                </p>
              </div>
              <div className="px-3.5 py-2.5">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  សិស្សមានពិន្ទុ
                </p>
                <p className="font-mono-num text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                  {progressAnalytics.gradedCount}
                  <span className="text-xs font-medium text-slate-400">
                    /{students.length}
                  </span>
                </p>
              </div>
            </div>

            {/* Active Hover / Selection Readout */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 min-h-[24px] text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {activeProgDatum
                  ? activeProgDatum.fullLabel
                  : chartPrefs.progressMetric === 'subjects'
                  ? 'មធ្យមភាគតាមក្រុមមុខវិជ្ជា'
                  : chartPrefs.progressMetric === 'monthly'
                  ? 'និន្នាការមធ្យមភាគថ្នាក់ប្រចាំខែ'
                  : 'ការបែងចែកនិទ្ទេសសិស្ស (A–F)'}
              </span>
              <span className="font-mono-num font-semibold text-blue-700 dark:text-blue-300">
                {activeProgDatum
                  ? `${activeProgDatum.displayValue} · ${activeProgDatum.subText}`
                  : 'ប៉ះ ឬដាក់ Mouse លើក្រាបដើម្បីមើលលម្អិត'}
              </span>
            </div>

            {/* Progress Visualization Canvas */}
            <div className="mt-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-3 sm:p-4">
              {chartPrefs.progressChartType === 'bar' && (
                <svg
                  viewBox={`0 0 ${progressChartGeom.width} ${progressChartGeom.height}`}
                  className="w-full h-52 sm:h-60 overflow-visible"
                  role="img"
                  aria-label="ក្រាបសសរវឌ្ឍនភាពការសិក្សាសិស្ស"
                >
                  {progressChartGeom.gridTicks.map((tick) => {
                    const y =
                      progressChartGeom.padTop +
                      (1 - tick / progressChartGeom.maxVal) *
                        progressChartGeom.usableH;
                    return (
                      <g key={tick}>
                        <line
                          x1={progressChartGeom.padLeft}
                          y1={y}
                          x2={
                            progressChartGeom.width -
                            progressChartGeom.padRight
                          }
                          y2={y}
                          stroke="currentColor"
                          strokeDasharray={tick === 0 ? undefined : '3 4'}
                          className={
                            tick === 0
                              ? 'text-slate-300 dark:text-slate-700'
                              : 'text-slate-200/80 dark:text-slate-800'
                          }
                        />
                        <text
                          x={progressChartGeom.padLeft - 6}
                          y={y + 3.5}
                          textAnchor="end"
                          className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono-num"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {progressChartGeom.points.map((p) => {
                    const isFocused = hoveredProgIdx === p.idx;
                    return (
                      <g
                        key={p.item.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredProgIdx(p.idx)}
                        onMouseLeave={() => setHoveredProgIdx(null)}
                        onClick={() => setHoveredProgIdx(p.idx)}
                      >
                        <rect
                          x={p.xCenter - p.barW / 2}
                          y={p.yBar}
                          width={p.barW}
                          height={Math.max(2, p.barH)}
                          rx={6}
                          fill={p.item.color}
                          opacity={
                            hoveredProgIdx === null || isFocused ? 0.94 : 0.45
                          }
                          className="transition-opacity duration-150"
                        />
                        <text
                          x={p.xCenter}
                          y={p.yBar - 6}
                          textAnchor="middle"
                          className={`text-[10.5px] font-bold font-mono-num ${
                            isFocused
                              ? 'fill-slate-900 dark:fill-white'
                              : 'fill-slate-600 dark:fill-slate-300'
                          }`}
                        >
                          {activeProgressSeries.isScore
                            ? p.item.value.toFixed(1)
                            : p.item.value}
                        </text>
                        <text
                          x={p.xCenter}
                          y={progressChartGeom.height - 12}
                          textAnchor="middle"
                          className={`text-[10.5px] font-semibold ${
                            isFocused
                              ? 'fill-blue-700 dark:fill-blue-300'
                              : 'fill-slate-600 dark:fill-slate-400'
                          }`}
                        >
                          {p.item.shortLabel}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {(chartPrefs.progressChartType === 'line' ||
                chartPrefs.progressChartType === 'area') && (
                <svg
                  viewBox={`0 0 ${progressChartGeom.width} ${progressChartGeom.height}`}
                  className="w-full h-52 sm:h-60 overflow-visible"
                  role="img"
                  aria-label="ក្រាបបន្ទាត់ឬផ្ទៃវឌ្ឍនភាពការសិក្សាសិស្ស"
                >
                  <defs>
                    <linearGradient
                      id="progressAreaFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {progressChartGeom.gridTicks.map((tick) => {
                    const y =
                      progressChartGeom.padTop +
                      (1 - tick / progressChartGeom.maxVal) *
                        progressChartGeom.usableH;
                    return (
                      <g key={tick}>
                        <line
                          x1={progressChartGeom.padLeft}
                          y1={y}
                          x2={
                            progressChartGeom.width -
                            progressChartGeom.padRight
                          }
                          y2={y}
                          stroke="currentColor"
                          strokeDasharray={tick === 0 ? undefined : '3 4'}
                          className={
                            tick === 0
                              ? 'text-slate-300 dark:text-slate-700'
                              : 'text-slate-200/80 dark:text-slate-800'
                          }
                        />
                        <text
                          x={progressChartGeom.padLeft - 6}
                          y={y + 3.5}
                          textAnchor="end"
                          className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono-num"
                        >
                          {tick}
                        </text>
                      </g>
                    );
                  })}

                  {chartPrefs.progressChartType === 'area' &&
                    progressChartGeom.areaPoints && (
                      <polygon
                        fill="url(#progressAreaFill)"
                        points={progressChartGeom.areaPoints}
                      />
                    )}

                  {progressChartGeom.points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={progressChartGeom.polylinePoints}
                    />
                  )}

                  {progressChartGeom.points.map((p) => {
                    const isFocused = hoveredProgIdx === p.idx;
                    return (
                      <g
                        key={p.item.id}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredProgIdx(p.idx)}
                        onMouseLeave={() => setHoveredProgIdx(null)}
                        onClick={() => setHoveredProgIdx(p.idx)}
                      >
                        {isFocused && (
                          <line
                            x1={p.xLine}
                            y1={progressChartGeom.padTop}
                            x2={p.xLine}
                            y2={p.baselineY}
                            stroke="#2563eb"
                            strokeOpacity="0.25"
                            strokeDasharray="3 3"
                          />
                        )}
                        <circle
                          cx={p.xLine}
                          cy={p.yLine}
                          r={isFocused ? 6.5 : 4.5}
                          fill="#ffffff"
                          stroke="#2563eb"
                          strokeWidth={isFocused ? 3 : 2.5}
                        />
                        <text
                          x={p.xLine}
                          y={p.yLine - 10}
                          textAnchor="middle"
                          className={`text-[10.5px] font-bold font-mono-num ${
                            isFocused
                              ? 'fill-blue-700 dark:fill-blue-300'
                              : 'fill-slate-600 dark:fill-slate-300'
                          }`}
                        >
                          {activeProgressSeries.isScore
                            ? p.item.value.toFixed(1)
                            : p.item.value}
                        </text>
                        <text
                          x={p.xLine}
                          y={progressChartGeom.height - 12}
                          textAnchor="middle"
                          className={`text-[10.5px] font-semibold ${
                            isFocused
                              ? 'fill-blue-700 dark:fill-blue-300'
                              : 'fill-slate-600 dark:fill-slate-400'
                          }`}
                        >
                          {p.item.shortLabel}
                        </text>
                        <circle
                          cx={p.xLine}
                          cy={p.yLine}
                          r={16}
                          fill="transparent"
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {chartPrefs.progressChartType === 'donut' && (
                <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 py-2">
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    <svg
                      viewBox="0 0 150 150"
                      className="w-full h-full -rotate-90"
                      role="img"
                      aria-label="ក្រាបរង្វង់វឌ្ឍនភាពការសិក្សាសិស្ស"
                    >
                      <circle
                        cx="75"
                        cy="75"
                        r={progressDonutSegments.radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="18"
                        className="text-slate-200 dark:text-slate-800"
                      />
                      {progressDonutSegments.segments.map((seg) =>
                        seg.item.value > 0 ? (
                          <circle
                            key={seg.item.id}
                            cx="75"
                            cy="75"
                            r={progressDonutSegments.radius}
                            fill="none"
                            stroke={seg.item.color}
                            strokeWidth={hoveredProgIdx === seg.idx ? 21 : 18}
                            strokeDasharray={seg.dashArray}
                            strokeDashoffset={seg.dashOffset}
                            opacity={
                              hoveredProgIdx === null ||
                              hoveredProgIdx === seg.idx
                                ? 1
                                : 0.45
                            }
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredProgIdx(seg.idx)}
                            onMouseLeave={() => setHoveredProgIdx(null)}
                            onClick={() => setHoveredProgIdx(seg.idx)}
                          />
                        ) : null
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                      <span className="font-mono-num text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                        {activeProgDatum
                          ? activeProgDatum.displayValue
                          : chartPrefs.progressMetric === 'grades'
                          ? `${progressAnalytics.passRate.toFixed(0)}%`
                          : `${progressAnalytics.classAverage.toFixed(2)}`}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full">
                        {activeProgDatum
                          ? activeProgDatum.shortLabel
                          : chartPrefs.progressMetric === 'grades'
                          ? 'អត្រាជាប់'
                          : 'មធ្យមភាគថ្នាក់'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
                    {progressDonutSegments.segments.map((seg) => {
                      const isFocused = hoveredProgIdx === seg.idx;
                      return (
                        <button
                          key={seg.item.id}
                          type="button"
                          onMouseEnter={() => setHoveredProgIdx(seg.idx)}
                          onMouseLeave={() => setHoveredProgIdx(null)}
                          onClick={() => setHoveredProgIdx(seg.idx)}
                          className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isFocused
                              ? 'bg-slate-100 dark:bg-slate-800'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: seg.item.color }}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                              {seg.item.fullLabel}
                            </span>
                          </div>
                          <span className="font-mono-num text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                            {seg.item.displayValue}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center mx-auto">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-3">
              មិនទាន់មានទិន្នន័យពិន្ទុប្រចាំខែនៅឡើយទេ
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {students.length === 0
                ? 'សូមបន្ថែមបញ្ជីឈ្មោះសិស្ស និងបញ្ចូលពិន្ទុប្រចាំខែ ដើម្បីមើលក្រាបវឌ្ឍនភាពការសិក្សា។'
                : 'សូមបញ្ចូលពិន្ទុប្រចាំខែឱ្យសិស្ស ដើម្បីតាមដានមធ្យមភាគតាមមុខវិជ្ជា និន្នាការប្រចាំខែ និងនិទ្ទេស។'}
            </p>
            <button
              type="button"
              onClick={() =>
                onNavigateTab(students.length === 0 ? 'roster' : 'monthly')
              }
              className="btn-primary mt-4 min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                {students.length === 0
                  ? 'ទៅបន្ថែមឈ្មោះសិស្ស'
                  : 'ទៅបញ្ចូលពិន្ទុប្រចាំខែ'}
              </span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

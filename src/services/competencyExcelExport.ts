import ExcelJS from 'exceljs';
import type * as ExcelTypes from 'exceljs';
import {
  ATTITUDE_COMPETENCY_SECTIONS,
  CompetencyType,
  SKILL_COMPETENCY_ACTIVITIES,
  evaluateCompetencyRubric,
} from '../constants/competencyRubrics';
import { ClassSettings, Student } from '../types/gradebook';
import { formatKhmerOfficialDate } from '../utils/khmerCalendar';
import { EXCEL_MIME_TYPE, triggerExcelDownload } from './excelExport';

export interface CompetencyExcelExportParams {
  type: CompetencyType;
  student: Student;
  settings: ClassSettings;
  scores: Record<string, number>;
  monthLabel: string;
  year: number;
  periodLabel?: string;
  periodFileSlug?: string;
}

const FONT_MOUL_LIGHT = 'Khmer OS Muol Light';
const FONT_SIEMREAP = 'Khmer OS Siemreap';
const BLACK_ARGB = 'FF000000';
const SUBTOTAL_FILL_ARGB = 'FFC9DAF8';

const THIN_BLACK_BORDER: Partial<ExcelTypes.Border> = {
  style: 'thin',
  color: { argb: BLACK_ARGB },
};

const MEDIUM_BLACK_BORDER: Partial<ExcelTypes.Border> = {
  style: 'medium',
  color: { argb: BLACK_ARGB },
};

function getExcelWorkbookConstructor(): typeof ExcelTypes.Workbook {
  const ns = ExcelJS as unknown as {
    Workbook?: typeof ExcelTypes.Workbook;
    default?: { Workbook?: typeof ExcelTypes.Workbook };
  };
  if (ns?.Workbook) return ns.Workbook;
  if (ns?.default?.Workbook) return ns.default.Workbook;
  const globalNs = (
    globalThis as unknown as {
      ExcelJS?: { Workbook?: typeof ExcelTypes.Workbook };
    }
  ).ExcelJS;
  if (globalNs?.Workbook) return globalNs.Workbook;
  throw new Error('មិនអាចបើកមុខងារបង្កើត Excel បានទេ។');
}

function sanitizeFilePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
}

function estimateRowHeight(
  text: string,
  approxCharsPerLine: number,
  baseHeight = 23,
  lineHeight = 19
): number {
  const lines = Math.max(1, Math.ceil(text.length / approxCharsPerLine));
  if (lines <= 1) return baseHeight;
  return Math.max(baseHeight, lines * lineHeight + 6);
}

function buildGradeDisplayRichText(
  filledCount: number,
  activeGrade: 'ល្អ' | 'ល្អបង្គួរ' | 'មធ្យម' | 'ខ្សោយ'
): ExcelTypes.RichText[] {
  const grades: ('ល្អ' | 'ល្អបង្គួរ' | 'មធ្យម' | 'ខ្សោយ')[] = [
    'ល្អ',
    'ល្អបង្គួរ',
    'មធ្យម',
    'ខ្សោយ',
  ];

  const runs: ExcelTypes.RichText[] = [
    {
      text: 'និទ្ទេស៖  ',
      font: { name: FONT_SIEMREAP, size: 11, bold: true, color: { argb: BLACK_ARGB } },
    },
  ];

  grades.forEach((grade, idx) => {
    const isActive = filledCount > 0 && grade === activeGrade;
    runs.push({
      text: isActive ? `[ ${grade} ]` : grade,
      font: {
        name: FONT_SIEMREAP,
        size: 11,
        bold: isActive,
        underline: isActive,
        color: { argb: BLACK_ARGB },
      },
    });
    if (idx < grades.length - 1) {
      runs.push({
        text: '   ',
        font: { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } },
      });
    }
  });

  return runs;
}

function appendSignatureFooter(
  ws: ExcelTypes.Worksheet,
  startRow: number,
  leftEndCol: number,
  rightStartCol: number,
  lastCol: number,
  scoreText: string,
  filledCount: number,
  gradeLabel: 'ល្អ' | 'ល្អបង្គួរ' | 'មធ្យម' | 'ខ្សោយ',
  teacherName?: string
) {
  const khmerDate = formatKhmerOfficialDate(new Date());

  // Summary row: Score total + Grade
  ws.getRow(startRow).height = 8;
  const summaryRowIdx = startRow + 1;
  ws.getRow(summaryRowIdx).height = 24;

  ws.mergeCells(summaryRowIdx, 1, summaryRowIdx, leftEndCol);
  const scoreCell = ws.getCell(summaryRowIdx, 1);
  scoreCell.value = {
    richText: [
      {
        text: 'ពិន្ទុសរុបមិនឱ្យលើសពី ១(មួយ)ធៀបនឹងមធ្យមភាគ ១០,០០= ',
        font: { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } },
      },
      {
        text: scoreText,
        font: {
          name: FONT_SIEMREAP,
          size: 11,
          bold: true,
          color: { argb: BLACK_ARGB },
        },
      },
    ],
  };
  scoreCell.alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells(summaryRowIdx, rightStartCol, summaryRowIdx, lastCol);
  const gradeCell = ws.getCell(summaryRowIdx, rightStartCol);
  gradeCell.value = {
    richText: buildGradeDisplayRichText(filledCount, gradeLabel),
  };
  gradeCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // Spacer before dates/signatures
  const dateRow1 = summaryRowIdx + 2;
  ws.getRow(summaryRowIdx + 1).height = 10;

  // Lunar Date (Right)
  ws.getRow(dateRow1).height = 22;
  ws.mergeCells(dateRow1, rightStartCol, dateRow1, lastCol);
  const lunarCell = ws.getCell(dateRow1, rightStartCol);
  lunarCell.value = khmerDate.lunarLine;
  lunarCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  lunarCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Solar Date (Right)
  const dateRow2 = dateRow1 + 1;
  ws.getRow(dateRow2).height = 22;
  ws.mergeCells(dateRow2, rightStartCol, dateRow2, lastCol);
  const solarCell = ws.getCell(dateRow2, rightStartCol);
  solarCell.value = khmerDate.solarLine;
  solarCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  solarCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Director approval (Left) & Homeroom teacher role (Right)
  const roleRow1 = dateRow2 + 1;
  const roleRow2 = roleRow1 + 1;
  ws.getRow(roleRow1).height = 24;
  ws.getRow(roleRow2).height = 24;

  ws.mergeCells(roleRow1, 1, roleRow1, leftEndCol);
  const dirTitleCell = ws.getCell(roleRow1, 1);
  dirTitleCell.value = 'បានឃើញ និងឯកភាព';
  dirTitleCell.font = {
    name: FONT_MOUL_LIGHT,
    size: 11,
    color: { argb: BLACK_ARGB },
  };
  dirTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(roleRow2, 1, roleRow2, leftEndCol);
  const dirRoleCell = ws.getCell(roleRow2, 1);
  dirRoleCell.value = 'នាយកសាលា';
  dirRoleCell.font = {
    name: FONT_MOUL_LIGHT,
    size: 11,
    color: { argb: BLACK_ARGB },
  };
  dirRoleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(roleRow1, rightStartCol, roleRow1, lastCol);
  const teacherRoleCell = ws.getCell(roleRow1, rightStartCol);
  teacherRoleCell.value = 'គ្រូប្រចាំថ្នាក់';
  teacherRoleCell.font = {
    name: FONT_SIEMREAP,
    size: 11,
    bold: true,
    color: { argb: BLACK_ARGB },
  };
  teacherRoleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  if (teacherName?.trim()) {
    const teacherNameRow = roleRow2 + 2;
    ws.getRow(roleRow2 + 1).height = 22;
    ws.getRow(teacherNameRow).height = 22;
    ws.mergeCells(teacherNameRow, rightStartCol, teacherNameRow, lastCol);
    const teacherNameCell = ws.getCell(teacherNameRow, rightStartCol);
    teacherNameCell.value = teacherName.trim();
    teacherNameCell.font = {
      name: FONT_SIEMREAP,
      size: 11,
      bold: true,
      color: { argb: BLACK_ARGB },
    };
    teacherNameCell.alignment = { vertical: 'middle', horizontal: 'center' };
  }
}

function buildSkillsWorksheet(
  workbook: ExcelTypes.Workbook,
  params: CompetencyExcelExportParams
) {
  const { student, settings, scores, monthLabel, year, periodLabel } = params;
  const periodDisplay = periodLabel || `ខែ${monthLabel} ${year}`;
  const summary = evaluateCompetencyRubric('skills', scores);
  const scoreText =
    summary.filledCount > 0 ? (summary.score10 ?? 0).toFixed(2) : '..........';

  const ws = workbook.addWorksheet('បំណិនសម្បទា');
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  ws.columns = [
    { width: 6 },
    { width: 54 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
  ];

  // Row 1: Title (Khmer OS Muol Light 12pt)
  ws.mergeCells(1, 1, 1, 7);
  const titleCell = ws.getCell(1, 1);
  titleCell.value =
    'ឧបសម្ព័ន្ធ៣ ៖ ឧបករណ៍វាយតម្លៃពិន្ទុបំណិនសម្បទា(ការអនុវត្តកម្មវិធីក្រៅម៉ោងសិក្សា)';
  titleCell.font = {
    name: FONT_MOUL_LIGHT,
    size: 12,
    color: { argb: BLACK_ARGB },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).height = 30;

  // Row 2: School, Student, Class
  ws.getRow(2).height = 22;
  ws.mergeCells(2, 1, 2, 2);
  const schoolCell = ws.getCell(2, 1);
  schoolCell.value = `សាលារៀន ${settings.schoolName || '....................'}`;
  schoolCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  schoolCell.alignment = { vertical: 'middle', horizontal: 'left' };

  ws.mergeCells(2, 3, 2, 5);
  const studentCell = ws.getCell(2, 3);
  studentCell.value = `ឈ្មោះសិស្ស ${student.name}`;
  studentCell.font = {
    name: FONT_SIEMREAP,
    size: 11,
    bold: true,
    color: { argb: BLACK_ARGB },
  };
  studentCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(2, 6, 2, 7);
  const classCell = ws.getCell(2, 6);
  classCell.value = `ថ្នាក់ទី ${settings.className || '......'}`;
  classCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  classCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // Row 3: Academic Year & Period
  ws.getRow(3).height = 22;
  ws.mergeCells(3, 1, 3, 7);
  const subMetaCell = ws.getCell(3, 1);
  subMetaCell.value = `ឆ្នាំសិក្សា ${settings.academicYear || '............'}     ${periodDisplay}`;
  subMetaCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  subMetaCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.getRow(4).height = 8;

  // Row 5-6: Table Header
  ws.getRow(5).height = 22;
  ws.getRow(6).height = 24;

  ws.mergeCells(5, 1, 6, 1);
  ws.mergeCells(5, 2, 6, 2);
  ws.mergeCells(5, 3, 5, 7);

  ws.getCell(5, 1).value = 'ល.រ';
  ws.getCell(5, 2).value = 'សកម្មភាព';
  ws.getCell(5, 3).value = 'ពិន្ទុ';

  const scoreHeaders = ['មិនមាន=០', 'តិចតួច=១', 'មធ្យម=២', 'បង្គួរ=៣', 'ញឹកញាប់=៤'];
  scoreHeaders.forEach((label, idx) => {
    ws.getCell(6, 3 + idx).value = label;
  });

  for (let r = 5; r <= 6; r++) {
    for (let c = 1; c <= 7; c++) {
      const cell = ws.getCell(r, c);
      cell.font = {
        name: FONT_SIEMREAP,
        size: 11,
        bold: true,
        color: { argb: BLACK_ARGB },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: r === 5 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        bottom: r === 6 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        left: c === 1 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        right: c === 7 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
      };
    }
  }

  // Rows 7..24: 18 Skill Activities
  const dataStartRow = 7;
  SKILL_COMPETENCY_ACTIVITIES.forEach((act, idx) => {
    const r = dataStartRow + idx;
    const val = scores[act.id];
    const hasVal = typeof val === 'number' && !Number.isNaN(val);

    ws.getRow(r).height = estimateRowHeight(act.label, 48, 24, 19);

    const orderCell = ws.getCell(r, 1);
    orderCell.value = act.order;
    orderCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
    orderCell.alignment = { vertical: 'middle', horizontal: 'center' };
    orderCell.border = {
      top: THIN_BLACK_BORDER,
      bottom: THIN_BLACK_BORDER,
      left: MEDIUM_BLACK_BORDER,
      right: THIN_BLACK_BORDER,
    };

    const actCell = ws.getCell(r, 2);
    actCell.value = act.label;
    actCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
    actCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    actCell.border = {
      top: THIN_BLACK_BORDER,
      bottom: THIN_BLACK_BORDER,
      left: THIN_BLACK_BORDER,
      right: THIN_BLACK_BORDER,
    };

    for (let colVal = 0; colVal <= 4; colVal++) {
      const c = 3 + colVal;
      const cell = ws.getCell(r, c);
      cell.value = hasVal && val === colVal ? colVal : '';
      cell.font = {
        name: FONT_SIEMREAP,
        size: 11,
        bold: true,
        color: { argb: BLACK_ARGB },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: THIN_BLACK_BORDER,
        bottom: THIN_BLACK_BORDER,
        left: THIN_BLACK_BORDER,
        right: c === 7 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
      };
    }
  });

  // Note row
  const noteRow = dataStartRow + SKILL_COMPETENCY_ACTIVITIES.length;
  ws.getRow(noteRow).height = 28;
  ws.mergeCells(noteRow, 1, noteRow, 7);
  const noteCell = ws.getCell(noteRow, 1);
  noteCell.value =
    'សកម្មភាពខាងលើ ជាការចូលរួមអនុវត្តរបស់សិស្សម្នាក់ៗ ។ ការផ្តល់ពិន្ទុត្រូវមានភស្តុតាងច្បាស់លាស់។';
  noteCell.font = {
    name: FONT_SIEMREAP,
    size: 11,
    bold: true,
    color: { argb: BLACK_ARGB },
  };
  noteCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  for (let c = 1; c <= 7; c++) {
    ws.getCell(noteRow, c).border = {
      top: THIN_BLACK_BORDER,
      bottom: MEDIUM_BLACK_BORDER,
      left: c === 1 ? MEDIUM_BLACK_BORDER : undefined,
      right: c === 7 ? MEDIUM_BLACK_BORDER : undefined,
    };
  }

  appendSignatureFooter(
    ws,
    noteRow + 1,
    2,
    3,
    7,
    scoreText,
    summary.filledCount,
    summary.gradeLabel,
    settings.teacherName
  );
}

function buildAttitudeWorksheet(
  workbook: ExcelTypes.Workbook,
  params: CompetencyExcelExportParams
) {
  const { student, settings, scores, monthLabel, year, periodLabel } = params;
  const periodDisplay = periodLabel || `ខែ${monthLabel} ${year}`;
  const summary = evaluateCompetencyRubric('attitude', scores);
  const scoreText =
    summary.filledCount > 0 ? (summary.score10 ?? 0).toFixed(2) : '..........';

  const ws = workbook.addWorksheet('ចរិយាសម្បទា');
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '5:5',
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  // 4-column layout: Col A (Indicator), Col B+C merged for Criteria, Col D (Score)
  // Using B+C split also gives balanced Left (A:B) / Right (C:D) columns for the footer & signatures.
  ws.columns = [
    { width: 15 },
    { width: 41 },
    { width: 39 },
    { width: 13 },
  ];

  // Row 1: Title (Khmer OS Muol Light 12pt)
  ws.mergeCells(1, 1, 1, 4);
  const titleCell = ws.getCell(1, 1);
  titleCell.value =
    'ឧបសម្ព័ន្ធ៣ ៖ ឧបករណ៍វាយតម្លៃពិន្ទុចរិយាសម្បទា(ការអនុវត្តកម្មវិធីក្រៅម៉ោងសិក្សា)';
  titleCell.font = {
    name: FONT_MOUL_LIGHT,
    size: 12,
    color: { argb: BLACK_ARGB },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getRow(1).height = 30;

  // Row 2: School, Student, Class
  ws.getRow(2).height = 22;
  ws.mergeCells(2, 1, 2, 2);
  const schoolCell = ws.getCell(2, 1);
  schoolCell.value = `សាលារៀន ${settings.schoolName || '....................'}`;
  schoolCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  schoolCell.alignment = { vertical: 'middle', horizontal: 'left' };

  const studentCell = ws.getCell(2, 3);
  studentCell.value = `ឈ្មោះសិស្ស ${student.name}`;
  studentCell.font = {
    name: FONT_SIEMREAP,
    size: 11,
    bold: true,
    color: { argb: BLACK_ARGB },
  };
  studentCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const classCell = ws.getCell(2, 4);
  classCell.value = `ថ្នាក់ទី ${settings.className || '......'}`;
  classCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  classCell.alignment = { vertical: 'middle', horizontal: 'right' };

  // Row 3: Academic Year & Period
  ws.getRow(3).height = 22;
  ws.mergeCells(3, 1, 3, 4);
  const subMetaCell = ws.getCell(3, 1);
  subMetaCell.value = `ឆ្នាំសិក្សា ${settings.academicYear || '............'}     ${periodDisplay}`;
  subMetaCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
  subMetaCell.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.getRow(4).height = 8;

  // Row 5: Table Header
  ws.getRow(5).height = 26;
  ws.mergeCells(5, 2, 5, 3);
  ws.getCell(5, 1).value = 'សូចនាករ';
  ws.getCell(5, 2).value = 'លក្ខណៈវិនិច្ឆ័យនៃការវាយតម្លៃ';
  ws.getCell(5, 4).value = 'ពិន្ទុ';

  for (let c = 1; c <= 4; c++) {
    const cell = ws.getCell(5, c);
    cell.font = {
      name: FONT_SIEMREAP,
      size: 11,
      bold: true,
      color: { argb: BLACK_ARGB },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: MEDIUM_BLACK_BORDER,
      bottom: MEDIUM_BLACK_BORDER,
      left: c === 1 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
      right: c === 4 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
    };
  }

  let currentRow = 6;

  ATTITUDE_COMPETENCY_SECTIONS.forEach((sec, secIdx) => {
    const isLastSection = secIdx === ATTITUDE_COMPETENCY_SECTIONS.length - 1;
    const secStartRow = currentRow;
    let filledCount = 0;
    let sum = 0;

    sec.items.forEach((item) => {
      const r = currentRow++;
      const labelText = `${item.order}. ${item.label}`;
      ws.getRow(r).height = estimateRowHeight(labelText, 72, 23, 19);

      ws.mergeCells(r, 2, r, 3);
      const critCell = ws.getCell(r, 2);
      critCell.value = labelText;
      critCell.font = { name: FONT_SIEMREAP, size: 11, color: { argb: BLACK_ARGB } };
      critCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const val = scores[item.id];
      const hasVal = typeof val === 'number' && !Number.isNaN(val);
      if (hasVal) {
        filledCount++;
        sum += val;
      }

      const scoreCell = ws.getCell(r, 4);
      scoreCell.value = hasVal ? val : '';
      scoreCell.font = {
        name: FONT_SIEMREAP,
        size: 11,
        bold: true,
        color: { argb: BLACK_ARGB },
      };
      scoreCell.alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 4; c++) {
        ws.getCell(r, c).border = {
          top: THIN_BLACK_BORDER,
          bottom: THIN_BLACK_BORDER,
          left: c === 1 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
          right: c === 4 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        };
      }
    });

    const secEndRow = currentRow - 1;
    if (secEndRow >= secStartRow) {
      ws.mergeCells(secStartRow, 1, secEndRow, 1);
      const indCell = ws.getCell(secStartRow, 1);
      indCell.value = sec.title;
      indCell.font = {
        name: FONT_SIEMREAP,
        size: 11,
        bold: true,
        color: { argb: BLACK_ARGB },
      };
      indCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }

    // Subtotal row
    const subRow = currentRow++;
    ws.getRow(subRow).height = 24;
    ws.mergeCells(subRow, 1, subRow, 3);

    const subLabelCell = ws.getCell(subRow, 1);
    subLabelCell.value = 'ពិន្ទុសរុប=';
    subLabelCell.font = {
      name: FONT_SIEMREAP,
      size: 11,
      bold: true,
      color: { argb: BLACK_ARGB },
    };
    subLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const subValCell = ws.getCell(subRow, 4);
    subValCell.value = filledCount > 0 ? sum : '';
    subValCell.font = {
      name: FONT_SIEMREAP,
      size: 11,
      bold: true,
      color: { argb: BLACK_ARGB },
    };
    subValCell.alignment = { vertical: 'middle', horizontal: 'center' };

    for (let c = 1; c <= 4; c++) {
      const cell = ws.getCell(subRow, c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: SUBTOTAL_FILL_ARGB },
      };
      cell.border = {
        top: THIN_BLACK_BORDER,
        bottom: isLastSection ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        left: c === 1 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
        right: c === 4 ? MEDIUM_BLACK_BORDER : THIN_BLACK_BORDER,
      };
    }
  });

  appendSignatureFooter(
    ws,
    currentRow,
    2,
    3,
    4,
    scoreText,
    summary.filledCount,
    summary.gradeLabel,
    settings.teacherName
  );
}

export async function downloadCompetencyExcel(
  params: CompetencyExcelExportParams
): Promise<void> {
  const WorkbookCtor = getExcelWorkbookConstructor();
  const workbook = new WorkbookCtor();
  workbook.creator = params.settings.teacherName || 'Khmer Classbook';
  workbook.created = new Date();

  if (params.type === 'skills') {
    buildSkillsWorksheet(workbook, params);
  } else {
    buildAttitudeWorksheet(workbook, params);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });

  const formLabel =
    params.type === 'skills' ? 'បំណិនសម្បទា' : 'ចរិយាសម្បទា';
  const studentSlug = sanitizeFilePart(params.student.name || 'student');
  const periodSlug = params.periodFileSlug
    ? sanitizeFilePart(params.periodFileSlug)
    : `ខែ${sanitizeFilePart(params.monthLabel || '')}_${params.year}`;
  const fileName = `${formLabel}_${studentSlug}_${periodSlug}.xlsx`;

  triggerExcelDownload(blob, fileName);
}

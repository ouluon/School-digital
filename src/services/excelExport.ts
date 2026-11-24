import ExcelJS from 'exceljs';
import type * as ExcelTypes from 'exceljs';
import {
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
  ScoreMap,
  SemesterScoresByTerm,
  Student,
  getAttendanceMonthYear,
  getMonthlyScoresMonthYear,
  getVisibleAnnualCompetencySubjects,
  getVisibleMonthlySubjectGroups,
  getVisibleSemesterSubjects,
} from '../types/gradebook';
import {
  colIndexToLetter,
  computeAnnualResults,
  computeCombinedMonthlyResults,
  computeDailyAttendanceSummary,
  computeMonthlyResults,
  computeSemesterResults,
  computeStudentAttendanceSummary,
  getMonthCalendarDays,
} from '../utils/calculations';
import {
  GoogleApiError,
  extractSpreadsheetId,
  getAttendanceTabName,
  getMonthlyTabName,
  getSemesterTabName,
} from './googleSheets';

export type ShareScope = 'attendance' | 'monthly' | 'semester';

export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME_TYPE = 'text/csv';

function getExcelWorkbookConstructor(): typeof ExcelTypes.Workbook {
  const ns = ExcelJS as unknown as {
    Workbook?: typeof ExcelTypes.Workbook;
    default?: { Workbook?: typeof ExcelTypes.Workbook };
  };
  if (ns?.Workbook) return ns.Workbook;
  if (ns?.default?.Workbook) return ns.default.Workbook;
  const globalNs = (globalThis as unknown as { ExcelJS?: { Workbook?: typeof ExcelTypes.Workbook } })
    .ExcelJS;
  if (globalNs?.Workbook) return globalNs.Workbook;
  throw new Error('មិនអាចបើកមុខងារបង្កើត Excel បានទេ។');
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet1';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

export function buildShareFilename(
  scope: ShareScope,
  settings: ClassSettings,
  googleSheetTitle?: string
): string {
  const safeClass = sanitizeFileName(settings.className || 'ថ្នាក់រៀន');

  if (googleSheetTitle) {
    return `${sanitizeFileName(googleSheetTitle)}.xlsx`;
  }

  if (scope === 'attendance') {
    const { month, year } = getAttendanceMonthYear(settings);
    const monthLabel =
      KHMER_MONTHS.find((m) => m.value === month)?.label || `${month}`;
    return `អវត្តមាន_${safeClass}_ខែ${monthLabel}_${year}.xlsx`;
  }
  if (scope === 'monthly') {
    const { month, year } = getMonthlyScoresMonthYear(settings);
    const monthLabel =
      KHMER_MONTHS.find((m) => m.value === month)?.label || `${month}`;
    return `ពិន្ទុ_${safeClass}_ខែ${monthLabel}_${year}.xlsx`;
  }
  const semLabel = settings.semester === 1 ? '១' : '២';
  return `ឆមាសទី${semLabel}_${safeClass}_${sanitizeFileName(settings.academicYear)}.xlsx`;
}

export function buildShareSummaryText(
  scope: ShareScope,
  settings: ClassSettings,
  studentCount: number,
  googleSheetUrl?: string
): string {
  const attPeriod = getAttendanceMonthYear(settings);
  const monPeriod = getMonthlyScoresMonthYear(settings);
  const attMonthLabel =
    KHMER_MONTHS.find((m) => m.value === attPeriod.month)?.label || `${attPeriod.month}`;
  const monMonthLabel =
    KHMER_MONTHS.find((m) => m.value === monPeriod.month)?.label || `${monPeriod.month}`;
  const header =
    scope === 'attendance'
      ? `បញ្ជីអវត្តមានប្រចាំខែ${attMonthLabel} ${attPeriod.year}`
      : scope === 'monthly'
      ? `តារាងពិន្ទុប្រចាំខែ${monMonthLabel} ${monPeriod.year}`
      : `តារាងលទ្ធផលឆមាសទី ${settings.semester === 1 ? '១' : '២'} (${settings.academicYear})`;

  const lines = [
    `${header} — ${settings.className}`,
    `សិស្សសរុប៖ ${studentCount} នាក់`,
  ];
  if (googleSheetUrl) {
    lines.push(`Google Sheet៖ ${googleSheetUrl}`);
  }
  return lines.join('\n');
}

export async function exportGoogleSheetAsExcelBlob(
  token: string,
  spreadsheetId: string
): Promise<Blob> {
  const id = extractSpreadsheetId(spreadsheetId);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    id
  )}/export?mimeType=${encodeURIComponent(EXCEL_MIME_TYPE)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Google Drive Export Error (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {
      if (text) msg = text;
    }
    throw new GoogleApiError(msg, res.status);
  }

  return res.blob();
}

const THIN_BORDER: Partial<ExcelTypes.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function appendAttendanceWorksheet(
  workbook: ExcelTypes.Workbook,
  settings: ClassSettings,
  students: Student[],
  attendance: AttendanceMap,
  remarks: RemarksMap
) {
  const { month: attMonth, year: attYear } = getAttendanceMonthYear(settings);
  const monthLabel =
    KHMER_MONTHS.find((m) => m.value === attMonth)?.label || `${attMonth}`;
  const days = getMonthCalendarDays(attYear, attMonth);
  const daysCount = days.length;

  const ws = workbook.addWorksheet(
    sanitizeSheetName(getAttendanceTabName(attMonth))
  );

  // Column A (col 1) and Rows 1..6 remain blank; Title on Row 7, Row 8 blank, Table headers on Rows 9..10
  const baseColStart = 2; // Column B
  const dayColStart = baseColStart + 4; // Column F
  const spacerCol = dayColStart + daysCount;
  const excusedCol = spacerCol + 1;
  const unexcusedCol = spacerCol + 2;
  const totalAbsentCol = spacerCol + 3;
  const remarkCol = spacerCol + 4;

  // Row 7: Title Row (Columns B..remarkCol)
  ws.mergeCells(7, baseColStart, 7, remarkCol);
  const titleCell = ws.getCell(7, baseColStart);
  titleCell.value = `${settings.schoolName} · ${settings.className} — បញ្ជីអវត្តមានប្រចាំខែ${monthLabel} ឆ្នាំ ${attYear} (ឆ្នាំសិក្សា ${settings.academicYear})`;
  titleCell.font = { name: 'Khmer OS Siemreap', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(7).height = 28;

  // Row 8 remains blank; Header Rows on Row 9 & Row 10
  const headerRow1 = 9;
  const headerRow2 = 10;

  const baseHeaders = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ'];
  baseHeaders.forEach((h, i) => {
    const col = baseColStart + i;
    ws.mergeCells(headerRow1, col, headerRow2, col);
    const cell = ws.getCell(headerRow1, col);
    cell.value = h;
    cell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws.getCell(headerRow1, col).border = THIN_BORDER;
    ws.getCell(headerRow2, col).border = THIN_BORDER;
  });

  days.forEach((d, i) => {
    const col = dayColStart + i;
    const dayCell = ws.getCell(headerRow1, col);
    const wdCell = ws.getCell(headerRow2, col);
    dayCell.value = d.day;
    wdCell.value = d.khmerDay;

    if (d.isSunday) {
      dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      wdCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      dayCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      wdCell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    } else {
      dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      wdCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      dayCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      wdCell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF334155' } };
    }
    dayCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wdCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dayCell.border = THIN_BORDER;
    wdCell.border = THIN_BORDER;
  });

  // Spacer header
  ws.mergeCells(headerRow1, spacerCol, headerRow2, spacerCol);
  ws.getCell(headerRow1, spacerCol).border = THIN_BORDER;
  ws.getCell(headerRow2, spacerCol).border = THIN_BORDER;

  // ចំនួនអវត្តមាន merged header
  ws.mergeCells(headerRow1, excusedCol, headerRow1, totalAbsentCol);
  const absGroupCell = ws.getCell(headerRow1, excusedCol);
  absGroupCell.value = 'ចំនួនអវត្តមាន';
  absGroupCell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  absGroupCell.alignment = { vertical: 'middle', horizontal: 'center' };
  absGroupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  [excusedCol, unexcusedCol, totalAbsentCol].forEach((c) => {
    ws.getCell(headerRow1, c).border = THIN_BORDER;
  });

  const subAbsLabels = ['ច្ប', 'អច្ប', 'សរុប'];
  subAbsLabels.forEach((lbl, idx) => {
    const cell = ws.getCell(headerRow2, excusedCol + idx);
    cell.value = lbl;
    cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = THIN_BORDER;
  });

  ws.mergeCells(headerRow1, remarkCol, headerRow2, remarkCol);
  const remHeader = ws.getCell(headerRow1, remarkCol);
  remHeader.value = 'ផ្សេងៗ';
  remHeader.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  remHeader.alignment = { vertical: 'middle', horizontal: 'center' };
  remHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getCell(headerRow1, remarkCol).border = THIN_BORDER;
  ws.getCell(headerRow2, remarkCol).border = THIN_BORDER;

  ws.getRow(headerRow1).height = 22;
  ws.getRow(headerRow2).height = 22;

  const firstDayLetter = colIndexToLetter(dayColStart - 1); // F (0-indexed 5)
  const lastDayLetter = colIndexToLetter(dayColStart + daysCount - 2);
  const excusedLetter = colIndexToLetter(excusedCol - 1);
  const unexcusedLetter = colIndexToLetter(unexcusedCol - 1);

  const startRow = 11;
  students.forEach((stu, idx) => {
    const r = startRow + idx;
    const row = ws.getRow(r);
    row.height = 21;

    row.getCell(baseColStart).value = idx + 1;
    row.getCell(baseColStart + 1).value = stu.studentCode || '';
    row.getCell(baseColStart + 2).value = stu.name;
    row.getCell(baseColStart + 3).value = stu.gender;

    [baseColStart, baseColStart + 1, baseColStart + 3].forEach((c) => {
      row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(c).font = { name: 'Khmer OS Siemreap', size: 10 };
      row.getCell(c).border = THIN_BORDER;
    });
    row.getCell(baseColStart + 2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(baseColStart + 2).font = { name: 'Khmer OS Siemreap', size: 10 };
    row.getCell(baseColStart + 2).border = THIN_BORDER;

    const stuAtt = attendance[stu.id] || {};
    days.forEach((d, dIdx) => {
      const cell = row.getCell(dayColStart + dIdx);
      const mark = stuAtt[d.day] || '';
      cell.value = mark;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
      if (d.isSunday) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.font = {
          name: 'Khmer OS Siemreap',
          size: 9,
          bold: Boolean(mark),
          color: {
            argb:
              mark === 'អច្ប'
                ? 'FFBE123C'
                : mark === 'ច្ប' || mark === 'ឈ'
                ? 'FFB45309'
                : 'FF0F172A',
          },
        };
      }
    });

    row.getCell(spacerCol).border = THIN_BORDER;

    const summary = computeStudentAttendanceSummary(stu.id, attendance, daysCount);
    const dayRange = `${firstDayLetter}${r}:${lastDayLetter}${r}`;

    const excusedCell = row.getCell(excusedCol);
    excusedCell.value = {
      formula: `COUNTIF(${dayRange},"ច្ប")+COUNTIF(${dayRange},"ឈ")`,
      result: summary.excused,
    };
    excusedCell.alignment = { vertical: 'middle', horizontal: 'center' };
    excusedCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB45309' } };
    excusedCell.border = THIN_BORDER;

    const unexcusedCell = row.getCell(unexcusedCol);
    unexcusedCell.value = {
      formula: `COUNTIF(${dayRange},"អច្ប")`,
      result: summary.unexcused,
    };
    unexcusedCell.alignment = { vertical: 'middle', horizontal: 'center' };
    unexcusedCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFBE123C' } };
    unexcusedCell.border = THIN_BORDER;

    const totalCell = row.getCell(totalAbsentCol);
    totalCell.value = {
      formula: `${excusedLetter}${r}+${unexcusedLetter}${r}`,
      result: summary.totalAbsent,
    };
    totalCell.alignment = { vertical: 'middle', horizontal: 'center' };
    totalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totalCell.border = THIN_BORDER;

    const remCell = row.getCell(remarkCol);
    remCell.value = remarks[stu.id] || '';
    remCell.alignment = { vertical: 'middle', horizontal: 'left' };
    remCell.font = { name: 'Khmer OS Siemreap', size: 9 };
    remCell.border = THIN_BORDER;
  });

  // Bottom Summary Row
  const summaryRowIdx = startRow + students.length;
  const endRow = Math.max(startRow, summaryRowIdx - 1);
  ws.mergeCells(summaryRowIdx, baseColStart, summaryRowIdx, baseColStart + 3);
  const sumLabelCell = ws.getCell(summaryRowIdx, baseColStart);
  sumLabelCell.value = 'ចំនួនសិស្សមករៀនប្រចាំថ្ងៃ';
  sumLabelCell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  sumLabelCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sumLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  [baseColStart, baseColStart + 1, baseColStart + 2, baseColStart + 3].forEach((c) => {
    ws.getCell(summaryRowIdx, c).border = THIN_BORDER;
  });

  days.forEach((d, dIdx) => {
    const col = dayColStart + dIdx;
    const colLetter = colIndexToLetter(col - 1);
    const daily = computeDailyAttendanceSummary(students, attendance, d.day);
    const cell = ws.getCell(summaryRowIdx, col);
    cell.value = {
      formula: `${students.length}-COUNTIF(${colLetter}${startRow}:${colLetter}${endRow},"ច្ប")-COUNTIF(${colLetter}${startRow}:${colLetter}${endRow},"ឈ")-COUNTIF(${colLetter}${startRow}:${colLetter}${endRow},"អច្ប")`,
      result: daily.present,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
    if (d.isSunday) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    }
  });
  ws.getRow(summaryRowIdx).height = 22;

  // Column widths (Col 1 / A left blank)
  ws.getColumn(1).width = 4;
  ws.getColumn(baseColStart).width = 5;
  ws.getColumn(baseColStart + 1).width = 11;
  ws.getColumn(baseColStart + 2).width = 24;
  ws.getColumn(baseColStart + 3).width = 7;
  for (let i = 0; i < daysCount; i++) {
    ws.getColumn(dayColStart + i).width = 4.2;
  }
  ws.getColumn(spacerCol).width = 2.5;
  ws.getColumn(excusedCol).width = 6;
  ws.getColumn(unexcusedCol).width = 6;
  ws.getColumn(totalAbsentCol).width = 7;
  ws.getColumn(remarkCol).width = 18;
}

function appendMonthlyWorksheet(
  workbook: ExcelTypes.Workbook,
  settings: ClassSettings,
  students: Student[],
  monthlyScores: ScoreMap,
  remarks: RemarksMap
) {
  const { month: monMonth, year: monYear } = getMonthlyScoresMonthYear(settings);
  const monthLabel =
    KHMER_MONTHS.find((m) => m.value === monMonth)?.label || `${monMonth}`;
  const visibleGroups = getVisibleMonthlySubjectGroups(
    settings,
    monthlyScores,
    students
  );
  const visibleSubjects = visibleGroups.flatMap((g) => g.subjects);
  const subCount = visibleSubjects.length;
  const totalCols = 4 + subCount + 5; // 4 base + visible subjects + 4 results + 1 remark

  const ws = workbook.addWorksheet(
    sanitizeSheetName(getMonthlyTabName(monMonth))
  );

  // Rows 1..4 remain blank; Title on Row 5, Row 6 blank, Table headers on Rows 7..8
  const titleRow = 5;
  const headerRow1 = 7;
  const headerRow2 = 8;

  // Row 5: Title Row
  ws.mergeCells(titleRow, 1, titleRow, totalCols);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = `${settings.schoolName} · ${settings.className} — តារាងពិន្ទុប្រចាំខែ${monthLabel} ឆ្នាំ ${monYear} (ពិន្ទុអតិបរមា ${settings.maxScore})`;
  titleCell.font = { name: 'Khmer OS Siemreap', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(titleRow).height = 28;

  const baseHeaders = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ'];
  baseHeaders.forEach((h, i) => {
    const col = i + 1;
    ws.mergeCells(headerRow1, col, headerRow2, col);
    const cell = ws.getCell(headerRow1, col);
    cell.value = h;
    cell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws.getCell(headerRow1, col).border = THIN_BORDER;
    ws.getCell(headerRow2, col).border = THIN_BORDER;
  });

  let curCol = 5;
  visibleGroups.forEach((grp) => {
    if (grp.standalone) {
      ws.mergeCells(headerRow1, curCol, headerRow2, curCol);
      const c = ws.getCell(headerRow1, curCol);
      c.value = grp.subjects[0]?.label || grp.label;
      c.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
      c.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      ws.getCell(headerRow1, curCol).border = THIN_BORDER;
      ws.getCell(headerRow2, curCol).border = THIN_BORDER;
      curCol++;
    } else {
      const startC = curCol;
      const endC = curCol + grp.subjects.length - 1;
      if (endC > startC) {
        ws.mergeCells(headerRow1, startC, headerRow1, endC);
      }
      const grpCell = ws.getCell(headerRow1, startC);
      grpCell.value = grp.label;
      grpCell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
      grpCell.alignment = { vertical: 'middle', horizontal: 'center' };
      grpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      grp.subjects.forEach((sub, idx) => {
        const col = startC + idx;
        ws.getCell(headerRow1, col).border = THIN_BORDER;
        const subCell = ws.getCell(headerRow2, col);
        subCell.value = sub.label;
        subCell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
        subCell.alignment = {
          textRotation: 90,
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        subCell.border = THIN_BORDER;
      });
      curCol = endC + 1;
    }
  });

  // Results Group
  const resStartCol = curCol;
  const resEndCol = curCol + 3;
  ws.mergeCells(headerRow1, resStartCol, headerRow1, resEndCol);
  const resGrp = ws.getCell(headerRow1, resStartCol);
  resGrp.value = 'លទ្ធផលប្រចាំខែ';
  resGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  resGrp.alignment = { vertical: 'middle', horizontal: 'center' };
  resGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

  const resHeaders = ['ពិន្ទុសរុប', 'មធ្យមភាគ', 'ចំណាត់ថ្នាក់', 'និទ្ទេស'];
  resHeaders.forEach((h, idx) => {
    const col = resStartCol + idx;
    ws.getCell(headerRow1, col).border = THIN_BORDER;
    const cell = ws.getCell(headerRow2, col);
    cell.value = h;
    cell.font = {
      name: 'Khmer OS Siemreap',
      size: 9,
      bold: true,
      color: { argb: idx === 3 ? 'FFDC2626' : 'FF0F172A' },
    };
    cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = THIN_BORDER;
  });

  const remarkCol = resEndCol + 1;
  ws.mergeCells(headerRow1, remarkCol, headerRow2, remarkCol);
  const remHeader = ws.getCell(headerRow1, remarkCol);
  remHeader.value = 'សេចក្តីផ្សេងៗ';
  remHeader.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  remHeader.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  remHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getCell(headerRow1, remarkCol).border = THIN_BORDER;
  ws.getCell(headerRow2, remarkCol).border = THIN_BORDER;

  ws.getRow(headerRow1).height = 24;
  ws.getRow(headerRow2).height = 76;

  const results = computeMonthlyResults(students, monthlyScores, settings.maxScore);
  const academicCount = visibleSubjects.filter(
    (s) => !COMPETENCY_SUBJECT_KEYS.has(s.key)
  ).length;
  const firstSubLetter = colIndexToLetter(4); // E
  const lastAcademicLetter =
    academicCount > 0 ? colIndexToLetter(4 + academicCount - 1) : '';
  const knowledgeIdx = visibleSubjects.findIndex((s) => s.key === 'comp_knowledge');
  const skillsIdx = visibleSubjects.findIndex((s) => s.key === 'comp_skills');
  const attitudeIdx = visibleSubjects.findIndex((s) => s.key === 'comp_attitude');
  const knowledgeLetter =
    knowledgeIdx >= 0 ? colIndexToLetter(4 + knowledgeIdx) : '';
  const skillsLetter = skillsIdx >= 0 ? colIndexToLetter(4 + skillsIdx) : '';
  const attitudeLetter =
    attitudeIdx >= 0 ? colIndexToLetter(4 + attitudeIdx) : '';
  const avgLetter = colIndexToLetter(resStartCol); // 0-indexed index of (resStartCol + 1)
  const compScale = settings.maxScore === 100 ? '*10' : '';
  const totalRowsCount = Math.max(students.length, 1);
  const startRow = 9;
  const endRow = startRow + totalRowsCount - 1;

  students.forEach((stu, idx) => {
    const r = startRow + idx;
    const row = ws.getRow(r);
    row.height = 21;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = stu.studentCode || '';
    row.getCell(3).value = stu.name;
    row.getCell(4).value = stu.gender;

    [1, 2, 4].forEach((c) => {
      row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(c).font = { name: 'Khmer OS Siemreap', size: 10 };
      row.getCell(c).border = THIN_BORDER;
    });
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).font = { name: 'Khmer OS Siemreap', size: 10 };
    row.getCell(3).border = THIN_BORDER;

    const stuScores = monthlyScores[stu.id] || {};
    visibleSubjects.forEach((sub, sIdx) => {
      const cell = row.getCell(5 + sIdx);
      const val = stuScores[sub.key];
      if (sub.key === 'comp_knowledge') {
        cell.value = val === 80 ? '80%' : null;
      } else if (sub.key === 'comp_skills' || sub.key === 'comp_attitude') {
        cell.value = typeof val === 'number' && !Number.isNaN(val) ? Number(val.toFixed(2)) : null;
        cell.numFmt = '0.00';
      } else {
        cell.value = typeof val === 'number' && !Number.isNaN(val) ? val : null;
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Arial', size: 10 };
      cell.border = THIN_BORDER;
    });

    const stuRes = results[stu.id];
    const academicRange =
      academicCount > 0 ? `${firstSubLetter}${r}:${lastAcademicLetter}${r}` : '';

    const totalCell = row.getCell(resStartCol);
    totalCell.value = academicRange
      ? {
          formula: `IF(COUNT(${academicRange})=0,0,SUM(${academicRange}))`,
          result: Number(stuRes.total.toFixed(2)),
        }
      : Number(stuRes.total.toFixed(2));
    totalCell.alignment = { vertical: 'middle', horizontal: 'center' };
    totalCell.font = { name: 'Arial', size: 10, bold: true };
    totalCell.numFmt = '0.0';
    totalCell.border = THIN_BORDER;

    const academicAvgExpr = academicRange
      ? `IF(COUNT(${academicRange})=0,0,AVERAGE(${academicRange}))`
      : '0';
    const bonusParts: string[] = [];
    if (skillsLetter) bonusParts.push(`N(${skillsLetter}${r})${compScale}`);
    if (attitudeLetter) bonusParts.push(`N(${attitudeLetter}${r})${compScale}`);
    const bonusExpr = bonusParts.length > 0 ? bonusParts.join('+') : '0';
    const avgFormula = knowledgeLetter
      ? `MIN(${settings.maxScore},IF(${knowledgeLetter}${r}="80%",(${academicAvgExpr})*0.8+${bonusExpr},(${academicAvgExpr})+${bonusExpr}))`
      : `MIN(${settings.maxScore},(${academicAvgExpr})+${bonusExpr})`;

    const avgCell = row.getCell(resStartCol + 1);
    avgCell.value = {
      formula: avgFormula,
      result: Number(stuRes.average.toFixed(2)),
    };
    avgCell.alignment = { vertical: 'middle', horizontal: 'center' };
    avgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
    avgCell.numFmt = '0.00';
    avgCell.border = THIN_BORDER;

    const rankCell = row.getCell(resStartCol + 2);
    rankCell.value = {
      formula: `RANK(${avgLetter}${r},$${avgLetter}$${startRow}:$${avgLetter}$${endRow},0)`,
      result: stuRes.rank,
    };
    rankCell.alignment = { vertical: 'middle', horizontal: 'center' };
    rankCell.font = { name: 'Arial', size: 10, bold: true };
    rankCell.border = THIN_BORDER;

    const gradeCell = row.getCell(resStartCol + 3);
    const scaleDiv = settings.maxScore === 100 ? '/10' : '';
    gradeCell.value = {
      formula: `IF(${avgLetter}${r}${scaleDiv}>=9,"A",IF(${avgLetter}${r}${scaleDiv}>=8,"B",IF(${avgLetter}${r}${scaleDiv}>=7,"C",IF(${avgLetter}${r}${scaleDiv}>=6,"D",IF(${avgLetter}${r}${scaleDiv}>=5,"E","F")))))`,
      result: stuRes.grade,
    };
    gradeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    gradeCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: stuRes.grade === 'F' ? 'FFDC2626' : 'FF047857' },
    };
    gradeCell.border = THIN_BORDER;

    const remCell = row.getCell(remarkCol);
    remCell.value = remarks[stu.id] || '';
    remCell.alignment = { vertical: 'middle', horizontal: 'left' };
    remCell.font = { name: 'Khmer OS Siemreap', size: 9 };
    remCell.border = THIN_BORDER;
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 7;
  for (let i = 0; i < subCount; i++) {
    ws.getColumn(5 + i).width = 6;
  }
  for (let i = 0; i < 4; i++) {
    ws.getColumn(resStartCol + i).width = 8.5;
  }
  ws.getColumn(remarkCol).width = 18;
}

function appendSemesterWorksheet(
  workbook: ExcelTypes.Workbook,
  settings: ClassSettings,
  students: Student[],
  monthlyScoresByMonth: MonthlyScoresByMonth,
  semesterScores: ScoreMap,
  domainGrades: DomainGradeMap,
  remarks: RemarksMap,
  semesterScoresByTerm?: SemesterScoresByTerm,
  domainGradesByTerm?: DomainGradesByTerm
) {
  const isSem2 = settings.semester === 2;
  const semText = isSem2 ? '២' : '១';
  const {
    examSubjects: visibleExamSubjects,
    competencySubjects: visibleCompSubjects,
  } = getVisibleSemesterSubjects(settings, semesterScores, students);
  const annualScoresMap = semesterScoresByTerm?.['annual'] || {};
  const visibleAnnualCompSubjects = isSem2
    ? getVisibleAnnualCompetencySubjects(settings, annualScoresMap, students)
    : [];
  const examCount = visibleExamSubjects.length;
  const compCount = visibleCompSubjects.length;
  const domCount = DOMAIN_GRADES.length; // 4
  const annCompCount = isSem2 ? visibleAnnualCompSubjects.length : 0;
  const annResCount = isSem2 ? 3 : 0;
  const annDomCount = isSem2 ? domCount : 0;
  const annualCount = annCompCount + annResCount + annDomCount;
  const semSectionCount = examCount + compCount + 5 + domCount;
  const totalCols = 4 + semSectionCount + annualCount + 1;

  const ws = workbook.addWorksheet(
    sanitizeSheetName(getSemesterTabName(settings.semester))
  );

  // Rows 1..5 remain blank; Title on Row 6, Row 7 blank
  // Sem 1: Table headers on Rows 8..9, data starts at Row 10
  // Sem 2: Table headers on Rows 8..10 (3-row header with ប្រចាំឆ្នាំ), data starts at Row 11
  const titleRow = 6;
  const headerRow1 = 8;
  const headerRow2 = isSem2 ? 9 : 8;
  const leafHeaderRow = isSem2 ? 10 : 9;

  // Row 6: Title Row
  ws.mergeCells(titleRow, 1, titleRow, totalCols);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = isSem2
    ? `${settings.schoolName} · ${settings.className} — តារាងលទ្ធផលប្រចាំឆមាសទី ២ និងប្រចាំឆ្នាំ ឆ្នាំសិក្សា ${settings.academicYear}`
    : `${settings.schoolName} · ${settings.className} — តារាងលទ្ធផលប្រចាំឆមាសទី ${semText} ឆ្នាំសិក្សា ${settings.academicYear}`;
  titleCell.font = { name: 'Khmer OS Siemreap', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(titleRow).height = 28;

  const baseHeaders = ['ល.រ', 'អត្តលេខ', 'គោត្តនាម និងនាម', 'ភេទ'];
  baseHeaders.forEach((h, i) => {
    const col = i + 1;
    ws.mergeCells(headerRow1, col, leafHeaderRow, col);
    const cell = ws.getCell(headerRow1, col);
    cell.value = h;
    cell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    for (let hr = headerRow1; hr <= leafHeaderRow; hr++) {
      ws.getCell(hr, col).border = THIN_BORDER;
    }
  });

  const examStartCol = 5;
  const examEndCol = examStartCol + examCount - 1;
  const compStartCol = examStartCol + examCount;
  const compEndCol = compStartCol + compCount - 1;
  const resStartCol = compStartCol + compCount;
  const resEndCol = resStartCol + 4;
  const domStartCol = resEndCol + 1;
  const domEndCol = domStartCol + domCount - 1;

  if (isSem2) {
    // Super header row (Row 8): ឆមាសទី ២
    if (domEndCol >= examStartCol) {
      ws.mergeCells(headerRow1, examStartCol, headerRow1, domEndCol);
    }
    const semSuperCell = ws.getCell(headerRow1, examStartCol);
    semSuperCell.value = 'ឆមាសទី ២';
    semSuperCell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true };
    semSuperCell.alignment = { vertical: 'middle', horizontal: 'center' };
    semSuperCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    for (let c = examStartCol; c <= domEndCol; c++) {
      ws.getCell(headerRow1, c).border = THIN_BORDER;
    }
  }

  // Exam subjects group
  if (examCount > 0) {
    if (examEndCol > examStartCol) {
      ws.mergeCells(headerRow2, examStartCol, headerRow2, examEndCol);
    }
    const examGrp = ws.getCell(headerRow2, examStartCol);
    examGrp.value = 'មុខវិជ្ជាប្រឡងឆមាស';
    examGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    examGrp.alignment = { vertical: 'middle', horizontal: 'center' };
    examGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    visibleExamSubjects.forEach((sub, idx) => {
      const col = examStartCol + idx;
      ws.getCell(headerRow2, col).border = THIN_BORDER;
      const cell = ws.getCell(leafHeaderRow, col);
      cell.value = sub.label;
      cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
      cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: sub.highlight ? 'FFD9D2E9' : 'FFF8FAFC' },
      };
      cell.border = THIN_BORDER;
    });
  }

  // Three competencies group (សម្បទាទាំង៣)
  if (compCount > 0) {
    if (compEndCol > compStartCol) {
      ws.mergeCells(headerRow2, compStartCol, headerRow2, compEndCol);
    }
    const compGrp = ws.getCell(headerRow2, compStartCol);
    compGrp.value = 'សម្បទាទាំង៣';
    compGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    compGrp.alignment = { vertical: 'middle', horizontal: 'center' };
    compGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

    visibleCompSubjects.forEach((sub, idx) => {
      const col = compStartCol + idx;
      ws.getCell(headerRow2, col).border = THIN_BORDER;
      const cell = ws.getCell(leafHeaderRow, col);
      cell.value = sub.label;
      cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
      cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = THIN_BORDER;
    });
  }

  // Semester result group
  ws.mergeCells(headerRow2, resStartCol, headerRow2, resEndCol);
  const resGrp = ws.getCell(headerRow2, resStartCol);
  resGrp.value = 'លទ្ធផលប្រចាំឆមាស';
  resGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  resGrp.alignment = { vertical: 'middle', horizontal: 'center' };
  resGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

  const resHeaders = [
    'ម. ប្រឡងឆមាស',
    'ម. ប្រចាំខែ',
    'ម. ប្រចាំឆមាស',
    'ចំណាត់ថ្នាក់',
    'និទ្ទេស',
  ];
  resHeaders.forEach((h, idx) => {
    const col = resStartCol + idx;
    ws.getCell(headerRow2, col).border = THIN_BORDER;
    const cell = ws.getCell(leafHeaderRow, col);
    cell.value = h;
    cell.font = {
      name: 'Khmer OS Siemreap',
      size: 9,
      bold: true,
      color: { argb: idx === 4 ? 'FFDC2626' : 'FF0F172A' },
    };
    cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = THIN_BORDER;
  });

  // Semester domain grades group
  ws.mergeCells(headerRow2, domStartCol, headerRow2, domEndCol);
  const domGrp = ws.getCell(headerRow2, domStartCol);
  domGrp.value = 'និទ្ទេសតាមផ្នែក';
  domGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  domGrp.alignment = { vertical: 'middle', horizontal: 'center' };
  domGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  DOMAIN_GRADES.forEach((dom, idx) => {
    const col = domStartCol + idx;
    ws.getCell(headerRow2, col).border = THIN_BORDER;
    const cell = ws.getCell(leafHeaderRow, col);
    cell.value = dom.label;
    cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
    cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = THIN_BORDER;
  });

  // Annual (ប្រចាំឆ្នាំ) block for Semester 2
  const annStartCol = domEndCol + 1;
  const annCompStartCol = annStartCol;
  const annCompEndCol = annCompStartCol + annCompCount - 1;
  const annResStartCol = annCompStartCol + annCompCount;
  const annResEndCol = annResStartCol + annResCount - 1;
  const annDomStartCol = annResStartCol + annResCount;
  const annDomEndCol = annDomStartCol + annDomCount - 1;

  if (isSem2) {
    ws.mergeCells(headerRow1, annStartCol, headerRow1, annDomEndCol);
    const annSuperCell = ws.getCell(headerRow1, annStartCol);
    annSuperCell.value = 'ប្រចាំឆ្នាំ';
    annSuperCell.font = { name: 'Khmer OS Siemreap', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    annSuperCell.alignment = { vertical: 'middle', horizontal: 'center' };
    annSuperCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    for (let c = annStartCol; c <= annDomEndCol; c++) {
      ws.getCell(headerRow1, c).border = THIN_BORDER;
    }

    // Annual សម្បទាទាំង៣
    if (annCompCount > 0) {
      if (annCompEndCol > annCompStartCol) {
        ws.mergeCells(headerRow2, annCompStartCol, headerRow2, annCompEndCol);
      }
      const annCompGrp = ws.getCell(headerRow2, annCompStartCol);
      annCompGrp.value = 'សម្បទាទាំង៣';
      annCompGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
      annCompGrp.alignment = { vertical: 'middle', horizontal: 'center' };
      annCompGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      visibleAnnualCompSubjects.forEach((sub, idx) => {
        const col = annCompStartCol + idx;
        ws.getCell(headerRow2, col).border = THIN_BORDER;
        const cell = ws.getCell(leafHeaderRow, col);
        cell.value = sub.label;
        cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
        cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.border = THIN_BORDER;
      });
    }

    // Annual លទ្ធផល
    ws.mergeCells(headerRow2, annResStartCol, headerRow2, annResEndCol);
    const annResGrp = ws.getCell(headerRow2, annResStartCol);
    annResGrp.value = 'លទ្ធផល';
    annResGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    annResGrp.alignment = { vertical: 'middle', horizontal: 'center' };
    annResGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    ['មធ្យមភាគ', 'ចំណាត់ថ្នាក់', 'និទ្ទេស'].forEach((label, idx) => {
      const col = annResStartCol + idx;
      ws.getCell(headerRow2, col).border = THIN_BORDER;
      const cell = ws.getCell(leafHeaderRow, col);
      cell.value = label;
      cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
      cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = THIN_BORDER;
    });

    // Annual និទ្ទេសតាមផ្នែក
    ws.mergeCells(headerRow2, annDomStartCol, headerRow2, annDomEndCol);
    const annDomGrp = ws.getCell(headerRow2, annDomStartCol);
    annDomGrp.value = 'និទ្ទេសតាមផ្នែក';
    annDomGrp.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
    annDomGrp.alignment = { vertical: 'middle', horizontal: 'center' };
    annDomGrp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

    DOMAIN_GRADES.forEach((dom, idx) => {
      const col = annDomStartCol + idx;
      ws.getCell(headerRow2, col).border = THIN_BORDER;
      const cell = ws.getCell(leafHeaderRow, col);
      cell.value = dom.label;
      cell.font = { name: 'Khmer OS Siemreap', size: 9, bold: true };
      cell.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = THIN_BORDER;
    });
  }

  // Remarks column always at the very back
  const remarkCol = (isSem2 ? annDomEndCol : domEndCol) + 1;
  ws.mergeCells(headerRow1, remarkCol, leafHeaderRow, remarkCol);
  const remHeader = ws.getCell(headerRow1, remarkCol);
  remHeader.value = 'សេចក្តីផ្សេងៗ';
  remHeader.font = { name: 'Khmer OS Siemreap', size: 10, bold: true };
  remHeader.alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center', wrapText: true };
  remHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  for (let hr = headerRow1; hr <= leafHeaderRow; hr++) {
    ws.getCell(hr, remarkCol).border = THIN_BORDER;
  }

  if (isSem2) {
    ws.getRow(headerRow1).height = 24;
    ws.getRow(headerRow2).height = 24;
    ws.getRow(leafHeaderRow).height = 82;
  } else {
    ws.getRow(headerRow1).height = 24;
    ws.getRow(leafHeaderRow).height = 78;
  }

  const selectedMonths =
    settings.semester === 1 ? settings.semester1Months : settings.semester2Months;
  const { results: combinedMonthly } = computeCombinedMonthlyResults(
    students,
    monthlyScoresByMonth,
    settings.academicYear,
    settings.year,
    selectedMonths,
    settings.maxScore
  );
  const semesterResults = computeSemesterResults(
    students,
    semesterScores,
    combinedMonthly,
    settings.maxScore
  );

  // Semester 1 & Annual calculations when exporting Semester 2
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
    semesterScoresByTerm?.['1'] || {},
    sem1CombinedMonthly,
    settings.maxScore
  );
  const annualScores = semesterScoresByTerm?.['annual'] || {};
  const annualDomains = domainGradesByTerm?.['annual'] || {};
  const annualResults = computeAnnualResults(
    students,
    sem1Results,
    semesterResults,
    annualScores,
    settings.maxScore
  );

  const firstExamLetter = examCount > 0 ? colIndexToLetter(examStartCol - 1) : '';
  const lastExamLetter = examCount > 0 ? colIndexToLetter(examEndCol - 1) : '';
  const knowledgeIdx = visibleCompSubjects.findIndex((s) => s.key === 'comp_knowledge');
  const skillsIdx = visibleCompSubjects.findIndex((s) => s.key === 'comp_skills');
  const attitudeIdx = visibleCompSubjects.findIndex((s) => s.key === 'comp_attitude');
  const knowledgeLetter =
    knowledgeIdx >= 0 ? colIndexToLetter(compStartCol - 1 + knowledgeIdx) : '';
  const skillsLetter =
    skillsIdx >= 0 ? colIndexToLetter(compStartCol - 1 + skillsIdx) : '';
  const attitudeLetter =
    attitudeIdx >= 0 ? colIndexToLetter(compStartCol - 1 + attitudeIdx) : '';
  const compScale = settings.maxScore === 100 ? '*10' : '';
  const examAvgLetter = colIndexToLetter(resStartCol - 1);
  const monthAvgLetter = colIndexToLetter(resStartCol);
  const semAvgLetter = colIndexToLetter(resStartCol + 1);

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
      ? colIndexToLetter(annCompStartCol - 1 + annKnowledgeIdx)
      : '';
  const annSkillsLetter =
    isSem2 && annSkillsIdx >= 0
      ? colIndexToLetter(annCompStartCol - 1 + annSkillsIdx)
      : '';
  const annAttitudeLetter =
    isSem2 && annAttitudeIdx >= 0
      ? colIndexToLetter(annCompStartCol - 1 + annAttitudeIdx)
      : '';
  const annAvgLetter = isSem2 ? colIndexToLetter(annResStartCol - 1) : '';

  const totalRowsCount = Math.max(students.length, 1);
  const startRow = leafHeaderRow + 1;
  const endRow = startRow + totalRowsCount - 1;
  const scaleDiv = settings.maxScore === 100 ? '/10' : '';

  students.forEach((stu, idx) => {
    const r = startRow + idx;
    const row = ws.getRow(r);
    row.height = 21;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = stu.studentCode || '';
    row.getCell(3).value = stu.name;
    row.getCell(4).value = stu.gender;

    [1, 2, 4].forEach((c) => {
      row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(c).font = { name: 'Khmer OS Siemreap', size: 10 };
      row.getCell(c).border = THIN_BORDER;
    });
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).font = { name: 'Khmer OS Siemreap', size: 10 };
    row.getCell(3).border = THIN_BORDER;

    const stuScores = semesterScores[stu.id] || {};
    visibleExamSubjects.forEach((sub, sIdx) => {
      const cell = row.getCell(examStartCol + sIdx);
      const val = stuScores[sub.key];
      cell.value = typeof val === 'number' && !Number.isNaN(val) ? val : null;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Arial', size: 10 };
      if (sub.highlight) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
      }
      cell.border = THIN_BORDER;
    });

    visibleCompSubjects.forEach((sub, cIdx) => {
      const cell = row.getCell(compStartCol + cIdx);
      const val = stuScores[sub.key];
      if (sub.key === 'comp_knowledge') {
        cell.value = val === 80 ? '80%' : null;
      } else {
        cell.value =
          typeof val === 'number' && !Number.isNaN(val) ? Number(val.toFixed(2)) : null;
        cell.numFmt = '0.00';
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Arial', size: 10 };
      cell.border = THIN_BORDER;
    });

    const semRes = semesterResults[stu.id];
    const examRange = examCount > 0 ? `${firstExamLetter}${r}:${lastExamLetter}${r}` : '';
    const rawExamAvgExpr = examRange
      ? `IF(COUNT(${examRange})=0,0,AVERAGE(${examRange}))`
      : '0';
    const bonusParts: string[] = [];
    if (skillsLetter) bonusParts.push(`N(${skillsLetter}${r})${compScale}`);
    if (attitudeLetter) bonusParts.push(`N(${attitudeLetter}${r})${compScale}`);
    const bonusExpr = bonusParts.length > 0 ? bonusParts.join('+') : '0';
    const examAvgFormula = knowledgeLetter
      ? `MIN(${settings.maxScore},IF(${knowledgeLetter}${r}="80%",(${rawExamAvgExpr})*0.8+${bonusExpr},(${rawExamAvgExpr})+${bonusExpr}))`
      : `MIN(${settings.maxScore},(${rawExamAvgExpr})+${bonusExpr})`;

    const examAvgCell = row.getCell(resStartCol);
    examAvgCell.value = {
      formula: examAvgFormula,
      result: Number(semRes.examAverage.toFixed(2)),
    };
    examAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };
    examAvgCell.font = { name: 'Arial', size: 10, bold: true };
    examAvgCell.numFmt = '0.00';
    examAvgCell.border = THIN_BORDER;

    const monthAvgCell = row.getCell(resStartCol + 1);
    monthAvgCell.value = Number(semRes.monthlyAverage.toFixed(2));
    monthAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };
    monthAvgCell.font = { name: 'Arial', size: 10, bold: true };
    monthAvgCell.numFmt = '0.00';
    monthAvgCell.border = THIN_BORDER;

    const semAvgCell = row.getCell(resStartCol + 2);
    semAvgCell.value = {
      formula: `IF(AND(${examAvgLetter}${r}>0,${monthAvgLetter}${r}>0),(${examAvgLetter}${r}+${monthAvgLetter}${r})/2,IF(${examAvgLetter}${r}>0,${examAvgLetter}${r},${monthAvgLetter}${r}))`,
      result: Number(semRes.semesterAverage.toFixed(2)),
    };
    semAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };
    semAvgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1D4ED8' } };
    semAvgCell.numFmt = '0.00';
    semAvgCell.border = THIN_BORDER;

    const rankCell = row.getCell(resStartCol + 3);
    rankCell.value = {
      formula: `RANK(${semAvgLetter}${r},$${semAvgLetter}$${startRow}:$${semAvgLetter}$${endRow},0)`,
      result: semRes.rank,
    };
    rankCell.alignment = { vertical: 'middle', horizontal: 'center' };
    rankCell.font = { name: 'Arial', size: 10, bold: true };
    rankCell.border = THIN_BORDER;

    const gradeCell = row.getCell(resStartCol + 4);
    gradeCell.value = {
      formula: `IF(${semAvgLetter}${r}${scaleDiv}>=9,"A",IF(${semAvgLetter}${r}${scaleDiv}>=8,"B",IF(${semAvgLetter}${r}${scaleDiv}>=7,"C",IF(${semAvgLetter}${r}${scaleDiv}>=6,"D",IF(${semAvgLetter}${r}${scaleDiv}>=5,"E","F")))))`,
      result: semRes.grade,
    };
    gradeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    gradeCell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: semRes.grade === 'F' ? 'FFDC2626' : 'FF047857' },
    };
    gradeCell.border = THIN_BORDER;

    const stuDomains = domainGrades[stu.id] || {};
    DOMAIN_GRADES.forEach((dom, dIdx) => {
      const cell = row.getCell(domStartCol + dIdx);
      cell.value = stuDomains[dom.key] || '';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.border = THIN_BORDER;
    });

    if (isSem2) {
      const stuAnnScores = annualScores[stu.id] || {};
      const annRes = annualResults[stu.id];
      const sem1AvgVal = Number((sem1Results[stu.id]?.semesterAverage ?? 0).toFixed(4));

      visibleAnnualCompSubjects.forEach((sub, cIdx) => {
        const cell = row.getCell(annCompStartCol + cIdx);
        const val = stuAnnScores[sub.key];
        if (sub.key === 'comp_knowledge') {
          cell.value = val === 80 ? '80%' : null;
        } else {
          cell.value =
            typeof val === 'number' && !Number.isNaN(val) ? Number(val.toFixed(2)) : null;
          cell.numFmt = '0.00';
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Arial', size: 10 };
        cell.border = THIN_BORDER;
      });

      const baseAnnExpr =
        sem1AvgVal > 0
          ? `IF(${semAvgLetter}${r}>0,(${sem1AvgVal}+${semAvgLetter}${r})/2,${sem1AvgVal})`
          : `${semAvgLetter}${r}`;
      const annBonusParts: string[] = [];
      if (annSkillsLetter) annBonusParts.push(`N(${annSkillsLetter}${r})${compScale}`);
      if (annAttitudeLetter) annBonusParts.push(`N(${annAttitudeLetter}${r})${compScale}`);
      const annBonusExpr = annBonusParts.length > 0 ? annBonusParts.join('+') : '0';
      const annAvgFormula = annKnowledgeLetter
        ? `MIN(${settings.maxScore},IF(${annKnowledgeLetter}${r}="80%",(${baseAnnExpr})*0.8+${annBonusExpr},(${baseAnnExpr})+${annBonusExpr}))`
        : `MIN(${settings.maxScore},(${baseAnnExpr})+${annBonusExpr})`;

      const annAvgCell = row.getCell(annResStartCol);
      annAvgCell.value = {
        formula: annAvgFormula,
        result: Number(annRes.annualAverage.toFixed(2)),
      };
      annAvgCell.alignment = { vertical: 'middle', horizontal: 'center' };
      annAvgCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      annAvgCell.numFmt = '0.00';
      annAvgCell.border = THIN_BORDER;

      const annRankCell = row.getCell(annResStartCol + 1);
      annRankCell.value = {
        formula: `RANK(${annAvgLetter}${r},$${annAvgLetter}$${startRow}:$${annAvgLetter}$${endRow},0)`,
        result: annRes.rank,
      };
      annRankCell.alignment = { vertical: 'middle', horizontal: 'center' };
      annRankCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      annRankCell.border = THIN_BORDER;

      const annGradeCell = row.getCell(annResStartCol + 2);
      annGradeCell.value = {
        formula: `IF(${annAvgLetter}${r}${scaleDiv}>=9,"A",IF(${annAvgLetter}${r}${scaleDiv}>=8,"B",IF(${annAvgLetter}${r}${scaleDiv}>=7,"C",IF(${annAvgLetter}${r}${scaleDiv}>=6,"D",IF(${annAvgLetter}${r}${scaleDiv}>=5,"E","F")))))`,
        result: annRes.grade,
      };
      annGradeCell.alignment = { vertical: 'middle', horizontal: 'center' };
      annGradeCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      annGradeCell.border = THIN_BORDER;

      const stuAnnDomains = annualDomains[stu.id] || {};
      DOMAIN_GRADES.forEach((dom, dIdx) => {
        const cell = row.getCell(annDomStartCol + dIdx);
        cell.value = stuAnnDomains[dom.key] || '';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.border = THIN_BORDER;
      });
    }

    const remCell = row.getCell(remarkCol);
    remCell.value = remarks[stu.id] || '';
    remCell.alignment = { vertical: 'middle', horizontal: 'left' };
    remCell.font = { name: 'Khmer OS Siemreap', size: 9 };
    remCell.border = THIN_BORDER;
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 11;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 7;
  for (let i = 0; i < examCount; i++) {
    ws.getColumn(examStartCol + i).width = 6.5;
  }
  for (let i = 0; i < compCount; i++) {
    ws.getColumn(compStartCol + i).width = 6.5;
  }
  for (let i = 0; i < 5; i++) {
    ws.getColumn(resStartCol + i).width = 8.5;
  }
  for (let i = 0; i < domCount; i++) {
    ws.getColumn(domStartCol + i).width = 7;
  }
  if (isSem2) {
    for (let i = 0; i < annCompCount; i++) {
      ws.getColumn(annCompStartCol + i).width = 6.5;
    }
    for (let i = 0; i < annResCount; i++) {
      ws.getColumn(annResStartCol + i).width = 8;
    }
    for (let i = 0; i < annDomCount; i++) {
      ws.getColumn(annDomStartCol + i).width = 7;
    }
  }
  ws.getColumn(remarkCol).width = 18;
}

function extractCellCsvText(cell: ExcelTypes.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('result' in val && val.result !== undefined && val.result !== null) {
      return String(val.result);
    }
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((part) => part.text || '').join('');
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text;
    }
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return '';
  }
  return String(val);
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function workbookToCsvBlob(workbook: ExcelTypes.Workbook): Blob {
  const lines: string[] = [];
  workbook.eachSheet((ws, sheetIdx) => {
    if (sheetIdx > 1) {
      lines.push('');
    }
    const maxCols = ws.columnCount || 1;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      let hasContent = false;
      for (let c = 1; c <= maxCols; c++) {
        const text = extractCellCsvText(row.getCell(c));
        if (text !== '') hasContent = true;
        cells.push(escapeCsvField(text));
      }
      if (hasContent) {
        lines.push(cells.join(','));
      }
    });
  });

  // Prepend UTF-8 BOM so Excel/Sheets on Android and Desktop read Khmer Unicode cleanly
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: CSV_MIME_TYPE });
}

export async function convertXlsxBlobToCsvBlob(xlsxBlob: Blob): Promise<Blob | null> {
  try {
    const Workbook = getExcelWorkbookConstructor();
    const workbook = new Workbook();
    const buffer = await xlsxBlob.arrayBuffer();
    await workbook.xlsx.load(buffer);
    return workbookToCsvBlob(workbook);
  } catch {
    return null;
  }
}

export async function generateLocalShareBlobs(params: {
  scope: ShareScope;
  settings: ClassSettings;
  students: Student[];
  attendance: AttendanceMap;
  monthlyScores: ScoreMap;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  semesterScores: ScoreMap;
  domainGrades: DomainGradeMap;
  remarks: RemarksMap;
  semesterScoresByTerm?: SemesterScoresByTerm;
  domainGradesByTerm?: DomainGradesByTerm;
}): Promise<{ xlsxBlob: Blob; csvBlob: Blob }> {
  const Workbook = getExcelWorkbookConstructor();
  const workbook = new Workbook();
  workbook.creator = params.settings.teacherName || 'សៀវភៅតាមដានសិស្ស';
  workbook.created = new Date();

  const {
    scope,
    settings,
    students,
    attendance,
    monthlyScores,
    monthlyScoresByMonth,
    semesterScores,
    domainGrades,
    remarks,
    semesterScoresByTerm,
    domainGradesByTerm,
  } = params;

  // Export only the single worksheet for the active tab
  if (scope === 'attendance') {
    appendAttendanceWorksheet(
      workbook,
      settings,
      students,
      attendance,
      remarks
    );
  } else if (scope === 'monthly') {
    appendMonthlyWorksheet(workbook, settings, students, monthlyScores, remarks);
  } else {
    appendSemesterWorksheet(
      workbook,
      settings,
      students,
      monthlyScoresByMonth,
      semesterScores,
      domainGrades,
      remarks,
      semesterScoresByTerm,
      domainGradesByTerm
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    xlsxBlob: new Blob([buffer], { type: EXCEL_MIME_TYPE }),
    csvBlob: workbookToCsvBlob(workbook),
  };
}

export async function generateLocalExcelBlob(params: {
  scope: ShareScope;
  settings: ClassSettings;
  students: Student[];
  attendance: AttendanceMap;
  monthlyScores: ScoreMap;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  semesterScores: ScoreMap;
  domainGrades: DomainGradeMap;
  remarks: RemarksMap;
  semesterScoresByTerm?: SemesterScoresByTerm;
  domainGradesByTerm?: DomainGradesByTerm;
}): Promise<Blob> {
  const { xlsxBlob } = await generateLocalShareBlobs(params);
  return xlsxBlob;
}

export function triggerExcelDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function getNativeFileSharePayloads(
  file: File,
  title: string,
  text: string
): ShareData[] {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return [];
    }
    const candidates: ShareData[] = [
      { files: [file], title, text },
      { files: [file], title },
      { files: [file] },
    ];

    if (typeof navigator.canShare === 'function') {
      return candidates.filter((payload) => {
        try {
          return navigator.canShare(payload);
        } catch {
          return false;
        }
      });
    }

    return [{ files: [file] }];
  } catch {
    return [];
  }
}

export function getBestNativeFileShareData(
  file: File,
  title: string,
  text: string
): ShareData | null {
  return getNativeFileSharePayloads(file, title, text)[0] ?? null;
}

export function canNativeShareFile(file: File): boolean {
  return getBestNativeFileShareData(file, file.name, '') !== null;
}

export function splitKhmerName(
  fullName: string,
  explicitLastName?: string,
  explicitFirstName?: string
): { lastName: string; firstName: string } {
  const ln = (explicitLastName || '').trim();
  const fn = (explicitFirstName || '').trim();
  if (ln || fn) {
    return { lastName: ln, firstName: fn };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: '', firstName: '' };
  if (parts.length === 1) return { lastName: '', firstName: parts[0] };
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
}

export async function generateStudentRosterTemplateExcelBlob(params: {
  settings: ClassSettings;
  students: Student[];
  remarks: RemarksMap;
}): Promise<Blob> {
  const { settings, students, remarks } = params;
  const Workbook = getExcelWorkbookConstructor();
  const workbook = new Workbook();
  workbook.creator = settings.teacherName || 'សៀវភៅតាមដានសិស្ស';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('ជីវប្រវត្តិសង្ខេបរបស់សិស្ស');

  const firstCol = 2; // Col B
  const lastCol = 18; // Col R

  // Row 1 & 2: National Motto
  ws.mergeCells(1, firstCol, 1, lastCol);
  const r1 = ws.getCell(1, firstCol);
  r1.value = 'ព្រះរាជាណាចក្រកម្ពុជា';
  r1.font = { name: 'Khmer OS Muol Light', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  r1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, firstCol, 2, lastCol);
  const r2 = ws.getCell(2, firstCol);
  r2.value = 'ជាតិ សាសនា ព្រះមហាក្សត្រ';
  r2.font = { name: 'Khmer OS Muol Light', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  r2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 12;

  // Row 4..7: School & Class Metadata
  const metaLines = [
    'រដ្ឋបាលស្រុក/ក្រុង/ខណ្ឌ ........................',
    'ការិយាល័យអប់រំ យុវជន និងកីឡា ........................',
    settings.schoolName || 'សាលាបឋមសិក្សា ........................',
    `${settings.className || 'ថ្នាក់ទី ........'} (ឆ្នាំសិក្សា ${settings.academicYear})`,
  ];
  metaLines.forEach((line, idx) => {
    const rowIdx = 4 + idx;
    ws.mergeCells(rowIdx, firstCol, rowIdx, 6);
    const cell = ws.getCell(rowIdx, firstCol);
    cell.value = line;
    cell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowIdx).height = 20;
  });

  // Row 8: Main Document Title
  ws.mergeCells(8, firstCol, 8, lastCol);
  const titleCell = ws.getCell(8, firstCol);
  titleCell.value = 'ជីវប្រវត្តិសង្ខេបរបស់សិស្ស';
  titleCell.font = { name: 'Khmer OS Muol Light', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(8).height = 28;

  // Row 9: Student Counts Summary
  const maleCount = students.filter((s) => s.gender === 'ប្រុស').length;
  const femaleCount = students.filter((s) => s.gender === 'ស្រី').length;
  ws.getRow(9).height = 20;
  const summaryCells: { col: number; value: string; align: 'left' | 'right' | 'center' }[] = [
    { col: 13, value: 'សិស្សសរុប', align: 'right' },
    { col: 14, value: `${students.length} នាក់`, align: 'center' },
    { col: 15, value: 'ប្រុស', align: 'right' },
    { col: 16, value: `${maleCount} នាក់`, align: 'center' },
    { col: 17, value: 'ស្រី', align: 'right' },
    { col: 18, value: `${femaleCount} នាក់`, align: 'center' },
  ];
  summaryCells.forEach((item) => {
    const c = ws.getCell(9, item.col);
    c.value = item.value;
    c.font = { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    c.alignment = { vertical: 'middle', horizontal: item.align };
  });

  ws.getRow(10).height = 8;

  // Row 11: Table Header (17 columns: B..R)
  const headers = [
    'ល.រ',
    'អត្តលេខ',
    'គោត្តនាម',
    'និង នាម',
    'ឈ្មោះឡាតាំង',
    'ភេទ',
    'ថ្ងៃខែឆ្នាំកំណើត',
    'អាយុ',
    'ទីកន្លែងកំណើត',
    'ឈ្មោះឪពុក',
    'និងមុខរបរ',
    'ឈ្មោះម្តាយ',
    'និងមុខរបរ',
    'អាសយដ្ឋានសព្វថ្ងៃ',
    'ជនជាតិដើមភាគតិច',
    'លក្ខណៈពិសេស',
    'សេចក្តីផ្សេងៗ',
  ];

  const headerRow = ws.getRow(11);
  headerRow.height = 26;
  headers.forEach((h, i) => {
    const col = firstCol + i;
    const cell = headerRow.getCell(col);
    cell.value = h;
    cell.font = { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: i === 0 ? 'medium' : 'thin', color: { argb: i === 0 ? 'FF0F172A' : 'FF94A3B8' } },
      right: {
        style: i === headers.length - 1 ? 'medium' : 'thin',
        color: { argb: i === headers.length - 1 ? 'FF0F172A' : 'FF94A3B8' },
      },
    };
  });

  const rowCount = students.length > 0 ? students.length : 10;
  for (let idx = 0; idx < rowCount; idx++) {
    const r = 12 + idx;
    const row = ws.getRow(r);
    row.height = 22;
    const stu = students[idx];
    const { lastName, firstName } = stu
      ? splitKhmerName(stu.name, stu.lastName, stu.firstName)
      : { lastName: '', firstName: '' };

    const values: (string | number)[] = stu
      ? [
          idx + 1,
          stu.studentCode || '',
          lastName,
          firstName,
          stu.latinName || '',
          stu.gender,
          stu.dob || '',
          stu.age || '',
          stu.pob || '',
          stu.fatherName || '',
          stu.fatherJob || '',
          stu.motherName || '',
          stu.motherJob || '',
          stu.address || '',
          stu.ethnicity || '',
          stu.specialCondition || '',
          remarks[stu.id] || '',
        ]
      : [idx + 1, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

    const isLastRow = idx === rowCount - 1;
    values.forEach((val, i) => {
      const col = firstCol + i;
      const cell = row.getCell(col);
      cell.value = val;
      cell.font = { name: 'Khmer OS Siemreap', size: 10, color: { argb: 'FF0F172A' } };
      const centerCols = new Set([0, 1, 5, 6, 7]);
      cell.alignment = {
        vertical: 'middle',
        horizontal: centerCols.has(i) ? 'center' : 'left',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: {
          style: isLastRow ? 'medium' : 'thin',
          color: { argb: isLastRow ? 'FF0F172A' : 'FF94A3B8' },
        },
        left: { style: i === 0 ? 'medium' : 'thin', color: { argb: i === 0 ? 'FF0F172A' : 'FF94A3B8' } },
        right: {
          style: i === headers.length - 1 ? 'medium' : 'thin',
          color: { argb: i === headers.length - 1 ? 'FF0F172A' : 'FF94A3B8' },
        },
      };
    });
  }

  const widths = [3, 5.5, 11, 13, 16, 17, 7, 16, 6.5, 28, 16, 12, 16, 12, 28, 17, 15, 18];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: EXCEL_MIME_TYPE });
}

function getExcelCellString(cell: ExcelTypes.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) {
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const yyyy = val.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText
        .map((r) => r.text || '')
        .join('')
        .trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
    if ('result' in val && val.result !== undefined && val.result !== null) {
      if (val.result instanceof Date) {
        const dd = String(val.result.getDate()).padStart(2, '0');
        const mm = String(val.result.getMonth() + 1).padStart(2, '0');
        const yyyy = val.result.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
      return String(val.result).trim();
    }
  }
  return (cell.text || '').trim();
}

export async function parseStudentRosterFromExcel(file: File): Promise<{
  students: Omit<Student, 'id'>[];
  remarksByIndex: Record<number, string>;
}> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
    throw new Error(
      'កម្មវិធីគាំទ្រឯកសារ .xlsx។ សូមរក្សាទុក File Excel ជាប្រភេទ .xlsx រួចនាំចូលម្តងទៀត។'
    );
  }

  const buffer = await file.arrayBuffer();
  const Workbook = getExcelWorkbookConstructor();
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);

  if (workbook.worksheets.length === 0) {
    throw new Error('មិនមានទំព័រទិន្នន័យនៅក្នុងឯកសារ Excel នេះទេ។');
  }

  let targetWs: ExcelTypes.Worksheet | null = null;
  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};

  const normalizeHeader = (s: string) => s.replace(/\s+/g, '').trim().toLowerCase();

  for (const ws of workbook.worksheets) {
    const scanMax = Math.min(ws.rowCount, 30);
    for (let r = 1; r <= scanMax; r++) {
      const row = ws.getRow(r);
      const found: Record<string, number> = {};
      let sawFatherName = false;
      let sawMotherName = false;

      for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) {
        const raw = getExcelCellString(row.getCell(c));
        if (!raw) continue;
        const norm = normalizeHeader(raw);

        if (norm.includes('អត្តលេខ') || norm === 'code' || norm === 'id') {
          found.studentCode = c;
        } else if (norm.includes('គោត្តនាមនិងនាម') || norm === 'ឈ្មោះសិស្ស' || norm === 'ឈ្មោះ') {
          found.fullName = c;
        } else if (norm === 'គោត្តនាម' || norm.includes('គោត្តនាម')) {
          found.lastName = c;
        } else if (norm === 'និងនាម' || norm === 'នាម') {
          found.firstName = c;
        } else if (norm.includes('ឡាតាំង') || norm.includes('latin')) {
          found.latinName = c;
        } else if (norm === 'ភេទ' || norm === 'gender') {
          found.gender = c;
        } else if (norm.includes('ថ្ងៃខែឆ្នាំកំណើត') || norm.includes('ថ្ងៃកំណើត')) {
          found.dob = c;
        } else if (norm === 'អាយុ') {
          found.age = c;
        } else if (norm.includes('ទីកន្លែងកំណើត') || norm.includes('កន្លែងកំណើត')) {
          found.pob = c;
        } else if (norm.includes('ឈ្មោះឪពុក') || norm === 'ឪពុក') {
          found.fatherName = c;
          sawFatherName = true;
        } else if (norm.includes('ឈ្មោះម្តាយ') || norm.includes('ឈ្មោះម្ដាយ') || norm === 'ម្តាយ' || norm === 'ម្ដាយ') {
          found.motherName = c;
          sawMotherName = true;
        } else if (norm.includes('មុខរបរឪពុក')) {
          found.fatherJob = c;
        } else if (norm.includes('មុខរបរម្តាយ') || norm.includes('មុខរបរម្ដាយ')) {
          found.motherJob = c;
        } else if (norm.includes('មុខរបរ')) {
          if (sawMotherName && !found.motherJob) {
            found.motherJob = c;
          } else if (sawFatherName && !found.fatherJob) {
            found.fatherJob = c;
          } else if (!found.fatherJob) {
            found.fatherJob = c;
          } else if (!found.motherJob) {
            found.motherJob = c;
          }
        } else if (norm.includes('អាសយដ្ឋាន')) {
          found.address = c;
        } else if (norm.includes('ជនជាតិ')) {
          found.ethnicity = c;
        } else if (norm.includes('លក្ខណៈពិសេស')) {
          found.specialCondition = c;
        } else if (norm.includes('សេចក្តីផ្សេងៗ') || norm.includes('ផ្សេងៗ')) {
          found.remark = c;
        }
      }

      if (found.lastName || found.firstName || found.fullName) {
        targetWs = ws;
        headerRowIdx = r;
        colMap = found;
        break;
      }
    }
    if (targetWs) break;
  }

  if (!targetWs || headerRowIdx < 1) {
    throw new Error(
      'រកមិនឃើញជួរឈរឈ្មោះសិស្ស (គោត្តនាម / និង នាម) ក្នុងឯកសារ Excel ទេ។ សូមប្រើគំរូ Excel របស់កម្មវិធី។'
    );
  }

  const parsedStudents: Omit<Student, 'id'>[] = [];
  const remarksByIndex: Record<number, string> = {};

  for (let r = headerRowIdx + 1; r <= targetWs.rowCount; r++) {
    const row = targetWs.getRow(r);
    const readCol = (key: string) =>
      colMap[key] ? getExcelCellString(row.getCell(colMap[key])) : '';

    const fullNameCol = readCol('fullName');
    const lastName = readCol('lastName');
    const firstName = readCol('firstName');
    const combinedName = fullNameCol || [lastName, firstName].filter(Boolean).join(' ').trim();

    if (!combinedName) continue;
    const lowerCombined = combinedName.toLowerCase();
    if (
      lowerCombined.includes('សិស្សសរុប') ||
      lowerCombined === 'សរុប' ||
      lowerCombined === 'រួម'
    ) {
      continue;
    }

    const split = splitKhmerName(combinedName, lastName, firstName);
    const rawGender = readCol('gender').toLowerCase();
    const gender: 'ប្រុស' | 'ស្រី' =
      rawGender.includes('ស្រី') || rawGender === 'ស' || rawGender === 'f' || rawGender === 'female'
        ? 'ស្រី'
        : 'ប្រុស';

    const idx = parsedStudents.length;
    parsedStudents.push({
      studentCode: readCol('studentCode'),
      name: combinedName,
      lastName: split.lastName || undefined,
      firstName: split.firstName || undefined,
      latinName: readCol('latinName') || undefined,
      gender,
      dob: readCol('dob') || undefined,
      age: readCol('age') || undefined,
      pob: readCol('pob') || undefined,
      fatherName: readCol('fatherName') || undefined,
      fatherJob: readCol('fatherJob') || undefined,
      motherName: readCol('motherName') || undefined,
      motherJob: readCol('motherJob') || undefined,
      address: readCol('address') || undefined,
      ethnicity: readCol('ethnicity') || undefined,
      specialCondition: readCol('specialCondition') || undefined,
    });

    const remark = readCol('remark');
    if (remark) {
      remarksByIndex[idx] = remark;
    }
  }

  if (parsedStudents.length === 0) {
    throw new Error('មិនមានទិន្នន័យឈ្មោះសិស្សនៅក្នុងឯកសារ Excel នេះទេ។');
  }

  return { students: parsedStudents, remarksByIndex };
}


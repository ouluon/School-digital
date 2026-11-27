import React, { useMemo, useRef, useState } from 'react';
import {
  Eye,
  FileSpreadsheet,
  LogIn,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  AttendanceMap,
  ClassSettings,
  DOMAIN_GRADES,
  DomainGradeMap,
  Gender,
  KHMER_MONTHS,
  MONTHLY_SUBJECT_GROUPS,
  MonthlyScoresByMonth,
  RemarksMap,
  ScoreMap,
  Student,
  getAttendanceMonthYear,
  getMonthlyScoresMonthYear,
} from '../types/gradebook';
import {
  computeCombinedMonthlyResults,
  computeMonthlyResults,
  computeSemesterResults,
  computeStudentAttendanceSummary,
  getDaysInMonth,
} from '../utils/calculations';
import {
  generateStudentRosterTemplateExcelBlob,
  parseStudentRosterFromExcel,
  splitKhmerName,
  triggerExcelDownload,
} from '../services/excelExport';

interface RosterAndSheetTabProps {
  user: User | null;
  settings: ClassSettings;
  students: Student[];
  attendance: AttendanceMap;
  monthlyScores: ScoreMap;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  semesterScores: ScoreMap;
  domainGrades: DomainGradeMap;
  remarks: RemarksMap;
  onSignIn: () => void;
  onOpenAuthModal?: (mode: 'signin' | 'signup') => void;
  onAddStudent: (studentData: Omit<Student, 'id'>, remark: string) => void;
  onUpdateStudent: (
    studentId: string,
    updates: Omit<Student, 'id'> & { remark: string }
  ) => void;
  onDeleteStudent: (studentId: string) => void;
  onImportExcelStudents: (
    students: Omit<Student, 'id'>[],
    remarksByIndex: Record<number, string>
  ) => void;
  onNotify?: (type: 'success' | 'error' | 'warning', text: string) => void;
}

export const RosterAndSheetTab: React.FC<RosterAndSheetTabProps> = ({
  user,
  settings,
  students,
  attendance,
  monthlyScores,
  monthlyScoresByMonth,
  semesterScores,
  domainGrades,
  remarks,
  onSignIn,
  onOpenAuthModal,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportExcelStudents,
  onNotify,
}) => {
  const { month: attMonth, year: attYear } = getAttendanceMonthYear(settings);
  const { month: monMonth, year: monYear } = getMonthlyScoresMonthYear(settings);
  const attMonthLabel =
    KHMER_MONTHS.find((m) => m.value === attMonth)?.label || '';
  const monMonthLabel =
    KHMER_MONTHS.find((m) => m.value === monMonth)?.label || '';
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // Preview, Add & Edit student modals (aligned with Excel bio template)
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [studentFormMode, setStudentFormMode] = useState<
    { mode: 'add' } | { mode: 'edit'; studentId: string } | null
  >(null);
  const [formCode, setFormCode] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLatinName, setFormLatinName] = useState('');
  const [formGender, setFormGender] = useState<Gender>('ប្រុស');
  const [formDob, setFormDob] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formPob, setFormPob] = useState('');
  const [formFatherName, setFormFatherName] = useState('');
  const [formFatherJob, setFormFatherJob] = useState('');
  const [formMotherName, setFormMotherName] = useState('');
  const [formMotherJob, setFormMotherJob] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formEthnicity, setFormEthnicity] = useState('');
  const [formSpecialCondition, setFormSpecialCondition] = useState('');
  const [formRemark, setFormRemark] = useState('');

  const previewIndex = previewStudentId
    ? students.findIndex((s) => s.id === previewStudentId)
    : -1;
  const previewStudent = previewIndex >= 0 ? students[previewIndex] : null;

  const monthlyResults = useMemo(
    () =>
      previewStudent
        ? computeMonthlyResults(students, monthlyScores, settings.maxScore)
        : {},
    [previewStudent, students, monthlyScores, settings.maxScore]
  );

  const semesterResults = useMemo(() => {
    if (!previewStudent) return {};
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
    return computeSemesterResults(
      students,
      semesterScores,
      combinedMonthly,
      settings.maxScore
    );
  }, [
    previewStudent,
    students,
    monthlyScoresByMonth,
    semesterScores,
    settings.academicYear,
    settings.year,
    settings.semester,
    settings.semester1Months,
    settings.semester2Months,
    settings.maxScore,
  ]);

  const handleExportTemplateExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const blob = await generateStudentRosterTemplateExcelBlob({
        settings,
        students,
        remarks,
      });
      const safeClass = (settings.className || 'ថ្នាក់រៀន')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim();
      triggerExcelDownload(blob, `ជីវប្រវត្តិសង្ខេបសិស្ស_${safeClass}.xlsx`);
      onNotify?.(
        'success',
        'បាននាំចេញគំរូ Excel ជីវប្រវត្តិសង្ខេបរបស់សិស្សរួចរាល់។'
      );
    } catch (err: unknown) {
      onNotify?.(
        'error',
        err instanceof Error
          ? err.message
          : 'មិនអាចបង្កើត File Excel សម្រាប់នាំចេញបានទេ។'
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImportingExcel(true);
    try {
      const parsed = await parseStudentRosterFromExcel(file);
      onImportExcelStudents(parsed.students, parsed.remarksByIndex);
    } catch (err: unknown) {
      onNotify?.(
        'error',
        err instanceof Error
          ? err.message
          : 'មិនអាចអានទិន្នន័យពីឯកសារ Excel នេះបានទេ។'
      );
    } finally {
      setIsImportingExcel(false);
    }
  };

  const openAddStudentModal = () => {
    setStudentFormMode({ mode: 'add' });
    setFormCode('');
    setFormLastName('');
    setFormFirstName('');
    setFormLatinName('');
    setFormGender('ប្រុស');
    setFormDob('');
    setFormAge('');
    setFormPob('');
    setFormFatherName('');
    setFormFatherJob('');
    setFormMotherName('');
    setFormMotherJob('');
    setFormAddress('');
    setFormEthnicity('');
    setFormSpecialCondition('');
    setFormRemark('');
  };

  const openEditStudent = (stu: Student) => {
    const split = splitKhmerName(stu.name, stu.lastName, stu.firstName);
    setStudentFormMode({ mode: 'edit', studentId: stu.id });
    setFormCode(stu.studentCode || '');
    setFormLastName(split.lastName);
    setFormFirstName(split.firstName);
    setFormLatinName(stu.latinName || '');
    setFormGender(stu.gender);
    setFormDob(stu.dob || '');
    setFormAge(stu.age || '');
    setFormPob(stu.pob || '');
    setFormFatherName(stu.fatherName || '');
    setFormFatherJob(stu.fatherJob || '');
    setFormMotherName(stu.motherName || '');
    setFormMotherJob(stu.motherJob || '');
    setFormAddress(stu.address || '');
    setFormEthnicity(stu.ethnicity || '');
    setFormSpecialCondition(stu.specialCondition || '');
    setFormRemark(remarks[stu.id] || '');
  };

  const handleStudentFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormMode) return;
    const ln = formLastName.trim();
    const fn = formFirstName.trim();
    const combinedName = [ln, fn].filter(Boolean).join(' ');
    if (!combinedName) return;

    const studentPayload: Omit<Student, 'id'> = {
      studentCode: formCode.trim(),
      name: combinedName,
      lastName: ln || undefined,
      firstName: fn || undefined,
      latinName: formLatinName.trim() || undefined,
      gender: formGender,
      dob: formDob.trim() || undefined,
      age: formAge.trim() || undefined,
      pob: formPob.trim() || undefined,
      fatherName: formFatherName.trim() || undefined,
      fatherJob: formFatherJob.trim() || undefined,
      motherName: formMotherName.trim() || undefined,
      motherJob: formMotherJob.trim() || undefined,
      address: formAddress.trim() || undefined,
      ethnicity: formEthnicity.trim() || undefined,
      specialCondition: formSpecialCondition.trim() || undefined,
    };

    if (studentFormMode.mode === 'add') {
      onAddStudent(studentPayload, formRemark.trim());
    } else {
      onUpdateStudent(studentFormMode.studentId, {
        ...studentPayload,
        remark: formRemark.trim(),
      });
    }
    setStudentFormMode(null);
  };

  const daysInCurrentMonth = getDaysInMonth(attYear, attMonth);
  const previewAttSummary = previewStudent
    ? computeStudentAttendanceSummary(previewStudent.id, attendance, daysInCurrentMonth)
    : null;
  const previewSickDays = useMemo(() => {
    if (!previewStudent) return 0;
    const stuAtt = attendance[previewStudent.id] || {};
    let sick = 0;
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      if (stuAtt[d] === 'ឈ') sick++;
    }
    return sick;
  }, [previewStudent, attendance, daysInCurrentMonth]);
  const previewMonthlyRes = previewStudent ? monthlyResults[previewStudent.id] : undefined;
  const previewSemesterRes = previewStudent
    ? semesterResults[previewStudent.id]
    : undefined;

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Student Roster Management */}
      <section className="min-w-0 w-full surface-card rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              បញ្ជីឈ្មោះសិស្ស ({students.length} នាក់)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ស្រី {students.filter((s) => s.gender === 'ស្រី').length} នាក់ · ប្រុស{' '}
              {students.filter((s) => s.gender === 'ប្រុស').length} នាក់
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => void handleImportExcelFile(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => void handleExportTemplateExcel()}
              disabled={isExportingExcel}
              className="btn-secondary min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{isExportingExcel ? 'កំពុងបង្កើត...' : 'នាំចេញគំរូ Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              disabled={isImportingExcel}
              className="min-h-[40px] px-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-b from-blue-50 to-blue-100/70 dark:from-blue-950/60 dark:to-blue-900/50 text-xs font-semibold text-blue-800 dark:text-blue-200 hover:from-blue-100 hover:to-blue-100 dark:hover:from-blue-900/70 dark:hover:to-blue-900/60 active:scale-[0.98] transition-all duration-150 shadow-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isImportingExcel ? 'កំពុងនាំចូល...' : 'នាំចូលគំរូ Excel'}</span>
            </button>
            <button
              type="button"
              onClick={openAddStudentModal}
              className="btn-dark min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>បន្ថែមសិស្សថ្មី</span>
            </button>
          </div>
        </div>

        {/* Roster List */}
        {students.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2.5">
            <div className="text-base font-bold text-slate-700 dark:text-slate-200">
              គ្មានទិន្នន័យសិស្ស
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              សូមចូលគណនី ឬចុច «បន្ថែមសិស្សថ្មី» / «នាំចូលគំរូ Excel» ខាងលើ។
            </p>
            {!user && (
              <div className="pt-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() =>
                    onOpenAuthModal ? onOpenAuthModal('signin') : onSignIn()
                  }
                  className="btn-primary min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>ចូលគណនី</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[520px] overflow-y-auto">
            {students.map((stu, idx) => (
              <div
                key={stu.id}
                className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold font-mono-num flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {stu.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>{stu.gender}</span>
                      {stu.studentCode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">{stu.studentCode}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewStudentId(stu.id)}
                    aria-label={`មើលព័ត៌មាន ${stu.name}`}
                    title="មើលព័ត៌មានសិស្ស (Preview)"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 active:scale-95 rounded-xl transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditStudent(stu)}
                    aria-label={`កែប្រែ ${stu.name}`}
                    title="កែប្រែឈ្មោះសិស្ស (Edit)"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 active:scale-95 rounded-xl transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStudent(stu.id)}
                    aria-label={`លុប ${stu.name}`}
                    title="លុបសិស្ស"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 active:scale-95 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Preview Student Modal */}
      {previewStudent && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-student-title"
        >
          <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="font-mono-num">ល.រ {previewIndex + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span>{previewStudent.gender}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    អត្តលេខ {previewStudent.studentCode || 'គ្មាន'}
                  </span>
                </div>
                <h3
                  id="preview-student-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5"
                >
                  {previewStudent.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewStudentId(null)}
                aria-label="បិទផ្ទាំងមើលព័ត៌មាន"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Attendance Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    អវត្តមានខែ{attMonthLabel} {attYear}
                  </span>
                  {previewAttSummary && previewSickDays > 0 && (
                    <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                      ច្ប {previewAttSummary.excused - previewSickDays} · ឈ {previewSickDays}
                    </span>
                  )}
                </div>
                {previewAttSummary && (
                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">ច្បាប់ + ឈឺ</div>
                      <div className="text-base font-bold font-mono-num text-amber-700 dark:text-amber-400 mt-0.5">
                        {previewAttSummary.excused}
                      </div>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">អត់ច្បាប់</div>
                      <div className="text-base font-bold font-mono-num text-rose-700 dark:text-rose-400 mt-0.5">
                        {previewAttSummary.unexcused}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">សរុបអវត្តមាន</div>
                      <div className="text-base font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewAttSummary.totalAbsent}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Scores Summary */}
              <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    លទ្ធផលប្រចាំខែ{monMonthLabel} {monYear}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                    មាត្រដ្ឋាន {settings.maxScore}
                  </span>
                </div>
                {previewMonthlyRes &&
                (previewMonthlyRes.enteredCount > 0 || previewMonthlyRes.average > 0) ? (
                  <>
                    <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">សរុប</div>
                        <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-0.5">
                          {previewMonthlyRes.total.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">មធ្យម</div>
                        <div className="text-sm font-bold font-mono-num text-blue-700 dark:text-blue-400 mt-0.5">
                          {previewMonthlyRes.average.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">ចំណាត់ថ្នាក់</div>
                        <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-0.5">
                          {previewMonthlyRes.rank}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">និទ្ទេស</div>
                        <div
                          className={`text-sm font-bold font-mono-num mt-0.5 ${
                            previewMonthlyRes.grade === 'F'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {previewMonthlyRes.grade}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-1">
                      {MONTHLY_SUBJECT_GROUPS.map((grp) => {
                        const stuScores = monthlyScores[previewStudent.id] || {};
                        if (grp.isCompetencyGroup) {
                          return grp.subjects.map((sub) => {
                            const rawVal = stuScores[sub.key];
                            if (typeof rawVal !== 'number' || Number.isNaN(rawVal)) return null;
                            const formatted =
                              sub.key === 'comp_knowledge'
                                ? `${rawVal}%`
                                : rawVal.toFixed(2);
                            return (
                              <div
                                key={sub.key}
                                className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800"
                              >
                                <span className="text-slate-600 dark:text-slate-300 truncate pr-2">
                                  {sub.label}
                                </span>
                                <span className="font-mono-num font-semibold text-blue-700 dark:text-blue-400 shrink-0">
                                  {formatted}
                                </span>
                              </div>
                            );
                          });
                        }
                        const vals = grp.subjects
                          .map((s) => stuScores[s.key])
                          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
                        if (vals.length === 0) return null;
                        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                        return (
                          <div
                            key={grp.key}
                            className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800"
                          >
                            <span className="text-slate-600 dark:text-slate-300 truncate pr-2">
                              {grp.label}
                            </span>
                            <span className="font-mono-num font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                              {avg.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-1">
                    មិនទាន់មានពិន្ទុប្រចាំខែសម្រាប់ខែនេះទេ។
                  </p>
                )}
              </div>

              {/* Semester Summary */}
              <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    លទ្ធផលឆមាសទី {settings.semester === 1 ? '១' : '២'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-mono-num">
                    ឆ្នាំសិក្សា {settings.academicYear}
                  </span>
                </div>
                {previewSemesterRes &&
                (previewSemesterRes.enteredCount > 0 ||
                  previewSemesterRes.monthlyAverage > 0) ? (
                  <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">ម. ប្រឡង</div>
                      <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewSemesterRes.examAverage.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">ម. ប្រចាំខែ</div>
                      <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-slate-100 mt-0.5">
                        {previewSemesterRes.monthlyAverage.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">ម. ឆមាស</div>
                      <div className="text-sm font-bold font-mono-num text-blue-700 dark:text-blue-400 mt-0.5">
                        {previewSemesterRes.semesterAverage.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">ថ្នាក់ / និទ្ទេស</div>
                      <div className="text-sm font-bold font-mono-num mt-0.5">
                        <span className="text-slate-900 dark:text-slate-100">
                          {previewSemesterRes.rank}
                        </span>
                        <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                        <span
                          className={
                            previewSemesterRes.grade === 'F'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {previewSemesterRes.grade}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-1">
                    មិនទាន់មានពិន្ទុប្រឡងឆមាសនៅឡើយទេ។
                  </p>
                )}

                {DOMAIN_GRADES.some(
                  (d) => domainGrades[previewStudent.id]?.[d.key]
                ) && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    {DOMAIN_GRADES.map((d) => {
                      const val = domainGrades[previewStudent.id]?.[d.key];
                      if (!val) return null;
                      return (
                        <div
                          key={d.key}
                          className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800"
                        >
                          <span className="text-slate-600 dark:text-slate-300">{d.label}</span>
                          <span className="font-mono-num font-bold text-slate-900 dark:text-slate-100">
                            {val}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Biography Info (from Excel template) */}
              {(previewStudent.latinName ||
                previewStudent.dob ||
                previewStudent.age ||
                previewStudent.pob ||
                previewStudent.fatherName ||
                previewStudent.motherName ||
                previewStudent.address ||
                previewStudent.ethnicity ||
                previewStudent.specialCondition) && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    ជីវប្រវត្តិសង្ខេបសិស្ស
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    {previewStudent.latinName && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ឈ្មោះឡាតាំង៖ </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {previewStudent.latinName}
                        </span>
                      </div>
                    )}
                    {(previewStudent.dob || previewStudent.age) && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ថ្ងៃកំណើត / អាយុ៖ </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono-num">
                          {[previewStudent.dob, previewStudent.age ? `${previewStudent.age} ឆ្នាំ` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                    )}
                    {previewStudent.pob && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">ទីកន្លែងកំណើត៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {previewStudent.pob}
                        </span>
                      </div>
                    )}
                    {(previewStudent.fatherName || previewStudent.fatherJob) && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ឪពុក៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {[previewStudent.fatherName, previewStudent.fatherJob]
                            .filter(Boolean)
                            .join(' — ')}
                        </span>
                      </div>
                    )}
                    {(previewStudent.motherName || previewStudent.motherJob) && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ម្តាយ៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {[previewStudent.motherName, previewStudent.motherJob]
                            .filter(Boolean)
                            .join(' — ')}
                        </span>
                      </div>
                    )}
                    {previewStudent.address && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 dark:text-slate-400">អាសយដ្ឋានសព្វថ្ងៃ៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {previewStudent.address}
                        </span>
                      </div>
                    )}
                    {previewStudent.ethnicity && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ជនជាតិដើមភាគតិច៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {previewStudent.ethnicity}
                        </span>
                      </div>
                    )}
                    {previewStudent.specialCondition && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">លក្ខណៈពិសេស៖ </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {previewStudent.specialCondition}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {remarks[previewStudent.id] && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    សេចក្តីផ្សេងៗ
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {remarks[previewStudent.id]}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = previewStudent;
                  setPreviewStudentId(null);
                  openEditStudent(target);
                }}
                className="btn-secondary flex-1 min-h-[44px] rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-4 h-4" />
                <span>កែប្រែព័ត៌មាន</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewStudentId(null)}
                className="btn-primary flex-1 min-h-[44px] rounded-xl text-sm font-semibold"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Student Biography Modal (matching Excel template) */}
      {studentFormMode && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-form-modal-title"
        >
          <form
            onSubmit={handleStudentFormSubmit}
            className="w-full sm:max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3
                  id="student-form-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  {studentFormMode.mode === 'add'
                    ? 'បន្ថែមសិស្សថ្មី'
                    : 'កែប្រែព័ត៌មានសិស្ស'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ព័ត៌មានសិស្សយោងតាមទម្រង់គំរូ Excel (ជីវប្រវត្តិសង្ខេបរបស់សិស្ស)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStudentFormMode(null)}
                aria-label="បិទផ្ទាំងបញ្ចូលព័ត៌មានសិស្ស"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    អត្តលេខ
                  </span>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="ឧ. 2601310"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    ភេទ
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormGender('ប្រុស')}
                      className={`min-h-[42px] rounded-xl border text-sm font-semibold transition-colors ${
                        formGender === 'ប្រុស'
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      ប្រុស
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormGender('ស្រី')}
                      className={`min-h-[42px] rounded-xl border text-sm font-semibold transition-colors ${
                        formGender === 'ស្រី'
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      ស្រី
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    គោត្តនាម
                  </span>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    required={!formFirstName.trim()}
                    placeholder="ឧ. កេត"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    និង នាម
                  </span>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    required={!formLastName.trim()}
                    placeholder="ឧ. សម្បត្តិរាជ"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ឈ្មោះឡាតាំង
                  </span>
                  <input
                    type="text"
                    value={formLatinName}
                    onChange={(e) => setFormLatinName(e.target.value)}
                    placeholder="KET SAMBATREACH"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ថ្ងៃខែឆ្នាំកំណើត
                  </span>
                  <input
                    type="text"
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    placeholder="០៩-ឧសភា-២០១៩"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    អាយុ
                  </span>
                  <input
                    type="text"
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    placeholder="០៧"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono-num text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ទីកន្លែងកំណើត
                </span>
                <input
                  type="text"
                  value={formPob}
                  onChange={(e) => setFormPob(e.target.value)}
                  placeholder="ភូមិ ឃុំ ស្រុក ខេត្ត..."
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ឈ្មោះឪពុក
                  </span>
                  <input
                    type="text"
                    value={formFatherName}
                    onChange={(e) => setFormFatherName(e.target.value)}
                    placeholder="ឈ្មោះឪពុក..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    និងមុខរបរ (ឪពុក)
                  </span>
                  <input
                    type="text"
                    value={formFatherJob}
                    onChange={(e) => setFormFatherJob(e.target.value)}
                    placeholder="ឧ. កសិករ"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ឈ្មោះម្តាយ
                  </span>
                  <input
                    type="text"
                    value={formMotherName}
                    onChange={(e) => setFormMotherName(e.target.value)}
                    placeholder="ឈ្មោះម្តាយ..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    និងមុខរបរ (ម្តាយ)
                  </span>
                  <input
                    type="text"
                    value={formMotherJob}
                    onChange={(e) => setFormMotherJob(e.target.value)}
                    placeholder="ឧ. កសិករ"
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  អាសយដ្ឋានសព្វថ្ងៃ
                </span>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="ភូមិ ឃុំ ស្រុក ខេត្ត..."
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ជនជាតិដើមភាគតិច
                  </span>
                  <input
                    type="text"
                    value={formEthnicity}
                    onChange={(e) => setFormEthnicity(e.target.value)}
                    placeholder="បើមាន..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    លក្ខណៈពិសេស
                  </span>
                  <input
                    type="text"
                    value={formSpecialCondition}
                    onChange={(e) => setFormSpecialCondition(e.target.value)}
                    placeholder="បើមាន..."
                    className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  សេចក្តីផ្សេងៗ
                </span>
                <input
                  type="text"
                  value={formRemark}
                  onChange={(e) => setFormRemark(e.target.value)}
                  placeholder="កំណត់សម្គាល់បន្ថែម..."
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setStudentFormMode(null)}
                className="btn-secondary flex-1 min-h-[44px] rounded-xl text-sm font-semibold"
              >
                បោះបង់
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 min-h-[44px] rounded-xl text-sm font-semibold"
              >
                {studentFormMode.mode === 'add' ? 'បន្ថែមសិស្សថ្មី' : 'រក្សាទុក'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Building2, GraduationCap, Landmark, MapPin, School, X } from 'lucide-react';
import { ClassSettings, getMonthlyScoresMonthYear } from '../types/gradebook';
import {
  getAcademicYearOptions,
  getCalendarYearForAcademicMonth,
  parseAcademicYear,
} from '../utils/calculations';

interface SchoolClassInfoModalProps {
  open: boolean;
  settings: ClassSettings;
  onClose: () => void;
  onSave: (nextSettings: ClassSettings) => void;
}

export const SchoolClassInfoModal: React.FC<SchoolClassInfoModalProps> = ({
  open,
  settings,
  onClose,
  onSave,
}) => {
  const [className, setClassName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [districtAdmin, setDistrictAdmin] = useState('');
  const [educationOffice, setEducationOffice] = useState('');
  const [schoolCluster, setSchoolCluster] = useState('');
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    if (!open) return;
    setClassName(settings.className || '');
    setAcademicYear(settings.academicYear);
    setDistrictAdmin(settings.districtAdmin || '');
    setEducationOffice(settings.educationOffice || '');
    setSchoolCluster(settings.schoolCluster || '');
    setSchoolName(settings.schoolName || '');
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { month: monMonth } = getMonthlyScoresMonthYear(settings);
    const nextAcademicYear = academicYear || settings.academicYear;
    const academicChanged = nextAcademicYear !== settings.academicYear;
    const mappedYear = academicChanged
      ? getCalendarYearForAcademicMonth(
          nextAcademicYear,
          monMonth,
          parseAcademicYear(nextAcademicYear, settings.year).startYear
        )
      : settings.year;
    const mappedMonthlyYear = academicChanged
      ? getCalendarYearForAcademicMonth(
          nextAcademicYear,
          monMonth,
          parseAcademicYear(nextAcademicYear, settings.monthlyYear ?? settings.year).startYear
        )
      : settings.monthlyYear ?? settings.year;

    onSave({
      ...settings,
      maxScore: 10,
      className: className.trim(),
      academicYear: nextAcademicYear,
      year: mappedYear,
      monthlyYear: mappedMonthlyYear,
      districtAdmin: districtAdmin.trim(),
      educationOffice: educationOffice.trim(),
      schoolCluster: schoolCluster.trim(),
      schoolName: schoolName.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 dark:bg-slate-950/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-class-info-modal-title"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="school-class-info-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              ព័ត៌មានសាលារៀន/ថ្នាក់រៀន
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              កែប្រែព័ត៌មានសាលារៀន ថ្នាក់រៀន និងឆ្នាំសិក្សាសម្រាប់ប្រើក្នុងកម្មវិធី
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="បិទផ្ទាំងព័ត៌មានសាលារៀន និងថ្នាក់រៀន"
            className="min-w-[40px] min-h-[40px] -mr-1 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ថ្នាក់ទី
              </span>
              <div className="relative">
                <GraduationCap className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="ឧ. ថ្នាក់ទី ៦ ក"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ឆ្នាំសិក្សា
              </span>
              <select
                aria-label="ឆ្នាំសិក្សា"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-semibold font-mono-num text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {getAcademicYearOptions(academicYear || settings.academicYear, settings.year).map(
                  (ay) => (
                    <option key={ay} value={ay}>
                      {ay}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                រដ្ឋបាលស្រុក / ក្រុង / ខណ្ឌ
              </span>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={districtAdmin}
                  onChange={(e) => setDistrictAdmin(e.target.value)}
                  placeholder="ឧ. រដ្ឋបាលស្រុកសំឡូត"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ការិយាល័យអប់រំ យុវជន និងកីឡា
              </span>
              <div className="relative">
                <Landmark className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={educationOffice}
                  onChange={(e) => setEducationOffice(e.target.value)}
                  placeholder="ឧ. ការិយាល័យអប់រំ យុវជន និងកីឡាស្រុកសំឡូត"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                កម្រងសាលារៀន
              </span>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={schoolCluster}
                  onChange={(e) => setSchoolCluster(e.target.value)}
                  placeholder="ឧ. កម្រងសាលារៀន សុវណ្ណគិរី"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>

            <label className="sm:col-span-2 block space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                សាលារៀន
              </span>
              <div className="relative">
                <School className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="ឧ. សាលាបឋមសិក្សា..."
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary min-h-[42px] px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="btn-primary min-h-[42px] px-5 rounded-xl text-xs font-bold cursor-pointer"
            >
              រក្សាទុកព័ត៌មាន
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

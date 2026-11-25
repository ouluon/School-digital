import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AttendanceByMonth,
  AttendanceReasonsByMonth,
  ClassSettings,
  CompetencyRubricsByMonth,
  CompetencyRubricsByTerm,
  DomainGradesByTerm,
  MonthlyScoresByMonth,
  RemarksMap,
  SemesterScoresByTerm,
  SpreadsheetInfo,
  Student,
  sanitizeCustomSemesterSubjectLabels,
  sanitizeCustomSubjectLabels,
  sanitizeHiddenAnnualCompetencyKeys,
  sanitizeHiddenMonthlySubjectKeys,
  sanitizeHiddenSemesterSubjectKeys,
} from '../types/gradebook';
import {
  ATTITUDE_ITEM_IDS,
  SKILL_ITEM_IDS,
} from '../constants/competencyRubrics';
import { db, handleFirestoreError, OperationType } from './firebase';

const DEFAULT_GRADEBOOK_ID = 'default';
const UID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_SKILL_ID_SET = new Set(SKILL_ITEM_IDS);
const VALID_ATTITUDE_ID_SET = new Set(ATTITUDE_ITEM_IDS);

export interface GradebookCloudPayload {
  settings: ClassSettings;
  students: Student[];
  attendanceByMonth: AttendanceByMonth;
  attendanceReasonsByMonth?: AttendanceReasonsByMonth;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  competencyRubricsByMonth?: CompetencyRubricsByMonth;
  semesterScoresByTerm: SemesterScoresByTerm;
  competencyRubricsByTerm?: CompetencyRubricsByTerm;
  domainGradesByTerm: DomainGradesByTerm;
  remarks: RemarksMap;
  activeSheet: SpreadsheetInfo | null;
}

export interface LoadedCloudGradebook extends GradebookCloudPayload {
  attendanceReasonsByMonth: AttendanceReasonsByMonth;
  competencyRubricsByMonth: CompetencyRubricsByMonth;
  competencyRubricsByTerm: CompetencyRubricsByTerm;
  updatedAtMs: number;
}

const createdAtCache = new Map<string, Timestamp>();

function isValidUid(uid?: string | null): uid is string {
  return Boolean(uid && uid.length >= 1 && uid.length <= 128 && UID_REGEX.test(uid));
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (typeof v === 'number' && Number.isNaN(v)) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

function sanitizeActiveSheet(sheet: SpreadsheetInfo | null): SpreadsheetInfo | null {
  if (!sheet || !sheet.spreadsheetId || !sheet.title || !sheet.url) return null;
  return {
    spreadsheetId: String(sheet.spreadsheetId).slice(0, 200),
    title: String(sheet.title).slice(0, 300),
    url: String(sheet.url).slice(0, 500),
  };
}

function clampMapKeys<T extends Record<string, unknown>>(obj: T | undefined, maxKeys: number, keepLatest = false): T {
  const entries = Object.entries(obj || {});
  const sliced =
    entries.length > maxKeys
      ? keepLatest
        ? entries.slice(entries.length - maxKeys)
        : entries.slice(0, maxKeys)
      : entries;
  return Object.fromEntries(sliced) as T;
}

function sanitizeAttendanceReasons(
  reasonsByMonth?: AttendanceReasonsByMonth
): AttendanceReasonsByMonth {
  const clamped = clampMapKeys(stripUndefinedDeep(reasonsByMonth || {}), 36, true);
  const out: AttendanceReasonsByMonth = {};
  for (const [mKey, stuMap] of Object.entries(clamped)) {
    if (!stuMap || typeof stuMap !== 'object') continue;
    const cleanStuMap: Record<string, Record<number, string>> = {};
    for (const [stuId, dayMap] of Object.entries(stuMap).slice(0, 200)) {
      if (!dayMap || typeof dayMap !== 'object') continue;
      const cleanDayMap: Record<number, string> = {};
      for (const [dayKey, reason] of Object.entries(dayMap)) {
        const day = Number(dayKey);
        if (day >= 1 && day <= 31 && typeof reason === 'string' && reason.trim()) {
          cleanDayMap[day] = reason.trim().slice(0, 120);
        }
      }
      if (Object.keys(cleanDayMap).length > 0) {
        cleanStuMap[stuId] = cleanDayMap;
      }
    }
    if (Object.keys(cleanStuMap).length > 0) {
      out[mKey] = cleanStuMap;
    }
  }
  return out;
}

function sanitizeCompetencyRubrics(
  rubricsByPeriod?: Record<string, CompetencyRubricsByMonth[string]>,
  maxPeriodKeys = 36,
  keepLatest = true
): CompetencyRubricsByMonth {
  const clamped = clampMapKeys(
    stripUndefinedDeep(rubricsByPeriod || {}),
    maxPeriodKeys,
    keepLatest
  );
  const out: CompetencyRubricsByMonth = {};
  for (const [mKey, stuMap] of Object.entries(clamped)) {
    if (!stuMap || typeof stuMap !== 'object') continue;
    const cleanStuMap: CompetencyRubricsByMonth[string] = {};
    for (const [stuId, entry] of Object.entries(stuMap).slice(0, 200)) {
      if (!entry || typeof entry !== 'object') continue;
      const cleanEntry: { skills?: Record<string, number>; attitude?: Record<string, number> } = {};
      if (entry.skills && typeof entry.skills === 'object') {
        const cleanSkills: Record<string, number> = {};
        for (const [itemId, score] of Object.entries(entry.skills)) {
          if (
            VALID_SKILL_ID_SET.has(itemId) &&
            typeof score === 'number' &&
            Number.isFinite(score) &&
            score >= 0 &&
            score <= 4
          ) {
            cleanSkills[itemId] = Math.round(score);
          }
        }
        if (Object.keys(cleanSkills).length > 0) {
          cleanEntry.skills = cleanSkills;
        }
      }
      if (entry.attitude && typeof entry.attitude === 'object') {
        const cleanAtt: Record<string, number> = {};
        for (const [itemId, score] of Object.entries(entry.attitude)) {
          if (
            VALID_ATTITUDE_ID_SET.has(itemId) &&
            typeof score === 'number' &&
            Number.isFinite(score) &&
            score >= 0 &&
            score <= 1
          ) {
            cleanAtt[itemId] = Math.round(score);
          }
        }
        if (Object.keys(cleanAtt).length > 0) {
          cleanEntry.attitude = cleanAtt;
        }
      }
      if (cleanEntry.skills || cleanEntry.attitude) {
        cleanStuMap[stuId] = cleanEntry;
      }
    }
    if (Object.keys(cleanStuMap).length > 0) {
      out[mKey] = cleanStuMap;
    }
  }
  return out;
}

function sanitizePayload(uid: string, data: GradebookCloudPayload) {
  const sanitizedRemarks: RemarksMap = {};
  const remarkEntries = Object.entries(data.remarks || {}).slice(0, 200);
  for (const [k, v] of remarkEntries) {
    if (typeof v === 'string') {
      sanitizedRemarks[k] = v.slice(0, 300);
    }
  }

  const rawSettings = clampMapKeys(
    stripUndefinedDeep(data.settings) as unknown as Record<string, unknown>,
    30
  ) as unknown as ClassSettings;
  const cleanCustomLabels = sanitizeCustomSubjectLabels(rawSettings.customSubjectLabels);
  const cleanCustomSemesterLabels = sanitizeCustomSemesterSubjectLabels(
    rawSettings.customSemesterSubjectLabels
  );
  const cleanHiddenMonthlySubjects = sanitizeHiddenMonthlySubjectKeys(
    rawSettings.hiddenMonthlySubjectKeys
  );
  const cleanHiddenSemesterSubjects = sanitizeHiddenSemesterSubjectKeys(
    rawSettings.hiddenSemesterSubjectKeys
  );
  const cleanHiddenAnnualCompetencies = sanitizeHiddenAnnualCompetencyKeys(
    rawSettings.hiddenAnnualCompetencyKeys
  );
  const sanitizedSettings: ClassSettings = {
    ...rawSettings,
    maxScore: 10,
    districtAdmin:
      typeof rawSettings.districtAdmin === 'string'
        ? rawSettings.districtAdmin.trim().slice(0, 150)
        : '',
    educationOffice:
      typeof rawSettings.educationOffice === 'string'
        ? rawSettings.educationOffice.trim().slice(0, 150)
        : '',
    schoolCluster:
      typeof rawSettings.schoolCluster === 'string'
        ? rawSettings.schoolCluster.trim().slice(0, 150)
        : '',
  };
  if (Object.keys(cleanCustomLabels).length > 0) {
    sanitizedSettings.customSubjectLabels = cleanCustomLabels;
  } else {
    delete sanitizedSettings.customSubjectLabels;
  }
  if (Object.keys(cleanCustomSemesterLabels).length > 0) {
    sanitizedSettings.customSemesterSubjectLabels = cleanCustomSemesterLabels;
  } else {
    delete sanitizedSettings.customSemesterSubjectLabels;
  }
  if (cleanHiddenMonthlySubjects.length > 0) {
    sanitizedSettings.hiddenMonthlySubjectKeys = cleanHiddenMonthlySubjects;
  } else {
    delete sanitizedSettings.hiddenMonthlySubjectKeys;
  }
  if (cleanHiddenSemesterSubjects.length > 0) {
    sanitizedSettings.hiddenSemesterSubjectKeys = cleanHiddenSemesterSubjects;
  } else {
    delete sanitizedSettings.hiddenSemesterSubjectKeys;
  }
  if (cleanHiddenAnnualCompetencies.length > 0) {
    sanitizedSettings.hiddenAnnualCompetencyKeys = cleanHiddenAnnualCompetencies;
  } else {
    delete sanitizedSettings.hiddenAnnualCompetencyKeys;
  }

  return {
    userId: uid,
    settings: sanitizedSettings,
    students: stripUndefinedDeep((data.students || []).slice(0, 200)),
    attendanceByMonth: clampMapKeys(stripUndefinedDeep(data.attendanceByMonth || {}), 36, true),
    attendanceReasonsByMonth: sanitizeAttendanceReasons(data.attendanceReasonsByMonth),
    monthlyScoresByMonth: clampMapKeys(stripUndefinedDeep(data.monthlyScoresByMonth || {}), 36, true),
    competencyRubricsByMonth: sanitizeCompetencyRubrics(data.competencyRubricsByMonth, 36, true),
    semesterScoresByTerm: clampMapKeys(stripUndefinedDeep(data.semesterScoresByTerm || {}), 6),
    competencyRubricsByTerm: sanitizeCompetencyRubrics(data.competencyRubricsByTerm, 6, false),
    domainGradesByTerm: clampMapKeys(stripUndefinedDeep(data.domainGradesByTerm || {}), 6),
    remarks: sanitizedRemarks,
    activeSheet: sanitizeActiveSheet(data.activeSheet),
  };
}

export async function loadUserGradebookFromCloud(
  uid: string
): Promise<LoadedCloudGradebook | null> {
  if (!isValidUid(uid)) return null;

  const docPath = `users/${uid}/gradebooks/${DEFAULT_GRADEBOOK_ID}`;
  const docRef = doc(db, 'users', uid, 'gradebooks', DEFAULT_GRADEBOOK_ID);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const raw = snap.data();
    if (raw.createdAt instanceof Timestamp) {
      createdAtCache.set(uid, raw.createdAt);
    }
    const updatedAtMs =
      raw.updatedAt instanceof Timestamp ? raw.updatedAt.toMillis() : Date.now();

    return {
      settings: raw.settings as ClassSettings,
      students: Array.isArray(raw.students) ? (raw.students as Student[]) : [],
      attendanceByMonth: (raw.attendanceByMonth || {}) as AttendanceByMonth,
      attendanceReasonsByMonth: (raw.attendanceReasonsByMonth || {}) as AttendanceReasonsByMonth,
      monthlyScoresByMonth: (raw.monthlyScoresByMonth || {}) as MonthlyScoresByMonth,
      competencyRubricsByMonth: (raw.competencyRubricsByMonth || {}) as CompetencyRubricsByMonth,
      semesterScoresByTerm: (raw.semesterScoresByTerm || {}) as SemesterScoresByTerm,
      competencyRubricsByTerm: (raw.competencyRubricsByTerm || {}) as CompetencyRubricsByTerm,
      domainGradesByTerm: (raw.domainGradesByTerm || {}) as DomainGradesByTerm,
      remarks: (raw.remarks || {}) as RemarksMap,
      activeSheet: (raw.activeSheet || null) as SpreadsheetInfo | null,
      updatedAtMs,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveUserGradebookToCloud(
  uid: string,
  payload: GradebookCloudPayload
): Promise<void> {
  if (!isValidUid(uid)) return;

  const clean = sanitizePayload(uid, payload);
  const gradebookPath = `users/${uid}/gradebooks/${DEFAULT_GRADEBOOK_ID}`;
  const gradebookRef = doc(db, 'users', uid, 'gradebooks', DEFAULT_GRADEBOOK_ID);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let cachedCreatedAt = createdAtCache.get(uid);
  if (!cachedCreatedAt) {
    try {
      const existingSnap = await getDoc(gradebookRef);
      if (existingSnap.exists()) {
        const rawCreated = existingSnap.data().createdAt;
        if (rawCreated instanceof Timestamp) {
          cachedCreatedAt = rawCreated;
          createdAtCache.set(uid, rawCreated);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, gradebookPath);
    }
  }

  if (cachedCreatedAt) {
    try {
      await updateDoc(gradebookRef, {
        settings: clean.settings,
        students: clean.students,
        attendanceByMonth: clean.attendanceByMonth,
        attendanceReasonsByMonth: clean.attendanceReasonsByMonth,
        monthlyScoresByMonth: clean.monthlyScoresByMonth,
        competencyRubricsByMonth: clean.competencyRubricsByMonth,
        semesterScoresByTerm: clean.semesterScoresByTerm,
        competencyRubricsByTerm: clean.competencyRubricsByTerm,
        domainGradesByTerm: clean.domainGradesByTerm,
        remarks: clean.remarks,
        activeSheet: clean.activeSheet,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, gradebookPath);
    }
  }

  let userExists = false;
  try {
    const userSnap = await getDoc(userRef);
    userExists = userSnap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  try {
    if (!userExists) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid,
        createdAt: serverTimestamp(),
      });
      batch.set(gradebookRef, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await setDoc(gradebookRef, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const createdSnap = await getDoc(gradebookRef);
    if (createdSnap.exists() && createdSnap.data().createdAt instanceof Timestamp) {
      createdAtCache.set(uid, createdSnap.data().createdAt as Timestamp);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, gradebookPath);
  }
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  Award,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CloudUpload,
  ExternalLink,
  Loader2,
  LogIn,
  Mail,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import {
  AttendanceByMonth,
  AttendanceMark,
  AttendanceReasonsByMonth,
  ClassSettings,
  CompetencyRubricsByMonth,
  CompetencyRubricsByTerm,
  DEFAULT_SEMESTER_1_MONTHS,
  DEFAULT_SEMESTER_2_MONTHS,
  DomainGradesByTerm,
  Gender,
  KHMER_MONTHS,
  MonthlyScoresByMonth,
  RemarksMap,
  SAMPLE_STUDENTS,
  SemesterScoresByTerm,
  SpreadsheetInfo,
  Student,
  getAttendanceMonthYear,
  getMonthKey,
  getMonthlyScoresMonthYear,
  sanitizeCustomSemesterSubjectLabels,
  sanitizeCustomSubjectLabels,
  sanitizeHiddenAnnualCompetencyKeys,
  sanitizeHiddenMonthlySubjectKeys,
  sanitizeHiddenSemesterSubjectKeys,
} from './types/gradebook';
import {
  CompetencyType,
  evaluateCompetencyRubric,
} from './constants/competencyRubrics';
import {
  canUseRedirectFlow,
  clearAccessToken,
  emailSignIn,
  emailSignUp,
  getAccessToken,
  googleSignIn,
  googleSignInWithRedirect,
  initAuth,
  isInAppBrowser,
  isInIframe,
  logout,
  refreshVerifiedUser,
  resendVerificationEmail,
  sendPasswordReset,
  toFriendlyGoogleAuthError,
} from './services/googleAuth';
import {
  buildSyncPlan,
  createFormattedGradebookSheet,
  DriveSheetFile,
  GoogleApiError,
  listAppSpreadsheets,
  loadDataFromSpreadsheet,
  syncDataToSpreadsheet,
} from './services/googleSheets';
import {
  CSV_MIME_TYPE,
  EXCEL_MIME_TYPE,
  ShareScope,
  buildShareFilename,
  buildShareSummaryText,
  convertXlsxBlobToCsvBlob,
  exportGoogleSheetAsExcelBlob,
  generateLocalShareBlobs,
} from './services/excelExport';
import {
  loadUserGradebookFromCloud,
  saveUserGradebookToCloud,
} from './services/gradebookCloud';
import {
  loadLocalUserProfile,
  loadUserProfileFromCloud,
  saveLocalUserProfile,
  saveUserProfileToCloud,
  updateAuthProfileName,
  UserProfileData,
} from './services/userProfile';
import { UserProfileProvider } from './contexts/UserProfileContext';
import {
  getCalendarYearForAcademicMonth,
  parseAcademicYear,
} from './utils/calculations';
import { AttendanceTab } from './components/AttendanceTab';
import { MonthlyScoresTab } from './components/MonthlyScoresTab';
import { SemesterResultsTab } from './components/SemesterResultsTab';
import { RosterAndSheetTab } from './components/RosterAndSheetTab';
import { AuthModal, AuthModalMode } from './components/AuthModal';
import { AccountProfileModal } from './components/AccountProfileModal';
import { UserProfileMenu } from './components/UserProfileMenu';
import { ConfirmSyncModal, PendingSyncSummary } from './components/ConfirmSyncModal';
import { ShareExcelModal } from './components/ShareExcelModal';
import {
  RecordToast,
  RecordToastCategory,
  RecordToastPhase,
  RecordToastState,
} from './components/RecordToast';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ThemeMode,
  applyThemeMode,
  getInitialThemeMode,
  saveThemeMode,
} from './utils/theme';

type TabKey = 'attendance' | 'monthly' | 'semester' | 'roster';

const DRAFT_STORAGE_KEY_V2 = 'khmer_classbook_draft_v2';
const DRAFT_STORAGE_KEY_V1 = 'khmer_classbook_draft_v1';

interface DraftState {
  settings: ClassSettings;
  students: Student[];
  attendanceByMonth: AttendanceByMonth;
  attendanceReasonsByMonth: AttendanceReasonsByMonth;
  monthlyScoresByMonth: MonthlyScoresByMonth;
  competencyRubricsByMonth: CompetencyRubricsByMonth;
  semesterScoresByTerm: SemesterScoresByTerm;
  competencyRubricsByTerm: CompetencyRubricsByTerm;
  domainGradesByTerm: DomainGradesByTerm;
  remarks: RemarksMap;
  activeSheet: SpreadsheetInfo | null;
  updatedAt?: number;
  pendingSheetSync?: boolean;
  hasLocalRecord?: boolean;
}

const now = new Date();
const defaultAcademicStart =
  now.getMonth() + 1 >= 11 ? now.getFullYear() : now.getFullYear() - 1;
const DEFAULT_SETTINGS: ClassSettings = {
  schoolName: 'សាលាបឋមសិក្សា',
  districtAdmin: '',
  educationOffice: '',
  schoolCluster: '',
  className: '',
  teacherName: '',
  academicYear: `${defaultAcademicStart}-${defaultAcademicStart + 1}`,
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  attendanceMonth: now.getMonth() + 1,
  attendanceYear: now.getFullYear(),
  monthlyMonth: now.getMonth() + 1,
  monthlyYear: now.getFullYear(),
  semester: 1,
  maxScore: 10,
  semester1Months: DEFAULT_SEMESTER_1_MONTHS,
  semester2Months: DEFAULT_SEMESTER_2_MONTHS,
};

function getDraftStorageKey(uid?: string | null): string {
  return uid ? `${DRAFT_STORAGE_KEY_V2}_${uid}` : DRAFT_STORAGE_KEY_V2;
}

function createFreshDraft(authedUser?: User | null): DraftState {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      teacherName: authedUser?.displayName || DEFAULT_SETTINGS.teacherName,
    },
    students: authedUser ? SAMPLE_STUDENTS : [],
    attendanceByMonth: {},
    attendanceReasonsByMonth: {},
    monthlyScoresByMonth: {},
    competencyRubricsByMonth: {},
    semesterScoresByTerm: {},
    competencyRubricsByTerm: {},
    domainGradesByTerm: {},
    remarks: {},
    activeSheet: null,
  };
}

function createSignedOutDraft(): DraftState {
  return {
    settings: { ...DEFAULT_SETTINGS },
    students: [],
    attendanceByMonth: {},
    attendanceReasonsByMonth: {},
    monthlyScoresByMonth: {},
    competencyRubricsByMonth: {},
    semesterScoresByTerm: {},
    competencyRubricsByTerm: {},
    domainGradesByTerm: {},
    remarks: {},
    activeSheet: null,
    updatedAt: 0,
    pendingSheetSync: false,
    hasLocalRecord: false,
  };
}

function normalizeLoadedSettings(rawSettings: Partial<ClassSettings> | undefined): ClassSettings {
  const s = rawSettings || {};
  const baseMonth = typeof s.month === 'number' ? s.month : DEFAULT_SETTINGS.month;
  const baseYear = typeof s.year === 'number' ? s.year : DEFAULT_SETTINGS.year;
  const cleanCustomLabels = sanitizeCustomSubjectLabels(s.customSubjectLabels);
  const cleanCustomSemesterLabels = sanitizeCustomSemesterSubjectLabels(
    s.customSemesterSubjectLabels
  );
  const cleanHiddenMonthlySubjects = sanitizeHiddenMonthlySubjectKeys(
    s.hiddenMonthlySubjectKeys
  );
  const cleanHiddenSemesterSubjects = sanitizeHiddenSemesterSubjectKeys(
    s.hiddenSemesterSubjectKeys
  );
  const cleanHiddenAnnualCompetencies = sanitizeHiddenAnnualCompetencyKeys(
    s.hiddenAnnualCompetencyKeys
  );
  const normalized: ClassSettings = {
    ...DEFAULT_SETTINGS,
    ...s,
    districtAdmin: typeof s.districtAdmin === 'string' ? s.districtAdmin : '',
    educationOffice: typeof s.educationOffice === 'string' ? s.educationOffice : '',
    schoolCluster: typeof s.schoolCluster === 'string' ? s.schoolCluster : '',
    maxScore: 10,
    attendanceMonth:
      typeof s.attendanceMonth === 'number' ? s.attendanceMonth : baseMonth,
    attendanceYear:
      typeof s.attendanceYear === 'number' ? s.attendanceYear : baseYear,
    monthlyMonth:
      typeof s.monthlyMonth === 'number' ? s.monthlyMonth : baseMonth,
    monthlyYear:
      typeof s.monthlyYear === 'number' ? s.monthlyYear : baseYear,
    semester1Months: Array.isArray(s.semester1Months)
      ? s.semester1Months
      : DEFAULT_SEMESTER_1_MONTHS,
    semester2Months: Array.isArray(s.semester2Months)
      ? s.semester2Months
      : DEFAULT_SEMESTER_2_MONTHS,
  };
  if (Object.keys(cleanCustomLabels).length > 0) {
    normalized.customSubjectLabels = cleanCustomLabels;
  } else {
    delete normalized.customSubjectLabels;
  }
  if (Object.keys(cleanCustomSemesterLabels).length > 0) {
    normalized.customSemesterSubjectLabels = cleanCustomSemesterLabels;
  } else {
    delete normalized.customSemesterSubjectLabels;
  }
  if (cleanHiddenMonthlySubjects.length > 0) {
    normalized.hiddenMonthlySubjectKeys = cleanHiddenMonthlySubjects;
  } else {
    delete normalized.hiddenMonthlySubjectKeys;
  }
  if (cleanHiddenSemesterSubjects.length > 0) {
    normalized.hiddenSemesterSubjectKeys = cleanHiddenSemesterSubjects;
  } else {
    delete normalized.hiddenSemesterSubjectKeys;
  }
  if (cleanHiddenAnnualCompetencies.length > 0) {
    normalized.hiddenAnnualCompetencyKeys = cleanHiddenAnnualCompetencies;
  } else {
    delete normalized.hiddenAnnualCompetencyKeys;
  }
  return normalized;
}

function loadDraft(uid?: string | null, authedUser?: User | null): DraftState {
  try {
    const rawV2 = localStorage.getItem(getDraftStorageKey(uid));
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      const parsedUpdatedAt =
        typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
      if (!uid && parsedUpdatedAt <= 0) {
        return createSignedOutDraft();
      }
      return {
        settings: normalizeLoadedSettings(parsed.settings),
        students: Array.isArray(parsed.students)
          ? parsed.students
          : uid
          ? SAMPLE_STUDENTS
          : [],
        attendanceByMonth: parsed.attendanceByMonth || {},
        attendanceReasonsByMonth: parsed.attendanceReasonsByMonth || {},
        monthlyScoresByMonth: parsed.monthlyScoresByMonth || {},
        competencyRubricsByMonth: parsed.competencyRubricsByMonth || {},
        semesterScoresByTerm: parsed.semesterScoresByTerm || {},
        competencyRubricsByTerm: parsed.competencyRubricsByTerm || {},
        domainGradesByTerm: parsed.domainGradesByTerm || {},
        remarks: parsed.remarks || {},
        activeSheet: parsed.activeSheet || null,
        updatedAt: parsedUpdatedAt,
        pendingSheetSync: Boolean(parsed.pendingSheetSync),
        hasLocalRecord: true,
      };
    }

    // For a logged-in account with no saved per-UID draft yet, start with a clean account workspace
    if (uid) {
      return {
        ...createFreshDraft(authedUser),
        updatedAt: 0,
        pendingSheetSync: false,
        hasLocalRecord: false,
      };
    }
  } catch {
    // ignore storage errors
  }
  return uid
    ? {
        ...createFreshDraft(authedUser),
        updatedAt: 0,
        pendingSheetSync: false,
        hasLocalRecord: false,
      }
    : createSignedOutDraft();
}

export default function App() {
  const initialDraft = useMemo(() => loadDraft(null), []);
  const [draftOwnerUid, setDraftOwnerUid] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialThemeMode());

  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [settings, setSettings] = useState<ClassSettings>(initialDraft.settings);
  const [students, setStudents] = useState<Student[]>(initialDraft.students);
  const [attendanceByMonth, setAttendanceByMonth] = useState<AttendanceByMonth>(
    initialDraft.attendanceByMonth
  );
  const [attendanceReasonsByMonth, setAttendanceReasonsByMonth] =
    useState<AttendanceReasonsByMonth>(initialDraft.attendanceReasonsByMonth);
  const [monthlyScoresByMonth, setMonthlyScoresByMonth] = useState<MonthlyScoresByMonth>(
    initialDraft.monthlyScoresByMonth
  );
  const [competencyRubricsByMonth, setCompetencyRubricsByMonth] =
    useState<CompetencyRubricsByMonth>(initialDraft.competencyRubricsByMonth);
  const [semesterScoresByTerm, setSemesterScoresByTerm] = useState<SemesterScoresByTerm>(
    initialDraft.semesterScoresByTerm
  );
  const [competencyRubricsByTerm, setCompetencyRubricsByTerm] =
    useState<CompetencyRubricsByTerm>(initialDraft.competencyRubricsByTerm);
  const [domainGradesByTerm, setDomainGradesByTerm] = useState<DomainGradesByTerm>(
    initialDraft.domainGradesByTerm
  );
  const [remarks, setRemarks] = useState<RemarksMap>(initialDraft.remarks);
  const [activeSheet, setActiveSheet] = useState<SpreadsheetInfo | null>(
    initialDraft.activeSheet
  );

  // Auth & Workspace state (tokens stored strictly in memory via googleAuth.ts)
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [authRefreshTick, setAuthRefreshTick] = useState(0);
  const [hasToken, setHasToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isHydratingAccount, setIsHydratingAccount] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: AuthModalMode;
  }>({ open: false, mode: 'signup' });
  const [driveFiles, setDriveFiles] = useState<DriveSheetFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const isEmailVerified = Boolean(user?.emailVerified) && authRefreshTick >= 0;

  // Sync & Feedback state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(
    Boolean(initialDraft.pendingSheetSync)
  );
  const [editVersion, setEditVersion] = useState(0);
  const [autoSaveState, setAutoSaveState] = useState<
    'idle' | 'saving' | 'saved_local' | 'saved_cloud' | 'synced_sheet'
  >(initialDraft.hasLocalRecord ? 'saved_local' : 'idle');
  const [pendingSync, setPendingSync] = useState<PendingSyncSummary | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [shareModal, setShareModal] = useState<{
    open: boolean;
    scope: ShareScope;
    file: File | null;
    csvFile: File | null;
    sourceLabel: string;
    summaryText: string;
  }>({
    open: false,
    scope: 'attendance',
    file: null,
    csvFile: null,
    sourceLabel: '',
    summaryText: '',
  });
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    isAuthHelp?: boolean;
  } | null>(null);
  const [recordToast, setRecordToast] = useState<RecordToastState | null>(null);

  useEffect(() => {
    applyThemeMode(themeMode);
  }, [themeMode]);

  const handleChangeTheme = (nextMode: ThemeMode) => {
    saveThemeMode(nextMode);
    applyThemeMode(nextMode);
    setThemeMode(nextMode);
  };

  const { month: attendanceMonth, year: attendanceYear } = getAttendanceMonthYear(settings);
  const { month: monthlyMonth, year: monthlyYear } = getMonthlyScoresMonthYear(settings);

  const attendanceMonthKey = getMonthKey(attendanceYear, attendanceMonth);
  const monthlyMonthKey = getMonthKey(monthlyYear, monthlyMonth);
  const currentTermKey = String(settings.semester);

  const currentAttendance = attendanceByMonth[attendanceMonthKey] || {};
  const currentAttendanceReasons = attendanceReasonsByMonth[attendanceMonthKey] || {};
  const currentMonthlyScores = monthlyScoresByMonth[monthlyMonthKey] || {};
  const currentCompetencyRubrics = competencyRubricsByMonth[monthlyMonthKey] || {};
  const currentSemesterScores = semesterScoresByTerm[currentTermKey] || {};
  const currentSemesterCompetencyRubrics = competencyRubricsByTerm[currentTermKey] || {};
  const currentDomainGrades = domainGradesByTerm[currentTermKey] || {};

  const activeUidRef = useRef<string | null>(null);
  const hydratedSessionRef = useRef<string | null>(null);
  const inFlightHydrationRef = useRef<Promise<void> | null>(null);
  const lastEditedAtRef = useRef<number>(initialDraft.updatedAt || 0);
  const pendingCloudSaveRef = useRef<boolean>(false);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordToastRef = useRef<RecordToastState | null>(null);
  recordToastRef.current = recordToast;
  const toastSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastPausedRef = useRef<boolean>(false);
  const toastIdSeqRef = useRef<number>(1);

  const latestWorkspaceRef = useRef<{
    user: User | null;
    hasToken: boolean;
    settings: ClassSettings;
    students: Student[];
    attendanceByMonth: AttendanceByMonth;
    attendanceReasonsByMonth: AttendanceReasonsByMonth;
    monthlyScoresByMonth: MonthlyScoresByMonth;
    competencyRubricsByMonth: CompetencyRubricsByMonth;
    semesterScoresByTerm: SemesterScoresByTerm;
    competencyRubricsByTerm: CompetencyRubricsByTerm;
    domainGradesByTerm: DomainGradesByTerm;
    remarks: RemarksMap;
    activeSheet: SpreadsheetInfo | null;
    hasUnsavedChanges: boolean;
  }>({
    user,
    hasToken,
    settings,
    students,
    attendanceByMonth,
    attendanceReasonsByMonth,
    monthlyScoresByMonth,
    competencyRubricsByMonth,
    semesterScoresByTerm,
    competencyRubricsByTerm,
    domainGradesByTerm,
    remarks,
    activeSheet,
    hasUnsavedChanges,
  });

  latestWorkspaceRef.current = {
    user,
    hasToken,
    settings,
    students,
    attendanceByMonth,
    attendanceReasonsByMonth,
    monthlyScoresByMonth,
    competencyRubricsByMonth,
    semesterScoresByTerm,
    competencyRubricsByTerm,
    domainGradesByTerm,
    remarks,
    activeSheet,
    hasUnsavedChanges,
  };

  const applyWorkspaceDraft = (draft: DraftState, ownerUid: string | null) => {
    setDraftOwnerUid(ownerUid);
    setSettings(draft.settings);
    setStudents(draft.students);
    setAttendanceByMonth(draft.attendanceByMonth);
    setAttendanceReasonsByMonth(draft.attendanceReasonsByMonth);
    setMonthlyScoresByMonth(draft.monthlyScoresByMonth);
    setCompetencyRubricsByMonth(draft.competencyRubricsByMonth);
    setSemesterScoresByTerm(draft.semesterScoresByTerm);
    setCompetencyRubricsByTerm(draft.competencyRubricsByTerm);
    setDomainGradesByTerm(draft.domainGradesByTerm);
    setRemarks(draft.remarks);
    setActiveSheet(draft.activeSheet);
    lastEditedAtRef.current = draft.updatedAt || 0;
  };

  const clearToastTimers = () => {
    if (toastSettleTimerRef.current) {
      clearTimeout(toastSettleTimerRef.current);
      toastSettleTimerRef.current = null;
    }
    if (toastDismissTimerRef.current) {
      clearTimeout(toastDismissTimerRef.current);
      toastDismissTimerRef.current = null;
    }
  };

  const scheduleToastDismiss = (delayMs = 2600) => {
    if (toastDismissTimerRef.current) {
      clearTimeout(toastDismissTimerRef.current);
      toastDismissTimerRef.current = null;
    }
    if (toastPausedRef.current) return;
    toastDismissTimerRef.current = setTimeout(() => {
      setRecordToast(null);
      toastDismissTimerRef.current = null;
    }, delayMs);
  };

  const dismissRecordToast = () => {
    clearToastTimers();
    toastPausedRef.current = false;
    setRecordToast(null);
  };

  const notifyRecordingEdit = (category: RecordToastCategory, detail?: string) => {
    clearToastTimers();
    setRecordToast((prev) => ({
      id: prev ? prev.id : toastIdSeqRef.current++,
      category,
      phase: 'recording',
      detail,
    }));

    const willAutoCloudSave = Boolean(user?.uid && isEmailVerified);
    if (!willAutoCloudSave) {
      toastSettleTimerRef.current = setTimeout(() => {
        toastSettleTimerRef.current = null;
        setRecordToast((prev) =>
          prev ? { ...prev, phase: 'saved_local' } : null
        );
        scheduleToastDismiss(2500);
      }, 400);
    }
  };

  const showAuthToast = (customTitle: string, detail?: string) => {
    clearToastTimers();
    toastPausedRef.current = false;
    setRecordToast({
      id: toastIdSeqRef.current++,
      category: 'auth',
      phase: 'saved_cloud',
      customTitle,
      detail,
    });
    scheduleToastDismiss(3000);
  };

  const handlePauseToastDismiss = () => {
    toastPausedRef.current = true;
    if (toastDismissTimerRef.current) {
      clearTimeout(toastDismissTimerRef.current);
      toastDismissTimerRef.current = null;
    }
  };

  const handleResumeToastDismiss = () => {
    toastPausedRef.current = false;
    if (recordToastRef.current && recordToastRef.current.phase !== 'recording') {
      scheduleToastDismiss(1800);
    }
  };

  const markDataEdited = (requiresSheetSync = true) => {
    lastEditedAtRef.current = Date.now();
    if (requiresSheetSync) {
      setHasUnsavedChanges(true);
    }
    setAutoSaveState('saving');
    setEditVersion((v) => v + 1);
  };

  const flushCloudAutoSave = async () => {
    const snap = latestWorkspaceRef.current;
    const uid = snap.user?.uid;
    if (!uid || !snap.user?.emailVerified) {
      pendingCloudSaveRef.current = false;
      setAutoSaveState('saved_local');
      return;
    }
    pendingCloudSaveRef.current = false;
    try {
      await saveUserGradebookToCloud(uid, {
        settings: snap.settings,
        students: snap.students,
        attendanceByMonth: snap.attendanceByMonth,
        attendanceReasonsByMonth: snap.attendanceReasonsByMonth,
        monthlyScoresByMonth: snap.monthlyScoresByMonth,
        competencyRubricsByMonth: snap.competencyRubricsByMonth,
        semesterScoresByTerm: snap.semesterScoresByTerm,
        competencyRubricsByTerm: snap.competencyRubricsByTerm,
        domainGradesByTerm: snap.domainGradesByTerm,
        remarks: snap.remarks,
        activeSheet: snap.activeSheet,
      });
      setAutoSaveState((prev) => (prev === 'synced_sheet' ? 'synced_sheet' : 'saved_cloud'));
    } catch {
      setAutoSaveState('saved_local');
    }
  };

  const flushSheetAutoSync = async () => {
    const snap = latestWorkspaceRef.current;
    const token = getAccessToken();
    if (!token || !snap.activeSheet || !snap.hasUnsavedChanges) return;
    try {
      const updated = await syncDataToSpreadsheet(
        token,
        snap.activeSheet.spreadsheetId,
        snap.settings,
        snap.students,
        snap.attendanceByMonth,
        snap.monthlyScoresByMonth,
        snap.semesterScoresByTerm,
        snap.domainGradesByTerm,
        snap.remarks
      );
      setActiveSheet(updated);
      setHasUnsavedChanges(false);
      setAutoSaveState('synced_sheet');
    } catch (err) {
      if (err instanceof GoogleApiError && (err.status === 401 || err.status === 403)) {
        clearAccessToken();
        setHasToken(false);
      }
    }
  };

  // Automatic debounced cloud + Google Sheet save whenever data is edited
  useEffect(() => {
    if (editVersion === 0) return;

    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    if (sheetSyncTimerRef.current) clearTimeout(sheetSyncTimerRef.current);

    if (!user?.uid || !isEmailVerified) {
      pendingCloudSaveRef.current = false;
      setAutoSaveState('saved_local');
      return;
    }

    pendingCloudSaveRef.current = true;
    setAutoSaveState('saving');

    cloudSaveTimerRef.current = setTimeout(() => {
      void flushCloudAutoSave();
    }, 650);

    if (hasToken && activeSheet) {
      sheetSyncTimerRef.current = setTimeout(() => {
        void flushSheetAutoSync();
      }, 2000);
    }
  }, [editVersion, user?.uid, isEmailVerified, hasToken, activeSheet?.spreadsheetId]);

  // Flush pending cloud save immediately when minimizing or closing the app
  useEffect(() => {
    const flushNow = () => {
      if (pendingCloudSaveRef.current) {
        if (cloudSaveTimerRef.current) {
          clearTimeout(cloudSaveTimerRef.current);
          cloudSaveTimerRef.current = null;
        }
        void flushCloudAutoSave();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushNow);
    };
  }, []);

  // Synchronize active recording toast with auto-save completion
  useEffect(() => {
    if (!recordToastRef.current) return;
    if (
      autoSaveState !== 'saved_cloud' &&
      autoSaveState !== 'synced_sheet' &&
      autoSaveState !== 'saved_local'
    ) {
      return;
    }
    if (autoSaveState === 'saved_local' && toastSettleTimerRef.current) {
      return;
    }

    const nextPhase: RecordToastPhase =
      autoSaveState === 'synced_sheet'
        ? 'synced_sheet'
        : autoSaveState === 'saved_cloud'
        ? 'saved_cloud'
        : 'saved_local';

    setRecordToast((prev) => (prev ? { ...prev, phase: nextPhase } : null));
    scheduleToastDismiss(autoSaveState === 'synced_sheet' ? 2200 : 2800);
  }, [autoSaveState]);

  useEffect(() => {
    return () => clearToastTimers();
  }, []);

  // Save draft classroom edits locally per account immediately (no tokens stored)
  useEffect(() => {
    const targetUid = user?.uid ?? null;
    if (draftOwnerUid !== targetUid) return;
    try {
      const payload: DraftState = {
        settings,
        students,
        attendanceByMonth,
        attendanceReasonsByMonth,
        monthlyScoresByMonth,
        competencyRubricsByMonth,
        semesterScoresByTerm,
        competencyRubricsByTerm,
        domainGradesByTerm,
        remarks,
        activeSheet,
        updatedAt: lastEditedAtRef.current,
        pendingSheetSync: hasUnsavedChanges,
      };
      localStorage.setItem(getDraftStorageKey(targetUid), JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [
    user?.uid,
    draftOwnerUid,
    settings,
    students,
    attendanceByMonth,
    attendanceReasonsByMonth,
    monthlyScoresByMonth,
    competencyRubricsByMonth,
    semesterScoresByTerm,
    competencyRubricsByTerm,
    domainGradesByTerm,
    remarks,
    activeSheet,
    hasUnsavedChanges,
  ]);

  const refreshDriveFiles = async (tokenOverride?: string): Promise<DriveSheetFile[]> => {
    const token = tokenOverride || getAccessToken();
    if (!token) return [];
    setIsLoadingFiles(true);
    try {
      const files = await listAppSpreadsheets(token);
      setDriveFiles(files);
      return files;
    } catch (err) {
      if (err instanceof GoogleApiError && (err.status === 401 || err.status === 403)) {
        clearAccessToken();
        setHasToken(false);
      }
      return [];
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const syncAccountWorkspaceOnAuth = async (
    authedUser: User,
    token: string | null,
    showSuccessBanner: boolean
  ) => {
    const isAccountChange = activeUidRef.current !== authedUser.uid;
    let workingDraft: DraftState;

    if (isAccountChange) {
      activeUidRef.current = authedUser.uid;
      hydratedSessionRef.current = null;
      inFlightHydrationRef.current = null;
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
      if (sheetSyncTimerRef.current) clearTimeout(sheetSyncTimerRef.current);
      pendingCloudSaveRef.current = false;

      workingDraft = loadDraft(authedUser.uid, authedUser);
      applyWorkspaceDraft(workingDraft, authedUser.uid);
      setUserProfile(loadLocalUserProfile(authedUser.uid));
      setHasUnsavedChanges(Boolean(workingDraft.pendingSheetSync));
      setPendingSync(null);
      setDriveFiles([]);
      setAutoSaveState(workingDraft.hasLocalRecord ? 'saved_local' : 'idle');
      dismissRecordToast();
    } else {
      workingDraft = {
        settings: latestWorkspaceRef.current.settings,
        students: latestWorkspaceRef.current.students,
        attendanceByMonth: latestWorkspaceRef.current.attendanceByMonth,
        attendanceReasonsByMonth: latestWorkspaceRef.current.attendanceReasonsByMonth,
        monthlyScoresByMonth: latestWorkspaceRef.current.monthlyScoresByMonth,
        competencyRubricsByMonth: latestWorkspaceRef.current.competencyRubricsByMonth,
        semesterScoresByTerm: latestWorkspaceRef.current.semesterScoresByTerm,
        competencyRubricsByTerm: latestWorkspaceRef.current.competencyRubricsByTerm,
        domainGradesByTerm: latestWorkspaceRef.current.domainGradesByTerm,
        remarks: latestWorkspaceRef.current.remarks,
        activeSheet: latestWorkspaceRef.current.activeSheet,
        updatedAt: lastEditedAtRef.current,
        pendingSheetSync: latestWorkspaceRef.current.hasUnsavedChanges,
        hasLocalRecord: true,
      };
    }

    const sessionKey = `${authedUser.uid}:${token || 'no-token'}`;
    if (!isAccountChange && hydratedSessionRef.current === sessionKey) {
      if (inFlightHydrationRef.current) {
        await inFlightHydrationRef.current;
      }
      return;
    }
    hydratedSessionRef.current = sessionKey;

    const runHydration = async () => {
      const accountLabel = authedUser.displayName || authedUser.email || 'Google';
      if (token) {
        setIsLoadingFiles(true);
        setIsHydratingAccount(true);
      }
      try {
        // 1. Reconcile local profile & gradebook with Firestore cloud backup first
        const localProfile = loadLocalUserProfile(authedUser.uid);
        let cloudProfile: UserProfileData | null = null;
        try {
          cloudProfile = await loadUserProfileFromCloud(authedUser.uid);
        } catch {
          cloudProfile = null;
        }

        if (cloudProfile) {
          const localProfileTime = localProfile?.updatedAtMs || 0;
          if (!localProfile || (cloudProfile.updatedAtMs || 0) >= localProfileTime) {
            setUserProfile(cloudProfile);
            saveLocalUserProfile(authedUser.uid, cloudProfile);
          } else if (localProfileTime > (cloudProfile.updatedAtMs || 0) && authedUser.emailVerified) {
            setUserProfile(localProfile);
            try {
              await saveUserProfileToCloud(authedUser.uid, localProfile);
            } catch {
              // ignore secondary profile sync error during hydration
            }
          }
        } else if (localProfile) {
          setUserProfile(localProfile);
          if (authedUser.emailVerified) {
            try {
              await saveUserProfileToCloud(authedUser.uid, localProfile);
            } catch {
              // ignore secondary profile sync error during hydration
            }
          }
        }

        let cloudGradebook: Awaited<ReturnType<typeof loadUserGradebookFromCloud>> = null;
        try {
          cloudGradebook = await loadUserGradebookFromCloud(authedUser.uid);
        } catch {
          cloudGradebook = null;
        }

        if (cloudGradebook) {
          const localTime = workingDraft.updatedAt || 0;
          if (!workingDraft.hasLocalRecord || cloudGradebook.updatedAtMs > localTime) {
            const mergedFromCloud: DraftState = {
              settings: normalizeLoadedSettings(cloudGradebook.settings),
              students:
                cloudGradebook.students.length > 0
                  ? cloudGradebook.students
                  : SAMPLE_STUDENTS,
              attendanceByMonth: cloudGradebook.attendanceByMonth,
              attendanceReasonsByMonth: cloudGradebook.attendanceReasonsByMonth,
              monthlyScoresByMonth: cloudGradebook.monthlyScoresByMonth,
              competencyRubricsByMonth: cloudGradebook.competencyRubricsByMonth,
              semesterScoresByTerm: cloudGradebook.semesterScoresByTerm,
              competencyRubricsByTerm: cloudGradebook.competencyRubricsByTerm,
              domainGradesByTerm: cloudGradebook.domainGradesByTerm,
              remarks: cloudGradebook.remarks,
              activeSheet: cloudGradebook.activeSheet,
              updatedAt: cloudGradebook.updatedAtMs,
              pendingSheetSync: workingDraft.pendingSheetSync,
              hasLocalRecord: true,
            };
            workingDraft = mergedFromCloud;
            applyWorkspaceDraft(mergedFromCloud, authedUser.uid);
            setAutoSaveState('saved_cloud');
          } else if (localTime > cloudGradebook.updatedAtMs && authedUser.emailVerified) {
            await saveUserGradebookToCloud(authedUser.uid, {
              settings: workingDraft.settings,
              students: workingDraft.students,
              attendanceByMonth: workingDraft.attendanceByMonth,
              attendanceReasonsByMonth: workingDraft.attendanceReasonsByMonth,
              monthlyScoresByMonth: workingDraft.monthlyScoresByMonth,
              competencyRubricsByMonth: workingDraft.competencyRubricsByMonth,
              semesterScoresByTerm: workingDraft.semesterScoresByTerm,
              competencyRubricsByTerm: workingDraft.competencyRubricsByTerm,
              domainGradesByTerm: workingDraft.domainGradesByTerm,
              remarks: workingDraft.remarks,
              activeSheet: workingDraft.activeSheet,
            });
            setAutoSaveState('saved_cloud');
          } else {
            setAutoSaveState(authedUser.emailVerified ? 'saved_cloud' : 'saved_local');
          }
        } else if (
          authedUser.emailVerified &&
          workingDraft.hasLocalRecord &&
          (workingDraft.updatedAt || 0) > 0
        ) {
          await saveUserGradebookToCloud(authedUser.uid, {
            settings: workingDraft.settings,
            students: workingDraft.students,
            attendanceByMonth: workingDraft.attendanceByMonth,
            attendanceReasonsByMonth: workingDraft.attendanceReasonsByMonth,
            monthlyScoresByMonth: workingDraft.monthlyScoresByMonth,
            competencyRubricsByMonth: workingDraft.competencyRubricsByMonth,
            semesterScoresByTerm: workingDraft.semesterScoresByTerm,
            competencyRubricsByTerm: workingDraft.competencyRubricsByTerm,
            domainGradesByTerm: workingDraft.domainGradesByTerm,
            remarks: workingDraft.remarks,
            activeSheet: workingDraft.activeSheet,
          });
          setAutoSaveState('saved_cloud');
        }

        if (!token) {
          if (authedUser.emailVerified && (showSuccessBanner || isAccountChange)) {
            showAuthToast(
              `បានចូលគណនី ${accountLabel} ដោយជោគជ័យ`,
              cloudGradebook
                ? 'បានផ្ទុកទិន្នន័យដែលបានរក្សាទុកដោយស្វ័យប្រវត្តិ។'
                : 'រក្សាទុកទិន្នន័យលើ Cloud ដោយស្វ័យប្រវត្តិ។'
            );
          }
          return;
        }

        // 2. Fetch Drive spreadsheets and reconcile with Google Sheets
        const files = await listAppSpreadsheets(token);
        setDriveFiles(files);

        const candidateIds: string[] = [];
        if (workingDraft.activeSheet?.spreadsheetId) {
          candidateIds.push(workingDraft.activeSheet.spreadsheetId);
        }
        if (files[0]?.id && !candidateIds.includes(files[0].id)) {
          candidateIds.push(files[0].id);
        }

        // If user already edited offline/cloud and has pending Sheet sync, push those edits to the active sheet instead of overwriting them
        if (workingDraft.pendingSheetSync && workingDraft.activeSheet) {
          try {
            const synced = await syncDataToSpreadsheet(
              token,
              workingDraft.activeSheet.spreadsheetId,
              workingDraft.settings,
              workingDraft.students,
              workingDraft.attendanceByMonth,
              workingDraft.monthlyScoresByMonth,
              workingDraft.semesterScoresByTerm,
              workingDraft.domainGradesByTerm,
              workingDraft.remarks
            );
            setActiveSheet(synced);
            setHasUnsavedChanges(false);
            setAutoSaveState('synced_sheet');
            if (showSuccessBanner || isAccountChange) {
              showAuthToast(
                `បានភ្ជាប់គណនី ${accountLabel}`,
                `បានធ្វើបច្ចុប្បន្នភាពទិន្នន័យទៅ "${synced.title}" ដោយស្វ័យប្រវត្តិ។`
              );
            }
            return;
          } catch (syncErr) {
            if (
              syncErr instanceof GoogleApiError &&
              (syncErr.status === 401 || syncErr.status === 403)
            ) {
              clearAccessToken();
              setHasToken(false);
              return;
            }
          }
        }

        const shouldAutoLoadFromSheet = Boolean(
          candidateIds.length > 0 &&
            (!cloudGradebook ||
              isAccountChange ||
              !workingDraft.activeSheet ||
              !workingDraft.pendingSheetSync)
        );

        // Only overwrite local/cloud workspace from Sheet if we don't have newer unsaved local/cloud edits
        if (shouldAutoLoadFromSheet && !workingDraft.pendingSheetSync && !cloudGradebook) {
          let loadedResult: Awaited<ReturnType<typeof loadDataFromSpreadsheet>> | null = null;
          for (const targetSheetId of candidateIds) {
            try {
              loadedResult = await loadDataFromSpreadsheet(
                token,
                targetSheetId,
                workingDraft.settings
              );
              break;
            } catch (sheetErr) {
              if (
                sheetErr instanceof GoogleApiError &&
                (sheetErr.status === 401 || sheetErr.status === 403)
              ) {
                clearAccessToken();
                setHasToken(false);
                return;
              }
            }
          }

          if (loadedResult) {
            setActiveSheet(loadedResult.info);
            let nextSettings = workingDraft.settings;
            let nextStudents = workingDraft.students;
            let nextAtt = workingDraft.attendanceByMonth;
            const nextAttReasons = workingDraft.attendanceReasonsByMonth;
            let nextMon = workingDraft.monthlyScoresByMonth;
            let nextSem = workingDraft.semesterScoresByTerm;
            let nextDom = workingDraft.domainGradesByTerm;
            let nextRemarks = workingDraft.remarks;

            if (loadedResult.students.length > 0) {
              nextStudents = loadedResult.students;
              nextAtt = loadedResult.attendanceByMonth;
              nextMon = loadedResult.monthlyScoresByMonth;
              nextSem = loadedResult.semesterScoresByTerm;
              nextDom = loadedResult.domainGradesByTerm;
              nextRemarks = loadedResult.remarks;

              setStudents(nextStudents);
              setAttendanceByMonth(nextAtt);
              setMonthlyScoresByMonth(nextMon);
              setSemesterScoresByTerm(nextSem);
              setDomainGradesByTerm(nextDom);
              setRemarks(nextRemarks);

              const parseMonthKey = (key: string) => {
                const [yStr, mStr] = key.split('-');
                const yNum = Number(yStr);
                const mNum = Number(mStr);
                return yNum > 0 && mNum >= 1 && mNum <= 12 ? { year: yNum, month: mNum } : null;
              };
              const attKeys = Object.keys(loadedResult.attendanceByMonth);
              const monKeys = Object.keys(loadedResult.monthlyScoresByMonth);
              const curAttPeriod = getAttendanceMonthYear(workingDraft.settings);
              const curMonPeriod = getMonthlyScoresMonthYear(workingDraft.settings);
              const curAttKey = getMonthKey(curAttPeriod.year, curAttPeriod.month);
              const curMonKey = getMonthKey(curMonPeriod.year, curMonPeriod.month);

              const nextAttFocus =
                attKeys.length > 0 && !loadedResult.attendanceByMonth[curAttKey]
                  ? parseMonthKey(attKeys[attKeys.length - 1])
                  : null;
              const nextMonFocus =
                monKeys.length > 0 && !loadedResult.monthlyScoresByMonth[curMonKey]
                  ? parseMonthKey(monKeys[monKeys.length - 1])
                  : null;

              nextSettings = {
                ...workingDraft.settings,
                teacherName:
                  workingDraft.settings.teacherName || authedUser.displayName || '',
                ...(nextAttFocus
                  ? {
                      attendanceMonth: nextAttFocus.month,
                      attendanceYear: nextAttFocus.year,
                    }
                  : {}),
                ...(nextMonFocus
                  ? {
                      monthlyMonth: nextMonFocus.month,
                      monthlyYear: nextMonFocus.year,
                      month: nextMonFocus.month,
                      year: nextMonFocus.year,
                    }
                  : {}),
              };
              setSettings(nextSettings);
            } else if (!workingDraft.settings.teacherName && authedUser.displayName) {
              nextSettings = {
                ...workingDraft.settings,
                teacherName: authedUser.displayName,
              };
              setSettings(nextSettings);
            }

            setHasUnsavedChanges(false);
            lastEditedAtRef.current = Date.now();
            if (user?.uid || authedUser.uid) {
              if (authedUser.emailVerified) {
                await saveUserGradebookToCloud(authedUser.uid, {
                  settings: nextSettings,
                  students: nextStudents,
                  attendanceByMonth: nextAtt,
                  attendanceReasonsByMonth: nextAttReasons,
                  monthlyScoresByMonth: nextMon,
                  competencyRubricsByMonth: workingDraft.competencyRubricsByMonth,
                  semesterScoresByTerm: nextSem,
                  competencyRubricsByTerm: workingDraft.competencyRubricsByTerm,
                  domainGradesByTerm: nextDom,
                  remarks: nextRemarks,
                  activeSheet: loadedResult.info,
                });
              }
            }
            setAutoSaveState('synced_sheet');

            if (showSuccessBanner || isAccountChange) {
              showAuthToast(
                `បានចូលគណនី ${accountLabel}`,
                `បានផ្ទុកទិន្នន័យពី "${loadedResult.info.title}" (${loadedResult.students.length} សិស្ស) ដោយស្វ័យប្រវត្តិ។`
              );
            }
            return;
          } else if (isAccountChange) {
            setActiveSheet(null);
          }
        }

        if (showSuccessBanner || isAccountChange) {
          if (cloudGradebook) {
            showAuthToast(
              `បានចូលគណនី ${accountLabel}`,
              'បានផ្ទុកទិន្នន័យដែលបានរក្សាទុកដោយស្វ័យប្រវត្តិ។'
            );
          } else if (files.length === 0 && isAccountChange) {
            showAuthToast(
              `បានចូលគណនី ${accountLabel}`,
              'បានផ្ទុកទិន្នន័យគណនីថ្មីដោយស្វ័យប្រវត្តិ។'
            );
          } else {
            showAuthToast(`បានភ្ជាប់គណនី ${accountLabel} ដោយជោគជ័យ`);
          }
        }
      } catch (err) {
        if (err instanceof GoogleApiError && (err.status === 401 || err.status === 403)) {
          clearAccessToken();
          setHasToken(false);
        }
      } finally {
        setIsLoadingFiles(false);
        setIsHydratingAccount(false);
        if (inFlightHydrationRef.current === promise) {
          inFlightHydrationRef.current = null;
        }
      }
    };

    const promise = runHydration();
    inFlightHydrationRef.current = promise;
    await promise;
  };

  useEffect(() => {
    const unsub = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setHasToken(Boolean(token));
        void syncAccountWorkspaceOnAuth(authedUser, token, false);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setHasToken(false);
        if (maybeUser) {
          void syncAccountWorkspaceOnAuth(maybeUser, null, false);
        } else if (activeUidRef.current !== null) {
          activeUidRef.current = null;
          hydratedSessionRef.current = null;
          setUserProfile(null);
          setIsProfileModalOpen(false);
          setDriveFiles([]);
          setPendingSync(null);
          setHasUnsavedChanges(false);
          const signedOutDraft = createSignedOutDraft();
          try {
            localStorage.removeItem(DRAFT_STORAGE_KEY_V1);
            localStorage.setItem(getDraftStorageKey(null), JSON.stringify(signedOutDraft));
          } catch {
            // ignore storage errors
          }
          applyWorkspaceDraft(signedOutDraft, null);
        }
      },
      (authErr) => {
        setBannerMsg({
          type: authErr.isPopupClosed ? 'warning' : 'error',
          text: authErr.message,
          isAuthHelp: authErr.isPopupClosed || authErr.isPopupBlocked,
        });
      }
    );
    return () => unsub();
  }, []);

  const handleSignIn = async (forceSelectAccount = false) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setBannerMsg(null);
    try {
      const result = await googleSignIn({ forceSelectAccount });
      if (!result) {
        // Redirecting away cleanly
        return;
      }
      setUser(result.user);
      setHasToken(true);
      await syncAccountWorkspaceOnAuth(result.user, result.accessToken, true);
    } catch (err: unknown) {
      const friendly = toFriendlyGoogleAuthError(err);
      setBannerMsg({
        type: friendly.isPopupClosed ? 'warning' : 'error',
        text: friendly.message,
        isAuthHelp: friendly.isPopupClosed || friendly.isPopupBlocked,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignInRedirect = async () => {
    setIsLoggingIn(true);
    setBannerMsg(null);
    try {
      await googleSignInWithRedirect();
    } catch (err: unknown) {
      const friendly = toFriendlyGoogleAuthError(err);
      setBannerMsg({
        type: 'error',
        text: friendly.message,
      });
      setIsLoggingIn(false);
    }
  };

  const handleEmailSignUp = async (params: {
    displayName: string;
    email: string;
    password: string;
  }) => {
    const { user: signedUpUser, verificationSent } = await emailSignUp(params);
    setUser(signedUpUser);
    setHasToken(false);
    setAuthRefreshTick((t) => t + 1);
    await syncAccountWorkspaceOnAuth(signedUpUser, null, false);
    setBannerMsg({
      type: verificationSent ? 'success' : 'warning',
      text: verificationSent
        ? `បានបង្កើតគណនី ${signedUpUser.email} រួចរាល់! សូមបើកអ៊ីមែលរបស់អ្នក ហើយចុចតំណបញ្ជាក់ ដើម្បីរក្សាទុកទិន្នន័យលើ Cloud។`
        : `បានបង្កើតគណនី ${signedUpUser.email} រួចរាល់ ប៉ុន្តែមិនអាចផ្ញើអ៊ីមែលបញ្ជាក់ភ្លាមៗបានទេ។ សូមចុច «ផ្ញើតំណបញ្ជាក់ម្តងទៀត»។`,
    });
  };

  const handleEmailSignIn = async (params: {
    email: string;
    password: string;
  }) => {
    const signedInUser = await emailSignIn(params);
    setUser(signedInUser);
    setHasToken(false);
    setAuthRefreshTick((t) => t + 1);
    await syncAccountWorkspaceOnAuth(signedInUser, null, true);
  };

  const handleResetPassword = async (email: string) => {
    await sendPasswordReset(email);
  };

  const handleRefreshVerification = async () => {
    if (isCheckingVerification) return;
    setIsCheckingVerification(true);
    try {
      const refreshed = await refreshVerifiedUser();
      setUser(refreshed);
      setAuthRefreshTick((t) => t + 1);
      if (refreshed?.emailVerified) {
        hydratedSessionRef.current = null;
        await syncAccountWorkspaceOnAuth(refreshed, getAccessToken(), false);
        await flushCloudAutoSave();
        setBannerMsg({
          type: 'success',
          text: `អ៊ីមែល ${refreshed.email} ត្រូវបានបញ្ជាក់រួចរាល់! ប្រព័ន្ធបានបើកការរក្សាទុកលើ Cloud ដោយស្វ័យប្រវត្តិ។`,
        });
      } else {
        setBannerMsg({
          type: 'warning',
          text: 'អ៊ីមែលមិនទាន់ត្រូវបានបញ្ជាក់នៅឡើយទេ។ សូមពិនិត្យ Inbox ឬ Spam រួចចុចតំណបញ្ជាក់ក្នុងអ៊ីមែលជាមុនសិន។',
        });
      }
    } catch (err: unknown) {
      const friendly = toFriendlyGoogleAuthError(err);
      setBannerMsg({ type: 'error', text: friendly.message });
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    if (isResendingVerification) return;
    setIsResendingVerification(true);
    try {
      await resendVerificationEmail();
      setBannerMsg({
        type: 'success',
        text: `បានផ្ញើតំណបញ្ជាក់ទៅកាន់ ${user?.email || 'អ៊ីមែលរបស់អ្នក'} ម្តងទៀតរួចរាល់។ សូមពិនិត្យ Inbox ឬ Spam។`,
      });
    } catch (err: unknown) {
      const friendly = toFriendlyGoogleAuthError(err);
      setBannerMsg({ type: 'error', text: friendly.message });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSignOut = async () => {
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
      cloudSaveTimerRef.current = null;
    }
    if (sheetSyncTimerRef.current) {
      clearTimeout(sheetSyncTimerRef.current);
      sheetSyncTimerRef.current = null;
    }
    if (pendingCloudSaveRef.current && user?.uid && user.emailVerified) {
      await flushCloudAutoSave();
    }
    await logout();
    activeUidRef.current = null;
    hydratedSessionRef.current = null;
    pendingCloudSaveRef.current = false;
    setUser(null);
    setUserProfile(null);
    setIsProfileModalOpen(false);
    setHasToken(false);
    setAuthRefreshTick((t) => t + 1);
    setDriveFiles([]);
    setPendingSync(null);
    setHasUnsavedChanges(false);
    setAutoSaveState('idle');
    dismissRecordToast();
    const signedOutDraft = createSignedOutDraft();
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY_V1);
      localStorage.setItem(getDraftStorageKey(null), JSON.stringify(signedOutDraft));
    } catch {
      // ignore storage errors
    }
    applyWorkspaceDraft(signedOutDraft, null);
    setBannerMsg({
      type: 'success',
      text: 'បានចាកចេញពីគណនីរួចរាល់។',
    });
  };

  const handleSaveUserProfile = async (
    nextProfile: UserProfileData,
    options: { syncToClassSettings: boolean }
  ) => {
    if (!user?.uid) return;

    const stampedProfile: UserProfileData = {
      ...nextProfile,
      updatedAtMs: Date.now(),
    };

    saveLocalUserProfile(user.uid, stampedProfile);
    setUserProfile(stampedProfile);

    try {
      await updateAuthProfileName(stampedProfile.displayName);
      setAuthRefreshTick((t) => t + 1);
    } catch {
      // Keep local/cloud profile saved even if Firebase Auth displayName update fails
    }

    if (options.syncToClassSettings) {
      setSettings((prev) => ({
        ...prev,
        teacherName: stampedProfile.displayName || prev.teacherName,
        schoolName: stampedProfile.schoolName?.trim()
          ? stampedProfile.schoolName.trim()
          : prev.schoolName,
      }));
      markDataEdited(true);
    }

    if (user.emailVerified) {
      await saveUserProfileToCloud(user.uid, stampedProfile);
      setBannerMsg({
        type: 'success',
        text: 'បានរក្សាទុកព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត Profile ទៅលើ Cloud រួចរាល់។',
      });
    } else {
      setBannerMsg({
        type: 'success',
        text: 'បានរក្សាទុកព័ត៌មានផ្ទាល់ខ្លួន និងរូបថត Profile ក្នុងឧបករណ៍រួចរាល់។',
      });
    }
  };

  // Counts across all entered months and semesters for confirmation modal
  const countsSummary = useMemo(() => {
    let attendanceChangesCount = 0;
    Object.values(attendanceByMonth).forEach((monthMap) => {
      Object.values(monthMap).forEach((stuDays) => {
        Object.values(stuDays).forEach((mark) => {
          if (mark === 'ច្ប' || mark === 'ឈ' || mark === 'អច្ប') attendanceChangesCount++;
        });
      });
    });

    let monthlyScoreCount = 0;
    Object.values(monthlyScoresByMonth).forEach((monthMap) => {
      Object.values(monthMap).forEach((stuScores) => {
        Object.values(stuScores).forEach((val) => {
          if (typeof val === 'number') monthlyScoreCount++;
        });
      });
    });

    let semesterScoreCount = 0;
    Object.values(semesterScoresByTerm).forEach((termMap) => {
      Object.values(termMap).forEach((stuScores) => {
        Object.values(stuScores).forEach((val) => {
          if (typeof val === 'number') semesterScoreCount++;
        });
      });
    });

    return { attendanceChangesCount, monthlyScoreCount, semesterScoreCount };
  }, [attendanceByMonth, monthlyScoresByMonth, semesterScoresByTerm]);

  const openCreateSheetConfirm = (customTitle?: string) => {
    const activePeriod =
      activeTab === 'attendance'
        ? { month: attendanceMonth, year: attendanceYear }
        : { month: monthlyMonth, year: monthlyYear };
    const monthLabel =
      KHMER_MONTHS.find((m) => m.value === activePeriod.month)?.label || '';
    const classSuffix = settings.className.trim()
      ? ` ${settings.className.trim()}`
      : '';
    const title =
      customTitle ||
      `បញ្ជីពិន្ទុ និងអវត្តមាន${classSuffix} - ${monthLabel} ${activePeriod.year}`;
    const plan = buildSyncPlan(
      settings,
      attendanceByMonth,
      monthlyScoresByMonth,
      semesterScoresByTerm,
      domainGradesByTerm
    );
    setPendingTitle(title);
    setPendingSync({
      mode: 'create',
      title,
      studentCount: students.length,
      tabNames: plan.tabNames,
      ...countsSummary,
    });
  };

  const openUpdateSheetConfirm = () => {
    if (!activeSheet) {
      openCreateSheetConfirm();
      return;
    }
    const plan = buildSyncPlan(
      settings,
      attendanceByMonth,
      monthlyScoresByMonth,
      semesterScoresByTerm,
      domainGradesByTerm
    );
    setPendingSync({
      mode: 'update',
      title: activeSheet.title,
      spreadsheetId: activeSheet.spreadsheetId,
      studentCount: students.length,
      tabNames: plan.tabNames,
      ...countsSummary,
    });
  };

  const handleConfirmSync = async () => {
    if (!pendingSync) return;
    const token = getAccessToken();
    if (!token) {
      setPendingSync(null);
      setHasToken(false);
      setBannerMsg({
        type: 'error',
        text: 'សូមភ្ជាប់គណនី Google ម្តងទៀតដើម្បីរក្សាទុកទិន្នន័យ។',
      });
      return;
    }

    if (sheetSyncTimerRef.current) {
      clearTimeout(sheetSyncTimerRef.current);
      sheetSyncTimerRef.current = null;
    }
    setIsSyncing(true);
    setBannerMsg(null);
    try {
      if (pendingSync.mode === 'create') {
        const created = await createFormattedGradebookSheet(
          token,
          pendingTitle || pendingSync.title,
          settings,
          students,
          attendanceByMonth,
          monthlyScoresByMonth,
          semesterScoresByTerm,
          domainGradesByTerm,
          remarks
        );
        setActiveSheet(created);
        setHasUnsavedChanges(false);
        lastEditedAtRef.current = Date.now();
        if (user?.uid && user.emailVerified) {
          try {
            await saveUserGradebookToCloud(user.uid, {
              settings,
              students,
              attendanceByMonth,
              attendanceReasonsByMonth,
              monthlyScoresByMonth,
              competencyRubricsByMonth,
              semesterScoresByTerm,
              competencyRubricsByTerm,
              domainGradesByTerm,
              remarks,
              activeSheet: created,
            });
          } catch {
            // Cloud save errors are handled via Firebase telemetry
          }
        }
        setAutoSaveState('synced_sheet');
        await refreshDriveFiles(token);
        setBannerMsg({
          type: 'success',
          text: `បានបង្កើត និងផ្ទុកទិន្នន័យទៅ "${created.title}" ដោយជោគជ័យ!`,
        });
      } else if (activeSheet) {
        const updated = await syncDataToSpreadsheet(
          token,
          activeSheet.spreadsheetId,
          settings,
          students,
          attendanceByMonth,
          monthlyScoresByMonth,
          semesterScoresByTerm,
          domainGradesByTerm,
          remarks
        );
        setActiveSheet(updated);
        setHasUnsavedChanges(false);
        lastEditedAtRef.current = Date.now();
        if (user?.uid && user.emailVerified) {
          try {
            await saveUserGradebookToCloud(user.uid, {
              settings,
              students,
              attendanceByMonth,
              attendanceReasonsByMonth,
              monthlyScoresByMonth,
              competencyRubricsByMonth,
              semesterScoresByTerm,
              competencyRubricsByTerm,
              domainGradesByTerm,
              remarks,
              activeSheet: updated,
            });
          } catch {
            // Cloud save errors are handled via Firebase telemetry
          }
        }
        setAutoSaveState('synced_sheet');
        setBannerMsg({
          type: 'success',
          text: `បានផ្ទុកទិន្នន័យទៅ "${updated.title}" ដោយជោគជ័យ!`,
        });
      }
      setPendingSync(null);
    } catch (err: any) {
      if (err instanceof GoogleApiError && (err.status === 401 || err.status === 403)) {
        clearAccessToken();
        setHasToken(false);
        setPendingSync(null);
        setBannerMsg({
          type: 'error',
          text: 'សិទ្ធិចូលប្រើ Google Sheets បានផុតកំណត់។ សូមចុច Sign in with Google ម្តងទៀត។',
        });
      } else {
        setBannerMsg({
          type: 'error',
          text: err?.message || 'មានបញ្ហាក្នុងការផ្ទុកទិន្នន័យទៅ Google Sheets។',
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadSheetById = async (idOrUrl: string) => {
    const token = getAccessToken();
    if (!token) {
      setHasToken(false);
      return;
    }
    setIsLoadingFiles(true);
    setBannerMsg(null);
    try {
      const loaded = await loadDataFromSpreadsheet(token, idOrUrl, settings);
      setActiveSheet(loaded.info);
      const nextStudents = loaded.students.length > 0 ? loaded.students : students;
      const nextAtt =
        loaded.students.length > 0 ? loaded.attendanceByMonth : attendanceByMonth;
      const nextMon =
        loaded.students.length > 0 ? loaded.monthlyScoresByMonth : monthlyScoresByMonth;
      const nextSem =
        loaded.students.length > 0 ? loaded.semesterScoresByTerm : semesterScoresByTerm;
      const nextDom =
        loaded.students.length > 0 ? loaded.domainGradesByTerm : domainGradesByTerm;
      const nextRemarks = loaded.students.length > 0 ? loaded.remarks : remarks;

      if (loaded.students.length > 0) {
        setStudents(nextStudents);
        setAttendanceByMonth(nextAtt);
        setMonthlyScoresByMonth(nextMon);
        setSemesterScoresByTerm(nextSem);
        setDomainGradesByTerm(nextDom);
        setRemarks(nextRemarks);
      }
      setHasUnsavedChanges(false);
      lastEditedAtRef.current = Date.now();
      if (user?.uid && user.emailVerified) {
        try {
          await saveUserGradebookToCloud(user.uid, {
            settings,
            students: nextStudents,
            attendanceByMonth: nextAtt,
            attendanceReasonsByMonth,
            monthlyScoresByMonth: nextMon,
            competencyRubricsByMonth,
            semesterScoresByTerm: nextSem,
            competencyRubricsByTerm,
            domainGradesByTerm: nextDom,
            remarks: nextRemarks,
            activeSheet: loaded.info,
          });
        } catch {
          // ignore secondary cloud backup failure during load
        }
      }
      setAutoSaveState('synced_sheet');
      setBannerMsg({
        type: 'success',
        text: `បានទាញទិន្នន័យពី "${loaded.info.title}" (${loaded.students.length} សិស្ស)`,
      });
    } catch (err: any) {
      if (err instanceof GoogleApiError && (err.status === 401 || err.status === 403)) {
        clearAccessToken();
        setHasToken(false);
      }
      setBannerMsg({
        type: 'error',
        text: err?.message || 'មិនអាចទាញទិន្នន័យពី Google Sheet នេះបានទេ។',
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Data mutation handlers
  const handleChangeAttendanceMark = (
    studentId: string,
    day: number,
    mark: AttendanceMark
  ) => {
    setAttendanceByMonth((prev) => ({
      ...prev,
      [attendanceMonthKey]: {
        ...(prev[attendanceMonthKey] || {}),
        [studentId]: {
          ...(prev[attendanceMonthKey]?.[studentId] || {}),
          [day]: mark,
        },
      },
    }));
    if (mark === '') {
      setAttendanceReasonsByMonth((prev) => {
        const existingDayReason = prev[attendanceMonthKey]?.[studentId]?.[day];
        if (!existingDayReason) return prev;
        const monthMap = { ...(prev[attendanceMonthKey] || {}) };
        const stuMap = { ...(monthMap[studentId] || {}) };
        delete stuMap[day];
        if (Object.keys(stuMap).length > 0) {
          monthMap[studentId] = stuMap;
        } else {
          delete monthMap[studentId];
        }
        return { ...prev, [attendanceMonthKey]: monthMap };
      });
    }
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    const markLabel =
      mark === 'ច្ប'
        ? 'មានច្បាប់'
        : mark === 'ឈ'
        ? 'ឈឺ'
        : mark === 'អច្ប'
        ? 'អត់ច្បាប់'
        : 'វត្តមាន';
    notifyRecordingEdit(
      'attendance',
      studentName
        ? `${studentName} · ថ្ងៃទី ${day} (${markLabel})`
        : `ថ្ងៃទី ${day} (${markLabel})`
    );
  };

  const handleChangeLeaveReason = (
    studentId: string,
    day: number,
    reason: string
  ) => {
    const clamped = reason.slice(0, 120);
    setAttendanceReasonsByMonth((prev) => {
      const monthMap = { ...(prev[attendanceMonthKey] || {}) };
      const stuMap = { ...(monthMap[studentId] || {}) };
      if (clamped.length > 0) {
        stuMap[day] = clamped;
        monthMap[studentId] = stuMap;
      } else {
        delete stuMap[day];
        if (Object.keys(stuMap).length > 0) {
          monthMap[studentId] = stuMap;
        } else {
          delete monthMap[studentId];
        }
      }
      return {
        ...prev,
        [attendanceMonthKey]: monthMap,
      };
    });
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'attendance',
      studentName
        ? `មូលហេតុ៖ ${studentName} · ថ្ងៃទី ${day}`
        : `មូលហេតុអវត្តមាន · ថ្ងៃទី ${day}`
    );
  };

  const handleClearDayAllPresent = (day: number) => {
    setAttendanceByMonth((prev) => {
      const monthMap = { ...(prev[attendanceMonthKey] || {}) };
      for (const stu of students) {
        monthMap[stu.id] = { ...(monthMap[stu.id] || {}), [day]: '' };
      }
      return { ...prev, [attendanceMonthKey]: monthMap };
    });
    setAttendanceReasonsByMonth((prev) => {
      const prevMonth = prev[attendanceMonthKey];
      if (!prevMonth) return prev;
      const nextMonth: Record<string, Record<number, string>> = {};
      for (const [stuId, dayMap] of Object.entries(prevMonth)) {
        if (!dayMap || !(day in dayMap)) {
          if (dayMap && Object.keys(dayMap).length > 0) nextMonth[stuId] = dayMap;
          continue;
        }
        const rest = { ...dayMap };
        delete rest[day];
        if (Object.keys(rest).length > 0) {
          nextMonth[stuId] = rest;
        }
      }
      return { ...prev, [attendanceMonthKey]: nextMonth };
    });
    markDataEdited(true);
    notifyRecordingEdit('attendance', `សម្អាតអវត្តមាន · ថ្ងៃទី ${day} (វត្តមានទាំងអស់)`);
  };

  const handleChangeMonthlyScore = (
    studentId: string,
    subjectKey: string,
    value: number | undefined
  ) => {
    setMonthlyScoresByMonth((prev) => ({
      ...prev,
      [monthlyMonthKey]: {
        ...(prev[monthlyMonthKey] || {}),
        [studentId]: {
          ...(prev[monthlyMonthKey]?.[studentId] || {}),
          [subjectKey]: value,
        },
      },
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `ពិន្ទុប្រចាំខែ · ${studentName}` : 'ពិន្ទុប្រចាំខែ'
    );
  };

  const handleToggleAllKnowledge = (enable: boolean) => {
    setMonthlyScoresByMonth((prev) => {
      const monthMap = { ...(prev[monthlyMonthKey] || {}) };
      for (const stu of students) {
        const nextStu = { ...(monthMap[stu.id] || {}) };
        if (enable) {
          nextStu['comp_knowledge'] = 80;
        } else {
          delete nextStu['comp_knowledge'];
        }
        monthMap[stu.id] = nextStu;
      }
      return {
        ...prev,
        [monthlyMonthKey]: monthMap,
      };
    });
    markDataEdited(true);
    notifyRecordingEdit(
      'scores',
      enable ? 'វិជ្ជាសម្បទា 80% ទាំងអស់ (ប្រចាំខែ)' : 'លុបវិជ្ជាសម្បទា 80% ទាំងអស់'
    );
  };

  const handleSaveCompetencyRubric = (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => {
    const cleanScores: Record<string, number> = { ...nextScores };
    setCompetencyRubricsByMonth((prev) => {
      const monthMap = { ...(prev[monthlyMonthKey] || {}) };
      const stuEntry = { ...(monthMap[studentId] || {}) };
      if (Object.keys(cleanScores).length > 0) {
        stuEntry[type] = cleanScores;
      } else {
        delete stuEntry[type];
      }
      if (stuEntry.skills || stuEntry.attitude) {
        monthMap[studentId] = stuEntry;
      } else {
        delete monthMap[studentId];
      }
      return {
        ...prev,
        [monthlyMonthKey]: monthMap,
      };
    });

    const evalRes = evaluateCompetencyRubric(type, cleanScores);
    const subjectKey = type === 'skills' ? 'comp_skills' : 'comp_attitude';
    setMonthlyScoresByMonth((prev) => {
      const monthMap = { ...(prev[monthlyMonthKey] || {}) };
      const stuScores = { ...(monthMap[studentId] || {}) };
      if (evalRes.score10 === undefined) {
        delete stuScores[subjectKey];
      } else {
        stuScores[subjectKey] = evalRes.score10;
      }
      monthMap[studentId] = stuScores;
      return {
        ...prev,
        [monthlyMonthKey]: monthMap,
      };
    });

    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    const typeLabel = type === 'skills' ? 'បំណិនសម្បទា' : 'ចរិយាសម្បទា';
    notifyRecordingEdit(
      'scores',
      studentName ? `${typeLabel} · ${studentName}` : typeLabel
    );
  };

  const handleClearMonthlySubjectColumn = (subjectKey: string) => {
    setMonthlyScoresByMonth((prev) => {
      const monthMap = { ...(prev[monthlyMonthKey] || {}) };
      for (const stuId of Object.keys(monthMap)) {
        if (monthMap[stuId] && subjectKey in monthMap[stuId]) {
          const nextStu = { ...monthMap[stuId] };
          delete nextStu[subjectKey];
          monthMap[stuId] = nextStu;
        }
      }
      return {
        ...prev,
        [monthlyMonthKey]: monthMap,
      };
    });

    if (subjectKey === 'comp_skills' || subjectKey === 'comp_attitude') {
      const rubricType: CompetencyType =
        subjectKey === 'comp_skills' ? 'skills' : 'attitude';
      setCompetencyRubricsByMonth((prev) => {
        const monthMap = { ...(prev[monthlyMonthKey] || {}) };
        for (const stuId of Object.keys(monthMap)) {
          const entry = monthMap[stuId];
          if (entry && entry[rubricType]) {
            const nextEntry = { ...entry };
            delete nextEntry[rubricType];
            if (nextEntry.skills || nextEntry.attitude) {
              monthMap[stuId] = nextEntry;
            } else {
              delete monthMap[stuId];
            }
          }
        }
        return {
          ...prev,
          [monthlyMonthKey]: monthMap,
        };
      });
    }

    markDataEdited(true);
    notifyRecordingEdit('scores', 'សម្អាតជួរឈរពិន្ទុប្រចាំខែ');
  };

  const handleChangeSemesterScore = (
    studentId: string,
    subjectKey: string,
    value: number | undefined
  ) => {
    setSemesterScoresByTerm((prev) => ({
      ...prev,
      [currentTermKey]: {
        ...(prev[currentTermKey] || {}),
        [studentId]: {
          ...(prev[currentTermKey]?.[studentId] || {}),
          [subjectKey]: value,
        },
      },
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `ពិន្ទុឆមាស · ${studentName}` : 'ពិន្ទុឆមាស'
    );
  };

  const handleToggleAllSemesterKnowledge = (enable: boolean) => {
    setSemesterScoresByTerm((prev) => {
      const termMap = { ...(prev[currentTermKey] || {}) };
      for (const stu of students) {
        const nextStu = { ...(termMap[stu.id] || {}) };
        if (enable) {
          nextStu['comp_knowledge'] = 80;
        } else {
          delete nextStu['comp_knowledge'];
        }
        termMap[stu.id] = nextStu;
      }
      return {
        ...prev,
        [currentTermKey]: termMap,
      };
    });
    markDataEdited(true);
    notifyRecordingEdit(
      'scores',
      enable ? 'វិជ្ជាសម្បទា 80% ទាំងអស់ (ឆមាស)' : 'លុបវិជ្ជាសម្បទា 80% ទាំងអស់'
    );
  };

  const handleSaveSemesterCompetencyRubric = (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => {
    const cleanScores: Record<string, number> = { ...nextScores };
    setCompetencyRubricsByTerm((prev) => {
      const termMap = { ...(prev[currentTermKey] || {}) };
      const stuEntry = { ...(termMap[studentId] || {}) };
      if (Object.keys(cleanScores).length > 0) {
        stuEntry[type] = cleanScores;
      } else {
        delete stuEntry[type];
      }
      if (stuEntry.skills || stuEntry.attitude) {
        termMap[studentId] = stuEntry;
      } else {
        delete termMap[studentId];
      }
      return {
        ...prev,
        [currentTermKey]: termMap,
      };
    });

    const evalRes = evaluateCompetencyRubric(type, cleanScores);
    const subjectKey = type === 'skills' ? 'comp_skills' : 'comp_attitude';
    setSemesterScoresByTerm((prev) => {
      const termMap = { ...(prev[currentTermKey] || {}) };
      const stuScores = { ...(termMap[studentId] || {}) };
      if (evalRes.score10 === undefined) {
        delete stuScores[subjectKey];
      } else {
        stuScores[subjectKey] = evalRes.score10;
      }
      termMap[studentId] = stuScores;
      return {
        ...prev,
        [currentTermKey]: termMap,
      };
    });

    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    const typeLabel = type === 'skills' ? 'បំណិនសម្បទា' : 'ចរិយាសម្បទា';
    notifyRecordingEdit(
      'scores',
      studentName ? `${typeLabel} (ឆមាស) · ${studentName}` : `${typeLabel} (ឆមាស)`
    );
  };

  const handleClearSemesterSubjectColumn = (subjectKey: string) => {
    setSemesterScoresByTerm((prev) => {
      const termMap = { ...(prev[currentTermKey] || {}) };
      for (const stuId of Object.keys(termMap)) {
        if (termMap[stuId] && subjectKey in termMap[stuId]) {
          const nextStu = { ...termMap[stuId] };
          delete nextStu[subjectKey];
          termMap[stuId] = nextStu;
        }
      }
      return {
        ...prev,
        [currentTermKey]: termMap,
      };
    });

    if (subjectKey === 'comp_skills' || subjectKey === 'comp_attitude') {
      const rubricType: CompetencyType =
        subjectKey === 'comp_skills' ? 'skills' : 'attitude';
      setCompetencyRubricsByTerm((prev) => {
        const termMap = { ...(prev[currentTermKey] || {}) };
        for (const stuId of Object.keys(termMap)) {
          const entry = termMap[stuId];
          if (entry && entry[rubricType]) {
            const nextEntry = { ...entry };
            delete nextEntry[rubricType];
            if (nextEntry.skills || nextEntry.attitude) {
              termMap[stuId] = nextEntry;
            } else {
              delete termMap[stuId];
            }
          }
        }
        return {
          ...prev,
          [currentTermKey]: termMap,
        };
      });
    }

    markDataEdited(true);
    notifyRecordingEdit('scores', 'សម្អាតជួរឈរពិន្ទុឆមាស');
  };

  const handleChangeDomainGrade = (
    studentId: string,
    domainKey: string,
    value: string
  ) => {
    setDomainGradesByTerm((prev) => ({
      ...prev,
      [currentTermKey]: {
        ...(prev[currentTermKey] || {}),
        [studentId]: {
          ...(prev[currentTermKey]?.[studentId] || {}),
          [domainKey]: value,
        },
      },
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `និទ្ទេសតាមផ្នែក · ${studentName}` : 'និទ្ទេសតាមផ្នែក'
    );
  };

  const handleChangeAnnualScore = (
    studentId: string,
    subjectKey: string,
    value: number | undefined
  ) => {
    setSemesterScoresByTerm((prev) => ({
      ...prev,
      annual: {
        ...(prev.annual || {}),
        [studentId]: {
          ...(prev.annual?.[studentId] || {}),
          [subjectKey]: value,
        },
      },
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `ពិន្ទុប្រចាំឆ្នាំ · ${studentName}` : 'ពិន្ទុប្រចាំឆ្នាំ'
    );
  };

  const handleToggleAllAnnualKnowledge = (enable: boolean) => {
    setSemesterScoresByTerm((prev) => {
      const annualMap = { ...(prev.annual || {}) };
      for (const stu of students) {
        const nextStu = { ...(annualMap[stu.id] || {}) };
        if (enable) {
          nextStu['comp_knowledge'] = 80;
        } else {
          delete nextStu['comp_knowledge'];
        }
        annualMap[stu.id] = nextStu;
      }
      return {
        ...prev,
        annual: annualMap,
      };
    });
    markDataEdited(true);
    notifyRecordingEdit(
      'scores',
      enable ? 'វិជ្ជាសម្បទា 80% ទាំងអស់ (ប្រចាំឆ្នាំ)' : 'លុបវិជ្ជាសម្បទា 80% ទាំងអស់'
    );
  };

  const handleSaveAnnualCompetencyRubric = (
    studentId: string,
    type: CompetencyType,
    nextScores: Record<string, number>
  ) => {
    const cleanScores: Record<string, number> = { ...nextScores };
    setCompetencyRubricsByTerm((prev) => {
      const annualMap = { ...(prev.annual || {}) };
      const stuEntry = { ...(annualMap[studentId] || {}) };
      if (Object.keys(cleanScores).length > 0) {
        stuEntry[type] = cleanScores;
      } else {
        delete stuEntry[type];
      }
      if (stuEntry.skills || stuEntry.attitude) {
        annualMap[studentId] = stuEntry;
      } else {
        delete annualMap[studentId];
      }
      return {
        ...prev,
        annual: annualMap,
      };
    });

    const evalRes = evaluateCompetencyRubric(type, cleanScores);
    const subjectKey = type === 'skills' ? 'comp_skills' : 'comp_attitude';
    setSemesterScoresByTerm((prev) => {
      const annualMap = { ...(prev.annual || {}) };
      const stuScores = { ...(annualMap[studentId] || {}) };
      if (evalRes.score10 === undefined) {
        delete stuScores[subjectKey];
      } else {
        stuScores[subjectKey] = evalRes.score10;
      }
      annualMap[studentId] = stuScores;
      return {
        ...prev,
        annual: annualMap,
      };
    });

    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    const typeLabel = type === 'skills' ? 'បំណិនសម្បទា' : 'ចរិយាសម្បទា';
    notifyRecordingEdit(
      'scores',
      studentName
        ? `${typeLabel} (ប្រចាំឆ្នាំ) · ${studentName}`
        : `${typeLabel} (ប្រចាំឆ្នាំ)`
    );
  };

  const handleClearAnnualSubjectColumn = (subjectKey: string) => {
    setSemesterScoresByTerm((prev) => {
      const annualMap = { ...(prev.annual || {}) };
      for (const stuId of Object.keys(annualMap)) {
        if (annualMap[stuId] && subjectKey in annualMap[stuId]) {
          const nextStu = { ...annualMap[stuId] };
          delete nextStu[subjectKey];
          annualMap[stuId] = nextStu;
        }
      }
      return {
        ...prev,
        annual: annualMap,
      };
    });

    if (subjectKey === 'comp_skills' || subjectKey === 'comp_attitude') {
      const rubricType: CompetencyType =
        subjectKey === 'comp_skills' ? 'skills' : 'attitude';
      setCompetencyRubricsByTerm((prev) => {
        const annualMap = { ...(prev.annual || {}) };
        for (const stuId of Object.keys(annualMap)) {
          const entry = annualMap[stuId];
          if (entry && entry[rubricType]) {
            const nextEntry = { ...entry };
            delete nextEntry[rubricType];
            if (nextEntry.skills || nextEntry.attitude) {
              annualMap[stuId] = nextEntry;
            } else {
              delete annualMap[stuId];
            }
          }
        }
        return {
          ...prev,
          annual: annualMap,
        };
      });
    }

    markDataEdited(true);
    notifyRecordingEdit('scores', 'សម្អាតជួរឈរពិន្ទុប្រចាំឆ្នាំ');
  };

  const handleChangeAnnualDomainGrade = (
    studentId: string,
    domainKey: string,
    value: string
  ) => {
    setDomainGradesByTerm((prev) => ({
      ...prev,
      annual: {
        ...(prev.annual || {}),
        [studentId]: {
          ...(prev.annual?.[studentId] || {}),
          [domainKey]: value,
        },
      },
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `និទ្ទេសប្រចាំឆ្នាំ · ${studentName}` : 'និទ្ទេសប្រចាំឆ្នាំ'
    );
  };

  const handleChangeRemark = (studentId: string, value: string) => {
    setRemarks((prev) => ({
      ...prev,
      [studentId]: value,
    }));
    markDataEdited(true);
    const studentName = students.find((s) => s.id === studentId)?.name;
    notifyRecordingEdit(
      'scores',
      studentName ? `សេចក្តីផ្សេងៗ · ${studentName}` : 'សេចក្តីផ្សេងៗ'
    );
  };

  const handleAddStudent = (studentData: Omit<Student, 'id'>, remark: string) => {
    const newId = `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newStu: Student = {
      id: newId,
      ...studentData,
    };
    setStudents((prev) => [...prev, newStu]);
    if (remark.trim()) {
      setRemarks((prev) => ({
        ...prev,
        [newId]: remark.trim(),
      }));
    }
    markDataEdited(true);
    setBannerMsg({
      type: 'success',
      text: `បានបន្ថែមសិស្សថ្មី "${newStu.name}" ចូលក្នុងបញ្ជីរួចរាល់។`,
    });
  };

  const handleUpdateStudent = (
    studentId: string,
    updates: Omit<Student, 'id'> & { remark: string }
  ) => {
    const { remark, ...studentFields } = updates;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              ...studentFields,
            }
          : s
      )
    );
    setRemarks((prev) => ({
      ...prev,
      [studentId]: remark,
    }));
    markDataEdited(true);
  };

  const handleDeleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    markDataEdited(true);
  };

  const handleImportExcelStudents = (
    importedStudents: Omit<Student, 'id'>[],
    remarksByIndex: Record<number, string>
  ) => {
    const usedIds = new Set<string>();
    const normalizeNameKey = (n: string) => n.replace(/\s+/g, '').trim().toLowerCase();
    const baseTs = Date.now();

    const nextRemarks: RemarksMap = { ...remarks };
    const nextStudents: Student[] = importedStudents.map((item, idx) => {
      const match = students.find((existing) => {
        if (usedIds.has(existing.id)) return false;
        if (item.studentCode && existing.studentCode) {
          return existing.studentCode.trim() === item.studentCode.trim();
        }
        return normalizeNameKey(existing.name) === normalizeNameKey(item.name);
      });

      const id = match ? match.id : `stu-${baseTs}-${idx}`;
      usedIds.add(id);

      if (remarksByIndex[idx] !== undefined) {
        nextRemarks[id] = remarksByIndex[idx];
      }

      return {
        id,
        ...item,
      };
    });

    setStudents(nextStudents);
    setRemarks(nextRemarks);
    markDataEdited(true);
    setBannerMsg({
      type: 'success',
      text: `បាននាំចូលបញ្ជីឈ្មោះសិស្ស ${nextStudents.length} នាក់ពីឯកសារ Excel រួចរាល់។`,
    });
  };

  const handleShareTelegram = async (
    scope: ShareScope,
    forceGoogleDriveExport = false
  ) => {
    setIsPreparingShare(true);
    setBannerMsg(null);
    try {
      const token = getAccessToken();
      const canUseDrive = Boolean(activeSheet && token);
      let blob: Blob | null = null;
      let csvBlob: Blob | null = null;
      let filename = buildShareFilename(scope, settings);
      let sourceLabel = 'បង្កើតតារាង Excel ពីទិន្នន័យបច្ចុប្បន្ន';

      if (canUseDrive && forceGoogleDriveExport) {
        try {
          blob = await exportGoogleSheetAsExcelBlob(
            token!,
            activeSheet!.spreadsheetId
          );
          csvBlob = await convertXlsxBlobToCsvBlob(blob);
          filename = buildShareFilename(scope, settings, activeSheet!.title);
          sourceLabel = 'នាំចេញផ្ទាល់ពី Google Sheet (.xlsx)';
        } catch {
          if (forceGoogleDriveExport) {
            throw new Error(
              'មិនអាចទាញយកឯកសារ Excel ពី Google Sheet បានទេ។ សូមសាកល្បងម្តងទៀត។'
            );
          }
          blob = null;
          csvBlob = null;
        }
      }

      if (!blob) {
        const generated = await generateLocalShareBlobs({
          scope,
          settings,
          students,
          attendance: currentAttendance,
          monthlyScores: currentMonthlyScores,
          monthlyScoresByMonth,
          semesterScores: currentSemesterScores,
          domainGrades: currentDomainGrades,
          semesterScoresByTerm,
          domainGradesByTerm,
          remarks,
        });
        blob = generated.xlsxBlob;
        csvBlob = generated.csvBlob;
      }

      const file = new File([blob], filename, { type: EXCEL_MIME_TYPE });
      const csvFilename = filename.replace(/\.xlsx$/i, '.csv');
      const csvFile = csvBlob
        ? new File([csvBlob], csvFilename, { type: CSV_MIME_TYPE })
        : null;
      const summaryText = buildShareSummaryText(
        scope,
        settings,
        students.length,
        activeSheet?.url
      );

      setShareModal({
        open: true,
        scope,
        file,
        csvFile,
        sourceLabel,
        summaryText,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'មានបញ្ហាក្នុងការបង្កើតឯកសារ Excel សម្រាប់ចែករំលែក។';
      setBannerMsg({ type: 'error', text: msg });
    } finally {
      setIsPreparingShare(false);
    }
  };

  const activeTabHeader = useMemo(() => {
    switch (activeTab) {
      case 'attendance':
        return {
          title: 'អវត្តមានប្រចាំខែ',
          Icon: CalendarCheck,
          iconClass:
            'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/60',
        };
      case 'monthly':
        return {
          title: 'ពិន្ទុប្រឡងប្រចាំខែ',
          Icon: ClipboardList,
          iconClass:
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60',
        };
      case 'semester':
        return {
          title: 'ពិន្ទុប្រឡងឆមាស/ប្រចាំឆ្នាំ',
          Icon: Award,
          iconClass:
            'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60',
        };
      case 'roster':
      default:
        return {
          title: 'ព័ត៌មានគ្រូ/សិស្ស',
          Icon: Users,
          iconClass:
            'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border-violet-200/80 dark:border-violet-800/60',
        };
    }
  }, [activeTab]);
  const ActiveTabIcon = activeTabHeader.Icon;

  return (
    <UserProfileProvider
      value={{
        profile: userProfile,
        openProfileEditor: () => setIsProfileModalOpen(true),
      }}
    >
    <div className="min-h-screen w-full max-w-full overflow-x-clip text-slate-900 dark:text-slate-100 pb-24 md:pb-10 flex flex-col">
      {/* Top Bar: Strict 3-Zone Contract (56px height) */}
      <header className="sticky top-0 z-30 w-full h-14 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-[0_1px_12px_-4px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_12px_-4px_rgba(0,0,0,0.45)]">
        <div className="max-w-7xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 md:gap-8">
          {/* Zone 1: Brand Logo & Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className="min-w-0 flex-1 sm:flex-none flex items-center gap-2 sm:gap-2.5 text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap text-left hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <img
              src="/assets/aistudio/Gemini_Generated_Image_32m1mh32m1mh32m1_fc5b9cee.jpg"
              alt=""
              aria-hidden="true"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-slate-200/90 dark:ring-slate-700 shadow-xs shrink-0"
            />
            <span className="truncate">School Digital</span>
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'attendance'
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3)]'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              អវត្តមាន
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'monthly'
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3)]'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              ពិន្ទុប្រចាំខែ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('semester')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'semester'
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3)]'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              លទ្ធផលឆមាស
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'roster'
                  ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3)]'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              សិស្ស និង Sheet
            </button>
          </nav>

          {/* Zone 3: Single Primary Action, Install CTA, Theme Icon & User Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {!user ? (
              <>
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={() =>
                    handleChangeTheme(themeMode === 'dark' ? 'light' : 'dark')
                  }
                  aria-label={
                    themeMode === 'dark'
                      ? 'ប្តូរទៅរចនាបថភ្លឺ'
                      : 'ប្តូរទៅរចនាបថងងឹត'
                  }
                  title={
                    themeMode === 'dark'
                      ? 'ប្តូរទៅរចនាបថភ្លឺ'
                      : 'ប្តូរទៅរចនាបថងងឹត'
                  }
                  aria-pressed={themeMode === 'dark'}
                  className="w-10 h-10 rounded-full border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-amber-300 active:scale-95 transition-all shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
                >
                  {themeMode === 'dark' ? (
                    <Sun className="w-4.5 h-4.5" />
                  ) : (
                    <Moon className="w-4.5 h-4.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModal({ open: true, mode: 'signup' })}
                  disabled={isLoggingIn}
                  className="btn-primary min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  <span>ចូល / បង្កើតគណនី</span>
                </button>
              </>
            ) : (
              <>
                {hasToken && (
                  <button
                    type="button"
                    onClick={openUpdateSheetConfirm}
                    className="btn-primary min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>
                      {activeSheet ? 'រក្សាទុក Sheet' : 'បង្កើត Sheet'}
                      {hasUnsavedChanges ? ' *' : ''}
                    </span>
                  </button>
                )}
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={() =>
                    handleChangeTheme(themeMode === 'dark' ? 'light' : 'dark')
                  }
                  aria-label={
                    themeMode === 'dark'
                      ? 'ប្តូរទៅរចនាបថភ្លឺ'
                      : 'ប្តូរទៅរចនាបថងងឹត'
                  }
                  title={
                    themeMode === 'dark'
                      ? 'ប្តូរទៅរចនាបថភ្លឺ'
                      : 'ប្តូរទៅរចនាបថងងឹត'
                  }
                  aria-pressed={themeMode === 'dark'}
                  className="w-10 h-10 rounded-full border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-amber-300 active:scale-95 transition-all shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
                >
                  {themeMode === 'dark' ? (
                    <Sun className="w-4.5 h-4.5" />
                  ) : (
                    <Moon className="w-4.5 h-4.5" />
                  )}
                </button>
                <UserProfileMenu
                  user={user}
                  hasToken={hasToken}
                  autoSaveState={autoSaveState}
                  themeMode={themeMode}
                  onChangeTheme={handleChangeTheme}
                  onEditProfile={() => setIsProfileModalOpen(true)}
                  onReauth={() => void handleSignIn(false)}
                  onSwitchAccount={() => setAuthModal({ open: true, mode: 'signin' })}
                  onOpenSheetTab={() => setActiveTab('roster')}
                  onSignOut={handleSignOut}
                  onRefreshVerification={handleRefreshVerification}
                  onResendVerification={handleResendVerification}
                />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="w-full min-w-0 max-w-7xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Dynamic Page Heading */}
        <div className="flex items-center gap-3 px-1 min-w-0">
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 ${activeTabHeader.iconClass}`}
            aria-hidden="true"
          >
            <ActiveTabIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug text-balance">
            {activeTabHeader.title}
          </h1>
        </div>

        {/* Account Auto-Reload Progress Indicator */}
        {isHydratingAccount && (
          <div
            role="status"
            className="rounded-2xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/90 dark:bg-blue-950/50 px-4 py-2.5 text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2.5"
          >
            <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <span>
              កំពុងផ្ទុកទិន្នន័យគណនី {user?.displayName || user?.email || 'Google'} ឡើងវិញដោយស្វ័យប្រវត្តិ...
            </span>
          </div>
        )}

        {/* Email Verification Notice Banner */}
        {user && !isEmailVerified && (
          <div
            role="status"
            className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="font-bold">
                  សូមបញ្ជាក់អ៊ីមែល ({user.email}) ដើម្បីបើកការរក្សាទុកលើ Cloud
                </div>
                <p className="text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed">
                  បច្ចុប្បន្នទិន្នន័យកំពុងរក្សាទុកក្នុងឧបករណ៍ជាបណ្តោះអាសន្ន។ សូមបើក Inbox ឬ Spam ក្នុងអ៊ីមែលរបស់អ្នក ហើយចុចតំណបញ្ជាក់ រួចចុចប៊ូតុងខាងក្រោម។
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <button
                type="button"
                onClick={handleRefreshVerification}
                disabled={isCheckingVerification}
                className="btn-primary min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                {isCheckingVerification ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {isCheckingVerification
                    ? 'កំពុងពិនិត្យ...'
                    : 'បានបញ្ជាក់រួចហើយ (ផ្ទុកឡើងវិញ)'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className="btn-secondary min-h-[38px] px-3 rounded-xl text-xs font-semibold"
              >
                {isResendingVerification
                  ? 'កំពុងផ្ញើ...'
                  : 'ផ្ញើតំណបញ្ជាក់ម្តងទៀត'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {bannerMsg && (
          <div
            role="status"
            className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm font-medium space-y-2.5 ${
              bannerMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-100'
                : bannerMsg.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-100'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                {bannerMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      bannerMsg.type === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  />
                )}
                <span className="leading-relaxed">{bannerMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerMsg(null)}
                className="text-xs underline shrink-0"
              >
                បិទ
              </button>
            </div>

            {bannerMsg.isAuthHelp && (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <button
                  type="button"
                  onClick={() => setAuthModal({ open: true, mode: 'signup' })}
                  className="btn-primary min-h-[36px] px-3 rounded-xl text-xs font-semibold"
                >
                  បង្កើតគណនីដោយអ៊ីមែលជំនួស
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignIn(false)}
                  disabled={isLoggingIn}
                  className="btn-secondary min-h-[36px] px-3 rounded-xl text-xs font-semibold"
                >
                  {isLoggingIn ? 'កំពុងភ្ជាប់...' : 'សាកល្បង Google ម្តងទៀត'}
                </button>
                {canUseRedirectFlow() ? (
                  <button
                    type="button"
                    onClick={handleSignInRedirect}
                    disabled={isLoggingIn}
                    className="btn-secondary min-h-[36px] px-3 rounded-xl text-xs font-semibold"
                  >
                    ចូលតាមទំព័រផ្ទាល់ (Redirect)
                  </button>
                ) : isInIframe() ? (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary min-h-[36px] px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>បើកក្នុង Tab ថ្មីដើម្បី Sign in</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : null}
                {isInAppBrowser() && (
                  <span className="text-[11px] text-amber-800 dark:text-amber-200">
                    គន្លឹះ៖ ចុច ⋮ រួចជ្រើស «Open in Chrome / Safari»
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Active Tab View */}
        {activeTab === 'attendance' && (
          <AttendanceTab
            key={user?.uid || 'guest'}
            user={user}
            isLoggingIn={isLoggingIn}
            settings={settings}
            students={students}
            attendance={currentAttendance}
            attendanceReasons={currentAttendanceReasons}
            remarks={remarks}
            isPreparingShare={isPreparingShare}
            onSignIn={() => setAuthModal({ open: true, mode: 'signup' })}
            onChangeMark={handleChangeAttendanceMark}
            onChangeLeaveReason={handleChangeLeaveReason}
            onClearDayAllPresent={handleClearDayAllPresent}
            onChangeMonthYear={(month, year) => {
              setSettings((prev) => {
                const curAtt = getAttendanceMonthYear(prev);
                if (month !== curAtt.month && year === curAtt.year) {
                  const { startYear, endYear } = parseAcademicYear(
                    prev.academicYear,
                    curAtt.year
                  );
                  const mappedYear =
                    curAtt.year === startYear || curAtt.year === endYear
                      ? getCalendarYearForAcademicMonth(
                          prev.academicYear,
                          month,
                          curAtt.year
                        )
                      : year;
                  return {
                    ...prev,
                    attendanceMonth: month,
                    attendanceYear: mappedYear,
                  };
                }
                return {
                  ...prev,
                  attendanceMonth: month,
                  attendanceYear: year,
                };
              });
              markDataEdited(false);
            }}
            onShareTelegram={() => handleShareTelegram('attendance')}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyScoresTab
            key={user?.uid || 'guest'}
            settings={settings}
            students={students}
            monthlyScores={currentMonthlyScores}
            competencyRubrics={currentCompetencyRubrics}
            remarks={remarks}
            isPreparingShare={isPreparingShare}
            onChangeScore={handleChangeMonthlyScore}
            onToggleAllKnowledge={handleToggleAllKnowledge}
            onSaveCompetencyRubric={handleSaveCompetencyRubric}
            onChangeRemark={handleChangeRemark}
            onChangeMonthYear={(month, year) => {
              setSettings((prev) => {
                const curMon = getMonthlyScoresMonthYear(prev);
                if (month !== curMon.month && year === curMon.year) {
                  const mappedYear = getCalendarYearForAcademicMonth(
                    prev.academicYear,
                    month,
                    year
                  );
                  return {
                    ...prev,
                    monthlyMonth: month,
                    monthlyYear: mappedYear,
                    month,
                    year: mappedYear,
                  };
                }
                return {
                  ...prev,
                  monthlyMonth: month,
                  monthlyYear: year,
                  month,
                  year,
                };
              });
              markDataEdited(false);
            }}
            onChangeCustomSubjectLabels={(nextLabels) => {
              const sanitized = sanitizeCustomSubjectLabels(nextLabels);
              setSettings((prev) => {
                const next = { ...prev };
                if (Object.keys(sanitized).length > 0) {
                  next.customSubjectLabels = sanitized;
                } else {
                  delete next.customSubjectLabels;
                }
                return next;
              });
              markDataEdited(true);
            }}
            onChangeHiddenMonthlySubjects={(nextHiddenKeys) => {
              const sanitized = sanitizeHiddenMonthlySubjectKeys(nextHiddenKeys);
              setSettings((prev) => {
                const next = { ...prev };
                if (sanitized.length > 0) {
                  next.hiddenMonthlySubjectKeys = sanitized;
                } else {
                  delete next.hiddenMonthlySubjectKeys;
                }
                return next;
              });
              markDataEdited(true);
            }}
            onClearMonthlySubjectColumn={handleClearMonthlySubjectColumn}
            onShareTelegram={() => handleShareTelegram('monthly')}
          />
        )}

        {activeTab === 'semester' && (
          <SemesterResultsTab
            key={user?.uid || 'guest'}
            settings={settings}
            students={students}
            monthlyScoresByMonth={monthlyScoresByMonth}
            semesterScores={currentSemesterScores}
            competencyRubrics={currentSemesterCompetencyRubrics}
            domainGrades={currentDomainGrades}
            semester1Scores={semesterScoresByTerm['1'] || {}}
            annualScores={semesterScoresByTerm['annual'] || {}}
            annualCompetencyRubrics={competencyRubricsByTerm['annual'] || {}}
            annualDomainGrades={domainGradesByTerm['annual'] || {}}
            remarks={remarks}
            isPreparingShare={isPreparingShare}
            onChangeSemester={(semester) => {
              setSettings((prev) => ({ ...prev, semester }));
              markDataEdited(false);
            }}
            onToggleSemesterMonth={(semester, month) => {
              setSettings((prev) => {
                const key = semester === 1 ? 'semester1Months' : 'semester2Months';
                const current = prev[key];
                const exists = current.includes(month);
                const updated = exists
                  ? current.filter((m) => m !== month)
                  : [...current, month];
                return { ...prev, [key]: updated };
              });
              markDataEdited(true);
            }}
            onChangeSemesterScore={handleChangeSemesterScore}
            onToggleAllSemesterKnowledge={handleToggleAllSemesterKnowledge}
            onSaveSemesterCompetencyRubric={handleSaveSemesterCompetencyRubric}
            onChangeDomainGrade={handleChangeDomainGrade}
            onChangeAnnualScore={handleChangeAnnualScore}
            onToggleAllAnnualKnowledge={handleToggleAllAnnualKnowledge}
            onSaveAnnualCompetencyRubric={handleSaveAnnualCompetencyRubric}
            onChangeAnnualDomainGrade={handleChangeAnnualDomainGrade}
            onChangeRemark={handleChangeRemark}
            onChangeCustomSemesterSubjectLabels={(nextLabels) => {
              const sanitized = sanitizeCustomSemesterSubjectLabels(nextLabels);
              setSettings((prev) => {
                const next = { ...prev };
                if (Object.keys(sanitized).length > 0) {
                  next.customSemesterSubjectLabels = sanitized;
                } else {
                  delete next.customSemesterSubjectLabels;
                }
                return next;
              });
              markDataEdited(true);
            }}
            onChangeHiddenSemesterSubjects={(nextHiddenKeys) => {
              const sanitized = sanitizeHiddenSemesterSubjectKeys(nextHiddenKeys);
              setSettings((prev) => {
                const next = { ...prev };
                if (sanitized.length > 0) {
                  next.hiddenSemesterSubjectKeys = sanitized;
                } else {
                  delete next.hiddenSemesterSubjectKeys;
                }
                return next;
              });
              markDataEdited(true);
            }}
            onClearSemesterSubjectColumn={handleClearSemesterSubjectColumn}
            onChangeHiddenAnnualCompetencies={(nextHiddenKeys) => {
              const sanitized = sanitizeHiddenAnnualCompetencyKeys(nextHiddenKeys);
              setSettings((prev) => {
                const next = { ...prev };
                if (sanitized.length > 0) {
                  next.hiddenAnnualCompetencyKeys = sanitized;
                } else {
                  delete next.hiddenAnnualCompetencyKeys;
                }
                return next;
              });
              markDataEdited(true);
            }}
            onClearAnnualSubjectColumn={handleClearAnnualSubjectColumn}
            onShareTelegram={() => handleShareTelegram('semester')}
          />
        )}

        {activeTab === 'roster' && (
          <RosterAndSheetTab
            key={user?.uid || 'guest'}
            user={user}
            userProfile={userProfile}
            hasToken={hasToken}
            isLoggingIn={isLoggingIn}
            activeSheet={activeSheet}
            driveFiles={driveFiles}
            isLoadingFiles={isLoadingFiles}
            settings={settings}
            students={students}
            attendance={currentAttendance}
            monthlyScores={currentMonthlyScores}
            monthlyScoresByMonth={monthlyScoresByMonth}
            semesterScores={currentSemesterScores}
            domainGrades={currentDomainGrades}
            remarks={remarks}
            onSignIn={() => void handleSignIn(false)}
            onSignInRedirect={handleSignInRedirect}
            onOpenAuthModal={(mode) => setAuthModal({ open: true, mode })}
            onEditProfile={() => setIsProfileModalOpen(true)}
            onResendVerification={handleResendVerification}
            onRefreshVerification={handleRefreshVerification}
            isCheckingVerification={isCheckingVerification}
            onSignOut={handleSignOut}
            onRefreshDriveFiles={() => refreshDriveFiles()}
            onRequestCreateSheet={(title) => openCreateSheetConfirm(title)}
            onLoadSheetById={handleLoadSheetById}
            onUpdateSettings={(next) => {
              setSettings(next);
              markDataEdited(true);
            }}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onImportExcelStudents={handleImportExcelStudents}
            onNotify={(type, text) => setBannerMsg({ type, text })}
          />
        )}
      </main>

      {/* Developer Credit Footer */}
      <footer className="max-w-7xl w-full min-w-0 mx-auto px-3.5 sm:px-6 mt-auto pt-6">
        <div className="surface-card rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 text-center sm:text-left">
            <span className="font-mono-num font-semibold text-slate-800 dark:text-slate-200">© 2026</span>{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">OU Luon</span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
            <span>School Digital</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://www.facebook.com/OuLuon"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook OU Luon"
              title="Facebook"
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1877F2] hover:bg-[#1877F2]/10 hover:border-[#1877F2]/40 active:scale-95 transition-all flex items-center justify-center shadow-xs"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.407.595 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.405 24 24 23.407 24 22.674V1.326C24 .593 23.405 0 22.675 0z" />
              </svg>
            </a>

            <a
              href="https://www.youtube.com/@shorts_tech_IT"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube @shorts_tech_IT"
              title="YouTube"
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#FF0000] hover:bg-[#FF0000]/10 hover:border-[#FF0000]/40 active:scale-95 transition-all flex items-center justify-center shadow-xs"
            >
              <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>

            <a
              href="https://t.me/OuLuon"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram OU Luon"
              title="Telegram"
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#229ED9] hover:bg-[#229ED9]/10 hover:border-[#229ED9]/40 active:scale-95 transition-all flex items-center justify-center shadow-xs"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (64px height, Thumb Zone) */}
      <nav
        aria-label="ម៉ឺនុយចម្បង"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.08)] dark:shadow-[0_-4px_20px_-6px_rgba(0,0,0,0.45)] grid grid-cols-4 items-center px-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`h-12 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            activeTab === 'attendance'
              ? 'text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/60 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)] dark:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.3)]'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <CalendarCheck
            className={`w-5 h-5 ${
              activeTab === 'attendance'
                ? 'text-blue-600 dark:text-blue-300'
                : 'text-blue-500 dark:text-blue-400'
            }`}
          />
          <span className="text-[11px] font-semibold leading-none">អវត្តមាន</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`h-12 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            activeTab === 'monthly'
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/60 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)] dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.3)]'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ClipboardList
            className={`w-5 h-5 ${
              activeTab === 'monthly'
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-emerald-500 dark:text-emerald-400'
            }`}
          />
          <span className="text-[11px] font-semibold leading-none">ពិន្ទុខែ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('semester')}
          className={`h-12 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            activeTab === 'semester'
              ? 'text-amber-700 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/60 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.22)] dark:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.3)]'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Award
            className={`w-5 h-5 ${
              activeTab === 'semester'
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-amber-500 dark:text-amber-400'
            }`}
          />
          <span className="text-[10px] min-[400px]:text-[11px] font-semibold leading-none whitespace-nowrap">
            ឆមាស/ប្រចាំឆ្នាំ
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`h-12 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
            activeTab === 'roster'
              ? 'text-violet-700 dark:text-violet-300 bg-violet-50/90 dark:bg-violet-950/60 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)] dark:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.3)]'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Users
            className={`w-5 h-5 ${
              activeTab === 'roster'
                ? 'text-violet-600 dark:text-violet-300'
                : 'text-violet-500 dark:text-violet-400'
            }`}
          />
          <span className="text-[11px] font-semibold leading-none whitespace-nowrap">គ្រូ/សិស្ស</span>
        </button>
      </nav>

      {/* Explicit Confirmation Modal before Google Sheets Writes */}
      <ConfirmSyncModal
        open={Boolean(pendingSync)}
        summary={pendingSync}
        isSubmitting={isSyncing}
        onCancel={() => setPendingSync(null)}
        onConfirm={handleConfirmSync}
      />

      {/* Share Excel (.xlsx) to Telegram / OS Share Sheet Modal */}
      <ShareExcelModal
        open={shareModal.open}
        file={shareModal.file}
        csvFile={shareModal.csvFile}
        sourceLabel={shareModal.sourceLabel}
        summaryText={shareModal.summaryText}
        googleSheetUrl={activeSheet?.url}
        hasUnsavedChanges={hasUnsavedChanges}
        canUseGoogleDriveExport={Boolean(activeSheet && hasToken)}
        isSwitchingSource={isPreparingShare}
        onSwitchToGoogleDriveExport={() =>
          handleShareTelegram(shareModal.scope, true)
        }
        onClose={() =>
          setShareModal((prev) => ({
            ...prev,
            open: false,
          }))
        }
      />

      {/* Email/Password Sign Up, Sign In & Google Fallback Modal */}
      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        isGoogleLoading={isLoggingIn}
        onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        onEmailSignUp={handleEmailSignUp}
        onEmailSignIn={handleEmailSignIn}
        onResetPassword={handleResetPassword}
        onGoogleSignIn={() => void handleSignIn(true)}
        onGoogleRedirect={handleSignInRedirect}
      />

      {/* Account Personal Info & Profile Photo Modal */}
      <AccountProfileModal
        open={isProfileModalOpen}
        user={user}
        initialProfile={userProfile}
        defaultSchoolName={settings.schoolName}
        defaultTeacherName={settings.teacherName}
        onClose={() => setIsProfileModalOpen(false)}
        onSave={handleSaveUserProfile}
      />

      {/* Non-blocking Recording / Auto-Save Toast Notification */}
      <RecordToast
        toast={recordToast}
        onDismiss={dismissRecordToast}
        onPauseAutoDismiss={handlePauseToastDismiss}
        onResumeAutoDismiss={handleResumeToastDismiss}
      />

      {/* Offline Status Indicator */}
      <OfflineIndicator />
    </div>
    </UserProfileProvider>
  );
}

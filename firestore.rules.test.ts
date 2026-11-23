export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string | null;
    emailVerified: boolean;
  };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read',
    operation: 'list',
    path: 'users/teacherA/customHolidays',
    auth: { uid: null, emailVerified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unauthenticated Write',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: null, emailVerified: false },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'វិស្សមកាលតូច',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Tenant List',
    operation: 'list',
    path: 'users/teacherA/customHolidays',
    auth: { uid: 'teacherB', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-Tenant Create (Path Spoof)',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherB', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing in Body',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherB',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unverified Email Write',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: false },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow / Ghost Field Injection',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
      createdAt: 'REQUEST_TIME',
      isAdmin: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Missing Required Field',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-Forged Timestamp',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'ប្រជុំគ្រូ',
      createdAt: '2020-01-01T00:00:00.000Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized Title (> 120 chars)',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '2026-04-20',
      title: 'x'.repeat(121),
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid Date Format',
    operation: 'create',
    path: 'users/teacherA/customHolidays/h_bad_date',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      date: '20-04-2026',
      title: 'ប្រជុំគ្រូ',
      createdAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Direct Mutation / Update Gap Attempt',
    operation: 'update',
    path: 'users/teacherA/customHolidays/h_2026_04_20',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherB',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Cross-Tenant Gradebook Update Attempt',
    operation: 'update',
    path: 'users/teacherA/gradebooks/default',
    auth: { uid: 'teacherB', emailVerified: true },
    payload: {
      remarks: { s1: 'tampered' },
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Gradebook Immutable createdAt Mutation Attempt',
    operation: 'update',
    path: 'users/teacherA/gradebooks/default',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 15,
    name: 'Gradebook Oversized Students List (> 200)',
    operation: 'create',
    path: 'users/teacherA/gradebooks/default',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      studentsCount: 201,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 16,
    name: 'Private Profile Cross-Tenant List Attempt',
    operation: 'list',
    path: 'users/teacherA/private',
    auth: { uid: 'teacherB', emailVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 17,
    name: 'Private Profile Invalid Photo Protocol Injection',
    operation: 'create',
    path: 'users/teacherA/private/profile',
    auth: { uid: 'teacherA', emailVerified: true },
    payload: {
      userId: 'teacherA',
      displayName: 'គ្រូបន្ទុកថ្នាក់',
      photoDataUrl: 'javascript:alert(1)',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];


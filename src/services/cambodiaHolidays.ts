import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface CambodiaHoliday {
  date: string; // YYYY-MM-DD
  month: number; // 1..12
  day: number; // 1..31
  khmerName: string;
  englishName: string;
  source: 'api' | 'official' | 'custom';
  isCustom?: boolean;
  hasOfficialHoliday?: boolean;
  customIds?: string[];
}

export interface CustomHolidayEntry {
  id: string;
  userId?: string;
  date: string; // YYYY-MM-DD
  title: string;
}

interface NagerHolidayItem {
  date: string;
  localName?: string;
  name?: string;
}

const CACHE_PREFIX = 'khmer_classbook_kh_holidays_v1_';
const CUSTOM_HOLIDAYS_STORAGE_PREFIX = 'khmer_classbook_custom_holidays_v2_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const MAX_CUSTOM_HOLIDAY_TITLE_LENGTH = 120;
const CUSTOM_HOLIDAY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const CUSTOM_HOLIDAY_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const memoryCache = new Map<number, CambodiaHoliday[]>();
const inFlightRequests = new Map<number, Promise<CambodiaHoliday[]>>();

const FIXED_ANNUAL_HOLIDAYS: Array<{
  month: number;
  day: number;
  khmerName: string;
  englishName: string;
}> = [
  {
    month: 1,
    day: 1,
    khmerName: 'ទិវាបុណ្យចូលឆ្នាំសកល',
    englishName: "International New Year's Day",
  },
  {
    month: 1,
    day: 7,
    khmerName: 'ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍',
    englishName: 'Victory over Genocide Day',
  },
  {
    month: 3,
    day: 8,
    khmerName: 'ទិវានារីអន្តរជាតិ',
    englishName: "International Women's Day",
  },
  {
    month: 4,
    day: 14,
    khmerName: 'ពិធីបុណ្យចូលឆ្នាំថ្មី ប្រពៃណីជាតិ',
    englishName: 'Khmer New Year (Day 1)',
  },
  {
    month: 4,
    day: 15,
    khmerName: 'ពិធីបុណ្យចូលឆ្នាំថ្មី ប្រពៃណីជាតិ',
    englishName: 'Khmer New Year (Day 2)',
  },
  {
    month: 4,
    day: 16,
    khmerName: 'ពិធីបុណ្យចូលឆ្នាំថ្មី ប្រពៃណីជាតិ',
    englishName: 'Khmer New Year (Day 3)',
  },
  {
    month: 5,
    day: 1,
    khmerName: 'ទិវាពលកម្មអន្តរជាតិ',
    englishName: 'International Labour Day',
  },
  {
    month: 5,
    day: 14,
    khmerName: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម ព្រះករុណា នរោត្តម សីហមុនី',
    englishName: "King Norodom Sihamoni's Birthday",
  },
  {
    month: 6,
    day: 18,
    khmerName: 'ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្ម សម្ដេចព្រះមហាក្សត្រី នរោត្តម មុនិនាថ សីហនុ',
    englishName: "Queen Mother's Birthday",
  },
  {
    month: 9,
    day: 24,
    khmerName: 'ទិវាប្រកាសរដ្ឋធម្មនុញ្ញ',
    englishName: 'Constitution Day',
  },
  {
    month: 10,
    day: 15,
    khmerName: 'ព្រះរាជពិធីគោរពព្រះវិញ្ញាណក្ខន្ធ ព្រះបរមរតនកោដ្ឋ',
    englishName: 'Commemoration Day of King Father',
  },
  {
    month: 10,
    day: 29,
    khmerName: 'ព្រះរាជពិធីគ្រងព្រះបរមរាជសម្បត្តិ ព្រះករុណា នរោត្តម សីហមុនី',
    englishName: "King Sihamoni's Coronation Day",
  },
  {
    month: 11,
    day: 9,
    khmerName: 'ទិវាបុណ្យឯករាជ្យជាតិ',
    englishName: 'National Independence Day',
  },
  {
    month: 12,
    day: 29,
    khmerName: 'ទិវាសន្តិភាពនៅកម្ពុជា',
    englishName: 'Peace Day in Cambodia',
  },
];

// Official Royal Sub-Decree lunar/variable holidays (Sub-Decrees 204/2024, 167/2025, 198/2026)
const OFFICIAL_LUNAR_HOLIDAYS_BY_YEAR: Record<
  number,
  Array<{ month: number; day: number; khmerName: string; englishName: string }>
> = {
  2025: [
    {
      month: 5,
      day: 11,
      khmerName: 'ពិធីបុណ្យវិសាខបូជា',
      englishName: 'Visak Bochea Day',
    },
    {
      month: 5,
      day: 15,
      khmerName: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល',
      englishName: 'Royal Ploughing Ceremony',
    },
    {
      month: 9,
      day: 21,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 9,
      day: 22,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 9,
      day: 23,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 11,
      day: 4,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 5,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 6,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
  ],
  2026: [
    {
      month: 5,
      day: 1,
      khmerName: 'ពិធីបុណ្យវិសាខបូជា',
      englishName: 'Visak Bochea Day',
    },
    {
      month: 5,
      day: 5,
      khmerName: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល',
      englishName: 'Royal Ploughing Ceremony',
    },
    {
      month: 10,
      day: 10,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 10,
      day: 11,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 10,
      day: 12,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 11,
      day: 23,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 24,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 25,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
  ],
  2027: [
    {
      month: 5,
      day: 20,
      khmerName: 'ពិធីបុណ្យវិសាខបូជា',
      englishName: 'Visak Bochea Day',
    },
    {
      month: 5,
      day: 24,
      khmerName: 'ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល',
      englishName: 'Royal Ploughing Ceremony',
    },
    {
      month: 9,
      day: 29,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 9,
      day: 30,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 10,
      day: 1,
      khmerName: 'ពិធីបុណ្យភ្ជុំបិណ្ឌ',
      englishName: 'Pchum Ben Festival',
    },
    {
      month: 11,
      day: 12,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 13,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
    {
      month: 11,
      day: 14,
      khmerName: 'ពិធីបុណ្យអុំទូក បណ្ដែតប្រទីប និងសំពះព្រះខែ អកអំបុក',
      englishName: 'Water Festival',
    },
  ],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeKhmerHolidayName(rawName: string): string {
  return rawName
    .replace(/ភ្ផុំបិណ្ឌ/g, 'ភ្ជុំបិណ្ឌ')
    .replace(/សម្តេច/g, 'សម្ដេច')
    .trim();
}

export function buildHolidayDateKey(
  year: number,
  month: number,
  day: number
): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function mergeHolidayLists(
  baseList: CambodiaHoliday[],
  extraList: CambodiaHoliday[]
): CambodiaHoliday[] {
  const byDate = new Map<string, CambodiaHoliday>();

  const upsert = (item: CambodiaHoliday) => {
    const isOfficialItem = item.source !== 'custom';
    const existing = byDate.get(item.date);
    if (!existing) {
      byDate.set(item.date, {
        ...item,
        hasOfficialHoliday: item.hasOfficialHoliday ?? isOfficialItem,
        isCustom: item.isCustom ?? item.source === 'custom',
        customIds: item.customIds ? [...item.customIds] : undefined,
      });
      return;
    }

    const existingParts = existing.khmerName.split(' / ').map((s) => s.trim());
    const incomingName = item.khmerName.trim();
    const isDuplicateConcept = existingParts.some(
      (part) =>
        part === incomingName ||
        part.includes(incomingName) ||
        incomingName.includes(part)
    );

    if (!isDuplicateConcept && incomingName) {
      existing.khmerName = `${existing.khmerName} / ${incomingName}`;
      existing.englishName = `${existing.englishName} & ${item.englishName}`;
    } else if (
      item.source === 'official' &&
      incomingName.length >= existing.khmerName.length
    ) {
      existing.khmerName = incomingName;
    }

    if (item.source === 'api' && existing.source !== 'custom') {
      existing.source = 'api';
    }
    if (isOfficialItem) {
      existing.hasOfficialHoliday = true;
    }
    if (item.source === 'custom' || item.isCustom) {
      existing.isCustom = true;
      const mergedIds = new Set([
        ...(existing.customIds || []),
        ...(item.customIds || []),
      ]);
      existing.customIds = Array.from(mergedIds);
    }
  };

  baseList.forEach(upsert);
  extraList.forEach(upsert);

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function getOfficialFallbackHolidays(year: number): CambodiaHoliday[] {
  const fixed: CambodiaHoliday[] = FIXED_ANNUAL_HOLIDAYS.map((h) => ({
    date: buildHolidayDateKey(year, h.month, h.day),
    month: h.month,
    day: h.day,
    khmerName: h.khmerName,
    englishName: h.englishName,
    source: 'official',
    hasOfficialHoliday: true,
    isCustom: false,
  }));

  const lunar: CambodiaHoliday[] = (OFFICIAL_LUNAR_HOLIDAYS_BY_YEAR[year] || []).map(
    (h) => ({
      date: buildHolidayDateKey(year, h.month, h.day),
      month: h.month,
      day: h.day,
      khmerName: h.khmerName,
      englishName: h.englishName,
      source: 'official',
      hasOfficialHoliday: true,
      isCustom: false,
    })
  );

  return mergeHolidayLists(fixed, lunar);
}

function readCachedHolidays(year: number): {
  holidays: CambodiaHoliday[];
  isFresh: boolean;
} | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      fetchedAt?: number;
      holidays?: CambodiaHoliday[];
    };
    if (!Array.isArray(parsed?.holidays) || parsed.holidays.length === 0) {
      return null;
    }
    const age = Date.now() - (parsed.fetchedAt || 0);
    return {
      holidays: parsed.holidays,
      isFresh: age >= 0 && age < CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function writeCachedHolidays(year: number, holidays: CambodiaHoliday[]) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${year}`,
      JSON.stringify({
        fetchedAt: Date.now(),
        holidays,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getInitialCambodiaHolidays(year: number): CambodiaHoliday[] {
  const mem = memoryCache.get(year);
  if (mem) return mem;

  const cached = readCachedHolidays(year);
  if (cached) {
    const merged = mergeHolidayLists(getOfficialFallbackHolidays(year), cached.holidays);
    memoryCache.set(year, merged);
    return merged;
  }

  return getOfficialFallbackHolidays(year);
}

export async function fetchCambodiaHolidays(
  year: number,
  forceRefresh = false
): Promise<CambodiaHoliday[]> {
  if (!forceRefresh) {
    const mem = memoryCache.get(year);
    const cached = readCachedHolidays(year);
    if (mem && cached?.isFresh) {
      return mem;
    }
    if (cached?.isFresh) {
      const merged = mergeHolidayLists(
        getOfficialFallbackHolidays(year),
        cached.holidays
      );
      memoryCache.set(year, merged);
      return merged;
    }
  }

  const existingReq = inFlightRequests.get(year);
  if (existingReq && !forceRefresh) {
    return existingReq;
  }

  const req = (async () => {
    const fallback = getOfficialFallbackHolidays(year);
    try {
      const response = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/KH`,
        {
          headers: { Accept: 'application/json' },
        }
      );
      if (!response.ok) {
        throw new Error(`Holiday API HTTP ${response.status}`);
      }
      const data = (await response.json()) as NagerHolidayItem[];
      const parsedApi = (Array.isArray(data) ? data : [])
        .map((item): CambodiaHoliday | null => {
          const match = item.date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!match) return null;
          const m = Number(match[2]);
          const d = Number(match[3]);
          const khmerName = normalizeKhmerHolidayName(
            item.localName || item.name || ''
          );
          if (!khmerName) return null;
          return {
            date: item.date,
            month: m,
            day: d,
            khmerName,
            englishName: item.name || khmerName,
            source: 'api',
            hasOfficialHoliday: true,
            isCustom: false,
          };
        })
        .filter((x): x is CambodiaHoliday => x !== null);

      const merged = mergeHolidayLists(fallback, parsedApi);
      memoryCache.set(year, merged);
      writeCachedHolidays(year, merged);
      return merged;
    } catch {
      memoryCache.set(year, fallback);
      return fallback;
    } finally {
      inFlightRequests.delete(year);
    }
  })();

  inFlightRequests.set(year, req);
  return req;
}

function getCustomHolidaysStorageKey(uid: string): string {
  return `${CUSTOM_HOLIDAYS_STORAGE_PREFIX}${uid}`;
}

function isValidUid(uid?: string | null): uid is string {
  return Boolean(uid && uid.length >= 1 && uid.length <= 128 && CUSTOM_HOLIDAY_ID_REGEX.test(uid));
}

export function sanitizeCustomHolidayTitle(rawTitle: string): string {
  const trimmed = rawTitle.trim();
  if (!trimmed) return '';
  return Array.from(trimmed).slice(0, MAX_CUSTOM_HOLIDAY_TITLE_LENGTH).join('');
}

export function loadCachedCustomHolidays(uid?: string | null): CustomHolidayEntry[] {
  if (!isValidUid(uid)) return [];
  try {
    const raw = localStorage.getItem(getCustomHolidaysStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CustomHolidayEntry =>
          Boolean(
            item &&
              typeof item.id === 'string' &&
              CUSTOM_HOLIDAY_ID_REGEX.test(item.id) &&
              typeof item.date === 'string' &&
              CUSTOM_HOLIDAY_DATE_REGEX.test(item.date) &&
              typeof item.title === 'string' &&
              item.title.trim()
          )
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function saveCachedCustomHolidays(uid: string, entries: CustomHolidayEntry[]) {
  if (!isValidUid(uid)) return;
  try {
    localStorage.setItem(getCustomHolidaysStorageKey(uid), JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export function subscribeUserCustomHolidays(
  uid: string,
  onUpdate: (entries: CustomHolidayEntry[]) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!isValidUid(uid)) {
    onUpdate([]);
    return () => {};
  }

  const collectionPath = `users/${uid}/customHolidays`;
  const holidaysQuery = query(
    collection(db, 'users', uid, 'customHolidays'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    holidaysQuery,
    (snapshot) => {
      const entries: CustomHolidayEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          typeof data.date === 'string' &&
          CUSTOM_HOLIDAY_DATE_REGEX.test(data.date) &&
          typeof data.title === 'string' &&
          data.title.trim()
        ) {
          entries.push({
            id: docSnap.id,
            userId: typeof data.userId === 'string' ? data.userId : uid,
            date: data.date,
            title: sanitizeCustomHolidayTitle(data.title),
          });
        }
      });
      const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
      saveCachedCustomHolidays(uid, sorted);
      onUpdate(sorted);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrappedError) {
        onError?.(wrappedError);
      }
    }
  );
}

export async function addUserCustomHolidays(
  uid: string,
  params: {
    startDate: string;
    endDate?: string;
    title: string;
  },
  existingEntries: CustomHolidayEntry[]
): Promise<number> {
  if (!isValidUid(uid)) {
    throw new Error('សូម Sign in with Google ជាមុនសិន។');
  }

  const cleanTitle = sanitizeCustomHolidayTitle(params.title);
  if (!cleanTitle || !CUSTOM_HOLIDAY_DATE_REGEX.test(params.startDate)) {
    return 0;
  }

  const end =
    params.endDate && CUSTOM_HOLIDAY_DATE_REGEX.test(params.endDate)
      ? params.endDate
      : params.startDate;

  const [sY, sM, sD] = params.startDate.split('-').map(Number);
  const [eY, eM, eD] = end.split('-').map(Number);
  const startDt = new Date(sY, sM - 1, sD);
  const endDt = new Date(eY, eM - 1, eD);

  const fromDt = startDt <= endDt ? startDt : endDt;
  const toDt = startDt <= endDt ? endDt : startDt;

  const itemsToCreate: Array<{ id: string; date: string; title: string }> = [];
  const cursor = new Date(fromDt.getTime());
  let safetyCounter = 0;

  while (cursor <= toDt && safetyCounter < 60) {
    const dateKey = buildHolidayDateKey(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      cursor.getDate()
    );
    const alreadySame = existingEntries.some(
      (item) => item.date === dateKey && item.title.trim() === cleanTitle
    );
    if (!alreadySame) {
      const rand = Math.random().toString(36).slice(2, 6) || '0000';
      const docId = `h_${dateKey.replace(/-/g, '')}_${Date.now()}_${safetyCounter}_${rand}`;
      itemsToCreate.push({
        id: docId,
        date: dateKey,
        title: cleanTitle,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    safetyCounter++;
  }

  if (itemsToCreate.length === 0) {
    return 0;
  }

  const userDocPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  let userExists = false;
  try {
    const snap = await getDoc(userRef);
    userExists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }

  const collectionPath = `users/${uid}/customHolidays`;
  try {
    const batch = writeBatch(db);
    if (!userExists) {
      batch.set(userRef, {
        uid,
        createdAt: serverTimestamp(),
      });
    }
    for (const item of itemsToCreate) {
      const holidayRef = doc(db, 'users', uid, 'customHolidays', item.id);
      batch.set(holidayRef, {
        userId: uid,
        date: item.date,
        title: item.title,
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return itemsToCreate.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, collectionPath);
  }
}

export async function removeUserCustomHoliday(
  uid: string,
  holidayId: string
): Promise<void> {
  if (!isValidUid(uid) || !CUSTOM_HOLIDAY_ID_REGEX.test(holidayId)) {
    throw new Error('សូម Sign in with Google ជាមុនសិន។');
  }
  const docPath = `users/${uid}/customHolidays/${holidayId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customHolidays', holidayId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function mergeWithCustomHolidays(
  officialHolidays: CambodiaHoliday[],
  customEntries: CustomHolidayEntry[],
  year: number
): CambodiaHoliday[] {
  const yearPrefix = `${year}-`;
  const customForYear: CambodiaHoliday[] = customEntries
    .filter((entry) => entry.date.startsWith(yearPrefix))
    .map((entry) => {
      const [, mStr, dStr] = entry.date.split('-');
      return {
        date: entry.date,
        month: Number(mStr),
        day: Number(dStr),
        khmerName: entry.title,
        englishName: 'ថ្ងៃឈប់បន្ថែមដោយអ្នកប្រើប្រាស់',
        source: 'custom',
        isCustom: true,
        hasOfficialHoliday: false,
        customIds: [entry.id],
      };
    });

  return mergeHolidayLists(officialHolidays, customForYear);
}

export function getHolidayByDate(
  holidays: CambodiaHoliday[],
  year: number,
  month: number,
  day: number
): CambodiaHoliday | undefined {
  const key = buildHolidayDateKey(year, month, day);
  return holidays.find((h) => h.date === key);
}

export function getHolidaysInMonth(
  holidays: CambodiaHoliday[],
  year: number,
  month: number
): CambodiaHoliday[] {
  const prefix = `${year}-${pad2(month)}-`;
  return holidays
    .filter((h) => h.date.startsWith(prefix))
    .sort((a, b) => a.day - b.day);
}

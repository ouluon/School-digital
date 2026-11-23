import { updateProfile } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { auth } from './googleAuth';

export const PROFILE_DOC_ID = 'profile';
const LOCAL_PROFILE_PREFIX = 'khmer_classbook_profile_v1_';
const UID_REGEX = /^[a-zA-Z0-9_-]+$/;

// Blueprint-synchronized volumetric limits
export const PROFILE_LIMITS = {
  DISPLAY_NAME_MAX: 100,
  SCHOOL_NAME_MAX: 150,
  ROLE_TITLE_MAX: 100,
  PHONE_MAX: 40,
  ADDRESS_MAX: 200,
  BIO_MAX: 300,
  PHOTO_DATA_URL_MAX: 120000,
} as const;

const PHOTO_DATA_URL_REGEX =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const PHOTO_HTTPS_REGEX = /^https:\/\/.*$/;

export type ProfileGender = 'ប្រុស' | 'ស្រី' | '';

export interface UserProfileData {
  displayName: string;
  schoolName?: string;
  roleTitle?: string;
  phone?: string;
  gender?: ProfileGender;
  address?: string;
  bio?: string;
  photoDataUrl?: string;
  updatedAtMs?: number;
}

const profileCreatedAtCache = new Map<string, Timestamp>();

function isValidUid(uid?: string | null): uid is string {
  return Boolean(uid && uid.length >= 1 && uid.length <= 128 && UID_REGEX.test(uid));
}

export function isValidProfilePhotoUrl(value?: string | null): boolean {
  if (!value) return true;
  if (value.length > PROFILE_LIMITS.PHOTO_DATA_URL_MAX) return false;
  return PHOTO_DATA_URL_REGEX.test(value) || PHOTO_HTTPS_REGEX.test(value);
}

export function sanitizeUserProfile(
  raw: Partial<UserProfileData> | null | undefined,
  fallbackDisplayName = 'គណនីគ្រូបន្ទុកថ្នាក់'
): UserProfileData {
  const safeName =
    typeof raw?.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim().slice(0, PROFILE_LIMITS.DISPLAY_NAME_MAX)
      : fallbackDisplayName.trim().slice(0, PROFILE_LIMITS.DISPLAY_NAME_MAX) ||
        'គណនីគ្រូបន្ទុកថ្នាក់';

  const safeGender: ProfileGender =
    raw?.gender === 'ប្រុស' || raw?.gender === 'ស្រី' ? raw.gender : '';

  const rawPhoto =
    typeof raw?.photoDataUrl === 'string' ? raw.photoDataUrl.trim() : '';
  const safePhoto = isValidProfilePhotoUrl(rawPhoto) ? rawPhoto : '';

  return {
    displayName: safeName,
    schoolName:
      typeof raw?.schoolName === 'string'
        ? raw.schoolName.trim().slice(0, PROFILE_LIMITS.SCHOOL_NAME_MAX)
        : '',
    roleTitle:
      typeof raw?.roleTitle === 'string'
        ? raw.roleTitle.trim().slice(0, PROFILE_LIMITS.ROLE_TITLE_MAX)
        : '',
    phone:
      typeof raw?.phone === 'string'
        ? raw.phone.trim().slice(0, PROFILE_LIMITS.PHONE_MAX)
        : '',
    gender: safeGender,
    address:
      typeof raw?.address === 'string'
        ? raw.address.trim().slice(0, PROFILE_LIMITS.ADDRESS_MAX)
        : '',
    bio:
      typeof raw?.bio === 'string'
        ? raw.bio.trim().slice(0, PROFILE_LIMITS.BIO_MAX)
        : '',
    photoDataUrl: safePhoto,
    updatedAtMs:
      typeof raw?.updatedAtMs === 'number' && Number.isFinite(raw.updatedAtMs)
        ? raw.updatedAtMs
        : 0,
  };
}

export function loadLocalUserProfile(
  uid?: string | null
): UserProfileData | null {
  if (!isValidUid(uid)) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfileData>;
    return sanitizeUserProfile(parsed);
  } catch {
    return null;
  }
}

export function saveLocalUserProfile(
  uid: string,
  profile: UserProfileData
): void {
  if (!isValidUid(uid)) return;
  try {
    const clean = sanitizeUserProfile(profile);
    localStorage.setItem(`${LOCAL_PROFILE_PREFIX}${uid}`, JSON.stringify(clean));
  } catch {
    // ignore storage quota errors
  }
}

export async function loadUserProfileFromCloud(
  uid: string
): Promise<UserProfileData | null> {
  if (!isValidUid(uid)) return null;

  const docPath = `users/${uid}/private/${PROFILE_DOC_ID}`;
  const docRef = doc(db, 'users', uid, 'private', PROFILE_DOC_ID);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const raw = snap.data();
    if (raw.createdAt instanceof Timestamp) {
      profileCreatedAtCache.set(uid, raw.createdAt);
    }
    const updatedAtMs =
      raw.updatedAt instanceof Timestamp ? raw.updatedAt.toMillis() : Date.now();

    return sanitizeUserProfile({
      displayName: typeof raw.displayName === 'string' ? raw.displayName : '',
      schoolName: typeof raw.schoolName === 'string' ? raw.schoolName : '',
      roleTitle: typeof raw.roleTitle === 'string' ? raw.roleTitle : '',
      phone: typeof raw.phone === 'string' ? raw.phone : '',
      gender:
        raw.gender === 'ប្រុស' || raw.gender === 'ស្រី' ? raw.gender : '',
      address: typeof raw.address === 'string' ? raw.address : '',
      bio: typeof raw.bio === 'string' ? raw.bio : '',
      photoDataUrl:
        typeof raw.photoDataUrl === 'string' ? raw.photoDataUrl : '',
      updatedAtMs,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveUserProfileToCloud(
  uid: string,
  profile: UserProfileData
): Promise<void> {
  if (!isValidUid(uid)) return;

  const clean = sanitizeUserProfile(profile);
  const profilePath = `users/${uid}/private/${PROFILE_DOC_ID}`;
  const profileRef = doc(db, 'users', uid, 'private', PROFILE_DOC_ID);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const firestorePayload = {
    displayName: clean.displayName,
    schoolName: clean.schoolName || '',
    roleTitle: clean.roleTitle || '',
    phone: clean.phone || '',
    gender: clean.gender || '',
    address: clean.address || '',
    bio: clean.bio || '',
    photoDataUrl: clean.photoDataUrl || '',
  };

  let cachedCreatedAt = profileCreatedAtCache.get(uid);
  if (!cachedCreatedAt) {
    try {
      const existingSnap = await getDoc(profileRef);
      if (existingSnap.exists()) {
        const rawCreated = existingSnap.data().createdAt;
        if (rawCreated instanceof Timestamp) {
          cachedCreatedAt = rawCreated;
          profileCreatedAtCache.set(uid, rawCreated);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, profilePath);
    }
  }

  if (cachedCreatedAt) {
    try {
      await updateDoc(profileRef, {
        ...firestorePayload,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
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
      batch.set(profileRef, {
        userId: uid,
        ...firestorePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await setDoc(profileRef, {
        userId: uid,
        ...firestorePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const createdSnap = await getDoc(profileRef);
    if (
      createdSnap.exists() &&
      createdSnap.data().createdAt instanceof Timestamp
    ) {
      profileCreatedAtCache.set(
        uid,
        createdSnap.data().createdAt as Timestamp
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, profilePath);
  }
}

export async function updateAuthProfileName(displayName: string): Promise<void> {
  const current = auth.currentUser;
  const cleanName = displayName
    .trim()
    .slice(0, PROFILE_LIMITS.DISPLAY_NAME_MAX);
  if (!current || !cleanName || current.displayName === cleanName) return;
  await updateProfile(current, { displayName: cleanName });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () =>
          reject(new Error('មិនអាចអានឯកសាររូបភាពនេះបានទេ។'));
        fallbackImg.src = String(reader.result || '');
      };
      reader.onerror = () =>
        reject(new Error('មិនអាចអានឯកសាររូបភាពនេះបានទេ។'));
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

export async function compressProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('សូមជ្រើសរើសឯកសាររូបភាព (JPG, PNG ឬ WebP)។');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('ទំហំរូបភាពធំពេក (> 20MB)។ សូមជ្រើសរើសរូបភាពតូចជាងនេះ។');
  }

  const img = await loadImageElement(file);
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  if (!srcWidth || !srcHeight) {
    throw new Error('រូបភាពមិនត្រឹមត្រូវទេ។ សូមសាកល្បងរូបភាពផ្សេងទៀត។');
  }

  // Center-crop to 1:1 square for crisp circular Profile avatars
  const cropSize = Math.min(srcWidth, srcHeight);
  const sx = Math.floor((srcWidth - cropSize) / 2);
  const sy = Math.floor((srcHeight - cropSize) / 2);

  const attempts: { size: number; mime: 'image/webp' | 'image/jpeg'; quality: number }[] = [
    { size: 256, mime: 'image/jpeg', quality: 0.84 },
    { size: 256, mime: 'image/jpeg', quality: 0.72 },
    { size: 192, mime: 'image/jpeg', quality: 0.68 },
    { size: 160, mime: 'image/jpeg', quality: 0.6 },
  ];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('កម្មវិធី Browser មិនគាំទ្រការបំលែងរូបភាពទេ។');
  }

  for (const attempt of attempts) {
    canvas.width = attempt.size;
    canvas.height = attempt.size;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, attempt.size, attempt.size);
    ctx.drawImage(
      img,
      sx,
      sy,
      cropSize,
      cropSize,
      0,
      0,
      attempt.size,
      attempt.size
    );
    const dataUrl = canvas.toDataURL(attempt.mime, attempt.quality);
    if (
      dataUrl.length <= 95000 &&
      isValidProfilePhotoUrl(dataUrl)
    ) {
      return dataUrl;
    }
  }

  throw new Error('ទំហំរូបភាពនៅតែធំពេកបន្ទាប់ពីបង្រួម។ សូមជ្រើសរើសរូបភាពផ្សេងទៀត។');
}

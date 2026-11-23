import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

function createGoogleProvider(loginHint?: string | null): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  for (const scope of OAUTH_SCOPES) {
    provider.addScope(scope);
  }
  if (loginHint) {
    provider.setCustomParameters({
      login_hint: loginHint,
    });
  } else {
    provider.setCustomParameters({
      prompt: 'select_account',
    });
  }
  return provider;
}

export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function canUseRedirectFlow(): boolean {
  return !isInIframe();
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Telegram|Line\/|Zalo|MicroMessenger|;\s*wv\)/i.test(ua);
}

export function isPasswordAccount(user: User | null): boolean {
  return Boolean(user?.providerData?.some((p) => p.providerId === 'password'));
}

export function hasGoogleProvider(user: User | null): boolean {
  return Boolean(user?.providerData?.some((p) => p.providerId === 'google.com'));
}

export class GoogleAuthError extends Error {
  code: string;
  isPopupClosed: boolean;
  isPopupBlocked: boolean;

  constructor(
    message: string,
    code: string,
    options?: { isPopupClosed?: boolean; isPopupBlocked?: boolean }
  ) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
    this.isPopupClosed = Boolean(options?.isPopupClosed);
    this.isPopupBlocked = Boolean(options?.isPopupBlocked);
  }
}

export function toFriendlyGoogleAuthError(err: unknown): GoogleAuthError {
  if (err instanceof GoogleAuthError) return err;
  const rawCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMessage =
    err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  const inApp = isInAppBrowser();

  if (
    rawCode === 'auth/operation-not-allowed' ||
    rawMessage.includes('auth/operation-not-allowed')
  ) {
    return new GoogleAuthError(
      'ប្រព័ន្ធចុះឈ្មោះដោយអ៊ីមែលមិនទាន់ត្រូវបានបើកនៅក្នុង Firebase Console ទេ។ សូមបើក Email/Password នៅ Authentication → Sign-in method ជាមុនសិន។',
      'auth/operation-not-allowed'
    );
  }

  if (
    rawCode === 'auth/email-already-in-use' ||
    rawMessage.includes('auth/email-already-in-use')
  ) {
    return new GoogleAuthError(
      'អ៊ីមែលនេះត្រូវបានចុះឈ្មោះរួចហើយ។ សូមប្តូរទៅ «ចូលគណនី» ឬចុច «ភ្លេចពាក្យសម្ងាត់»។',
      'auth/email-already-in-use'
    );
  }

  if (
    rawCode === 'auth/invalid-email' ||
    rawMessage.includes('auth/invalid-email')
  ) {
    return new GoogleAuthError(
      'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវទេ។ សូមពិនិត្យអ៊ីមែលរបស់អ្នកម្តងទៀត។',
      'auth/invalid-email'
    );
  }

  if (
    rawCode === 'auth/weak-password' ||
    rawMessage.includes('auth/weak-password')
  ) {
    return new GoogleAuthError(
      'ពាក្យសម្ងាត់ខ្លីពេក។ សូមបញ្ចូលពាក្យសម្ងាត់យ៉ាងតិច ៦ តួអក្សរ។',
      'auth/weak-password'
    );
  }

  if (
    rawCode === 'auth/invalid-credential' ||
    rawCode === 'auth/wrong-password' ||
    rawCode === 'auth/user-not-found' ||
    rawMessage.includes('auth/invalid-credential') ||
    rawMessage.includes('auth/wrong-password') ||
    rawMessage.includes('auth/user-not-found')
  ) {
    return new GoogleAuthError(
      'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។ សូមពិនិត្យម្តងទៀត ឬចុចបង្កើតគណនីថ្មី។',
      rawCode || 'auth/invalid-credential'
    );
  }

  if (
    rawCode === 'auth/too-many-requests' ||
    rawMessage.includes('auth/too-many-requests')
  ) {
    return new GoogleAuthError(
      'អ្នកបានព្យាយាមច្រើនដងពេក។ សូមរង់ចាំបន្តិច រួចសាកល្បងម្តងទៀត។',
      'auth/too-many-requests'
    );
  }

  if (
    rawCode === 'auth/popup-closed-by-user' ||
    rawMessage.includes('auth/popup-closed-by-user')
  ) {
    const msg = inApp
      ? 'ផ្ទាំងចូលគណនី Google ត្រូវបានបិទ។ ប្រសិនបើឃើញ Error 403 (access_denied) ឬ Browser រារាំង សូមបង្កើតគណនីដោយប្រើអ៊ីមែលជំនួសវិញ ឬបើកក្នុង Chrome / Safari។'
      : 'ផ្ទាំងចូលគណនី Google ត្រូវបានបិទមុនពេលបញ្ចប់។ ប្រសិនបើឃើញ Error 403 (access_denied) សូមបង្កើតគណនីដោយអ៊ីមែលជំនួសវិញ។';
    return new GoogleAuthError(msg, 'auth/popup-closed-by-user', {
      isPopupClosed: true,
    });
  }

  if (
    rawMessage.includes('access_denied') ||
    rawCode.includes('access_denied')
  ) {
    return new GoogleAuthError(
      'គណនី Gmail នេះមិនទាន់មានសិទ្ធិចូលប្រើក្នុងដំណាក់កាល Testing ទេ (Error 403: access_denied)។ សូមបង្កើតគណនីដោយអ៊ីមែលជំនួសវិញ ដើម្បីចូលប្រើភ្លាមៗ។',
      'auth/access-denied',
      { isPopupClosed: true }
    );
  }

  if (
    rawCode === 'auth/popup-blocked' ||
    rawMessage.includes('auth/popup-blocked')
  ) {
    return new GoogleAuthError(
      'កម្មវិធី Browser បានរារាំងផ្ទាំង Popup ចូលគណនី Google។ សូមអនុញ្ញាត Popup ឬប្រើវិធីបង្កើតគណនីដោយអ៊ីមែល។',
      'auth/popup-blocked',
      { isPopupBlocked: true }
    );
  }

  if (
    rawCode === 'auth/cancelled-popup-request' ||
    rawMessage.includes('auth/cancelled-popup-request')
  ) {
    return new GoogleAuthError(
      'សំណើចូលគណនីមុនត្រូវបានលុបចោល។ សូមរង់ចាំបន្តិច ហើយចុច Sign in តែម្តងបានហើយ។',
      'auth/cancelled-popup-request',
      { isPopupClosed: true }
    );
  }

  if (
    rawCode === 'auth/network-request-failed' ||
    rawMessage.includes('auth/network-request-failed')
  ) {
    return new GoogleAuthError(
      'បណ្តាញអ៊ីនធឺណិតមានបញ្ហា។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត រួចសាកល្បងម្តងទៀត។',
      'auth/network-request-failed'
    );
  }

  if (
    rawCode === 'auth/unauthorized-domain' ||
    rawMessage.includes('auth/unauthorized-domain')
  ) {
    return new GoogleAuthError(
      'គេហទំព័រនេះមិនទាន់អាចប្រើ Google Sign-In បានដោយផ្ទាល់នៅទីនេះទេ។ សូមបង្កើតគណនីដោយអ៊ីមែលជំនួសវិញ។',
      'auth/unauthorized-domain'
    );
  }

  if (
    rawCode === 'auth/user-disabled' ||
    rawMessage.includes('auth/user-disabled')
  ) {
    return new GoogleAuthError(
      'គណនីនេះត្រូវបានផ្អាកដំណើរការ។',
      'auth/user-disabled'
    );
  }

  return new GoogleAuthError(
    rawMessage || 'មិនអាចភ្ជាប់គណនីបានទេ។ សូមព្យាយាមម្តងទៀត។',
    rawCode || 'auth/unknown'
  );
}

let isSigningIn = false;
let isCheckingRedirect = true;
let inFlightSignIn: Promise<{ user: User; accessToken: string } | null> | null = null;
// Strictly in-memory token caching per security guidelines (never localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void,
  onAuthError?: (err: GoogleAuthError) => void
) => {
  let active = true;

  getRedirectResult(auth)
    .then((result) => {
      if (!active) return;
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          onAuthSuccess?.(result.user, cachedAccessToken);
          return;
        }
      }
      if (!cachedAccessToken && !isSigningIn) {
        onAuthFailure?.(auth.currentUser);
      }
    })
    .catch((err) => {
      if (!active) return;
      onAuthError?.(toFriendlyGoogleAuthError(err));
      onAuthFailure?.(auth.currentUser);
    })
    .finally(() => {
      isCheckingRedirect = false;
    });

  const unsub = onAuthStateChanged(auth, (user: User | null) => {
    if (!active || isSigningIn || isCheckingRedirect) return;
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });

  return () => {
    active = false;
    unsub();
  };
};

export const emailSignUp = async (params: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ user: User; verificationSent: boolean }> => {
  const cleanName = params.displayName.trim();
  const cleanEmail = params.email.trim();
  if (!cleanEmail) {
    throw new GoogleAuthError('សូមបញ្ចូលអ៊ីមែលរបស់អ្នក។', 'auth/invalid-email');
  }
  if (params.password.length < 6) {
    throw new GoogleAuthError(
      'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។',
      'auth/weak-password'
    );
  }

  try {
    isSigningIn = true;
    cachedAccessToken = null;
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName });
    }
    let verificationSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationSent = true;
    } catch {
      verificationSent = false;
    }
    return { user: cred.user, verificationSent };
  } catch (err: unknown) {
    throw toFriendlyGoogleAuthError(err);
  } finally {
    isSigningIn = false;
  }
};

export const emailSignIn = async (params: {
  email: string;
  password: string;
}): Promise<User> => {
  const cleanEmail = params.email.trim();
  if (!cleanEmail) {
    throw new GoogleAuthError('សូមបញ្ចូលអ៊ីមែលរបស់អ្នក។', 'auth/invalid-email');
  }
  if (!params.password) {
    throw new GoogleAuthError('សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នក។', 'auth/missing-password');
  }

  try {
    isSigningIn = true;
    cachedAccessToken = null;
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, params.password);
    return cred.user;
  } catch (err: unknown) {
    throw toFriendlyGoogleAuthError(err);
  } finally {
    isSigningIn = false;
  }
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new GoogleAuthError('សូមបញ្ចូលអ៊ីមែលរបស់អ្នកជាមុនសិន។', 'auth/invalid-email');
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    throw toFriendlyGoogleAuthError(err);
  }
};

export const resendVerificationEmail = async (): Promise<void> => {
  const current = auth.currentUser;
  if (!current) {
    throw new GoogleAuthError('សូមចូលគណនីជាមុនសិន។', 'auth/no-current-user');
  }
  try {
    await sendEmailVerification(current);
  } catch (err: unknown) {
    throw toFriendlyGoogleAuthError(err);
  }
};

export const refreshVerifiedUser = async (): Promise<User | null> => {
  const current = auth.currentUser;
  if (!current) return null;
  try {
    await current.reload();
    await current.getIdToken(true);
    return auth.currentUser;
  } catch (err: unknown) {
    throw toFriendlyGoogleAuthError(err);
  }
};

export const googleSignInWithRedirect = async (options?: {
  forceSelectAccount?: boolean;
}): Promise<void> => {
  if (options?.forceSelectAccount) {
    cachedAccessToken = null;
  }
  const loginHint = options?.forceSelectAccount ? null : auth.currentUser?.email;
  const provider = createGoogleProvider(loginHint);
  await signInWithRedirect(auth, provider);
};

export const googleSignIn = async (options?: {
  forceSelectAccount?: boolean;
}): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  if (inFlightSignIn) {
    return inFlightSignIn;
  }

  const runSignIn = async (): Promise<{
    user: User;
    accessToken: string;
  } | null> => {
    try {
      isSigningIn = true;
      if (options?.forceSelectAccount) {
        cachedAccessToken = null;
      }
      const loginHint = options?.forceSelectAccount ? null : auth.currentUser?.email;
      const provider = createGoogleProvider(loginHint);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new GoogleAuthError(
          'មិនទទួលបានសិទ្ធិចូលប្រើ Google Sheets ទេ។ សូមសាកល្បងម្តងទៀត ហើយធីកយល់ព្រមសិទ្ធិទាំងអស់។',
          'auth/missing-access-token'
        );
      }
      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (err: unknown) {
      const friendly = toFriendlyGoogleAuthError(err);
      if (friendly.isPopupBlocked && canUseRedirectFlow()) {
        await googleSignInWithRedirect();
        return null;
      }
      throw friendly;
    } finally {
      isSigningIn = false;
      inFlightSignIn = null;
    }
  };

  inFlightSignIn = runSignIn();
  return inFlightSignIn;
};

export const getAccessToken = (): string | null => cachedAccessToken;

export const clearAccessToken = () => {
  cachedAccessToken = null;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

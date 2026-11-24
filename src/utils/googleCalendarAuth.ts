import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of CALENDAR_SCOPES) {
  provider.addScope(scope);
}

let isSigningIn = false;
// Access token is strictly held in memory only — never localStorage or sessionStorage.
let cachedAccessToken: string | null = null;

export const initCalendarAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });
};

export const googleCalendarSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Calendar access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getCalendarAccessToken = (): string | null => cachedAccessToken;

export const calendarLogout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface CalendarEventItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

export interface CalendarEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function listCalendarEvents(
  accessToken: string,
  daysAhead = 7
): Promise<CalendarEventItem[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });

  const res = await fetch(`${CALENDAR_API_BASE}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESSION_EXPIRED');
  }

  const data = (await res.json()) as {
    items?: CalendarEventItem[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Calendar API error (${res.status})`);
  }

  return data.items ?? [];
}

export async function createCalendarEvent(
  accessToken: string,
  payload: CalendarEventPayload
): Promise<CalendarEventItem> {
  const res = await fetch(CALENDAR_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESSION_EXPIRED');
  }

  const data = (await res.json()) as CalendarEventItem & {
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Failed to create event (${res.status})`);
  }

  return data;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  payload: Partial<CalendarEventPayload>
): Promise<CalendarEventItem> {
  const res = await fetch(`${CALENDAR_API_BASE}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESSION_EXPIRED');
  }

  const data = (await res.json()) as CalendarEventItem & {
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Failed to update event (${res.status})`);
  }

  return data;
}

export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`${CALENDAR_API_BASE}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok && res.status !== 204) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(data.error?.message || `Failed to delete event (${res.status})`);
  }
}

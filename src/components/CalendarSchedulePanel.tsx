import React, { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Calendar,
  Clock,
  LogOut,
  MapPin,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  calendarLogout,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarAccessToken,
  googleCalendarSignIn,
  initCalendarAuth,
  listCalendarEvents,
  updateCalendarEvent,
  type CalendarEventItem,
} from '../utils/googleCalendarAuth';

interface CalendarSchedulePanelProps {
  prefillLocation?: { name: string; address: string } | null;
  onClearPrefill?: () => void;
  onDiscussScheduleWithEevee: (eventsSummary: string) => void;
}

interface PendingMutation {
  type: 'create' | 'update' | 'delete';
  eventId?: string;
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
}

const EEVEE_TEMPLATES = [
  {
    label: 'Dinner Deadline',
    summary: 'Serve The Anomalous Eevee Dinner',
    description: 'Mandatory prompt feeding to prevent Judgment in the kitchen.',
  },
  {
    label: 'Master Ball Care',
    summary: 'Master Ball Calibration & Polish',
    description: 'Routine transport inspection with The Anomalous Eevee.',
  },
  {
    label: 'Sparring Drill',
    summary: 'Evening Tactical Sparring Session',
    description: 'Arceus Plate & Eeveelution form switch conditioning.',
  },
];

function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatEventTime(ev: CalendarEventItem): string {
  const startRaw = ev.start?.dateTime || ev.start?.date;
  if (!startRaw) return 'Time TBD';
  if (!ev.start?.dateTime) {
    return `${startRaw} (All day)`;
  }
  const d = new Date(startRaw);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const CalendarSchedulePanel: React.FC<CalendarSchedulePanelProps> = ({
  prefillLocation,
  onClearPrefill,
  onDiscussScheduleWithEevee,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [date, setDate] = useState(getTodayDateString);
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('19:30');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const fetchEvents = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride ?? getCalendarAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsLoadingEvents(true);
    setCalendarError(null);
    try {
      const items = await listCalendarEvents(token, 7);
      setEvents(items);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        setNeedsAuth(true);
        setCalendarError('Your Google Calendar session expired. Please sign in again.');
      } else {
        setCalendarError(
          err instanceof Error ? err.message : 'Unable to load Google Calendar events.'
        );
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initCalendarAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        void fetchEvents(token);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [fetchEvents]);

  // Pre-fill calendar event composer when user clicks "Add to Calendar" from Maps
  useEffect(() => {
    if (!prefillLocation) return;
    setEditingEventId(null);
    setSummary(`Patrol / Errand: ${prefillLocation.name}`);
    setLocation(`${prefillLocation.name}, ${prefillLocation.address}`);
    setDescription('Outing planned with The Anomalous Eevee.');
    setFormOpen(true);
    onClearPrefill?.();
  }, [prefillLocation, onClearPrefill]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setCalendarError(null);
    try {
      const res = await googleCalendarSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        await fetchEvents(res.accessToken);
      }
    } catch (err: unknown) {
      setCalendarError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await calendarLogout();
    setUser(null);
    setEvents([]);
    setNeedsAuth(true);
  };

  const openEditForm = (ev: CalendarEventItem) => {
    const startDt = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
    const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    setEditingEventId(ev.id);
    setSummary(ev.summary || '');
    if (startDt) {
      setDate(
        `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(
          startDt.getDate()
        ).padStart(2, '0')}`
      );
      setStartTime(
        `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`
      );
    }
    if (endDt) {
      setEndTime(
        `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`
      );
    }
    setLocation(ev.location || '');
    setDescription(ev.description || '');
    setFormOpen(true);
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    setPendingMutation({
      type: editingEventId ? 'update' : 'create',
      eventId: editingEventId ?? undefined,
      summary: summary.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      description: description.trim(),
    });
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation) return;
    const token = getCalendarAccessToken();
    if (!token) {
      setPendingMutation(null);
      setNeedsAuth(true);
      return;
    }

    setIsMutating(true);
    setCalendarError(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    try {
      if (pendingMutation.type === 'delete' && pendingMutation.eventId) {
        await deleteCalendarEvent(token, pendingMutation.eventId);
      } else {
        const startIso = new Date(`${pendingMutation.date}T${pendingMutation.startTime}:00`).toISOString();
        const endIso = new Date(`${pendingMutation.date}T${pendingMutation.endTime}:00`).toISOString();
        const payload = {
          summary: pendingMutation.summary,
          location: pendingMutation.location || undefined,
          description: pendingMutation.description || undefined,
          start: { dateTime: startIso, timeZone: tz },
          end: { dateTime: endIso, timeZone: tz },
        };

        if (pendingMutation.type === 'update' && pendingMutation.eventId) {
          await updateCalendarEvent(token, pendingMutation.eventId, payload);
        } else {
          await createCalendarEvent(token, payload);
        }
      }

      setPendingMutation(null);
      setFormOpen(false);
      setEditingEventId(null);
      setSummary('');
      setLocation('');
      setDescription('');
      await fetchEvents(token);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        setNeedsAuth(true);
        setCalendarError('Google Calendar session expired. Please sign in again.');
      } else {
        setCalendarError(
          err instanceof Error ? err.message : 'Unable to update Google Calendar.'
        );
      }
      setPendingMutation(null);
    } finally {
      setIsMutating(false);
    }
  };

  const buildScheduleSummaryForEevee = () => {
    if (events.length === 0) {
      return 'My Google Calendar is completely empty for the next 7 days.';
    }
    return events
      .slice(0, 8)
      .map(
        (ev) =>
          `• ${ev.summary || 'Untitled'} at ${formatEventTime(ev)}${
            ev.location ? ` (${ev.location})` : ''
          }`
      )
      .join('\n');
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
            Owner & Eevee Schedule
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Sync Google Calendar events so Eevee knows when dinner, guests, or patrols happen.
          </p>
        </div>

        {!needsAuth && user && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchEvents()}
              aria-label="Refresh calendar"
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {calendarError && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/20 px-3.5 py-2 text-xs text-red-700 dark:text-red-200">
          {calendarError}
        </p>
      )}

      {needsAuth ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Connect Google Calendar
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Sign in with Google to view your upcoming week, let Eevee judge your schedule, and confirm new patrol or feeding events.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoggingIn}
            onClick={() => void handleLogin()}
            className="gsi-material-button"
          >
            <div className="gsi-material-button-state" />
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn ? 'Signing in…' : 'Sign in with Google'}
              </span>
            </div>
          </button>
        </div>
      ) : (
        <>
          {/* Signed-in toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
            <span className="truncate text-[var(--text-secondary)]">
              Signed in as <strong className="text-[var(--text-primary)]">{user?.email || user?.displayName}</strong>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingEventId(null);
                  setFormOpen((v) => !v);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[var(--text-primary)] hover:border-red-500/40 cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                {formOpen ? 'Close Form' : 'New Event'}
              </button>
              <button
                type="button"
                onClick={() => onDiscussScheduleWithEevee(buildScheduleSummaryForEevee())}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Have Eevee Judge Schedule
              </button>
            </div>
          </div>

          {/* Create / Edit Form */}
          {formOpen && (
            <form
              onSubmit={handleRequestSubmit}
              className="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold text-[var(--text-primary)]">
                  {editingEventId ? 'Edit Calendar Event' : 'Schedule Calendar Event'}
                </span>
                {!editingEventId && (
                  <div className="flex flex-wrap gap-1">
                    {EEVEE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setSummary(tpl.summary);
                          setDescription(tpl.description);
                        }}
                        className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Event title (e.g. Dinner for The Anomalous Eevee)"
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
                />
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
                />
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional, or pick from Patrol Map)"
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
              />

              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes / tactical remarks…"
                className="w-full resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingEventId(null);
                  }}
                  className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer"
                >
                  {editingEventId ? 'Review Changes' : 'Review & Save'}
                </button>
              </div>
            </form>
          )}

          {/* Upcoming Events List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-primary)]">
                Next 7 Days
              </span>
              <span className="font-mono tabular-nums">{events.length} events</span>
            </div>

            {isLoadingEvents ? (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                Loading your Google Calendar…
              </p>
            ) : events.length === 0 ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5 text-center text-xs text-[var(--text-muted)]">
                <Calendar className="mx-auto mb-2 h-5 w-5 text-[var(--accent-text)]" />
                No upcoming events found in the next 7 days.
              </div>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                        {ev.summary || '(Untitled Event)'}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{formatEventTime(ev)}</span>
                      </div>
                      {ev.location && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                          <MapPin className="h-3 w-3 shrink-0 text-[var(--accent-text)]" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${ev.summary || 'event'}`}
                        onClick={() => openEditForm(ev)}
                        className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${ev.summary || 'event'}`}
                        onClick={() =>
                          setPendingMutation({
                            type: 'delete',
                            eventId: ev.id,
                            summary: ev.summary || '(Untitled Event)',
                            date: '',
                            startTime: '',
                            endTime: '',
                            location: ev.location || '',
                            description: '',
                          })
                        }
                        className="rounded p-1.5 text-[var(--text-muted)] hover:bg-red-950/30 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Mandatory Explicit User Confirmation Modal before Mutating Google Calendar */}
      {pendingMutation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5">
            <h3
              id="calendar-confirm-title"
              className="font-display text-base font-bold text-[var(--text-primary)]"
            >
              {pendingMutation.type === 'delete'
                ? 'Delete Google Calendar Event?'
                : pendingMutation.type === 'update'
                  ? 'Update Google Calendar Event?'
                  : 'Create Google Calendar Event?'}
            </h3>

            <div className="mt-3 space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs">
              <p className="font-semibold text-[var(--text-primary)]">
                {pendingMutation.summary}
              </p>
              {pendingMutation.type !== 'delete' && (
                <p className="text-[var(--text-secondary)]">
                  {pendingMutation.date} · {pendingMutation.startTime} – {pendingMutation.endTime}
                </p>
              )}
              {pendingMutation.location && (
                <p className="text-[var(--text-muted)]">
                  Location: {pendingMutation.location}
                </p>
              )}
              {pendingMutation.type === 'delete' && (
                <p className="text-red-500">
                  This will remove the event from your primary Google Calendar.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={() => setPendingMutation(null)}
                className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isMutating}
                onClick={() => void handleConfirmMutation()}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {isMutating
                  ? 'Applying…'
                  : pendingMutation.type === 'delete'
                    ? 'Confirm Delete'
                    : 'Confirm Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Swords,
  Tv,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import {
  ARSENAL_MOVES,
  type EeveelutionForm,
  type ExpressionState,
} from '../data/eeveeData';
import { TIME_PHASES, type TimePhase } from '../utils/timeOfDay';

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}

export interface YouTubeCommentaryBeat {
  id: string;
  timestampSeconds: number;
  timestampLabel: string;
  commentary: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed?: string | null;
  question?: string;
  isUserQuestion?: boolean;
}

interface YouTubeSessionData {
  videoId: string;
  canonicalUrl: string;
  videoTitle: string;
  authorName: string;
  videoSummary: string;
  overallVerdict: string;
  beats: YouTubeCommentaryBeat[];
}

interface YouTubeWatchPanelProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  activePhase: TimePhase;
  localTimeDisplay: string;
  onApplyCharacterState: (state: {
    form?: EeveelutionForm;
    plate?: string;
    tera?: string;
    expression?: ExpressionState;
  }) => void;
  onSwitchToFreeChat: (handoffPrompt?: string) => void;
  modeSwitcher?: React.ReactNode;
}

const SAMPLE_VIDEO_URL = 'https://www.youtube.com/watch?v=1roy4o4tqQM';
const SAMPLE_VIDEO_LABEL = 'Detective Pikachu Official Trailer #1';

let ytApiLoadPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube player requires a browser environment.'));
  }
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }
  if (ytApiLoadPromise) {
    return ytApiLoadPromise;
  }

  ytApiLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      resolve();
    };

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        ytApiLoadPromise = null;
        reject(new Error('Failed to load the YouTube IFrame Player API script.'));
      };
      document.head.appendChild(tag);
    }

    // Fallback check in case the API became ready right before attaching handler
    const poll = window.setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        window.clearInterval(poll);
        resolve();
      }
    }, 150);

    window.setTimeout(() => {
      window.clearInterval(poll);
      if (!window.YT || typeof window.YT.Player !== 'function') {
        ytApiLoadPromise = null;
        reject(new Error('Timed out loading the YouTube player.'));
      }
    }, 10_000);
  });

  return ytApiLoadPromise;
}

function parseYouTubeIdClient(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const parts = url.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['shorts', 'embed', 'live', 'v'].includes(parts[0]) &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function renderFormattedText(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

    const segments = trimmed.split(/(\*[^*]+\*)/g);
    return (
      <p key={lineIdx} className="leading-relaxed">
        {segments.map((seg, segIdx) => {
          if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2) {
            return (
              <em key={segIdx} className="text-[var(--text-muted)] italic">
                {seg.slice(1, -1)}
              </em>
            );
          }
          return (
            <span key={segIdx} className="text-[var(--text-primary)]">
              {seg}
            </span>
          );
        })}
      </p>
    );
  });
}

export const YouTubeWatchPanel: React.FC<YouTubeWatchPanelProps> = ({
  activeForm,
  activePlate,
  activeTera,
  activePhase,
  localTimeDisplay,
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const [urlInput, setUrlInput] = useState<string>(SAMPLE_VIDEO_URL);
  const [focusInput, setFocusInput] = useState<string>('');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<YouTubeSessionData | null>(null);
  const [isLoadingCommentary, setIsLoadingCommentary] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playerReady, setPlayerReady] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [revealUpcoming, setRevealUpcoming] = useState<boolean>(false);

  const [momentQuestion, setMomentQuestion] = useState<string>('');
  const [isInspectingMoment, setIsInspectingMoment] = useState<boolean>(false);

  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const lastSyncedBeatIdRef = useRef<string | null>(null);
  const { language, t } = useLanguage();

  const phaseInfo = TIME_PHASES[activePhase];

  // Mount or update official YouTube IFrame Player whenever activeVideoId changes
  useEffect(() => {
    if (!activeVideoId) return;
    let cancelled = false;

    const setupPlayer = async () => {
      setPlayerError(null);
      setPlayerReady(false);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);

      try {
        await ensureYouTubeIframeApi();
      } catch (err) {
        if (!cancelled) {
          setPlayerError(
            err instanceof Error ? err.message : 'Unable to initialize YouTube player.'
          );
        }
        return;
      }

      if (cancelled || !playerMountRef.current || !window.YT) return;

      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(activeVideoId);
          setPlayerReady(true);
          return;
        } catch {
          try {
            playerRef.current.destroy();
          } catch {
            // ignore
          }
          playerRef.current = null;
        }
      }

      playerMountRef.current.innerHTML = '';
      const hostEl = document.createElement('div');
      playerMountRef.current.appendChild(hostEl);

      playerRef.current = new window.YT.Player(hostEl, {
        videoId: activeVideoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setPlayerReady(true);
            const dur = event.target.getDuration();
            if (Number.isFinite(dur) && dur > 0) {
              setDuration(Math.floor(dur));
            }
          },
          onStateChange: (event) => {
            if (cancelled) return;
            const YTState = window.YT?.PlayerState;
            const playing = YTState ? event.data === YTState.PLAYING : event.data === 1;
            setIsPlaying(playing);
            const t = event.target.getCurrentTime();
            if (Number.isFinite(t)) {
              setCurrentTime(Math.floor(t));
            }
            const dur = event.target.getDuration();
            if (Number.isFinite(dur) && dur > 0) {
              setDuration(Math.floor(dur));
            }
          },
          onError: (event) => {
            if (cancelled) return;
            const code = event.data;
            const msg =
              code === 101 || code === 150
                ? 'The video owner disabled embedded playback for this video, though Eevee can still review its link.'
                : code === 100
                  ? 'This YouTube video was not found or is private.'
                  : 'YouTube player could not load this video.';
            setPlayerError(msg);
          },
        },
      });
    };

    void setupPlayer();

    return () => {
      cancelled = true;
    };
  }, [activeVideoId]);

  // Cleanup YT.Player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, []);

  // Poll playback timestamp smoothly while playing
  useEffect(() => {
    if (!playerReady) return;
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        const t = player.getCurrentTime();
        if (Number.isFinite(t)) {
          setCurrentTime(Math.floor(t));
        }
        const dur = player.getDuration();
        if (Number.isFinite(dur) && dur > 0) {
          setDuration(Math.floor(dur));
        }
      } catch {
        // player might be transitioning
      }
    }, isPlaying ? 300 : 800);

    return () => window.clearInterval(interval);
  }, [playerReady, isPlaying]);

  const sortedBeats = useMemo(() => {
    if (!sessionData) return [];
    return [...sessionData.beats].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  }, [sessionData]);

  // Active beat is the latest beat whose timestamp has been reached at currentTime
  const activeBeat: YouTubeCommentaryBeat | null = useMemo(() => {
    if (sortedBeats.length === 0) return null;
    let latest: YouTubeCommentaryBeat | null = null;
    for (const beat of sortedBeats) {
      if (beat.timestampSeconds <= currentTime) {
        latest = beat;
      }
    }
    return latest ?? sortedBeats[0];
  }, [sortedBeats, currentTime]);

  // Sync left CharacterStage whenever the active live beat changes
  useEffect(() => {
    if (!activeBeat) return;
    if (lastSyncedBeatIdRef.current === activeBeat.id) return;
    lastSyncedBeatIdRef.current = activeBeat.id;
    onApplyCharacterState({
      form: activeBeat.activeForm,
      plate: activeBeat.activePlate,
      tera: activeBeat.activeTera,
      expression: activeBeat.expression,
    });
  }, [activeBeat, onApplyCharacterState]);

  const seekAndPlay = useCallback((seconds: number) => {
    const target = Math.max(0, Math.floor(seconds));
    setCurrentTime(target);
    const player = playerRef.current;
    if (player) {
      try {
        player.seekTo(target, true);
        player.playVideo();
      } catch {
        // ignore if embed blocked
      }
    }
  }, []);

  const togglePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (isPlaying) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } catch {
      // ignore
    }
  };

  const handleLoadAndAnalyze = async (overrideUrl?: string, overrideFocus?: string) => {
    const rawUrl = (overrideUrl ?? urlInput).trim();
    const parsedId = parseYouTubeIdClient(rawUrl);
    if (!parsedId) {
      setErrorMessage(
        'Enter a valid YouTube link or 11-character video ID (e.g. youtube.com/watch?v=... or youtu.be/...).'
      );
      return;
    }

    if (overrideUrl) {
      setUrlInput(overrideUrl);
    }

    setErrorMessage(null);
    setActiveVideoId(parsedId);
    setIsLoadingCommentary(true);
    lastSyncedBeatIdRef.current = null;

    // If same video already loaded in player, pass known duration for tighter timestamps
    const knownDuration =
      activeVideoId === parsedId && duration > 0 ? duration : undefined;

    try {
      const res = await fetch('/api/youtube-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: `https://www.youtube.com/watch?v=${parsedId}`,
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          timeBehaviorCue: phaseInfo.aiBehaviorCue,
          durationSeconds: knownDuration,
          commentatorFocus: (overrideFocus ?? focusInput).trim(),
          languageCode: language.code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Failed to analyze YouTube video (status ${res.status}).`
        );
      }

      setSessionData(data as YouTubeSessionData);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not generate Eevee commentary for this YouTube video.'
      );
    } finally {
      setIsLoadingCommentary(false);
    }
  };

  const handleInspectMoment = async (customQuestion?: string) => {
    if (!activeVideoId || isInspectingMoment) return;
    const questionText = (customQuestion ?? momentQuestion).trim();
    setErrorMessage(null);
    setIsInspectingMoment(true);

    try {
      const liveSec = playerRef.current
        ? Math.floor(playerRef.current.getCurrentTime() || currentTime)
        : currentTime;

      const res = await fetch('/api/youtube-moment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: `https://www.youtube.com/watch?v=${activeVideoId}`,
          currentTimeSeconds: liveSec,
          question: questionText,
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          languageCode: language.code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Failed to inspect timestamp (status ${res.status}).`
        );
      }

      const newBeat = data as YouTubeCommentaryBeat;
      setSessionData((prev) => {
        if (!prev) {
          return {
            videoId: activeVideoId,
            canonicalUrl: `https://www.youtube.com/watch?v=${activeVideoId}`,
            videoTitle: `YouTube Video (${activeVideoId})`,
            authorName: 'YouTube',
            videoSummary: '',
            overallVerdict: '',
            beats: [newBeat],
          };
        }
        return {
          ...prev,
          beats: [...prev.beats, newBeat],
        };
      });

      onApplyCharacterState({
        form: newBeat.activeForm,
        plate: newBeat.activePlate,
        tera: newBeat.activeTera,
        expression: newBeat.expression,
      });

      if (!customQuestion) {
        setMomentQuestion('');
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to inspect this timestamp.'
      );
    } finally {
      setIsInspectingMoment(false);
    }
  };

  const unlockedCount = sortedBeats.filter((b) => b.timestampSeconds <= currentTime).length;
  const reachedVerdict =
    sortedBeats.length > 0 &&
    (revealUpcoming ||
      currentTime >= sortedBeats[sortedBeats.length - 1].timestampSeconds);

  const activeBeatMove = activeBeat?.moveUsed
    ? ARSENAL_MOVES.find((m) => m.name.toLowerCase() === activeBeat.moveUsed?.toLowerCase())
    : undefined;

  return (
    <section
      aria-label="Watch YouTube with The Anomalous Eevee"
      className="flex min-h-[640px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200"
    >
      {/* Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t.ytTitle}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {t.ytSubtitle} · {phaseInfo.label} ({localTimeDisplay}) · {language.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">{modeSwitcher}</div>
      </div>

      {/* URL Loader & Focus Controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleLoadAndAnalyze();
        }}
        className="space-y-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="youtube-url-input" className="sr-only">
              YouTube video URL or ID
            </label>
            <input
              id="youtube-url-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t.ytUrlPlaceholder}
              className="w-full min-h-[40px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoadingCommentary}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isLoadingCommentary ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.ytWatchingLoading}
              </>
            ) : (
              <>
                <Tv className="h-4 w-4" />
                {t.ytWatchReview}
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoadingCommentary}
              onClick={() => void handleLoadAndAnalyze(SAMPLE_VIDEO_URL)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              {t.ytTrySample}
            </button>
          </div>

          <div className="flex-1 sm:max-w-[300px]">
            <label htmlFor="commentary-focus-input" className="sr-only">
              Optional commentary angle
            </label>
            <input
              id="commentary-focus-input"
              type="text"
              dir={language.direction}
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              placeholder={t.ytFocusPlaceholder}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Main Watch Area */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {errorMessage && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-950/25 px-4 py-3 text-xs text-red-700 dark:text-red-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => void handleLoadAndAnalyze()}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-500 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!activeVideoId ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] px-6 py-14 text-center">
            <Tv className="h-8 w-8 text-[var(--accent-text)]" />
            <h2 className="mt-3 font-display text-lg font-bold text-[var(--text-primary)]">
              {t.ytEmptyHeading}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
              {t.ytEmptyBody}
            </p>
            <button
              type="button"
              onClick={() => void handleLoadAndAnalyze(SAMPLE_VIDEO_URL)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer"
            >
              <Play className="h-4 w-4" />
              Watch {SAMPLE_VIDEO_LABEL}
            </button>
          </div>
        ) : (
          <>
            {/* Video Player + Live Playback Controls */}
            <div className="space-y-2.5">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black">
                <div ref={playerMountRef} className="h-full w-full" />
              </div>

              {playerError && (
                <p className="text-xs text-amber-500">{playerError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!playerReady}
                    onClick={togglePlayPause}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        {t.ytPause}
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        {t.ytPlay}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!playerReady}
                    onClick={() => seekAndPlay(0)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    0:00
                  </button>

                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[var(--text-primary)]">
                    <Clock className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    {formatClock(currentTime)}
                    {duration > 0 && (
                      <span className="text-[var(--text-muted)]">
                        / {formatClock(duration)}
                      </span>
                    )}
                  </span>
                </div>

                {sessionData && (
                  <div className="truncate text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {sessionData.videoTitle}
                    </span>{' '}
                    · {sessionData.authorName}
                  </div>
                )}
              </div>
            </div>

            {/* Loading Commentary State */}
            {isLoadingCommentary && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4 text-xs text-[var(--text-secondary)]">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-text)]" />
                <span>
                  The Anomalous Eevee is watching the full video and mapping his live
                  commentary timestamps…
                </span>
              </div>
            )}

            {/* Live Active Beat Spotlight */}
            {activeBeat && (
              <motion.div
                key={activeBeat.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-xl border border-red-500/40 bg-[var(--bg-elevated)] px-5 py-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
                    <span className="font-mono font-semibold tabular-nums text-[var(--accent-text)]">
                      LIVE @ {activeBeat.timestampLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {activeBeat.activeForm}
                    </span>
                    {activeBeat.activePlate !== 'None (Base)' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{activeBeat.activePlate}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>Tera {activeBeat.activeTera}</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Demeanor: {activeBeat.expression}
                  </span>
                </div>

                {activeBeat.question && (
                  <p className="mb-2 text-xs font-medium text-[var(--user-bubble-label)]">
                    You asked at {activeBeat.timestampLabel}: “{activeBeat.question}”
                  </p>
                )}

                <div dir={language.direction} className="space-y-1 text-[15px]">
                  {renderFormattedText(activeBeat.commentary)}
                </div>

                {activeBeat.moveUsed && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                    <Swords className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      Move Executed: {activeBeat.moveUsed}
                    </span>
                    {activeBeatMove && (
                      <>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {activeBeatMove.type}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Ask Eevee About the Exact Current Timestamp */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleInspectMoment();
              }}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <label htmlFor="yt-moment-question" className="sr-only">
                  Ask Eevee about this exact video timestamp
                </label>
                <input
                  id="yt-moment-question"
                  type="text"
                  value={momentQuestion}
                  onChange={(e) => setMomentQuestion(e.target.value)}
                  placeholder={`Ask Eevee about ${formatClock(currentTime)} (or leave blank for a live reaction)…`}
                  className="w-full min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isInspectingMoment}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                {isInspectingMoment ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-text)]" />
                    Inspecting {formatClock(currentTime)}…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    React at {formatClock(currentTime)}
                  </>
                )}
              </button>
            </form>

            {/* Chronological Commentary Timeline Over Time */}
            {sortedBeats.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[var(--text-primary)]">
                      {t.ytTimelineTitle}
                    </span>
                    <span aria-hidden="true" className="text-[var(--text-muted)]">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-[var(--text-muted)]">
                      {unlockedCount} / {sortedBeats.length} triggered
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setRevealUpcoming((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {revealUpcoming ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        {t.ytSyncOverTime}
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        {t.ytRevealAll}
                      </>
                    )}
                  </button>
                </div>

                {sessionData?.videoSummary && (
                  <p
                    dir={language.direction}
                    className="text-xs leading-relaxed text-[var(--text-secondary)]"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">
                      Eevee’s Read:
                    </span>{' '}
                    {sessionData.videoSummary}
                  </p>
                )}

                <div className="space-y-2.5">
                  {sortedBeats.map((beat) => {
                    const isUnlocked = revealUpcoming || beat.timestampSeconds <= currentTime;
                    const isCurrent = activeBeat?.id === beat.id;

                    return (
                      <div
                        key={beat.id}
                        className={`rounded-xl border px-4 py-3 transition-colors ${
                          isCurrent
                            ? 'border-red-500/45 bg-[var(--bg-elevated)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                        } ${!isUnlocked ? 'opacity-65' : ''}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => seekAndPlay(beat.timestampSeconds)}
                              className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[var(--accent-text)] hover:border-red-500/50 cursor-pointer"
                              title={`Jump video to ${beat.timestampLabel}`}
                            >
                              {beat.timestampLabel}
                            </button>
                            <span className="font-semibold text-[var(--text-primary)]">
                              {beat.activeForm}
                            </span>
                            {beat.activePlate !== 'None (Base)' && (
                              <>
                                <span aria-hidden="true" className="text-[var(--text-muted)]">
                                  ·
                                </span>
                                <span className="text-[var(--text-muted)]">
                                  {beat.activePlate}
                                </span>
                              </>
                            )}
                            {beat.isUserQuestion && (
                              <>
                                <span aria-hidden="true" className="text-[var(--text-muted)]">
                                  ·
                                </span>
                                <span className="text-[var(--user-bubble-label)]">
                                  Your Moment Check
                                </span>
                              </>
                            )}
                          </div>

                          <span className="text-[11px] text-[var(--text-muted)]">
                            {isCurrent
                              ? 'Active Now'
                              : isUnlocked
                                ? beat.expression
                                : `Queued for ${beat.timestampLabel}`}
                          </span>
                        </div>

                        {isUnlocked ? (
                          <div dir={language.direction} className="mt-2 space-y-1 text-sm">
                            {beat.question && (
                              <p className="text-xs text-[var(--user-bubble-label)]">
                                Asked: “{beat.question}”
                              </p>
                            )}
                            {renderFormattedText(beat.commentary)}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                            Keep watching until {beat.timestampLabel}, or click the timestamp to
                            jump directly to Eevee’s reaction.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overall Verdict + Free Chat Handoff */}
                {sessionData?.overallVerdict && reachedVerdict && (
                  <div className="space-y-3 rounded-xl border border-red-500/35 bg-[var(--bg-elevated)] p-5">
                    <div>
                      <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                        Eevee’s Final Verdict — {sessionData.videoTitle}
                      </h3>
                      <p
                        dir={language.direction}
                        className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]"
                      >
                        {sessionData.overallVerdict}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onSwitchToFreeChat(
                          `We just watched "${sessionData.videoTitle}" (${sessionData.canonicalUrl}) together. Your overall verdict was: "${sessionData.overallVerdict}". Let's keep talking about what happened in that video.`
                        )
                      }
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t.ytDiscussInChat}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

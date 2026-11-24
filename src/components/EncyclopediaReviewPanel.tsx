import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Swords,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import {
  PRELOADED_ENCYCLOPEDIAS,
  validateEncyclopediaArticleUrl,
  type PreloadedEncyclopedia,
} from '../data/encyclopedias';
import {
  ARSENAL_MOVES,
  type EeveelutionForm,
  type ExpressionState,
} from '../data/eeveeData';
import type { TimePhase } from '../utils/timeOfDay';
import { TIME_PHASES } from '../utils/timeOfDay';

const ENCYCLOPEDIA_STORAGE_KEY = 'anomalous-eevee-encyclopedia-v1';

export interface WikiReviewStage {
  stageId: string;
  stageTitle: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
  text: string;
  isComplete: boolean;
}

export interface WikiQAItem {
  id: string;
  question: string;
  reply: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
}

export interface SavedWikiReview {
  id: string;
  articleUrl: string;
  articleTitle: string;
  wikiName: string;
  articleExcerpt: string;
  reviewFocus: string;
  updatedAt: number;
  stages: WikiReviewStage[];
  retrievedUrls: Array<{ url: string; status: string }>;
  qaHistory: WikiQAItem[];
}

interface SearchHit {
  title: string;
  description: string;
  url: string;
}

interface EncyclopediaReviewPanelProps {
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

const CANONICAL_STAGES = [
  { id: 'intake', fallbackLabel: 'Article Scope' },
  { id: 'claims', fallbackLabel: 'Lore & Facts' },
  { id: 'gaps', fallbackLabel: 'Tactical Audit' },
  { id: 'verdict', fallbackLabel: 'Final Verdict' },
] as const;

const FOCUS_PRESETS = [
  'Analyze feats vs Eevee',
  'Audit lore & citations',
  'Summarize key facts bluntly',
];

function loadSavedReviews(): SavedWikiReview[] {
  try {
    const raw = window.localStorage.getItem(ENCYCLOPEDIA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedWikiReview[]) : [];
  } catch {
    return [];
  }
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

export const EncyclopediaReviewPanel: React.FC<EncyclopediaReviewPanelProps> = ({
  activeForm,
  activePlate,
  activeTera,
  activePhase,
  localTimeDisplay,
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const { language, t } = useLanguage();
  const phaseInfo = TIME_PHASES[activePhase];

  const [selectedWikiId, setSelectedWikiId] = useState<string>('bulbapedia');
  const [urlInput, setUrlInput] = useState<string>(
    PRELOADED_ENCYCLOPEDIAS.find((w) => w.id === 'bulbapedia')?.featuredArticleUrl ||
      'https://en.wikipedia.org/wiki/Red_fox'
  );
  const [reviewFocus, setReviewFocus] = useState<string>('');
  const [pastedExcerpt, setPastedExcerpt] = useState<string>('');
  const [showExcerptDrawer, setShowExcerptDrawer] = useState<boolean>(false);

  const [wikiSearchQuery, setWikiSearchQuery] = useState<string>('');
  const [isSearchingWiki, setIsSearchingWiki] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [directCandidateUrl, setDirectCandidateUrl] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const [savedReviews, setSavedReviews] = useState<SavedWikiReview[]>(loadSavedReviews);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(
    () => loadSavedReviews()[0]?.id ?? null
  );

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [qaQuestion, setQaQuestion] = useState<string>('');
  const [isAskingQa, setIsAskingQa] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const stageBottomRef = useRef<HTMLDivElement | null>(null);

  const selectedWiki = useMemo(
    () =>
      PRELOADED_ENCYCLOPEDIAS.find((w) => w.id === selectedWikiId) ??
      PRELOADED_ENCYCLOPEDIAS[0],
    [selectedWikiId]
  );

  const activeReview = useMemo(
    () => savedReviews.find((r) => r.id === activeReviewId) ?? null,
    [savedReviews, activeReviewId]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ENCYCLOPEDIA_STORAGE_KEY,
        JSON.stringify(savedReviews.slice(0, 12))
      );
    } catch {
      // ignore quota errors
    }
  }, [savedReviews]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isStreaming) {
      stageBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isStreaming, activeReview?.stages]);

  const updateReviewById = useCallback(
    (reviewId: string, updater: (prev: SavedWikiReview) => SavedWikiReview) => {
      setSavedReviews((prev) =>
        prev.map((item) =>
          item.id === reviewId ? updater({ ...item, updatedAt: Date.now() }) : item
        )
      );
    },
    []
  );

  const handleSelectPreloadedWiki = (wiki: PreloadedEncyclopedia) => {
    setSelectedWikiId(wiki.id);
    setUrlInput(wiki.featuredArticleUrl);
    setSearchResults([]);
    setDirectCandidateUrl(null);
    setSearchNote(null);
    setErrorMessage(null);
  };

  const handleSearchWiki = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = wikiSearchQuery.trim();
    if (!q || isSearchingWiki) return;

    setIsSearchingWiki(true);
    setSearchNote(null);
    setSearchResults([]);
    setDirectCandidateUrl(null);

    try {
      const resp = await fetch(
        `/api/encyclopedia-search?wikiId=${encodeURIComponent(selectedWiki.id)}&q=${encodeURIComponent(
          q
        )}`
      );
      const data = (await resp.json()) as {
        results?: SearchHit[];
        directCandidateUrl?: string;
        note?: string;
        error?: string;
      };
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to search encyclopedia.');
      }
      setSearchResults(data.results || []);
      setDirectCandidateUrl(data.directCandidateUrl || null);
      if (data.note) {
        setSearchNote(data.note);
      } else if (!data.results || data.results.length === 0) {
        setSearchNote(`No exact search hits on ${selectedWiki.name}. Try the direct URL below.`);
      }
    } catch (err: unknown) {
      setSearchNote(
        err instanceof Error ? err.message : `Could not search ${selectedWiki.name}.`
      );
    } finally {
      setIsSearchingWiki(false);
    }
  };

  const handleStopStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setStreamStatus(null);
    if (activeReviewId) {
      updateReviewById(activeReviewId, (rev) => ({
        ...rev,
        stages: rev.stages.map((s) => ({ ...s, isComplete: true })),
      }));
    }
  };

  const handleAnalyzeUrl = async (overrideUrl?: string) => {
    if (isStreaming) return;

    const targetUrl = (overrideUrl ?? urlInput).trim();
    const validation = validateEncyclopediaArticleUrl(targetUrl);
    if (!validation.valid || !validation.normalizedUrl) {
      setErrorMessage(validation.error || 'Please enter a valid non-Google article URL.');
      return;
    }

    if (overrideUrl) {
      setUrlInput(validation.normalizedUrl);
    }

    setErrorMessage(null);
    setStreamStatus('Connecting to encyclopedia article…');
    setIsStreaming(true);

    const newReviewId = `wiki-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const initialEntry: SavedWikiReview = {
      id: newReviewId,
      articleUrl: validation.normalizedUrl,
      articleTitle: validation.hostname || 'Article Review',
      wikiName: validation.hostname || 'Online Encyclopedia',
      articleExcerpt: pastedExcerpt.trim(),
      reviewFocus: reviewFocus.trim(),
      updatedAt: Date.now(),
      stages: [],
      retrievedUrls: [],
      qaHistory: [],
    };

    setSavedReviews((prev) => [initialEntry, ...prev]);
    setActiveReviewId(newReviewId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/encyclopedia-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleUrl: validation.normalizedUrl,
          reviewFocus: reviewFocus.trim(),
          pastedExcerpt: pastedExcerpt.trim(),
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          languageCode: language.code,
        }),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/event-stream')) {
        const errJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          errJson?.error || `Encyclopedia analysis failed with status ${response.status}.`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming body is unavailable in this browser.');
      }

      const decoder = new TextDecoder();
      let sseBuffer = '';

      const processBlock = (rawBlock: string) => {
        const lines = rawBlock.split(/\r?\n/);
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) return;
        const payloadRaw = dataLines.join('\n');
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(payloadRaw) as Record<string, unknown>;
        } catch {
          return;
        }

        if (eventName === 'status') {
          if (typeof payload.message === 'string') {
            setStreamStatus(payload.message);
          }
          return;
        }

        if (eventName === 'stage') {
          const stageId = typeof payload.stageId === 'string' ? payload.stageId : `stage-${Date.now()}`;
          const stageTitle =
            typeof payload.stageTitle === 'string' ? payload.stageTitle : 'Article Analysis';
          const nextForm = (payload.activeForm as EeveelutionForm) || activeForm;
          const nextPlate = (payload.activePlate as string) || activePlate;
          const nextTera = (payload.activeTera as string) || activeTera;
          const nextExpression = (payload.expression as ExpressionState) || 'Judging You';
          const nextMove = typeof payload.moveUsed === 'string' ? payload.moveUsed : null;

          setStreamStatus(`Analyzing · ${stageTitle}`);
          onApplyCharacterState({
            form: nextForm,
            plate: nextPlate,
            tera: nextTera,
            expression: nextExpression,
          });

          updateReviewById(newReviewId, (rev) => {
            const finalizedPrev = rev.stages.map((s) => ({ ...s, isComplete: true }));
            const existsIdx = finalizedPrev.findIndex((s) => s.stageId === stageId);
            if (existsIdx >= 0) {
              const nextStages = [...finalizedPrev];
              nextStages[existsIdx] = {
                ...nextStages[existsIdx],
                stageTitle,
                activeForm: nextForm,
                activePlate: nextPlate,
                activeTera: nextTera,
                expression: nextExpression,
                moveUsed: nextMove,
                isComplete: false,
              };
              return { ...rev, stages: nextStages };
            }
            return {
              ...rev,
              stages: [
                ...finalizedPrev,
                {
                  stageId,
                  stageTitle,
                  activeForm: nextForm,
                  activePlate: nextPlate,
                  activeTera: nextTera,
                  expression: nextExpression,
                  moveUsed: nextMove,
                  text: '',
                  isComplete: false,
                },
              ],
            };
          });
          return;
        }

        if (eventName === 'delta') {
          const deltaStageId = typeof payload.stageId === 'string' ? payload.stageId : '';
          const deltaText = typeof payload.text === 'string' ? payload.text : '';
          if (!deltaText) return;

          updateReviewById(newReviewId, (rev) => {
            if (rev.stages.length === 0) {
              return {
                ...rev,
                stages: [
                  {
                    stageId: deltaStageId || 'intake',
                    stageTitle: 'Article Analysis',
                    activeForm,
                    activePlate,
                    activeTera,
                    expression: 'Judging You',
                    moveUsed: null,
                    text: deltaText,
                    isComplete: false,
                  },
                ],
              };
            }
            const nextStages = [...rev.stages];
            const targetIdx = deltaStageId
              ? nextStages.findIndex((s) => s.stageId === deltaStageId)
              : nextStages.length - 1;
            const resolvedIdx = targetIdx >= 0 ? targetIdx : nextStages.length - 1;
            nextStages[resolvedIdx] = {
              ...nextStages[resolvedIdx],
              text: nextStages[resolvedIdx].text + deltaText,
            };
            return { ...rev, stages: nextStages };
          });
          return;
        }

        if (eventName === 'done') {
          const urls = Array.isArray(payload.retrievedUrls)
            ? (payload.retrievedUrls as Array<{ url: string; status: string }>)
            : [];
          const articleTitle =
            typeof payload.articleTitle === 'string' ? payload.articleTitle : '';
          const wikiName = typeof payload.wikiName === 'string' ? payload.wikiName : '';
          const finalUrl = typeof payload.finalUrl === 'string' ? payload.finalUrl : '';
          const articleExcerpt =
            typeof payload.articleExcerpt === 'string' ? payload.articleExcerpt : '';

          updateReviewById(newReviewId, (rev) => ({
            ...rev,
            articleTitle: articleTitle || rev.articleTitle,
            wikiName: wikiName || rev.wikiName,
            articleUrl: finalUrl || rev.articleUrl,
            articleExcerpt: articleExcerpt || rev.articleExcerpt,
            retrievedUrls: urls,
            stages: rev.stages.map((s) => ({ ...s, isComplete: true })),
          }));
          setStreamStatus(null);
          return;
        }

        if (eventName === 'error') {
          const msg =
            typeof payload.error === 'string'
              ? payload.error
              : 'Encyclopedia analysis stream interrupted.';
          setErrorMessage(msg);
          setStreamStatus(null);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        while (true) {
          const sepMatch = sseBuffer.match(/\r?\n\r?\n/);
          if (!sepMatch || sepMatch.index === undefined) break;
          const block = sseBuffer.slice(0, sepMatch.index);
          sseBuffer = sseBuffer.slice(sepMatch.index + sepMatch[0].length);
          if (block.trim()) {
            processBlock(block);
          }
        }
      }

      if (sseBuffer.trim()) {
        processBlock(sseBuffer);
      }

      updateReviewById(newReviewId, (rev) => ({
        ...rev,
        stages: rev.stages.map((s) => ({ ...s, isComplete: true })),
      }));
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not complete encyclopedia review.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamStatus(null);
    }
  };

  const handleAskFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReview || isAskingQa || isStreaming) return;
    const trimmed = qaQuestion.trim();
    if (!trimmed) return;

    setIsAskingQa(true);
    setErrorMessage(null);

    try {
      const reviewTranscript = activeReview.stages
        .map((s) => `[${s.stageTitle}]\n${s.text}`)
        .join('\n\n');

      const response = await fetch('/api/encyclopedia-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleUrl: activeReview.articleUrl,
          articleTitle: activeReview.articleTitle,
          wikiName: activeReview.wikiName,
          articleExcerpt: activeReview.articleExcerpt,
          reviewTranscript,
          question: trimmed,
          activeForm,
          activePlate,
          activeTera,
          languageCode: language.code,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Follow-up question failed with status ${response.status}`
        );
      }

      const nextForm = (data.activeForm as EeveelutionForm) || activeForm;
      const nextPlate = (data.activePlate as string) || activePlate;
      const nextTera = (data.activeTera as string) || activeTera;
      const nextExpression = (data.expression as ExpressionState) || 'Judging You';

      onApplyCharacterState({
        form: nextForm,
        plate: nextPlate,
        tera: nextTera,
        expression: nextExpression,
      });

      const qaEntry: WikiQAItem = {
        id: `qa-${Date.now()}`,
        question: trimmed,
        reply: data.reply,
        activeForm: nextForm,
        activePlate: nextPlate,
        activeTera: nextTera,
        expression: nextExpression,
        moveUsed: data.moveUsed ?? null,
      };

      updateReviewById(activeReview.id, (rev) => ({
        ...rev,
        qaHistory: [...rev.qaHistory, qaEntry],
      }));
      setQaQuestion('');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to ask Eevee about this article.'
      );
    } finally {
      setIsAskingQa(false);
    }
  };

  const handleDeleteReview = (id: string) => {
    if (isStreaming) return;
    setSavedReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeReviewId === id) {
        setActiveReviewId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleHandoffToFreeChat = () => {
    if (!activeReview) return;
    const verdictStage =
      activeReview.stages.find((s) => s.stageId === 'verdict') ??
      activeReview.stages[activeReview.stages.length - 1];
    const summaryLine = verdictStage
      ? `Your verdict on "${activeReview.articleTitle}" (${activeReview.wikiName}) was: "${verdictStage.text
          .replace(/\s+/g, ' ')
          .slice(0, 320)}"`
      : `We just analyzed "${activeReview.articleTitle}" from ${activeReview.wikiName}.`;
    onSwitchToFreeChat(
      `Let's keep discussing the encyclopedia article "${activeReview.articleTitle}" (${activeReview.articleUrl}). ${summaryLine}`
    );
  };

  const completedStageIds = new Set(
    (activeReview?.stages ?? []).filter((s) => s.isComplete).map((s) => s.stageId)
  );
  const activeStreamingStageId =
    (activeReview?.stages ?? []).find((s) => !s.isComplete)?.stageId ?? null;

  return (
    <section
      aria-label="Online Encyclopedia Article Analyzer"
      className="flex min-h-[76vh] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BookMarked className="h-4 w-4 text-[var(--accent-text)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {t.wikiTitle}
          </span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">
            ·
          </span>
          <span className="text-xs text-[var(--text-muted)]">{t.wikiSubtitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">{modeSwitcher}</div>
      </div>

      {/* Article URL Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAnalyzeUrl();
        }}
        className="space-y-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4 sm:px-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="wiki-article-url" className="sr-only">
              Online encyclopedia article URL
            </label>
            <input
              id="wiki-article-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t.wikiUrlPlaceholder}
              className="w-full min-h-[40px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopStream}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-red-500/60 bg-red-600/15 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-600/25 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop Stream
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="h-4 w-4" />
              {t.wikiAnalyzeBtn}
            </button>
          )}
        </div>

        {/* Review Angle & Optional Fallback Excerpt Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {FOCUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReviewFocus((prev) => (prev === preset ? '' : preset))}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  reviewFocus === preset
                    ? 'border-red-500/60 bg-red-600/15 text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowExcerptDrawer((v) => !v)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              {showExcerptDrawer ? 'Hide Excerpt Fallback' : '+ Optional Excerpt Fallback'}
            </button>
          </div>

          <div className="min-w-[200px] flex-1 sm:max-w-[260px]">
            <label htmlFor="wiki-focus-input" className="sr-only">
              Optional analysis angle
            </label>
            <input
              id="wiki-focus-input"
              type="text"
              dir={language.direction}
              value={reviewFocus}
              onChange={(e) => setReviewFocus(e.target.value)}
              placeholder="Custom focus (e.g. boss weaknesses)…"
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>

        {showExcerptDrawer && (
          <div>
            <label
              htmlFor="wiki-excerpt-textarea"
              className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]"
            >
              Optional Article Text Fallback (useful if a wiki uses strict anti-bot protection)
            </label>
            <textarea
              id="wiki-excerpt-textarea"
              rows={3}
              dir={language.direction}
              value={pastedExcerpt}
              onChange={(e) => setPastedExcerpt(e.target.value)}
              placeholder="Paste copied sections from the encyclopedia page if needed…"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
          </div>
        )}
      </form>

      {/* Main Scroll Area */}
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
              onClick={() => setErrorMessage(null)}
              className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-red-500/20 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 15 Preloaded Non-Google Online Encyclopedias */}
        <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
                Preloaded Online Encyclopedias ({PRELOADED_ENCYCLOPEDIAS.length})
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Select any preloaded wiki to search or load its featured article, or paste any non-Google encyclopedia URL above.
              </p>
            </div>
            <button
              type="button"
              disabled={isStreaming}
              onClick={() => void handleAnalyzeUrl(selectedWiki.featuredArticleUrl)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/50 disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              Analyze {selectedWiki.featuredArticleTitle}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {PRELOADED_ENCYCLOPEDIAS.map((wiki) => {
              const isSelected = wiki.id === selectedWiki.id;
              return (
                <button
                  key={wiki.id}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSelectPreloadedWiki(wiki)}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer disabled:opacity-50 ${
                    isSelected
                      ? 'border-red-500/60 bg-red-600/10 text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-red-500/40 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="w-full truncate text-xs font-semibold">
                    {wiki.name}
                  </span>
                  <span className="w-full truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {wiki.domain}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live Wiki Search Bar for Selected Preloaded Encyclopedia */}
          <form
            onSubmit={(e) => void handleSearchWiki(e)}
            className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-3 sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <label htmlFor="wiki-search-input" className="sr-only">
                Search articles on {selectedWiki.name}
              </label>
              <input
                id="wiki-search-input"
                type="text"
                value={wikiSearchQuery}
                onChange={(e) => setWikiSearchQuery(e.target.value)}
                placeholder={`Search ${selectedWiki.name} (${selectedWiki.domain}) for an article…`}
                className="w-full min-h-[36px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingWiki || !wikiSearchQuery.trim()}
              className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              {isSearchingWiki ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-text)]" />
                  Searching…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  Search {selectedWiki.name}
                </>
              )}
            </button>
          </form>

          {searchNote && (
            <p className="text-xs text-[var(--text-muted)]">{searchNote}</p>
          )}

          {(searchResults.length > 0 || directCandidateUrl) && (
            <div className="space-y-1.5">
              {searchResults.map((hit) => (
                <div
                  key={hit.url}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--text-primary)]">
                      {hit.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {hit.url}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isStreaming}
                    onClick={() => void handleAnalyzeUrl(hit.url)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    Analyze
                  </button>
                </div>
              ))}

              {directCandidateUrl && searchResults.length === 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--text-primary)]">
                      Direct Article Candidate
                    </p>
                    <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                      {directCandidateUrl}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isStreaming}
                    onClick={() => void handleAnalyzeUrl(directCandidateUrl)}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    Analyze Direct URL
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Saved Article History Strip */}
        {savedReviews.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {savedReviews.map((rev) => {
              const isSelected = rev.id === activeReview?.id;
              return (
                <div
                  key={rev.id}
                  className={`inline-flex items-center rounded-lg border text-xs transition-colors ${
                    isSelected
                      ? 'border-red-500/50 bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    disabled={isStreaming}
                    onClick={() => {
                      setActiveReviewId(rev.id);
                      setUrlInput(rev.articleUrl);
                    }}
                    className="max-w-[200px] truncate px-3 py-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {rev.articleTitle}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${rev.articleTitle}`}
                    disabled={isStreaming}
                    onClick={() => handleDeleteReview(rev.id)}
                    className="pr-2 text-[var(--text-muted)] hover:text-red-500 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Live Analysis Area */}
        {activeReview && (
          <>
            {/* 4-Stage Stepper */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--accent-text)]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  )}
                  <span className="truncate font-semibold text-[var(--text-primary)]">
                    {streamStatus ||
                      `${activeReview.articleTitle} · ${activeReview.wikiName}`}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={activeReview.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap"
                  >
                    Open Source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {!isStreaming && (
                    <button
                      type="button"
                      onClick={() => void handleAnalyzeUrl(activeReview.articleUrl)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Re-analyze
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CANONICAL_STAGES.map((step, idx) => {
                  const matchedStage = activeReview.stages.find((s) => s.stageId === step.id);
                  const isDone = completedStageIds.has(step.id);
                  const isLive = activeStreamingStageId === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                        isLive
                          ? 'border-red-500/60 bg-red-600/10 text-[var(--text-primary)]'
                          : isDone
                            ? 'border-emerald-500/35 bg-[var(--bg-surface)] text-[var(--text-primary)]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 font-mono text-[11px] tabular-nums font-medium">
                        <span>0{idx + 1}</span>
                        {isLive && <span className="text-[var(--accent-text)]">Live</span>}
                        {isDone && !isLive && <span className="text-emerald-500">Done</span>}
                      </div>
                      <p className="mt-0.5 truncate font-semibold">
                        {matchedStage?.stageTitle || step.fallbackLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Streamed Stage Cards */}
            {activeReview.stages.length > 0 && (
              <div className="space-y-3">
                {activeReview.stages.map((stage) => {
                  const moveInfo = stage.moveUsed
                    ? ARSENAL_MOVES.find(
                        (m) => m.name.toLowerCase() === stage.moveUsed?.toLowerCase()
                      )
                    : null;
                  const isStageLive = isStreaming && !stage.isComplete;

                  return (
                    <motion.div
                      key={stage.stageId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16 }}
                      className={`rounded-xl border px-5 py-4 ${
                        isStageLive
                          ? 'border-red-500/45 bg-[var(--bg-elevated)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
                          <span className="font-display font-bold text-[var(--text-primary)]">
                            {stage.stageTitle}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[var(--accent-text)]">
                            {stage.activeForm}
                          </span>
                          {stage.activePlate !== 'None (Base)' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{stage.activePlate}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>Tera {stage.activeTera}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {isStageLive ? 'Analyzing live…' : `Demeanor: ${stage.expression}`}
                        </span>
                      </div>

                      <div dir={language.direction} className="space-y-1 text-[15px]">
                        {stage.text ? (
                          renderFormattedText(stage.text)
                        ) : (
                          <p className="text-xs italic text-[var(--text-muted)]">
                            Inspecting article contents…
                          </p>
                        )}
                        {isStageLive && (
                          <span
                            aria-hidden="true"
                            className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-red-500 align-middle"
                          />
                        )}
                      </div>

                      {stage.moveUsed && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                          <Swords className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                          <span className="font-semibold text-[var(--text-primary)]">
                            Move Executed: {stage.moveUsed}
                          </span>
                          {moveInfo && (
                            <>
                              <span aria-hidden="true" className="text-[var(--text-muted)]">
                                ·
                              </span>
                              <span className="text-[var(--text-secondary)]">
                                {moveInfo.type}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* URL Context Verification Summary */}
            {activeReview.retrievedUrls.length > 0 && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs">
                <p className="mb-1.5 font-semibold text-[var(--text-primary)]">
                  Verified URL Context
                </p>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  {activeReview.retrievedUrls.map((item) => (
                    <li key={item.url} className="flex items-center justify-between gap-2 truncate">
                      <span className="truncate">{item.url}</span>
                      <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                        {item.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-up Interrogation Q&A */}
            {activeReview.stages.length > 0 && !isStreaming && (
              <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
                {activeReview.qaHistory.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4"
                  >
                    <p className="text-xs font-semibold text-[var(--user-bubble-label)]">
                      You asked: “{item.question}”
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--accent-text)]">
                        {item.activeForm}
                      </span>
                      {item.activePlate !== 'None (Base)' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.activePlate}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Tera {item.activeTera}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.expression}</span>
                    </div>
                    <div dir={language.direction} className="space-y-1 text-[14px]">
                      {renderFormattedText(item.reply)}
                    </div>
                  </div>
                ))}

                <form
                  onSubmit={(e) => void handleAskFollowUp(e)}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <label htmlFor="wiki-qa-input" className="sr-only">
                      Ask Eevee a follow-up question about this article
                    </label>
                    <input
                      id="wiki-qa-input"
                      type="text"
                      dir={language.direction}
                      value={qaQuestion}
                      onChange={(e) => setQaQuestion(e.target.value)}
                      placeholder={t.wikiAskPlaceholder}
                      className="w-full min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAskingQa || !qaQuestion.trim()}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isAskingQa ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-text)]" />
                        Inspecting…
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                        Ask Eevee
                      </>
                    )}
                  </button>
                </form>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleHandoffToFreeChat}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    {t.wikiDiscussInChat}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={stageBottomRef} />
      </div>
    </section>
  );
};

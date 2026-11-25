import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getDailyHedgehogFact,
  getLocalDateKey,
  getPreviousDailyHedgehogFacts,
  HEDGEHOG_FACTS,
} from '../data/hedgehogFacts';
import type { EeveelutionForm, ExpressionState } from '../data/eeveeData';
import type { TimePhase } from '../utils/timeOfDay';
import { TIME_PHASES } from '../utils/timeOfDay';

interface DailyFactPanelProps {
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

interface DailyCommentaryPayload {
  commentary: string;
  takeaway: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
}

interface FactQAItem {
  id: string;
  question: string;
  reply: string;
  takeaway: string;
}

const DAILY_FACT_CACHE_PREFIX = 'anomalous-eevee-daily-hedgehog-v1:';

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

function getCountdownToMidnight(): string {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const hrs = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  const secs = Math.floor((diffMs % 60_000) / 1_000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const DailyFactPanel: React.FC<DailyFactPanelProps> = ({
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

  const [dateKey, setDateKey] = useState<string>(() => getLocalDateKey());
  const [countdown, setCountdown] = useState<string>(() => getCountdownToMidnight());
  const [eeveeCommentary, setEeveeCommentary] = useState<DailyCommentaryPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [qaInput, setQaInput] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [qaHistory, setQaHistory] = useState<FactQAItem[]>([]);
  const [showArchive, setShowArchive] = useState<boolean>(false);

  // Strictly one deterministic hedgehog fact per calendar day, alternating every day
  const dailyRecord = useMemo(() => getDailyHedgehogFact(dateKey), [dateKey]);
  const previousFacts = useMemo(() => getPreviousDailyHedgehogFacts(dateKey, 5), [dateKey]);

  const formattedTodayLabel = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt.toLocaleDateString(language.bcp47 || 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [dateKey, language.bcp47]);

  // Update midnight countdown and automatically roll over if date changes
  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentKey = getLocalDateKey();
      if (currentKey !== dateKey) {
        setDateKey(currentKey);
        setQaHistory([]);
      }
      setCountdown(getCountdownToMidnight());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dateKey]);

  const fetchDailyCommentary = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `${DAILY_FACT_CACHE_PREFIX}${dateKey}:${language.code}`;
      if (!forceRefresh) {
        try {
          const cachedRaw = window.localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw) as DailyCommentaryPayload;
            if (parsed?.commentary) {
              setEeveeCommentary(parsed);
              onApplyCharacterState({
                form: parsed.activeForm,
                plate: parsed.activePlate,
                tera: parsed.activeTera,
                expression: parsed.expression,
              });
              return;
            }
          }
        } catch {
          // ignore storage errors
        }
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/daily-fact-commentary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateKey,
            factId: dailyRecord.fact.id,
            title: dailyRecord.fact.title,
            speciesFocus: dailyRecord.fact.speciesFocus,
            category: dailyRecord.fact.category,
            fact: dailyRecord.fact.fact,
            scientificNote: dailyRecord.fact.scientificNote,
            eeveeTriggerHint: dailyRecord.fact.eeveeTriggerHint,
            activeForm,
            activePlate,
            activeTera,
            localTime: localTimeDisplay,
            timePhase: phaseInfo.label,
            languageCode: language.code,
          }),
        });
        const data = (await res.json()) as DailyCommentaryPayload & {
          error?: string;
          isFallback?: boolean;
        };
        if (!res.ok) {
          throw new Error(data.error || 'Could not generate today’s hedgehog fact commentary.');
        }

        setEeveeCommentary(data);
        if (!data.isFallback) {
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            // ignore quota errors
          }
        }
        onApplyCharacterState({
          form: data.activeForm,
          plate: data.activePlate,
          tera: data.activeTera,
          expression: data.expression,
        });
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to reach Eevee for today’s daily fact.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      dateKey,
      language.code,
      dailyRecord.fact,
      activeForm,
      activePlate,
      activeTera,
      localTimeDisplay,
      phaseInfo.label,
      onApplyCharacterState,
    ]
  );

  useEffect(() => {
    void fetchDailyCommentary(false);
  }, [dateKey, language.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAskHedgehogQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || isAsking) return;
    const questionText = qaInput.trim();
    setQaInput('');
    setIsAsking(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/daily-fact-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateKey,
          factId: dailyRecord.fact.id,
          title: dailyRecord.fact.title,
          speciesFocus: dailyRecord.fact.speciesFocus,
          category: dailyRecord.fact.category,
          fact: dailyRecord.fact.fact,
          scientificNote: dailyRecord.fact.scientificNote,
          eeveeTriggerHint: dailyRecord.fact.eeveeTriggerHint,
          question: questionText,
          priorCommentary: eeveeCommentary?.commentary || '',
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          languageCode: language.code,
        }),
      });
      const data = (await res.json()) as DailyCommentaryPayload & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to answer hedgehog fact question.');
      }

      setQaHistory((prev) => [
        ...prev,
        {
          id: `fqa-${Date.now()}`,
          question: questionText,
          reply: data.commentary,
          takeaway: data.takeaway,
        },
      ]);

      onApplyCharacterState({
        form: data.activeForm,
        plate: data.activePlate,
        tera: data.activeTera,
        expression: data.expression,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Question failed.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleDiscussInChat = () => {
    const prompt = `Today's daily real-world hedgehog fact (${formattedTodayLabel}): "${dailyRecord.fact.title}" — ${dailyRecord.fact.fact} Give me your honest tactical critique of hedgehogs.`;
    onSwitchToFreeChat(prompt);
  };

  return (
    <section
      aria-label={t.factTitle}
      className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Header + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/10 text-[var(--accent-text)]">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
              {t.factTitle}
            </h2>
            <p className="text-xs text-[var(--text-muted)] truncate">{t.factSubtitle}</p>
          </div>
        </div>
        {modeSwitcher}
      </div>

      {/* Daily Lock Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60 px-5 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-[var(--text-primary)]">{formattedTodayLabel}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="font-medium text-[var(--accent-text)] tabular-nums">
            Edition #{dailyRecord.fact.number} of {HEDGEHOG_FACTS.length} (Real-World Hedgehogs
            Only)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] tabular-nums">
          <Clock className="h-3.5 w-3.5 text-[var(--accent-text)]" />
          <span>Next alternating fact in {countdown}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-5 space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Today's Verified Real-World Hedgehog Fact Card */}
        <article className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-semibold uppercase tracking-wider text-[var(--accent-text)]">
              {dailyRecord.fact.category}
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>{dailyRecord.fact.speciesFocus}</span>
            </span>
          </div>

          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
            {dailyRecord.fact.title}
          </h3>

          <p className="text-sm leading-relaxed text-[var(--text-primary)]">
            {dailyRecord.fact.fact}
          </p>

          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Zoological Note: </strong>
            {dailyRecord.fact.scientificNote}
          </div>
        </article>

        {/* Eevee's Live Reaction & Explanation */}
        <div className="rounded-xl border border-red-500/30 bg-[var(--bg-elevated)] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent-text)]" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Eevee’s Daily Briefing
              </span>
            </div>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void fetchDailyCommentary(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span>Re-Brief</span>
            </button>
          </div>

          {isLoading && !eeveeCommentary ? (
            <div className="flex items-center gap-2.5 py-4 text-xs text-[var(--text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" />
              <span>The Anomalous Eevee is reviewing today’s hedgehog dossier…</span>
            </div>
          ) : eeveeCommentary ? (
            <div className="space-y-3">
              <div className="text-sm space-y-1.5">
                {renderFormattedText(eeveeCommentary.commentary)}
              </div>
              {eeveeCommentary.takeaway && (
                <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">Biological Takeaway: </strong>
                  {eeveeCommentary.takeaway}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-[var(--text-muted)]">
                  {eeveeCommentary.moveUsed
                    ? `${t.chatMoveExecuted}: ${eeveeCommentary.moveUsed}`
                    : `Form: ${eeveeCommentary.activeForm} · ${eeveeCommentary.activePlate}`}
                </span>
                <button
                  type="button"
                  onClick={handleDiscussInChat}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-red-500/60 cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span>{t.factDiscussInChat}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Interactive Q&A about Today's Hedgehog Fact */}
        <div className="space-y-3">
          {qaHistory.length > 0 && (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {qaHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1.5 text-xs"
                >
                  <div className="font-semibold text-[var(--text-secondary)]">
                    {t.chatYouOwner}: {item.question}
                  </div>
                  <div className="text-sm">{renderFormattedText(item.reply)}</div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAskHedgehogQuestion} className="flex items-center gap-2">
            <input
              type="text"
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder={t.factAskPlaceholder}
              disabled={isAsking}
              className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isAsking || !qaInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              {isAsking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{t.chatSend}</span>
            </button>
          </form>
        </div>

        {/* Collapsible Archive of Past Calendar Days (Read-Only) */}
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              <span>{t.factArchiveToggle} (Past 5 Days)</span>
            </span>
            {showArchive ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showArchive && (
            <div className="mt-2.5 space-y-2">
              {previousFacts.map((entry) => (
                <div
                  key={entry.dateKey}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] tabular-nums">
                    <span>{entry.dateKey}</span>
                    <span>
                      #{entry.fact.number} · {entry.fact.category}
                    </span>
                  </div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {entry.fact.title}
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed">{entry.fact.fact}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  FileText,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Skull,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  ABANDONED_STARTERS,
  BIOGRAPHY_CHAPTERS,
  FORMER_HUMAN_DOSSIER,
  ORIGINAL_EIGHT_TEAM,
  REBORN_ANOMALY_DOSSIER,
  type BiographyChapter,
} from '../data/eeveeBiography';
import type { EeveelutionForm, ExpressionState } from '../data/eeveeData';
import type { TimePhase } from '../utils/timeOfDay';
import { TIME_PHASES } from '../utils/timeOfDay';

interface BiographyPanelProps {
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

interface NarrationResult {
  narrative: string;
  revelation: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
}

interface BioQAItem {
  id: string;
  question: string;
  reply: string;
  revelation: string;
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

export const BiographyPanel: React.FC<BiographyPanelProps> = ({
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

  const [subView, setSubView] = useState<'chronicle' | 'dossier'>('chronicle');
  const [selectedChapterId, setSelectedChapterId] = useState<string>(BIOGRAPHY_CHAPTERS[0].id);
  const [narrationsByChapter, setNarrationsByChapter] = useState<Record<string, NarrationResult>>(
    {}
  );
  const [isNarrating, setIsNarrating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [qaInput, setQaInput] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [qaByChapter, setQaByChapter] = useState<Record<string, BioQAItem[]>>({});

  const selectedChapter: BiographyChapter =
    BIOGRAPHY_CHAPTERS.find((c) => c.id === selectedChapterId) ?? BIOGRAPHY_CHAPTERS[0];

  const narrationKey = `${selectedChapter.id}:${language.code}`;
  const currentNarration = narrationsByChapter[narrationKey] ?? null;
  const currentQaList = qaByChapter[selectedChapter.id] ?? [];

  const narrateChapter = useCallback(
    async (chapter: BiographyChapter, forceRefresh = false) => {
      const cacheKey = `${chapter.id}:${language.code}`;
      if (!forceRefresh && narrationsByChapter[cacheKey]) {
        const cached = narrationsByChapter[cacheKey];
        onApplyCharacterState({
          form: cached.activeForm,
          plate: cached.activePlate,
          tera: cached.activeTera,
          expression: cached.expression,
        });
        return;
      }

      setIsNarrating(true);
      setErrorMessage(null);
      try {
        const res = await fetch('/api/biography-narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            timeframe: chapter.timeframe,
            chapterSummary: chapter.summary,
            keyEvents: chapter.keyEvents,
            activeForm: chapter.suggestedForm || activeForm,
            activePlate: chapter.suggestedPlate || activePlate,
            activeTera: chapter.suggestedTera || activeTera,
            localTime: localTimeDisplay,
            timePhase: phaseInfo.label,
            languageCode: language.code,
          }),
        });
        const data = (await res.json()) as NarrationResult & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Could not narrate this biography chapter.');
        }

        setNarrationsByChapter((prev) => ({
          ...prev,
          [cacheKey]: data,
        }));
        onApplyCharacterState({
          form: data.activeForm,
          plate: data.activePlate,
          tera: data.activeTera,
          expression: data.expression,
        });
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to reach Eevee for his life story.'
        );
      } finally {
        setIsNarrating(false);
      }
    },
    [
      language.code,
      narrationsByChapter,
      activeForm,
      activePlate,
      activeTera,
      localTimeDisplay,
      phaseInfo.label,
      onApplyCharacterState,
    ]
  );

  // Auto-narrate Chapter 01 on first mount so user hears Eevee's voice immediately
  useEffect(() => {
    if (subView === 'chronicle' && !currentNarration && !isNarrating && !errorMessage) {
      void narrateChapter(selectedChapter, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapter.id, language.code]);

  const handleAskPast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || isAsking) return;
    const questionText = qaInput.trim();
    setQaInput('');
    setIsAsking(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/biography-narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: selectedChapter.id,
          chapterTitle: selectedChapter.title,
          timeframe: selectedChapter.timeframe,
          chapterSummary: selectedChapter.summary,
          keyEvents: selectedChapter.keyEvents,
          question: questionText,
          priorNarrative: currentNarration?.narrative || '',
          activeForm,
          activePlate,
          activeTera,
          localTime: localTimeDisplay,
          timePhase: phaseInfo.label,
          languageCode: language.code,
        }),
      });
      const data = (await res.json()) as NarrationResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to answer biography question.');
      }

      setQaByChapter((prev) => ({
        ...prev,
        [selectedChapter.id]: [
          ...(prev[selectedChapter.id] || []),
          {
            id: `bioqa-${Date.now()}`,
            question: questionText,
            reply: data.narrative,
            revelation: data.revelation,
          },
        ],
      }));

      onApplyCharacterState({
        form: data.activeForm,
        plate: data.activePlate,
        tera: data.activeTera,
        expression: data.expression,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Biography question failed.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleContinueInChat = () => {
    const prompt = `Let's talk about "${selectedChapter.title}" (${selectedChapter.timeframe}) from your life before reincarnating as an Eevee. Tell me what you never admitted out loud back then.`;
    onSwitchToFreeChat(prompt);
  };

  return (
    <section
      aria-label={t.bioTitle}
      className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
    >
      {/* Header + Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-600/10 text-[var(--accent-text)]">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)] truncate">
              {t.bioTitle}
            </h2>
            <p className="text-xs text-[var(--text-muted)] truncate">{t.bioSubtitle}</p>
          </div>
        </div>
        {modeSwitcher}
      </div>

      {/* Sub-view Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 px-5 py-2.5">
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
          <button
            type="button"
            onClick={() => setSubView('chronicle')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
              subView === 'chronicle'
                ? 'bg-red-600 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Reincarnation Chronicle (6 Eras)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('dossier')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
              subView === 'dossier'
                ? 'bg-red-600 text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Canonical Dossiers & Roster</span>
          </button>
        </div>

        <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
          Born Nov 3, 2010 · Reborn BST 9,000
        </span>
      </div>

      <div className="p-5 space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {subView === 'chronicle' ? (
          <>
            {/* 6-Chapter Timeline Strip */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {BIOGRAPHY_CHAPTERS.map((chap) => {
                const isSelected = chap.id === selectedChapter.id;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => {
                      setSelectedChapterId(chap.id);
                      onApplyCharacterState({
                        form: chap.suggestedForm,
                        plate: chap.suggestedPlate,
                        tera: chap.suggestedTera,
                        expression: chap.suggestedExpression,
                      });
                    }}
                    className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-red-500 bg-red-600/10 text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
                      {chap.eraNumber}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug">
                      {chap.title}
                    </span>
                    <span className="mt-1 text-[10px] text-[var(--text-muted)] tabular-nums">
                      {chap.timeframe}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Era Canonical Record */}
            <article className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                    {selectedChapter.eraNumber} · {selectedChapter.timeframe}
                  </span>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-[var(--text-primary)]">
                    {selectedChapter.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedChapter.subtitle}</p>
                </div>
                <button
                  type="button"
                  disabled={isNarrating}
                  onClick={() => void narrateChapter(selectedChapter, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {isNarrating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{isNarrating ? t.bioNarrating : t.bioNarrateBtn}</span>
                </button>
              </div>

              <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                {selectedChapter.summary}
              </p>

              <ul className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                {selectedChapter.keyEvents.map((ev, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>

              <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs italic text-[var(--text-secondary)]">
                {selectedChapter.canonicalQuote}
              </p>
            </article>

            {/* Eevee's Live Spoken Testimony */}
            <div className="rounded-xl border border-red-500/30 bg-[var(--bg-elevated)] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent-text)]" />
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Eevee’s First-Person Testimony
                  </span>
                </div>
                {currentNarration && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {currentNarration.activeForm} · {currentNarration.activePlate}
                  </span>
                )}
              </div>

              {isNarrating && !currentNarration ? (
                <div className="flex items-center gap-2.5 py-4 text-xs text-[var(--text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" />
                  <span>{t.bioNarrating}</span>
                </div>
              ) : currentNarration ? (
                <div className="space-y-3">
                  <div className="text-sm space-y-1.5">
                    {renderFormattedText(currentNarration.narrative)}
                  </div>
                  {currentNarration.revelation && (
                    <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">Reincarnation Link: </strong>
                      {currentNarration.revelation}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {currentNarration.moveUsed
                        ? `${t.chatMoveExecuted}: ${currentNarration.moveUsed}`
                        : `Expression: ${currentNarration.expression}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleContinueInChat}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-red-500/60 cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      <span>{t.bioDiscussInChat}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Interactive Q&A about his past */}
            <div className="space-y-3">
              {currentQaList.length > 0 && (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {currentQaList.map((item) => (
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

              <form onSubmit={handleAskPast} className="flex items-center gap-2">
                <input
                  type="text"
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  placeholder={t.bioAskPlaceholder}
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
          </>
        ) : (
          /* Canonical Dossiers Sub-view */
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Before Reincarnation */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <ShieldAlert className="h-4 w-4 text-sky-400" />
                  <span>Before Reincarnation · {FORMER_HUMAN_DOSSIER.designation}</span>
                </div>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Born:</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {FORMER_HUMAN_DOSSIER.birthDate}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Dynasty:</dt>
                    <dd className="font-semibold text-[var(--text-primary)] text-right">
                      {FORMER_HUMAN_DOSSIER.familyCompany}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Mainframe:</dt>
                    <dd className="font-medium text-[var(--text-secondary)] text-right">
                      {FORMER_HUMAN_DOSSIER.legacyInfrastructure}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--text-muted)]">Concealed Features:</dt>
                    <dd className="font-medium text-[var(--text-secondary)] text-right">
                      {FORMER_HUMAN_DOSSIER.hiddenFeatures}
                    </dd>
                  </div>
                </dl>
                <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-secondary)]">
                  {FORMER_HUMAN_DOSSIER.appearanceProtocol.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* After Reincarnation */}
              <div className="rounded-xl border border-red-500/35 bg-[var(--bg-elevated)] p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                  <Skull className="h-4 w-4" />
                  <span>After Reincarnation · {REBORN_ANOMALY_DOSSIER.designation}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {REBORN_ANOMALY_DOSSIER.statBreakdown.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5"
                    >
                      <div className="text-[10px] font-semibold text-[var(--text-muted)]">
                        {stat.label}
                      </div>
                      <div className="font-display text-sm font-bold tabular-nums text-[var(--accent-text)]">
                        {stat.value.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                  Lv. {REBORN_ANOMALY_DOSSIER.level} · {REBORN_ANOMALY_DOSSIER.gender} ·{' '}
                  {REBORN_ANOMALY_DOSSIER.shinyStatus} · {REBORN_ANOMALY_DOSSIER.pokeball} · BST{' '}
                  {REBORN_ANOMALY_DOSSIER.baseStatTotal.toLocaleString()} (
                  {REBORN_ANOMALY_DOSSIER.statBreakdownTotal.toLocaleString()} Raw Total)
                </p>
                <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-secondary)]">
                  {REBORN_ANOMALY_DOSSIER.physicalTraits.map((trait, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span>{trait}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Original 8 Males */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Users className="h-4 w-4 text-[var(--accent-text)]" />
                <span>Original Eight Male Eeveelutions (South Province Area Two)</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {ORIGINAL_EIGHT_TEAM.map((member) => (
                  <div
                    key={member.name}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-[var(--text-primary)]">
                        {member.name}
                      </span>
                      <span className="font-semibold text-[var(--accent-text)]">
                        {member.species}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {member.nature} Nature · {member.gender}
                    </div>
                    <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                      {member.notableDetail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 10 Abandoned Water Starters */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Regional Water-Starter Eviction Ledger (10 Entries)
              </h4>
              <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs">
                {ABANDONED_STARTERS.map((row) => (
                  <div
                    key={row.order}
                    className="grid grid-cols-12 items-center gap-2 px-3.5 py-2"
                  >
                    <span className="col-span-1 font-bold tabular-nums text-[var(--text-muted)]">
                      #{row.order}
                    </span>
                    <span className="col-span-3 font-semibold text-[var(--text-primary)]">
                      {row.pokemon}
                    </span>
                    <span className="col-span-2 text-[var(--accent-text)]">{row.region}</span>
                    <span className="col-span-2 tabular-nums text-[var(--text-muted)]">
                      {row.dateLabel}
                    </span>
                    <span className="col-span-4 text-[var(--text-secondary)]">{row.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

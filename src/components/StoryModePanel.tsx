import React, { useEffect, useState } from 'react';
import {
  FastForward,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Swords,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { ARSENAL_MOVES, type EeveelutionForm, type ExpressionState } from '../data/eeveeData';
import { STORY_ARCS, type StoryArc, type StoryBeat } from '../data/storyData';

interface StoryModePanelProps {
  onApplyCharacterState: (state: {
    form?: EeveelutionForm;
    plate?: string;
    tera?: string;
    expression?: ExpressionState;
  }) => void;
  onSwitchToFreeChat: (handoffPrompt?: string) => void;
  modeSwitcher?: React.ReactNode;
}

type PaceOption = 'fast' | 'normal' | 'slow';

const PACE_MS: Record<PaceOption, number> = {
  fast: 2400,
  normal: 4200,
  slow: 6500,
};

interface HistoryEntry {
  key: string;
  nodeTitle: string;
  type: 'beat' | 'choice';
  speaker?: 'narrator' | 'eevee';
  text: string;
  form?: EeveelutionForm;
  plate?: string;
  tera?: string;
  moveUsed?: string | null;
  tacticalTag?: string;
}

export const StoryModePanel: React.FC<StoryModePanelProps> = ({
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const [selectedArcId, setSelectedArcId] = useState<string>(STORY_ARCS[0].id);
  const [currentNodeId, setCurrentNodeId] = useState<string>(STORY_ARCS[0].startNodeId);
  const [visibleBeatCount, setVisibleBeatCount] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [pace, setPace] = useState<PaceOption>('normal');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [localizedMap, setLocalizedMap] = useState<Record<string, string>>({});
  const { language, t, translateDynamicMap } = useLanguage();

  const arc: StoryArc =
    STORY_ARCS.find((a) => a.id === selectedArcId) ?? STORY_ARCS[0];
  const currentNode = arc.nodes[currentNodeId] ?? arc.nodes[arc.startNodeId];
  const totalBeats = currentNode.beats.length;
  const allBeatsRevealed = visibleBeatCount >= totalBeats;
  const currentBeat: StoryBeat | undefined =
    currentNode.beats[Math.min(visibleBeatCount - 1, totalBeats - 1)];

  useEffect(() => {
    let cancelled = false;
    if (language.code === 'en-US') {
      setLocalizedMap({});
      return;
    }

    const entries: { key: string; text: string }[] = [
      { key: `story:${arc.id}:title`, text: arc.title },
      { key: `story:${arc.id}:${currentNode.id}:title`, text: currentNode.title },
    ];
    for (const b of currentNode.beats) {
      entries.push({ key: `story:${arc.id}:${currentNode.id}:beat:${b.id}`, text: b.text });
    }
    for (const c of currentNode.choices ?? []) {
      entries.push({ key: `story:${arc.id}:${currentNode.id}:choice:${c.id}`, text: c.label });
    }
    if (currentNode.endingSummary) {
      entries.push({
        key: `story:${arc.id}:${currentNode.id}:endTitle`,
        text: currentNode.endingSummary.title,
      });
      entries.push({
        key: `story:${arc.id}:${currentNode.id}:endOutcome`,
        text: currentNode.endingSummary.outcome,
      });
    }

    translateDynamicMap(entries)
      .then((map) => {
        if (!cancelled) {
          setLocalizedMap(map);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language.code, arc.id, arc.title, currentNode, translateDynamicMap]);

  // Sync left CharacterStage whenever a new beat is revealed
  useEffect(() => {
    if (!currentBeat) return;
    onApplyCharacterState({
      form: currentBeat.form,
      plate: currentBeat.plate,
      tera: currentBeat.tera,
      expression: currentBeat.expression,
    });
  }, [currentBeat, onApplyCharacterState]);

  // Automatic beat-by-beat progression while beats remain in the active chapter
  useEffect(() => {
    if (!autoPlay || allBeatsRevealed) return;
    const timer = window.setTimeout(() => {
      setVisibleBeatCount((prev) => Math.min(prev + 1, totalBeats));
    }, PACE_MS[pace]);
    return () => window.clearTimeout(timer);
  }, [autoPlay, allBeatsRevealed, pace, totalBeats, visibleBeatCount, currentNodeId]);

  const startArc = (nextArcId: string) => {
    const nextArc = STORY_ARCS.find((a) => a.id === nextArcId) ?? STORY_ARCS[0];
    setSelectedArcId(nextArc.id);
    setCurrentNodeId(nextArc.startNodeId);
    setVisibleBeatCount(1);
    setHistory([]);
    setAutoPlay(true);
  };

  const restartCurrentArc = () => {
    setCurrentNodeId(arc.startNodeId);
    setVisibleBeatCount(1);
    setHistory([]);
    setAutoPlay(true);
  };

  const handleChoose = (choiceId: string) => {
    const choice = currentNode.choices?.find((c) => c.id === choiceId);
    if (!choice) return;

    const committedBeats: HistoryEntry[] = currentNode.beats.map((b) => ({
      key: `${currentNode.id}-${b.id}`,
      nodeTitle: currentNode.title,
      type: 'beat',
      speaker: b.speaker,
      text: b.text,
      form: b.form,
      plate: b.plate,
      tera: b.tera,
      moveUsed: b.moveUsed,
    }));

    const choiceEntry: HistoryEntry = {
      key: `${currentNode.id}-choice-${choice.id}-${Date.now()}`,
      nodeTitle: currentNode.title,
      type: 'choice',
      text: choice.label,
      tacticalTag: choice.tacticalTag,
    };

    setHistory((prev) => [...prev, ...committedBeats, choiceEntry]);
    setCurrentNodeId(choice.nextNodeId);
    setVisibleBeatCount(1);
  };

  const activeNodeBeats = currentNode.beats.slice(0, visibleBeatCount);

  return (
    <section
      aria-label="Automatic Story Mode with The Anomalous Eevee"
      className="flex min-h-[640px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200"
    >
      {/* Workspace Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t.modeAutoStory}: {localizedMap[`story:${arc.id}:title`] || arc.title}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {arc.setting} · {localizedMap[`story:${arc.id}:${currentNode.id}:title`] || currentNode.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {modeSwitcher}

          <button
            type="button"
            onClick={restartCurrentArc}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t.storyRestartArc}
          </button>
        </div>
      </div>

      {/* Arc Picker & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {STORY_ARCS.map((item) => {
            const active = item.id === arc.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => startArc(item.id)}
                className={`min-h-[32px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.title}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              autoPlay
                ? 'border-red-500/40 bg-red-600/15 text-[var(--accent-text)]'
                : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoPlay ? t.storyAutoPlayOn : t.storyAutoPlayPaused}
          </button>

          <div
            role="group"
            aria-label="Reading pace"
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-0.5 text-[11px]"
          >
            {(['fast', 'normal', 'slow'] as PaceOption[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPace(opt)}
                className={`rounded px-2 py-1 capitalize transition-colors cursor-pointer ${
                  pace === opt
                    ? 'bg-[var(--bg-subtle)] font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Story Timeline */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
        {/* Previous Chapters & Choices */}
        {history.map((item) =>
          item.type === 'choice' ? (
            <div key={item.key} className="flex justify-end">
              <div className="max-w-[85%] rounded-xl border border-[var(--user-bubble-border)] bg-[var(--user-bubble-bg)] px-4 py-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--user-bubble-label)]">
                  <span className="font-semibold">Your Choice</span>
                  {item.tacticalTag && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.tacticalTag}</span>
                    </>
                  )}
                </div>
                <p className="text-[var(--text-primary)]">{item.text}</p>
              </div>
            </div>
          ) : (
            <div
              key={item.key}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4 opacity-80"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {item.speaker === 'eevee' ? 'The Anomalous Eevee' : 'Scene'}
                </span>
                {item.form && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.form}</span>
                  </>
                )}
                {item.plate && item.plate !== 'None (Base)' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.plate}</span>
                  </>
                )}
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
                {item.text}
              </p>
            </div>
          )
        )}

        {/* Active Chapter Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 text-xs text-[var(--text-muted)]">
          <span className="font-display font-semibold text-[var(--text-primary)]">
            {currentNode.title}
          </span>
          <span className="font-mono tabular-nums">
            Beat {Math.min(visibleBeatCount, totalBeats)} / {totalBeats}
          </span>
        </div>

        {/* Active Beats */}
        {activeNodeBeats.map((beat) => {
          const moveDetails = beat.moveUsed
            ? ARSENAL_MOVES.find(
                (m) => m.name.toLowerCase() === beat.moveUsed?.toLowerCase()
              )
            : undefined;

          return (
            <motion.div
              key={`${currentNode.id}-${beat.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {beat.speaker === 'eevee' ? 'The Anomalous Eevee' : 'Scene'}
                </span>
                {beat.form && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{beat.form}</span>
                  </>
                )}
                {beat.plate && beat.plate !== 'None (Base)' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{beat.plate}</span>
                  </>
                )}
                {beat.tera && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Tera {beat.tera}</span>
                  </>
                )}
              </div>

              <p
                dir={language.direction}
                className="text-[15px] leading-relaxed text-[var(--text-primary)]"
              >
                {localizedMap[`story:${arc.id}:${currentNode.id}:beat:${beat.id}`] || beat.text}
              </p>

              {beat.moveUsed && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                  <Swords className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                  <span className="font-semibold text-[var(--text-primary)]">
                    Move Executed: {beat.moveUsed}
                  </span>
                  {moveDetails && (
                    <>
                      <span aria-hidden="true" className="text-[var(--text-muted)]">
                        ·
                      </span>
                      <span className="text-[var(--text-secondary)]">{moveDetails.type}</span>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Manual Step Forward while beats remain */}
        {!allBeatsRevealed && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs">
            <span className="text-[var(--text-muted)]">
              {autoPlay
                ? 'Advancing automatically… pauses at the next choice.'
                : 'Auto-play paused. Advance manually when ready.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibleBeatCount((prev) => Math.min(prev + 1, totalBeats))}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
              >
                Next Beat
              </button>
              <button
                type="button"
                onClick={() => setVisibleBeatCount(totalBeats)}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
              >
                <FastForward className="h-3.5 w-3.5" />
                Skip to Choices
              </button>
            </div>
          </div>
        )}

        {/* Branching Choices */}
        {allBeatsRevealed && currentNode.choices && currentNode.choices.length > 0 && (
          <div className="space-y-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                {t.storyChooseResponse}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Auto-play paused for decision
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {currentNode.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleChoose(choice.id)}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-start transition-colors hover:border-red-500/50 cursor-pointer"
                >
                  <div dir={language.direction} className="flex items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {localizedMap[`story:${arc.id}:${currentNode.id}:choice:${choice.id}`] ||
                        choice.label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--text-muted)] group-hover:text-[var(--accent-text)]">
                    {choice.tacticalTag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ending Summary */}
        {allBeatsRevealed && currentNode.endingSummary && (
          <div className="space-y-4 rounded-xl border border-red-500/35 bg-[var(--bg-elevated)] p-5">
            <div dir={language.direction}>
              <h2 className="font-display text-base font-bold text-[var(--text-primary)]">
                {localizedMap[`story:${arc.id}:${currentNode.id}:endTitle`] ||
                  currentNode.endingSummary.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                {localizedMap[`story:${arc.id}:${currentNode.id}:endOutcome`] ||
                  currentNode.endingSummary.outcome}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={restartCurrentArc}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Replay Branching Paths
              </button>
              <button
                type="button"
                onClick={() =>
                  onSwitchToFreeChat(currentNode.endingSummary?.chatHandoffPrompt)
                }
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {t.storyContinueInChat}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

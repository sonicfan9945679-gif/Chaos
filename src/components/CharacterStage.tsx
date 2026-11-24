import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Globe, ShieldAlert, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  ARCEUS_PLATES,
  CHARACTER_ASSETS,
  FORMS,
  TERA_TYPES,
  type EeveelutionForm,
  type ExpressionState,
  type ScenarioEntry,
} from '../data/eeveeData';
import {
  TIME_PHASES,
  type TimePhase,
  type TimeSyncMode,
} from '../utils/timeOfDay';

interface CharacterStageProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  scenario: ScenarioEntry;
  localTimeDisplay: string;
  activePhase: TimePhase;
  timeSyncMode: TimeSyncMode;
  onChangeTimeSyncMode: (mode: TimeSyncMode) => void;
  onChangeForm: (form: EeveelutionForm) => void;
  onChangePlate: (plate: string) => void;
  onChangeTera: (tera: string) => void;
  onQuickPrompt: (text: string) => void;
  isSending: boolean;
}

const SYNC_OPTIONS: { id: TimeSyncMode; label: string }[] = [
  { id: 'auto', label: 'Live' },
  { id: 'morning', label: 'Morn' },
  { id: 'afternoon', label: 'Aft' },
  { id: 'evening', label: 'Eve' },
  { id: 'night', label: 'Night' },
];

export const CharacterStage: React.FC<CharacterStageProps> = ({
  activeForm,
  activePlate,
  activeTera,
  expression,
  scenario,
  localTimeDisplay,
  activePhase,
  timeSyncMode,
  onChangeTimeSyncMode,
  onChangeForm,
  onChangePlate,
  onChangeTera,
  onQuickPrompt,
  isSending,
}) => {
  const [imgError, setImgError] = useState(false);
  const {
    language,
    languages,
    setLanguageCode,
    t,
    isTranslatingUi,
    translateDynamicMap,
    openLanguageModal,
  } = useLanguage();

  const currentFormMeta = FORMS.find((f) => f.name === activeForm) ?? FORMS[0];
  const currentPlateMeta =
    ARCEUS_PLATES.find((p) => p.name === activePlate) ?? ARCEUS_PLATES[0];

  const effectiveType =
    activePlate !== 'None (Base)'
      ? currentPlateMeta.type
      : activeForm === 'Eevee'
        ? 'Normal'
        : currentFormMeta.baseType;

  const phaseInfo = TIME_PHASES[activePhase];
  const combinedStarters = useMemo(
    () => [...phaseInfo.timeStarters.slice(0, 2), ...scenario.starters.slice(0, 2)],
    [phaseInfo.timeStarters, scenario.starters]
  );

  const [localizedStarters, setLocalizedStarters] = useState<string[]>(combinedStarters);

  useEffect(() => {
    let cancelled = false;
    if (language.code === 'en-US') {
      setLocalizedStarters(combinedStarters);
      return;
    }

    const entries = combinedStarters.map((text, idx) => ({
      key: `starter:${activePhase}:${scenario.id}:${idx}`,
      text,
    }));

    translateDynamicMap(entries)
      .then((map) => {
        if (!cancelled) {
          setLocalizedStarters(entries.map((e) => map[e.key] || e.text));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalizedStarters(combinedStarters);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language.code, activePhase, scenario.id, combinedStarters, translateDynamicMap]);

  return (
    <aside className="flex flex-col gap-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-colors duration-200">
      {/* Portrait Container (always uses dark scrim for image text contrast) */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[#0B0D11]">
        {!imgError ? (
          <img
            src={CHARACTER_ASSETS.portrait}
            alt="The Anomalous Eevee glaring with glowing neon-red slit eyes and bared fangs"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover object-center transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#181C25] via-[#12151C] to-[#0B0D11] p-6 text-center">
            <ShieldAlert className="h-10 w-10 text-red-500" />
            <p className="font-display text-base font-semibold text-white">
              The Anomalous Eevee
            </p>
            <p className="text-xs text-zinc-400">
              Neon-red slit eyes · Combat-ready stance
            </p>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-200">
            <span>{activeForm}</span>
            <span aria-hidden="true">·</span>
            <span>{effectiveType} Type</span>
            <span aria-hidden="true">·</span>
            <span>Tera {activeTera}</span>
          </div>
          <p className="mt-1 font-display text-lg font-bold text-white">
            {t.appTitle}
          </p>
        </div>
      </div>

      {/* Time-of-Day Sync Panel */}
      <div className="space-y-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
            <Clock className="h-3.5 w-3.5 text-[var(--accent-text)]" />
            <span>{phaseInfo.label}</span>
          </div>
          <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
            {timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          {phaseInfo.ambientNote}
        </p>

        <div
          role="group"
          aria-label="Time of day sync mode"
          className="grid grid-cols-5 gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1"
        >
          {SYNC_OPTIONS.map((opt) => {
            const active = timeSyncMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeTimeSyncMode(opt.id)}
                className={`min-h-[30px] rounded px-1.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Loadout & Demeanor Controls */}
      <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {t.stageDemeanor}
          </span>
          <span className="text-xs font-semibold text-[var(--accent-text)]">
            {expression}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-2.5">
          <label
            htmlFor="stage-form-select"
            className="text-xs font-medium text-[var(--text-muted)]"
          >
            {t.stageActiveForm}
          </label>
          <select
            id="stage-form-select"
            value={activeForm}
            onChange={(e) => onChangeForm(e.target.value as EeveelutionForm)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
          >
            {FORMS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 py-2.5">
          <label
            htmlFor="stage-plate-select"
            className="text-xs font-medium text-[var(--text-muted)]"
          >
            {t.stageArceusPlate}
          </label>
          <select
            id="stage-plate-select"
            value={activePlate}
            onChange={(e) => onChangePlate(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
          >
            {ARCEUS_PLATES.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 py-2.5">
          <label
            htmlFor="stage-tera-select"
            className="text-xs font-medium text-[var(--text-muted)]"
          >
            {t.stageTeraType}
          </label>
          <select
            id="stage-tera-select"
            value={activeTera}
            onChange={(e) => onChangeTera(e.target.value)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
          >
            {TERA_TYPES.map((tera) => (
              <option key={tera} value={tera}>
                {tera}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {t.stageTransport}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">
            {t.stageMasterBall}
          </span>
        </div>

        <div className="space-y-1.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="stage-language-select"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]"
            >
              <Globe className="h-3.5 w-3.5 text-[var(--accent-text)]" />
              <span>{t.stageLanguage}</span>
            </label>

            <div className="flex items-center gap-1.5">
              <select
                id="stage-language-select"
                value={language.code}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="max-w-[155px] rounded-md border border-[var(--border-strong)] bg-[var(--bg-input)] px-2 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:border-red-500 focus:outline-none"
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={openLanguageModal}
                title="Browse all 34 languages"
                className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:text-[var(--text-primary)] whitespace-nowrap cursor-pointer"
              >
                {t.stageChooseLanguage}
              </button>
            </div>
          </div>
          {isTranslatingUi && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Translating UI to {language.label}…
            </p>
          )}
        </div>
      </div>

      {/* Quick Conversation Starters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {t.stageConversationStarters}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {phaseInfo.label} · {scenario.label}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {localizedStarters.map((starter) => (
            <button
              key={starter}
              type="button"
              dir={language.direction}
              disabled={isSending}
              onClick={() => onQuickPrompt(starter)}
              className="group flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-start text-xs leading-relaxed text-[var(--text-secondary)] transition-colors hover:border-red-500/40 hover:text-[var(--text-primary)] disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-text)] opacity-80 group-hover:opacity-100" />
              <span>{starter}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

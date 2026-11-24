import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import {
  ARCEUS_PLATES,
  CHARACTER_ASSETS,
  FORMS,
  TERA_TYPES,
  type EeveelutionForm,
} from '../data/eeveeData';

interface FormsPlatesViewProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  onSelectForm: (form: EeveelutionForm, goToChat?: boolean) => void;
  onSelectPlate: (plate: string) => void;
  onSelectTera: (tera: string) => void;
}

export const FormsPlatesView: React.FC<FormsPlatesViewProps> = ({
  activeForm,
  activePlate,
  activeTera,
  onSelectForm,
  onSelectPlate,
  onSelectTera,
}) => {
  const [artError, setArtError] = useState(false);

  return (
    <div className="space-y-10">
      {/* Balanced 2-Column Intro + Plate Artwork */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:col-span-7">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Adaptive Matrix</span>
              <span aria-hidden="true">·</span>
              <span>9 Forms</span>
              <span aria-hidden="true">·</span>
              <span>18 Plate States</span>
              <span aria-hidden="true">·</span>
              <span>Multi-Tera Mastery</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              Eeveelutions, Arceus Plates &amp; Tera Types
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
              He ignores evolutionary stones, friendship thresholds, and single-Tera limits.
              Configure his active form, elemental Plate, or Tera Type here—or watch him swap
              mid-sentence during conversation whenever he deems your strategy inadequate.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Current Form</p>
              <p className="mt-1 font-display text-lg font-bold text-[var(--text-primary)]">
                {activeForm}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Equipped Plate</p>
              <p className="mt-1 font-display text-lg font-bold text-[var(--text-primary)]">
                {activePlate}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Primed Tera Type</p>
              <p className="mt-1 font-display text-lg font-bold text-[var(--accent-text)]">
                {activeTera}
              </p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[260px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#12151C] lg:col-span-5">
          {!artError ? (
            <img
              src={CHARACTER_ASSETS.arceusPlates}
              alt="Floating elemental Arceus Plates orbiting a crystalline Tera prism"
              referrerPolicy="no-referrer"
              onError={() => setArtError(true)}
              className="h-full w-full object-cover lg:h-full"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
              <Layers className="h-10 w-10 text-red-400" />
              <p className="font-display text-base font-semibold text-white">
                Arceus Plate &amp; Tera Resonance
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 9 Forms Grid */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border-subtle)] pb-3">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            01. Instant Eeveelution Transformations
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Select any form to shift immediately or challenge him in conversation while transformed.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FORMS.map((form) => {
            const isCurrent = form.name === activeForm;
            return (
              <div
                key={form.name}
                className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                  isCurrent
                    ? 'border-red-500/60 bg-[var(--user-bubble-bg)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {form.name}
                    </h3>
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      {form.baseType}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[var(--accent-text)]">
                    {form.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {form.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => onSelectForm(form.name, false)}
                    className={`min-h-[36px] flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-red-600 text-white'
                        : 'border border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    {isCurrent ? 'Active Form' : 'Equip Form'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectForm(form.name, true)}
                    className="min-h-[36px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/40 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Discuss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Arceus Plates Selector */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border-subtle)] pb-3">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            02. Arceus Plate Typing Override
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Rewrites his elemental typing and shifts Judgment into the chosen Plate’s attribute.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARCEUS_PLATES.map((plate) => {
            const isEquipped = plate.name === activePlate;
            return (
              <button
                key={plate.name}
                type="button"
                onClick={() => onSelectPlate(plate.name)}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  isEquipped
                    ? 'border-red-500/60 bg-[var(--user-bubble-bg)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {plate.name}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {plate.type}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  {plate.note}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Multi-Tera Type Selector */}
      <section className="space-y-4">
        <div className="border-b border-[var(--border-subtle)] pb-3">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            03. Multi-Tera Type Resonance
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Unlike conventional Pokémon locked to a single Tera Type, he switches Tera shards freely.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TERA_TYPES.map((tera) => {
            const active = tera === activeTera;
            return (
              <button
                key={tera}
                type="button"
                onClick={() => onSelectTera(tera)}
                className={`min-h-[40px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tera}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

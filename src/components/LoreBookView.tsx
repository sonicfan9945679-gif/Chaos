import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  CHARACTER_ASSETS,
  CHARACTER_PROFILE,
  LORE_ENTRIES,
} from '../data/eeveeData';

interface LoreBookViewProps {
  onStartConversation: () => void;
}

export const LoreBookView: React.FC<LoreBookViewProps> = ({ onStartConversation }) => {
  const [sceneError, setSceneError] = useState(false);

  return (
    <div className="space-y-10">
      {/* Editorial Top Spread */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:col-span-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>Dossier</span>
              <span aria-hidden="true">·</span>
              <span>Household Pet</span>
              <span aria-hidden="true">·</span>
              <span>Combat Anomaly</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] sm:text-3xl text-balance">
              {CHARACTER_PROFILE.name}
            </h1>
            <p className="text-sm italic leading-relaxed text-[var(--accent-text)]">
              “{CHARACTER_PROFILE.tagline}”
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              {CHARACTER_PROFILE.shortDescription}
            </p>
          </div>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <button
              type="button"
              onClick={onStartConversation}
              className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 cursor-pointer"
            >
              Return to Conversation
            </button>
          </div>
        </div>

        <div className="relative min-h-[280px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#12151C] lg:col-span-6">
          {!sceneError ? (
            <img
              src={CHARACTER_ASSETS.domesticScene}
              alt="The Anomalous Eevee standing in a battle stance in the living room beside a Master Ball"
              referrerPolicy="no-referrer"
              onError={() => setSceneError(true)}
              className="h-full w-full object-cover lg:h-full"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
              <BookOpen className="h-10 w-10 text-red-400" />
              <p className="font-display text-base font-semibold text-white">
                Apartment Living Room · Master Ball Storage
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Personality & Abilities Two-Column Breakdown */}
      <section className="grid grid-cols-1 gap-8 border-y border-[var(--border-subtle)] py-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Personality Profile
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {CHARACTER_PROFILE.personality.join(' · ')}
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Documented Capabilities
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {CHARACTER_PROFILE.abilities.join(' · ')}
          </p>
        </div>
      </section>

      {/* 10 Lore Book Entries */}
      <section className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Lore Book
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Ten field observations on living with an absurdly overpowered, talking house pet.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {LORE_ENTRIES.map((entry) => (
            <article
              key={entry.number}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6"
            >
              <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                <span className="mr-2 font-mono text-sm text-[var(--accent-text)] tabular-nums">
                  {entry.number}.
                </span>
                {entry.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                {entry.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

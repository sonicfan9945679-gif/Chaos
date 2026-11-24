import React, { useMemo, useState } from 'react';
import { Search, Swords } from 'lucide-react';
import { ARSENAL_MOVES, type MoveCategory } from '../data/eeveeData';

interface ArsenalViewProps {
  onTriggerMoveInChat: (moveName: string) => void;
}

const CATEGORIES: ('All' | MoveCategory)[] = [
  'All',
  'Signature',
  'Offensive',
  'Tactical',
  'Prediction',
];

export const ArsenalView: React.FC<ArsenalViewProps> = ({ onTriggerMoveInChat }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | MoveCategory>('All');

  const filteredMoves = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARSENAL_MOVES.filter((m) => {
      const matchesCat = category === 'All' || m.category === category;
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.note.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>Combat Toolkit</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{ARSENAL_MOVES.length} Documented Techniques</span>
            <span aria-hidden="true">·</span>
            <span>46-Move Arsenal</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            Full Tactical Moveset
          </h1>
          <p className="text-sm leading-relaxed text-[var(--text-muted)]">
            Unlike ordinary Pokémon restricted to four moves, The Anomalous Eevee carries an
            exhaustive arsenal covering priority disruption, mind reading, shadow ambushes, and
            Plate-shifting Judgment.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search move or type…"
              aria-label="Search moves"
              className="min-h-[40px] w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Category Filter Bar */}
      <div
        role="group"
        aria-label="Filter moves by category"
        className="flex flex-wrap items-center gap-1.5"
      >
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-red-600 text-white'
                  : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Moves Table */}
      {filteredMoves.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 text-center">
          <p className="font-display text-base font-semibold text-[var(--text-primary)]">
            No matching techniques found
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Clear your search query or switch category filters to view the full arsenal.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('All');
            }}
            className="mt-4 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)]">
                <th className="px-4 py-3.5">Move</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5 text-right">Power</th>
                <th className="px-4 py-3.5 text-right">PP</th>
                <th className="hidden px-4 py-3.5 md:table-cell">Tactical Usage</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredMoves.map((move) => (
                <tr
                  key={move.name}
                  className="transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                    {move.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                    {move.type}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                    {move.category}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--text-primary)] whitespace-nowrap">
                    {move.power}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--text-muted)] whitespace-nowrap">
                    {move.pp}
                  </td>
                  <td className="hidden px-4 py-3 text-xs leading-relaxed text-[var(--text-muted)] md:table-cell">
                    {move.note}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onTriggerMoveInChat(move.name)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/40 hover:bg-red-600 hover:text-white cursor-pointer"
                    >
                      <Swords className="h-3 w-3" />
                      <span>Use in Chat</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

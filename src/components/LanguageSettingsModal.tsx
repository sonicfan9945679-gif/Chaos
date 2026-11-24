import React, { useEffect, useMemo, useState } from 'react';
import { Check, Globe, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const LanguageSettingsModal: React.FC = () => {
  const {
    language,
    languages,
    setLanguageCode,
    t,
    isTranslatingUi,
    translationError,
    isLanguageModalOpen,
    closeLanguageModal,
  } = useLanguage();

  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isLanguageModalOpen) {
      setQuery('');
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLanguageModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isLanguageModalOpen, closeLanguageModal]);

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.nativeName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [languages, query]);

  if (!isLanguageModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
      onClick={closeLanguageModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-start gap-2.5">
            <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-text)]" />
            <div>
              <h2
                id="language-modal-title"
                className="font-display text-lg font-bold text-[var(--text-primary)]"
              >
                {t.modalLanguageTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {t.modalLanguageSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t.modalLanguageClose}
            onClick={closeLanguageModal}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <label htmlFor="language-search-input" className="sr-only">
            {t.modalLanguageSearchPlaceholder}
          </label>
          <input
            id="language-search-input"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.modalLanguageSearchPlaceholder}
            className="w-full min-h-[40px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
          />
        </div>

        {(isTranslatingUi || translationError) && (
          <div className="mt-2.5 text-xs">
            {isTranslatingUi && (
              <span className="text-[var(--text-muted)]">
                Translating interface to {language.label}…
              </span>
            )}
            {translationError && (
              <span className="text-amber-500">{translationError}</span>
            )}
          </div>
        )}

        {/* 34-Language Grid */}
        <div className="mt-4 grid flex-1 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredLanguages.map((item) => {
            const isSelected = item.code === language.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLanguageCode(item.code);
                  closeLanguageModal();
                }}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-red-500/60 bg-red-600/12'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-red-500/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {item.label}
                  </div>
                  <div
                    dir={item.direction}
                    className="truncate text-xs text-[var(--text-muted)]"
                  >
                    {item.nativeName}
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                )}
              </button>
            );
          })}

          {filteredLanguages.length === 0 && (
            <p className="col-span-full py-8 text-center text-xs text-[var(--text-muted)]">
              No languages matched “{query}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_LANGUAGE_CODE,
  getLanguageByCode,
  SUPPORTED_LANGUAGES,
  type LanguageOption,
} from '../data/languages';

export const UI_STRING_DEFAULTS = {
  appTitle: 'The Anomalous Eevee',
  navConversation: 'Conversation',
  navField: 'Map & Calendar',
  navArsenal: 'Arsenal',
  navForms: 'Forms & Plates',
  navLore: 'Lore Book',
  btnNewScene: 'New Scene',

  modeFreeChat: 'Free Chat',
  modeAutoStory: 'Auto Story',
  modeWatchYouTube: 'Watch YouTube',
  modeNotebookLM: 'Docs & Decks',
  modeEncyclopedia: 'Encyclopedias',
  modeCalculator: 'TI-Nspire CAS',

  nlmTitle: 'Docs, Decks, Sheets & Notebooks',
  nlmSubtitle: 'Live review for PDFs, presentations, spreadsheets & NotebookLM',
  nlmAnalyzeBtn: 'Analyze & Review',
  nlmAnalyzing: 'Analyzing…',
  nlmAskPlaceholder: 'Ask Eevee about a slide, cell, claim, or gap…',
  nlmDiscussInChat: 'Discuss This Review in Free Chat',

  wikiTitle: 'Online Encyclopedia Analyzer',
  wikiSubtitle: 'Live non-Google wiki & encyclopedia inspection',
  wikiUrlPlaceholder: 'Paste any non-Google encyclopedia article URL (Wikipedia, Fandom, Bulbapedia, etc.)…',
  wikiAnalyzeBtn: 'Analyze Article',
  wikiAskPlaceholder: 'Ask Eevee about a lore detail, feat, or claim in this article…',
  wikiDiscussInChat: 'Discuss This Article in Free Chat',

  calcTitle: 'TI-Nspire CX II CAS',
  calcSubtitle: 'Symbolic CAS, graphs, lists, statistics, notes, scripts & TVM solver',
  calcAnalyzeBtn: 'Analyze with Eevee',
  calcAnalyzing: 'Analyzing math & data…',
  calcAskPlaceholder: 'Ask Eevee about an equation, integral, R², outlier, or TVM cash flow…',
  calcDiscussInChat: 'Send Snapshot to Free Chat',

  stageDemeanor: 'Demeanor',
  stageActiveForm: 'Active Form',
  stageArceusPlate: 'Arceus Plate',
  stageTeraType: 'Tera Type',
  stageTransport: 'Transport',
  stageMasterBall: 'Master Ball',
  stageLanguage: 'Language',
  stageChooseLanguage: 'All 34…',
  stageConversationStarters: 'Conversation Starters',
  stageTimeLive: 'Live',

  chatActiveScene: 'Active Scene',
  chatYouOwner: 'You (Owner)',
  chatUploadMedia: 'Upload Media',
  chatSend: 'Send',
  chatRetry: 'Retry',
  chatMoveExecuted: 'Move Executed',
  chatPlaceholder: 'Speak to him, or attach/drop an image or video… (Enter to send)',
  chatThinking: 'The Anomalous Eevee narrows his neon-red eyes and inspects everything…',

  ytTitle: 'Watch YouTube with Eevee',
  ytSubtitle: 'Live timestamped commentary',
  ytUrlPlaceholder: 'Paste any YouTube URL or 11-char video ID…',
  ytWatchReview: 'Watch & Review',
  ytWatchingLoading: 'Eevee is watching…',
  ytTrySample: 'Try Sample: Detective Pikachu Official Trailer #1',
  ytFocusPlaceholder: 'Optional angle (e.g. roast their battle tactics)',
  ytEmptyHeading: 'Put a YouTube Video On for Eevee',
  ytEmptyBody:
    'Paste any YouTube link above or load the sample trailer. The Anomalous Eevee watches the actual video and delivers live commentary, form shifts, and Arceus Plate reactions synced to the playback clock over time.',
  ytTimelineTitle: 'Commentary Timeline',
  ytRevealAll: 'Reveal All Beats',
  ytSyncOverTime: 'Sync Over Time',
  ytDiscussInChat: 'Discuss This Video in Free Chat',
  ytPlay: 'Play',
  ytPause: 'Pause',

  storyRestartArc: 'Restart Arc',
  storyAutoPlayOn: 'Auto-Play On',
  storyAutoPlayPaused: 'Auto-Play Paused',
  storyChooseResponse: 'Choose Your Response',
  storyContinueInChat: 'Continue This Scene in Free Chat',

  modalNewSceneTitle: 'Start a New Scene',
  modalNewSceneSubtitle:
    'Reset free chat with a canonical opening, switch language, or launch an interactive mode.',
  modalLanguageTitle: 'Language Settings',
  modalLanguageSubtitle: 'Choose from 34 supported languages and regional dialects.',
  modalLanguageSearchPlaceholder: 'Search 34 languages (e.g. Japanese, Classical Latin, Khmer)…',
  modalLanguageClose: 'Close',
} as const;

export type UIStringKey = keyof typeof UI_STRING_DEFAULTS;
export type UIStrings = Record<UIStringKey, string>;

const LANGUAGE_STORAGE_KEY = 'anomalous-eevee-language';
const I18N_CACHE_PREFIX = 'anomalous-eevee-i18n-v1:';

interface LanguageContextValue {
  language: LanguageOption;
  languages: LanguageOption[];
  setLanguageCode: (code: string) => void;
  t: UIStrings;
  isTranslatingUi: boolean;
  translationError: string | null;
  translateDynamicMap: (entries: { key: string; text: string }[]) => Promise<Record<string, string>>;
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguageCode(): string {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved) {
      return getLanguageByCode(saved).code;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_LANGUAGE_CODE;
}

function readCachedTranslations(code: string): Partial<Record<string, string>> {
  try {
    const raw = window.localStorage.getItem(`${I18N_CACHE_PREFIX}${code}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<string, string>>) : {};
  } catch {
    return {};
  }
}

function writeCachedTranslations(code: string, updates: Record<string, string>) {
  try {
    const existing = readCachedTranslations(code);
    window.localStorage.setItem(
      `${I18N_CACHE_PREFIX}${code}`,
      JSON.stringify({ ...existing, ...updates })
    );
  } catch {
    // ignore quota errors
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [languageCode, setLanguageCodeState] = useState<string>(readStoredLanguageCode);
  const [translatedStrings, setTranslatedStrings] = useState<UIStrings>(UI_STRING_DEFAULTS);
  const [isTranslatingUi, setIsTranslatingUi] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState<boolean>(false);

  const activeRequestIdRef = useRef<number>(0);

  const language = useMemo(() => getLanguageByCode(languageCode), [languageCode]);

  const setLanguageCode = useCallback((nextCode: string) => {
    const valid = getLanguageByCode(nextCode);
    setLanguageCodeState(valid.code);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, valid.code);
    } catch {
      // ignore
    }
  }, []);

  // Update <html lang="..."> when language changes
  useEffect(() => {
    document.documentElement.lang = language.bcp47;
  }, [language.bcp47]);

  // Translate UI strings whenever languageCode changes
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    if (language.code === 'en-US') {
      setTranslatedStrings(UI_STRING_DEFAULTS);
      setIsTranslatingUi(false);
      setTranslationError(null);
      return;
    }

    const cached = readCachedTranslations(language.code);
    const allKeys = Object.keys(UI_STRING_DEFAULTS) as UIStringKey[];
    const missingEntries = allKeys
      .filter((key) => !cached[key])
      .map((key) => ({ key, text: UI_STRING_DEFAULTS[key] }));

    // Immediately show whatever is already cached
    const initialMerge: UIStrings = { ...UI_STRING_DEFAULTS };
    for (const key of allKeys) {
      if (cached[key]) {
        initialMerge[key] = cached[key]!;
      }
    }
    setTranslatedStrings(initialMerge);

    if (missingEntries.length === 0) {
      setIsTranslatingUi(false);
      setTranslationError(null);
      return;
    }

    setIsTranslatingUi(true);
    setTranslationError(null);

    fetch('/api/translate-ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetLanguageCode: language.code,
        entries: missingEntries,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : `Translation failed with status ${res.status}`
          );
        }
        return data as { languageCode: string; translations: Record<string, string> };
      })
      .then((data) => {
        if (activeRequestIdRef.current !== requestId) return;
        writeCachedTranslations(language.code, data.translations);
        const merged: UIStrings = { ...UI_STRING_DEFAULTS };
        for (const key of allKeys) {
          merged[key] = data.translations[key] || cached[key] || UI_STRING_DEFAULTS[key];
        }
        setTranslatedStrings(merged);
      })
      .catch((err: unknown) => {
        if (activeRequestIdRef.current !== requestId) return;
        setTranslationError(
          err instanceof Error ? err.message : 'Could not translate UI labels.'
        );
      })
      .finally(() => {
        if (activeRequestIdRef.current === requestId) {
          setIsTranslatingUi(false);
        }
      });
  }, [language.code]);

  const translateDynamicMap = useCallback(
    async (entries: { key: string; text: string }[]): Promise<Record<string, string>> => {
      if (entries.length === 0) return {};
      if (language.code === 'en-US') {
        return Object.fromEntries(entries.map((e) => [e.key, e.text]));
      }

      const cached = readCachedTranslations(language.code);
      const missing = entries.filter((e) => !cached[e.key]);
      if (missing.length === 0) {
        return Object.fromEntries(entries.map((e) => [e.key, cached[e.key] || e.text]));
      }

      const res = await fetch('/api/translate-ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguageCode: language.code,
          entries: missing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Translation failed with status ${res.status}`
        );
      }

      const fetchedMap = (data.translations ?? {}) as Record<string, string>;
      writeCachedTranslations(language.code, fetchedMap);

      return Object.fromEntries(
        entries.map((e) => [e.key, fetchedMap[e.key] || cached[e.key] || e.text])
      );
    },
    [language.code]
  );

  const value: LanguageContextValue = {
    language,
    languages: SUPPORTED_LANGUAGES,
    setLanguageCode,
    t: translatedStrings,
    isTranslatingUi,
    translationError,
    translateDynamicMap,
    isLanguageModalOpen,
    openLanguageModal: () => setIsLanguageModalOpen(true),
    closeLanguageModal: () => setIsLanguageModalOpen(false),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, BookOpen, Calculator, Globe, Sparkles, Tv, X } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import { LanguageSettingsModal } from './components/LanguageSettingsModal';
import { TopBar, type ActiveTab } from './components/TopBar';
import { CharacterStage } from './components/CharacterStage';
import {
  ChatPanel,
  type ChatMessage,
  type MediaAttachment,
} from './components/ChatPanel';
import { StoryModePanel } from './components/StoryModePanel';
import { YouTubeWatchPanel } from './components/YouTubeWatchPanel';
import { NotebookLMReviewPanel } from './components/NotebookLMReviewPanel';
import { EncyclopediaReviewPanel } from './components/EncyclopediaReviewPanel';
import { TInspireCasPanel } from './components/TInspireCasPanel';
import { MapCalendarWorkspace } from './components/MapCalendarWorkspace';
import { ArsenalView } from './components/ArsenalView';
import { FormsPlatesView } from './components/FormsPlatesView';
import { LoreBookView } from './components/LoreBookView';
import type { DiscoveredPlace, RouteSummaryInfo } from './components/PatrolMapPanel';
import {
  SCENARIOS,
  type EeveelutionForm,
  type ExpressionState,
  type ScenarioId,
} from './data/eeveeData';
import {
  formatLocalDateContext,
  formatLocalTime,
  getTimePhaseForHour,
  TIME_PHASES,
  type TimePhase,
  type TimeSyncMode,
} from './utils/timeOfDay';

const MAX_FILES_PER_MESSAGE = 4;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type ConversationMode =
  | 'free'
  | 'story'
  | 'youtube'
  | 'notebooklm'
  | 'encyclopedia'
  | 'calculator';

function createInitialMessages(scenarioId: ScenarioId): ChatMessage[] {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  return [
    {
      id: `greeting-${scenario.id}-${Date.now()}`,
      role: 'assistant',
      content: scenario.greeting,
      form: 'Eevee',
      plate: scenario.id === 'battle' ? 'Draco Plate' : 'None (Base)',
      tera: 'Normal',
      moveUsed: null,
    },
  ];
}

function summarizeAttachments(attachments?: MediaAttachment[]): string | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  const labels = attachments.map((a) => `${a.kind}: ${a.name}`);
  return `Attached ${labels.join(', ')}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [conversationMode, setConversationMode] = useState<ConversationMode>('free');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('home');
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    createInitialMessages('home')
  );
  const [activeForm, setActiveForm] = useState<EeveelutionForm>('Eevee');
  const [activePlate, setActivePlate] = useState<string>('None (Base)');
  const [activeTera, setActiveTera] = useState<string>('Normal');
  const [expression, setExpression] = useState<ExpressionState>('Demanding Dinner');
  const [inputValue, setInputValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [calculatorExpanded, setCalculatorExpanded] = useState(false);

  const { language, t, translateDynamicMap, openLanguageModal } = useLanguage();

  const [now, setNow] = useState<Date>(() => new Date());
  const [timeSyncMode, setTimeSyncMode] = useState<TimeSyncMode>('auto');

  // Google Maps Platform key & top-level Demo Key quota banner state
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Listen for Case A Google Maps quota exhaustion globally so child unmount cannot erase banner
  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Resolve Maps key from backend fallback if VITE_GOOGLE_MAPS_API_KEY is not injected at build time
  useEffect(() => {
    if (mapsApiKey) return;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { apiKey?: string } | null) => {
        if (data?.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(() => {});
  }, [mapsApiKey]);

  // Tick local clock every 15 seconds so phase & time stay synced in real time
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const autoPhase = getTimePhaseForHour(now.getHours());
  const activePhase: TimePhase = timeSyncMode === 'auto' ? autoPhase : timeSyncMode;
  const phaseInfo = TIME_PHASES[activePhase];
  const localTimeDisplay = formatLocalTime(now);

  // Sync root document theme & .dark class with the active time phase
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-time-phase', activePhase);
    root.classList.toggle('dark', phaseInfo.isDark);
  }, [activePhase, phaseInfo.isDark]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const currentScenario =
    SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  // Translate initial greeting automatically if user has not sent messages yet
  useEffect(() => {
    let cancelled = false;
    if (messages.length !== 1 || !messages[0].id.startsWith('greeting-')) {
      return;
    }

    if (language.code === 'en-US') {
      if (messages[0].content !== currentScenario.greeting) {
        setMessages((prev) =>
          prev.length === 1 && prev[0].id.startsWith('greeting-')
            ? [{ ...prev[0], content: currentScenario.greeting }]
            : prev
        );
      }
      return;
    }

    translateDynamicMap([
      { key: `scenario:${currentScenario.id}:greeting`, text: currentScenario.greeting },
    ])
      .then((map) => {
        if (cancelled) return;
        const translated = map[`scenario:${currentScenario.id}:greeting`];
        if (!translated) return;
        setMessages((prev) =>
          prev.length === 1 &&
          prev[0].id.startsWith('greeting-') &&
          prev[0].content !== translated
            ? [{ ...prev[0], content: translated }]
            : prev
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language.code, currentScenario.id, currentScenario.greeting, messages, translateDynamicMap]);

  const startScenario = (id: ScenarioId) => {
    const nextScenario = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
    pendingAttachments.forEach((att) => {
      URL.revokeObjectURL(att.previewUrl);
      objectUrlsRef.current.delete(att.previewUrl);
    });
    messages.forEach((msg) => {
      msg.attachments?.forEach((att) => {
        URL.revokeObjectURL(att.previewUrl);
        objectUrlsRef.current.delete(att.previewUrl);
      });
    });

    setPendingAttachments([]);
    setScenarioId(id);
    setMessages(createInitialMessages(id));
    setActiveForm('Eevee');
    setActivePlate(id === 'battle' ? 'Draco Plate' : 'None (Base)');
    setActiveTera('Normal');
    setExpression(nextScenario.initialExpression);
    setErrorMessage(null);
    setScenarioModalOpen(false);
    setConversationMode('free');
    setActiveTab('chat');
  };

  const handleAddFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const remainingSlots = MAX_FILES_PER_MESSAGE - pendingAttachments.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
      return;
    }

    const accepted: MediaAttachment[] = [];
    for (const file of incoming) {
      if (accepted.length >= remainingSlots) {
        setErrorMessage(`Maximum ${MAX_FILES_PER_MESSAGE} attachments per message reached.`);
        break;
      }
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        setErrorMessage(`"${file.name}" is not a supported image or video file.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the 50 MB file size limit.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(previewUrl);
      accepted.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: isVideo ? 'video' : 'image',
        name: file.name || (isVideo ? 'video-clip' : 'image'),
        mimeType: file.type,
        size: file.size,
        previewUrl,
        file,
      });
    }

    if (accepted.length > 0) {
      setErrorMessage(null);
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const dispatchChatRequest = async (
    historyToSend: ChatMessage[],
    filesToUpload: MediaAttachment[],
    formToUse: EeveelutionForm,
    plateToUse: string,
    teraToUse: string,
    extraContext?: string
  ) => {
    const formData = new FormData();
    formData.append(
      'messages',
      JSON.stringify(
        historyToSend.map((m) => ({
          role: m.role,
          content: m.content,
          attachmentSummary: summarizeAttachments(m.attachments),
        }))
      )
    );
    formData.append('scenario', currentScenario.label);
    formData.append('activeForm', formToUse);
    formData.append('activePlate', plateToUse);
    formData.append('activeTera', teraToUse);
    formData.append(
      'localTime',
      timeSyncMode === 'auto' ? formatLocalDateContext(now) : `${phaseInfo.label} (${phaseInfo.windowLabel})`
    );
    formData.append('timePhase', phaseInfo.label);
    formData.append('timeBehaviorCue', phaseInfo.aiBehaviorCue);
    formData.append('languageCode', language.code);
    if (extraContext) {
      formData.append('extraContext', extraContext);
    }

    for (const att of filesToUpload) {
      formData.append('media', att.file, att.name);
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        typeof data?.error === 'string'
          ? data.error
          : `Request failed with status ${response.status}`
      );
    }

    const nextForm = (data.activeForm as EeveelutionForm) || formToUse;
    const nextPlate = (data.activePlate as string) || plateToUse;
    const nextTera = (data.activeTera as string) || teraToUse;
    const nextExpression = (data.expression as ExpressionState) || expression;

    setActiveForm(nextForm);
    setActivePlate(nextPlate);
    setActiveTera(nextTera);
    setExpression(nextExpression);

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: data.reply,
      form: nextForm,
      plate: nextPlate,
      tera: nextTera,
      moveUsed: data.moveUsed ?? null,
    };
    setMessages((prev) => [...prev, assistantMsg]);
  };

  const sendMessage = async (
    overrideText?: string,
    overrideState?: {
      form?: EeveelutionForm;
      plate?: string;
      tera?: string;
      extraContext?: string;
    }
  ) => {
    const trimmed = (overrideText ?? inputValue).trim();
    const attachmentsToSend = overrideText ? [] : pendingAttachments;

    if ((!trimmed && attachmentsToSend.length === 0) || isSending) return;

    const formToUse = overrideState?.form ?? activeForm;
    const plateToUse = overrideState?.plate ?? activePlate;
    const teraToUse = overrideState?.tera ?? activeTera;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!overrideText) {
      setInputValue('');
      setPendingAttachments([]);
    }
    setErrorMessage(null);
    setIsSending(true);

    try {
      await dispatchChatRequest(
        nextMessages,
        attachmentsToSend,
        formToUse,
        plateToUse,
        teraToUse,
        overrideState?.extraContext
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to reach The Anomalous Eevee.';
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryLast = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || isSending) return;

    setErrorMessage(null);
    setIsSending(true);
    try {
      await dispatchChatRequest(
        messages,
        lastUser.attachments ?? [],
        activeForm,
        activePlate,
        activeTera
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to reach The Anomalous Eevee.';
      setErrorMessage(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerMoveInChat = (moveName: string) => {
    setConversationMode('free');
    setActiveTab('chat');
    void sendMessage(
      `Show me how you use ${moveName}—and explain why a household pet supposedly needs it.`
    );
  };

  const handleSelectFormFromMatrix = (
    form: EeveelutionForm,
    goToChat = false
  ) => {
    setActiveForm(form);
    if (goToChat) {
      setConversationMode('free');
      setActiveTab('chat');
      void sendMessage(
        `Shift into your ${form} form right now. What tactical advantage are you looking for?`,
        { form }
      );
    }
  };

  const handleApplyStoryState = useCallback(
    (state: {
      form?: EeveelutionForm;
      plate?: string;
      tera?: string;
      expression?: ExpressionState;
    }) => {
      if (state.form) setActiveForm(state.form);
      if (state.plate) setActivePlate(state.plate);
      if (state.tera) setActiveTera(state.tera);
      if (state.expression) setExpression(state.expression);
    },
    []
  );

  const handleSwitchStoryToChat = (handoffPrompt?: string) => {
    setConversationMode('free');
    setActiveTab('chat');
    if (handoffPrompt) {
      void sendMessage(handoffPrompt);
    }
  };

  const handleAskEeveeAboutPlace = (
    place: DiscoveredPlace,
    route?: RouteSummaryInfo | null
  ) => {
    setConversationMode('free');
    setActiveTab('chat');
    const routeLine = route
      ? `Route calculated via ${route.travelMode}: ${route.durationText}, ${route.distanceText}.`
      : 'No route plotted yet.';
    const extraContext = `Real Place from Google Maps:\nName: ${place.name}\nAddress: ${place.address}\nCategory: ${place.categoryLabel || 'Place'}\nRating: ${place.rating ?? 'N/A'} (${place.userRatingCount ?? 0} reviews)\n${routeLine}`;
    const userPrompt = route
      ? `I'm thinking about taking you to ${place.name} (${route.durationText}, ${route.distanceText} by ${route.travelMode.toLowerCase()}). Worth the trip, or are you threatening Teleport?`
      : `What do you think about going to ${place.name} at ${place.address}?`;
    void sendMessage(userPrompt, { extraContext });
  };

  const handleDiscussScheduleWithEevee = (eventsSummary: string) => {
    setConversationMode('free');
    setActiveTab('chat');
    void sendMessage(
      'Here is my upcoming Google Calendar schedule for the week. Any objections—or demands?',
      { extraContext: `Owner's Google Calendar (next 7 days):\n${eventsSummary}` }
    );
  };

  const modeSwitcher = (
    <div
      role="group"
      aria-label="Conversation mode"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1"
    >
      <button
        type="button"
        onClick={() => setConversationMode('free')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'free'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeFreeChat}
      </button>
      <button
        type="button"
        onClick={() => setConversationMode('story')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'story'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeAutoStory}
      </button>
      <button
        type="button"
        onClick={() => setConversationMode('youtube')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'youtube'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeWatchYouTube}
      </button>
      <button
        type="button"
        onClick={() => setConversationMode('notebooklm')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'notebooklm'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeNotebookLM}
      </button>
      <button
        type="button"
        onClick={() => setConversationMode('encyclopedia')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'encyclopedia'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeEncyclopedia}
      </button>
      <button
        type="button"
        onClick={() => setConversationMode('calculator')}
        className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          conversationMode === 'calculator'
            ? 'bg-red-600 text-white'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
        }`}
      >
        {t.modeCalculator}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScenarioModal={() => setScenarioModalOpen(true)}
      />

      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {!(conversationMode === 'calculator' && calculatorExpanded) && (
              <div className="lg:col-span-4">
                <CharacterStage
                  activeForm={activeForm}
                  activePlate={activePlate}
                  activeTera={activeTera}
                  expression={expression}
                  scenario={currentScenario}
                  localTimeDisplay={localTimeDisplay}
                  activePhase={activePhase}
                  timeSyncMode={timeSyncMode}
                  onChangeTimeSyncMode={setTimeSyncMode}
                  onChangeForm={setActiveForm}
                  onChangePlate={setActivePlate}
                  onChangeTera={setActiveTera}
                  onQuickPrompt={(text) => {
                    setConversationMode('free');
                    void sendMessage(text);
                  }}
                  isSending={isSending}
                />
              </div>
            )}

            <div
              className={
                conversationMode === 'calculator' && calculatorExpanded
                  ? 'lg:col-span-12'
                  : 'lg:col-span-8'
              }
            >
              {conversationMode === 'free' ? (
                <ChatPanel
                  messages={messages}
                  scenario={currentScenario}
                  activePhase={activePhase}
                  localTimeDisplay={
                    timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel
                  }
                  inputValue={inputValue}
                  pendingAttachments={pendingAttachments}
                  isSending={isSending}
                  errorMessage={errorMessage}
                  onChangeInput={setInputValue}
                  onAddFiles={handleAddFiles}
                  onRemoveAttachment={handleRemoveAttachment}
                  onSendMessage={() => void sendMessage()}
                  onSelectScenario={startScenario}
                  onRetryLast={() => void handleRetryLast()}
                  modeSwitcher={modeSwitcher}
                />
              ) : conversationMode === 'story' ? (
                <StoryModePanel
                  onApplyCharacterState={handleApplyStoryState}
                  onSwitchToFreeChat={handleSwitchStoryToChat}
                  modeSwitcher={modeSwitcher}
                />
              ) : conversationMode === 'youtube' ? (
                <YouTubeWatchPanel
                  activeForm={activeForm}
                  activePlate={activePlate}
                  activeTera={activeTera}
                  activePhase={activePhase}
                  localTimeDisplay={
                    timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel
                  }
                  onApplyCharacterState={handleApplyStoryState}
                  onSwitchToFreeChat={handleSwitchStoryToChat}
                  modeSwitcher={modeSwitcher}
                />
              ) : conversationMode === 'notebooklm' ? (
                <NotebookLMReviewPanel
                  activeForm={activeForm}
                  activePlate={activePlate}
                  activeTera={activeTera}
                  activePhase={activePhase}
                  localTimeDisplay={
                    timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel
                  }
                  onApplyCharacterState={handleApplyStoryState}
                  onSwitchToFreeChat={handleSwitchStoryToChat}
                  modeSwitcher={modeSwitcher}
                />
              ) : conversationMode === 'encyclopedia' ? (
                <EncyclopediaReviewPanel
                  activeForm={activeForm}
                  activePlate={activePlate}
                  activeTera={activeTera}
                  activePhase={activePhase}
                  localTimeDisplay={
                    timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel
                  }
                  onApplyCharacterState={handleApplyStoryState}
                  onSwitchToFreeChat={handleSwitchStoryToChat}
                  modeSwitcher={modeSwitcher}
                />
              ) : (
                <TInspireCasPanel
                  activeForm={activeForm}
                  activePlate={activePlate}
                  activeTera={activeTera}
                  activePhase={activePhase}
                  localTimeDisplay={
                    timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel
                  }
                  isExpanded={calculatorExpanded}
                  onToggleExpand={() => setCalculatorExpanded((v) => !v)}
                  onApplyCharacterState={handleApplyStoryState}
                  onSwitchToFreeChat={handleSwitchStoryToChat}
                  modeSwitcher={modeSwitcher}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'field' && (
          <MapCalendarWorkspace
            mapsApiKey={mapsApiKey}
            onAskEeveeAboutPlace={handleAskEeveeAboutPlace}
            onDiscussScheduleWithEevee={handleDiscussScheduleWithEevee}
          />
        )}

        {activeTab === 'arsenal' && (
          <ArsenalView onTriggerMoveInChat={handleTriggerMoveInChat} />
        )}

        {activeTab === 'forms' && (
          <FormsPlatesView
            activeForm={activeForm}
            activePlate={activePlate}
            activeTera={activeTera}
            onSelectForm={handleSelectFormFromMatrix}
            onSelectPlate={setActivePlate}
            onSelectTera={setActiveTera}
          />
        )}

        {activeTab === 'lore' && (
          <LoreBookView onStartConversation={() => setActiveTab('chat')} />
        )}
      </main>

      {/* Scenario Switcher Modal */}
      {scenarioModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scene-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2
                  id="scene-modal-title"
                  className="font-display text-lg font-bold text-[var(--text-primary)]"
                >
                  {t.modalNewSceneTitle}
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {t.modalNewSceneSubtitle}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setScenarioModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {SCENARIOS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startScenario(item.id)}
                  className="flex w-full flex-col items-start rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {item.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{item.setting}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {item.greeting.replace(/\*/g, '')}
                  </p>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  setConversationMode('story');
                  setActiveTab('chat');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-600/10 p-4 text-left transition-colors hover:border-red-500 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    Automatic Story Mode
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Play preset branching stories with auto-advancing scenes and multiple choices.
                  </p>
                </div>
                <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  setConversationMode('youtube');
                  setActiveTab('chat');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {t.ytTitle}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Stream any YouTube video with live, timestamped commentary and form shifts over time.
                  </p>
                </div>
                <Tv className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  setConversationMode('notebooklm');
                  setActiveTab('chat');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {t.nlmTitle}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Analyze presentations (.pptx, .odp), text documents (.docx, .odt, .rtf, .txt, .md), spreadsheets (.xlsx, .xls, .csv), PDFs, and NotebookLM notebooks with live commentary.
                  </p>
                </div>
                <BookOpen className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  setConversationMode('encyclopedia');
                  setActiveTab('chat');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {t.wikiTitle}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Analyze articles from Wikipedia, Bulbapedia, Sonic Wiki Zone, Minecraft.wiki, SmashWiki, WiKirby, Pikipedia, Zelda Wiki, MMKB, and any non-Google wiki URL.
                  </p>
                </div>
                <BookMarked className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  setConversationMode('calculator');
                  setActiveTab('chat');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {t.calcTitle}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Full TI-Nspire CX II CAS workstation (Symbolic CAS, Graphing & Slope Fields, Spreadsheets, Regressions, Math Box Notes, Script Editor & TVM Solver) with live Eevee feedback.
                  </p>
                </div>
                <Calculator className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setScenarioModalOpen(false);
                  openLanguageModal();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4 text-left transition-colors hover:border-red-500/50 cursor-pointer"
              >
                <div>
                  <span className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {t.modalLanguageTitle}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {language.label} · {language.nativeName}
                  </p>
                </div>
                <Globe className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
              </button>
            </div>
          </div>
        </div>
      )}

      <LanguageSettingsModal />
    </div>
  );
}

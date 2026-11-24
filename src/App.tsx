import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { TopBar, type ActiveTab } from './components/TopBar';
import { CharacterStage } from './components/CharacterStage';
import {
  ChatPanel,
  type ChatMessage,
  type MediaAttachment,
} from './components/ChatPanel';
import { ArsenalView } from './components/ArsenalView';
import { FormsPlatesView } from './components/FormsPlatesView';
import { LoreBookView } from './components/LoreBookView';
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

  const [now, setNow] = useState<Date>(() => new Date());
  const [timeSyncMode, setTimeSyncMode] = useState<TimeSyncMode>('auto');

  const objectUrlsRef = useRef<Set<string>>(new Set());

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
    teraToUse: string
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
        teraToUse
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
      setActiveTab('chat');
      void sendMessage(
        `Shift into your ${form} form right now. What tactical advantage are you looking for?`,
        { form }
      );
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenScenarioModal={() => setScenarioModalOpen(true)}
      />

      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
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
                onQuickPrompt={(text) => void sendMessage(text)}
                isSending={isSending}
              />
            </div>

            <div className="lg:col-span-8">
              <ChatPanel
                messages={messages}
                scenario={currentScenario}
                activePhase={activePhase}
                localTimeDisplay={timeSyncMode === 'auto' ? localTimeDisplay : phaseInfo.windowLabel}
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
              />
            </div>
          </div>
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
                  Start a New Scene
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Reset the conversation with one of the three canonical openings.
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

            <div className="mt-4 space-y-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

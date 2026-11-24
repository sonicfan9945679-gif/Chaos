import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Film,
  ImagePlus,
  RotateCcw,
  Send,
  Swords,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import {
  ARSENAL_MOVES,
  SCENARIOS,
  type EeveelutionForm,
  type ScenarioEntry,
  type ScenarioId,
} from '../data/eeveeData';
import { TIME_PHASES, type TimePhase } from '../utils/timeOfDay';

export interface MediaAttachment {
  id: string;
  kind: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  file: File;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MediaAttachment[];
  form?: EeveelutionForm;
  plate?: string;
  tera?: string;
  moveUsed?: string | null;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  scenario: ScenarioEntry;
  activePhase: TimePhase;
  localTimeDisplay: string;
  inputValue: string;
  pendingAttachments: MediaAttachment[];
  isSending: boolean;
  errorMessage: string | null;
  onChangeInput: (val: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSendMessage: () => void;
  onSelectScenario: (id: ScenarioId) => void;
  onRetryLast: () => void;
  modeSwitcher?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderFormattedText(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lineIdx} className="h-2" />;
    }

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

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  scenario,
  activePhase,
  localTimeDisplay,
  inputValue,
  pendingAttachments,
  isSending,
  errorMessage,
  onChangeInput,
  onAddFiles,
  onRemoveAttachment,
  onSendMessage,
  onSelectScenario,
  onRetryLast,
  modeSwitcher,
}) => {
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  const { language, t } = useLanguage();

  const phaseInfo = TIME_PHASES[activePhase];

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (!lightboxImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxImage]);

  const canSend =
    !isSending && (inputValue.trim().length > 0 || pendingAttachments.length > 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSendMessage();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.files;
    if (items && items.length > 0) {
      const mediaFiles = Array.from(items).filter(
        (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
      );
      if (mediaFiles.length > 0) {
        e.preventDefault();
        onAddFiles(mediaFiles);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <section
      aria-label="Conversation with The Anomalous Eevee"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-[640px] flex-col rounded-xl border bg-[var(--bg-surface)] transition-colors duration-200 ${
        isDragging ? 'border-red-500/70' : 'border-[var(--border-subtle)]'
      }`}
    >
      {/* Workspace Toolbar: Scene Switcher + Time-Synced Metadata */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-base font-bold text-[var(--text-primary)]">
            {t.chatActiveScene}: {scenario.label}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {scenario.setting} · {phaseInfo.label} ({localTimeDisplay})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {modeSwitcher}

          <div
            role="group"
            aria-label="Scene selection"
            className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1"
          >
            {SCENARIOS.map((item) => {
              const active = item.id === scenario.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectScenario(item.id)}
                  className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag & Drop Hint Banner */}
      {isDragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/70 backdrop-blur-xs"
        >
          <div className="rounded-xl border border-red-500/50 bg-[#171B24] px-6 py-4 text-center">
            <p className="font-display text-base font-bold text-white">
              Drop images or videos to show The Anomalous Eevee
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Up to 4 files per message · Max 50 MB each
            </p>
          </div>
        </div>
      )}

      {/* Message Thread */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
        {messages.map((msg) => {
          const isEevee = msg.role === 'assistant';
          const moveDetails = msg.moveUsed
            ? ARSENAL_MOVES.find(
                (m) => m.name.toLowerCase() === msg.moveUsed?.toLowerCase()
              )
            : undefined;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className={`flex flex-col ${isEevee ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl border px-5 sm:max-w-[78%] ${
                  isEevee
                    ? 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-4'
                    : 'border-[var(--user-bubble-border)] bg-[var(--user-bubble-bg)] py-3.5'
                }`}
              >
                {/* Unboxed metadata header */}
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span
                    className={
                      isEevee
                        ? 'font-semibold text-[var(--text-primary)]'
                        : 'font-semibold text-[var(--user-bubble-label)]'
                    }
                  >
                    {isEevee ? t.appTitle : t.chatYouOwner}
                  </span>
                  {isEevee && msg.form && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{msg.form}</span>
                    </>
                  )}
                  {isEevee && msg.plate && msg.plate !== 'None (Base)' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{msg.plate}</span>
                    </>
                  )}
                  {isEevee && msg.tera && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Tera {msg.tera}</span>
                    </>
                  )}
                </div>

                {/* Uploaded Image & Video Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {msg.attachments.map((att) =>
                      att.kind === 'image' ? (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() =>
                            setLightboxImage({ url: att.previewUrl, name: att.name })
                          }
                          className="group relative overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/20 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400"
                        >
                          <img
                            src={att.previewUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="max-h-64 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                          <div className="border-t border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] truncate">
                            {att.name}
                          </div>
                        </button>
                      ) : (
                        <div
                          key={att.id}
                          className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black/40 sm:col-span-2"
                        >
                          <video
                            src={att.previewUrl}
                            controls
                            playsInline
                            preload="metadata"
                            className="max-h-72 w-full bg-black"
                          />
                          <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                            <span className="truncate">{att.name}</span>
                            <span className="font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                              {formatBytes(att.size)}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {msg.content && (
                  <div dir={language.direction} className="space-y-1.5 text-[15px]">
                    {renderFormattedText(msg.content)}
                  </div>
                )}

                {isEevee && msg.moveUsed && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                    <Swords className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" />
                    <span className="font-semibold text-[var(--text-primary)]">
                      {t.chatMoveExecuted}: {msg.moveUsed}
                    </span>
                    {moveDetails && (
                      <>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span className="text-[var(--text-secondary)]">{moveDetails.type}</span>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-[var(--text-muted)]">
                          Power {moveDetails.power}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {isSending && (
          <div className="flex items-start">
            <div
              dir={language.direction}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5 text-xs text-[var(--text-muted)]"
            >
              {t.chatThinking}
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-950/25 px-4 py-3 text-xs text-red-700 dark:text-red-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={onRetryLast}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-500 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.chatRetry}
            </button>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) {
            onSendMessage();
          }
        }}
        className="border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:px-6"
      >
        {pendingAttachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2.5">
            {pendingAttachments.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 pr-8"
              >
                {att.kind === 'image' ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded bg-[var(--bg-canvas)] text-[var(--accent-text)]">
                    <Film className="h-5 w-5" />
                  </div>
                )}
                <div className="max-w-[160px]">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {att.name}
                  </p>
                  <p className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                    {att.kind === 'video' ? 'Video' : 'Image'} · {formatBytes(att.size)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${att.name}`}
                  onClick={() => onRemoveAttachment(att.id)}
                  className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onAddFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <div className="flex flex-1 items-end gap-2.5">
            <button
              type="button"
              disabled={isSending}
              onClick={() => fileInputRef.current?.click()}
              title={t.chatUploadMedia}
              aria-label={t.chatUploadMedia}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/40 hover:text-[var(--text-primary)] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <ImagePlus className="h-4 w-4 text-[var(--accent-text)]" />
              <span className="hidden sm:inline">{t.chatUploadMedia}</span>
            </button>

            <div className="flex-1">
              <label htmlFor="eevee-chat-input" className="sr-only">
                Message The Anomalous Eevee
              </label>
              <textarea
                id="eevee-chat-input"
                dir={language.direction}
                rows={2}
                value={inputValue}
                onChange={(e) => onChangeInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={t.chatPlaceholder}
                className="w-full resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            <Send className="h-4 w-4" />
            <span>{t.chatSend}</span>
          </button>
        </div>
      </form>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.name}
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl border border-white/[0.12] bg-[#12151C]"
          >
            <button
              type="button"
              aria-label="Close image preview"
              onClick={() => setLightboxImage(null)}
              className="absolute right-3 top-3 rounded-lg bg-black/70 p-2 text-zinc-200 hover:bg-black hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              referrerPolicy="no-referrer"
              className="max-h-[82vh] w-auto object-contain"
            />
            <div className="border-t border-white/[0.08] px-4 py-2.5 text-xs text-zinc-300">
              {lightboxImage.name}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

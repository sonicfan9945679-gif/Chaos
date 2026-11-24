import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileAudio,
  FileSpreadsheet,
  FileText,
  Globe,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  Presentation,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import {
  ARSENAL_MOVES,
  type EeveelutionForm,
  type ExpressionState,
} from '../data/eeveeData';
import { TIME_PHASES, type TimePhase } from '../utils/timeOfDay';

const NOTEBOOK_STORAGE_KEY = 'anomalous-eevee-notebooks-v1';
const MAX_NOTEBOOK_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export type ReviewItemCategory =
  | 'auto'
  | 'presentation'
  | 'document'
  | 'spreadsheet'
  | 'pdf'
  | 'notebooklm';

export interface ReviewStage {
  stageId: string;
  stageTitle: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
  text: string;
  isComplete: boolean;
}

export interface NotebookQAItem {
  id: string;
  question: string;
  reply: string;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
}

export interface SavedNotebookEntry {
  id: string;
  title: string;
  itemCategory?: ReviewItemCategory;
  notebookUrl: string;
  sourceUrlsText: string;
  notesContent: string;
  sourceDigest?: string;
  reviewFocus: string;
  updatedAt: number;
  stages: ReviewStage[];
  retrievedUrls: Array<{ url: string; status: string }>;
  qaHistory: NotebookQAItem[];
}

interface NotebookLMReviewPanelProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  activePhase: TimePhase;
  localTimeDisplay: string;
  onApplyCharacterState: (state: {
    form?: EeveelutionForm;
    plate?: string;
    tera?: string;
    expression?: ExpressionState;
  }) => void;
  onSwitchToFreeChat: (handoffPrompt?: string) => void;
  modeSwitcher?: React.ReactNode;
}

const CATEGORY_OPTIONS: Array<{ id: ReviewItemCategory; label: string }> = [
  { id: 'auto', label: 'Auto-Detect' },
  { id: 'presentation', label: 'Presentation' },
  { id: 'document', label: 'Text Document' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
  { id: 'pdf', label: 'PDF' },
  { id: 'notebooklm', label: 'NotebookLM' },
];

const CANONICAL_STAGES = [
  { id: 'intake', fallbackLabel: 'Format & Scope' },
  { id: 'claims', fallbackLabel: 'Content & Data' },
  { id: 'gaps', fallbackLabel: 'Flaws & Blind Spots' },
  { id: 'verdict', fallbackLabel: 'Final Verdict' },
] as const;

const FOCUS_PRESETS = [
  'Audit claims & logical holes',
  'Critique structure, clarity & flow',
  'Spot numeric outliers & blind spots',
];

const SAMPLE_TEMPLATES: Array<{
  id: ReviewItemCategory;
  buttonLabel: string;
  title: string;
  notesContent: string;
  reviewFocus: string;
}> = [
  {
    id: 'presentation',
    buttonLabel: 'Sample Deck',
    title: 'Q4 Security & Battle Readiness Deck',
    notesContent: `=== Slide 1: Title ===
Project Aegis: Automated Perimeter & Household Defense
Subtitle: Zero Breaches Since Q1 (Projected)
[Speaker Notes]: Keep energy high, gloss over Q2 courier incident.

=== Slide 2: Current Threat Landscape ===
- 42% increase in unauthorized doorbell rings
- Standard guard pets lack type-switching agility
- Solution: Deploy multi-plate tactical deterrence

=== Slide 3: Budget & Timeline ===
- Phase 1: $18,500 hardware upgrade
- Phase 2: Instant rollout across all rooms by Friday
- ROI: 400% efficiency gain (methodology TBD)`,
    reviewFocus: 'Critique structure, clarity & flow',
  },
  {
    id: 'spreadsheet',
    buttonLabel: 'Sample Sheet',
    title: 'Q3 Household Snack & Operations Ledger',
    notesContent: `Month,Category,Planned_USD,Actual_USD,Variance_Pct,Notes
July,Dinner Rations,420,485,+15.5%,Extra sashimi Tuesday
July,Battle Arena Repair,150,920,+513.3%,Unplanned Hyper Beam incident
August,Dinner Rations,420,418,-0.5%,On budget
August,Tera Shard Polish,80,310,+287.5%,All 15 Tera types polished
September,Dinner Rations,420,610,+45.2%,Guest visit surcharge`,
    reviewFocus: 'Spot numeric outliers & blind spots',
  },
  {
    id: 'notebooklm',
    buttonLabel: 'Sample NotebookLM',
    title: 'Competitive Type Coverage Briefing',
    notesContent: `NotebookLM Briefing Document — Competitive Type Adaptability Notes

1. Core Premise:
Standard competitive battlers are constrained to four moves, a single fixed species typing, and one pre-registered Tera Type per battle.

2. Terastallization Trade-offs:
- Offensive Tera amplifies STAB from 1.5x to 2.0x, flipping unfavorable matchups in one turn.
- Defensive Tera removes crippling 4x weaknesses, but locks the user into that single defensive profile for the remainder of the battle.
- Claim in Source A: "No single Pokémon can reliably pivot across every offensive and defensive type chart requirement mid-match without switching out."`,
    reviewFocus: 'Audit claims & logical holes',
  },
];

function createBlankNotebook(index = 1): SavedNotebookEntry {
  return {
    id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: index === 1 ? 'Document / Deck Review' : `Review #${index}`,
    itemCategory: 'auto',
    notebookUrl: '',
    sourceUrlsText: '',
    notesContent: '',
    sourceDigest: '',
    reviewFocus: '',
    updatedAt: Date.now(),
    stages: [],
    retrievedUrls: [],
    qaHistory: [],
  };
}

function loadSavedNotebooks(): SavedNotebookEntry[] {
  try {
    const raw = window.localStorage.getItem(NOTEBOOK_STORAGE_KEY);
    if (!raw) return [createBlankNotebook(1)];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createBlankNotebook(1)];
    }
    return (parsed as SavedNotebookEntry[]).map((nb) => ({
      ...nb,
      itemCategory: nb.itemCategory || 'auto',
    }));
  } catch {
    return [createBlankNotebook(1)];
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function classifyFileKind(file: File): 'presentation' | 'spreadsheet' | 'pdf' | 'audio' | 'document' {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (/\.(pptx|ppt|odp)$/i.test(name) || file.type.includes('presentation') || file.type.includes('powerpoint')) {
    return 'presentation';
  }
  if (
    /\.(xlsx|xls|ods|csv|tsv)$/i.test(name) ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel') ||
    file.type === 'text/csv'
  ) {
    return 'spreadsheet';
  }
  if (/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(name) || file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'document';
}

function isSupportedNotebookFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const allowedExt = [
    '.pdf',
    '.pptx',
    '.ppt',
    '.odp',
    '.docx',
    '.doc',
    '.odt',
    '.rtf',
    '.xlsx',
    '.xls',
    '.ods',
    '.txt',
    '.md',
    '.markdown',
    '.csv',
    '.tsv',
    '.json',
    '.html',
    '.htm',
    '.xml',
    '.mp3',
    '.wav',
    '.m4a',
    '.ogg',
    '.aac',
    '.flac',
  ];
  if (allowedExt.some((ext) => name.endsWith(ext))) return true;
  if (
    file.type === 'application/pdf' ||
    file.type === 'application/json' ||
    file.type === 'application/rtf' ||
    file.type.includes('officedocument') ||
    file.type.includes('opendocument') ||
    file.type.includes('msword') ||
    file.type.includes('ms-excel') ||
    file.type.includes('ms-powerpoint') ||
    file.type.startsWith('text/') ||
    file.type.startsWith('audio/') ||
    file.type.startsWith('image/') ||
    file.type.startsWith('video/')
  ) {
    return true;
  }
  return false;
}

function renderFormattedText(content: string) {
  const lines = content.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lineIdx} className="h-1.5" />;

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

export const NotebookLMReviewPanel: React.FC<NotebookLMReviewPanelProps> = ({
  activeForm,
  activePlate,
  activeTera,
  activePhase,
  localTimeDisplay,
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const { language, t } = useLanguage();
  const phaseInfo = TIME_PHASES[activePhase];

  const [notebooks, setNotebooks] = useState<SavedNotebookEntry[]>(loadSavedNotebooks);
  const [selectedId, setSelectedId] = useState<string>(() => loadSavedNotebooks()[0].id);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [qaQuestion, setQaQuestion] = useState<string>('');
  const [isAskingQa, setIsAskingQa] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const stageBottomRef = useRef<HTMLDivElement | null>(null);

  const activeNotebook = useMemo(
    () => notebooks.find((n) => n.id === selectedId) ?? notebooks[0],
    [notebooks, selectedId]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notebooks.slice(0, 12)));
    } catch {
      // ignore quota errors
    }
  }, [notebooks]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isStreaming) {
      stageBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isStreaming, activeNotebook?.stages]);

  const updateActiveNotebook = useCallback(
    (updater: (prev: SavedNotebookEntry) => SavedNotebookEntry) => {
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === activeNotebook.id ? updater({ ...nb, updatedAt: Date.now() }) : nb))
      );
    },
    [activeNotebook.id]
  );

  const handleCreateNotebook = () => {
    if (isStreaming) return;
    const fresh = createBlankNotebook(notebooks.length + 1);
    setNotebooks((prev) => [fresh, ...prev]);
    setSelectedId(fresh.id);
    setAttachedFiles([]);
    setErrorMessage(null);
    setStreamStatus(null);
    setIsComposerCollapsed(false);
  };

  const handleSelectNotebook = (id: string) => {
    if (isStreaming || id === activeNotebook.id) return;
    setSelectedId(id);
    setAttachedFiles([]);
    setErrorMessage(null);
    setStreamStatus(null);
    const target = notebooks.find((n) => n.id === id);
    setIsComposerCollapsed(Boolean(target && target.stages.length > 0));
  };

  const handleDeleteNotebook = (id: string) => {
    if (isStreaming) return;
    setNotebooks((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (remaining.length === 0) {
        const fallback = createBlankNotebook(1);
        setSelectedId(fallback.id);
        return [fallback];
      }
      if (selectedId === id) {
        setSelectedId(remaining[0].id);
      }
      return remaining;
    });
    setAttachedFiles([]);
    setErrorMessage(null);
  };

  const handleLoadSample = (template: (typeof SAMPLE_TEMPLATES)[number]) => {
    if (isStreaming) return;
    updateActiveNotebook((nb) => ({
      ...nb,
      title: template.title,
      itemCategory: template.id,
      notesContent: template.notesContent,
      sourceDigest: '',
      reviewFocus: template.reviewFocus,
      stages: [],
      retrievedUrls: [],
      qaHistory: [],
    }));
    setErrorMessage(null);
    setIsComposerCollapsed(false);
  };

  const handleAddFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const remainingSlots = MAX_NOTEBOOK_FILES - attachedFiles.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`You can attach up to ${MAX_NOTEBOOK_FILES} files per review.`);
      return;
    }

    const accepted: File[] = [];
    for (const file of incoming) {
      if (accepted.length >= remainingSlots) {
        setErrorMessage(`Maximum ${MAX_NOTEBOOK_FILES} files reached.`);
        break;
      }
      if (!isSupportedNotebookFile(file)) {
        setErrorMessage(
          `"${file.name}" is not a supported format. Upload PDF, presentations (.pptx/.odp), documents (.docx/.odt/.rtf/.txt/.md), spreadsheets (.xlsx/.xls/.ods/.csv/.tsv), audio, image, or video.`
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(`"${file.name}" exceeds the 50 MB size limit.`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) {
      setErrorMessage(null);
      setAttachedFiles((prev) => [...prev, ...accepted]);
      if (
        (activeNotebook.title === 'Document / Deck Review' ||
          activeNotebook.title.startsWith('Review #')) &&
        accepted[0]?.name
      ) {
        updateActiveNotebook((nb) => ({
          ...nb,
          title: accepted[0].name.replace(/\.[^.]+$/, ''),
        }));
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStopStream = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setStreamStatus(null);
    updateActiveNotebook((nb) => ({
      ...nb,
      stages: nb.stages.map((s) => ({ ...s, isComplete: true })),
    }));
  };

  const handleStartReview = async () => {
    if (isStreaming) return;

    const hasNotes = Boolean(activeNotebook.notesContent.trim());
    const hasUrls =
      Boolean(activeNotebook.notebookUrl.trim()) ||
      Boolean(activeNotebook.sourceUrlsText.trim());
    const hasFiles = attachedFiles.length > 0;

    if (!hasNotes && !hasUrls && !hasFiles) {
      setErrorMessage(
        'Attach a file (PDF, .pptx, .docx, .xlsx, .csv, .txt, .md, Audio Overview), paste text/tables/slides, or add public source URLs.'
      );
      return;
    }

    setErrorMessage(null);
    setStreamStatus('Preparing materials for Eevee…');
    setIsStreaming(true);

    updateActiveNotebook((nb) => ({
      ...nb,
      stages: [],
      retrievedUrls: [],
      sourceDigest: '',
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('notebookTitle', activeNotebook.title.trim() || 'Untitled Document / Deck');
      formData.append('itemCategory', activeNotebook.itemCategory || 'auto');
      formData.append('notebookUrl', activeNotebook.notebookUrl.trim());
      formData.append('sourceUrls', activeNotebook.sourceUrlsText.trim());
      formData.append('notesContent', activeNotebook.notesContent.trim());
      formData.append('reviewFocus', activeNotebook.reviewFocus.trim());
      formData.append('activeForm', activeForm);
      formData.append('activePlate', activePlate);
      formData.append('activeTera', activeTera);
      formData.append('localTime', localTimeDisplay);
      formData.append('timePhase', phaseInfo.label);
      formData.append('languageCode', language.code);

      for (const file of attachedFiles) {
        formData.append('notebookFiles', file, file.name);
      }

      const response = await fetch('/api/document-review', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/event-stream')) {
        const errJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          errJson?.error || `Analysis failed with status ${response.status}.`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming body is unavailable in this browser.');
      }

      setIsComposerCollapsed(true);
      const decoder = new TextDecoder();
      let sseBuffer = '';

      const processBlock = (rawBlock: string) => {
        const lines = rawBlock.split(/\r?\n/);
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length === 0) return;
        const payloadRaw = dataLines.join('\n');
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(payloadRaw) as Record<string, unknown>;
        } catch {
          return;
        }

        if (eventName === 'status') {
          if (typeof payload.message === 'string') {
            setStreamStatus(payload.message);
          }
          return;
        }

        if (eventName === 'stage') {
          const stageId = typeof payload.stageId === 'string' ? payload.stageId : `stage-${Date.now()}`;
          const stageTitle =
            typeof payload.stageTitle === 'string' ? payload.stageTitle : 'Analysis';
          const nextForm = (payload.activeForm as EeveelutionForm) || activeForm;
          const nextPlate = (payload.activePlate as string) || activePlate;
          const nextTera = (payload.activeTera as string) || activeTera;
          const nextExpression = (payload.expression as ExpressionState) || 'Judging You';
          const nextMove = typeof payload.moveUsed === 'string' ? payload.moveUsed : null;

          setStreamStatus(`Analyzing · ${stageTitle}`);
          onApplyCharacterState({
            form: nextForm,
            plate: nextPlate,
            tera: nextTera,
            expression: nextExpression,
          });

          updateActiveNotebook((nb) => {
            const finalizedPrev = nb.stages.map((s) => ({ ...s, isComplete: true }));
            const existsIdx = finalizedPrev.findIndex((s) => s.stageId === stageId);
            if (existsIdx >= 0) {
              const nextStages = [...finalizedPrev];
              nextStages[existsIdx] = {
                ...nextStages[existsIdx],
                stageTitle,
                activeForm: nextForm,
                activePlate: nextPlate,
                activeTera: nextTera,
                expression: nextExpression,
                moveUsed: nextMove,
                isComplete: false,
              };
              return { ...nb, stages: nextStages };
            }
            return {
              ...nb,
              stages: [
                ...finalizedPrev,
                {
                  stageId,
                  stageTitle,
                  activeForm: nextForm,
                  activePlate: nextPlate,
                  activeTera: nextTera,
                  expression: nextExpression,
                  moveUsed: nextMove,
                  text: '',
                  isComplete: false,
                },
              ],
            };
          });
          return;
        }

        if (eventName === 'delta') {
          const deltaStageId = typeof payload.stageId === 'string' ? payload.stageId : '';
          const deltaText = typeof payload.text === 'string' ? payload.text : '';
          if (!deltaText) return;

          updateActiveNotebook((nb) => {
            if (nb.stages.length === 0) {
              return {
                ...nb,
                stages: [
                  {
                    stageId: deltaStageId || 'intake',
                    stageTitle: 'Analysis',
                    activeForm,
                    activePlate,
                    activeTera,
                    expression: 'Judging You',
                    moveUsed: null,
                    text: deltaText,
                    isComplete: false,
                  },
                ],
              };
            }
            const nextStages = [...nb.stages];
            const targetIdx = deltaStageId
              ? nextStages.findIndex((s) => s.stageId === deltaStageId)
              : nextStages.length - 1;
            const resolvedIdx = targetIdx >= 0 ? targetIdx : nextStages.length - 1;
            nextStages[resolvedIdx] = {
              ...nextStages[resolvedIdx],
              text: nextStages[resolvedIdx].text + deltaText,
            };
            return { ...nb, stages: nextStages };
          });
          return;
        }

        if (eventName === 'done') {
          const urls = Array.isArray(payload.retrievedUrls)
            ? (payload.retrievedUrls as Array<{ url: string; status: string }>)
            : [];
          const digest =
            typeof payload.sourceDigest === 'string' ? payload.sourceDigest : '';
          updateActiveNotebook((nb) => ({
            ...nb,
            stages: nb.stages.map((s) => ({ ...s, isComplete: true })),
            retrievedUrls: urls,
            sourceDigest: digest || nb.notesContent,
          }));
          setStreamStatus(null);
          return;
        }

        if (eventName === 'error') {
          const msg =
            typeof payload.error === 'string'
              ? payload.error
              : 'Analysis stream interrupted.';
          setErrorMessage(msg);
          setStreamStatus(null);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        while (true) {
          const sepMatch = sseBuffer.match(/\r?\n\r?\n/);
          if (!sepMatch || sepMatch.index === undefined) break;
          const block = sseBuffer.slice(0, sepMatch.index);
          sseBuffer = sseBuffer.slice(sepMatch.index + sepMatch[0].length);
          if (block.trim()) {
            processBlock(block);
          }
        }
      }

      if (sseBuffer.trim()) {
        processBlock(sseBuffer);
      }

      updateActiveNotebook((nb) => ({
        ...nb,
        stages: nb.stages.map((s) => ({ ...s, isComplete: true })),
      }));
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setErrorMessage(
          err instanceof Error ? err.message : 'Could not complete document/notebook review.'
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamStatus(null);
    }
  };

  const handleAskFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = qaQuestion.trim();
    if (!trimmed || isAskingQa || isStreaming) return;

    setIsAskingQa(true);
    setErrorMessage(null);

    try {
      const reviewTranscript = activeNotebook.stages
        .map((s) => `[${s.stageTitle}]\n${s.text}`)
        .join('\n\n');

      const sourceUrls = activeNotebook.sourceUrlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((u) => /^https?:\/\/.+/i.test(u));

      const response = await fetch('/api/document-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookTitle: activeNotebook.title,
          notesExcerpt: activeNotebook.sourceDigest || activeNotebook.notesContent,
          reviewTranscript,
          sourceUrls,
          question: trimmed,
          activeForm,
          activePlate,
          activeTera,
          languageCode: language.code,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : `Follow-up question failed with status ${response.status}`
        );
      }

      const nextForm = (data.activeForm as EeveelutionForm) || activeForm;
      const nextPlate = (data.activePlate as string) || activePlate;
      const nextTera = (data.activeTera as string) || activeTera;
      const nextExpression = (data.expression as ExpressionState) || 'Judging You';

      onApplyCharacterState({
        form: nextForm,
        plate: nextPlate,
        tera: nextTera,
        expression: nextExpression,
      });

      const qaEntry: NotebookQAItem = {
        id: `qa-${Date.now()}`,
        question: trimmed,
        reply: data.reply,
        activeForm: nextForm,
        activePlate: nextPlate,
        activeTera: nextTera,
        expression: nextExpression,
        moveUsed: data.moveUsed ?? null,
      };

      updateActiveNotebook((nb) => ({
        ...nb,
        qaHistory: [...nb.qaHistory, qaEntry],
      }));
      setQaQuestion('');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to ask Eevee about this item.'
      );
    } finally {
      setIsAskingQa(false);
    }
  };

  const handleHandoffToFreeChat = () => {
    const verdictStage =
      activeNotebook.stages.find((s) => s.stageId === 'verdict') ??
      activeNotebook.stages[activeNotebook.stages.length - 1];
    const summaryLine = verdictStage
      ? `Your live review verdict was: "${verdictStage.text.replace(/\s+/g, ' ').slice(0, 320)}"`
      : 'We just inspected my uploaded material.';
    onSwitchToFreeChat(
      `Let's continue discussing "${activeNotebook.title}". ${summaryLine} Challenge the weakest point or give me concrete fixes.`
    );
  };

  const completedStageIds = new Set(
    activeNotebook.stages.filter((s) => s.isComplete).map((s) => s.stageId)
  );
  const activeStreamingStageId = activeNotebook.stages.find((s) => !s.isComplete)?.stageId ?? null;

  return (
    <section
      aria-label="Documents, Presentations, Spreadsheets & NotebookLM Review Workspace"
      className="flex min-h-[76vh] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <BookOpen className="h-4 w-4 text-[var(--accent-text)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {t.nlmTitle}
          </span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">
            ·
          </span>
          <span className="text-xs text-[var(--text-muted)]">{t.nlmSubtitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">{modeSwitcher}</div>
      </div>

      {/* Saved Library & Sample Templates Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-5 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {notebooks.map((nb) => {
            const isSelected = nb.id === activeNotebook.id;
            return (
              <div
                key={nb.id}
                className={`inline-flex items-center rounded-lg border text-xs transition-colors ${
                  isSelected
                    ? 'border-red-500/50 bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <button
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSelectNotebook(nb.id)}
                  className="max-w-[175px] truncate px-3 py-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {nb.title || 'Untitled Review'}
                </button>
                {notebooks.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Delete ${nb.title}`}
                    disabled={isStreaming}
                    onClick={() => handleDeleteNotebook(nb.id)}
                    className="pr-2 text-[var(--text-muted)] hover:text-red-500 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            disabled={isStreaming}
            onClick={handleCreateNotebook}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--border-strong)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/50 hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeNotebook.stages.length > 0 && (
            <button
              type="button"
              onClick={() => setIsComposerCollapsed((v) => !v)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              {isComposerCollapsed ? 'Edit Sources' : 'Hide Sources'}
            </button>
          )}
          {SAMPLE_TEMPLATES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isStreaming}
              onClick={() => handleLoadSample(sample)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3 w-3 text-[var(--accent-text)]" />
              {sample.buttonLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
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
              onClick={() => setErrorMessage(null)}
              className="rounded-md px-2 py-1 text-[11px] font-semibold hover:bg-red-500/20 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sources & Files Composer */}
        {!isComposerCollapsed && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (e.dataTransfer.files?.length) {
                handleAddFiles(e.dataTransfer.files);
              }
            }}
            className={`space-y-4 rounded-xl border p-4 sm:p-5 transition-colors ${
              isDraggingOver
                ? 'border-red-500 bg-red-950/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
            }`}
          >
            {/* Format Focus Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Material Type
              </span>
              <div
                role="group"
                aria-label="Material format selector"
                className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1"
              >
                {CATEGORY_OPTIONS.map((cat) => {
                  const isActive = (activeNotebook.itemCategory || 'auto') === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        updateActiveNotebook((nb) => ({ ...nb, itemCategory: cat.id }))
                      }
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-red-600 text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="nlm-title-input"
                  className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Title
                </label>
                <input
                  id="nlm-title-input"
                  type="text"
                  dir={language.direction}
                  value={activeNotebook.title}
                  onChange={(e) =>
                    updateActiveNotebook((nb) => ({ ...nb, title: e.target.value }))
                  }
                  placeholder="e.g. Q4 Pitch Deck, Budget Sheet, Research PDF…"
                  className="w-full min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="nlm-link-input"
                  className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Reference Link (Optional)
                </label>
                <input
                  id="nlm-link-input"
                  type="url"
                  value={activeNotebook.notebookUrl}
                  onChange={(e) =>
                    updateActiveNotebook((nb) => ({ ...nb, notebookUrl: e.target.value }))
                  }
                  placeholder="https://notebooklm.google.com/notebook/... or doc link"
                  className="w-full min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="nlm-notes-textarea"
                className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Pasted Text, Slide Outline, Spreadsheet CSV/Table, or NotebookLM Notes
              </label>
              <textarea
                id="nlm-notes-textarea"
                rows={4}
                dir={language.direction}
                value={activeNotebook.notesContent}
                onChange={(e) =>
                  updateActiveNotebook((nb) => ({ ...nb, notesContent: e.target.value }))
                }
                placeholder="Paste slide copy, document sections, CSV/spreadsheet rows, or NotebookLM Study Guides here—or drop files on the right/below."
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="nlm-source-urls"
                  className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Public Source URLs (One Per Line)
                </label>
                <textarea
                  id="nlm-source-urls"
                  rows={2}
                  value={activeNotebook.sourceUrlsText}
                  onChange={(e) =>
                    updateActiveNotebook((nb) => ({ ...nb, sourceUrlsText: e.target.value }))
                  }
                  placeholder="https://arxiv.org/abs/..."
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Upload Presentations, Docs, Spreadsheets, PDFs & Audio
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.pptx,.ppt,.odp,.docx,.doc,.odt,.rtf,.xlsx,.xls,.ods,.csv,.tsv,.md,.markdown,.txt,.json,.html,.htm,.xml,audio/*,image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleAddFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[60px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/50 hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <Upload className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />
                  <span>Drop or select .pdf, .pptx, .docx, .xlsx, .csv, .txt, .md, or audio</span>
                </button>
              </div>
            </div>

            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, idx) => {
                  const kind = classifyFileKind(file);
                  return (
                    <div
                      key={`${file.name}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                    >
                      {kind === 'presentation' ? (
                        <Presentation className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      ) : kind === 'spreadsheet' ? (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      ) : kind === 'audio' ? (
                        <FileAudio className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      )}
                      <span className="max-w-[180px] truncate font-medium text-[var(--text-primary)]">
                        {file.name}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                        {kind.toUpperCase()} · {formatFileSize(file.size)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => handleRemoveFile(idx)}
                        className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Review Angle + Submit */}
            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-1.5">
                {FOCUS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      updateActiveNotebook((nb) => ({ ...nb, reviewFocus: preset }))
                    }
                    className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      activeNotebook.reviewFocus === preset
                        ? 'border-red-500/60 bg-red-600/15 text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                <input
                  type="text"
                  dir={language.direction}
                  value={activeNotebook.reviewFocus}
                  onChange={(e) =>
                    updateActiveNotebook((nb) => ({ ...nb, reviewFocus: e.target.value }))
                  }
                  placeholder="Or custom review focus…"
                  className="min-w-[160px] flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopStream}
                    className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg border border-red-500/60 bg-red-600/15 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-600/25 cursor-pointer whitespace-nowrap"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop Stream
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleStartReview()}
                    className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 cursor-pointer whitespace-nowrap"
                  >
                    <BookOpen className="h-4 w-4" />
                    {t.nlmAnalyzeBtn}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live 4-Stage Analytical Progress Stepper */}
        {(isStreaming || activeNotebook.stages.length > 0) && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-text)]" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span className="font-semibold text-[var(--text-primary)]">
                  {streamStatus || `${activeNotebook.title} — Analysis Complete`}
                </span>
              </div>

              {isStreaming && isComposerCollapsed && (
                <button
                  type="button"
                  onClick={handleStopStream}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-600/15 px-2.5 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-600/25 cursor-pointer whitespace-nowrap"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </button>
              )}
              {!isStreaming && activeNotebook.stages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleStartReview()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  Re-analyze
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CANONICAL_STAGES.map((step, idx) => {
                const matchedStage = activeNotebook.stages.find((s) => s.stageId === step.id);
                const isDone = completedStageIds.has(step.id);
                const isLive = activeStreamingStageId === step.id;
                return (
                  <div
                    key={step.id}
                    className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                      isLive
                        ? 'border-red-500/60 bg-red-600/10 text-[var(--text-primary)]'
                        : isDone
                          ? 'border-emerald-500/35 bg-[var(--bg-surface)] text-[var(--text-primary)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums font-medium">
                      <span>0{idx + 1}</span>
                      {isLive && <span className="text-[var(--accent-text)]">Live</span>}
                      {isDone && !isLive && <span className="text-emerald-500">Done</span>}
                    </div>
                    <p className="mt-0.5 truncate font-semibold">
                      {matchedStage?.stageTitle || step.fallbackLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Streamed Stage Cards */}
        {activeNotebook.stages.length > 0 && (
          <div className="space-y-3">
            {activeNotebook.stages.map((stage) => {
              const moveInfo = stage.moveUsed
                ? ARSENAL_MOVES.find(
                    (m) => m.name.toLowerCase() === stage.moveUsed?.toLowerCase()
                  )
                : null;
              const isStageLive = isStreaming && !stage.isComplete;

              return (
                <motion.div
                  key={stage.stageId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className={`rounded-xl border px-5 py-4 ${
                    isStageLive
                      ? 'border-red-500/45 bg-[var(--bg-elevated)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-[var(--text-muted)]">
                      <span className="font-display font-bold text-[var(--text-primary)]">
                        {stage.stageTitle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[var(--accent-text)]">
                        {stage.activeForm}
                      </span>
                      {stage.activePlate !== 'None (Base)' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{stage.activePlate}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Tera {stage.activeTera}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isStageLive ? 'Analyzing live…' : `Demeanor: ${stage.expression}`}
                    </span>
                  </div>

                  <div dir={language.direction} className="space-y-1 text-[15px]">
                    {stage.text ? (
                      renderFormattedText(stage.text)
                    ) : (
                      <p className="text-xs italic text-[var(--text-muted)]">
                        Scanning contents…
                      </p>
                    )}
                    {isStageLive && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-red-500 align-middle"
                      />
                    )}
                  </div>

                  {stage.moveUsed && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-2.5 text-xs">
                      <Swords className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                      <span className="font-semibold text-[var(--text-primary)]">
                        Move Executed: {stage.moveUsed}
                      </span>
                      {moveInfo && (
                        <>
                          <span aria-hidden="true" className="text-[var(--text-muted)]">
                            ·
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            {moveInfo.type}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Retrieved URLs Context Summary */}
        {activeNotebook.retrievedUrls.length > 0 && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs">
            <p className="mb-1.5 font-semibold text-[var(--text-primary)]">
              Inspected Source URLs
            </p>
            <ul className="space-y-1 text-[var(--text-secondary)]">
              {activeNotebook.retrievedUrls.map((item) => (
                <li key={item.url} className="flex items-center justify-between gap-2 truncate">
                  <span className="truncate">{item.url}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up Interrogation Q&A */}
        {activeNotebook.stages.length > 0 && !isStreaming && (
          <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            {activeNotebook.qaHistory.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-5 py-4"
              >
                <p className="text-xs font-semibold text-[var(--user-bubble-label)]">
                  You asked: “{item.question}”
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--accent-text)]">
                    {item.activeForm}
                  </span>
                  {item.activePlate !== 'None (Base)' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.activePlate}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Tera {item.activeTera}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.expression}</span>
                </div>
                <div dir={language.direction} className="space-y-1 text-[14px]">
                  {renderFormattedText(item.reply)}
                </div>
              </div>
            ))}

            <form
              onSubmit={(e) => void handleAskFollowUp(e)}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <label htmlFor="nlm-qa-input" className="sr-only">
                  Ask Eevee a follow-up question
                </label>
                <input
                  id="nlm-qa-input"
                  type="text"
                  dir={language.direction}
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  placeholder={t.nlmAskPlaceholder}
                  className="w-full min-h-[38px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-red-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isAskingQa || !qaQuestion.trim()}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAskingQa ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-text)]" />
                    Inspecting…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                    Ask Eevee
                  </>
                )}
              </button>
            </form>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleHandoffToFreeChat}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/40 cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-text)]" />
                {t.nlmDiscussInChat}
              </button>
            </div>
          </div>
        )}

        <div ref={stageBottomRef} />
      </div>
    </section>
  );
};

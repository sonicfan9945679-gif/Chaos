import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronUp,
  Code2,
  Coins,
  Delete,
  FileSpreadsheet,
  FileText,
  LineChart,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { EeveelutionForm, ExpressionState } from '../data/eeveeData';
import type { TimePhase } from '../utils/timeOfDay';
import {
  CAS_CATALOG,
  computeOneVarStats,
  computeRegression,
  evaluateCasCommand,
  runNspireScript,
  solveTvmVariable,
  type AngleMode,
  type CalculationMode,
  type CasEntry,
  type ComplexMode,
  type RegressionResult,
  type TvmInputs,
  type VariableBinding,
} from '../utils/nspireCasEngine';
import { NspireGraphsView, type GraphSnapshot } from './NspireGraphsView';

export type NspireAppTab =
  | 'calculator'
  | 'graphs'
  | 'spreadsheet'
  | 'statistics'
  | 'notes'
  | 'program'
  | 'tvm';

interface TInspireCasPanelProps {
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  activePhase: TimePhase;
  localTimeDisplay: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onApplyCharacterState: (state: {
    form?: EeveelutionForm;
    plate?: string;
    tera?: string;
    expression?: ExpressionState;
  }) => void;
  onSwitchToFreeChat: (handoffPrompt?: string) => void;
  modeSwitcher: React.ReactNode;
}

interface SpreadsheetRow {
  A: string;
  B: string;
  C: string;
  D: string;
}

interface EeveeCalcAnalysis {
  feedback: string;
  insights: string[];
  suggestedCommand: string | null;
  activeForm: EeveelutionForm;
  activePlate: string;
  activeTera: string;
  expression: ExpressionState;
  moveUsed: string | null;
  analyzedAt: string;
}

const DEFAULT_CAS_HISTORY: CasEntry[] = [
  {
    id: 'seed-1',
    input: 'solve(x^2 - 5*x + 6 = 0, x)',
    exactOutput: '[2,3]',
    approxOutput: '[2, 3]',
    prettyOutput: '[2,3]',
    timestamp: Date.now() - 120_000,
  },
  {
    id: 'seed-2',
    input: 'diff(sin(x^2) * exp(x), x)',
    exactOutput: '2*x*cos(x^2)*e^x+e^x*sin(x^2)',
    approxOutput: '2*x*cos(x^2)*e^x+e^x*sin(x^2)',
    prettyOutput: '2·x·cos(x^2)·e^x + e^x·sin(x^2)',
    timestamp: Date.now() - 60_000,
  },
];

const DEFAULT_SHEET_NAMES = {
  A: 'time_s',
  B: 'height_m',
  C: 'velocity',
  D: 'notes_val',
};

const DEFAULT_SHEET_ROWS: SpreadsheetRow[] = [
  { A: '0', B: '1.2', C: '=A1*4.9', D: '12' },
  { A: '1', B: '14.8', C: '=A2*4.9', D: '15' },
  { A: '2', B: '24.1', C: '=A3*4.9', D: '18' },
  { A: '3', B: '28.5', C: '=A4*4.9', D: '19' },
  { A: '4', B: '27.9', C: '=A5*4.9', D: '21' },
  { A: '5', B: '22.4', C: '=A6*4.9', D: '23' },
  { A: '6', B: '11.9', C: '=A7*4.9', D: '24' },
  { A: '7', B: '-3.2', C: '=A8*4.9', D: '28' },
];

const DEFAULT_NOTES = `# Ballistic Trajectory & Error Lab
Measure vertical height y (m) versus elapsed time t (s).

Quadratic Vertex Check:
{{diff(-2.45*x^2 + 16.4*x + 1.2, x)}}

Critical Time t* when dy/dt = 0:
{{solve(-4.9*x + 16.4 = 0, x)}}

System Matrix Check (rref):
{{rref([[1, 2, 5], [3, -1, 1]])}}`;

const PROGRAM_SAMPLES: Record<string, { title: string; code: string }> = {
  newton: {
    title: "Newton's Method (√2)",
    code: `# Newton-Raphson Solver for sqrt(2)
x = 1.5
for k in range(1, 7):
  x = 0.5 * (x + 2 / x)
  print("iter", k, "x =", x)
err = abs(x - sqrt(2))
print("Final error =", err)`,
  },
  collatz: {
    title: 'Collatz Orbit Length',
    code: `# Collatz Conjecture Trajectory from n = 27
n = 27
steps = 0
peak = n
while n > 1:
  if n % 2 == 0:
    n = n / 2
  else:
    n = 3 * n + 1
  if n > peak:
    peak = n
  steps = steps + 1
print("Steps to 1 =", steps, "| Peak =", peak)`,
  },
  crit: {
    title: 'Battle EV Damage Sweep',
    code: `# Expected Hyper Beam Power Sweep
base = 150
stab = 1.5
for atk in range(80, 140, 15):
  dmg = base * stab * (atk / 100)
  print("Atk", atk, "-> Damage", dmg)`,
  },
};

function renderFormattedFeedback(text: string): React.ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-[var(--text-secondary)]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export const TInspireCasPanel: React.FC<TInspireCasPanelProps> = ({
  activeForm,
  activePlate,
  activeTera,
  activePhase,
  localTimeDisplay,
  isExpanded = false,
  onToggleExpand,
  onApplyCharacterState,
  onSwitchToFreeChat,
  modeSwitcher,
}) => {
  const { language, t } = useLanguage();

  // Active sub-app tab (1.1 - 1.7)
  const [activeApp, setActiveApp] = useState<NspireAppTab>('calculator');

  // Calculator Global Telemetry Settings
  const [angleMode, setAngleMode] = useState<AngleMode>('RAD');
  const [calcMode, setCalcMode] = useState<CalculationMode>('AUTO');
  const [complexMode, setComplexMode] = useState<ComplexMode>('REAL');

  // Shared CAS Variable Table & History (1.1)
  const [variables, setVariables] = useState<Record<string, VariableBinding>>({
    g: { name: 'g', definition: '9.81', evaluatedPreview: '9.81' },
  });
  const [casHistory, setCasHistory] = useState<CasEntry[]>(DEFAULT_CAS_HISTORY);
  const [casInput, setCasInput] = useState('');
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [showKeypad, setShowKeypad] = useState(true);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showVarsPopover, setShowVarsPopover] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const casInputRef = useRef<HTMLInputElement | null>(null);
  const casScrollRef = useRef<HTMLDivElement | null>(null);

  // 1.2 Graph Snapshot + external function injection
  const [graphSnapshot, setGraphSnapshot] = useState<GraphSnapshot | null>(null);
  const [externalGraphInject, setExternalGraphInject] = useState<{
    expr: string;
    nonce: number;
  } | null>(null);

  // 1.3 Lists & Spreadsheet
  const [colNames, setColNames] = useState(DEFAULT_SHEET_NAMES);
  const [sheetRows, setSheetRows] = useState<SpreadsheetRow[]>(DEFAULT_SHEET_ROWS);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvPasteText, setCsvPasteText] = useState('');
  const [statsColKey, setStatsColKey] = useState<'A' | 'B' | 'C' | 'D'>('B');

  // 1.4 Data & Statistics
  const [statPlotType, setStatPlotType] = useState<
    'scatter' | 'dotplot' | 'histogram' | 'boxplot'
  >('scatter');
  const [xListCol, setXListCol] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [yListCol, setYListCol] = useState<'A' | 'B' | 'C' | 'D'>('B');
  const [regKind, setRegKind] = useState<RegressionResult['kind']>('quadratic');
  const [histBins, setHistBins] = useState(5);
  const [showMovableLine, setShowMovableLine] = useState(false);
  const [movableM, setMovableM] = useState(1.5);
  const [movableB, setMovableB] = useState(10);

  // 1.5 Notes
  const [notesContent, setNotesContent] = useState(DEFAULT_NOTES);

  // 1.6 Program Editor
  const [selectedSampleKey, setSelectedSampleKey] = useState<string>('newton');
  const [programSource, setProgramSource] = useState(PROGRAM_SAMPLES.newton.code);
  const [programOutput, setProgramOutput] = useState<string[]>([
    'Ready — press Run Script to execute TI-Python / TI-Basic routine.',
  ]);
  const [programError, setProgramError] = useState<string | null>(null);

  // 1.7 Finance / TVM Solver
  const [tvm, setTvm] = useState<TvmInputs>({
    N: 360,
    I: 6.25,
    PV: 320000,
    PMT: -1970.29,
    FV: 0,
    PpY: 12,
    CpY: 12,
  });
  const [tvmLastSolved, setTvmLastSolved] = useState<string | null>(null);

  // Eevee Feedback & Analysis state
  const [autoAnalyzeOnEval, setAutoAnalyzeOnEval] = useState(false);
  const [eeveeQuestion, setEeveeQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EeveeCalcAnalysis | null>(null);

  useEffect(() => {
    if (casScrollRef.current) {
      casScrollRef.current.scrollTop = casScrollRef.current.scrollHeight;
    }
  }, [casHistory]);

  // Evaluate spreadsheet formulas safely (=A1*2, =B2+C2)
  const evaluatedSheet = useMemo(() => {
    const colKeys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    const numGrid: Record<'A' | 'B' | 'C' | 'D', number[]> = { A: [], B: [], C: [], D: [] };

    // Pass 1: parse literals
    sheetRows.forEach((row, rIdx) => {
      colKeys.forEach((col) => {
        const raw = row[col].trim();
        if (!raw || raw.startsWith('=')) {
          numGrid[col][rIdx] = NaN;
        } else {
          const n = Number(raw);
          numGrid[col][rIdx] = Number.isFinite(n) ? n : NaN;
        }
      });
    });

    // Pass 2: resolve = formulas referencing cell coordinates (A1..D20)
    sheetRows.forEach((row, rIdx) => {
      colKeys.forEach((col) => {
        const raw = row[col].trim();
        if (!raw.startsWith('=')) return;
        const formula = raw.slice(1).replace(/\b([ABCD])(\d+)\b/g, (_, c: 'A' | 'B' | 'C' | 'D', rowStr: string) => {
          const targetIdx = Number(rowStr) - 1;
          const v = numGrid[c]?.[targetIdx];
          return Number.isFinite(v) ? String(v) : '0';
        });
        const res = evaluateCasCommand(formula, {
          angleMode,
          calcMode: 'APPROX',
          complexMode: 'REAL',
          variables,
          lastAns: '0',
        });
        const parsed = Number(res.approxOutput);
        numGrid[col][rIdx] = Number.isFinite(parsed) ? parsed : NaN;
      });
    });

    return numGrid;
  }, [sheetRows, angleMode, variables]);

  const activeOneVarStats = useMemo(
    () => computeOneVarStats(evaluatedSheet[statsColKey]),
    [evaluatedSheet, statsColKey]
  );

  const activeXStats = useMemo(
    () => computeOneVarStats(evaluatedSheet[xListCol]),
    [evaluatedSheet, xListCol]
  );

  const activeYStats = useMemo(
    () => computeOneVarStats(evaluatedSheet[yListCol]),
    [evaluatedSheet, yListCol]
  );

  const activeRegression = useMemo(
    () => computeRegression(evaluatedSheet[xListCol], evaluatedSheet[yListCol], regKind),
    [evaluatedSheet, xListCol, yListCol, regKind]
  );

  const scatterPairs = useMemo(() => {
    const xs = evaluatedSheet[xListCol];
    const ys = evaluatedSheet[yListCol];
    return xs
      .map((x, idx) => ({ x, y: ys[idx], row: idx + 1 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }, [evaluatedSheet, xListCol, yListCol]);

  const movableSsr = useMemo(() => {
    if (scatterPairs.length === 0) return 0;
    return scatterPairs.reduce((acc, p) => acc + (p.y - (movableM * p.x + movableB)) ** 2, 0);
  }, [scatterPairs, movableM, movableB]);

  // Evaluate inline {{...}} Math Boxes in 1.5 Notes
  const evaluatedNoteBlocks = useMemo(() => {
    return notesContent.split('\n').map((line, idx) => {
      const match = line.match(/^\{\{(.+)\}\}$/);
      if (!match) {
        return { id: idx, type: 'text' as const, raw: line };
      }
      const expr = match[1].trim();
      const res = evaluateCasCommand(expr, {
        angleMode,
        calcMode,
        complexMode,
        variables,
        lastAns: casHistory[casHistory.length - 1]?.exactOutput || '0',
      });
      return {
        id: idx,
        type: 'mathbox' as const,
        expr,
        output: res.prettyOutput,
        isError: res.isError,
      };
    });
  }, [notesContent, angleMode, calcMode, complexMode, variables, casHistory]);

  // Analyze current workspace snapshot with Eevee
  const analyzeWithEevee = useCallback(
    async (
      questionOverride?: string,
      historyOverride?: CasEntry[],
      varsOverride?: Record<string, VariableBinding>
    ) => {
      if (isAnalyzing) return;
      setIsAnalyzing(true);
      setAnalysisError(null);

      const pageLabels: Record<NspireAppTab, string> = {
        calculator: '1.1 Calculator (CAS)',
        graphs: '1.2 Graphs & Geometry',
        spreadsheet: '1.3 Lists & Spreadsheet',
        statistics: '1.4 Data & Statistics',
        notes: '1.5 Notes (Math Box)',
        program: '1.6 Program Editor',
        tvm: '1.7 Finance / TVM Solver',
      };

      const histToSend = (historyOverride ?? casHistory).slice(-12).map((h) => ({
        input: h.input,
        exactOutput: h.exactOutput,
        approxOutput: h.approxOutput,
      }));

      const varsToSend = Object.fromEntries(
        Object.entries(varsOverride ?? variables).map(([k, v]) => [k, v.evaluatedPreview])
      );

      try {
        const res = await fetch('/api/calculator-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeApp,
            pageLabel: pageLabels[activeApp],
            angleMode,
            calcMode,
            complexMode,
            casHistory: histToSend,
            variables: varsToSend,
            graphSnapshot,
            spreadsheetSummary: {
              columns: colNames,
              rowCount: sheetRows.length,
              rowsPreview: sheetRows.slice(0, 12),
              oneVarStatsColumn: colNames[statsColKey],
              oneVarStats: activeOneVarStats,
            },
            statsSummary: {
              plotType: statPlotType,
              xColumn: colNames[xListCol],
              yColumn: colNames[yListCol],
              regression: activeRegression
                ? {
                    kind: activeRegression.kind,
                    equation: activeRegression.equationLabel,
                    rSquared: Number(activeRegression.rSquared.toFixed(5)),
                    correlationR:
                      activeRegression.correlationR !== null
                        ? Number(activeRegression.correlationR.toFixed(5))
                        : null,
                  }
                : null,
            },
            notesContent,
            programSource,
            programOutput,
            tvmState: tvm,
            userQuestion: questionOverride ?? eeveeQuestion,
            activeForm,
            activePlate,
            activeTera,
            localTime: localTimeDisplay,
            timePhase: activePhase,
            languageCode: language.code,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : `Calculator analysis failed (${res.status})`
          );
        }

        const nextAnalysis: EeveeCalcAnalysis = {
          feedback: data.feedback,
          insights: Array.isArray(data.insights) ? data.insights : [],
          suggestedCommand: data.suggestedCommand ?? null,
          activeForm: data.activeForm ?? activeForm,
          activePlate: data.activePlate ?? activePlate,
          activeTera: data.activeTera ?? activeTera,
          expression: data.expression ?? 'Judging You',
          moveUsed: data.moveUsed ?? null,
          analyzedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setAnalysis(nextAnalysis);
        if (!questionOverride) {
          setEeveeQuestion('');
        }
        onApplyCharacterState({
          form: nextAnalysis.activeForm,
          plate: nextAnalysis.activePlate,
          tera: nextAnalysis.activeTera,
          expression: nextAnalysis.expression,
        });
      } catch (err: unknown) {
        setAnalysisError(
          err instanceof Error ? err.message : 'Failed to reach Eevee for mathematical analysis.'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      isAnalyzing,
      casHistory,
      variables,
      activeApp,
      angleMode,
      calcMode,
      complexMode,
      graphSnapshot,
      colNames,
      sheetRows,
      statsColKey,
      activeOneVarStats,
      statPlotType,
      xListCol,
      yListCol,
      activeRegression,
      notesContent,
      programSource,
      programOutput,
      tvm,
      eeveeQuestion,
      activeForm,
      activePlate,
      activeTera,
      localTimeDisplay,
      activePhase,
      language.code,
      onApplyCharacterState,
    ]
  );

  const executeCasExpression = (rawCommand?: string) => {
    const command = (rawCommand ?? casInput).trim();
    if (!command) return;

    const lastAns =
      [...casHistory].reverse().find((h) => !h.isError && h.exactOutput && h.exactOutput !== 'Done')
        ?.exactOutput || '0';

    const result = evaluateCasCommand(command, {
      angleMode,
      calcMode,
      complexMode,
      variables,
      lastAns,
    });

    const nextEntry: CasEntry = {
      id: `cas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      input: command,
      exactOutput: result.exactOutput,
      approxOutput: result.approxOutput,
      prettyOutput: result.prettyOutput,
      isError: result.isError,
      timestamp: Date.now(),
    };

    const nextHistory = [...casHistory, nextEntry];
    const nextVars = result.updatedVariables ?? variables;

    setCasHistory(nextHistory);
    if (result.updatedVariables) {
      setVariables(result.updatedVariables);
    }
    if (!rawCommand) {
      setCasInput('');
    }
    setHistoryCursor(-1);
    setActiveApp('calculator');

    if (autoAnalyzeOnEval && !result.isError) {
      void analyzeWithEevee(
        `Evaluate my latest CAS command "${command}" -> "${result.prettyOutput}". Check edge cases or hidden structure.`,
        nextHistory,
        nextVars
      );
    }
  };

  const insertTokenIntoCas = (token: string, cursorOffsetBack = 0) => {
    const inputEl = casInputRef.current;
    if (!inputEl) {
      setCasInput((prev) => prev + token);
      return;
    }
    const start = inputEl.selectionStart ?? casInput.length;
    const end = inputEl.selectionEnd ?? casInput.length;
    const updated = casInput.slice(0, start) + token + casInput.slice(end);
    setCasInput(updated);
    window.requestAnimationFrame(() => {
      inputEl.focus();
      const pos = Math.max(0, start + token.length - cursorOffsetBack);
      inputEl.setSelectionRange(pos, pos);
    });
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return CAS_CATALOG;
    return CAS_CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [catalogSearch]);

  const handleImportCsv = () => {
    const lines = csvPasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const parsed: SpreadsheetRow[] = lines.map((line) => {
      const cells = line.split(/[,\t;]/).map((c) => c.trim());
      return {
        A: cells[0] ?? '',
        B: cells[1] ?? '',
        C: cells[2] ?? '',
        D: cells[3] ?? '',
      };
    });
    setSheetRows(parsed);
    setShowCsvModal(false);
    setCsvPasteText('');
  };

  const handleSolveTvm = (target: 'N' | 'I' | 'PV' | 'PMT' | 'FV') => {
    try {
      const solved = solveTvmVariable(tvm, target);
      if (!Number.isFinite(solved)) return;
      setTvm((prev) => ({
        ...prev,
        [target]: Number(solved.toFixed(target === 'N' || target === 'I' ? 4 : 2)),
      }));
      setTvmLastSolved(`Solved ${target} = ${solved.toFixed(4)}`);
    } catch (err: unknown) {
      setTvmLastSolved(err instanceof Error ? err.message : 'Unable to solve TVM variable.');
    }
  };

  const handleRunProgram = () => {
    const res = runNspireScript(programSource);
    setProgramOutput(res.output.length > 0 ? res.output : ['(Program finished with no output)']);
    setProgramError(res.error ?? null);
  };

  const handleSendSnapshotToFreeChat = () => {
    const latestCas = casHistory[casHistory.length - 1];
    const summaryParts = [
      `Active TI-Nspire App: ${activeApp} (${angleMode}, ${calcMode}, ${complexMode})`,
      latestCas ? `Latest CAS: ${latestCas.input} = ${latestCas.prettyOutput}` : null,
      activeRegression
        ? `Regression (${colNames[yListCol]} vs ${colNames[xListCol]}): ${activeRegression.equationLabel} (R²=${activeRegression.rSquared.toFixed(4)})`
        : null,
      analysis ? `Eevee's prior calc note: ${analysis.feedback.replace(/\*/g, '')}` : null,
    ].filter(Boolean);

    onSwitchToFreeChat(
      `Look over my TI-Nspire CX II CAS workspace (${summaryParts.join(' | ')}). Break down the math and tell me what I missed.`
    );
  };

  const appTabs: Array<{ id: NspireAppTab; label: string; icon: React.ReactNode }> = [
    { id: 'calculator', label: '1.1 Calc', icon: <Calculator className="h-3.5 w-3.5" /> },
    { id: 'graphs', label: '1.2 Graph', icon: <LineChart className="h-3.5 w-3.5" /> },
    { id: 'spreadsheet', label: '1.3 Lists', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
    { id: 'statistics', label: '1.4 Data', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'notes', label: '1.5 Notes', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'program', label: '1.6 Code', icon: <Code2 className="h-3.5 w-3.5" /> },
    { id: 'tvm', label: '1.7 TVM', icon: <Coins className="h-3.5 w-3.5" /> },
  ];

  return (
    <section
      aria-label="TI-Nspire CX II CAS Workstation"
      className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200"
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-sky-500 shrink-0" />
            <h2 className="font-display text-sm font-bold text-[var(--text-primary)]">
              {t.calcTitle}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.calcSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
              title={isExpanded ? 'Split view alongside Eevee' : 'Expand calculator workspace'}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  Split View
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  Expand
                </>
              )}
            </button>
          )}
          {modeSwitcher}
        </div>
      </div>

      {/* TI-Nspire CX II CAS Handheld Bezel & OS Shell */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="rounded-2xl border-2 border-slate-700/80 bg-slate-900 p-2.5 sm:p-3 shadow-lg">
          {/* Handheld Top Telemetry Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-slate-950 px-3 py-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold tracking-wider text-sky-400">
                TI-NSPIRE CX II CAS
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[11px] text-slate-400">Doc 1</span>
            </div>

            {/* Telemetry Settings & Popovers */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAngleMode((m) => (m === 'RAD' ? 'DEG' : 'RAD'))}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                title="Toggle Angle Unit"
              >
                {angleMode}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalcMode((m) =>
                    m === 'AUTO' ? 'EXACT' : m === 'EXACT' ? 'APPROX' : 'AUTO'
                  )
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                title="Cycle Calculation Output Mode"
              >
                {calcMode}
              </button>
              <button
                type="button"
                onClick={() =>
                  setComplexMode((m) =>
                    m === 'REAL' ? 'RECTANGULAR' : m === 'RECTANGULAR' ? 'POLAR' : 'REAL'
                  )
                }
                className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300 hover:bg-slate-700 cursor-pointer whitespace-nowrap"
                title="Cycle Complex Format"
              >
                {complexMode}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCatalog((v) => !v);
                  setShowVarsPopover(false);
                }}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                  showCatalog
                    ? 'border-sky-500 bg-sky-600/30 text-sky-200'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <BookOpen className="h-3 w-3" />
                Catalog
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowVarsPopover((v) => !v);
                  setShowCatalog(false);
                }}
                className={`rounded border px-2 py-0.5 font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                  showVarsPopover
                    ? 'border-amber-500 bg-amber-600/30 text-amber-200'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                var ({Object.keys(variables).length})
              </button>
            </div>
          </div>

          {/* Searchable CAS Catalog Popover */}
          {showCatalog && (
            <div className="border-b border-slate-800 bg-slate-900/95 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search CAS commands (solve, rref, eigVl, diff, taylor, normCdf)…"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatalog(false)}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {filteredCatalog.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setCasInput(item.template);
                      setActiveApp('calculator');
                      setShowCatalog(false);
                      casInputRef.current?.focus();
                    }}
                    className="flex flex-col items-start rounded-md border border-slate-800 bg-slate-950/90 p-2 text-left hover:border-sky-500/60 cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-sky-400">{item.syntax}</span>
                      <span className="text-[10px] text-slate-500">{item.category}</span>
                    </div>
                    <span className="mt-0.5 text-[11px] text-slate-400">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Variable Inspector Popover */}
          {showVarsPopover && (
            <div className="border-b border-slate-800 bg-slate-900/95 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-amber-300">
                  Defined Variables & Functions (:=)
                </span>
                <button
                  type="button"
                  onClick={() => setShowVarsPopover(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
              {Object.keys(variables).length === 0 ? (
                <p className="text-xs text-slate-400">
                  No custom variables stored. Example: <code className="text-sky-300">f(x) := x^2 - 4</code>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.values(variables).map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-200"
                    >
                      <span>{v.evaluatedPreview}</span>
                      <button
                        type="button"
                        onClick={() => executeCasExpression(`DelVar ${v.name}`)}
                        title={`Delete ${v.name}`}
                        className="text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TI-Nspire Document Page Tabs (1.1 - 1.7) */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-950/90 px-2 py-1.5 border-b border-slate-800">
            {appTabs.map((tab) => {
              const active = activeApp === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveApp(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* LCD Screen Container */}
          <div className="rounded-b-xl bg-[var(--bg-canvas)] p-3 sm:p-4 text-[var(--text-primary)]">
            {/* ==================== 1.1 CALCULATOR (CAS) ==================== */}
            {activeApp === 'calculator' && (
              <div className="space-y-3">
                {/* 2-Column CAS History Screen */}
                <div
                  ref={casScrollRef}
                  className="h-[260px] overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 space-y-2.5 font-mono text-xs"
                >
                  {casHistory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                      Enter any algebraic, calculus, matrix, or probability expression below.
                    </div>
                  ) : (
                    casHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="border-b border-[var(--border-subtle)]/70 pb-2 last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setCasInput(entry.input);
                            casInputRef.current?.focus();
                          }}
                          className="block w-full text-left font-medium text-[var(--text-secondary)] hover:text-sky-500 cursor-pointer"
                          title="Click to recall expression"
                        >
                          {entry.input}
                        </button>
                        <div className="mt-1 flex flex-wrap items-baseline justify-end gap-3 text-right">
                          {entry.approxOutput !== entry.exactOutput &&
                            !entry.isError &&
                            calcMode === 'AUTO' && (
                              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                ≈ {entry.approxOutput}
                              </span>
                            )}
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              entry.isError ? 'text-red-500' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {calcMode === 'APPROX' ? entry.approxOutput : entry.prettyOutput}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Quick CAS Templates Ribbon */}
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { label: 'solve(', insert: 'solve( = 0, x)', back: 6 },
                    { label: 'factor(', insert: 'factor()', back: 1 },
                    { label: 'expand(', insert: 'expand()', back: 1 },
                    { label: 'd/dx', insert: 'diff(, x)', back: 4 },
                    { label: '∫ dx', insert: 'integrate(, x)', back: 4 },
                    { label: '∫a..b', insert: 'defint(, 0, 1, x)', back: 10 },
                    { label: 'lim', insert: 'limit(, x, 0)', back: 7 },
                    { label: 'Σ', insert: 'sum(, k, 1, 10)', back: 10 },
                    { label: 'taylor', insert: 'taylor(, x, 0, 4)', back: 10 },
                    { label: 'linSolve', insert: 'linSolve([ , ], [x, y])', back: 12 },
                    { label: 'rref', insert: 'rref([[1,2,5],[3,-1,1]])', back: 0 },
                    { label: 'eigVl', insert: 'eigVl([[2,1],[1,2]])', back: 0 },
                  ].map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => insertTokenIntoCas(tpl.insert, tpl.back)}
                      className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--text-primary)] hover:border-sky-500/60 cursor-pointer whitespace-nowrap"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                {/* CAS Expression Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    executeCasExpression();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={casInputRef}
                    type="text"
                    value={casInput}
                    onChange={(e) => setCasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' && casHistory.length > 0) {
                        e.preventDefault();
                        const nextIdx =
                          historyCursor === -1
                            ? casHistory.length - 1
                            : Math.max(0, historyCursor - 1);
                        setHistoryCursor(nextIdx);
                        setCasInput(casHistory[nextIdx].input);
                      } else if (e.key === 'ArrowDown' && historyCursor !== -1) {
                        e.preventDefault();
                        if (historyCursor >= casHistory.length - 1) {
                          setHistoryCursor(-1);
                          setCasInput('');
                        } else {
                          const nextIdx = historyCursor + 1;
                          setHistoryCursor(nextIdx);
                          setCasInput(casHistory[nextIdx].input);
                        }
                      }
                    }}
                    placeholder="Type CAS command (e.g. solve(x^3-x=0, x), f(x):=x^2+1, normCdf(-1,1,0,1))…"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-sky-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] rounded-lg bg-sky-600 px-3.5 py-1.5 font-mono text-xs font-bold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                  >
                    Enter ↵
                  </button>
                  <button
                    type="button"
                    onClick={() => setCasHistory([])}
                    title="Clear CAS history"
                    className="min-h-[36px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Clear
                  </button>
                </form>

                {/* Toggleable TI-Nspire CX II CAS Physical Keypad Deck */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowKeypad((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showKeypad ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showKeypad ? 'Hide TI-Nspire CX II CAS Keypad' : 'Show TI-Nspire CX II CAS Keypad'}
                  </button>

                  {showKeypad && (
                    <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-100">
                      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                        {[
                          { label: 'x', val: 'x' },
                          { label: 'y', val: 'y' },
                          { label: 'z', val: 'z' },
                          { label: 't', val: 't' },
                          { label: 'π', val: 'pi' },
                          { label: 'e^x', val: 'exp()', back: 1 },
                          { label: 'ln', val: 'ln()', back: 1 },
                          { label: ':=', val: ' := ' },

                          { label: 'sin', val: 'sin()', back: 1 },
                          { label: 'cos', val: 'cos()', back: 1 },
                          { label: 'tan', val: 'tan()', back: 1 },
                          { label: '√', val: 'sqrt()', back: 1 },
                          { label: 'x²', val: '^2' },
                          { label: '^', val: '^' },
                          { label: '(', val: '(' },
                          { label: ')', val: ')' },

                          { label: '7', val: '7', num: true },
                          { label: '8', val: '8', num: true },
                          { label: '9', val: '9', num: true },
                          { label: '÷', val: '/' },
                          { label: '[ ]', val: '[]', back: 1 },
                          { label: 'i', val: 'i' },
                          { label: 'Ans', val: 'Ans' },
                          { label: 'Del', val: '__DEL__', action: 'del' },

                          { label: '4', val: '4', num: true },
                          { label: '5', val: '5', num: true },
                          { label: '6', val: '6', num: true },
                          { label: '×', val: '*' },
                          { label: 'nCr', val: 'nCr(, )', back: 3 },
                          { label: 'det', val: 'det([[]])', back: 2 },
                          { label: '=', val: '=' },
                          { label: 'AC', val: '__CLR__', action: 'clear' },

                          { label: '1', val: '1', num: true },
                          { label: '2', val: '2', num: true },
                          { label: '3', val: '3', num: true },
                          { label: '−', val: '-' },
                          { label: '0', val: '0', num: true },
                          { label: '.', val: '.', num: true },
                          { label: '+', val: '+' },
                          { label: 'Enter', val: '__ENTER__', action: 'enter' },
                        ].map((k) => (
                          <button
                            key={k.label}
                            type="button"
                            onClick={() => {
                              if (k.action === 'enter') executeCasExpression();
                              else if (k.action === 'clear') setCasInput('');
                              else if (k.action === 'del') setCasInput((p) => p.slice(0, -1));
                              else insertTokenIntoCas(k.val, k.back ?? 0);
                            }}
                            className={`min-h-[32px] rounded-md px-1.5 py-1 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                              k.action === 'enter'
                                ? 'bg-sky-600 text-white hover:bg-sky-500'
                                : k.action === 'clear' || k.action === 'del'
                                  ? 'bg-red-900/70 text-red-100 hover:bg-red-800'
                                  : k.num
                                    ? 'bg-slate-200 text-slate-900 hover:bg-white'
                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {k.action === 'del' ? <Delete className="mx-auto h-3.5 w-3.5" /> : k.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== 1.2 GRAPHS & GEOMETRY ==================== */}
            {activeApp === 'graphs' && (
              <NspireGraphsView
                angleMode={angleMode}
                variables={variables}
                externalFunctionInject={externalGraphInject}
                onSnapshotChange={setGraphSnapshot}
              />
            )}

            {/* ==================== 1.3 LISTS & SPREADSHEET ==================== */}
            {activeApp === 'spreadsheet' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSheetRows((prev) => [...prev, { A: '', B: '', C: '', D: '' }])
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setColNames(DEFAULT_SHEET_NAMES);
                        setSheetRows(DEFAULT_SHEET_ROWS);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Load Sample Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCsvModal((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Paste CSV
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveApp('statistics')}
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                  >
                    Open in 1.4 Data & Stats
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {showCsvModal && (
                  <div className="rounded-lg border border-sky-500/40 bg-[var(--bg-elevated)] p-3 space-y-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Paste CSV / TSV rows (up to 4 columns A, B, C, D)
                    </p>
                    <textarea
                      rows={4}
                      value={csvPasteText}
                      onChange={(e) => setCsvPasteText(e.target.value)}
                      placeholder={'1, 2.4, 5, 10\n2, 4.9, 6, 12\n3, 9.1, 7, 14'}
                      className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-canvas)] p-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCsvModal(false)}
                        className="rounded px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleImportCsv}
                        className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
                      >
                        Import Rows
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                  <table className="w-full border-collapse font-mono text-xs tabular-nums">
                    <thead>
                      <tr className="border-b border-[var(--border-strong)] bg-[var(--bg-elevated)]">
                        <th className="w-10 border-r border-[var(--border-subtle)] px-2 py-1.5 text-center text-[var(--text-muted)]">
                          #
                        </th>
                        {(['A', 'B', 'C', 'D'] as const).map((col) => (
                          <th
                            key={col}
                            className="border-r border-[var(--border-subtle)] px-2 py-1 text-left last:border-r-0"
                          >
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-sky-500">{col}</span>
                              <input
                                type="text"
                                value={colNames[col]}
                                onChange={(e) =>
                                  setColNames((prev) => ({ ...prev, [col]: e.target.value }))
                                }
                                className="min-w-0 flex-1 bg-transparent font-mono text-[11px] font-semibold text-[var(--text-primary)] focus:outline-none"
                              />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="border-b border-[var(--border-subtle)] last:border-b-0"
                        >
                          <td className="border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 px-2 py-1 text-center text-[11px] text-[var(--text-muted)]">
                            {rIdx + 1}
                          </td>
                          {(['A', 'B', 'C', 'D'] as const).map((col) => {
                            const raw = row[col];
                            const evalVal = evaluatedSheet[col]?.[rIdx];
                            const isFormula = raw.trim().startsWith('=');
                            return (
                              <td
                                key={col}
                                className="border-r border-[var(--border-subtle)] px-1.5 py-0.5 last:border-r-0"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <input
                                    type="text"
                                    value={raw}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSheetRows((prev) =>
                                        prev.map((r, idx) =>
                                          idx === rIdx ? { ...r, [col]: val } : r
                                        )
                                      );
                                    }}
                                    className="min-w-0 flex-1 bg-transparent py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                                  />
                                  {isFormula && Number.isFinite(evalVal) && (
                                    <span className="shrink-0 rounded bg-sky-600/15 px-1 text-[10px] font-bold text-sky-400">
                                      ={Number(evalVal.toFixed(2))}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Live 1-Var Stats Readout */}
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      1-Var Statistics Summary
                    </span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--text-muted)]">Column:</span>
                      {(['A', 'B', 'C', 'D'] as const).map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setStatsColKey(col)}
                          className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold cursor-pointer ${
                            statsColKey === col
                              ? 'bg-sky-600 text-white'
                              : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {col}:{colNames[col]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeOneVarStats ? (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 font-mono text-[11px] tabular-nums">
                      {[
                        ['n', String(activeOneVarStats.count)],
                        ['x̄ (Mean)', activeOneVarStats.mean.toFixed(3)],
                        ['sx (Sample)', activeOneVarStats.sampleStd.toFixed(3)],
                        ['σx (Pop)', activeOneVarStats.popStd.toFixed(3)],
                        ['Median', activeOneVarStats.median.toFixed(3)],
                        ['IQR', activeOneVarStats.iqr.toFixed(3)],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5"
                        >
                          <div className="text-[10px] text-[var(--text-muted)]">{k}</div>
                          <div className="font-bold text-[var(--text-primary)]">{v}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Enter numeric values in column {statsColKey} to compute 1-Var statistics.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ==================== 1.4 DATA & STATISTICS ==================== */}
            {activeApp === 'statistics' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1">
                    {(
                      [
                        ['scatter', 'Scatter + Regression'],
                        ['boxplot', 'Box Plot'],
                        ['histogram', 'Histogram'],
                        ['dotplot', 'Dot Plot'],
                      ] as const
                    ).map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setStatPlotType(kind)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          statPlotType === kind
                            ? 'bg-sky-600 text-white'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <span className="text-[var(--text-muted)]">X:</span>
                      <select
                        value={xListCol}
                        onChange={(e) => setXListCol(e.target.value as 'A' | 'B' | 'C' | 'D')}
                        className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)]"
                      >
                        {(['A', 'B', 'C', 'D'] as const).map((c) => (
                          <option key={c} value={c}>
                            {c}:{colNames[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {statPlotType === 'scatter' && (
                      <label className="flex items-center gap-1">
                        <span className="text-[var(--text-muted)]">Y:</span>
                        <select
                          value={yListCol}
                          onChange={(e) => setYListCol(e.target.value as 'A' | 'B' | 'C' | 'D')}
                          className="rounded border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)]"
                        >
                          {(['A', 'B', 'C', 'D'] as const).map((c) => (
                            <option key={c} value={c}>
                              {c}:{colNames[c]}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>

                {/* Regression Model Bar for Scatter */}
                {statPlotType === 'scatter' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          ['linear', 'Linear'],
                          ['quadratic', 'Quadratic'],
                          ['exponential', 'Exponential'],
                          ['power', 'Power'],
                          ['logarithmic', 'Logarithmic'],
                        ] as Array<[RegressionResult['kind'], string]>
                      ).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => setRegKind(kind)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                            regKind === kind
                              ? 'bg-emerald-600 text-white'
                              : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowMovableLine((v) => !v)}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          showMovableLine
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                        }`}
                      >
                        Movable Line
                      </button>
                      {activeRegression && (
                        <button
                          type="button"
                          onClick={() => {
                            setExternalGraphInject({
                              expr: activeRegression.formulaForGraph,
                              nonce: Date.now(),
                            });
                            setActiveApp('graphs');
                          }}
                          className="rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                        >
                          Plot in 1.2 Graph
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {statPlotType === 'histogram' && (
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">Histogram Bins: {histBins}</span>
                    <input
                      type="range"
                      min={3}
                      max={12}
                      value={histBins}
                      onChange={(e) => setHistBins(Number(e.target.value))}
                      className="w-40 accent-sky-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* Crisp SVG Plot Surface */}
                <div className="rounded-xl border border-[var(--border-strong)] bg-white p-3">
                  {statPlotType === 'scatter' && scatterPairs.length > 0 && (() => {
                    const W = 560;
                    const H = 260;
                    const pad = 38;
                    const xs = scatterPairs.map((p) => p.x);
                    const ys = scatterPairs.map((p) => p.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys, 0);
                    const maxY = Math.max(...ys);
                    const spanX = maxX - minX || 1;
                    const spanY = maxY - minY || 1;
                    const x0 = minX - spanX * 0.1;
                    const x1 = maxX + spanX * 0.1;
                    const y0 = minY - spanY * 0.12;
                    const y1 = maxY + spanY * 0.12;
                    const sx = (x: number) => pad + ((x - x0) / (x1 - x0)) * (W - 2 * pad);
                    const sy = (y: number) => H - pad - ((y - y0) / (y1 - y0)) * (H - 2 * pad);

                    let regPath = '';
                    if (activeRegression) {
                      const pts: string[] = [];
                      for (let i = 0; i <= 80; i++) {
                        const x = x0 + ((x1 - x0) * i) / 80;
                        const y = activeRegression.predict(x);
                        if (Number.isFinite(y)) {
                          pts.push(`${pts.length === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`);
                        }
                      }
                      regPath = pts.join(' ');
                    }

                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[250px] font-mono">
                        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#94a3b8" strokeWidth="1.2" />
                        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#94a3b8" strokeWidth="1.2" />
                        {regPath && (
                          <path d={regPath} fill="none" stroke="#059669" strokeWidth="2.4" />
                        )}
                        {showMovableLine && (
                          <line
                            x1={sx(x0)}
                            y1={sy(movableM * x0 + movableB)}
                            x2={sx(x1)}
                            y2={sy(movableM * x1 + movableB)}
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                          />
                        )}
                        {scatterPairs.map((p, i) => (
                          <g key={i}>
                            <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.2" />
                            <title>{`Row ${p.row}: (${p.x}, ${p.y})`}</title>
                          </g>
                        ))}
                        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">
                          {colNames[xListCol]}
                        </text>
                        <text x={14} y={H / 2} textAnchor="middle" fontSize="11" fill="#475569" transform={`rotate(-90 14 ${H / 2})`}>
                          {colNames[yListCol]}
                        </text>
                      </svg>
                    );
                  })()}

                  {statPlotType === 'boxplot' && activeXStats && (() => {
                    const W = 560;
                    const H = 180;
                    const pad = 42;
                    const span = activeXStats.max - activeXStats.min || 1;
                    const x0 = activeXStats.min - span * 0.1;
                    const x1 = activeXStats.max + span * 0.1;
                    const sx = (v: number) => pad + ((v - x0) / (x1 - x0)) * (W - 2 * pad);
                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[180px] font-mono">
                        <line x1={sx(activeXStats.min)} y1={85} x2={sx(activeXStats.q1)} y2={85} stroke="#334155" strokeWidth="2" />
                        <line x1={sx(activeXStats.q3)} y1={85} x2={sx(activeXStats.max)} y2={85} stroke="#334155" strokeWidth="2" />
                        <line x1={sx(activeXStats.min)} y1={68} x2={sx(activeXStats.min)} y2={102} stroke="#334155" strokeWidth="2" />
                        <line x1={sx(activeXStats.max)} y1={68} x2={sx(activeXStats.max)} y2={102} stroke="#334155" strokeWidth="2" />
                        <rect
                          x={sx(activeXStats.q1)}
                          y={56}
                          width={Math.max(4, sx(activeXStats.q3) - sx(activeXStats.q1))}
                          height={58}
                          fill="#bfdbfe"
                          stroke="#1d4ed8"
                          strokeWidth="2"
                        />
                        <line x1={sx(activeXStats.median)} y1={56} x2={sx(activeXStats.median)} y2={114} stroke="#dc2626" strokeWidth="2.5" />
                        {[
                          ['Min', activeXStats.min],
                          ['Q1', activeXStats.q1],
                          ['Med', activeXStats.median],
                          ['Q3', activeXStats.q3],
                          ['Max', activeXStats.max],
                        ].map(([lbl, val]) => (
                          <text key={String(lbl)} x={sx(Number(val))} y={142} textAnchor="middle" fontSize="10" fill="#334155">
                            {lbl}:{Number(val).toFixed(1)}
                          </text>
                        ))}
                      </svg>
                    );
                  })()}

                  {statPlotType === 'histogram' && activeXStats && (() => {
                    const nums = evaluatedSheet[xListCol].filter((v) => Number.isFinite(v));
                    const W = 560;
                    const H = 220;
                    const pad = 36;
                    const min = activeXStats.min;
                    const max = activeXStats.max + 1e-6;
                    const binW = (max - min) / histBins || 1;
                    const counts = Array.from({ length: histBins }, () => 0);
                    nums.forEach((v) => {
                      const idx = Math.min(histBins - 1, Math.floor((v - min) / binW));
                      counts[idx]++;
                    });
                    const maxC = Math.max(1, ...counts);
                    const barPxW = (W - 2 * pad) / histBins;
                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[210px] font-mono">
                        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#64748b" />
                        {counts.map((c, i) => {
                          const barH = (c / maxC) * (H - 2 * pad);
                          return (
                            <g key={i}>
                              <rect
                                x={pad + i * barPxW + 2}
                                y={H - pad - barH}
                                width={Math.max(4, barPxW - 4)}
                                height={barH}
                                fill="#3b82f6"
                              />
                              <text
                                x={pad + i * barPxW + barPxW / 2}
                                y={H - pad - barH - 4}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#1e293b"
                              >
                                {c}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })()}

                  {statPlotType === 'dotplot' && activeXStats && (() => {
                    const nums = evaluatedSheet[xListCol].filter((v) => Number.isFinite(v));
                    const W = 560;
                    const H = 160;
                    const pad = 38;
                    const span = activeXStats.max - activeXStats.min || 1;
                    const sx = (v: number) => pad + ((v - activeXStats.min) / span) * (W - 2 * pad);
                    const stackCounts = new Map<string, number>();
                    return (
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px] font-mono">
                        <line x1={pad} y1={H - 32} x2={W - pad} y2={H - 32} stroke="#64748b" strokeWidth="1.5" />
                        {nums.map((v, i) => {
                          const key = v.toFixed(2);
                          const stack = stackCounts.get(key) ?? 0;
                          stackCounts.set(key, stack + 1);
                          return (
                            <circle
                              key={i}
                              cx={sx(v)}
                              cy={H - 44 - stack * 14}
                              r="5"
                              fill="#2563eb"
                            />
                          );
                        })}
                      </svg>
                    );
                  })()}
                </div>

                {/* Regression Readout + Movable Line Sliders */}
                {statPlotType === 'scatter' && activeRegression && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-mono text-xs tabular-nums">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[var(--text-primary)]">
                        {activeRegression.equationLabel}
                      </span>
                      <span className="font-bold text-emerald-500">
                        R² = {activeRegression.rSquared.toFixed(5)}
                        {activeRegression.correlationR !== null
                          ? `  |  r = ${activeRegression.correlationR.toFixed(5)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                )}

                {statPlotType === 'scatter' && showMovableLine && (
                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 sm:grid-cols-3 font-mono text-xs">
                    <label className="flex items-center gap-2">
                      <span>m={movableM.toFixed(2)}</span>
                      <input
                        type="range"
                        min={-15}
                        max={15}
                        step={0.1}
                        value={movableM}
                        onChange={(e) => setMovableM(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span>b={movableB.toFixed(2)}</span>
                      <input
                        type="range"
                        min={-25}
                        max={40}
                        step={0.25}
                        value={movableB}
                        onChange={(e) => setMovableB(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                    </label>
                    <div className="flex items-center justify-end font-bold text-amber-400 tabular-nums">
                      SSR = {movableSsr.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== 1.5 NOTES (MATH BOX) ==================== */}
            {activeApp === 'notes' && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Notes Editor (wrap math in {'{{expr}}'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotesContent((prev) => `${prev}\n{{solve(x^2 - 16 = 0, x)}}`)}
                      className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-400 hover:border-sky-500 cursor-pointer"
                    >
                      + Insert Math Box
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 font-mono text-xs leading-relaxed text-[var(--text-primary)] focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Live Rendered Page
                  </span>
                  <div className="h-[268px] overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 space-y-2 text-xs">
                    {evaluatedNoteBlocks.map((block) =>
                      block.type === 'text' ? (
                        <p
                          key={block.id}
                          className={
                            block.raw.startsWith('#')
                              ? 'font-display text-sm font-bold text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] min-h-[14px]'
                          }
                        >
                          {block.raw.replace(/^#+\s*/, '')}
                        </p>
                      ) : (
                        <div
                          key={block.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 font-mono text-xs"
                        >
                          <span className="text-[var(--text-secondary)]">{block.expr}</span>
                          <span
                            className={`font-bold ${
                              block.isError ? 'text-red-500' : 'text-sky-400'
                            }`}
                          >
                            ⇒ {block.output}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== 1.6 PROGRAM EDITOR ==================== */}
            {activeApp === 'program' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(PROGRAM_SAMPLES).map(([key, sample]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedSampleKey(key);
                          setProgramSource(sample.code);
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                          selectedSampleKey === key
                            ? 'bg-sky-600 text-white'
                            : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {sample.title}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleRunProgram}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Script
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <textarea
                    rows={11}
                    value={programSource}
                    onChange={(e) => setProgramSource(e.target.value)}
                    spellCheck={false}
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-slate-950 p-3 font-mono text-xs leading-relaxed text-emerald-300 focus:border-sky-500 focus:outline-none"
                  />
                  <div className="flex flex-col rounded-lg border border-[var(--border-strong)] bg-slate-950 p-3 font-mono text-xs text-slate-200">
                    <div className="mb-2 border-b border-slate-800 pb-1 text-[11px] font-bold text-slate-400">
                      TI-Python / TI-Basic Shell Output
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1 max-h-[210px] tabular-nums">
                      {programOutput.map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                      {programError && (
                        <div className="text-red-400 font-semibold">Error: {programError}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== 1.7 FINANCE / TVM SOLVER ==================== */}
            {activeApp === 'tvm' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['N', 'N (Total Periods)', true],
                      ['I', 'I% (Annual Rate %)', true],
                      ['PV', 'PV (Present Value)', true],
                      ['PMT', 'PMT (Payment)', true],
                      ['FV', 'FV (Future Value)', true],
                      ['PpY', 'P/Y (Payments/Yr)', false],
                      ['CpY', 'C/Y (Compound/Yr)', false],
                    ] as Array<[keyof TvmInputs, string, boolean]>
                  ).map(([field, label, solvable]) => (
                    <div
                      key={field}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
                    >
                      <span className="w-36 text-xs font-semibold text-[var(--text-secondary)]">
                        {label}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={tvm[field]}
                        onChange={(e) =>
                          setTvm((prev) => ({ ...prev, [field]: Number(e.target.value) }))
                        }
                        className="min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-mono text-xs font-bold text-[var(--text-primary)] tabular-nums"
                      />
                      {solvable && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSolveTvm(field as 'N' | 'I' | 'PV' | 'PMT' | 'FV')
                          }
                          className="rounded bg-sky-600 px-2.5 py-1 font-mono text-[11px] font-bold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                        >
                          Solve
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-xs tabular-nums">
                  <span className="text-[var(--text-secondary)]">
                    Total Cash Flow:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {(tvm.PMT * tvm.N).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </strong>{' '}
                    | Net Interest:{' '}
                    <strong className="text-amber-400">
                      {(Math.abs(tvm.PMT * tvm.N) - Math.abs(tvm.PV)).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                  {tvmLastSolved && <span className="text-emerald-400 font-bold">{tvmLastSolved}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ==================== EEVEE MATHEMATICAL FEEDBACK & DATA ANALYSIS DOCK ==================== */}
        <div className="rounded-xl border border-red-500/35 bg-[var(--bg-elevated)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent-text)] shrink-0" />
              <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                The Anomalous Eevee — Math & Data Feedback
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAnalyzeOnEval}
                  onChange={(e) => setAutoAnalyzeOnEval(e.target.checked)}
                  className="accent-red-600 cursor-pointer"
                />
                Auto-Analyze on Eval
              </label>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => void analyzeWithEevee()}
                className="min-h-[34px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {isAnalyzing ? t.calcAnalyzing : t.calcAnalyzeBtn}
              </button>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void analyzeWithEevee();
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={eeveeQuestion}
              onChange={(e) => setEeveeQuestion(e.target.value)}
              placeholder={t.calcAskPlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-red-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendSnapshotToFreeChat}
              className="min-h-[34px] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-red-500/50 cursor-pointer whitespace-nowrap"
            >
              {t.calcDiscussInChat}
            </button>
          </form>

          {analysisError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {analysisError}
            </div>
          )}

          {analysis ? (
            <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                <span>
                  {analysis.activeForm} · {analysis.activePlate} · Tera {analysis.activeTera}
                  {analysis.moveUsed ? ` · ${analysis.moveUsed}` : ''}
                </span>
                <span>{analysis.analyzedAt}</span>
              </div>

              <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                {renderFormattedFeedback(analysis.feedback)}
              </p>

              {analysis.insights.length > 0 && (
                <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-secondary)] list-disc pl-4">
                  {analysis.insights.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}

              {analysis.suggestedCommand && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2">
                  <div className="min-w-0 font-mono text-xs text-sky-400 truncate">
                    Suggested CAS Check: <strong className="text-[var(--text-primary)]">{analysis.suggestedCommand}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => executeCasExpression(analysis.suggestedCommand!)}
                    className="rounded-md bg-sky-600 px-3 py-1 font-mono text-xs font-bold text-white hover:bg-sky-500 cursor-pointer whitespace-nowrap"
                  >
                    Run Suggested Command
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Run CAS equations, explore slope fields or regressions, solve TVM cash flows, or write scripts—then click{' '}
              <strong className="text-[var(--text-primary)]">{t.calcAnalyzeBtn}</strong> so The Anomalous Eevee inspects every number, derivative, residual, and edge case.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

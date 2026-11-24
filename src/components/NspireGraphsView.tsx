import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Table2, Trash2 } from 'lucide-react';
import {
  compileRealFunction,
  type AngleMode,
  type VariableBinding,
} from '../utils/nspireCasEngine';

export type GraphPlotMode = 'function' | 'parametric' | 'polar' | 'sequence' | 'diffeq';
export type AnalyzeTool = 'trace' | 'zero' | 'minimum' | 'maximum' | 'intersect' | 'dydx' | 'integral';
export type GeometryTool = 'none' | 'point' | 'segment' | 'circle' | 'triangle';

export interface FunctionSlot {
  id: string;
  label: string;
  expr: string;
  color: string;
  visible: boolean;
}

export interface GeometryPoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GeometryShape {
  id: string;
  type: 'point' | 'segment' | 'circle' | 'triangle';
  points: GeometryPoint[];
}

export interface GraphSnapshot {
  plotMode: GraphPlotMode;
  functions: Array<{ label: string; expr: string; visible: boolean }>;
  parametric: { xExpr: string; yExpr: string; tMin: number; tMax: number };
  polar: { rExpr: string; thetaMin: number; thetaMax: number };
  sequence: { uExpr: string; nMax: number };
  diffeq: { dyExpr: string; x0: number; y0: number };
  window: { xMin: number; xMax: number; yMin: number; yMax: number };
  sliders: { a: number; b: number; k: number };
  activeAnalyzeTool: AnalyzeTool;
  analysisSummary: string | null;
  geometrySummary: string[];
}

interface NspireGraphsViewProps {
  angleMode: AngleMode;
  variables: Record<string, VariableBinding>;
  externalFunctionInject?: { expr: string; nonce: number } | null;
  onSnapshotChange?: (snapshot: GraphSnapshot) => void;
}

const DEFAULT_FUNCTIONS: FunctionSlot[] = [
  { id: 'f1', label: 'f1(x)', expr: 'a * sin(b * x) + 0.25 * k * x', color: '#2563eb', visible: true },
  { id: 'f2', label: 'f2(x)', expr: '0.2 * x^2 - 2', color: '#dc2626', visible: true },
  { id: 'f3', label: 'f3(x)', expr: 'cos(x)', color: '#059669', visible: false },
];

export const NspireGraphsView: React.FC<NspireGraphsViewProps> = ({
  angleMode,
  variables,
  externalFunctionInject,
  onSnapshotChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [plotMode, setPlotMode] = useState<GraphPlotMode>('function');
  const [functions, setFunctions] = useState<FunctionSlot[]>(DEFAULT_FUNCTIONS);

  // Parametric / Polar / Sequence / DiffEq expressions
  const [paramX, setParamX] = useState('4 * cos(t)');
  const [paramY, setParamY] = useState('3 * sin(2 * t)');
  const [tMin, setTMin] = useState(0);
  const [tMax, setTMax] = useState(6.2832);

  const [polarR, setPolarR] = useState('3 * cos(3 * theta) + a');
  const [thetaMax, setThetaMax] = useState(6.2832);

  const [seqExpr, setSeqExpr] = useState('10 * (0.75)^n');
  const [seqMaxN, setSeqMaxN] = useState(18);

  const [diffEqExpr, setDiffEqExpr] = useState('0.35 * y * (1 - y / 5)');
  const [diffX0, setDiffX0] = useState(-4);
  const [diffY0, setDiffY0] = useState(0.5);

  // Window bounds
  const [win, setWin] = useState({ xMin: -10, xMax: 10, yMin: -6.5, yMax: 6.5 });

  // Parameter sliders a, b, k
  const [sliders, setSliders] = useState({ a: 2, b: 1, k: 0.5 });
  const [animatingSlider, setAnimatingSlider] = useState<'a' | 'b' | 'k' | null>(null);

  // Analyze Graph tools
  const [analyzeTool, setAnalyzeTool] = useState<AnalyzeTool>('trace');
  const [targetSlotIdx, setTargetSlotIdx] = useState<number>(0);
  const [traceX, setTraceX] = useState<number>(1.2);
  const [integralBounds, setIntegralBounds] = useState<{ lower: number; upper: number }>({
    lower: -2,
    upper: 2,
  });

  // Table & Geometry
  const [showTable, setShowTable] = useState(false);
  const [tableStart, setTableStart] = useState(-3);
  const [tableStep, setTableStep] = useState(1);

  const [geometryTool, setGeometryTool] = useState<GeometryTool>('none');
  const [pendingGeomPts, setPendingGeomPts] = useState<GeometryPoint[]>([]);
  const [shapes, setShapes] = useState<GeometryShape[]>([]);

  // Hover coordinates
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    dragging: boolean;
    lastPx: number;
    lastPy: number;
    moved: boolean;
  }>({ dragging: false, lastPx: 0, lastPy: 0, moved: false });

  // Inject regression or external equation into f3 or f1
  useEffect(() => {
    if (!externalFunctionInject?.expr) return;
    setPlotMode('function');
    setFunctions((prev) =>
      prev.map((slot, idx) =>
        idx === 1
          ? { ...slot, expr: externalFunctionInject.expr, visible: true }
          : slot
      )
    );
  }, [externalFunctionInject]);

  // Animate selected slider smoothly
  useEffect(() => {
    if (!animatingSlider) return;
    let rafId = 0;
    let t = 0;
    const step = () => {
      t += 0.03;
      setSliders((prev) => ({
        ...prev,
        [animatingSlider]: Number((2.5 * Math.sin(t) + (animatingSlider === 'b' ? 2.5 : 0)).toFixed(2)),
      }));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [animatingSlider]);

  const scopeVars = useMemo<Record<string, number>>(
    () => ({
      a: sliders.a,
      b: sliders.b,
      k: sliders.k,
    }),
    [sliders]
  );

  const compiledFunctions = useMemo(
    () =>
      functions.map((slot) =>
        slot.visible ? compileRealFunction(slot.expr, angleMode, variables) : null
      ),
    [functions, angleMode, variables]
  );

  const compiledParamX = useMemo(
    () => compileRealFunction(paramX, angleMode, variables),
    [paramX, angleMode, variables]
  );
  const compiledParamY = useMemo(
    () => compileRealFunction(paramY, angleMode, variables),
    [paramY, angleMode, variables]
  );
  const compiledPolarR = useMemo(
    () => compileRealFunction(polarR, angleMode, variables),
    [polarR, angleMode, variables]
  );
  const compiledSeq = useMemo(
    () => compileRealFunction(seqExpr, angleMode, variables),
    [seqExpr, angleMode, variables]
  );
  const compiledDiffEq = useMemo(
    () => compileRealFunction(diffEqExpr, angleMode, variables),
    [diffEqExpr, angleMode, variables]
  );

  // Numerical analysis readout for active Analyze Graph tool
  const analysisResult = useMemo(() => {
    if (plotMode !== 'function') return null;
    const fn = compiledFunctions[targetSlotIdx] ?? compiledFunctions.find(Boolean);
    const activeSlot = compiledFunctions[targetSlotIdx]
      ? functions[targetSlotIdx]
      : functions[compiledFunctions.findIndex(Boolean)];
    if (!fn || !activeSlot) return null;

    const evalAt = (x: number) => fn({ ...scopeVars, x });

    if (analyzeTool === 'trace') {
      const y = evalAt(traceX);
      return {
        label: `Trace ${activeSlot.label}`,
        text: Number.isFinite(y) ? `(${traceX.toFixed(3)}, ${y.toFixed(4)})` : `(${traceX.toFixed(3)}, undef)`,
        marker: Number.isFinite(y) ? { x: traceX, y } : null,
      };
    }

    if (analyzeTool === 'zero') {
      const samples = 240;
      const dx = (win.xMax - win.xMin) / samples;
      let bestRoot: number | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < samples; i++) {
        const x1 = win.xMin + i * dx;
        const x2 = x1 + dx;
        const y1 = evalAt(x1);
        const y2 = evalAt(x2);
        if (Number.isFinite(y1) && Number.isFinite(y2) && y1 * y2 <= 0) {
          let lo = x1;
          let hi = x2;
          let fLo = y1;
          for (let it = 0; it < 28; it++) {
            const mid = 0.5 * (lo + hi);
            const fMid = evalAt(mid);
            if (fLo * fMid <= 0) {
              hi = mid;
            } else {
              lo = mid;
              fLo = fMid;
            }
          }
          const root = 0.5 * (lo + hi);
          const dist = Math.abs(root - traceX);
          if (dist < bestDist) {
            bestDist = dist;
            bestRoot = root;
          }
        }
      }
      return bestRoot !== null
        ? {
            label: `Zero of ${activeSlot.label}`,
            text: `x = ${bestRoot.toFixed(5)}, y = 0`,
            marker: { x: bestRoot, y: 0 },
          }
        : { label: 'Zero', text: 'No real root found in current window', marker: null };
    }

    if (analyzeTool === 'minimum' || analyzeTool === 'maximum') {
      const samples = 300;
      const dx = (win.xMax - win.xMin) / samples;
      let bestX = NaN;
      let bestY = analyzeTool === 'minimum' ? Infinity : -Infinity;
      for (let i = 0; i <= samples; i++) {
        const x = win.xMin + i * dx;
        const y = evalAt(x);
        if (!Number.isFinite(y)) continue;
        if (analyzeTool === 'minimum' ? y < bestY : y > bestY) {
          bestY = y;
          bestX = x;
        }
      }
      if (!Number.isFinite(bestX)) {
        return { label: analyzeTool, text: 'Undefined on window', marker: null };
      }
      return {
        label: `${analyzeTool === 'minimum' ? 'Min' : 'Max'} of ${activeSlot.label}`,
        text: `(${bestX.toFixed(4)}, ${bestY.toFixed(4)})`,
        marker: { x: bestX, y: bestY },
      };
    }

    if (analyzeTool === 'intersect') {
      const fnA = compiledFunctions[0];
      const fnB = compiledFunctions[1];
      if (!fnA || !fnB) {
        return { label: 'Intersect', text: 'Enable f1(x) and f2(x) to find intersection', marker: null };
      }
      const diff = (x: number) => fnA({ ...scopeVars, x }) - fnB({ ...scopeVars, x });
      const samples = 240;
      const dx = (win.xMax - win.xMin) / samples;
      let bestX: number | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < samples; i++) {
        const x1 = win.xMin + i * dx;
        const x2 = x1 + dx;
        const d1 = diff(x1);
        const d2 = diff(x2);
        if (Number.isFinite(d1) && Number.isFinite(d2) && d1 * d2 <= 0) {
          let lo = x1;
          let hi = x2;
          let fLo = d1;
          for (let it = 0; it < 28; it++) {
            const mid = 0.5 * (lo + hi);
            const fMid = diff(mid);
            if (fLo * fMid <= 0) {
              hi = mid;
            } else {
              lo = mid;
              fLo = fMid;
            }
          }
          const root = 0.5 * (lo + hi);
          const dist = Math.abs(root - traceX);
          if (dist < bestDist) {
            bestDist = dist;
            bestX = root;
          }
        }
      }
      if (bestX === null) {
        return { label: 'Intersect', text: 'No f1=f2 crossing in current window', marker: null };
      }
      const yVal = fnA({ ...scopeVars, x: bestX });
      return {
        label: 'Intersection f1 ∩ f2',
        text: `(${bestX.toFixed(4)}, ${yVal.toFixed(4)})`,
        marker: { x: bestX, y: yVal },
      };
    }

    if (analyzeTool === 'dydx') {
      const h = 1e-4;
      const y = evalAt(traceX);
      const slope = (evalAt(traceX + h) - evalAt(traceX - h)) / (2 * h);
      return Number.isFinite(y) && Number.isFinite(slope)
        ? {
            label: `dy/dx at x=${traceX.toFixed(2)}`,
            text: `Slope = ${slope.toFixed(4)}`,
            marker: { x: traceX, y },
            tangentSlope: slope,
          }
        : { label: 'dy/dx', text: 'Derivative undefined at point', marker: null };
    }

    // integral via composite Simpson's rule
    const lo = Math.min(integralBounds.lower, integralBounds.upper);
    const hi = Math.max(integralBounds.lower, integralBounds.upper);
    const sign = integralBounds.upper >= integralBounds.lower ? 1 : -1;
    const N = 120;
    const h = (hi - lo) / N;
    let sum = 0;
    let valid = true;
    for (let i = 0; i <= N; i++) {
      const x = lo + i * h;
      const y = evalAt(x);
      if (!Number.isFinite(y)) {
        valid = false;
        break;
      }
      const weight = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
      sum += weight * y;
    }
    const integralVal = valid ? sign * ((h / 3) * sum) : NaN;
    return {
      label: `∫ ${activeSlot.label} dx [${integralBounds.lower.toFixed(2)}, ${integralBounds.upper.toFixed(2)}]`,
      text: Number.isFinite(integralVal) ? `= ${integralVal.toFixed(5)}` : 'Integral undefined on interval',
      marker: null,
    };
  }, [
    plotMode,
    compiledFunctions,
    functions,
    targetSlotIdx,
    scopeVars,
    analyzeTool,
    traceX,
    win.xMin,
    win.xMax,
    integralBounds,
  ]);

  // Compute readable Geometry summary lines
  const geometrySummaries = useMemo(() => {
    return shapes.map((shape, idx) => {
      const pts = shape.points;
      if (shape.type === 'point' && pts[0]) {
        return `P${idx + 1}: (${pts[0].x.toFixed(2)}, ${pts[0].y.toFixed(2)})`;
      }
      if (shape.type === 'segment' && pts.length === 2) {
        const len = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const dx = pts[1].x - pts[0].x;
        const slope = Math.abs(dx) < 1e-6 ? '∞' : ((pts[1].y - pts[0].y) / dx).toFixed(3);
        return `Seg${idx + 1}: L=${len.toFixed(3)}, m=${slope}`;
      }
      if (shape.type === 'circle' && pts.length === 2) {
        const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        return `Circ${idx + 1}: r=${r.toFixed(3)}, Area=${(Math.PI * r * r).toFixed(3)}`;
      }
      if (shape.type === 'triangle' && pts.length === 3) {
        const [p1, p2, p3] = pts;
        const a = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const b = Math.hypot(p3.x - p2.x, p3.y - p2.y);
        const c = Math.hypot(p1.x - p3.x, p1.y - p3.y);
        const area =
          0.5 * Math.abs(p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
        return `Tri${idx + 1}: Area=${area.toFixed(3)}, Perim=${(a + b + c).toFixed(3)}`;
      }
      return `Shape ${idx + 1}`;
    });
  }, [shapes]);

  // Notify parent snapshot when key graph states change
  useEffect(() => {
    if (!onSnapshotChange) return;
    onSnapshotChange({
      plotMode,
      functions: functions.map(({ label, expr, visible }) => ({ label, expr, visible })),
      parametric: { xExpr: paramX, yExpr: paramY, tMin, tMax },
      polar: { rExpr: polarR, thetaMin: 0, thetaMax },
      sequence: { uExpr: seqExpr, nMax: seqMaxN },
      diffeq: { dyExpr: diffEqExpr, x0: diffX0, y0: diffY0 },
      window: win,
      sliders,
      activeAnalyzeTool: analyzeTool,
      analysisSummary: analysisResult ? `${analysisResult.label}: ${analysisResult.text}` : null,
      geometrySummary: geometrySummaries,
    });
  }, [
    onSnapshotChange,
    plotMode,
    functions,
    paramX,
    paramY,
    tMin,
    tMax,
    polarR,
    thetaMax,
    seqExpr,
    seqMaxN,
    diffEqExpr,
    diffX0,
    diffY0,
    win,
    sliders,
    analyzeTool,
    analysisResult,
    geometrySummaries,
  ]);

  // Draw HiDPI canvas graph
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    const toPxX = (x: number) => ((x - win.xMin) / (win.xMax - win.xMin)) * w;
    const toPxY = (y: number) => h - ((y - win.yMin) / (win.yMax - win.yMin)) * h;

    // Crisp light TI-Nspire LCD coordinate canvas background
    ctx.fillStyle = '#fcfdff';
    ctx.fillRect(0, 0, w, h);

    // Compute clean grid step
    const pickStep = (span: number) => {
      const raw = span / 10;
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / pow10;
      if (norm < 1.5) return pow10;
      if (norm < 3.5) return 2 * pow10;
      if (norm < 7.5) return 5 * pow10;
      return 10 * pow10;
    };

    const stepX = pickStep(win.xMax - win.xMin);
    const stepY = pickStep(win.yMax - win.yMin);

    // Grid lines
    ctx.strokeStyle = '#e5ecf6';
    ctx.lineWidth = 1;
    const startGridX = Math.ceil(win.xMin / stepX) * stepX;
    for (let gx = startGridX; gx <= win.xMax; gx += stepX) {
      const px = toPxX(gx);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
    const startGridY = Math.ceil(win.yMin / stepY) * stepY;
    for (let gy = startGridY; gy <= win.yMax; gy += stepY) {
      const py = toPxY(gy);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Axes
    const originX = toPxX(0);
    const originY = toPxY(0);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    if (originX >= 0 && originX <= w) {
      ctx.beginPath();
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, h);
      ctx.stroke();
    }
    if (originY >= 0 && originY <= h) {
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(w, originY);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    for (let gx = startGridX; gx <= win.xMax; gx += stepX) {
      if (Math.abs(gx) < 1e-9) continue;
      const px = toPxX(gx);
      const labelY = Math.min(Math.max(originY + 12, 12), h - 4);
      ctx.fillText(Number(gx.toFixed(2)).toString(), px + 2, labelY);
    }
    for (let gy = startGridY; gy <= win.yMax; gy += stepY) {
      if (Math.abs(gy) < 1e-9) continue;
      const py = toPxY(gy);
      const labelX = Math.min(Math.max(originX + 4, 4), w - 28);
      ctx.fillText(Number(gy.toFixed(2)).toString(), labelX, py - 2);
    }

    // Function plotting
    if (plotMode === 'function') {
      // If Integral tool selected, shade definite integral first
      const activeFn = compiledFunctions[targetSlotIdx] ?? compiledFunctions.find(Boolean);
      if (analyzeTool === 'integral' && activeFn) {
        const lo = Math.min(integralBounds.lower, integralBounds.upper);
        const hi = Math.max(integralBounds.lower, integralBounds.upper);
        ctx.save();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
        ctx.beginPath();
        ctx.moveTo(toPxX(lo), toPxY(0));
        const shadeSteps = 120;
        for (let i = 0; i <= shadeSteps; i++) {
          const x = lo + ((hi - lo) * i) / shadeSteps;
          const y = activeFn({ ...scopeVars, x });
          if (Number.isFinite(y)) {
            ctx.lineTo(toPxX(x), toPxY(y));
          }
        }
        ctx.lineTo(toPxX(hi), toPxY(0));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      functions.forEach((slot, idx) => {
        const fn = compiledFunctions[idx];
        if (!slot.visible || !fn) return;
        ctx.strokeStyle = slot.color;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        let penDown = false;
        let prevY = NaN;
        const samples = Math.max(360, Math.round(w));
        for (let i = 0; i <= samples; i++) {
          const x = win.xMin + ((win.xMax - win.xMin) * i) / samples;
          const y = fn({ ...scopeVars, x });
          if (!Number.isFinite(y) || Math.abs(y) > 1e5) {
            penDown = false;
            prevY = NaN;
            continue;
          }
          const px = toPxX(x);
          const py = toPxY(y);
          // Break asymptote jumps
          if (penDown && Number.isFinite(prevY) && Math.abs(y - prevY) > (win.yMax - win.yMin) * 1.6) {
            penDown = false;
          }
          if (!penDown) {
            ctx.moveTo(px, py);
            penDown = true;
          } else {
            ctx.lineTo(px, py);
          }
          prevY = y;
        }
        ctx.stroke();
      });

      // Draw tangent line or analysis marker
      if (analysisResult?.marker) {
        const { x, y } = analysisResult.marker;
        const px = toPxX(x);
        const py = toPxY(y);

        if (analyzeTool === 'dydx' && typeof analysisResult.tangentSlope === 'number') {
          const m = analysisResult.tangentSlope;
          const x1 = win.xMin;
          const y1 = y + m * (x1 - x);
          const x2 = win.xMax;
          const y2 = y + m * (x2 - x);
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.75;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(toPxX(x1), toPxY(y1));
          ctx.lineTo(toPxX(x2), toPxY(y2));
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (plotMode === 'parametric' && compiledParamX && compiledParamY) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      const steps = 400;
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const t = tMin + ((tMax - tMin) * i) / steps;
        const x = compiledParamX({ ...scopeVars, t });
        const y = compiledParamY({ ...scopeVars, t });
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(toPxX(x), toPxY(y));
          started = true;
        } else {
          ctx.lineTo(toPxX(x), toPxY(y));
        }
      }
      ctx.stroke();
    } else if (plotMode === 'polar' && compiledPolarR) {
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      const steps = 480;
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const theta = (thetaMax * i) / steps;
        const r = compiledPolarR({ ...scopeVars, theta, t: theta });
        if (!Number.isFinite(r)) {
          started = false;
          continue;
        }
        const radAngle = angleMode === 'DEG' ? (theta * Math.PI) / 180 : theta;
        const x = r * Math.cos(radAngle);
        const y = r * Math.sin(radAngle);
        if (!started) {
          ctx.moveTo(toPxX(x), toPxY(y));
          started = true;
        } else {
          ctx.lineTo(toPxX(x), toPxY(y));
        }
      }
      ctx.stroke();
    } else if (plotMode === 'sequence' && compiledSeq) {
      for (let n = 0; n <= seqMaxN; n++) {
        const val = compiledSeq({ ...scopeVars, n });
        if (!Number.isFinite(val)) continue;
        const px = toPxX(n);
        const py = toPxY(val);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px, toPxY(0));
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (plotMode === 'diffeq' && compiledDiffEq) {
      // Draw Slope Field ticks
      const cols = 20;
      const rows = 14;
      const dxCell = (win.xMax - win.xMin) / cols;
      const dyCell = (win.yMax - win.yMin) / rows;
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.25;
      for (let ic = 0; ic <= cols; ic++) {
        for (let ir = 0; ir <= rows; ir++) {
          const x = win.xMin + ic * dxCell;
          const y = win.yMin + ir * dyCell;
          const slope = compiledDiffEq({ ...scopeVars, x, y });
          if (!Number.isFinite(slope)) continue;
          const px = toPxX(x);
          const py = toPxY(y);
          // Scale angle visually in pixel aspect
          const pixelSlope =
            (-slope * (win.xMax - win.xMin) * h) / ((win.yMax - win.yMin) * w);
          const angle = Math.atan(pixelSlope);
          const segLen = 9;
          ctx.beginPath();
          ctx.moveTo(px - segLen * Math.cos(angle), py - segLen * Math.sin(angle));
          ctx.lineTo(px + segLen * Math.cos(angle), py + segLen * Math.sin(angle));
          ctx.stroke();
        }
      }

      // RK4 forward and backward particular solution through (diffX0, diffY0)
      const traceRk4 = (dir: 1 | -1) => {
        const pts: Array<[number, number]> = [[diffX0, diffY0]];
        let x = diffX0;
        let y = diffY0;
        const step = dir * ((win.xMax - win.xMin) / 220);
        for (let s = 0; s < 260; s++) {
          if (x < win.xMin - 2 || x > win.xMax + 2 || Math.abs(y) > 1e4) break;
          const k1 = compiledDiffEq({ ...scopeVars, x, y });
          const k2 = compiledDiffEq({ ...scopeVars, x: x + step / 2, y: y + (step / 2) * k1 });
          const k3 = compiledDiffEq({ ...scopeVars, x: x + step / 2, y: y + (step / 2) * k2 });
          const k4 = compiledDiffEq({ ...scopeVars, x: x + step, y: y + step * k3 });
          const nextY = y + (step / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
          if (!Number.isFinite(nextY)) break;
          x += step;
          y = nextY;
          pts.push([x, y]);
        }
        return pts;
      };
      const fwd = traceRk4(1);
      const bwd = traceRk4(-1).reverse();
      const fullCurve = [...bwd, ...fwd.slice(1)];
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      fullCurve.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(toPxX(x), toPxY(y));
        else ctx.lineTo(toPxX(x), toPxY(y));
      });
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(toPxX(diffX0), toPxY(diffY0), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Geometry Overlay Shapes
    shapes.forEach((shape) => {
      const pts = shape.points;
      ctx.strokeStyle = '#b91c1c';
      ctx.fillStyle = 'rgba(220, 38, 38, 0.12)';
      ctx.lineWidth = 2;

      if (shape.type === 'segment' && pts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(toPxX(pts[0].x), toPxY(pts[0].y));
        ctx.lineTo(toPxX(pts[1].x), toPxY(pts[1].y));
        ctx.stroke();
      } else if (shape.type === 'circle' && pts.length === 2) {
        const cx = toPxX(pts[0].x);
        const cy = toPxY(pts[0].y);
        const rx = Math.hypot(toPxX(pts[1].x) - cx, toPxY(pts[1].y) - cy);
        ctx.beginPath();
        ctx.arc(cx, cy, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'triangle' && pts.length === 3) {
        ctx.beginPath();
        ctx.moveTo(toPxX(pts[0].x), toPxY(pts[0].y));
        ctx.lineTo(toPxX(pts[1].x), toPxY(pts[1].y));
        ctx.lineTo(toPxX(pts[2].x), toPxY(pts[2].y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      pts.forEach((p) => {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(toPxX(p.x), toPxY(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Pending geometry preview points
    pendingGeomPts.forEach((p) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(toPxX(p.x), toPxY(p.y), 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Crosshair hover guide
    if (hoverCoord) {
      const hpx = toPxX(hoverCoord.x);
      const hpy = toPxY(hoverCoord.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hpx, 0);
      ctx.lineTo(hpx, h);
      ctx.moveTo(0, hpy);
      ctx.lineTo(w, hpy);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    win,
    plotMode,
    functions,
    compiledFunctions,
    compiledParamX,
    compiledParamY,
    tMin,
    tMax,
    compiledPolarR,
    thetaMax,
    angleMode,
    compiledSeq,
    seqMaxN,
    compiledDiffEq,
    diffX0,
    diffY0,
    scopeVars,
    analyzeTool,
    targetSlotIdx,
    integralBounds,
    analysisResult,
    shapes,
    pendingGeomPts,
    hoverCoord,
  ]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const clientToGraphCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const x = win.xMin + (px / rect.width) * (win.xMax - win.xMin);
    const y = win.yMax - (py / rect.height) * (win.yMax - win.yMin);
    return { x, y, px, py, rect };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragRef.current = { dragging: true, lastPx: e.clientX, lastPy: e.clientY, moved: false };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coord = clientToGraphCoords(e.clientX, e.clientY);
    if (coord) {
      setHoverCoord({ x: coord.x, y: coord.y });
    }
    if (!dragRef.current.dragging || !coord) return;
    const dxPx = e.clientX - dragRef.current.lastPx;
    const dyPx = e.clientY - dragRef.current.lastPy;
    if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) {
      dragRef.current.moved = true;
    }
    dragRef.current.lastPx = e.clientX;
    dragRef.current.lastPy = e.clientY;

    const dxWorld = -(dxPx / coord.rect.width) * (win.xMax - win.xMin);
    const dyWorld = (dyPx / coord.rect.height) * (win.yMax - win.yMin);
    setWin((prev) => ({
      xMin: prev.xMin + dxWorld,
      xMax: prev.xMax + dxWorld,
      yMin: prev.yMin + dyWorld,
      yMax: prev.yMax + dyWorld,
    }));
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.dragging = false;
    if (wasMoved) return;

    const coord = clientToGraphCoords(e.clientX, e.clientY);
    if (!coord) return;

    if (geometryTool !== 'none') {
      const pt: GeometryPoint = {
        id: `pt-${Date.now()}`,
        label: `P${pendingGeomPts.length + 1}`,
        x: coord.x,
        y: coord.y,
      };
      const needed =
        geometryTool === 'point' ? 1 : geometryTool === 'triangle' ? 3 : 2;
      const nextPts = [...pendingGeomPts, pt];
      if (nextPts.length >= needed) {
        setShapes((prev) => [
          ...prev,
          { id: `shape-${Date.now()}`, type: geometryTool, points: nextPts },
        ]);
        setPendingGeomPts([]);
      } else {
        setPendingGeomPts(nextPts);
      }
      return;
    }

    // Update trace anchor x or DiffEq initial value on click
    if (plotMode === 'diffeq') {
      setDiffX0(Number(coord.x.toFixed(2)));
      setDiffY0(Number(coord.y.toFixed(2)));
    } else {
      setTraceX(Number(coord.x.toFixed(3)));
    }
  };

  const handleZoom = (factor: number) => {
    const cx = (win.xMin + win.xMax) / 2;
    const cy = (win.yMin + win.yMax) / 2;
    const halfW = ((win.xMax - win.xMin) / 2) * factor;
    const halfH = ((win.yMax - win.yMin) / 2) * factor;
    setWin({
      xMin: cx - halfW,
      xMax: cx + halfW,
      yMin: cy - halfH,
      yMax: cy + halfH,
    });
  };

  // Value Table rows (Ctrl+T)
  const tableRows = useMemo(() => {
    const rows: Array<{ x: number; ys: Array<number | null> }> = [];
    for (let i = 0; i < 12; i++) {
      const x = tableStart + i * tableStep;
      const ys = compiledFunctions.map((fn) => {
        if (!fn) return null;
        const val = fn({ ...scopeVars, x });
        return Number.isFinite(val) ? val : null;
      });
      rows.push({ x, ys });
    }
    return rows;
  }, [tableStart, tableStep, compiledFunctions, scopeVars]);

  return (
    <div className="space-y-3">
      {/* Mode & Window Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1">
          {(
            [
              ['function', 'Function f(x)'],
              ['parametric', 'Parametric'],
              ['polar', 'Polar r(θ)'],
              ['sequence', 'Sequence u(n)'],
              ['diffeq', "DiffEq y'"],
            ] as Array<[GraphPlotMode, string]>
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPlotMode(mode)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                plotMode === mode
                  ? 'bg-sky-600 text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleZoom(0.75)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
          >
            Zoom In
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.33)}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
          >
            Zoom Out
          </button>
          <button
            type="button"
            onClick={() => setWin({ xMin: -10, xMax: 10, yMin: -6.5, yMax: 6.5 })}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3 w-3" />
            Std
          </button>
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold cursor-pointer whitespace-nowrap ${
              showTable
                ? 'border-sky-500 bg-sky-600/15 text-sky-400'
                : 'border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <Table2 className="h-3 w-3" />
            Ctrl+T Table
          </button>
        </div>
      </div>

      {/* Entry Bar(s) for active Graph Mode */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 space-y-2">
        {plotMode === 'function' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {functions.map((slot, idx) => (
              <div key={slot.id} className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1">
                <input
                  type="checkbox"
                  checked={slot.visible}
                  onChange={(e) =>
                    setFunctions((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, visible: e.target.checked } : f))
                    )
                  }
                  aria-label={`Toggle ${slot.label}`}
                  className="cursor-pointer accent-sky-600"
                />
                <span
                  className="font-mono text-xs font-bold shrink-0"
                  style={{ color: slot.color }}
                >
                  {slot.label}=
                </span>
                <input
                  type="text"
                  value={slot.expr}
                  onChange={(e) =>
                    setFunctions((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, expr: e.target.value } : f))
                    )
                  }
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {plotMode === 'parametric' && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-mono text-xs">
              <span className="text-sky-500 font-bold">x1(t)=</span>
              <input value={paramX} onChange={(e) => setParamX(e.target.value)} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-mono text-xs">
              <span className="text-sky-500 font-bold">y1(t)=</span>
              <input value={paramY} onChange={(e) => setParamY(e.target.value)} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">tMin</span>
              <input type="number" step="0.5" value={tMin} onChange={(e) => setTMin(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">tMax</span>
              <input type="number" step="0.5" value={tMax} onChange={(e) => setTMax(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
          </div>
        )}

        {plotMode === 'polar' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-violet-500 font-bold">r1(theta)=</span>
              <input value={polarR} onChange={(e) => setPolarR(e.target.value)} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">thetaMax=</span>
              <input type="number" step="0.5" value={thetaMax} onChange={(e) => setThetaMax(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
          </div>
        )}

        {plotMode === 'sequence' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-emerald-500 font-bold">u1(n)=</span>
              <input value={seqExpr} onChange={(e) => setSeqExpr(e.target.value)} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">nMax=</span>
              <input type="number" min={2} max={60} value={seqMaxN} onChange={(e) => setSeqMaxN(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
          </div>
        )}

        {plotMode === 'diffeq' && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-red-500 font-bold">y'=</span>
              <input value={diffEqExpr} onChange={(e) => setDiffEqExpr(e.target.value)} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">x0=</span>
              <input type="number" step="0.25" value={diffX0} onChange={(e) => setDiffX0(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
            <label className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 font-mono text-xs">
              <span className="text-[var(--text-muted)]">y0=</span>
              <input type="number" step="0.25" value={diffY0} onChange={(e) => setDiffY0(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent focus:outline-none text-[var(--text-primary)]" />
            </label>
          </div>
        )}

        {/* Parameter Sliders a, b, k */}
        <div className="grid grid-cols-1 gap-2 border-t border-[var(--border-subtle)] pt-2 sm:grid-cols-3">
          {(['a', 'b', 'k'] as const).map((paramKey) => (
            <div key={paramKey} className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  setAnimatingSlider((prev) => (prev === paramKey ? null : paramKey))
                }
                title={`Animate ${paramKey}`}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {animatingSlider === paramKey ? (
                  <Pause className="h-3 w-3 text-sky-500" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </button>
              <span className="font-mono font-bold text-[var(--text-primary)] w-12 tabular-nums">
                {paramKey}={sliders[paramKey].toFixed(1)}
              </span>
              <input
                type="range"
                min={-5}
                max={5}
                step={0.1}
                value={sliders[paramKey]}
                onChange={(e) =>
                  setSliders((prev) => ({ ...prev, [paramKey]: Number(e.target.value) }))
                }
                className="flex-1 accent-sky-600 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas + Optional Ctrl+T Table */}
      <div className={`grid gap-3 ${showTable ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        <div className={`relative rounded-xl border border-[var(--border-strong)] overflow-hidden bg-white ${showTable ? 'lg:col-span-8' : ''}`}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={() => {
              dragRef.current.dragging = false;
              setHoverCoord(null);
            }}
            className="block h-[330px] w-full cursor-crosshair select-none"
          />

          {/* Top-left coordinate HUD */}
          <div className="pointer-events-none absolute top-2 left-2 rounded-md border border-slate-300/80 bg-white/90 px-2 py-1 font-mono text-[11px] font-semibold text-slate-800 shadow-sm tabular-nums">
            {hoverCoord
              ? `x=${hoverCoord.x.toFixed(2)}, y=${hoverCoord.y.toFixed(2)}`
              : `[${win.xMin.toFixed(1)}, ${win.xMax.toFixed(1)}] × [${win.yMin.toFixed(1)}, ${win.yMax.toFixed(1)}]`}
          </div>

          {/* Bottom Analyze readout bar */}
          {analysisResult && (
            <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-sky-300 bg-sky-50/95 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-900 shadow-sm tabular-nums">
              {analysisResult.label}: {analysisResult.text}
            </div>
          )}
        </div>

        {showTable && (
          <div className="lg:col-span-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-2.5 flex flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 mb-2">
              <span className="font-mono text-xs font-bold text-[var(--text-primary)]">Table Values</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <label className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">Start</span>
                  <input
                    type="number"
                    value={tableStart}
                    onChange={(e) => setTableStart(Number(e.target.value))}
                    className="w-12 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1 py-0.5 text-[var(--text-primary)]"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-[var(--text-muted)]">Δ</span>
                  <input
                    type="number"
                    step="0.5"
                    value={tableStep}
                    onChange={(e) => setTableStep(Number(e.target.value) || 1)}
                    className="w-12 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1 py-0.5 text-[var(--text-primary)]"
                  />
                </label>
              </div>
            </div>
            <div className="overflow-auto max-h-[270px]">
              <table className="w-full font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                    <th className="py-1 px-1.5 text-left">x</th>
                    <th className="py-1 px-1.5 text-right text-sky-500">f1</th>
                    <th className="py-1 px-1.5 text-right text-red-500">f2</th>
                    <th className="py-1 px-1.5 text-right text-emerald-500">f3</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.x} className="border-b border-[var(--border-subtle)]/50">
                      <td className="py-1 px-1.5 font-semibold text-[var(--text-primary)]">
                        {Number(row.x.toFixed(2))}
                      </td>
                      {row.ys.map((val, idx) => (
                        <td key={idx} className="py-1 px-1.5 text-right text-[var(--text-secondary)]">
                          {val === null ? '—' : val.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Analyze Graph & Geometry Overlay Toolbar */}
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2.5 lg:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Menu → Analyze Graph
            </span>
            <select
              value={targetSlotIdx}
              onChange={(e) => setTargetSlotIdx(Number(e.target.value))}
              className="rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-primary)]"
            >
              {functions.map((f, idx) => (
                <option key={f.id} value={idx}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['trace', 'Trace'],
                ['zero', 'Zero'],
                ['minimum', 'Min'],
                ['maximum', 'Max'],
                ['intersect', 'Intersect'],
                ['dydx', 'dy/dx'],
                ['integral', '∫ f(x)dx'],
              ] as Array<[AnalyzeTool, string]>
            ).map(([tool, label]) => (
              <button
                key={tool}
                type="button"
                onClick={() => setAnalyzeTool(tool)}
                className={`rounded px-2 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                  analyzeTool === tool
                    ? 'bg-sky-600 text-white'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {analyzeTool === 'integral' && (
            <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
              <label className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">Lower:</span>
                <input
                  type="number"
                  step="0.5"
                  value={integralBounds.lower}
                  onChange={(e) =>
                    setIntegralBounds((b) => ({ ...b, lower: Number(e.target.value) }))
                  }
                  className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[var(--text-primary)]"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="text-[var(--text-muted)]">Upper:</span>
                <input
                  type="number"
                  step="0.5"
                  value={integralBounds.upper}
                  onChange={(e) =>
                    setIntegralBounds((b) => ({ ...b, upper: Number(e.target.value) }))
                  }
                  className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[var(--text-primary)]"
                />
              </label>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Geometry Shapes Overlay
            </span>
            {shapes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShapes([]);
                  setPendingGeomPts([]);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:underline cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Clear Shapes
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['none', 'Off'],
                ['point', 'Point'],
                ['segment', 'Segment (2 pts)'],
                ['circle', 'Circle (2 pts)'],
                ['triangle', 'Triangle (3 pts)'],
              ] as Array<[GeometryTool, string]>
            ).map(([tool, label]) => (
              <button
                key={tool}
                type="button"
                onClick={() => {
                  setGeometryTool(tool);
                  setPendingGeomPts([]);
                }}
                className={`rounded px-2 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                  geometryTool === tool
                    ? 'bg-red-600 text-white'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {geometrySummaries.length > 0 && (
            <div className="flex flex-wrap gap-2 font-mono text-[11px] text-[var(--text-secondary)] pt-0.5">
              {geometrySummaries.map((line, i) => (
                <span key={i} className="rounded bg-[var(--bg-canvas)] px-1.5 py-0.5 border border-[var(--border-subtle)]">
                  {line}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import nerdamer from 'nerdamer';
import 'nerdamer/algebra';
import 'nerdamer/calculus';
import 'nerdamer/solve';
import * as math from 'mathjs';

export type AngleMode = 'RAD' | 'DEG';
export type CalculationMode = 'AUTO' | 'EXACT' | 'APPROX';
export type ComplexMode = 'REAL' | 'RECTANGULAR' | 'POLAR';

export interface CasEntry {
  id: string;
  input: string;
  exactOutput: string;
  approxOutput: string;
  prettyOutput: string;
  isError?: boolean;
  timestamp: number;
}

export interface VariableBinding {
  name: string;
  params?: string[];
  definition: string;
  evaluatedPreview: string;
}

export interface OneVarStats {
  count: number;
  mean: number;
  sumX: number;
  sumX2: number;
  sampleStd: number;
  popStd: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
}

export interface RegressionResult {
  kind: 'linear' | 'quadratic' | 'exponential' | 'power' | 'logarithmic';
  equationLabel: string;
  formulaForGraph: string;
  rSquared: number;
  correlationR: number | null;
  coefficients: number[];
  predict: (x: number) => number;
}

export interface CatalogItem {
  name: string;
  category: 'Algebra' | 'Calculus' | 'Matrix' | 'Probability' | 'Complex & Number' | 'Finance';
  syntax: string;
  description: string;
  template: string;
}

export const CAS_CATALOG: CatalogItem[] = [
  {
    name: 'solve',
    category: 'Algebra',
    syntax: 'solve(equation, var)',
    description: 'Symbolically solve an equation for var',
    template: 'solve(x^2 - 5*x + 6 = 0, x)',
  },
  {
    name: 'factor',
    category: 'Algebra',
    syntax: 'factor(expr)',
    description: 'Factor a polynomial or integer',
    template: 'factor(x^3 - 8)',
  },
  {
    name: 'expand',
    category: 'Algebra',
    syntax: 'expand(expr)',
    description: 'Expand algebraic products and powers',
    template: 'expand((x + 2)^3)',
  },
  {
    name: 'partfrac',
    category: 'Algebra',
    syntax: 'partfrac(rationalExpr, var)',
    description: 'Partial fraction decomposition (propFrac)',
    template: 'partfrac((2*x + 3)/(x^2 - x - 2), x)',
  },
  {
    name: 'zeros',
    category: 'Algebra',
    syntax: 'zeros(expr, var)',
    description: 'Find symbolic roots where expr = 0',
    template: 'zeros(x^2 - 9, x)',
  },
  {
    name: 'linSolve',
    category: 'Algebra',
    syntax: 'linSolve([eq1, eq2], [x, y])',
    description: 'Solve a system of linear equations',
    template: 'linSolve([2*x + y = 5, x - y = 1], [x, y])',
  },
  {
    name: 'diff',
    category: 'Calculus',
    syntax: 'diff(expr, var[, order])',
    description: 'Symbolic derivative d/dx',
    template: 'diff(sin(x^2) * exp(x), x)',
  },
  {
    name: 'integrate',
    category: 'Calculus',
    syntax: 'integrate(expr, var)',
    description: 'Symbolic indefinite antiderivative ∫ f(x) dx',
    template: 'integrate(x^2 * cos(x), x)',
  },
  {
    name: 'defint',
    category: 'Calculus',
    syntax: 'defint(expr, a, b, var)',
    description: 'Definite integral from a to b',
    template: 'defint(x^2, 0, 3, x)',
  },
  {
    name: 'limit',
    category: 'Calculus',
    syntax: 'limit(expr, var, target)',
    description: 'Symbolic limit as var approaches target',
    template: 'limit(sin(x)/x, x, 0)',
  },
  {
    name: 'sum',
    category: 'Calculus',
    syntax: 'sum(expr, var, lower, upper)',
    description: 'Summation Σ over integer index',
    template: 'sum(k^2, k, 1, 10)',
  },
  {
    name: 'taylor',
    category: 'Calculus',
    syntax: 'taylor(expr, var, center, degree)',
    description: 'Taylor polynomial approximation',
    template: 'taylor(exp(x), x, 0, 5)',
  },
  {
    name: 'det',
    category: 'Matrix',
    syntax: 'det([[a,b],[c,d]])',
    description: 'Matrix determinant',
    template: 'det([[4, 2], [1, 3]])',
  },
  {
    name: 'inv',
    category: 'Matrix',
    syntax: 'inv([[a,b],[c,d]])',
    description: 'Matrix inverse',
    template: 'inv([[4, 7], [2, 6]])',
  },
  {
    name: 'rref',
    category: 'Matrix',
    syntax: 'rref([[a,b,c],[d,e,f]])',
    description: 'Reduced Row Echelon Form',
    template: 'rref([[1, 2, 5], [3, -1, 1]])',
  },
  {
    name: 'eigVl',
    category: 'Matrix',
    syntax: 'eigVl([[a,b],[c,d]])',
    description: 'Eigenvalues of a square matrix',
    template: 'eigVl([[2, 1], [1, 2]])',
  },
  {
    name: 'dotP',
    category: 'Matrix',
    syntax: 'dotP([u1,u2,u3], [v1,v2,v3])',
    description: 'Vector dot product',
    template: 'dotP([1, 2, 3], [4, -5, 6])',
  },
  {
    name: 'crossP',
    category: 'Matrix',
    syntax: 'crossP([u1,u2,u3], [v1,v2,v3])',
    description: '3D vector cross product',
    template: 'crossP([1, 0, 0], [0, 1, 0])',
  },
  {
    name: 'nCr',
    category: 'Probability',
    syntax: 'nCr(n, r)',
    description: 'Combinations (n choose r)',
    template: 'nCr(10, 3)',
  },
  {
    name: 'nPr',
    category: 'Probability',
    syntax: 'nPr(n, r)',
    description: 'Permutations',
    template: 'nPr(8, 3)',
  },
  {
    name: 'normCdf',
    category: 'Probability',
    syntax: 'normCdf(low, high, mean, sd)',
    description: 'Normal cumulative probability P(low ≤ X ≤ high)',
    template: 'normCdf(-1.96, 1.96, 0, 1)',
  },
  {
    name: 'invNorm',
    category: 'Probability',
    syntax: 'invNorm(area, mean, sd)',
    description: 'Inverse normal quantile',
    template: 'invNorm(0.975, 0, 1)',
  },
  {
    name: 'binomPdf',
    category: 'Probability',
    syntax: 'binomPdf(n, p, k)',
    description: 'Binomial probability P(X = k)',
    template: 'binomPdf(10, 0.5, 6)',
  },
  {
    name: 'gcd',
    category: 'Complex & Number',
    syntax: 'gcd(a, b)',
    description: 'Greatest common divisor',
    template: 'gcd(84, 36)',
  },
  {
    name: 'isPrime',
    category: 'Complex & Number',
    syntax: 'isPrime(n)',
    description: 'Primality test',
    template: 'isPrime(997)',
  },
  {
    name: 'real',
    category: 'Complex & Number',
    syntax: 'real(z)',
    description: 'Real part of complex number',
    template: 'real((3 + 4*i)^2)',
  },
];

// Normal CDF via Abramowitz-Stegun erf approximation
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t) *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalPdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function normalCdf(low: number, high: number, mu = 0, sigma = 1): number {
  const cdf = (val: number) => 0.5 * (1 + erfApprox((val - mu) / (sigma * Math.SQRT2)));
  return cdf(high) - cdf(low);
}

// Peter Acklam's inverse normal approximation
function inverseNormal(p: number, mu = 0, sigma = 1): number {
  if (p <= 0 || p >= 1) throw new Error('invNorm area must be strictly between 0 and 1.');
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let z = 0;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    z =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    z =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return mu + sigma * z;
}

function nCr(n: number, r: number): number {
  if (r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
  let num = 1;
  let den = 1;
  const k = Math.min(r, n - r);
  for (let i = 1; i <= k; i++) {
    num *= n - k + i;
    den *= i;
  }
  return Math.round(num / den);
}

function nPr(n: number, r: number): number {
  if (r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
  let res = 1;
  for (let i = 0; i < r; i++) res *= n - i;
  return res;
}

function computeRref(matrixInput: number[][]): number[][] {
  const m = matrixInput.map((row) => row.map(Number));
  const rowCount = m.length;
  const colCount = m[0]?.length || 0;
  let lead = 0;

  for (let r = 0; r < rowCount; r++) {
    if (lead >= colCount) break;
    let i = r;
    while (Math.abs(m[i][lead]) < 1e-10) {
      i++;
      if (i === rowCount) {
        i = r;
        lead++;
        if (lead === colCount) return m;
      }
    }
    const tmp = m[i];
    m[i] = m[r];
    m[r] = tmp;

    const lv = m[r][lead];
    m[r] = m[r].map((val) => (Math.abs(val / lv) < 1e-10 ? 0 : val / lv));
    for (let j = 0; j < rowCount; j++) {
      if (j !== r) {
        const factor = m[j][lead];
        m[j] = m[j].map((val, col) => {
          const updated = val - factor * m[r][col];
          return Math.abs(updated) < 1e-10 ? 0 : updated;
        });
      }
    }
    lead++;
  }
  return m.map((row) => row.map((v) => Number(v.toFixed(8))));
}

function isPrimeInt(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false;
  }
  return true;
}

function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let bracketDepth = 0;
  let current = '';
  for (const ch of argsStr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if (ch === ',' && depth === 0 && bracketDepth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function normalizeInputSymbols(raw: string): string {
  return raw
    .trim()
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi')
    .replace(/√\(/g, 'sqrt(')
    .replace(/ln\(/g, 'log(')
    .replace(/propFrac\(/gi, 'partfrac(')
    .replace(/zeros\(/gi, 'solve(')
    .replace(/integral\(/gi, 'integrate(')
    .replace(/derivative\(/gi, 'diff(');
}

function prettyPrintOutput(raw: string): string {
  return raw
    .replace(/\bpi\b/g, 'π')
    .replace(/sqrt\(/g, '√(')
    .replace(/\s*\*\s*/g, '·');
}

function formatMatrix(matrix: unknown): string {
  if (!Array.isArray(matrix)) return String(matrix);
  return `[${matrix
    .map((row) =>
      Array.isArray(row)
        ? `[${row.map((v) => (typeof v === 'number' ? Number(v.toFixed(6)) : String(v))).join(', ')}]`
        : String(row)
    )
    .join(', ')}]`;
}

function applyScopeToExpr(expr: string, vars: Record<string, VariableBinding>, lastAns: string): string {
  let out = expr.replace(/\bAns\b/gi, `(${lastAns || '0'})`);
  // Substitute scalar variables (skip function calls like f(x))
  for (const [name, binding] of Object.entries(vars)) {
    if (!binding.params || binding.params.length === 0) {
      const re = new RegExp(`\\b${name}\\b(?!\\s*\\()`, 'g');
      out = out.replace(re, `(${binding.definition})`);
    } else if (binding.params.length === 1) {
      const param = binding.params[0];
      const fnCallRe = new RegExp(`\\b${name}\\(([^()]+)\\)`, 'g');
      out = out.replace(fnCallRe, (_, arg) => {
        const sub = binding.definition.replace(new RegExp(`\\b${param}\\b`, 'g'), `(${arg})`);
        return `(${sub})`;
      });
    }
  }
  return out;
}

export function evaluateCasCommand(
  rawInput: string,
  options: {
    angleMode: AngleMode;
    calcMode: CalculationMode;
    complexMode: ComplexMode;
    variables: Record<string, VariableBinding>;
    lastAns: string;
  }
): {
  exactOutput: string;
  approxOutput: string;
  prettyOutput: string;
  updatedVariables?: Record<string, VariableBinding>;
  isError?: boolean;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { exactOutput: '', approxOutput: '', prettyOutput: '' };
  }

  try {
    // Handle DelVar command
    const delMatch = trimmed.match(/^DelVar\s+([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (delMatch) {
      const target = delMatch[1];
      const nextVars = { ...options.variables };
      delete nextVars[target];
      return {
        exactOutput: `Done (deleted ${target})`,
        approxOutput: `Done (deleted ${target})`,
        prettyOutput: `Done (deleted ${target})`,
        updatedVariables: nextVars,
      };
    }

    // Handle TI-Nspire := assignment (scalar or f(x) := expr)
    const assignIdx = trimmed.indexOf(':=');
    if (assignIdx > 0) {
      const lhs = trimmed.slice(0, assignIdx).trim();
      const rhs = trimmed.slice(assignIdx + 2).trim();
      const fnMatch = lhs.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\(([a-zA-Z_][a-zA-Z0-9_,\s]*)\)$/);
      const varMatch = lhs.match(/^([a-zA-Z_][a-zA-Z0-9_]*)$/);

      if (fnMatch) {
        const fnName = fnMatch[1];
        const params = fnMatch[2].split(',').map((p) => p.trim()).filter(Boolean);
        const normalizedRhs = normalizeInputSymbols(rhs);
        const nextVars: Record<string, VariableBinding> = {
          ...options.variables,
          [fnName]: {
            name: fnName,
            params,
            definition: normalizedRhs,
            evaluatedPreview: `${fnName}(${params.join(', ')}) := ${normalizedRhs}`,
          },
        };
        return {
          exactOutput: 'Done',
          approxOutput: 'Done',
          prettyOutput: 'Done',
          updatedVariables: nextVars,
        };
      }

      if (varMatch) {
        const varName = varMatch[1];
        const evalResult = evaluateCasCommand(rhs, {
          ...options,
        });
        if (evalResult.isError) return evalResult;
        const storedDef = evalResult.exactOutput;
        const nextVars: Record<string, VariableBinding> = {
          ...options.variables,
          [varName]: {
            name: varName,
            definition: storedDef,
            evaluatedPreview: evalResult.prettyOutput,
          },
        };
        return {
          exactOutput: evalResult.exactOutput,
          approxOutput: evalResult.approxOutput,
          prettyOutput: evalResult.prettyOutput,
          updatedVariables: nextVars,
        };
      }
    }

    const normalized = applyScopeToExpr(
      normalizeInputSymbols(trimmed),
      options.variables,
      options.lastAns
    );

    // Special TI-Nspire CX II CAS commands handled cleanly via mathjs/numeric routines
    // 1. linSolve([eq1, eq2], [x, y])
    const linSolveMatch = normalized.match(/^linSolve\(\s*\[(.+)\]\s*,\s*\[(.+)\]\s*\)$/i);
    if (linSolveMatch) {
      const eqs = splitTopLevelArgs(linSolveMatch[1]);
      const vars = splitTopLevelArgs(linSolveMatch[2]);
      const sol = nerdamer.solveEquations(eqs, vars) as unknown as Array<[string, number]>;
      const rawFormatted = Array.isArray(sol)
        ? sol.map(([k, v]) => `${k} = ${v}`).join(', ')
        : String(sol).replace(/^\[?\{?|\}?\]?$/g, '').replace(/\s*=>\s*/g, ' = ');
      const formatted = rawFormatted.replace(/\s*,\s*/g, ', ');
      return {
        exactOutput: `{${formatted}}`,
        approxOutput: `{${formatted}}`,
        prettyOutput: `{${formatted}}`,
      };
    }

    // 2. rref(matrix)
    const rrefMatch = normalized.match(/^rref\((.+)\)$/i);
    if (rrefMatch) {
      const mat = math.evaluate(rrefMatch[1]);
      const arr = Array.isArray(mat) ? mat : (mat as math.Matrix).toArray();
      const result = computeRref(arr as number[][]);
      const text = formatMatrix(result);
      return { exactOutput: text, approxOutput: text, prettyOutput: text };
    }

    // 3. eigVl(matrix)
    const eigMatch = normalized.match(/^eigVl\((.+)\)$/i);
    if (eigMatch) {
      const mat = math.evaluate(eigMatch[1]);
      const eigResult = math.eigs(mat);
      const vals = eigResult.values;
      const arr = Array.isArray(vals) ? vals : (vals as math.Matrix).toArray();
      const text = `{${arr.map((v) => (typeof v === 'number' ? Number(v.toFixed(6)) : String(v))).join(', ')}}`;
      return { exactOutput: text, approxOutput: text, prettyOutput: text };
    }

    // 4. det(matrix), inv(matrix), transpose(matrix), dotP(u,v), crossP(u,v)
    const matrixFnMatch = normalized.match(/^(det|inv|transpose|trace|dotP|crossP)\((.+)\)$/i);
    if (matrixFnMatch) {
      const fn = matrixFnMatch[1];
      const args = splitTopLevelArgs(matrixFnMatch[2]);
      if (fn.toLowerCase() === 'dotp' && args.length === 2) {
        const res = math.dot(math.evaluate(args[0]), math.evaluate(args[1]));
        const text = String(res);
        return { exactOutput: text, approxOutput: text, prettyOutput: text };
      }
      if (fn.toLowerCase() === 'crossp' && args.length === 2) {
        const res = math.cross(math.evaluate(args[0]), math.evaluate(args[1]));
        const arr = Array.isArray(res) ? res : (res as math.Matrix).toArray();
        const text = `[${arr.join(', ')}]`;
        return { exactOutput: text, approxOutput: text, prettyOutput: text };
      }
      const res = math.evaluate(`${fn.toLowerCase()}(${args[0]})`);
      const text =
        typeof res === 'number'
          ? String(Number(res.toFixed(8)))
          : formatMatrix((res as math.Matrix)?.toArray ? (res as math.Matrix).toArray() : res);
      return { exactOutput: text, approxOutput: text, prettyOutput: text };
    }

    // 5. Probability & Number Theory commands
    const probMatch = normalized.match(
      /^(nCr|nPr|normPdf|normCdf|invNorm|binomPdf|binomCdf|gcd|lcm|isPrime|mod|randInt)\((.*)\)$/i
    );
    if (probMatch) {
      const fn = probMatch[1].toLowerCase();
      const args = splitTopLevelArgs(probMatch[2]).map((a) => Number(math.evaluate(a)));
      let out = '';
      if (fn === 'ncr') out = String(nCr(args[0], args[1]));
      else if (fn === 'npr') out = String(nPr(args[0], args[1]));
      else if (fn === 'normpdf') out = String(Number(normalPdf(args[0], args[1] ?? 0, args[2] ?? 1).toFixed(8)));
      else if (fn === 'normcdf') out = String(Number(normalCdf(args[0], args[1], args[2] ?? 0, args[3] ?? 1).toFixed(8)));
      else if (fn === 'invnorm') out = String(Number(inverseNormal(args[0], args[1] ?? 0, args[2] ?? 1).toFixed(8)));
      else if (fn === 'binompdf') {
        const [n, p, k] = args;
        out = String(Number((nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)).toFixed(8)));
      } else if (fn === 'binomcdf') {
        const [n, p, low, high] = args.length >= 4 ? args : [args[0], args[1], 0, args[2]];
        let acc = 0;
        for (let k = low; k <= high; k++) {
          acc += nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
        }
        out = String(Number(acc.toFixed(8)));
      } else if (fn === 'gcd') out = String(math.gcd(args[0], args[1]));
      else if (fn === 'lcm') out = String(math.lcm(args[0], args[1]));
      else if (fn === 'isprime') out = String(isPrimeInt(args[0]));
      else if (fn === 'mod') out = String(((args[0] % args[1]) + args[1]) % args[1]);
      else if (fn === 'randint') {
        const lo = Math.ceil(args[0]);
        const hi = Math.floor(args[1]);
        out = String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
      }
      return { exactOutput: out, approxOutput: out, prettyOutput: out };
    }

    // 6. taylor(expr, var, center, degree) -> symbolic derivatives around center
    const taylorMatch = normalized.match(/^taylor\((.+)\)$/i);
    if (taylorMatch) {
      const args = splitTopLevelArgs(taylorMatch[1]);
      if (args.length >= 4) {
        const [expr, v, centerStr, degStr] = args;
        const center = Number(math.evaluate(centerStr));
        const deg = Math.min(10, Math.max(0, Math.floor(Number(math.evaluate(degStr)))));
        const terms: string[] = [];
        let currExpr = expr;
        let fact = 1;
        for (let k = 0; k <= deg; k++) {
          if (k > 0) {
            currExpr = nerdamer.diff(currExpr, v).toString();
            fact *= k;
          }
          const valAtCenter = nerdamer(currExpr, { [v]: String(center) }).evaluate().toString();
          if (valAtCenter !== '0') {
            const coeff = nerdamer(`(${valAtCenter})/${fact}`).toString();
            const powerPart =
              k === 0
                ? ''
                : k === 1
                  ? center === 0
                    ? v
                    : `(${v}-${center})`
                  : center === 0
                    ? `${v}^${k}`
                    : `(${v}-${center})^${k}`;
            terms.push(powerPart ? `(${coeff})*${powerPart}` : coeff);
          }
        }
        const combined = nerdamer(terms.join('+') || '0').expand().toString();
        return {
          exactOutput: combined,
          approxOutput: combined,
          prettyOutput: prettyPrintOutput(combined),
        };
      }
    }

    // 7. Degree-mode trigonometric adjustment for pure numeric trig expressions
    let exprToRun = normalized;
    if (options.angleMode === 'DEG') {
      exprToRun = exprToRun.replace(
        /\b(sin|cos|tan|csc|sec|cot)\(([^()]+)\)/gi,
        (_, fn, inner) => `${fn.toLowerCase()}((${inner})*pi/180)`
      );
    }

    // Check if expression contains matrix brackets or complex numbers best handled by mathjs
    if (/^\s*\[/.test(exprToRun)) {
      const evaluated = math.evaluate(exprToRun);
      const formatted = formatMatrix(
        (evaluated as math.Matrix)?.toArray ? (evaluated as math.Matrix).toArray() : evaluated
      );
      return { exactOutput: formatted, approxOutput: formatted, prettyOutput: formatted };
    }

    // Run through Nerdamer CAS engine for exact symbolic result
    const exactRes = nerdamer(exprToRun);
    const exactStr = exactRes.toString();

    // Also try numeric approximation via mathjs & nerdamer.evaluate
    let approxStr = exactStr;
    try {
      const mj = math.evaluate(exprToRun);
      if (typeof mj === 'number' && Number.isFinite(mj)) {
        approxStr = String(Number(mj.toPrecision(10)));
      } else if (mj && typeof mj === 'object' && 're' in mj && 'im' in mj) {
        const c = mj as math.Complex;
        if (options.complexMode === 'POLAR') {
          const r = Math.hypot(c.re, c.im);
          const theta = Math.atan2(c.im, c.re);
          const angleOut = options.angleMode === 'DEG' ? `${((theta * 180) / Math.PI).toFixed(4)}°` : `${theta.toFixed(4)} rad`;
          approxStr = `${r.toFixed(6)} ∠ ${angleOut}`;
        } else {
          approxStr = math.format(c, { precision: 8 });
        }
      } else {
        const dec = exactRes.evaluate();
        const decText = (dec as unknown as { text: (mode?: string) => string }).text('decimals');
        if (decText && !/[a-zA-Z]{2,}/.test(decText.replace(/i\b/g, ''))) {
          approxStr = decText;
        }
      }
    } catch {
      approxStr = exactStr;
    }

    const chosen =
      options.calcMode === 'APPROX'
        ? approxStr
        : options.calcMode === 'EXACT'
          ? exactStr
          : exactStr;

    return {
      exactOutput: exactStr,
      approxOutput: approxStr,
      prettyOutput: prettyPrintOutput(chosen),
    };
  } catch (err: unknown) {
    // Fallback to mathjs for expressions nerdamer doesn't recognize (e.g. complex polar, units)
    try {
      const normalized = applyScopeToExpr(
        normalizeInputSymbols(trimmed),
        options.variables,
        options.lastAns
      );
      const mj = math.evaluate(normalized);
      const str =
        typeof mj === 'number'
          ? String(Number(mj.toPrecision(10)))
          : formatMatrix((mj as math.Matrix)?.toArray ? (mj as math.Matrix).toArray() : mj);
      return {
        exactOutput: str,
        approxOutput: str,
        prettyOutput: prettyPrintOutput(str),
      };
    } catch {
      const msg = err instanceof Error ? err.message : 'Syntax or domain error.';
      return {
        exactOutput: `Error: ${msg}`,
        approxOutput: `Error: ${msg}`,
        prettyOutput: `Error: ${msg}`,
        isError: true,
      };
    }
  }
}

export function compileRealFunction(
  exprRaw: string,
  angleMode: AngleMode,
  variables: Record<string, VariableBinding> = {}
): ((vars: Record<string, number>) => number) | null {
  const cleaned = exprRaw.trim();
  if (!cleaned) return null;
  try {
    let normalized = applyScopeToExpr(normalizeInputSymbols(cleaned), variables, '0');
    if (angleMode === 'DEG') {
      normalized = normalized.replace(
        /\b(sin|cos|tan|csc|sec|cot)\(([^()]+)\)/gi,
        (_, fn, inner) => `${fn.toLowerCase()}((${inner})*pi/180)`
      );
    }
    const compiled = math.compile(normalized);
    return (vars: Record<string, number>) => {
      try {
        const val = compiled.evaluate(vars);
        return typeof val === 'number' && Number.isFinite(val) ? val : NaN;
      } catch {
        return NaN;
      }
    };
  } catch {
    return null;
  }
}

export function computeOneVarStats(values: number[]): OneVarStats | null {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = nums.length;
  if (n === 0) return null;

  const sumX = nums.reduce((a, b) => a + b, 0);
  const sumX2 = nums.reduce((a, b) => a + b * b, 0);
  const mean = sumX / n;
  const varianceSum = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const popStd = Math.sqrt(varianceSum / n);
  const sampleStd = n > 1 ? Math.sqrt(varianceSum / (n - 1)) : 0;

  const medianOf = (arr: number[]) => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const median = medianOf(nums);
  const lowerHalf = nums.slice(0, Math.floor(n / 2));
  const upperHalf = nums.slice(Math.ceil(n / 2));
  const q1 = lowerHalf.length > 0 ? medianOf(lowerHalf) : nums[0];
  const q3 = upperHalf.length > 0 ? medianOf(upperHalf) : nums[n - 1];

  return {
    count: n,
    mean,
    sumX,
    sumX2,
    sampleStd,
    popStd,
    min: nums[0],
    q1,
    median,
    q3,
    max: nums[n - 1],
    iqr: q3 - q1,
  };
}

export function computeRegression(
  xs: number[],
  ys: number[],
  kind: RegressionResult['kind']
): RegressionResult | null {
  const pairs = xs
    .map((x, idx) => [x, ys[idx]] as [number, number])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 2) return null;

  const meanY = pairs.reduce((s, [, y]) => s + y, 0) / n;
  const ssTot = pairs.reduce((s, [, y]) => s + (y - meanY) ** 2, 0) || 1e-12;

  if (kind === 'linear') {
    const meanX = pairs.reduce((s, [x]) => s + x, 0) / n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const [x, y] of pairs) {
      sxx += (x - meanX) ** 2;
      sxy += (x - meanX) * (y - meanY);
      syy += (y - meanY) ** 2;
    }
    const m = sxx === 0 ? 0 : sxy / sxx;
    const b = meanY - m * meanX;
    const predict = (x: number) => m * x + b;
    const ssRes = pairs.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);
    const r = sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
    return {
      kind,
      equationLabel: `y = ${m.toFixed(4)}·x ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(4)}`,
      formulaForGraph: `${m.toFixed(6)}*x + ${b.toFixed(6)}`,
      rSquared: Math.max(0, 1 - ssRes / ssTot),
      correlationR: r,
      coefficients: [m, b],
      predict,
    };
  }

  if (kind === 'quadratic' && n >= 3) {
    // Normal equations for a*x^2 + b*x + c
    let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sxy = 0, sx2y = 0;
    for (const [x, y] of pairs) {
      const x2 = x * x;
      s1 += x;
      s2 += x2;
      s3 += x2 * x;
      s4 += x2 * x2;
      sy += y;
      sxy += x * y;
      sx2y += x2 * y;
    }
    const A = [
      [s4, s3, s2],
      [s3, s2, s1],
      [s2, s1, s0],
    ];
    const B = [sx2y, sxy, sy];
    const sol = math.lusolve(A, B) as number[][];
    const [a, b, c] = [sol[0][0], sol[1][0], sol[2][0]];
    const predict = (x: number) => a * x * x + b * x + c;
    const ssRes = pairs.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);
    return {
      kind,
      equationLabel: `y = ${a.toFixed(4)}·x² ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(4)}·x ${c >= 0 ? '+' : '-'} ${Math.abs(c).toFixed(4)}`,
      formulaForGraph: `${a.toFixed(6)}*x^2 + ${b.toFixed(6)}*x + ${c.toFixed(6)}`,
      rSquared: Math.max(0, 1 - ssRes / ssTot),
      correlationR: null,
      coefficients: [a, b, c],
      predict,
    };
  }

  if (kind === 'exponential') {
    const posPairs = pairs.filter(([, y]) => y > 0);
    if (posPairs.length < 2) return null;
    const lin = computeRegression(
      posPairs.map(([x]) => x),
      posPairs.map(([, y]) => Math.log(y)),
      'linear'
    );
    if (!lin) return null;
    const b = Math.exp(lin.coefficients[0]);
    const a = Math.exp(lin.coefficients[1]);
    const predict = (x: number) => a * Math.pow(b, x);
    const ssRes = posPairs.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);
    return {
      kind,
      equationLabel: `y = ${a.toFixed(4)} · (${b.toFixed(4)})^x`,
      formulaForGraph: `${a.toFixed(6)}*(${b.toFixed(6)})^x`,
      rSquared: Math.max(0, 1 - ssRes / ssTot),
      correlationR: lin.correlationR,
      coefficients: [a, b],
      predict,
    };
  }

  if (kind === 'power') {
    const posPairs = pairs.filter(([x, y]) => x > 0 && y > 0);
    if (posPairs.length < 2) return null;
    const lin = computeRegression(
      posPairs.map(([x]) => Math.log(x)),
      posPairs.map(([, y]) => Math.log(y)),
      'linear'
    );
    if (!lin) return null;
    const b = lin.coefficients[0];
    const a = Math.exp(lin.coefficients[1]);
    const predict = (x: number) => (x > 0 ? a * Math.pow(x, b) : NaN);
    const ssRes = posPairs.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);
    return {
      kind,
      equationLabel: `y = ${a.toFixed(4)} · x^(${b.toFixed(4)})`,
      formulaForGraph: `${a.toFixed(6)}*x^(${b.toFixed(6)})`,
      rSquared: Math.max(0, 1 - ssRes / ssTot),
      correlationR: lin.correlationR,
      coefficients: [a, b],
      predict,
    };
  }

  // logarithmic
  const posX = pairs.filter(([x]) => x > 0);
  if (posX.length < 2) return null;
  const lin = computeRegression(
    posX.map(([x]) => Math.log(x)),
    posX.map(([, y]) => y),
    'linear'
  );
  if (!lin) return null;
  const [b, a] = lin.coefficients;
  const predict = (x: number) => (x > 0 ? a + b * Math.log(x) : NaN);
  const ssRes = posX.reduce((s, [x, y]) => s + (y - predict(x)) ** 2, 0);
  return {
    kind: 'logarithmic',
    equationLabel: `y = ${a.toFixed(4)} ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(4)}·ln(x)`,
    formulaForGraph: `${a.toFixed(6)} + ${b.toFixed(6)}*log(x)`,
    rSquared: Math.max(0, 1 - ssRes / ssTot),
    correlationR: lin.correlationR,
    coefficients: [a, b],
    predict,
  };
}

export interface TvmInputs {
  N: number;
  I: number; // annual interest %
  PV: number;
  PMT: number;
  FV: number;
  PpY: number;
  CpY: number;
}

export function solveTvmVariable(
  inputs: TvmInputs,
  target: 'N' | 'I' | 'PV' | 'PMT' | 'FV'
): number {
  const { N, I, PV, PMT, FV, PpY, CpY } = inputs;
  const effRate = Math.pow(1 + I / 100 / CpY, CpY / PpY) - 1;

  if (target === 'FV') {
    if (Math.abs(effRate) < 1e-12) return -(PV + PMT * N);
    const pow = Math.pow(1 + effRate, N);
    return -(PV * pow + PMT * ((pow - 1) / effRate));
  }
  if (target === 'PV') {
    if (Math.abs(effRate) < 1e-12) return -(FV + PMT * N);
    const pow = Math.pow(1 + effRate, -N);
    return -(FV * pow + PMT * ((1 - pow) / effRate));
  }
  if (target === 'PMT') {
    if (Math.abs(effRate) < 1e-12) return -(PV + FV) / N;
    const pow = Math.pow(1 + effRate, N);
    return -((PV * pow + FV) * effRate) / (pow - 1);
  }
  if (target === 'N') {
    if (Math.abs(effRate) < 1e-12) return -(PV + FV) / PMT;
    const num = PMT - FV * effRate;
    const den = PMT + PV * effRate;
    if (num / den <= 0) throw new Error('No real solution for N with current cash flows.');
    return Math.log(num / den) / Math.log(1 + effRate);
  }

  // Solve for I% numerically via Newton/secant over [ -99%, 500% ]
  const residual = (ratePct: number) => {
    const r = Math.pow(1 + ratePct / 100 / CpY, CpY / PpY) - 1;
    if (Math.abs(r) < 1e-12) return PV + PMT * N + FV;
    const pow = Math.pow(1 + r, N);
    return PV * pow + PMT * ((pow - 1) / r) + FV;
  };
  let x0 = 5;
  let x1 = 10;
  let f0 = residual(x0);
  let f1 = residual(x1);
  for (let iter = 0; iter < 80; iter++) {
    if (Math.abs(f1) < 1e-9) return x1;
    const denom = f1 - f0;
    if (Math.abs(denom) < 1e-14) break;
    const x2 = Math.max(-95, Math.min(500, x1 - (f1 * (x1 - x0)) / denom));
    x0 = x1;
    f0 = f1;
    x1 = x2;
    f1 = residual(x1);
  }
  return x1;
}

// Safe mini Python/TI-Basic educational script runner (no eval/Function!)
export function runNspireScript(source: string): { output: string[]; error?: string } {
  const lines = source.split(/\r?\n/);
  const output: string[] = [];
  const env: Record<string, unknown> = {
    pi: Math.PI,
    e: Math.E,
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    abs: Math.abs,
    log: Math.log,
    exp: Math.exp,
    pow: Math.pow,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    min: Math.min,
    max: Math.max,
  };

  let stepCount = 0;
  const MAX_STEPS = 5000;

  const evalExpr = (expr: string): unknown => {
    const trimmed = expr.trim();
    if (!trimmed) return undefined;
    // Handle range(a, b)
    const rangeMatch = trimmed.match(/^range\((.+)\)$/);
    if (rangeMatch) {
      const parts = splitTopLevelArgs(rangeMatch[1]).map((p) => Number(evalExpr(p)));
      const start = parts.length === 1 ? 0 : parts[0];
      const stop = parts.length === 1 ? parts[0] : parts[1];
      const step = parts[2] ?? 1;
      const arr: number[] = [];
      for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        arr.push(i);
        if (arr.length > 2000) break;
      }
      return arr;
    }
    if (/^["'].*["']$/.test(trimmed)) {
      return trimmed.slice(1, -1);
    }
    // Check string interpolation / comma print args
    const sanitized = trimmed
      .replace(/\bmath\./g, '')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\blen\(([^()]+)\)/g, 'length($1)');
    const scope: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(env)) {
      if (typeof v !== 'function') scope[k] = v;
    }
    const res = math.evaluate(sanitized, scope);
    if (res && typeof (res as math.Matrix).toArray === 'function') {
      return (res as math.Matrix).toArray();
    }
    return res;
  };

  const getIndent = (line: string) => line.match(/^(\s*)/)?.[1].length ?? 0;

  const execBlock = (startIdx: number, baseIndent: number): number => {
    let i = startIdx;
    while (i < lines.length) {
      if (++stepCount > MAX_STEPS) {
        throw new Error('Execution halted: iteration limit (5,000 steps) reached.');
      }
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        i++;
        continue;
      }
      const indent = getIndent(raw);
      if (indent < baseIndent) break;

      if (/^import\s+/.test(trimmed)) {
        i++;
        continue;
      }

      // print(...) or Disp ...
      const printMatch = trimmed.match(/^(?:print\((.*)\)|Disp\s+(.+))$/i);
      if (printMatch) {
        const argStr = printMatch[1] ?? printMatch[2] ?? '';
        const parts = splitTopLevelArgs(argStr).map((part) => {
          const val = evalExpr(part);
          if (Array.isArray(val)) return `[${val.join(', ')}]`;
          if (typeof val === 'number' && !Number.isInteger(val)) return Number(val.toFixed(6));
          return String(val ?? '');
        });
        output.push(parts.join(' '));
        i++;
        continue;
      }

      // for x in range(...):
      const forMatch = trimmed.match(/^for\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+(.+):$/);
      if (forMatch) {
        const varName = forMatch[1];
        const iterable = evalExpr(forMatch[2]);
        const list = Array.isArray(iterable) ? iterable : [];
        // find body end
        let bodyEnd = i + 1;
        const bodyIndent = i + 1 < lines.length ? Math.max(baseIndent + 1, getIndent(lines[i + 1])) : baseIndent + 2;
        while (bodyEnd < lines.length) {
          const t = lines[bodyEnd].trim();
          if (t && !t.startsWith('#') && getIndent(lines[bodyEnd]) < bodyIndent) break;
          bodyEnd++;
        }
        for (const item of list) {
          env[varName] = item;
          execBlock(i + 1, bodyIndent);
        }
        i = bodyEnd;
        continue;
      }

      // while cond:
      const whileMatch = trimmed.match(/^while\s+(.+):$/);
      if (whileMatch) {
        const condExpr = whileMatch[1];
        let bodyEnd = i + 1;
        const bodyIndent = i + 1 < lines.length ? Math.max(baseIndent + 1, getIndent(lines[i + 1])) : baseIndent + 2;
        while (bodyEnd < lines.length) {
          const t = lines[bodyEnd].trim();
          if (t && !t.startsWith('#') && getIndent(lines[bodyEnd]) < bodyIndent) break;
          bodyEnd++;
        }
        while (Boolean(evalExpr(condExpr))) {
          if (++stepCount > MAX_STEPS) {
            throw new Error('Execution halted: iteration limit (5,000 steps) reached.');
          }
          execBlock(i + 1, bodyIndent);
        }
        i = bodyEnd;
        continue;
      }

      // if cond:
      const ifMatch = trimmed.match(/^if\s+(.+):$/);
      if (ifMatch) {
        const condVal = Boolean(evalExpr(ifMatch[1]));
        let bodyEnd = i + 1;
        const bodyIndent = i + 1 < lines.length ? Math.max(baseIndent + 1, getIndent(lines[i + 1])) : baseIndent + 2;
        while (bodyEnd < lines.length) {
          const t = lines[bodyEnd].trim();
          if (t && !t.startsWith('#') && getIndent(lines[bodyEnd]) < bodyIndent) break;
          bodyEnd++;
        }
        let elseStart = -1;
        let elseEnd = bodyEnd;
        if (bodyEnd < lines.length && /^else:$/.test(lines[bodyEnd].trim()) && getIndent(lines[bodyEnd]) === indent) {
          elseStart = bodyEnd + 1;
          elseEnd = elseStart;
          while (elseEnd < lines.length) {
            const t = lines[elseEnd].trim();
            if (t && !t.startsWith('#') && getIndent(lines[elseEnd]) < bodyIndent) break;
            elseEnd++;
          }
        }
        if (condVal) {
          execBlock(i + 1, bodyIndent);
        } else if (elseStart >= 0) {
          execBlock(elseStart, bodyIndent);
        }
        i = elseEnd;
        continue;
      }

      // Assignment x = ... or x := ...
      const assignMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::=|=)\s*(.+)$/);
      if (assignMatch) {
        env[assignMatch[1]] = evalExpr(assignMatch[2]);
        i++;
        continue;
      }

      // Bare expression
      evalExpr(trimmed);
      i++;
    }
    return i;
  };

  try {
    execBlock(0, 0);
    return { output };
  } catch (err: unknown) {
    return {
      output,
      error: err instanceof Error ? err.message : 'Script runtime error.',
    };
  }
}

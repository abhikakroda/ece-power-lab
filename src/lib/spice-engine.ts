// Lightweight SPICE engine: MNA-based solver for R, L, C, V, I components
// Supports DC operating point, AC sweep, and transient analysis

export interface SpiceComponent {
  type: "R" | "L" | "C" | "V" | "I";
  name: string;
  nodeP: number;
  nodeN: number;
  value: number;
  acMag?: number;
  acPhase?: number;
}

export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im: number = 0): Complex => ({ re, im });
export const cxAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const cxSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const cxMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
export const cxDiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return cx(0);
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
export const cxMag = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);
export const cxPhase = (a: Complex): number => Math.atan2(a.im, a.re) * (180 / Math.PI);
export const cxScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s });

// Parse netlist string into components
export function parseNetlist(text: string): { components: SpiceComponent[]; nodeCount: number } {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("*") && !l.startsWith("."));
  const nodeMap = new Map<string, number>();
  nodeMap.set("0", 0);
  nodeMap.set("gnd", 0);
  let nextNode = 1;

  const getNode = (s: string): number => {
    const key = s.toLowerCase();
    if (!nodeMap.has(key)) nodeMap.set(key, nextNode++);
    return nodeMap.get(key)!;
  };

  const parseValue = (s: string): number => {
    const suffixes: Record<string, number> = {
      f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3,
      k: 1e3, meg: 1e6, g: 1e9, t: 1e12,
    };
    const match = s.match(/^([0-9.eE+-]+)\s*([a-zA-Z]*)/);
    if (!match) return parseFloat(s);
    const num = parseFloat(match[1]);
    const suf = match[2].toLowerCase();
    return num * (suffixes[suf] || 1);
  };

  const components: SpiceComponent[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const name = parts[0].toUpperCase();
    const type = name[0] as SpiceComponent["type"];
    if (!["R", "L", "C", "V", "I"].includes(type)) continue;
    const nodeP = getNode(parts[1]);
    const nodeN = getNode(parts[2]);
    const value = parseValue(parts[3]);
    components.push({ type, name, nodeP, nodeN, value });
  }

  return { components, nodeCount: nextNode };
}

// Solve real matrix equation Ax = b using Gaussian elimination with partial pivoting
function solveReal(A: number[][], b: number[], n: number): number[] {
  const a = A.map((row) => [...row]);
  const bb = [...b];

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[maxRow][col])) maxRow = row;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [bb[col], bb[maxRow]] = [bb[maxRow], bb[col]];

    if (Math.abs(a[col][col]) < 1e-20) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let j = col; j < n; j++) a[row][j] -= factor * a[col][j];
      bb[row] -= factor * bb[col];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = bb[i];
    for (let j = i + 1; j < n; j++) sum -= a[i][j] * x[j];
    x[i] = Math.abs(a[i][i]) > 1e-20 ? sum / a[i][i] : 0;
  }
  return x;
}

// Solve complex matrix equation
function solveComplex(A: Complex[][], b: Complex[], n: number): Complex[] {
  const a = A.map((row) => row.map((c) => ({ ...c })));
  const bb = b.map((c) => ({ ...c }));

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (cxMag(a[row][col]) > cxMag(a[maxRow][col])) maxRow = row;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [bb[col], bb[maxRow]] = [bb[maxRow], bb[col]];

    if (cxMag(a[col][col]) < 1e-20) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = cxDiv(a[row][col], a[col][col]);
      for (let j = col; j < n; j++) a[row][j] = cxSub(a[row][j], cxMul(factor, a[col][j]));
      bb[row] = cxSub(bb[row], cxMul(factor, bb[col]));
    }
  }

  const x: Complex[] = new Array(n).fill(null).map(() => cx(0));
  for (let i = n - 1; i >= 0; i--) {
    let sum = { ...bb[i] };
    for (let j = i + 1; j < n; j++) sum = cxSub(sum, cxMul(a[i][j], x[j]));
    x[i] = cxMag(a[i][i]) > 1e-20 ? cxDiv(sum, a[i][i]) : cx(0);
  }
  return x;
}

// DC Operating Point
export function solveDC(
  components: SpiceComponent[],
  nodeCount: number
): { nodeVoltages: number[]; branchCurrents: Map<string, number> } {
  // Count voltage sources for extra MNA variables
  const vSources = components.filter((c) => c.type === "V");
  const n = nodeCount - 1 + vSources.length; // exclude ground node 0
  const G = Array.from({ length: n }, () => new Array(n).fill(0));
  const I = new Array(n).fill(0);

  const idx = (node: number) => node - 1; // node 0 = ground, not in matrix

  // Stamp components
  components.forEach((comp) => {
    const { type, nodeP, nodeN, value } = comp;
    const p = nodeP > 0 ? idx(nodeP) : -1;
    const nN = nodeN > 0 ? idx(nodeN) : -1;

    if (type === "R") {
      const g = 1 / value;
      if (p >= 0) G[p][p] += g;
      if (nN >= 0) G[nN][nN] += g;
      if (p >= 0 && nN >= 0) { G[p][nN] -= g; G[nN][p] -= g; }
    } else if (type === "L") {
      // DC: L = short circuit → model as very small resistance
      const g = 1 / 1e-6;
      if (p >= 0) G[p][p] += g;
      if (nN >= 0) G[nN][nN] += g;
      if (p >= 0 && nN >= 0) { G[p][nN] -= g; G[nN][p] -= g; }
    } else if (type === "C") {
      // DC: C = open circuit → do nothing
    } else if (type === "I") {
      if (p >= 0) I[p] -= value;
      if (nN >= 0) I[nN] += value;
    } else if (type === "V") {
      const vi = nodeCount - 1 + vSources.indexOf(comp);
      if (p >= 0) { G[p][vi] += 1; G[vi][p] += 1; }
      if (nN >= 0) { G[nN][vi] -= 1; G[vi][nN] -= 1; }
      I[vi] = value;
    }
  });

  const solution = solveReal(G, I, n);
  const nodeVoltages = [0, ...solution.slice(0, nodeCount - 1)];
  const branchCurrents = new Map<string, number>();
  vSources.forEach((vs, i) => {
    branchCurrents.set(vs.name, solution[nodeCount - 1 + i]);
  });

  // Compute resistor currents
  components.forEach((comp) => {
    if (comp.type === "R") {
      const vDiff = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
      branchCurrents.set(comp.name, vDiff / comp.value);
    }
  });

  return { nodeVoltages, branchCurrents };
}

// AC Sweep
export interface ACSweepResult {
  freq: number;
  nodeVoltages: Complex[];
  magnitude: number[];
  phase: number[];
}

export function solveAC(
  components: SpiceComponent[],
  nodeCount: number,
  fStart: number,
  fStop: number,
  points: number
): ACSweepResult[] {
  const vSources = components.filter((c) => c.type === "V");
  const n = nodeCount - 1 + vSources.length;
  const results: ACSweepResult[] = [];

  for (let i = 0; i <= points; i++) {
    const freq = fStart * Math.pow(fStop / fStart, i / points);
    const w = 2 * Math.PI * freq;

    const G: Complex[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => cx(0))
    );
    const I: Complex[] = new Array(n).fill(null).map(() => cx(0));

    const idx = (node: number) => node - 1;

    components.forEach((comp) => {
      const { type, nodeP, nodeN, value } = comp;
      const p = nodeP > 0 ? idx(nodeP) : -1;
      const nN = nodeN > 0 ? idx(nodeN) : -1;

      let admittance: Complex;

      if (type === "R") {
        admittance = cx(1 / value);
      } else if (type === "L") {
        admittance = cxDiv(cx(1), cx(0, w * value)); // 1/(jwL)
      } else if (type === "C") {
        admittance = cx(0, w * value); // jwC
      } else if (type === "I") {
        if (p >= 0) I[p] = cxSub(I[p], cx(value));
        if (nN >= 0) I[nN] = cxAdd(I[nN], cx(value));
        return;
      } else if (type === "V") {
        const vi = nodeCount - 1 + vSources.indexOf(comp);
        if (p >= 0) {
          G[p][vi] = cxAdd(G[p][vi], cx(1));
          G[vi][p] = cxAdd(G[vi][p], cx(1));
        }
        if (nN >= 0) {
          G[nN][vi] = cxSub(G[nN][vi], cx(1));
          G[vi][nN] = cxSub(G[vi][nN], cx(1));
        }
        I[vi] = cx(comp.acMag || value);
        return;
      } else {
        return;
      }

      if (p >= 0) G[p][p] = cxAdd(G[p][p], admittance);
      if (nN >= 0) G[nN][nN] = cxAdd(G[nN][nN], admittance);
      if (p >= 0 && nN >= 0) {
        G[p][nN] = cxSub(G[p][nN], admittance);
        G[nN][p] = cxSub(G[nN][p], admittance);
      }
    });

    const solution = solveComplex(G, I, n);
    const nodeVoltages = [cx(0), ...solution.slice(0, nodeCount - 1)];

    results.push({
      freq,
      nodeVoltages,
      magnitude: nodeVoltages.map((v) => 20 * Math.log10(Math.max(cxMag(v), 1e-20))),
      phase: nodeVoltages.map((v) => cxPhase(v)),
    });
  }

  return results;
}

// Transient Analysis using Backward Euler
export interface TransientResult {
  time: number;
  nodeVoltages: number[];
}

export function solveTransient(
  components: SpiceComponent[],
  nodeCount: number,
  tStop: number,
  dt: number
): TransientResult[] {
  const vSources = components.filter((c) => c.type === "V");
  const n = nodeCount - 1 + vSources.length;
  const results: TransientResult[] = [];

  // State: capacitor voltages and inductor currents
  const capState = new Map<string, number>();
  const indState = new Map<string, number>();
  components.forEach((c) => {
    if (c.type === "C") capState.set(c.name, 0);
    if (c.type === "L") indState.set(c.name, 0);
  });

  const steps = Math.min(Math.ceil(tStop / dt), 5000);

  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    const I = new Array(n).fill(0);
    const idx = (node: number) => node - 1;

    components.forEach((comp) => {
      const { type, nodeP, nodeN, value } = comp;
      const p = nodeP > 0 ? idx(nodeP) : -1;
      const nN = nodeN > 0 ? idx(nodeN) : -1;

      if (type === "R") {
        const g = 1 / value;
        if (p >= 0) G[p][p] += g;
        if (nN >= 0) G[nN][nN] += g;
        if (p >= 0 && nN >= 0) { G[p][nN] -= g; G[nN][p] -= g; }
      } else if (type === "C") {
        // Companion model: G_eq = C/dt, I_eq = C/dt * v_prev
        const geq = value / dt;
        const ieq = geq * (capState.get(comp.name) || 0);
        if (p >= 0) { G[p][p] += geq; I[p] += ieq; }
        if (nN >= 0) { G[nN][nN] += geq; I[nN] -= ieq; }  // fixed: was += ieq
        if (p >= 0 && nN >= 0) { G[p][nN] -= geq; G[nN][p] -= geq; }
      } else if (type === "L") {
        // Companion model: G_eq = dt/L, I_eq = i_prev
        const geq = dt / value;
        const ieq = indState.get(comp.name) || 0;
        if (p >= 0) { G[p][p] += geq; I[p] += ieq; }
        if (nN >= 0) { G[nN][nN] += geq; I[nN] -= ieq; }
        if (p >= 0 && nN >= 0) { G[p][nN] -= geq; G[nN][p] -= geq; }
      } else if (type === "I") {
        if (p >= 0) I[p] -= value;
        if (nN >= 0) I[nN] += value;
      } else if (type === "V") {
        const vi = nodeCount - 1 + vSources.indexOf(comp);
        if (p >= 0) { G[p][vi] += 1; G[vi][p] += 1; }
        if (nN >= 0) { G[nN][vi] -= 1; G[vi][nN] -= 1; }
        I[vi] = value;
      }
    });

    const solution = solveReal(G, I, n);
    const nodeVoltages = [0, ...solution.slice(0, nodeCount - 1)];

    // Update state
    components.forEach((comp) => {
      if (comp.type === "C") {
        const vDiff = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
        capState.set(comp.name, vDiff);
      }
      if (comp.type === "L") {
        const vDiff = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
        const iPrev = indState.get(comp.name) || 0;
        indState.set(comp.name, iPrev + (dt / comp.value) * vDiff);
      }
    });

    if (step % Math.max(1, Math.floor(steps / 1000)) === 0 || step === steps) {
      results.push({ time: t, nodeVoltages: [...nodeVoltages] });
    }
  }

  return results;
}

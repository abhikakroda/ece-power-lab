// Lightweight SPICE engine: MNA-based solver for R, L, C, V, I, D, Q (BJT), M (MOSFET)
// Supports DC operating point (with Newton-Raphson for nonlinear), AC sweep, and transient analysis

export interface SpiceComponent {
  type: "R" | "L" | "C" | "V" | "I" | "D" | "Q" | "M";
  name: string;
  nodeP: number;  // For D: anode; Q: collector; M: drain
  nodeN: number;  // For D: cathode; Q: emitter; M: source
  nodeCtrl?: number; // Q: base; M: gate
  value: number;
  // Diode params
  Is?: number;    // Saturation current (default 1e-14)
  N?: number;     // Ideality factor (default 1)
  // BJT params
  Bf?: number;    // Forward beta (default 100)
  BjIs?: number;  // BJT Is (default 1e-14)
  // MOSFET params
  Vth?: number;   // Threshold voltage (default 0.7)
  Kp?: number;    // Transconductance parameter (default 200e-6)
  Lambda?: number; // Channel length modulation (default 0.01)
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

const VT = 0.02585; // Thermal voltage at 300K

// Diode model: Id = Is * (exp(Vd / (N*VT)) - 1)
function diodeCurrent(vd: number, Is: number, N: number): number {
  const vClamp = Math.min(vd, 0.8); // prevent overflow
  return Is * (Math.exp(vClamp / (N * VT)) - 1);
}

function diodeConductance(vd: number, Is: number, N: number): number {
  const vClamp = Math.min(vd, 0.8);
  return (Is / (N * VT)) * Math.exp(vClamp / (N * VT));
}

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

  const parseParam = (parts: string[], key: string, def: number): number => {
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (lower.startsWith(key.toLowerCase() + "=")) {
        return parseValue(p.split("=")[1]);
      }
    }
    return def;
  };

  const components: SpiceComponent[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const name = parts[0].toUpperCase();
    const type = name[0];

    if (["R", "L", "C", "V", "I"].includes(type)) {
      if (parts.length < 4) continue;
      const nodeP = getNode(parts[1]);
      const nodeN = getNode(parts[2]);
      const value = parseValue(parts[3]);
      components.push({ type: type as SpiceComponent["type"], name, nodeP, nodeN, value });
    } else if (type === "D") {
      // D1 anode cathode [Is=1e-14] [N=1]
      if (parts.length < 3) continue;
      const nodeP = getNode(parts[1]); // anode
      const nodeN = getNode(parts[2]); // cathode
      const Is = parseParam(parts, "Is", 1e-14);
      const N = parseParam(parts, "N", 1);
      components.push({ type: "D", name, nodeP, nodeN, value: 0, Is, N });
    } else if (type === "Q") {
      // Q1 collector base emitter [Bf=100] [Is=1e-14]
      if (parts.length < 4) continue;
      const nodeP = getNode(parts[1]);   // collector
      const nodeCtrl = getNode(parts[2]); // base
      const nodeN = getNode(parts[3]);   // emitter
      const Bf = parseParam(parts, "Bf", 100);
      const BjIs = parseParam(parts, "Is", 1e-14);
      components.push({ type: "Q", name, nodeP, nodeN, nodeCtrl, value: 0, Bf, BjIs });
    } else if (type === "M") {
      // M1 drain gate source [Vth=0.7] [Kp=200u] [Lambda=0.01]
      if (parts.length < 4) continue;
      const nodeP = getNode(parts[1]);   // drain
      const nodeCtrl = getNode(parts[2]); // gate
      const nodeN = getNode(parts[3]);   // source
      const Vth = parseParam(parts, "Vth", 0.7);
      const Kp = parseParam(parts, "Kp", 200e-6);
      const Lambda = parseParam(parts, "Lambda", 0.01);
      components.push({ type: "M", name, nodeP, nodeN, nodeCtrl, value: 0, Vth, Kp, Lambda });
    }
  }

  return { components, nodeCount: nextNode };
}

// Solve real matrix equation Ax = b using Gaussian elimination with partial pivoting
function solveReal(A: number[][], b: number[], n: number): number[] {
  const a = A.map((row) => [...row]);
  const bb = [...b];

  for (let col = 0; col < n; col++) {
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

// Helper to stamp linear RLC V I into MNA
function stampLinear(
  comp: SpiceComponent, G: number[][], I: number[],
  nodeCount: number, vSources: SpiceComponent[],
  _dt?: number, capState?: Map<string, number>, indState?: Map<string, number>
) {
  const { type, nodeP, nodeN, value } = comp;
  const idx = (node: number) => node - 1;
  const p = nodeP > 0 ? idx(nodeP) : -1;
  const nN = nodeN > 0 ? idx(nodeN) : -1;

  if (type === "R") {
    const g = 1 / value;
    if (p >= 0) G[p][p] += g;
    if (nN >= 0) G[nN][nN] += g;
    if (p >= 0 && nN >= 0) { G[p][nN] -= g; G[nN][p] -= g; }
  } else if (type === "L") {
    if (_dt && indState) {
      const geq = _dt / value;
      const ieq = indState.get(comp.name) || 0;
      if (p >= 0) { G[p][p] += geq; I[p] += ieq; }
      if (nN >= 0) { G[nN][nN] += geq; I[nN] -= ieq; }
      if (p >= 0 && nN >= 0) { G[p][nN] -= geq; G[nN][p] -= geq; }
    } else {
      // DC: short circuit
      const g = 1 / 1e-6;
      if (p >= 0) G[p][p] += g;
      if (nN >= 0) G[nN][nN] += g;
      if (p >= 0 && nN >= 0) { G[p][nN] -= g; G[nN][p] -= g; }
    }
  } else if (type === "C") {
    if (_dt && capState) {
      const geq = value / _dt;
      const ieq = geq * (capState.get(comp.name) || 0);
      if (p >= 0) { G[p][p] += geq; I[p] += ieq; }
      if (nN >= 0) { G[nN][nN] += geq; I[nN] -= ieq; }
      if (p >= 0 && nN >= 0) { G[p][nN] -= geq; G[nN][p] -= geq; }
    }
    // DC: open circuit, do nothing
  } else if (type === "I") {
    if (p >= 0) I[p] -= value;
    if (nN >= 0) I[nN] += value;
  } else if (type === "V") {
    const vi = nodeCount - 1 + vSources.indexOf(comp);
    if (p >= 0) { G[p][vi] += 1; G[vi][p] += 1; }
    if (nN >= 0) { G[nN][vi] -= 1; G[vi][nN] -= 1; }
    I[vi] = value;
  }
}

// Stamp nonlinear devices using companion model (linearized at operating point)
function stampNonlinear(
  comp: SpiceComponent, G: number[][], I: number[],
  nodeVoltages: number[]
) {
  const idx = (node: number) => node - 1;

  if (comp.type === "D") {
    const Is = comp.Is || 1e-14;
    const N = comp.N || 1;
    const vA = nodeVoltages[comp.nodeP]; // anode
    const vK = nodeVoltages[comp.nodeN]; // cathode
    const vd = vA - vK;
    const id = diodeCurrent(vd, Is, N);
    const gd = diodeConductance(vd, Is, N) + 1e-12; // add gmin
    const ieq = id - gd * vd;

    const pA = comp.nodeP > 0 ? idx(comp.nodeP) : -1;
    const pK = comp.nodeN > 0 ? idx(comp.nodeN) : -1;

    if (pA >= 0) { G[pA][pA] += gd; I[pA] -= ieq; }
    if (pK >= 0) { G[pK][pK] += gd; I[pK] += ieq; }
    if (pA >= 0 && pK >= 0) { G[pA][pK] -= gd; G[pK][pA] -= gd; }
  } else if (comp.type === "Q") {
    // Simple Ebers-Moll NPN BJT
    const Bf = comp.Bf || 100;
    const Is = comp.BjIs || 1e-14;
    const vB = nodeVoltages[comp.nodeCtrl!]; // base
    const vE = nodeVoltages[comp.nodeN];     // emitter
    const vC = nodeVoltages[comp.nodeP];     // collector
    const vBE = vB - vE;
    const vBC = vB - vC;

    // Forward: BE junction
    const iBE = diodeCurrent(vBE, Is, 1);
    const gBE = diodeConductance(vBE, Is, 1) + 1e-12;
    // Collector current: Ic = Bf * Ib = Bf * (iBE / (Bf+1)) ≈ alpha * iBE
    const iC = (Bf / (Bf + 1)) * iBE;
    const gmf = (Bf / (Bf + 1)) * gBE;
    // Base current
    const iB = iBE / (Bf + 1);
    const gpi = gBE / (Bf + 1);

    const pC = comp.nodeP > 0 ? idx(comp.nodeP) : -1;
    const pB = comp.nodeCtrl! > 0 ? idx(comp.nodeCtrl!) : -1;
    const pE = comp.nodeN > 0 ? idx(comp.nodeN) : -1;

    // Base-emitter: gpi between B and E
    const ieqBE = iB - gpi * vBE;
    if (pB >= 0) { G[pB][pB] += gpi; I[pB] -= ieqBE; }
    if (pE >= 0) { G[pE][pE] += gpi; I[pE] += ieqBE; }
    if (pB >= 0 && pE >= 0) { G[pB][pE] -= gpi; G[pE][pB] -= gpi; }

    // Collector current: gmf * vBE (VCCS from B-E controlling C-E)
    const ieqC = iC - gmf * vBE;
    if (pC >= 0 && pB >= 0) { G[pC][pB] += gmf; }
    if (pC >= 0 && pE >= 0) { G[pC][pE] -= gmf; }
    if (pE >= 0 && pB >= 0) { G[pE][pB] -= gmf; }
    if (pE >= 0) { G[pE][pE] += gmf; }
    if (pC >= 0) I[pC] -= ieqC;
    if (pE >= 0) I[pE] += ieqC;

  } else if (comp.type === "M") {
    // NMOS Level 1 MOSFET
    const Vth = comp.Vth || 0.7;
    const Kp = comp.Kp || 200e-6;
    const Lambda = comp.Lambda || 0.01;

    const vG = nodeVoltages[comp.nodeCtrl!]; // gate
    const vS = nodeVoltages[comp.nodeN];     // source
    const vD = nodeVoltages[comp.nodeP];     // drain

    const vGS = vG - vS;
    const vDS = vD - vS;
    const vOV = vGS - Vth;

    let iD: number, gm: number, gds: number;

    if (vOV <= 0) {
      // Cutoff
      iD = 0;
      gm = 0;
      gds = 1e-12; // gmin
    } else if (vDS >= vOV) {
      // Saturation
      iD = 0.5 * Kp * vOV * vOV * (1 + Lambda * vDS);
      gm = Kp * vOV * (1 + Lambda * vDS);
      gds = 0.5 * Kp * vOV * vOV * Lambda + 1e-12;
    } else {
      // Triode/Linear
      iD = Kp * (vOV * vDS - 0.5 * vDS * vDS) * (1 + Lambda * vDS);
      gm = Kp * vDS * (1 + Lambda * vDS);
      gds = Kp * (vOV - vDS) * (1 + Lambda * vDS) + Kp * (vOV * vDS - 0.5 * vDS * vDS) * Lambda + 1e-12;
    }

    const pD = comp.nodeP > 0 ? idx(comp.nodeP) : -1;
    const pG = comp.nodeCtrl! > 0 ? idx(comp.nodeCtrl!) : -1;
    const pS = comp.nodeN > 0 ? idx(comp.nodeN) : -1;

    // Ieq = iD - gm*vGS - gds*vDS
    const ieq = iD - gm * vGS - gds * vDS;

    // gm stamps (VCCS: gm * vGS)
    if (pD >= 0 && pG >= 0) G[pD][pG] += gm;
    if (pD >= 0 && pS >= 0) G[pD][pS] -= gm;
    if (pS >= 0 && pG >= 0) G[pS][pG] -= gm;
    if (pS >= 0) G[pS][pS] += gm;

    // gds stamps (conductance between D and S)
    if (pD >= 0) G[pD][pD] += gds;
    if (pS >= 0) G[pS][pS] += gds;
    if (pD >= 0 && pS >= 0) { G[pD][pS] -= gds; G[pS][pD] -= gds; }

    // Current source stamps
    if (pD >= 0) I[pD] -= ieq;
    if (pS >= 0) I[pS] += ieq;
  }
}

// DC Operating Point with Newton-Raphson for nonlinear devices
export function solveDC(
  components: SpiceComponent[],
  nodeCount: number
): { nodeVoltages: number[]; branchCurrents: Map<string, number> } {
  const vSources = components.filter((c) => c.type === "V");
  const linearComps = components.filter((c) => ["R", "L", "C", "V", "I"].includes(c.type));
  const nonlinearComps = components.filter((c) => ["D", "Q", "M"].includes(c.type));
  const n = nodeCount - 1 + vSources.length;

  // Initial guess
  let nodeVoltages = new Array(nodeCount).fill(0);

  const maxIter = nonlinearComps.length > 0 ? 50 : 1;

  for (let iter = 0; iter < maxIter; iter++) {
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    const I = new Array(n).fill(0);

    // Stamp linear components
    for (const comp of linearComps) {
      stampLinear(comp, G, I, nodeCount, vSources);
    }

    // Stamp nonlinear components (linearized at current operating point)
    for (const comp of nonlinearComps) {
      stampNonlinear(comp, G, I, nodeVoltages);
    }

    const solution = solveReal(G, I, n);
    const newVoltages = [0, ...solution.slice(0, nodeCount - 1)];

    // Check convergence
    if (nonlinearComps.length > 0) {
      let maxDiff = 0;
      for (let i = 1; i < nodeCount; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(newVoltages[i] - nodeVoltages[i]));
      }
      nodeVoltages = newVoltages;
      if (maxDiff < 1e-9) break;
    } else {
      nodeVoltages = newVoltages;
      break;
    }
  }

  const branchCurrents = new Map<string, number>();
  const solution2 = [...nodeVoltages.slice(1)]; // for voltage source currents we need to re-solve
  // Re-extract voltage source currents
  {
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    const I = new Array(n).fill(0);
    for (const comp of linearComps) stampLinear(comp, G, I, nodeCount, vSources);
    for (const comp of nonlinearComps) stampNonlinear(comp, G, I, nodeVoltages);
    const sol = solveReal(G, I, n);
    vSources.forEach((vs, i) => {
      branchCurrents.set(vs.name, sol[nodeCount - 1 + i]);
    });
  }

  // Compute resistor currents
  components.forEach((comp) => {
    if (comp.type === "R") {
      const vDiff = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
      branchCurrents.set(comp.name, vDiff / comp.value);
    }
    if (comp.type === "D") {
      const vd = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
      branchCurrents.set(comp.name, diodeCurrent(vd, comp.Is || 1e-14, comp.N || 1));
    }
    if (comp.type === "Q") {
      const vBE = nodeVoltages[comp.nodeCtrl!] - nodeVoltages[comp.nodeN];
      const iBE = diodeCurrent(vBE, comp.BjIs || 1e-14, 1);
      const iC = ((comp.Bf || 100) / ((comp.Bf || 100) + 1)) * iBE;
      branchCurrents.set(comp.name + "_IC", iC);
      branchCurrents.set(comp.name + "_IB", iBE / ((comp.Bf || 100) + 1));
    }
    if (comp.type === "M") {
      const vGS = nodeVoltages[comp.nodeCtrl!] - nodeVoltages[comp.nodeN];
      const vDS = nodeVoltages[comp.nodeP] - nodeVoltages[comp.nodeN];
      const Vth = comp.Vth || 0.7;
      const Kp = comp.Kp || 200e-6;
      const Lambda = comp.Lambda || 0.01;
      const vOV = vGS - Vth;
      let iD = 0;
      if (vOV > 0) {
        if (vDS >= vOV) iD = 0.5 * Kp * vOV * vOV * (1 + Lambda * vDS);
        else iD = Kp * (vOV * vDS - 0.5 * vDS * vDS) * (1 + Lambda * vDS);
      }
      branchCurrents.set(comp.name + "_ID", iD);
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
  // First, find DC operating point for linearization
  const dcResult = solveDC(components, nodeCount);
  const dcV = dcResult.nodeVoltages;

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
        admittance = cxDiv(cx(1), cx(0, w * value));
      } else if (type === "C") {
        admittance = cx(0, w * value);
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
      } else if (type === "D") {
        // Small-signal: conductance at DC operating point
        const vd = dcV[nodeP] - dcV[nodeN];
        const gd = diodeConductance(vd, comp.Is || 1e-14, comp.N || 1) + 1e-12;
        admittance = cx(gd);
      } else if (type === "Q") {
        // Small-signal BJT: gpi and gm
        const vBE = dcV[comp.nodeCtrl!] - dcV[nodeN];
        const gBE = diodeConductance(vBE, comp.BjIs || 1e-14, 1) + 1e-12;
        const Bf = comp.Bf || 100;
        const gpi = gBE / (Bf + 1);
        const gmf = (Bf / (Bf + 1)) * gBE;

        const pC = nodeP > 0 ? idx(nodeP) : -1;
        const pB = comp.nodeCtrl! > 0 ? idx(comp.nodeCtrl!) : -1;
        const pE = nodeN > 0 ? idx(nodeN) : -1;

        // gpi between B and E
        if (pB >= 0) G[pB][pB] = cxAdd(G[pB][pB], cx(gpi));
        if (pE >= 0) G[pE][pE] = cxAdd(G[pE][pE], cx(gpi));
        if (pB >= 0 && pE >= 0) {
          G[pB][pE] = cxSub(G[pB][pE], cx(gpi));
          G[pE][pB] = cxSub(G[pE][pB], cx(gpi));
        }
        // gm VCCS
        if (pC >= 0 && pB >= 0) G[pC][pB] = cxAdd(G[pC][pB], cx(gmf));
        if (pC >= 0 && pE >= 0) G[pC][pE] = cxSub(G[pC][pE], cx(gmf));
        if (pE >= 0 && pB >= 0) G[pE][pB] = cxSub(G[pE][pB], cx(gmf));
        if (pE >= 0) G[pE][pE] = cxAdd(G[pE][pE], cx(gmf));
        return;
      } else if (type === "M") {
        // Small-signal MOSFET: gm and gds
        const vGS = dcV[comp.nodeCtrl!] - dcV[nodeN];
        const vDS = dcV[nodeP] - dcV[nodeN];
        const Vth = comp.Vth || 0.7;
        const Kp = comp.Kp || 200e-6;
        const Lambda = comp.Lambda || 0.01;
        const vOV = vGS - Vth;

        let gm = 0, gds = 1e-12;
        if (vOV > 0) {
          if (vDS >= vOV) {
            gm = Kp * vOV * (1 + Lambda * vDS);
            gds = 0.5 * Kp * vOV * vOV * Lambda + 1e-12;
          } else {
            gm = Kp * vDS * (1 + Lambda * vDS);
            gds = Kp * (vOV - vDS) * (1 + Lambda * vDS) + 1e-12;
          }
        }

        const pD = nodeP > 0 ? idx(nodeP) : -1;
        const pG = comp.nodeCtrl! > 0 ? idx(comp.nodeCtrl!) : -1;
        const pS = nodeN > 0 ? idx(nodeN) : -1;

        // gm
        if (pD >= 0 && pG >= 0) G[pD][pG] = cxAdd(G[pD][pG], cx(gm));
        if (pD >= 0 && pS >= 0) G[pD][pS] = cxSub(G[pD][pS], cx(gm));
        if (pS >= 0 && pG >= 0) G[pS][pG] = cxSub(G[pS][pG], cx(gm));
        if (pS >= 0) G[pS][pS] = cxAdd(G[pS][pS], cx(gm));
        // gds
        if (pD >= 0) G[pD][pD] = cxAdd(G[pD][pD], cx(gds));
        if (pS >= 0) G[pS][pS] = cxAdd(G[pS][pS], cx(gds));
        if (pD >= 0 && pS >= 0) {
          G[pD][pS] = cxSub(G[pD][pS], cx(gds));
          G[pS][pD] = cxSub(G[pS][pD], cx(gds));
        }
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

// Transient Analysis using Backward Euler + Newton-Raphson
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
  const linearComps = components.filter((c) => ["R", "L", "C", "V", "I"].includes(c.type));
  const nonlinearComps = components.filter((c) => ["D", "Q", "M"].includes(c.type));
  const n = nodeCount - 1 + vSources.length;
  const results: TransientResult[] = [];

  const capState = new Map<string, number>();
  const indState = new Map<string, number>();
  components.forEach((c) => {
    if (c.type === "C") capState.set(c.name, 0);
    if (c.type === "L") indState.set(c.name, 0);
  });

  const steps = Math.min(Math.ceil(tStop / dt), 5000);
  let nodeVoltages = new Array(nodeCount).fill(0);

  for (let step = 0; step <= steps; step++) {
    const maxNR = nonlinearComps.length > 0 ? 20 : 1;

    for (let nrIter = 0; nrIter < maxNR; nrIter++) {
      const G = Array.from({ length: n }, () => new Array(n).fill(0));
      const I = new Array(n).fill(0);

      for (const comp of linearComps) {
        stampLinear(comp, G, I, nodeCount, vSources, dt, capState, indState);
      }
      for (const comp of nonlinearComps) {
        stampNonlinear(comp, G, I, nodeVoltages);
      }

      const solution = solveReal(G, I, n);
      const newVoltages = [0, ...solution.slice(0, nodeCount - 1)];

      if (nonlinearComps.length > 0) {
        let maxDiff = 0;
        for (let i = 1; i < nodeCount; i++) {
          maxDiff = Math.max(maxDiff, Math.abs(newVoltages[i] - nodeVoltages[i]));
        }
        nodeVoltages = newVoltages;
        if (maxDiff < 1e-6) break;
      } else {
        nodeVoltages = newVoltages;
        break;
      }
    }

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
      results.push({ time: step * dt, nodeVoltages: [...nodeVoltages] });
    }
  }

  return results;
}

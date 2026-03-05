// Control Systems math utilities
// Transfer function analysis, root finding, step/impulse response, Bode plot

import { type Complex, cx, cxAdd, cxSub, cxMul, cxDiv, cxMag, cxPhase } from "./spice-engine";

// Evaluate polynomial at complex point s
export function polyEval(coeffs: number[], s: Complex): Complex {
  // coeffs[0] = highest order coefficient
  let result = cx(0);
  for (let i = 0; i < coeffs.length; i++) {
    result = cxAdd(cxMul(result, s), cx(coeffs[i]));
  }
  return result;
}

// Find roots of polynomial using Durand-Kerner method
export function findRoots(coeffs: number[]): Complex[] {
  const n = coeffs.length - 1; // degree
  if (n <= 0) return [];
  if (n === 1) return [cx(-coeffs[1] / coeffs[0])];
  if (n === 2) {
    const a = coeffs[0], b = coeffs[1], c = coeffs[2];
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      return [cx((-b + Math.sqrt(disc)) / (2 * a)), cx((-b - Math.sqrt(disc)) / (2 * a))];
    }
    const re = -b / (2 * a);
    const im = Math.sqrt(-disc) / (2 * a);
    return [cx(re, im), cx(re, -im)];
  }

  // Normalize
  const norm = coeffs.map((c) => c / coeffs[0]);

  // Initial guesses on a circle
  const roots: Complex[] = [];
  const r = Math.pow(Math.abs(norm[norm.length - 1]), 1 / n) + 1;
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.3;
    roots.push(cx(r * Math.cos(angle), r * Math.sin(angle)));
  }

  // Iterate
  for (let iter = 0; iter < 100; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      const pVal = polyEval(norm, roots[i]);
      let denom = cx(1);
      for (let j = 0; j < n; j++) {
        if (j !== i) denom = cxMul(denom, cxSub(roots[i], roots[j]));
      }
      const delta = cxDiv(pVal, denom);
      roots[i] = cxSub(roots[i], delta);
      maxDelta = Math.max(maxDelta, cxMag(delta));
    }
    if (maxDelta < 1e-10) break;
  }

  // Clean up near-real roots
  return roots.map((r) => Math.abs(r.im) < 1e-8 ? cx(r.re) : r);
}

// Reconstruct polynomial coefficients from roots: (s - r1)(s - r2)...
// Returns real coefficients (highest power first)
export function rootsToCoeffs(roots: Complex[]): number[] {
  if (roots.length === 0) return [1];
  // Start with [1]
  let coeffs: Complex[] = [cx(1)];
  for (const root of roots) {
    // Multiply by (s - root)
    const newCoeffs: Complex[] = new Array(coeffs.length + 1).fill(null).map(() => cx(0));
    for (let i = 0; i < coeffs.length; i++) {
      newCoeffs[i] = cxAdd(newCoeffs[i], coeffs[i]); // s term
      newCoeffs[i + 1] = cxSub(newCoeffs[i + 1], cxMul(coeffs[i], root)); // -root term
    }
    coeffs = newCoeffs;
  }
  return coeffs.map(c => {
    const v = c.re;
    return Math.abs(v) < 1e-10 ? 0 : parseFloat(v.toFixed(10));
  });
}

export function evalTF(num: number[], den: number[], s: Complex): Complex {
  return cxDiv(polyEval(num, s), polyEval(den, s));
}

// Bode data
export interface BodePoint {
  freq: number;
  magnitude: number; // dB
  phase: number; // degrees
}

export function computeBode(num: number[], den: number[], fStart: number, fStop: number, points: number): BodePoint[] {
  const data: BodePoint[] = [];
  for (let i = 0; i <= points; i++) {
    const freq = fStart * Math.pow(fStop / fStart, i / points);
    const s = cx(0, 2 * Math.PI * freq);
    const H = evalTF(num, den, s);
    data.push({
      freq,
      magnitude: 20 * Math.log10(Math.max(cxMag(H), 1e-20)),
      phase: cxPhase(H),
    });
  }
  return data;
}

// Step response via state-space simulation
export interface TimeResponse {
  time: number;
  value: number;
}

export function computeStepResponse(num: number[], den: number[], tStop: number, points: number): TimeResponse[] {
  // Convert to controllable canonical form
  const n = den.length - 1; // system order
  if (n === 0) return [{ time: 0, value: num[0] / den[0] }];

  // Normalize denominator
  const a0 = den[0];
  const aN = den.map((d) => d / a0);
  const bN = num.map((b) => b / a0);

  // Pad numerator to match
  while (bN.length < den.length) bN.unshift(0);

  const dt = tStop / points;
  const x = new Array(n).fill(0); // state
  const data: TimeResponse[] = [];

  for (let i = 0; i <= points; i++) {
    const t = i * dt;

    // Output: y = c^T x + d*u
    // For controllable canonical form:
    // A = companion matrix, B = [0,...,0,1]^T
    // C = [b_n - a_n*b_0, ..., b_1 - a_1*b_0], D = b_0
    const d = bN[0];
    const c = bN.slice(1).map((b, i) => b - aN[i + 1] * d);

    const u = 1; // step input
    let y = d * u;
    for (let j = 0; j < n; j++) {
      y += (c[j] || 0) * x[j];
    }
    data.push({ time: t, value: y });

    // State update: dx/dt = Ax + Bu (Euler method)
    const xNew = new Array(n).fill(0);
    for (let j = 0; j < n - 1; j++) {
      xNew[j] = x[j] + dt * x[j + 1];
    }
    // Last state equation
    let lastDeriv = u; // B = [0,...,1]
    for (let j = 0; j < n; j++) {
      lastDeriv -= aN[n - j] * x[j];
    }
    xNew[n - 1] = x[n - 1] + dt * lastDeriv;

    for (let j = 0; j < n; j++) x[j] = xNew[j];
  }

  return data;
}

export function computeImpulseResponse(num: number[], den: number[], tStop: number, points: number): TimeResponse[] {
  const n = den.length - 1;
  if (n === 0) return [{ time: 0, value: num[0] / den[0] }];

  const a0 = den[0];
  const aN = den.map((d) => d / a0);
  const bN = num.map((b) => b / a0);
  while (bN.length < den.length) bN.unshift(0);

  const dt = tStop / points;
  const x = new Array(n).fill(0);
  const data: TimeResponse[] = [];

  for (let i = 0; i <= points; i++) {
    const t = i * dt;
    const d = bN[0];
    const c = bN.slice(1).map((b, j) => b - aN[j + 1] * d);

    const u = i === 0 ? 1 / dt : 0; // impulse approximation
    let y = d * u;
    for (let j = 0; j < n; j++) y += (c[j] || 0) * x[j];
    data.push({ time: t, value: y });

    const xNew = new Array(n).fill(0);
    for (let j = 0; j < n - 1; j++) xNew[j] = x[j] + dt * x[j + 1];
    let lastDeriv = u;
    for (let j = 0; j < n; j++) lastDeriv -= aN[n - j] * x[j];
    xNew[n - 1] = x[n - 1] + dt * lastDeriv;
    for (let j = 0; j < n; j++) x[j] = xNew[j];
  }

  return data;
}

export interface RootLocusPoint {
  gain: number;
  roots: Complex[];
}

export function computeRootLocus(num: number[], den: number[], kMax: number, points: number): RootLocusPoint[] {
  const data: RootLocusPoint[] = [];

  // To avoid log curve squeezing, we distribute K exponentially after the first few linear steps
  // K goes from 0 to kMax
  const kStep = kMax / points;

  for (let i = 0; i <= points; i++) {
    // Determine K (mix of linear early on and exponential later for better curve capture)
    let K = 0;
    if (i === 0) K = 0;
    else if (i < points * 0.2) {
      K = (i / (points * 0.2)) * (kMax * 0.05); // first 20% of points cover 5% of K range
    } else {
      const logStart = Math.log10(kMax * 0.05);
      const logEnd = Math.log10(kMax);
      const ratio = (i - points * 0.2) / (points * 0.8);
      K = Math.pow(10, logStart + ratio * (logEnd - logStart));
    }

    // Characteristic Equation: Den(s) + K * Num(s) = 0
    // Pad arrays to match highest degree
    const maxLen = Math.max(num.length, den.length);
    const padNum = [...Array(maxLen - num.length).fill(0), ...num];
    const padDen = [...Array(maxLen - den.length).fill(0), ...den];

    const charEq = padDen.map((d, idx) => d + K * padNum[idx]);

    // Find roots of characteristic equation
    const locusRoots = findRoots(charEq);

    data.push({
      gain: K,
      roots: locusRoots
    });
  }

  return data;
}

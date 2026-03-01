import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return x >= 0 ? 1 - poly * Math.exp(-x * x) : -(1 - poly * Math.exp(-x * x));
}
const Q = (x: number) => 0.5 * (1 - erf(x / Math.sqrt(2)));

type CodingType = "none" | "hamming74" | "parity" | "repetition3";

const theoreticalBER: Record<string, (snr: number) => number> = {
  "BPSK": (s) => Q(Math.sqrt(2 * s)),
  "QPSK": (s) => Q(Math.sqrt(2 * s)),
  "8PSK": (s) => (2 / 3) * Q(Math.sqrt(2 * s * 3) * Math.sin(Math.PI / 8)),
  "16-QAM": (s) => (3 / 8) * Q(Math.sqrt(4 * s / 5)),
};

// Hamming(7,4) encode
const hammingEncode = (data: number[]): number[] => {
  const blocks: number[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    const d = data.slice(i, i + 4);
    const p1 = d[0] ^ d[1] ^ d[3];
    const p2 = d[0] ^ d[2] ^ d[3];
    const p3 = d[1] ^ d[2] ^ d[3];
    blocks.push(p1, p2, d[0], p3, d[1], d[2], d[3]);
  }
  return blocks;
};

const hammingDecode = (coded: number[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 6 < coded.length; i += 7) {
    const r = coded.slice(i, i + 7);
    const s1 = r[0] ^ r[2] ^ r[4] ^ r[6];
    const s2 = r[1] ^ r[2] ^ r[5] ^ r[6];
    const s3 = r[3] ^ r[4] ^ r[5] ^ r[6];
    const errPos = s1 + s2 * 2 + s3 * 4;
    if (errPos > 0 && errPos <= 7) r[errPos - 1] ^= 1;
    out.push(r[2], r[4], r[5], r[6]);
  }
  return out;
};

const addParity = (data: number[]): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 7 < data.length; i += 7) {
    const block = data.slice(i, i + 7);
    out.push(...block, block.reduce((a, b) => a ^ b, 0));
  }
  return out;
};

const checkParity = (coded: number[]): { decoded: number[]; detectedErrors: number } => {
  let detected = 0;
  const out: number[] = [];
  for (let i = 0; i + 7 < coded.length; i += 8) {
    const block = coded.slice(i, i + 8);
    const parity = block.reduce((a, b) => a ^ b, 0);
    if (parity !== 0) detected++;
    out.push(...block.slice(0, 7));
  }
  return { decoded: out, detectedErrors: detected };
};

const rep3Encode = (data: number[]) => data.flatMap(b => [b, b, b]);
const rep3Decode = (coded: number[]) => {
  const out: number[] = [];
  for (let i = 0; i + 2 < coded.length; i += 3) {
    out.push(coded[i] + coded[i + 1] + coded[i + 2] >= 2 ? 1 : 0);
  }
  return out;
};

const BERCodingLab = () => {
  const [snrDb, setSnrDb] = useState(8);
  const [coding, setCoding] = useState<CodingType>("none");
  const [numBits, setNumBits] = useState(1000);
  const [seed, setSeed] = useState(0);
  const [showSchemes] = useState<string[]>(["BPSK", "QPSK", "16-QAM"]);

  // Simulate transmission
  const simResult = useMemo(() => {
    const snrLin = Math.pow(10, snrDb / 10);
    const pe = Q(Math.sqrt(2 * snrLin)); // BPSK channel error prob

    // Generate random bits
    let s = seed + 42;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const txBits = Array.from({ length: numBits }, () => rand() > 0.5 ? 1 : 0);

    // Encode
    let encoded: number[];
    let rate: number;
    switch (coding) {
      case "hamming74": encoded = hammingEncode(txBits); rate = 4 / 7; break;
      case "parity": encoded = addParity(txBits); rate = 7 / 8; break;
      case "repetition3": encoded = rep3Encode(txBits); rate = 1 / 3; break;
      default: encoded = [...txBits]; rate = 1; break;
    }

    // Channel (BSC)
    const received = encoded.map(b => rand() < pe ? (b ^ 1) : b);
    const channelErrors = encoded.reduce((acc, b, i) => acc + (b !== received[i] ? 1 : 0), 0);

    // Decode
    let decoded: number[];
    switch (coding) {
      case "hamming74": decoded = hammingDecode(received); break;
      case "parity": decoded = checkParity(received).decoded; break;
      case "repetition3": decoded = rep3Decode(received); break;
      default: decoded = [...received]; break;
    }

    // Count bit errors
    const compareLen = Math.min(txBits.length, decoded.length);
    let bitErrors = 0;
    for (let i = 0; i < compareLen; i++) if (txBits[i] !== decoded[i]) bitErrors++;

    const ber = bitErrors / compareLen;

    return { txBits, decoded, channelErrors, bitErrors, ber, rate, encoded, received, compareLen };
  }, [snrDb, coding, numBits, seed]);

  // BER vs SNR curves
  const berCurves = useMemo(() => {
    const pts: { snr: number; [key: string]: number }[] = [];
    for (let s = 0; s <= 20; s += 0.5) {
      const snrLin = Math.pow(10, s / 10);
      const pt: any = { snr: s };
      for (const scheme of showSchemes) {
        pt[scheme] = Math.max(1e-8, theoreticalBER[scheme](snrLin));
      }
      pts.push(pt);
    }
    return pts;
  }, [showSchemes]);

  // SVG for BER curves
  const berW = 440, berH = 220;
  const berColors: Record<string, string> = { "BPSK": "primary", "QPSK": "chart-2", "8PSK": "chart-3", "16-QAM": "chart-4" };

  const berPaths = useMemo(() => {
    const paths: { scheme: string; path: string; color: string }[] = [];
    const minLog = -8, maxLog = 0;

    for (const scheme of showSchemes) {
      const pts = berCurves.map((pt, i) => {
        const x = 40 + (pt.snr / 20) * (berW - 50);
        const logBer = Math.log10(Math.max(pt[scheme], 1e-8));
        const y = berH - 20 - ((logBer - minLog) / (maxLog - minLog)) * (berH - 40);
        return `${i === 0 ? "M" : "L"} ${x} ${Math.max(15, Math.min(berH - 15, y))}`;
      }).join(" ");
      paths.push({ scheme, path: pts, color: berColors[scheme] || "primary" });
    }
    return paths;
  }, [berCurves, showSchemes]);

  // Operating point
  const opPt = (() => {
    const x = 40 + (snrDb / 20) * (berW - 50);
    const logBer = Math.log10(Math.max(simResult.ber, 1e-8));
    const y = berH - 20 - ((logBer - (-8)) / (0 - (-8))) * (berH - 40);
    return { x, y: Math.max(15, Math.min(berH - 15, y)) };
  })();

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[9px] text-muted-foreground font-mono">SNR (dB)</Label>
            <span className="text-xs font-mono text-primary">{snrDb} dB</span>
          </div>
          <input type="range" min={0} max={20} step={0.5} value={snrDb}
            onChange={e => setSnrDb(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <Label className="text-[9px] text-muted-foreground font-mono">ERROR CORRECTION</Label>
          <div className="flex gap-1 flex-wrap">
            {([["none", "None"], ["hamming74", "Hamming(7,4)"], ["parity", "Parity"], ["repetition3", "Rep-3"]] as [CodingType, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setCoding(id)}
                className={cn("px-2 py-0.5 rounded text-[9px] font-mono border transition-all",
                  coding === id ? "bg-chart-3/15 border-chart-3/40 text-chart-3" : "border-border text-muted-foreground"
                )}>{label}</button>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[9px] text-muted-foreground font-mono">BITS</Label>
            <span className="text-xs font-mono text-chart-4">{numBits}</span>
          </div>
          <input type="range" min={100} max={5000} step={100} value={numBits}
            onChange={e => setNumBits(parseInt(e.target.value))} className="w-full accent-[hsl(var(--chart-4))]" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-center">
          <button onClick={() => setSeed(s => s + 1)}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
            🔄 Retransmit
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Metric label="TX Bits" value={`${simResult.compareLen}`} color="text-primary" />
        <Metric label="Ch. Errors" value={`${simResult.channelErrors}`} color="text-chart-3" />
        <Metric label="Bit Errors" value={`${simResult.bitErrors}`} color={simResult.bitErrors > 0 ? "text-destructive" : "text-primary"} />
        <Metric label="BER" value={simResult.ber.toExponential(2)} color={simResult.ber > 0.01 ? "text-destructive" : "text-primary"} />
        <Metric label="Code Rate" value={`${simResult.rate.toFixed(2)}`} color="text-chart-2" />
        <Metric label="Overhead" value={`${((1 / simResult.rate - 1) * 100).toFixed(0)}%`} color="text-chart-4" />
      </div>

      {/* Bit stream comparison */}
      <div className="p-4 rounded-xl bg-card border border-border overflow-hidden">
        <div className="text-[10px] font-mono text-muted-foreground mb-2">BIT STREAM COMPARISON (first 80 bits)</div>
        <div className="space-y-1.5 overflow-x-auto">
          <div className="flex gap-[1px]">
            <span className="text-[8px] font-mono text-muted-foreground w-8 shrink-0">TX:</span>
            {simResult.txBits.slice(0, 80).map((b, i) => (
              <span key={i} className={cn("text-[9px] font-mono w-[10px] text-center",
                b !== simResult.decoded[i] ? "text-destructive font-bold" : "text-primary"
              )}>{b}</span>
            ))}
          </div>
          <div className="flex gap-[1px]">
            <span className="text-[8px] font-mono text-muted-foreground w-8 shrink-0">RX:</span>
            {simResult.decoded.slice(0, 80).map((b, i) => (
              <span key={i} className={cn("text-[9px] font-mono w-[10px] text-center",
                b !== simResult.txBits[i] ? "text-destructive font-bold bg-destructive/10 rounded" : "text-chart-2"
              )}>{b}</span>
            ))}
          </div>
          <div className="flex gap-[1px]">
            <span className="text-[8px] font-mono text-muted-foreground w-8 shrink-0">Err:</span>
            {simResult.txBits.slice(0, 80).map((b, i) => (
              <span key={i} className="text-[9px] font-mono w-[10px] text-center text-destructive">
                {b !== simResult.decoded[i] ? "×" : " "}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* BER vs SNR */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">BER vs SNR — THEORETICAL COMPARISON</div>
        <svg width="100%" viewBox={`0 0 ${berW} ${berH}`}>
          {/* Grid */}
          {[0, 5, 10, 15, 20].map(s => {
            const x = 40 + (s / 20) * (berW - 50);
            return (
              <g key={s}>
                <line x1={x} y1="15" x2={x} y2={berH - 20} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x={x} y={berH - 6} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{s}</text>
              </g>
            );
          })}
          {[-8, -6, -4, -2, 0].map(l => {
            const y = berH - 20 - ((l - (-8)) / 8) * (berH - 40);
            return (
              <g key={l}>
                <line x1="40" y1={y} x2={berW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x="36" y={y + 3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">10^{l}</text>
              </g>
            );
          })}

          {/* Curves */}
          {berPaths.map(bp => (
            <path key={bp.scheme} d={bp.path} fill="none" stroke={`hsl(var(--${bp.color}))`} strokeWidth="2" />
          ))}

          {/* Operating point */}
          <circle cx={opPt.x} cy={opPt.y} r="5" fill="hsl(var(--destructive))" className="animate-pulse" />
          <text x={opPt.x + 8} y={opPt.y - 5} fontSize="8" fill="hsl(var(--destructive))" fontFamily="monospace" fontWeight="bold">
            Simulated
          </text>

          {/* Legend */}
          {berPaths.map((bp, i) => (
            <g key={bp.scheme}>
              <line x1={berW - 100} y1={20 + i * 12} x2={berW - 80} y2={20 + i * 12} stroke={`hsl(var(--${bp.color}))`} strokeWidth="2" />
              <text x={berW - 76} y={23 + i * 12} fontSize="7" fill={`hsl(var(--${bp.color}))`} fontFamily="monospace">{bp.scheme}</text>
            </g>
          ))}

          <text x={berW / 2} y={berH} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">SNR (dB)</text>
          <text x="8" y={berH / 2} textAnchor="middle" fontSize="8" fill="hsl(var(--primary))" fontFamily="monospace"
            transform={`rotate(-90, 8, ${berH / 2})`}>BER</text>
        </svg>
      </div>

      {/* Coding comparison */}
      {coding !== "none" && (
        <div className="p-4 rounded-xl bg-card border border-chart-3/20">
          <div className="text-xs font-mono text-muted-foreground mb-2">CODING TRADE-OFF ANALYSIS</div>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-primary font-bold">Without Coding</div>
              <div className="text-muted-foreground mt-1">BER ≈ {Q(Math.sqrt(2 * Math.pow(10, snrDb / 10))).toExponential(2)}</div>
              <div className="text-muted-foreground">Rate = 1.0</div>
            </div>
            <div className="p-3 rounded-lg border border-chart-3/30 bg-chart-3/5 text-center">
              <div className="text-chart-3 font-bold">With {coding === "hamming74" ? "Hamming(7,4)" : coding === "parity" ? "Parity" : "Rep-3"}</div>
              <div className="text-muted-foreground mt-1">BER = {simResult.ber.toExponential(2)}</div>
              <div className="text-muted-foreground">Rate = {simResult.rate.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-chart-4 font-bold">Cost</div>
              <div className="text-muted-foreground mt-1">+{((1 / simResult.rate - 1) * 100).toFixed(0)}% overhead</div>
              <div className="text-muted-foreground">{(1 / simResult.rate).toFixed(1)}x bandwidth</div>
            </div>
          </div>
        </div>
      )}

      {/* GATE formulas */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">🎯 GATE Formulas & Traps</div>
        <div>• <span className="text-primary">BPSK BER</span> = Q(√(2E_b/N₀)) — most efficient binary scheme</div>
        <div>• <span className="text-chart-2">QPSK BER</span> = Q(√(2E_b/N₀)) — same BER as BPSK, double throughput!</div>
        <div>• <span className="text-chart-4">16-QAM BER</span> ≈ (3/2)Q(√(4E_b/5N₀)) — worse BER, 4x throughput</div>
        <div>• <span className="text-destructive">Common trap:</span> QPSK has same BER as BPSK per bit (not per symbol)</div>
        <div>• <span className="text-chart-3">Hamming(7,4)</span>: corrects 1 error, detects 2. Coding gain ≈ 1-2 dB</div>
        <div>• <span className="text-chart-4">Shannon limit:</span> C = B·log₂(1 + SNR) — no code can exceed this</div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[7px] text-muted-foreground font-mono">{label}</div>
  </div>
);

export default BERCodingLab;

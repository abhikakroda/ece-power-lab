import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type ModScheme = "BPSK" | "QPSK" | "8PSK" | "16-QAM";

const constellationPts: Record<ModScheme, [number, number][]> = {
  "BPSK": [[-1, 0], [1, 0]],
  "QPSK": [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([i, q]) => [i / Math.sqrt(2), q / Math.sqrt(2)]),
  "8PSK": Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)] as [number, number]),
  "16-QAM": (() => {
    const pts: [number, number][] = [];
    for (let i = -3; i <= 3; i += 2) for (let q = -3; q <= 3; q += 2) pts.push([i / 3, q / 3]);
    return pts;
  })(),
};

function gaussRand(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const ChannelNoiseEngine = () => {
  const [scheme, setScheme] = useState<ModScheme>("QPSK");
  const [snrDb, setSnrDb] = useState(15);
  const [fading, setFading] = useState(0);
  const [phaseNoise, setPhaseNoise] = useState(0);
  const [freqOffset, setFreqOffset] = useState(0);
  const [isi, setIsi] = useState(0);
  const [symbolCount, setSymbolCount] = useState(200);
  const [seed, setSeed] = useState(0);

  // Generate received constellation + eye diagram
  const { rxPoints, eyeData, stats } = useMemo(() => {
    const ideal = constellationPts[scheme];
    const snrLin = Math.pow(10, snrDb / 10);
    const noiseSigma = 1 / Math.sqrt(2 * snrLin);

    const rx: { i: number; q: number; ideal: number }[] = [];
    let errors = 0;

    // Seed-based pseudo-random (simple)
    let s = seed + 1;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    for (let k = 0; k < symbolCount; k++) {
      const idx = Math.floor(rand() * ideal.length);
      let [I, QQ] = ideal[idx];

      // Rayleigh fading
      if (fading > 0) {
        const h = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-10))) * (fading / 100);
        const alpha = 1 - h * 0.5;
        I *= alpha; QQ *= alpha;
      }

      // Phase noise
      if (phaseNoise > 0) {
        const phi = (phaseNoise / 100) * (rand() - 0.5) * Math.PI * 0.5;
        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        const newI = I * cosP - QQ * sinP;
        const newQ = I * sinP + QQ * cosP;
        I = newI; QQ = newQ;
      }

      // Frequency offset (rotation)
      if (freqOffset > 0) {
        const phi = (freqOffset / 100) * k * 0.02;
        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        const newI = I * cosP - QQ * sinP;
        const newQ = I * sinP + QQ * cosP;
        I = newI; QQ = newQ;
      }

      // AWGN
      I += noiseSigma * gaussRand();
      QQ += noiseSigma * gaussRand();

      // ISI
      if (isi > 0 && k > 0) {
        const prev = rx[k - 1];
        I += (isi / 100) * prev.i * 0.3;
        QQ += (isi / 100) * prev.q * 0.3;
      }

      // Decision
      let minDist = Infinity, decidedIdx = 0;
      for (let j = 0; j < ideal.length; j++) {
        const d = (I - ideal[j][0]) ** 2 + (QQ - ideal[j][1]) ** 2;
        if (d < minDist) { minDist = d; decidedIdx = j; }
      }
      if (decidedIdx !== idx) errors++;

      rx.push({ i: I, q: QQ, ideal: idx });
    }

    // Eye diagram: generate baseband pulse train
    const samplesPerSym = 20;
    const totalSamples = symbolCount * samplesPerSym;
    const eyeTraces: { t: number; v: number; trace: number }[] = [];
    const baseband: number[] = new Array(totalSamples).fill(0);

    for (let k = 0; k < symbolCount; k++) {
      const sym = ideal[rx[k].ideal][0]; // I component
      // Raised cosine pulse (simplified)
      for (let n = 0; n < samplesPerSym; n++) {
        const t = n / samplesPerSym - 0.5;
        const rc = Math.cos(Math.PI * 0.5 * t) * (Math.abs(t) < 1 ? 1 : 0);
        baseband[k * samplesPerSym + n] += sym * rc;
      }
      // ISI from neighbors
      if (isi > 0 && k > 0) {
        const prevSym = ideal[rx[k - 1].ideal][0];
        for (let n = 0; n < samplesPerSym; n++) {
          baseband[k * samplesPerSym + n] += prevSym * (isi / 100) * 0.2 * Math.exp(-n / samplesPerSym * 3);
        }
      }
    }

    // Add noise to baseband
    for (let i = 0; i < totalSamples; i++) {
      baseband[i] += noiseSigma * 0.5 * gaussRand();
    }

    // Build eye traces (2-symbol wide)
    const tracesPerEye = Math.min(60, Math.floor(symbolCount / 2));
    for (let tr = 0; tr < tracesPerEye; tr++) {
      const startSym = Math.floor(rand() * (symbolCount - 2));
      const startIdx = startSym * samplesPerSym;
      for (let n = 0; n < 2 * samplesPerSym; n++) {
        const idx = startIdx + n;
        if (idx < totalSamples) {
          eyeTraces.push({ t: n / samplesPerSym, v: baseband[idx], trace: tr });
        }
      }
    }

    return {
      rxPoints: rx,
      eyeData: eyeTraces,
      stats: { ser: errors / symbolCount, snr: snrDb, symbols: symbolCount, errors },
    };
  }, [scheme, snrDb, fading, phaseNoise, freqOffset, isi, symbolCount, seed]);

  // Constellation SVG
  const constW = 300, constH = 300;
  const margin = 30;
  const toConstXY = (i: number, q: number) => ({
    x: margin + (i + 1.5) / 3 * (constW - 2 * margin),
    y: constH - margin - (q + 1.5) / 3 * (constH - 2 * margin),
  });

  // Eye SVG
  const eyeW = 400, eyeH = 200;

  const eyeTracesByGroup = useMemo(() => {
    const groups: Map<number, { t: number; v: number }[]> = new Map();
    for (const pt of eyeData) {
      if (!groups.has(pt.trace)) groups.set(pt.trace, []);
      groups.get(pt.trace)!.push({ t: pt.t, v: pt.v });
    }
    return Array.from(groups.values());
  }, [eyeData]);

  const eyeYRange = useMemo(() => {
    const vals = eyeData.map(d => d.v);
    const max = Math.max(...vals.map(Math.abs), 0.01) * 1.2;
    return max;
  }, [eyeData]);

  return (
    <div className="space-y-5">
      {/* Scheme selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(constellationPts) as ModScheme[]).map(s => (
          <button key={s} onClick={() => { setScheme(s); setSeed(p => p + 1); }}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              scheme === s ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>{s}</button>
        ))}
        <button onClick={() => setSeed(s => s + 1)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground">
          🔄 Re-roll
        </button>
      </div>

      {/* Channel controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <CSlider label="SNR" value={snrDb} min={-5} max={40} step={0.5} unit="dB" color="primary" onChange={setSnrDb} />
        <CSlider label="Rayleigh Fading" value={fading} min={0} max={100} step={1} unit="%" color="chart-2" onChange={setFading} />
        <CSlider label="Phase Noise" value={phaseNoise} min={0} max={100} step={1} unit="%" color="chart-3" onChange={setPhaseNoise} />
        <CSlider label="Freq Offset" value={freqOffset} min={0} max={100} step={1} unit="%" color="chart-4" onChange={setFreqOffset} />
        <CSlider label="ISI" value={isi} min={0} max={100} step={1} unit="%" color="destructive" onChange={setIsi} />
        <CSlider label="Symbols" value={symbolCount} min={50} max={1000} step={50} unit="" color="primary" onChange={setSymbolCount} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-lg border border-border bg-card text-center">
          <div className="text-[11px] font-mono font-bold text-primary">{stats.symbols}</div>
          <div className="text-[8px] text-muted-foreground">Symbols</div>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-card text-center">
          <div className={cn("text-[11px] font-mono font-bold", stats.errors > 0 ? "text-destructive" : "text-primary")}>{stats.errors}</div>
          <div className="text-[8px] text-muted-foreground">Errors</div>
        </div>
        <div className={cn("p-2.5 rounded-lg border text-center",
          stats.ser > 0.1 ? "border-destructive/30 bg-destructive/5" : stats.ser > 0.01 ? "border-chart-3/30" : "border-primary/30"
        )}>
          <div className={cn("text-[11px] font-mono font-bold",
            stats.ser > 0.1 ? "text-destructive" : stats.ser > 0.01 ? "text-chart-3" : "text-primary"
          )}>{stats.ser.toExponential(2)}</div>
          <div className="text-[8px] text-muted-foreground">SER</div>
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-card text-center">
          <div className="text-[11px] font-mono font-bold text-chart-2">{snrDb} dB</div>
          <div className="text-[8px] text-muted-foreground">SNR</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Constellation Diagram */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">CONSTELLATION DIAGRAM — {scheme}</div>
          <svg width="100%" viewBox={`0 0 ${constW} ${constH}`} className="bg-muted/20 rounded-lg">
            {/* Grid */}
            <line x1={constW / 2} y1={margin} x2={constW / 2} y2={constH - margin} stroke="hsl(var(--border))" strokeWidth="0.5" />
            <line x1={margin} y1={constH / 2} x2={constW - margin} y2={constH / 2} stroke="hsl(var(--border))" strokeWidth="0.5" />
            <text x={constW - margin + 5} y={constH / 2 + 3} fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">I</text>
            <text x={constW / 2 + 3} y={margin - 5} fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Q</text>

            {/* Ideal points */}
            {constellationPts[scheme].map(([i, q], idx) => {
              const { x, y } = toConstXY(i, q);
              return <circle key={`ideal-${idx}`} cx={x} cy={y} r="6" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.4" />;
            })}

            {/* Received points */}
            {rxPoints.map((pt, idx) => {
              const { x, y } = toConstXY(pt.i, pt.q);
              return <circle key={idx} cx={x} cy={y} r="1.5" fill="hsl(var(--chart-2))" opacity="0.6" />;
            })}
          </svg>
        </div>

        {/* Eye Diagram */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">EYE DIAGRAM</div>
          <svg width="100%" viewBox={`0 0 ${eyeW} ${eyeH}`} className="bg-muted/20 rounded-lg">
            {/* Grid */}
            <line x1="30" y1={eyeH / 2} x2={eyeW - 10} y2={eyeH / 2} stroke="hsl(var(--border))" strokeWidth="0.5" />
            <line x1={30 + (eyeW - 40) / 2} y1="10" x2={30 + (eyeW - 40) / 2} y2={eyeH - 10} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3 3" />

            {/* Traces */}
            {eyeTracesByGroup.map((trace, trIdx) => {
              const path = trace.map((pt, i) => {
                const x = 30 + (pt.t / 2) * (eyeW - 40);
                const y = eyeH / 2 - (pt.v / eyeYRange) * (eyeH / 2 - 15);
                return `${i === 0 ? "M" : "L"} ${x} ${Math.max(5, Math.min(eyeH - 5, y))}`;
              }).join(" ");
              return <path key={trIdx} d={path} fill="none" stroke="hsl(var(--chart-3))" strokeWidth="0.8" opacity="0.35" />;
            })}

            {/* Labels */}
            <text x={eyeW / 2} y={eyeH - 2} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Symbol Period</text>
            <text x="5" y={eyeH / 2} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace" transform={`rotate(-90, 5, ${eyeH / 2})`}>Amplitude</text>

            {/* Eye opening indicator */}
            {(() => {
              const midTraces = eyeTracesByGroup.map(tr => {
                const mid = tr.find(p => Math.abs(p.t - 1) < 0.1);
                return mid?.v ?? 0;
              });
              const eyeOpen = midTraces.length > 1
                ? Math.max(...midTraces) - Math.min(...midTraces)
                : 0;
              const openPct = Math.max(0, (1 - eyeOpen / (2 * eyeYRange)) * 100);
              return (
                <text x={eyeW - 10} y={15} textAnchor="end" fontSize="8" fontFamily="monospace"
                  fill={openPct > 50 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}>
                  Eye: {openPct.toFixed(0)}% open
                </text>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* Distorted waveform */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">RECEIVED BASEBAND (I-channel, first 40 symbols)</div>
        <svg width="100%" viewBox={`0 0 ${eyeW} 120`}>
          {(() => {
            const samplesPerSym = 20;
            const showSyms = Math.min(40, symbolCount);
            const ideal = constellationPts[scheme];
            const pts: string[] = [];
            const idealPts: string[] = [];

            for (let k = 0; k < showSyms; k++) {
              const rx = rxPoints[k];
              if (!rx) continue;
              for (let n = 0; n < samplesPerSym; n++) {
                const x = 30 + (k * samplesPerSym + n) / (showSyms * samplesPerSym) * (eyeW - 40);
                // Ideal
                const idealV = ideal[rx.ideal][0];
                const yIdeal = 60 - idealV * 40;
                idealPts.push(`${idealPts.length === 0 ? "M" : "L"} ${x} ${yIdeal}`);
                // Received (interpolated)
                const t = n / samplesPerSym;
                const v = rx.i * (1 - Math.abs(t - 0.5)) + (k > 0 ? rxPoints[k - 1].i * Math.abs(t - 0.5) * (isi / 100) * 0.3 : 0);
                const y = 60 - v * 40;
                pts.push(`${pts.length === 0 ? "M" : "L"} ${x} ${Math.max(5, Math.min(115, y))}`);
              }
            }
            return (
              <>
                <path d={idealPts.join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
                <path d={pts.join(" ")} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="1.2" />
              </>
            );
          })()}
        </svg>
      </div>

      {/* Insights */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">🔬 Channel Effects Guide</div>
        <div>• <span className="text-chart-2">Lower SNR</span> — constellation spreads, eye closes, SER rises</div>
        <div>• <span className="text-chart-3">Rayleigh fading</span> — amplitude varies randomly (mobile channel)</div>
        <div>• <span className="text-chart-4">Phase noise</span> — constellation rotates/smears (oscillator jitter)</div>
        <div>• <span className="text-destructive">ISI</span> — eye closes, adjacent symbols interfere (bandwidth limitation)</div>
        <div>• <span className="text-primary">Compare BPSK vs 16-QAM</span> at same SNR to see noise tolerance tradeoff</div>
      </div>
    </div>
  );
};

const CSlider = ({ label, value, min, max, step, unit, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; color: string; onChange: (v: number) => void;
}) => (
  <div className="p-3 rounded-xl bg-card border border-border space-y-1">
    <div className="flex justify-between">
      <Label className="text-[8px] text-muted-foreground font-mono uppercase">{label}</Label>
      <span className={cn("text-[10px] font-mono", `text-${color}`)}>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className={`w-full accent-[hsl(var(--${color}))]`} />
  </div>
);

export default ChannelNoiseEngine;

import { useState, useMemo } from "react";
import { Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar,
} from "recharts";

type SignalType = "sine" | "cosine" | "square" | "sawtooth" | "triangle" | "step" | "impulse" | "sinc";
type ViewMode = "time" | "fourier" | "both";

const signalTypes: { id: SignalType; label: string }[] = [
  { id: "sine", label: "Sin(t)" },
  { id: "cosine", label: "Cos(t)" },
  { id: "square", label: "Square" },
  { id: "sawtooth", label: "Sawtooth" },
  { id: "triangle", label: "Triangle" },
  { id: "step", label: "Step" },
  { id: "impulse", label: "Impulse" },
  { id: "sinc", label: "Sinc" },
];

const generateSignal = (type: SignalType, A: number, f: number, phi: number, t: number): number => {
  const w = 2 * Math.PI * f;
  const val = w * t + phi;
  switch (type) {
    case "sine": return A * Math.sin(val);
    case "cosine": return A * Math.cos(val);
    case "square": return A * Math.sign(Math.sin(val));
    case "sawtooth": return A * 2 * ((f * t + phi / (2 * Math.PI)) % 1 - 0.5);
    case "triangle": return A * (2 / Math.PI) * Math.asin(Math.sin(val));
    case "step": return t >= 0 ? A : 0;
    case "impulse": return Math.abs(t) < 0.01 ? A * 50 : 0;
    case "sinc": {
      const x = Math.PI * f * t;
      return x === 0 ? A : A * Math.sin(x) / x;
    }
    default: return 0;
  }
};

// ─── DFT Implementation ────────────────────────────────────────────────
interface DFTResult {
  magnitude: { freq: number; mag: number; phase: number }[];
  dominant: { freq: number; mag: number }[];
}

const computeDFT = (samples: number[], sampleRate: number, N: number): DFTResult => {
  const magnitude: { freq: number; mag: number; phase: number }[] = [];
  const half = Math.floor(N / 2);

  for (let k = 0; k <= half; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += (samples[n] || 0) * Math.cos(angle);
      im -= (samples[n] || 0) * Math.sin(angle);
    }
    re /= N;
    im /= N;
    const mag = k === 0 ? Math.abs(re) : 2 * Math.sqrt(re * re + im * im);
    const phase = Math.atan2(im, re);
    const freq = (k * sampleRate) / N;
    magnitude.push({ freq: parseFloat(freq.toFixed(3)), mag: parseFloat(mag.toFixed(6)), phase: parseFloat(phase.toFixed(4)) });
  }

  // Find dominant frequencies (peaks)
  const threshold = Math.max(...magnitude.map(m => m.mag)) * 0.05;
  const dominant = magnitude
    .filter((m, i) => {
      if (m.mag < threshold) return false;
      const prev = magnitude[i - 1]?.mag ?? 0;
      const next = magnitude[i + 1]?.mag ?? 0;
      return m.mag >= prev && m.mag >= next;
    })
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 8);

  return { magnitude, dominant };
};

// ─── Fourier Series Coefficients ────────────────────────────────────────
interface FourierCoeff {
  n: number;
  an: number;
  bn: number;
  cn: number; // magnitude
  phaseN: number;
}

const computeFourierSeries = (type: SignalType, A: number, numHarmonics: number): FourierCoeff[] => {
  const coeffs: FourierCoeff[] = [];
  for (let n = 0; n <= numHarmonics; n++) {
    let an = 0, bn = 0;
    if (n === 0) {
      // DC component
      if (type === "step") an = A / 2;
      else if (type === "sawtooth") an = 0;
      else an = 0;
    } else {
      switch (type) {
        case "sine":
          bn = n === 1 ? A : 0;
          break;
        case "cosine":
          an = n === 1 ? A : 0;
          break;
        case "square":
          bn = n % 2 === 1 ? (4 * A) / (n * Math.PI) : 0;
          break;
        case "sawtooth":
          bn = (2 * A * Math.pow(-1, n + 1)) / (n * Math.PI);
          break;
        case "triangle":
          an = n % 2 === 1 ? (-8 * A) / (n * n * Math.PI * Math.PI) * (n % 4 === 1 ? 1 : -1) : 0;
          break;
        default:
          // Numerical integration for others
          const N = 1000;
          for (let k = 0; k < N; k++) {
            const t = (k / N) * 2 * Math.PI;
            const val = generateSignal(type, A, 1 / (2 * Math.PI), 0, t);
            an += val * Math.cos(n * t) * (2 / N);
            bn += val * Math.sin(n * t) * (2 / N);
          }
      }
    }
    const cn = Math.sqrt(an * an + bn * bn);
    const phaseN = Math.atan2(bn, an);
    coeffs.push({ n, an: parseFloat(an.toFixed(6)), bn: parseFloat(bn.toFixed(6)), cn: parseFloat(cn.toFixed(6)), phaseN: parseFloat(phaseN.toFixed(4)) });
  }
  return coeffs;
};

// ─── Reconstruct signal from Fourier series ─────────────────────────────
const reconstructFromFourier = (coeffs: FourierCoeff[], f: number, t: number): number => {
  let sum = coeffs[0]?.an / 2 || 0; // DC
  for (let i = 1; i < coeffs.length; i++) {
    const c = coeffs[i];
    sum += c.an * Math.cos(2 * Math.PI * c.n * f * t) + c.bn * Math.sin(2 * Math.PI * c.n * f * t);
  }
  return sum;
};

const SignalVisualizer = () => {
  const [signalType, setSignalType] = useState<SignalType>("square");
  const [amplitude, setAmplitude] = useState(1);
  const [frequency, setFrequency] = useState(1);
  const [phase, setPhase] = useState(0);
  const [timeShift, setTimeShift] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [showOriginal, setShowOriginal] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [numHarmonics, setNumHarmonics] = useState(10);
  const [showReconstruction, setShowReconstruction] = useState(true);

  // Time-domain data
  const data = useMemo(() => {
    const points = [];
    const tMin = -3 / (frequency || 1);
    const tMax = 3 / (frequency || 1);
    const steps = 512;
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (i / steps) * (tMax - tMin);
      const tScaled = (t - timeShift) * timeScale;
      const original = generateSignal(signalType, amplitude, frequency, 0, t);
      const modified = generateSignal(signalType, amplitude, frequency, phase, tScaled);
      points.push({
        t: parseFloat(t.toFixed(4)),
        original: parseFloat(original.toFixed(4)),
        modified: parseFloat(modified.toFixed(4)),
      });
    }
    return points;
  }, [signalType, amplitude, frequency, phase, timeShift, timeScale]);

  // DFT computation
  const dftResult = useMemo(() => {
    const samples = data.map(d => d.modified);
    const dt = data.length > 1 ? Math.abs(data[1].t - data[0].t) : 0.01;
    const sampleRate = 1 / dt;
    return computeDFT(samples, sampleRate, samples.length);
  }, [data]);

  // Fourier series coefficients
  const fourierCoeffs = useMemo(() => {
    return computeFourierSeries(signalType, amplitude, numHarmonics);
  }, [signalType, amplitude, numHarmonics]);

  // Reconstruction data
  const reconstructionData = useMemo(() => {
    if (!showReconstruction) return null;
    const tMin = -3 / (frequency || 1);
    const tMax = 3 / (frequency || 1);
    const steps = 512;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (i / steps) * (tMax - tMin);
      const original = generateSignal(signalType, amplitude, frequency, phase, t);
      const reconstructed = reconstructFromFourier(fourierCoeffs, frequency, t);
      points.push({
        t: parseFloat(t.toFixed(4)),
        original: parseFloat(original.toFixed(4)),
        reconstructed: parseFloat(reconstructed.toFixed(4)),
        error: parseFloat((original - reconstructed).toFixed(4)),
      });
    }
    return points;
  }, [signalType, amplitude, frequency, phase, fourierCoeffs, showReconstruction]);

  // Fourier series expression string
  const fourierExpr = useMemo(() => {
    const terms: string[] = [];
    const dc = fourierCoeffs[0]?.an / 2;
    if (Math.abs(dc) > 0.001) terms.push(dc.toFixed(3));
    for (let i = 1; i < fourierCoeffs.length; i++) {
      const c = fourierCoeffs[i];
      if (Math.abs(c.an) > 0.001) terms.push(`${c.an.toFixed(3)}·cos(${c.n}ωt)`);
      if (Math.abs(c.bn) > 0.001) terms.push(`${c.bn.toFixed(3)}·sin(${c.n}ωt)`);
    }
    return terms.length > 0 ? terms.slice(0, 8).join(" + ") + (terms.length > 8 ? " + ..." : "") : "0";
  }, [fourierCoeffs]);

  const chartStyle = {
    grid: "hsl(var(--border))",
    tick: "hsl(var(--muted-foreground))",
    tickStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 12 },
    tooltip: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 13 },
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
          <Radio size={20} className="text-secondary" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Signal Visualizer</h2>
          <p className="text-sm text-muted-foreground font-mono">Time Domain • Fourier Spectrum • Harmonic Analysis</p>
        </div>
      </div>

      {/* Signal Type Selector */}
      <div className="flex flex-wrap gap-2">
        {signalTypes.map((s) => (
          <Button key={s.id} variant={signalType === s.id ? "default" : "outline"} size="sm"
            onClick={() => setSignalType(s.id)}
            className={signalType === s.id ? "bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:text-foreground"}>
            {s.label}
          </Button>
        ))}
      </div>

      {/* View mode */}
      <div className="flex items-center gap-2">
        {(["time", "fourier", "both"] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={cn("px-4 py-2 rounded-lg text-sm font-mono border transition-all",
              viewMode === m ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground"
            )}>
            {m === "time" ? "⏱ Time Domain" : m === "fourier" ? "📊 Frequency Domain" : "⚡ Both Domains"}
          </button>
        ))}
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-sm text-muted-foreground">Amplitude (A)</Label>
          <Input type="number" value={amplitude} onChange={(e) => setAmplitude(parseFloat(e.target.value) || 1)} className="font-mono bg-muted border-border text-foreground mt-1.5 text-base" step="0.1" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Frequency (Hz)</Label>
          <Input type="number" value={frequency} onChange={(e) => setFrequency(parseFloat(e.target.value) || 1)} className="font-mono bg-muted border-border text-foreground mt-1.5 text-base" step="0.1" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Phase (rad)</Label>
          <Input type="number" value={phase} onChange={(e) => setPhase(parseFloat(e.target.value) || 0)} className="font-mono bg-muted border-border text-foreground mt-1.5 text-base" step="0.1" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Time Shift</Label>
          <Input type="number" value={timeShift} onChange={(e) => setTimeShift(parseFloat(e.target.value) || 0)} className="font-mono bg-muted border-border text-foreground mt-1.5 text-base" step="0.1" />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground">Harmonics (N)</Label>
          <Input type="number" value={numHarmonics} onChange={(e) => setNumHarmonics(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))} className="font-mono bg-muted border-border text-foreground mt-1.5 text-base" min={1} max={50} />
        </div>
      </div>

      <div className="flex gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Show original
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showReconstruction} onChange={(e) => setShowReconstruction(e.target.checked)} className="accent-[hsl(var(--chart-3))]" />
          Show Fourier reconstruction
        </label>
      </div>

      {/* ═══════ TIME DOMAIN ═══════ */}
      {(viewMode === "time" || viewMode === "both") && (
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border animate-fade-in">
          <h3 className="text-sm font-mono text-muted-foreground mb-3 uppercase tracking-wider">📡 TIME DOMAIN — x(t)</h3>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
              <XAxis dataKey="t" tick={{ fill: chartStyle.tick, fontSize: 12 }} label={{ value: "Time (s)", position: "bottom", fill: chartStyle.tick, fontSize: 13, offset: 10 }} />
              <YAxis tick={{ fill: chartStyle.tick, fontSize: 12 }} width={50} />
              <Tooltip contentStyle={chartStyle.tooltip} />
              <Legend />
              {showOriginal && (
                <Line type="monotone" dataKey="original" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Original" />
              )}
              <Line type="monotone" dataKey="modified" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Signal x(t)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══════ FOURIER RECONSTRUCTION ═══════ */}
      {showReconstruction && reconstructionData && (viewMode === "time" || viewMode === "both") && (
        <div className="p-5 rounded-xl bg-card border border-chart-3/30 animate-fade-in">
          <h3 className="text-sm font-mono text-chart-3 mb-3 uppercase tracking-wider">
            🔄 FOURIER RECONSTRUCTION — {numHarmonics} harmonics
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={reconstructionData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
              <XAxis dataKey="t" tick={{ fill: chartStyle.tick, fontSize: 12 }} />
              <YAxis tick={{ fill: chartStyle.tick, fontSize: 12 }} width={50} />
              <Tooltip contentStyle={chartStyle.tooltip} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="original" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Original" />
              <Line type="monotone" dataKey="reconstructed" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name={`Fourier (${numHarmonics} terms)`} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-3 text-xs font-mono text-muted-foreground">
            <span className="text-chart-3">Gibbs phenomenon:</span> ~9% overshoot at discontinuities persists regardless of N. Visible in square/sawtooth waves.
          </div>
        </div>
      )}

      {/* ═══════ FREQUENCY DOMAIN ═══════ */}
      {(viewMode === "fourier" || viewMode === "both") && (
        <div className="space-y-4 animate-fade-in">
          {/* Magnitude Spectrum */}
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-sm font-mono text-muted-foreground mb-3 uppercase tracking-wider">📊 MAGNITUDE SPECTRUM |X(f)|</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dftResult.magnitude.slice(0, Math.min(60, dftResult.magnitude.length))} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
                <XAxis dataKey="freq" tick={{ fill: chartStyle.tick, fontSize: 12 }} label={{ value: "Frequency (Hz)", position: "bottom", fill: chartStyle.tick, fontSize: 13, offset: 10 }} />
                <YAxis tick={{ fill: chartStyle.tick, fontSize: 12 }} width={50} />
                <Tooltip contentStyle={chartStyle.tooltip} formatter={(v: number) => [v.toFixed(4), "|X(f)|"]} />
                <Bar dataKey="mag" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Phase Spectrum */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-mono text-muted-foreground mb-3 uppercase tracking-wider">📐 PHASE SPECTRUM ∠X(f)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dftResult.magnitude.slice(0, Math.min(60, dftResult.magnitude.length))} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
                <XAxis dataKey="freq" tick={{ fill: chartStyle.tick, fontSize: 12 }} />
                <YAxis tick={{ fill: chartStyle.tick, fontSize: 12 }} width={50} domain={[-Math.PI, Math.PI]} />
                <Tooltip contentStyle={chartStyle.tooltip} formatter={(v: number) => [`${v.toFixed(3)} rad`, "Phase"]} />
                <Line type="monotone" dataKey="phase" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Dominant frequencies */}
          {dftResult.dominant.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-chart-2/30">
              <h3 className="text-sm font-mono text-chart-2 mb-2 uppercase tracking-wider">🎯 DOMINANT FREQUENCIES</h3>
              <div className="flex gap-3 flex-wrap">
                {dftResult.dominant.map((d, i) => (
                  <div key={i} className="px-4 py-3 rounded-lg bg-chart-2/10 border border-chart-2/20">
                    <div className="text-base font-mono font-bold text-chart-2">{d.freq.toFixed(2)} Hz</div>
                    <div className="text-xs font-mono text-muted-foreground">|X| = {d.mag.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ FOURIER SERIES COEFFICIENTS ═══════ */}
      <div className="p-5 rounded-xl bg-card border border-border animate-fade-in">
        <h3 className="text-sm font-mono text-muted-foreground mb-3 uppercase tracking-wider">
          📐 FOURIER SERIES COEFFICIENTS — {signalType.toUpperCase()} WAVE
        </h3>

        {/* Coefficient bar chart */}
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fourierCoeffs.filter(c => c.n > 0)} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartStyle.grid} />
              <XAxis dataKey="n" tick={{ fill: chartStyle.tick, fontSize: 12 }} label={{ value: "Harmonic n", position: "bottom", fill: chartStyle.tick, fontSize: 13, offset: 10 }} />
              <YAxis tick={{ fill: chartStyle.tick, fontSize: 12 }} width={50} />
              <Tooltip contentStyle={chartStyle.tooltip} />
              <Bar dataKey="cn" fill="hsl(var(--primary))" name="|cₙ|" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Coefficient table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left text-muted-foreground">n</th>
                <th className="py-2 px-3 text-right text-chart-2">aₙ (cos)</th>
                <th className="py-2 px-3 text-right text-chart-3">bₙ (sin)</th>
                <th className="py-2 px-3 text-right text-primary">|cₙ|</th>
                <th className="py-2 px-3 text-right text-chart-4">φₙ (rad)</th>
                <th className="py-2 px-3 text-right text-muted-foreground">freq (Hz)</th>
              </tr>
            </thead>
            <tbody>
              {fourierCoeffs.slice(0, 16).map(c => (
                <tr key={c.n} className={cn("border-b border-border/30", c.cn > 0.01 ? "bg-primary/5" : "")}>
                  <td className="py-1.5 px-3 text-muted-foreground">{c.n === 0 ? "DC" : c.n}</td>
                  <td className={cn("py-1.5 px-3 text-right", Math.abs(c.an) > 0.001 ? "text-chart-2 font-bold" : "text-muted-foreground/50")}>{c.an.toFixed(4)}</td>
                  <td className={cn("py-1.5 px-3 text-right", Math.abs(c.bn) > 0.001 ? "text-chart-3 font-bold" : "text-muted-foreground/50")}>{c.bn.toFixed(4)}</td>
                  <td className={cn("py-1.5 px-3 text-right", c.cn > 0.001 ? "text-primary font-bold" : "text-muted-foreground/50")}>{c.cn.toFixed(4)}</td>
                  <td className="py-1.5 px-3 text-right text-chart-4">{c.phaseN.toFixed(3)}</td>
                  <td className="py-1.5 px-3 text-right text-muted-foreground">{(c.n * frequency).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ FOURIER SERIES EXPRESSION ═══════ */}
      <div className="p-5 rounded-xl bg-card border border-primary/20">
        <div className="text-xs font-mono text-primary mb-1.5 uppercase">FOURIER SERIES EXPRESSION</div>
        <div className="text-sm font-mono text-foreground break-all leading-relaxed">
          x(t) ≈ {fourierExpr}
        </div>
        <div className="text-xs font-mono text-muted-foreground mt-2">
          ω = 2π × {frequency} = {(2 * Math.PI * frequency).toFixed(4)} rad/s | T = {(1 / frequency).toFixed(4)}s | N = {numHarmonics} harmonics
        </div>
      </div>

      {/* ═══════ THEORY PANEL ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs font-mono text-chart-2 mb-2 uppercase font-bold">FOURIER SERIES PROPERTIES</div>
          <div className="space-y-2 text-sm font-mono text-muted-foreground">
            <div>• <span className="text-chart-2">Even functions</span> → only cosine terms (aₙ ≠ 0, bₙ = 0)</div>
            <div>• <span className="text-chart-3">Odd functions</span> → only sine terms (aₙ = 0, bₙ ≠ 0)</div>
            <div>• <span className="text-primary">Half-wave symmetry</span> → only odd harmonics</div>
            <div>• <span className="text-chart-4">Parseval:</span> Power = Σ|cₙ|² (energy conservation)</div>
            <div>• <span className="text-destructive">Gibbs:</span> ~9% overshoot at discontinuities</div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="text-xs font-mono text-primary mb-2 uppercase font-bold">SIGNAL ANALYSIS: {signalType.toUpperCase()}</div>
          <div className="space-y-2 text-sm font-mono text-muted-foreground">
            {signalType === "square" && <>
              <div>• Only <span className="text-primary">odd harmonics</span>: 1, 3, 5, 7...</div>
              <div>• Coefficients decay as <span className="text-chart-2">1/n</span></div>
              <div>• bₙ = 4A/(nπ) for odd n</div>
              <div>• Bandwidth ≈ ∞ (slow convergence)</div>
            </>}
            {signalType === "sawtooth" && <>
              <div>• <span className="text-primary">All harmonics</span> present (odd function)</div>
              <div>• Coefficients decay as <span className="text-chart-2">1/n</span></div>
              <div>• bₙ = 2A(-1)^(n+1)/(nπ)</div>
              <div>• Sharpest Gibbs effect at discontinuities</div>
            </>}
            {signalType === "triangle" && <>
              <div>• Only <span className="text-primary">odd harmonics</span> (even function)</div>
              <div>• Coefficients decay as <span className="text-chart-2">1/n²</span> (fast!)</div>
              <div>• aₙ = 8A/(n²π²)</div>
              <div>• Smooth → converges rapidly (no Gibbs)</div>
            </>}
            {signalType === "sine" && <>
              <div>• <span className="text-primary">Single harmonic</span> at fundamental</div>
              <div>• b₁ = A, all others = 0</div>
              <div>• Purest tone — bandwidth = 0</div>
              <div>• FT: X(ω) = Aπ[δ(ω-ω₀) - δ(ω+ω₀)]/j</div>
            </>}
            {signalType === "cosine" && <>
              <div>• <span className="text-primary">Single harmonic</span> at fundamental</div>
              <div>• a₁ = A, all others = 0</div>
              <div>• Even function — only cosine terms</div>
              <div>• FT: X(ω) = Aπ[δ(ω-ω₀) + δ(ω+ω₀)]</div>
            </>}
            {(signalType === "step" || signalType === "impulse" || signalType === "sinc") && <>
              <div>• <span className="text-primary">Non-periodic</span> — use Fourier Transform</div>
              <div>• {signalType === "step" ? "FT: X(ω) = πδ(ω) + 1/jω" : signalType === "impulse" ? "FT: X(ω) = 1 (flat spectrum)" : "FT: sinc↔rect (dual pair)"}</div>
              <div>• Series shown is approximate (windowed)</div>
              <div>• {signalType === "sinc" ? "Sinc = ideal low-pass filter impulse response" : signalType === "step" ? "Contains DC + all harmonics" : "Infinite bandwidth — flat spectrum"}</div>
            </>}
          </div>
        </div>
      </div>

      {/* Expression */}
      <div className="p-4 rounded-lg bg-card border border-border font-mono text-sm text-muted-foreground">
        <span className="text-secondary">x(t)</span> = {amplitude} · {signalType}(2π · {frequency} · (t - {timeShift}) · {timeScale} + {phase})
      </div>
    </div>
  );
};

export default SignalVisualizer;

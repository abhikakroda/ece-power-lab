import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter,
} from "recharts";

const SamplingVisualizer = () => {
  const [fSignal, setFSignal] = useState(5);
  const [fSample, setFSample] = useState(20);
  const [showAlias, setShowAlias] = useState(true);
  const [signalType, setSignalType] = useState<"sine" | "multi">("sine");

  const nyquist = 2 * fSignal;
  const isAliased = fSample < nyquist;
  const aliasFreq = isAliased ? Math.abs(fSignal - fSample * Math.round(fSignal / fSample)) : null;

  const { continuousData, sampledPoints, reconstructedData } = useMemo(() => {
    const tMax = 2 / fSignal;
    const N = 600;
    const dt = tMax / N;

    const genSignal = (t: number) => {
      if (signalType === "multi") {
        return Math.sin(2 * Math.PI * fSignal * t) + 0.5 * Math.sin(2 * Math.PI * fSignal * 2.3 * t);
      }
      return Math.sin(2 * Math.PI * fSignal * t);
    };

    const continuous: { t: number; original: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i * dt;
      continuous.push({ t: parseFloat(t.toFixed(5)), original: parseFloat(genSignal(t).toFixed(4)) });
    }

    // Sampled points
    const Ts = 1 / fSample;
    const numSamples = Math.floor(tMax / Ts) + 1;
    const samples: { t: number; sampled: number }[] = [];
    for (let i = 0; i < numSamples; i++) {
      const t = i * Ts;
      if (t <= tMax) {
        samples.push({ t: parseFloat(t.toFixed(5)), sampled: parseFloat(genSignal(t).toFixed(4)) });
      }
    }

    // Sinc reconstruction
    const reconstructed: { t: number; reconstructed: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i * dt;
      let val = 0;
      for (const s of samples) {
        const x = (t - s.t) * fSample;
        const sinc = Math.abs(x) < 1e-10 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
        val += s.sampled * sinc;
      }
      reconstructed.push({ t: parseFloat(t.toFixed(5)), reconstructed: parseFloat(val.toFixed(4)) });
    }

    return { continuousData: continuous, sampledPoints: samples, reconstructedData: reconstructed };
  }, [fSignal, fSample, signalType]);

  // Merge data for single chart
  const mergedData = useMemo(() => {
    return continuousData.map((c, i) => ({
      ...c,
      reconstructed: reconstructedData[i]?.reconstructed,
    }));
  }, [continuousData, reconstructedData]);

  // Error (distortion)
  const distortion = useMemo(() => {
    let mse = 0;
    for (let i = 0; i < mergedData.length; i++) {
      const diff = (mergedData[i].original ?? 0) - (mergedData[i].reconstructed ?? 0);
      mse += diff * diff;
    }
    return Math.sqrt(mse / mergedData.length);
  }, [mergedData]);

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };

  return (
    <div className="space-y-6">
      {/* Signal type */}
      <div className="flex gap-2">
        {(["sine", "multi"] as const).map(s => (
          <button key={s} onClick={() => setSignalType(s)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              signalType === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {s === "sine" ? "Single Sine" : "Multi-tone"}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground font-mono">SIGNAL FREQUENCY (f_m)</Label>
            <span className="text-xs font-mono text-primary">{fSignal} Hz</span>
          </div>
          <input type="range" min={1} max={50} step={0.5} value={fSignal}
            onChange={e => setFSignal(parseFloat(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex justify-between">
            <Label className="text-[10px] text-muted-foreground font-mono">SAMPLING FREQUENCY (f_s)</Label>
            <span className="text-xs font-mono text-chart-2">{fSample} Hz</span>
          </div>
          <input type="range" min={1} max={200} step={0.5} value={fSample}
            onChange={e => setFSample(parseFloat(e.target.value))}
            className="w-full accent-[hsl(var(--chart-2))]" />
        </div>
      </div>

      {/* Nyquist status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={cn("p-3 rounded-lg border text-center col-span-2",
          isAliased ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
        )}>
          <div className={cn("text-sm font-mono font-bold", isAliased ? "text-destructive" : "text-primary")}>
            {isAliased ? "⚠ ALIASING DETECTED" : "✓ NYQUIST SATISFIED"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            f_s = {fSample} Hz {isAliased ? "<" : "≥"} 2·f_m = {nyquist} Hz
          </div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-primary">{nyquist} Hz</div>
          <div className="text-[10px] text-muted-foreground">Nyquist Rate</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-4">{(fSample / 2).toFixed(1)} Hz</div>
          <div className="text-[10px] text-muted-foreground">Folding Freq</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          distortion < 0.05 ? "border-primary/20" : "border-destructive/20"
        )}>
          <div className={cn("text-sm font-mono font-bold", distortion < 0.05 ? "text-primary" : "text-destructive")}>
            {distortion.toFixed(4)}
          </div>
          <div className="text-[10px] text-muted-foreground">RMSE Distortion</div>
        </div>
      </div>

      {aliasFreq !== null && (
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs font-mono text-destructive">
          ⚠ Alias frequency: {aliasFreq.toFixed(1)} Hz appears instead of {fSignal} Hz
        </div>
      )}

      {/* Main waveform */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">ORIGINAL vs RECONSTRUCTED SIGNAL</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mergedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="original" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Original" />
            <Line type="monotone" dataKey="reconstructed" stroke={isAliased ? "hsl(var(--destructive))" : "hsl(var(--chart-2))"} strokeWidth={1.5} strokeDasharray={isAliased ? "5 3" : "0"} dot={false} name="Reconstructed" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sampled points */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">SAMPLE POINTS ({sampledPoints.length} samples)</div>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={tickStyle} type="number" domain={["auto", "auto"]}
              label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis dataKey="sampled" tick={tickStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Scatter data={sampledPoints} fill="hsl(var(--chart-3))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Explanation */}
      <div className="p-4 rounded-xl bg-card border border-border font-mono text-xs text-muted-foreground space-y-1">
        <div><span className="text-primary">Nyquist Theorem:</span> f_s ≥ 2 · f_max to avoid aliasing</div>
        <div><span className="text-chart-2">Current ratio:</span> f_s / f_m = {(fSample / fSignal).toFixed(2)}x {fSample / fSignal >= 2 ? "(OK)" : "(UNDERSAMPLED)"}</div>
        <div><span className="text-chart-4">Reconstruction:</span> sinc interpolation from {sampledPoints.length} samples</div>
      </div>
    </div>
  );
};

export default SamplingVisualizer;

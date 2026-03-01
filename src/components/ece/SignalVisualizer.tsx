import { useState, useMemo } from "react";
import { Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type SignalType = "sine" | "cosine" | "square" | "sawtooth" | "triangle" | "step" | "impulse" | "sinc";

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

const SignalVisualizer = () => {
  const [signalType, setSignalType] = useState<SignalType>("sine");
  const [amplitude, setAmplitude] = useState(1);
  const [frequency, setFrequency] = useState(1);
  const [phase, setPhase] = useState(0);
  const [timeShift, setTimeShift] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [showOriginal, setShowOriginal] = useState(true);

  const data = useMemo(() => {
    const points = [];
    const tMin = -3 / (frequency || 1);
    const tMax = 3 / (frequency || 1);
    const steps = 500;
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

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
          <Radio size={20} className="text-secondary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Signal Visualizer</h2>
          <p className="text-sm text-muted-foreground font-mono">Plot • Transform • Analyze</p>
        </div>
      </div>

      {/* Signal Type Selector */}
      <div className="flex flex-wrap gap-2">
        {signalTypes.map((s) => (
          <Button
            key={s.id}
            variant={signalType === s.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSignalType(s.id)}
            className={signalType === s.id ? "bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:text-foreground"}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-xs text-muted-foreground">Amplitude (A)</Label>
          <Input type="number" value={amplitude} onChange={(e) => setAmplitude(parseFloat(e.target.value) || 1)} className="font-mono bg-muted border-border text-foreground mt-1" step="0.1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Frequency (Hz)</Label>
          <Input type="number" value={frequency} onChange={(e) => setFrequency(parseFloat(e.target.value) || 1)} className="font-mono bg-muted border-border text-foreground mt-1" step="0.1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Phase (rad)</Label>
          <Input type="number" value={phase} onChange={(e) => setPhase(parseFloat(e.target.value) || 0)} className="font-mono bg-muted border-border text-foreground mt-1" step="0.1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Time Shift</Label>
          <Input type="number" value={timeShift} onChange={(e) => setTimeShift(parseFloat(e.target.value) || 0)} className="font-mono bg-muted border-border text-foreground mt-1" step="0.1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Time Scale</Label>
          <Input type="number" value={timeScale} onChange={(e) => setTimeScale(parseFloat(e.target.value) || 1)} className="font-mono bg-muted border-border text-foreground mt-1" step="0.1" />
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} className="accent-primary" />
          Show original signal
        </label>
      </div>

      {/* Chart */}
      <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">📡 SIGNAL OUTPUT</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="t" tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} label={{ value: "Time (s)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(220 20% 9%)", border: "1px solid hsl(220 15% 16%)", color: "hsl(140 20% 88%)" }} />
            <Legend />
            {showOriginal && (
              <Line type="monotone" dataKey="original" stroke="hsl(220 10% 50%)" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Original x(t)" />
            )}
            <Line type="monotone" dataKey="modified" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="Modified x(t)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Expression */}
      <div className="p-4 rounded-lg bg-card border border-border font-mono text-sm text-muted-foreground">
        <span className="text-secondary">x(t)</span> = {amplitude} · {signalType}(2π · {frequency} · (t - {timeShift}) · {timeScale} + {phase})
      </div>
    </div>
  );
};

export default SignalVisualizer;

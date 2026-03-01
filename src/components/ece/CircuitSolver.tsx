import { useState, useMemo } from "react";
import { Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface CircuitParams {
  R: number;
  L: number;
  C: number;
  V: number;
  f: number;
}

const CircuitSolver = () => {
  const [params, setParams] = useState<CircuitParams>({ R: 100, L: 0.01, C: 0.000001, V: 10, f: 1000 });
  const [solved, setSolved] = useState(false);

  const update = (key: keyof CircuitParams, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setParams((p) => ({ ...p, [key]: n }));
  };

  const results = useMemo(() => {
    const { R, L, C, V, f } = params;
    const w = 2 * Math.PI * f;
    const XL = w * L;
    const XC = 1 / (w * C);
    const Z = Math.sqrt(R * R + (XL - XC) ** 2);
    const I = V / Z;
    const phase = Math.atan2(XL - XC, R) * (180 / Math.PI);
    const VR = I * R;
    const VL = I * XL;
    const VC = I * XC;
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const Q = (1 / R) * Math.sqrt(L / C);
    const BW = f0 / Q;

    return { XL, XC, Z, I, phase, VR, VL, VC, f0, Q, BW };
  }, [params]);

  const freqResponse = useMemo(() => {
    const { R, L, C, V } = params;
    const data = [];
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    const fMin = Math.max(1, f0 / 10);
    const fMax = f0 * 10;
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const f = fMin * Math.pow(fMax / fMin, i / steps);
      const w = 2 * Math.PI * f;
      const XL = w * L;
      const XC = 1 / (w * C);
      const Z = Math.sqrt(R * R + (XL - XC) ** 2);
      const I = V / Z;
      const gain = 20 * Math.log10(I / (V / R));
      data.push({ freq: Math.round(f), gain: parseFloat(gain.toFixed(2)), current: parseFloat((I * 1000).toFixed(3)) });
    }
    return data;
  }, [params]);

  const waveformData = useMemo(() => {
    const { V, f } = params;
    const { I, phase } = results;
    const T = 1 / f;
    const data = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 2 * T;
      const w = 2 * Math.PI * f;
      const voltage = V * Math.sin(w * t);
      const current = I * Math.sin(w * t - (phase * Math.PI) / 180);
      data.push({
        time: parseFloat((t * 1000).toFixed(4)),
        voltage: parseFloat(voltage.toFixed(3)),
        current: parseFloat((current * 100).toFixed(3)),
      });
    }
    return data;
  }, [params, results]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap size={22} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Series RLC Circuit Solver</h2>
          <p className="text-sm text-muted-foreground font-mono">Impedance • Phasors • Frequency Response</p>
        </div>
      </div>

      {/* Input Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 rounded-xl bg-card border border-border oscilloscope-border">
        {[
          { key: "R" as const, label: "Resistance (Ω)", val: params.R },
          { key: "L" as const, label: "Inductance (H)", val: params.L },
          { key: "C" as const, label: "Capacitance (F)", val: params.C },
          { key: "V" as const, label: "Voltage (V)", val: params.V },
          { key: "f" as const, label: "Frequency (Hz)", val: params.f },
        ].map((p) => (
          <div key={p.key}>
            <Label className="text-sm text-muted-foreground">{p.label}</Label>
            <Input
              type="number"
              value={p.val}
              onChange={(e) => update(p.key, e.target.value)}
              className="font-mono bg-muted border-border text-foreground mt-1.5 text-base"
              step="any"
            />
          </div>
        ))}
      </div>

      <Button onClick={() => setSolved(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-base px-6 py-2.5">
        ⚡ SOLVE CIRCUIT
      </Button>

      {solved && (
        <div className="space-y-8 animate-fade-in">
          {/* Results Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Impedance Z", value: `${results.Z.toFixed(2)} Ω`, color: "text-primary" },
              { label: "Current I", value: `${(results.I * 1000).toFixed(2)} mA`, color: "text-secondary" },
              { label: "Phase Angle", value: `${results.phase.toFixed(1)}°`, color: "text-accent" },
              { label: "Resonant Freq", value: `${results.f0.toFixed(0)} Hz`, color: "text-chart-4" },
              { label: "X_L", value: `${results.XL.toFixed(2)} Ω`, color: "text-primary" },
              { label: "X_C", value: `${results.XC.toFixed(2)} Ω`, color: "text-secondary" },
              { label: "Q Factor", value: results.Q.toFixed(2), color: "text-accent" },
              { label: "Bandwidth", value: `${results.BW.toFixed(0)} Hz`, color: "text-chart-4" },
              { label: "V_R", value: `${results.VR.toFixed(3)} V`, color: "text-primary" },
              { label: "V_L", value: `${results.VL.toFixed(3)} V`, color: "text-secondary" },
              { label: "V_C", value: `${results.VC.toFixed(3)} V`, color: "text-accent" },
              { label: "Circuit", value: results.XL > results.XC ? "Inductive" : results.XL < results.XC ? "Capacitive" : "Resonance", color: "text-chart-4" },
            ].map((r) => (
              <div key={r.label} className="p-4 rounded-lg bg-card border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{r.label}</div>
                <div className={`text-xl font-mono font-bold ${r.color}`}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Waveform */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-base font-semibold text-foreground mb-4 font-mono">⏱ VOLTAGE & CURRENT WAVEFORM</h3>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={waveformData} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} label={{ value: "Time (ms)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={50} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                <Line type="monotone" dataKey="voltage" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Voltage (V)" />
                <Line type="monotone" dataKey="current" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Current (×100 mA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Frequency Response */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-base font-semibold text-foreground mb-4 font-mono">📊 FREQUENCY RESPONSE</h3>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={freqResponse} margin={{ top: 10, right: 20, bottom: 25, left: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="freq" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} label={{ value: "Frequency (Hz)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={55} label={{ value: "Gain (dB)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: -5 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontSize: 13 }} />
                <Line type="monotone" dataKey="gain" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} name="Gain (dB)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Formulas */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-base font-semibold text-foreground mb-4 font-mono">📐 FORMULAS USED</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-mono text-muted-foreground">
              <div>Z = √(R² + (X_L - X_C)²)</div>
              <div>X_L = 2πfL, X_C = 1/(2πfC)</div>
              <div>I = V/Z</div>
              <div>φ = arctan((X_L - X_C)/R)</div>
              <div>f₀ = 1/(2π√LC)</div>
              <div>Q = (1/R)√(L/C)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CircuitSolver;

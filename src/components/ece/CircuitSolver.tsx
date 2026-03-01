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
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Series RLC Circuit Solver</h2>
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
            <Label className="text-xs text-muted-foreground">{p.label}</Label>
            <Input
              type="number"
              value={p.val}
              onChange={(e) => update(p.key, e.target.value)}
              className="font-mono bg-muted border-border text-foreground mt-1"
              step="any"
            />
          </div>
        ))}
      </div>

      <Button onClick={() => setSolved(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">
        ⚡ SOLVE CIRCUIT
      </Button>

      {solved && (
        <div className="space-y-8 animate-fade-in">
          {/* Results Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <div key={r.label} className="p-3 rounded-lg bg-card border border-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.label}</div>
                <div className={`text-lg font-mono font-bold ${r.color}`}>{r.value}</div>
              </div>
            ))}
          </div>

          {/* Waveform */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">⏱ VOLTAGE & CURRENT WAVEFORM</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={waveformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                <XAxis dataKey="time" tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} label={{ value: "Time (ms)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                <YAxis tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(220 20% 9%)", border: "1px solid hsl(220 15% 16%)", color: "hsl(140 20% 88%)" }} />
                <Legend />
                <Line type="monotone" dataKey="voltage" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} name="Voltage (V)" />
                <Line type="monotone" dataKey="current" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="Current (×100 mA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Frequency Response */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">📊 FREQUENCY RESPONSE</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={freqResponse}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                <XAxis dataKey="freq" tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} label={{ value: "Frequency (Hz)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                <YAxis tick={{ fill: "hsl(220 10% 50%)", fontSize: 10 }} label={{ value: "Gain (dB)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                <Tooltip contentStyle={{ background: "hsl(220 20% 9%)", border: "1px solid hsl(220 15% 16%)", color: "hsl(140 20% 88%)" }} />
                <Line type="monotone" dataKey="gain" stroke="hsl(38 90% 55%)" strokeWidth={2} dot={false} name="Gain (dB)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Formulas */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 font-mono">📐 FORMULAS USED</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-mono text-muted-foreground">
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

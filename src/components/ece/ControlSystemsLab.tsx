import { useState, useMemo } from "react";
import { Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ReferenceLine,
} from "recharts";
import {
  findRoots, computeBode, computeStepResponse, computeImpulseResponse,
  type BodePoint, type TimeResponse,
} from "@/lib/control-engine";
import { type Complex, cxMag } from "@/lib/spice-engine";

type ViewTab = "step" | "impulse" | "bode" | "polezero";

const presets = [
  { name: "1st Order", num: "1", den: "1 1", desc: "H(s) = 1/(s+1)" },
  { name: "2nd Order Underdamped", num: "25", den: "1 2 25", desc: "ζ=0.2, ωn=5" },
  { name: "2nd Order Overdamped", num: "4", den: "1 4 4", desc: "ζ=1, ωn=2" },
  { name: "2nd Order Critically Damped", num: "9", den: "1 6 9", desc: "ζ=1, ωn=3" },
  { name: "Integrator", num: "1", den: "1 0", desc: "H(s) = 1/s" },
  { name: "PID Controller", num: "1 10 20", den: "1 0", desc: "PID output TF" },
  { name: "3rd Order", num: "60", den: "1 6 11 60", desc: "3 poles" },
  { name: "Notch Filter", num: "1 0 100", den: "1 10 100", desc: "Zeros on jω axis" },
];

const tooltipStyle = {
  background: "hsl(220 20% 9%)",
  border: "1px solid hsl(220 15% 16%)",
  color: "hsl(140 20% 88%)",
};
const tickStyle = { fill: "hsl(220 10% 50%)", fontSize: 10 };

const ControlSystemsLab = () => {
  const [numStr, setNumStr] = useState("25");
  const [denStr, setDenStr] = useState("1 2 25");
  const [view, setView] = useState<ViewTab>("step");
  const [tStop, setTStop] = useState(5);
  const [computed, setComputed] = useState(false);

  const num = useMemo(() => numStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [numStr]);
  const den = useMemo(() => denStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [denStr]);

  const poles = useMemo(() => computed ? findRoots(den) : [], [den, computed]);
  const zeros = useMemo(() => computed && num.length > 1 ? findRoots(num) : [], [num, computed]);

  const isStable = useMemo(() => poles.every((p) => p.re < 0), [poles]);

  const stepData = useMemo(() => computed ? computeStepResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const impulseData = useMemo(() => computed ? computeImpulseResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const bodeData = useMemo(() => computed ? computeBode(num, den, 0.01, 1000, 300) : [], [num, den, computed]);

  // Step response metrics
  const metrics = useMemo(() => {
    if (stepData.length === 0) return null;
    const finalVal = stepData[stepData.length - 1].value;
    const dcGain = finalVal;
    const peakVal = Math.max(...stepData.map((d) => d.value));
    const overshoot = dcGain > 0 ? ((peakVal - dcGain) / dcGain) * 100 : 0;

    // Rise time (10% to 90%)
    const v10 = dcGain * 0.1, v90 = dcGain * 0.9;
    let t10 = 0, t90 = 0;
    for (const d of stepData) {
      if (d.value >= v10 && t10 === 0) t10 = d.time;
      if (d.value >= v90 && t90 === 0) t90 = d.time;
    }

    // Settling time (2% band)
    let tSettle = 0;
    for (let i = stepData.length - 1; i >= 0; i--) {
      if (Math.abs(stepData[i].value - dcGain) > Math.abs(dcGain) * 0.02) {
        tSettle = stepData[i].time;
        break;
      }
    }

    // Damping ratio and natural freq from poles
    let zeta = 0, wn = 0;
    if (poles.length >= 2) {
      const dominant = poles.reduce((a, b) => (a.re > b.re ? a : b));
      wn = cxMag(dominant);
      zeta = wn > 0 ? -dominant.re / wn : 0;
    } else if (poles.length === 1) {
      wn = Math.abs(poles[0].re);
      zeta = 1;
    }

    return { dcGain, overshoot, riseTime: t90 - t10, settlingTime: tSettle, peakVal, zeta, wn };
  }, [stepData, poles]);

  const loadPreset = (p: typeof presets[0]) => {
    setNumStr(p.num);
    setDenStr(p.den);
    setComputed(false);
  };

  const tfDisplay = useMemo(() => {
    const polyStr = (c: number[]) => c.map((v, i) => {
      const power = c.length - 1 - i;
      const coeff = Math.abs(v) === 1 && power > 0 ? "" : Math.abs(v).toString();
      const s = power === 0 ? coeff || "0" : power === 1 ? `${coeff}s` : `${coeff}s^${power}`;
      return i === 0 ? (v < 0 ? `-${s}` : s) : (v < 0 ? ` - ${s}` : ` + ${s}`);
    }).join("");
    return { num: polyStr(num), den: polyStr(den) };
  }, [num, den]);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
          <Settings2 size={20} className="text-chart-4" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Control Systems Lab</h2>
          <p className="text-sm text-muted-foreground font-mono">Transfer Function • Step • Bode • Pole-Zero</p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.name} onClick={() => loadPreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:border-chart-4/30 transition-all">
            {p.name}
          </button>
        ))}
      </div>

      {/* TF Input */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">TRANSFER FUNCTION H(s) = N(s) / D(s)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Numerator coefficients (highest power first)</Label>
            <Input value={numStr} onChange={(e) => { setNumStr(e.target.value); setComputed(false); }}
              className="font-mono bg-muted border-border text-foreground mt-1" placeholder="1 10 25" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Denominator coefficients (highest power first)</Label>
            <Input value={denStr} onChange={(e) => { setDenStr(e.target.value); setComputed(false); }}
              className="font-mono bg-muted border-border text-foreground mt-1" placeholder="1 2 25" />
          </div>
        </div>

        {/* Display TF */}
        <div className="mt-3 p-3 rounded-lg bg-muted text-center">
          <div className="font-mono text-sm text-chart-4">{tfDisplay.num}</div>
          <div className="border-t border-muted-foreground/30 my-1 mx-8" />
          <div className="font-mono text-sm text-chart-4">{tfDisplay.den}</div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button onClick={() => setComputed(true)} className="bg-chart-4 text-primary-foreground hover:bg-chart-4/80 font-mono gap-2">
            <Play size={16} /> ANALYZE
          </Button>
          <div>
            <Label className="text-xs text-muted-foreground">Sim Time (s)</Label>
            <Input type="number" value={tStop} onChange={(e) => setTStop(parseFloat(e.target.value) || 5)}
              className="w-24 font-mono bg-muted border-border text-foreground mt-1" />
          </div>
        </div>
      </div>

      {computed && (
        <div className="space-y-6 animate-fade-in">
          {/* Stability + Metrics */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn("px-4 py-2 rounded-lg border font-mono text-sm font-bold",
              isStable ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"
            )}>
              {isStable ? "✓ STABLE" : "✗ UNSTABLE"}
            </div>
            {metrics && (
              <>
                <div className="px-3 py-1.5 rounded bg-card border border-border text-xs font-mono">
                  <span className="text-muted-foreground">ζ = </span><span className="text-secondary">{metrics.zeta.toFixed(3)}</span>
                </div>
                <div className="px-3 py-1.5 rounded bg-card border border-border text-xs font-mono">
                  <span className="text-muted-foreground">ωn = </span><span className="text-accent">{metrics.wn.toFixed(3)} rad/s</span>
                </div>
                <div className="px-3 py-1.5 rounded bg-card border border-border text-xs font-mono">
                  <span className="text-muted-foreground">OS = </span><span className="text-destructive">{metrics.overshoot.toFixed(1)}%</span>
                </div>
                <div className="px-3 py-1.5 rounded bg-card border border-border text-xs font-mono">
                  <span className="text-muted-foreground">tr = </span><span className="text-primary">{metrics.riseTime.toFixed(3)}s</span>
                </div>
                <div className="px-3 py-1.5 rounded bg-card border border-border text-xs font-mono">
                  <span className="text-muted-foreground">ts = </span><span className="text-chart-4">{metrics.settlingTime.toFixed(3)}s</span>
                </div>
              </>
            )}
          </div>

          {/* View Tabs */}
          <div className="flex gap-2">
            {([["step", "Step Response"], ["impulse", "Impulse Response"], ["bode", "Bode Plot"], ["polezero", "Pole-Zero Map"]] as const).map(([id, label]) => (
              <Button key={id} size="sm" onClick={() => setView(id)}
                className={cn(view === id ? "bg-chart-4 text-primary-foreground" : "bg-card border border-border text-muted-foreground")}>
                {label}
              </Button>
            ))}
          </div>

          {view === "step" && (
            <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
              <div className="text-xs font-mono text-muted-foreground mb-3">STEP RESPONSE</div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={stepData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis tick={tickStyle} label={{ value: "Amplitude", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} name="y(t)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === "impulse" && (
            <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
              <div className="text-xs font-mono text-muted-foreground mb-3">IMPULSE RESPONSE</div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={impulseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="h(t)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === "bode" && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">MAGNITUDE PLOT</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={bodeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v >= 1 ? v.toFixed(0) : v.toFixed(2)} />
                    <YAxis tick={tickStyle} label={{ value: "dB", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="magnitude" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">PHASE PLOT</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bodeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v >= 1 ? v.toFixed(0) : v.toFixed(2)} />
                    <YAxis tick={tickStyle} label={{ value: "Phase (°)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="phase" stroke="hsl(38 90% 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {view === "polezero" && (
            <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
              <div className="text-xs font-mono text-muted-foreground mb-3">POLE-ZERO MAP</div>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis type="number" dataKey="re" tick={tickStyle} name="Real"
                    label={{ value: "Real", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis type="number" dataKey="im" tick={tickStyle} name="Imag"
                    label={{ value: "Imaginary", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine x={0} stroke="hsl(220 15% 25%)" strokeWidth={2} />
                  <ReferenceLine y={0} stroke="hsl(220 15% 25%)" strokeWidth={2} />
                  <Scatter name="Poles (×)" data={poles.map((p) => ({ re: p.re, im: p.im }))}
                    fill="hsl(0 80% 55%)" shape="cross" legendType="cross" />
                  {zeros.length > 0 && (
                    <Scatter name="Zeros (○)" data={zeros.map((z) => ({ re: z.re, im: z.im }))}
                      fill="hsl(142 100% 45%)" shape="circle" />
                  )}
                </ScatterChart>
              </ResponsiveContainer>

              {/* Pole/Zero values */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-destructive mb-2">POLES</div>
                  {poles.map((p, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground">
                      s{i + 1} = {p.re.toFixed(3)}{p.im !== 0 ? ` ${p.im > 0 ? "+" : ""}${p.im.toFixed(3)}j` : ""}
                    </div>
                  ))}
                </div>
                {zeros.length > 0 && (
                  <div>
                    <div className="text-xs font-mono text-primary mb-2">ZEROS</div>
                    {zeros.map((z, i) => (
                      <div key={i} className="text-xs font-mono text-muted-foreground">
                        z{i + 1} = {z.re.toFixed(3)}{z.im !== 0 ? ` ${z.im > 0 ? "+" : ""}${z.im.toFixed(3)}j` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ControlSystemsLab;

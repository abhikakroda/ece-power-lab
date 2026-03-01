import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Settings2, Play, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  findRoots, computeBode, computeStepResponse, computeImpulseResponse,
  rootsToCoeffs,
} from "@/lib/control-engine";
import { type Complex, cx, cxMag } from "@/lib/spice-engine";

type ViewTab = "rootlocus" | "step" | "impulse" | "bode" | "polezero";

const presets = [
  { name: "1st Order", num: "1", den: "1 1", desc: "H(s) = 1/(s+1)" },
  { name: "2nd Order Underdamped", num: "25", den: "1 2 25", desc: "ζ=0.2, ωn=5" },
  { name: "2nd Order Overdamped", num: "4", den: "1 4 4", desc: "ζ=1, ωn=2" },
  { name: "2nd Order Critically Damped", num: "9", den: "1 6 9", desc: "ζ=1, ωn=3" },
  { name: "Integrator", num: "1", den: "1 0", desc: "H(s) = 1/s" },
  { name: "3rd Order", num: "60", den: "1 6 11 60", desc: "3 poles" },
  { name: "Notch Filter", num: "1 0 100", den: "1 10 100", desc: "Zeros on jω axis" },
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  color: "hsl(var(--foreground))",
};
const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };

// Interactive Pole-Zero SVG Canvas
const InteractivePoleZero = ({
  poles,
  zeros,
  onPolesChange,
}: {
  poles: Complex[];
  zeros: Complex[];
  onPolesChange: (newPoles: Complex[]) => void;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ index: number; type: "pole" } | null>(null);
  const [size, setSize] = useState({ w: 500, h: 400 });

  // Auto-compute bounds from poles/zeros
  const bounds = useMemo(() => {
    const all = [...poles, ...zeros];
    if (all.length === 0) return { xMin: -6, xMax: 2, yMin: -5, yMax: 5 };
    const reals = all.map(c => c.re);
    const imags = all.map(c => c.im);
    const maxAbs = Math.max(
      Math.max(...reals.map(Math.abs), ...imags.map(Math.abs)),
      1
    );
    const pad = maxAbs * 0.5 + 1;
    return {
      xMin: Math.min(...reals) - pad,
      xMax: Math.max(Math.max(...reals) + pad, 1),
      yMin: -Math.max(...imags.map(Math.abs)) - pad,
      yMax: Math.max(...imags.map(Math.abs)) + pad,
    };
  }, [poles, zeros]);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const toSvg = useCallback((re: number, im: number) => {
    const x = ((re - bounds.xMin) / (bounds.xMax - bounds.xMin)) * size.w;
    const y = ((bounds.yMax - im) / (bounds.yMax - bounds.yMin)) * size.h;
    return { x, y };
  }, [bounds, size]);

  const fromSvg = useCallback((sx: number, sy: number) => {
    const re = bounds.xMin + (sx / size.w) * (bounds.xMax - bounds.xMin);
    const im = bounds.yMax - (sy / size.h) * (bounds.yMax - bounds.yMin);
    return { re, im };
  }, [bounds, size]);

  const handleMouseDown = (index: number, type: "pole") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging({ index, type });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { re, im } = fromSvg(sx, sy);

    const newPoles = [...poles];
    const pole = newPoles[dragging.index];

    // If this pole has a conjugate pair, move both
    if (Math.abs(pole.im) > 1e-6) {
      // Find conjugate
      const conjIdx = newPoles.findIndex((p, i) =>
        i !== dragging.index &&
        Math.abs(p.re - pole.re) < 0.01 &&
        Math.abs(p.im + pole.im) < 0.01
      );
      newPoles[dragging.index] = cx(re, im);
      if (conjIdx >= 0) {
        newPoles[conjIdx] = cx(re, -im);
      }
    } else {
      // Real pole — keep on real axis
      newPoles[dragging.index] = cx(re, 0);
    }

    onPolesChange(newPoles);
  }, [dragging, poles, onPolesChange, fromSvg]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Grid lines
  const gridLines: JSX.Element[] = [];
  const xStep = Math.max(1, Math.round((bounds.xMax - bounds.xMin) / 8));
  const yStep = Math.max(1, Math.round((bounds.yMax - bounds.yMin) / 6));

  for (let x = Math.ceil(bounds.xMin); x <= bounds.xMax; x += xStep) {
    const { x: sx } = toSvg(x, 0);
    gridLines.push(
      <line key={`gx${x}`} x1={sx} y1={0} x2={sx} y2={size.h}
        stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />
    );
    gridLines.push(
      <text key={`tx${x}`} x={sx} y={size.h - 4} textAnchor="middle"
        fill="hsl(var(--muted-foreground))" fontSize={9}>{x}</text>
    );
  }
  for (let y = Math.ceil(bounds.yMin); y <= bounds.yMax; y += yStep) {
    const { y: sy } = toSvg(0, y);
    gridLines.push(
      <line key={`gy${y}`} x1={0} y1={sy} x2={size.w} y2={sy}
        stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4 4" />
    );
    if (y !== 0) {
      gridLines.push(
        <text key={`ty${y}`} x={4} y={sy - 3}
          fill="hsl(var(--muted-foreground))" fontSize={9}>{y}j</text>
      );
    }
  }

  // Axes
  const origin = toSvg(0, 0);
  const jAxisTop = toSvg(0, bounds.yMax);
  const jAxisBot = toSvg(0, bounds.yMin);
  const rAxisLeft = toSvg(bounds.xMin, 0);
  const rAxisRight = toSvg(bounds.xMax, 0);

  // Stability region shading (left half plane)
  const stabRight = toSvg(0, bounds.yMax);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      className="cursor-crosshair select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Stable region */}
      <rect x={0} y={0} width={stabRight.x} height={size.h}
        fill="hsl(var(--primary) / 0.03)" />

      {gridLines}

      {/* Axes */}
      <line x1={rAxisLeft.x} y1={origin.y} x2={rAxisRight.x} y2={origin.y}
        stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
      <line x1={origin.x} y1={jAxisTop.y} x2={origin.x} y2={jAxisBot.y}
        stroke="hsl(var(--muted-foreground))" strokeWidth={1} />

      {/* Stability boundary label */}
      <text x={stabRight.x + 4} y={16} fill="hsl(var(--muted-foreground))" fontSize={9} opacity={0.6}>
        jω axis
      </text>
      <text x={4} y={16} fill="hsl(var(--primary))" fontSize={9} opacity={0.5}>
        STABLE
      </text>
      <text x={stabRight.x + 4} y={28} fill="hsl(var(--destructive))" fontSize={9} opacity={0.5}>
        UNSTABLE
      </text>

      {/* Zeros */}
      {zeros.map((z, i) => {
        const { x, y } = toSvg(z.re, z.im);
        return (
          <circle key={`z${i}`} cx={x} cy={y} r={7}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        );
      })}

      {/* Poles — draggable */}
      {poles.map((p, i) => {
        const { x, y } = toSvg(p.re, p.im);
        const isActive = dragging?.index === i;
        return (
          <g key={`p${i}`}
            onMouseDown={handleMouseDown(i, "pole")}
            className="cursor-grab active:cursor-grabbing"
          >
            {/* Hit area */}
            <circle cx={x} cy={y} r={14} fill="transparent" />
            {/* Pole × */}
            <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6}
              stroke={isActive ? "hsl(var(--foreground))" : "hsl(var(--destructive))"} strokeWidth={2.5} />
            <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6}
              stroke={isActive ? "hsl(var(--foreground))" : "hsl(var(--destructive))"} strokeWidth={2.5} />
            {/* Glow when active */}
            {isActive && <circle cx={x} cy={y} r={12} fill="none"
              stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.5} />}
          </g>
        );
      })}

      {/* Labels */}
      <text x={size.w - 30} y={origin.y - 6}
        fill="hsl(var(--muted-foreground))" fontSize={10}>σ</text>
    </svg>
  );
};

const ControlSystemsLab = () => {
  const [numStr, setNumStr] = useState("25");
  const [denStr, setDenStr] = useState("1 2 25");
  const [view, setView] = useState<ViewTab>("rootlocus");
  const [tStop, setTStop] = useState(5);
  const [computed, setComputed] = useState(false);

  // Interactive poles state (separate from input-derived)
  const [interactivePoles, setInteractivePoles] = useState<Complex[] | null>(null);

  const num = useMemo(() => numStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [numStr]);
  const inputDen = useMemo(() => denStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [denStr]);

  // When computed, derive initial poles
  const basePoles = useMemo(() => computed ? findRoots(inputDen) : [], [inputDen, computed]);
  const zeros = useMemo(() => computed && num.length > 1 ? findRoots(num) : [], [num, computed]);

  // Use interactive poles if available, else base
  const activePoles = interactivePoles || basePoles;

  // Reconstruct denominator from interactive poles
  const den = useMemo(() => {
    if (interactivePoles) return rootsToCoeffs(interactivePoles);
    return inputDen;
  }, [interactivePoles, inputDen]);

  const isStable = useMemo(() => activePoles.every((p) => p.re < 0), [activePoles]);

  const stepData = useMemo(() => computed && den.length > 0 ? computeStepResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const impulseData = useMemo(() => computed ? computeImpulseResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const bodeData = useMemo(() => computed ? computeBode(num, den, 0.01, 1000, 300) : [], [num, den, computed]);

  // Reset interactive poles when base changes
  useEffect(() => {
    setInteractivePoles(null);
  }, [basePoles.length]);

  // When user starts dragging, initialize interactive poles from base
  const handlePolesChange = useCallback((newPoles: Complex[]) => {
    setInteractivePoles(newPoles);
  }, []);

  // Step response metrics
  const metrics = useMemo(() => {
    if (stepData.length === 0) return null;
    const finalVal = stepData[stepData.length - 1].value;
    const dcGain = finalVal;
    const peakVal = Math.max(...stepData.map((d) => d.value));
    const overshoot = dcGain > 0 ? ((peakVal - dcGain) / dcGain) * 100 : 0;

    const v10 = dcGain * 0.1, v90 = dcGain * 0.9;
    let t10 = 0, t90 = 0;
    for (const d of stepData) {
      if (d.value >= v10 && t10 === 0) t10 = d.time;
      if (d.value >= v90 && t90 === 0) t90 = d.time;
    }

    let tSettle = 0;
    for (let i = stepData.length - 1; i >= 0; i--) {
      if (Math.abs(stepData[i].value - dcGain) > Math.abs(dcGain) * 0.02) {
        tSettle = stepData[i].time;
        break;
      }
    }

    let zeta = 0, wn = 0;
    if (activePoles.length >= 2) {
      const dominant = activePoles.reduce((a, b) => (a.re > b.re ? a : b));
      wn = cxMag(dominant);
      zeta = wn > 0 ? -dominant.re / wn : 0;
    } else if (activePoles.length === 1) {
      wn = Math.abs(activePoles[0].re);
      zeta = 1;
    }

    return { dcGain, overshoot, riseTime: t90 - t10, settlingTime: tSettle, peakVal, zeta, wn };
  }, [stepData, activePoles]);

  const loadPreset = (p: typeof presets[0]) => {
    setNumStr(p.num);
    setDenStr(p.den);
    setComputed(false);
    setInteractivePoles(null);
  };

  const tfDisplay = useMemo(() => {
    const polyStr = (c: number[]) => c.map((v, i) => {
      const power = c.length - 1 - i;
      const coeff = Math.abs(v) === 1 && power > 0 ? "" : Math.abs(v).toFixed(Math.abs(v) % 1 === 0 ? 0 : 2);
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
          <h2 className="text-2xl font-semibold text-foreground">Control Systems Lab</h2>
          <p className="text-sm text-muted-foreground">Transfer Function • Root Locus • Step • Bode</p>
        </div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.name} onClick={() => loadPreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:border-chart-4/30 transition-all">
            {p.name}
          </button>
        ))}
      </div>

      {/* TF Input */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs text-muted-foreground mb-3">TRANSFER FUNCTION H(s) = N(s) / D(s)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Numerator (highest power first)</Label>
            <Input value={numStr} onChange={(e) => { setNumStr(e.target.value); setComputed(false); setInteractivePoles(null); }}
              className="font-mono bg-muted border-border text-foreground mt-1" placeholder="1 10 25" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Denominator (highest power first)</Label>
            <Input value={denStr} onChange={(e) => { setDenStr(e.target.value); setComputed(false); setInteractivePoles(null); }}
              className="font-mono bg-muted border-border text-foreground mt-1" placeholder="1 2 25" />
          </div>
        </div>

        {/* Display TF */}
        <div className="mt-3 p-3 rounded-lg bg-muted text-center">
          <div className="font-mono text-sm text-chart-4">{tfDisplay.num}</div>
          <div className="border-t border-muted-foreground/20 my-1 mx-8" />
          <div className="font-mono text-sm text-chart-4">{tfDisplay.den}</div>
        </div>

        <div className="flex gap-3 mt-4 items-end">
          <Button onClick={() => { setComputed(true); setInteractivePoles(null); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
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
        <div className="space-y-5 animate-fade-in">
          {/* Stability + Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={cn("px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold",
              isStable ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"
            )}>
              {isStable ? "✓ STABLE" : "✗ UNSTABLE"}
            </div>
            {metrics && (
              <>
                <div className="px-2.5 py-1 rounded bg-card border border-border text-[11px] font-mono">
                  ζ = <span className="text-foreground">{metrics.zeta.toFixed(3)}</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-card border border-border text-[11px] font-mono">
                  ωn = <span className="text-foreground">{metrics.wn.toFixed(2)}</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-card border border-border text-[11px] font-mono">
                  OS = <span className="text-foreground">{metrics.overshoot.toFixed(1)}%</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-card border border-border text-[11px] font-mono">
                  tr = <span className="text-foreground">{metrics.riseTime.toFixed(3)}s</span>
                </div>
                <div className="px-2.5 py-1 rounded bg-card border border-border text-[11px] font-mono">
                  ts = <span className="text-foreground">{metrics.settlingTime.toFixed(3)}s</span>
                </div>
              </>
            )}
          </div>

          {/* View Tabs */}
          <div className="flex gap-1.5">
            {([["rootlocus", "Root Locus"], ["step", "Step"], ["impulse", "Impulse"], ["bode", "Bode"], ["polezero", "Pole-Zero"]] as const).map(([id, label]) => (
              <Button key={id} size="sm" onClick={() => setView(id)}
                className={cn("text-xs",
                  view === id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                )}>
                {label}
              </Button>
            ))}
          </div>

          {/* Interactive Root Locus */}
          {view === "rootlocus" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">INTERACTIVE POLE-ZERO MAP</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Move size={12} /> Drag poles to move
                  </div>
                </div>
                <div className="w-full aspect-[5/4] rounded-lg bg-background border border-border overflow-hidden">
                  <InteractivePoleZero
                    poles={activePoles}
                    zeros={zeros}
                    onPolesChange={handlePolesChange}
                  />
                </div>
                {/* Pole values */}
                <div className="space-y-1">
                  {activePoles.map((p, i) => (
                    <div key={i} className="text-[11px] font-mono text-muted-foreground">
                      <span className="text-destructive">×</span> p{i + 1} = {p.re.toFixed(2)}{p.im !== 0 ? ` ${p.im > 0 ? "+" : ""}${p.im.toFixed(2)}j` : ""}
                      <span className="ml-2 text-muted-foreground/60">|p| = {cxMag(p).toFixed(2)}</span>
                    </div>
                  ))}
                  {zeros.map((z, i) => (
                    <div key={`z${i}`} className="text-[11px] font-mono text-muted-foreground">
                      <span className="text-primary">○</span> z{i + 1} = {z.re.toFixed(2)}{z.im !== 0 ? ` ${z.im > 0 ? "+" : ""}${z.im.toFixed(2)}j` : ""}
                    </div>
                  ))}
                </div>
                {interactivePoles && (
                  <button onClick={() => setInteractivePoles(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    ↩ Reset to original
                  </button>
                )}
              </div>

              {/* Live Step Response */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="text-xs text-muted-foreground">LIVE STEP RESPONSE</div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={tickStyle}
                      label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                    <YAxis tick={tickStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="y(t)" />
                  </LineChart>
                </ResponsiveContainer>

                {/* Updated denominator */}
                {interactivePoles && (
                  <div className="p-2 rounded bg-muted text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">Updated denominator</div>
                    <div className="font-mono text-xs text-chart-4">{tfDisplay.den}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "step" && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs text-muted-foreground mb-3">STEP RESPONSE</div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={stepData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={tickStyle} label={{ value: "Amplitude", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="y(t)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === "impulse" && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs text-muted-foreground mb-3">IMPULSE RESPONSE</div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={impulseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={tickStyle} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="h(t)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {view === "bode" && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="text-xs text-muted-foreground mb-3">MAGNITUDE (dB)</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={bodeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    <YAxis tick={tickStyle} label={{ value: "dB", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="magnitude" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="text-xs text-muted-foreground mb-3">PHASE (°)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bodeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                    <YAxis tick={tickStyle} label={{ value: "Phase (°)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="phase" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {view === "polezero" && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs text-muted-foreground mb-3">POLE-ZERO MAP (static)</div>
              <div className="w-full aspect-[5/3] rounded-lg bg-background border border-border overflow-hidden">
                <InteractivePoleZero
                  poles={activePoles}
                  zeros={zeros}
                  onPolesChange={handlePolesChange}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-destructive mb-2">POLES</div>
                  {activePoles.map((p, i) => (
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

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Settings2, Play, Move, Trophy, RotateCcw } from "lucide-react";
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

type ViewTab = "rootlocus" | "step" | "impulse" | "bode" | "polezero" | "game";

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

// ── Stability Game Challenges ──
interface Challenge {
  name: string;
  desc: string;
  plantNum: number[];
  plantDen: number[];
  targetSettling: number;
  maxOvershoot: number;
  difficulty: "Easy" | "Medium" | "Hard";
}

const challenges: Challenge[] = [
  {
    name: "Smooth Landing",
    desc: "Simple 2nd-order plant. Get it settled fast with minimal overshoot.",
    plantNum: [1],
    plantDen: [1, 0, 0],
    targetSettling: 3,
    maxOvershoot: 10,
    difficulty: "Easy",
  },
  {
    name: "Oscillation Killer",
    desc: "Lightly-damped plant oscillates wildly. Tame it!",
    plantNum: [100],
    plantDen: [1, 1, 100],
    targetSettling: 2,
    maxOvershoot: 15,
    difficulty: "Medium",
  },
  {
    name: "Sluggish System",
    desc: "Overdamped plant — too slow. Speed it up without ringing.",
    plantNum: [4],
    plantDen: [1, 8, 4],
    targetSettling: 4,
    maxOvershoot: 5,
    difficulty: "Easy",
  },
  {
    name: "Triple Threat",
    desc: "3rd-order system with one pole near instability. Walk the tightrope.",
    plantNum: [10],
    plantDen: [1, 3, 3, 10],
    targetSettling: 3,
    maxOvershoot: 20,
    difficulty: "Hard",
  },
  {
    name: "Speed Demon",
    desc: "Fast settling required. Push the bandwidth — but don't let overshoot explode.",
    plantNum: [50],
    plantDen: [1, 2, 50],
    targetSettling: 1,
    maxOvershoot: 12,
    difficulty: "Hard",
  },
  {
    name: "Precision Control",
    desc: "Near-zero overshoot required. Sacrifice speed for smoothness.",
    plantNum: [25],
    plantDen: [1, 4, 25],
    targetSettling: 5,
    maxOvershoot: 2,
    difficulty: "Medium",
  },
];

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

    if (Math.abs(pole.im) > 1e-6) {
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
      newPoles[dragging.index] = cx(re, 0);
    }

    onPolesChange(newPoles);
  }, [dragging, poles, onPolesChange, fromSvg]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

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

  const origin = toSvg(0, 0);
  const jAxisTop = toSvg(0, bounds.yMax);
  const jAxisBot = toSvg(0, bounds.yMin);
  const rAxisLeft = toSvg(bounds.xMin, 0);
  const rAxisRight = toSvg(bounds.xMax, 0);
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
      <rect x={0} y={0} width={stabRight.x} height={size.h}
        fill="hsl(var(--primary) / 0.03)" />

      {gridLines}

      <line x1={rAxisLeft.x} y1={origin.y} x2={rAxisRight.x} y2={origin.y}
        stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
      <line x1={origin.x} y1={jAxisTop.y} x2={origin.x} y2={jAxisBot.y}
        stroke="hsl(var(--muted-foreground))" strokeWidth={1} />

      <text x={stabRight.x + 4} y={16} fill="hsl(var(--muted-foreground))" fontSize={9} opacity={0.6}>
        jω axis
      </text>
      <text x={4} y={16} fill="hsl(var(--primary))" fontSize={9} opacity={0.5}>
        STABLE
      </text>
      <text x={stabRight.x + 4} y={28} fill="hsl(var(--destructive))" fontSize={9} opacity={0.5}>
        UNSTABLE
      </text>

      {zeros.map((z, i) => {
        const { x, y } = toSvg(z.re, z.im);
        return (
          <circle key={`z${i}`} cx={x} cy={y} r={7}
            fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        );
      })}

      {poles.map((p, i) => {
        const { x, y } = toSvg(p.re, p.im);
        const isActive = dragging?.index === i;
        return (
          <g key={`p${i}`}
            onMouseDown={handleMouseDown(i, "pole")}
            className="cursor-grab active:cursor-grabbing"
          >
            <circle cx={x} cy={y} r={14} fill="transparent" />
            <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6}
              stroke={isActive ? "hsl(var(--foreground))" : "hsl(var(--destructive))"} strokeWidth={2.5} />
            <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6}
              stroke={isActive ? "hsl(var(--foreground))" : "hsl(var(--destructive))"} strokeWidth={2.5} />
            {isActive && <circle cx={x} cy={y} r={12} fill="none"
              stroke="hsl(var(--primary))" strokeWidth={1} opacity={0.5} />}
          </g>
        );
      })}

      <text x={size.w - 30} y={origin.y - 6}
        fill="hsl(var(--muted-foreground))" fontSize={10}>σ</text>
    </svg>
  );
};

// ── Stability Game Component ──
const StabilityGame = () => {
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [gain, setGain] = useState(1);
  const [damping, setDamping] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<{ challenge: string; score: number; passed: boolean }[]>([]);

  const ch = challenges[challengeIdx];

  // Apply gain K and additional damping: C(s) = K * (s + damping) / s  simplified as gain scaling
  // We model it as: closed-loop TF = K*G / (1 + K*G) with extra damping added to denominator
  const clNum = useMemo(() => ch.plantNum.map((c) => c * gain), [ch, gain]);
  const clDen = useMemo(() => {
    // Add K*num to den for unity feedback: den + K*num
    const maxLen = Math.max(ch.plantDen.length, clNum.length);
    const padDen = [...Array(maxLen - ch.plantDen.length).fill(0), ...ch.plantDen];
    const padNum = [...Array(maxLen - clNum.length).fill(0), ...clNum];
    const result = padDen.map((d, i) => d + padNum[i]);
    // Add extra damping to s^1 coefficient
    if (result.length >= 2) {
      result[result.length - 2] += damping;
    }
    return result;
  }, [ch, clNum, damping]);

  const tStop = Math.max(ch.targetSettling * 2, 5);
  const stepData = useMemo(() => computeStepResponse(clNum, clDen, tStop, 500), [clNum, clDen, tStop]);
  const poles = useMemo(() => findRoots(clDen), [clDen]);
  const isStable = poles.every((p) => p.re < 0);

  const metrics = useMemo(() => {
    if (stepData.length === 0) return null;
    const finalVal = stepData[stepData.length - 1].value;
    const dcGain = finalVal;
    const peakVal = Math.max(...stepData.map((d) => d.value));
    const overshoot = dcGain > 0.01 ? ((peakVal - dcGain) / dcGain) * 100 : 0;

    let tSettle = tStop;
    for (let i = stepData.length - 1; i >= 0; i--) {
      if (Math.abs(stepData[i].value - dcGain) > Math.abs(dcGain) * 0.02) {
        tSettle = stepData[i].time;
        break;
      }
    }

    let zeta = 0, wn = 0;
    if (poles.length >= 2) {
      const dominant = poles.reduce((a, b) => (a.re > b.re ? a : b));
      wn = cxMag(dominant);
      zeta = wn > 0 ? -dominant.re / wn : 0;
    }

    return { dcGain, overshoot: Math.max(0, overshoot), settlingTime: tSettle, zeta, wn };
  }, [stepData, poles, tStop]);

  const overshootOk = metrics ? metrics.overshoot <= ch.maxOvershoot : false;
  const settlingOk = metrics ? metrics.settlingTime <= ch.targetSettling : false;
  const passed = isStable && overshootOk && settlingOk;

  const computeScore = () => {
    if (!metrics || !isStable) return 0;
    let score = 50; // Base for stability
    // Overshoot bonus (max 25 pts)
    if (overshootOk) {
      score += 25 * (1 - metrics.overshoot / ch.maxOvershoot);
    }
    // Settling time bonus (max 25 pts)
    if (settlingOk) {
      score += 25 * (1 - metrics.settlingTime / ch.targetSettling);
    }
    return Math.round(Math.max(0, Math.min(100, score)));
  };

  const handleSubmit = () => {
    const score = computeScore();
    setScores((p) => [...p, { challenge: ch.name, score, passed }]);
    setSubmitted(true);
  };

  const nextChallenge = () => {
    setChallengeIdx((p) => (p + 1) % challenges.length);
    setGain(1);
    setDamping(1);
    setSubmitted(false);
  };

  const resetChallenge = () => {
    setGain(1);
    setDamping(1);
    setSubmitted(false);
  };

  // Reference line at DC gain
  const refLine = metrics ? metrics.dcGain : 1;

  return (
    <div className="space-y-5">
      {/* Challenge selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {challenges.map((c, i) => (
          <button key={c.name} onClick={() => { setChallengeIdx(i); setGain(1); setDamping(1); setSubmitted(false); }}
            className={cn(
              "shrink-0 px-3 py-2 rounded-lg text-xs font-mono border transition-all",
              i === challengeIdx
                ? "bg-chart-3/10 border-chart-3/40 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}>
            <div className="font-bold">{c.name}</div>
            <div className={cn("text-[9px]",
              c.difficulty === "Easy" ? "text-primary" : c.difficulty === "Medium" ? "text-chart-3" : "text-destructive"
            )}>{c.difficulty}</div>
          </button>
        ))}
      </div>

      {/* Challenge info */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-foreground">{ch.name}</div>
          <div className={cn("text-[10px] font-mono px-2 py-0.5 rounded border",
            ch.difficulty === "Easy" ? "border-primary/30 text-primary" :
            ch.difficulty === "Medium" ? "border-chart-3/30 text-chart-3" :
            "border-destructive/30 text-destructive"
          )}>{ch.difficulty}</div>
        </div>
        <div className="text-xs text-muted-foreground mb-3">{ch.desc}</div>
        <div className="flex gap-4 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">Goal: </span>
            <span className="text-chart-3">Overshoot ≤ {ch.maxOvershoot}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Settling: </span>
            <span className="text-chart-2">t_s &lt; {ch.targetSettling}s</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Controller Gain (K)</label>
          <input type="range" min={0.1} max={50} step={0.1} value={gain}
            onChange={(e) => { setGain(parseFloat(e.target.value)); setSubmitted(false); }}
            className="w-full accent-[hsl(var(--primary))]" />
          <div className="text-sm font-mono text-primary">{gain.toFixed(1)}</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Extra Damping (ζ boost)</label>
          <input type="range" min={0} max={20} step={0.1} value={damping}
            onChange={(e) => { setDamping(parseFloat(e.target.value)); setSubmitted(false); }}
            className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="text-sm font-mono text-chart-2">{damping.toFixed(1)}</div>
        </div>
      </div>

      {/* Live metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={cn("p-3 rounded-lg border text-center",
          isStable ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"
        )}>
          <div className={cn("text-sm font-mono font-bold", isStable ? "text-primary" : "text-destructive")}>
            {isStable ? "✓ STABLE" : "✗ UNSTABLE"}
          </div>
          <div className="text-[10px] text-muted-foreground">Stability</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          overshootOk ? "border-primary/20" : "border-destructive/20"
        )}>
          <div className={cn("text-sm font-mono font-bold", overshootOk ? "text-primary" : "text-destructive")}>
            {metrics ? `${metrics.overshoot.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">Overshoot (≤{ch.maxOvershoot}%)</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          settlingOk ? "border-primary/20" : "border-destructive/20"
        )}>
          <div className={cn("text-sm font-mono font-bold", settlingOk ? "text-primary" : "text-destructive")}>
            {metrics ? `${metrics.settlingTime.toFixed(2)}s` : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">Settling (&lt;{ch.targetSettling}s)</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-4">
            {metrics ? metrics.zeta.toFixed(3) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">ζ (Damping)</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-2">
            {metrics ? metrics.wn.toFixed(2) : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">ωn (rad/s)</div>
        </div>
      </div>

      {/* Step response chart */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">STEP RESPONSE — LIVE</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={stepData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={tickStyle} />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {/* Target settling time vertical line */}
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="y(t)" />
          </LineChart>
        </ResponsiveContainer>
        {/* Constraint indicators below chart */}
        <div className="flex gap-4 mt-2 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-primary" />
            <span className="text-muted-foreground">Response</span>
          </div>
          <div className={cn("flex items-center gap-1", overshootOk ? "text-primary" : "text-destructive")}>
            {overshootOk ? "✓" : "✗"} Overshoot {metrics?.overshoot.toFixed(1)}% / {ch.maxOvershoot}%
          </div>
          <div className={cn("flex items-center gap-1", settlingOk ? "text-primary" : "text-destructive")}>
            {settlingOk ? "✓" : "✗"} Settling {metrics?.settlingTime.toFixed(2)}s / {ch.targetSettling}s
          </div>
        </div>
      </div>

      {/* Submit / Result */}
      <div className="flex gap-3">
        {!submitted ? (
          <Button onClick={handleSubmit} className="bg-chart-3 text-primary-foreground hover:bg-chart-3/80 font-mono gap-2 flex-1">
            <Trophy size={16} /> Submit Answer
          </Button>
        ) : (
          <div className="flex-1 space-y-3">
            <div className={cn("p-5 rounded-xl border text-center animate-fade-in",
              passed ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
            )}>
              <div className={cn("text-3xl font-mono font-bold mb-1", passed ? "text-primary" : "text-destructive")}>
                {computeScore()}/100
              </div>
              <div className={cn("text-sm font-mono", passed ? "text-primary" : "text-destructive")}>
                {passed ? "🏆 CHALLENGE PASSED!" : "❌ Not quite — adjust K and ζ"}
              </div>
              {passed && (
                <div className="text-xs text-muted-foreground mt-2">
                  {metrics && metrics.overshoot < ch.maxOvershoot * 0.3 && metrics.settlingTime < ch.targetSettling * 0.5
                    ? "⭐ Perfect tuning! Minimal overshoot and fast settling."
                    : "Good work. Try to get closer to zero overshoot for a higher score."}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={resetChallenge} variant="outline" className="flex-1 font-mono gap-2">
                <RotateCcw size={14} /> Retry
              </Button>
              <Button onClick={nextChallenge} className="flex-1 bg-primary text-primary-foreground font-mono gap-2">
                Next Challenge →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Scoreboard */}
      {scores.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">SCOREBOARD</div>
          <div className="flex gap-2 flex-wrap">
            {scores.map((s, i) => (
              <div key={i} className={cn("px-3 py-2 rounded-lg border text-xs font-mono",
                s.passed ? "border-primary/30 bg-primary/5 text-primary" : "border-destructive/30 bg-destructive/5 text-destructive"
              )}>
                {s.challenge}: <span className="font-bold">{s.score}/100</span> {s.passed ? "✓" : "✗"}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-2 font-mono">
            Average: {Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)}/100
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ──
const ControlSystemsLab = () => {
  const [numStr, setNumStr] = useState("25");
  const [denStr, setDenStr] = useState("1 2 25");
  const [view, setView] = useState<ViewTab>("rootlocus");
  const [tStop, setTStop] = useState(5);
  const [computed, setComputed] = useState(false);

  const [interactivePoles, setInteractivePoles] = useState<Complex[] | null>(null);

  const num = useMemo(() => numStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [numStr]);
  const inputDen = useMemo(() => denStr.trim().split(/\s+/).map(Number).filter((n) => !isNaN(n)), [denStr]);

  const basePoles = useMemo(() => computed ? findRoots(inputDen) : [], [inputDen, computed]);
  const zeros = useMemo(() => computed && num.length > 1 ? findRoots(num) : [], [num, computed]);

  const activePoles = interactivePoles || basePoles;

  const den = useMemo(() => {
    if (interactivePoles) return rootsToCoeffs(interactivePoles);
    return inputDen;
  }, [interactivePoles, inputDen]);

  const isStable = useMemo(() => activePoles.every((p) => p.re < 0), [activePoles]);

  const stepData = useMemo(() => computed && den.length > 0 ? computeStepResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const impulseData = useMemo(() => computed ? computeImpulseResponse(num, den, tStop, 500) : [], [num, den, tStop, computed]);
  const bodeData = useMemo(() => computed ? computeBode(num, den, 0.01, 1000, 300) : [], [num, den, computed]);

  useEffect(() => {
    setInteractivePoles(null);
  }, [basePoles.length]);

  const handlePolesChange = useCallback((newPoles: Complex[]) => {
    setInteractivePoles(newPoles);
  }, []);

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
          <p className="text-sm text-muted-foreground">Transfer Function • Root Locus • Stability Arena</p>
        </div>
      </div>

      {/* View Tabs — Top level now, including game */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ["rootlocus", "🎯 Root Locus"],
          ["game", "🏆 Stability Game"],
          ["step", "Step"],
          ["impulse", "Impulse"],
          ["bode", "Bode"],
          ["polezero", "Pole-Zero"],
        ] as [ViewTab, string][]).map(([id, label]) => (
          <Button key={id} size="sm" onClick={() => setView(id)}
            className={cn("text-xs",
              view === id
                ? id === "game" ? "bg-chart-3 text-primary-foreground" : "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </Button>
        ))}
      </div>

      {/* Stability Game Mode */}
      {view === "game" && <StabilityGame />}

      {/* Analysis Mode */}
      {view !== "game" && (
        <>
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
        </>
      )}
    </div>
  );
};

export default ControlSystemsLab;

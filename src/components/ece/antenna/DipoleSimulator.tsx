import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const c = 3e8; // speed of light

const DipoleSimulator = () => {
  const [lengthFrac, setLengthFrac] = useState(0.5); // fraction of λ
  const [freqMHz, setFreqMHz] = useState(300);       // MHz
  const [currentDist, setCurrentDist] = useState<"sinusoidal" | "uniform" | "triangular">("sinusoidal");

  const lambda = c / (freqMHz * 1e6);
  const L = lengthFrac * lambda;
  const k = (2 * Math.PI) / lambda;
  const halfL = L / 2;

  // Radiation pattern E(θ) for dipole
  const computePattern = (theta: number): number => {
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    if (Math.abs(sinT) < 1e-10) return 0;

    if (currentDist === "uniform") {
      // Uniform current: E ∝ sin(θ)
      return Math.abs(sinT);
    }
    if (currentDist === "triangular") {
      // Triangular: simplified pattern
      const kL2 = k * halfL;
      const num = Math.sin(kL2 * cosT);
      return Math.abs(sinT) * Math.abs(num / (kL2 * cosT || 1));
    }
    // Sinusoidal (realistic)
    const kL2 = k * halfL;
    const num = Math.cos(kL2 * cosT) - Math.cos(kL2);
    return Math.abs(num / sinT);
  };

  // Compute pattern data (361 points)
  const patternData = useMemo(() => {
    const pts: { theta: number; r: number }[] = [];
    let maxR = 0;
    for (let deg = 0; deg <= 360; deg++) {
      const theta = (deg * Math.PI) / 180;
      const r = computePattern(theta);
      if (r > maxR) maxR = r;
      pts.push({ theta, r });
    }
    // Normalize
    if (maxR > 0) pts.forEach((p) => (p.r /= maxR));
    return pts;
  }, [lengthFrac, freqMHz, currentDist]);

  // Directivity & beamwidth calculation
  const metrics = useMemo(() => {
    // Numerical integration for directivity
    let integral = 0;
    const dTheta = Math.PI / 180;
    let maxU = 0;
    let halfPowerAngles: number[] = [];

    for (let deg = 0; deg <= 180; deg++) {
      const theta = deg * dTheta;
      const u = computePattern(theta);
      const uSq = u * u;
      if (uSq > maxU) maxU = uSq;
      integral += uSq * Math.sin(theta) * dTheta;
    }

    const Prad = 2 * Math.PI * integral;
    const D = Prad > 0 ? (4 * Math.PI * maxU) / Prad : 1;
    const DdB = 10 * Math.log10(D);
    const gain = 0.95 * D; // assuming 95% efficiency
    const GdB = 10 * Math.log10(gain);

    // Half-power beamwidth
    const halfPower = maxU * 0.5;
    const hpAngles: number[] = [];
    for (let deg = 1; deg < 180; deg++) {
      const theta = deg * dTheta;
      const u1 = computePattern(theta) ** 2;
      const u0 = computePattern((deg - 1) * dTheta) ** 2;
      if ((u0 >= halfPower && u1 < halfPower) || (u0 < halfPower && u1 >= halfPower)) {
        hpAngles.push(deg);
      }
    }
    const HPBW = hpAngles.length >= 2 ? hpAngles[1] - hpAngles[0] : hpAngles.length === 1 ? 180 - 2 * hpAngles[0] : 360;

    const Rrad = lengthFrac <= 0.1 ? 20 * Math.PI * Math.PI * (lengthFrac) ** 2 :
      lengthFrac <= 0.5 ? 73 :
      lengthFrac <= 1 ? 73 + 40 * (lengthFrac - 0.5) : 100 + 50 * (lengthFrac - 1);

    return { D, DdB, gain, GdB, HPBW, Rrad: Math.round(Rrad * 10) / 10 };
  }, [lengthFrac, freqMHz, currentDist]);

  // Polar plot SVG
  const plotR = 140;
  const cx = 170, cy = 170;

  const polarPath = useMemo(() => {
    return patternData.map((p, i) => {
      const r = p.r * plotR;
      const x = cx + r * Math.sin(p.theta);
      const y = cy - r * Math.cos(p.theta);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
  }, [patternData]);

  // Current distribution on antenna
  const currentPoints = useMemo(() => {
    const pts: { y: number; amplitude: number }[] = [];
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const z = -halfL + (i / N) * L;
      const frac = z / halfL; // -1 to 1
      let amp = 0;
      if (currentDist === "sinusoidal") {
        amp = Math.sin(k * (halfL - Math.abs(z)));
      } else if (currentDist === "uniform") {
        amp = 1;
      } else {
        amp = 1 - Math.abs(frac);
      }
      pts.push({ y: 60 + (i / N) * 180, amplitude: Math.max(0, amp) });
    }
    // Normalize
    const maxA = Math.max(...pts.map((p) => p.amplitude), 0.01);
    pts.forEach((p) => (p.amplitude /= maxA));
    return pts;
  }, [lengthFrac, freqMHz, currentDist]);

  return (
    <div className="space-y-6">
      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Antenna Length (L/λ)</label>
          <input type="range" min={0.05} max={2} step={0.01} value={lengthFrac}
            onChange={(e) => setLengthFrac(parseFloat(e.target.value))}
            className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="flex justify-between text-sm font-mono">
            <span className="text-chart-2">{lengthFrac.toFixed(2)}λ</span>
            <span className="text-muted-foreground">{(L * 100).toFixed(1)} cm</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Frequency</label>
          <input type="range" min={1} max={3000} step={1} value={freqMHz}
            onChange={(e) => setFreqMHz(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--chart-3))]" />
          <div className="flex justify-between text-sm font-mono">
            <span className="text-chart-3">{freqMHz >= 1000 ? `${(freqMHz / 1000).toFixed(2)} GHz` : `${freqMHz} MHz`}</span>
            <span className="text-muted-foreground">λ = {(lambda * 100).toFixed(1)} cm</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Current Distribution</label>
          <div className="flex gap-2 mt-1">
            {(["sinusoidal", "uniform", "triangular"] as const).map((d) => (
              <button key={d} onClick={() => setCurrentDist(d)}
                className={cn("flex-1 px-2 py-2 rounded-lg text-[10px] font-mono border transition-all capitalize",
                  currentDist === d ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Directivity", value: `${metrics.DdB.toFixed(2)} dBi`, sub: `${metrics.D.toFixed(2)}`, color: "text-primary" },
          { label: "Gain", value: `${metrics.GdB.toFixed(2)} dBi`, sub: "η=95%", color: "text-chart-2" },
          { label: "HPBW", value: `${metrics.HPBW}°`, sub: "Half-power", color: "text-chart-3" },
          { label: "R_rad", value: `${metrics.Rrad} Ω`, sub: "Radiation", color: "text-chart-4" },
          { label: "Length", value: `${lengthFrac.toFixed(2)}λ`, sub: `${(L * 1000).toFixed(1)} mm`, color: "text-primary" },
        ].map((m) => (
          <div key={m.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className={cn("text-lg font-mono font-bold", m.color)}>{m.value}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{m.label}</div>
            <div className="text-[9px] text-muted-foreground/60">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Polar Radiation Pattern */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">RADIATION PATTERN (E-PLANE)</div>
          <svg width="100%" viewBox="0 0 340 340">
            {/* Concentric grid circles */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle key={f} cx={cx} cy={cy} r={plotR * f} fill="none"
                stroke="hsl(var(--border))" strokeWidth="0.5" />
            ))}
            {/* Grid labels */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <text key={`l${f}`} x={cx + 4} y={cy - plotR * f + 12}
                fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono" opacity="0.6">
                {(f * 100).toFixed(0)}%
              </text>
            ))}
            {/* Angular grid lines */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <g key={deg}>
                  <line x1={cx} y1={cy} x2={cx + plotR * Math.sin(rad)} y2={cy - plotR * Math.cos(rad)}
                    stroke="hsl(var(--border))" strokeWidth="0.3" />
                  <text x={cx + (plotR + 14) * Math.sin(rad)} y={cy - (plotR + 14) * Math.cos(rad) + 3}
                    textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
                    {deg}°
                  </text>
                </g>
              );
            })}
            {/* Axis labels */}
            <text x={cx} y={cy - plotR - 20} textAnchor="middle" fontSize="9" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono" fontWeight="bold">θ=0°</text>
            <text x={cx + plotR + 22} y={cy + 4} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">90°</text>

            {/* Pattern fill */}
            <path d={polarPath} fill="hsl(var(--primary) / 0.08)" stroke="none" />
            {/* Pattern outline */}
            <path d={polarPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

            {/* -3dB circle */}
            <circle cx={cx} cy={cy} r={plotR * 0.707} fill="none"
              stroke="hsl(var(--chart-3))" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
            <text x={cx + plotR * 0.707 + 5} y={cy - 4} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="JetBrains Mono">-3dB</text>
          </svg>
        </div>

        {/* Current Distribution */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">CURRENT DISTRIBUTION</div>
          <svg width="100%" viewBox="0 0 120 300">
            {/* Antenna rod */}
            <line x1="60" y1="60" x2="60" y2="240" stroke="hsl(var(--muted-foreground))" strokeWidth="3" strokeLinecap="round" />
            {/* Feed point */}
            <circle cx="60" cy="150" r="4" fill="hsl(var(--chart-3))" />
            <text x="72" y="154" fontSize="8" fill="hsl(var(--chart-3))" fontFamily="JetBrains Mono">Feed</text>

            {/* Current envelope */}
            {(() => {
              const leftPath = currentPoints.map((p, i) => {
                const x = 60 - p.amplitude * 35;
                return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${p.y.toFixed(1)}`;
              }).join(" ");
              const rightPath = [...currentPoints].reverse().map((p, i) => {
                const x = 60 + p.amplitude * 35;
                return `L ${x.toFixed(1)} ${p.y.toFixed(1)}`;
              }).join(" ");
              return (
                <>
                  <path d={`${leftPath} ${rightPath} Z`} fill="hsl(var(--primary) / 0.1)" stroke="none" />
                  <path d={currentPoints.map((p, i) => {
                    const x = 60 - p.amplitude * 35;
                    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${p.y.toFixed(1)}`;
                  }).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  <path d={currentPoints.map((p, i) => {
                    const x = 60 + p.amplitude * 35;
                    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${p.y.toFixed(1)}`;
                  }).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                </>
              );
            })()}

            {/* Labels */}
            <text x="60" y="52" textAnchor="middle" fontSize="8" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono">+L/2</text>
            <text x="60" y="256" textAnchor="middle" fontSize="8" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono">−L/2</text>
            <text x="60" y="280" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
              I(z) — {currentDist}
            </text>
          </svg>
        </div>
      </div>

      {/* Antenna type reference */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">STANDARD DIPOLES</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { name: "Hertzian", frac: "≪ λ", d: "1.5 (1.76 dBi)", r: "~0 Ω" },
            { name: "Half-wave", frac: "λ/2", d: "1.64 (2.15 dBi)", r: "73 Ω" },
            { name: "Full-wave", frac: "λ", d: "2.41 (3.82 dBi)", r: "~200 Ω" },
            { name: "3λ/2", frac: "1.5λ", d: "Split lobes", r: "~106 Ω" },
          ].map((a) => (
            <button key={a.name} onClick={() => setLengthFrac(a.frac === "≪ λ" ? 0.05 : a.frac === "λ/2" ? 0.5 : a.frac === "λ" ? 1 : 1.5)}
              className="p-3 rounded-lg border border-border hover:border-chart-2/30 text-left transition-all">
              <div className="font-mono font-bold text-foreground">{a.name}</div>
              <div className="text-muted-foreground">L = {a.frac}</div>
              <div className="text-chart-2">D = {a.d}</div>
              <div className="text-muted-foreground">R = {a.r}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DipoleSimulator;

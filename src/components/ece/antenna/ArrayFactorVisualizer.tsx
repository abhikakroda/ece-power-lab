import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const ArrayFactorVisualizer = () => {
  const [numElements, setNumElements] = useState(4);
  const [spacingLambda, setSpacingLambda] = useState(0.5); // d/λ
  const [phaseDeg, setPhaseDeg] = useState(0);              // progressive phase shift β (degrees)
  const [elementPattern, setElementPattern] = useState<"isotropic" | "dipole">("isotropic");

  const beta = (phaseDeg * Math.PI) / 180;
  const kd = 2 * Math.PI * spacingLambda;

  // Array factor |AF(θ)|
  const computeAF = (theta: number): number => {
    const psi = kd * Math.cos(theta) + beta;
    if (numElements === 1) return 1;
    const num = Math.sin((numElements * psi) / 2);
    const den = Math.sin(psi / 2);
    if (Math.abs(den) < 1e-10) return numElements;
    return Math.abs(num / den);
  };

  // Element pattern
  const elemPat = (theta: number): number => {
    if (elementPattern === "isotropic") return 1;
    return Math.abs(Math.sin(theta)); // dipole
  };

  // Full pattern
  const patternData = useMemo(() => {
    const pts: { deg: number; theta: number; af: number; total: number }[] = [];
    let maxAF = 0;
    let maxTotal = 0;
    for (let deg = 0; deg <= 360; deg++) {
      const theta = (deg * Math.PI) / 180;
      const af = computeAF(theta);
      const ep = elemPat(theta);
      const total = af * ep;
      if (af > maxAF) maxAF = af;
      if (total > maxTotal) maxTotal = total;
      pts.push({ deg, theta, af, total });
    }
    // Normalize
    if (maxAF > 0) pts.forEach((p) => { p.af /= maxAF; p.total /= (maxTotal || 1); });
    return pts;
  }, [numElements, spacingLambda, phaseDeg, elementPattern]);

  // Find main lobe and nulls
  const analysis = useMemo(() => {
    let mainLobeDir = 0;
    let maxVal = 0;
    const nulls: number[] = [];
    const sidelobes: { deg: number; level: number }[] = [];
    let prevRising = false;

    for (let deg = 0; deg <= 180; deg++) {
      const theta = (deg * Math.PI) / 180;
      const af = computeAF(theta);
      if (af > maxVal) { maxVal = af; mainLobeDir = deg; }
    }

    // Normalize and find nulls + sidelobes
    let prevVal = 0;
    for (let deg = 1; deg < 180; deg++) {
      const theta = (deg * Math.PI) / 180;
      const af = computeAF(theta) / (maxVal || 1);
      if (af < 0.02 && prevVal >= 0.02) nulls.push(deg);
      if (af > prevVal && !prevRising) prevRising = true;
      if (af < prevVal && prevRising && af > 0.05 && Math.abs(deg - mainLobeDir) > 10) {
        sidelobes.push({ deg: deg - 1, level: prevVal });
        prevRising = false;
      }
      prevVal = af;
    }

    // Grating lobes: check if d/λ ≥ 1/(1+|cos(main)|)
    const hasGrating = spacingLambda >= 1;
    const gratingWarning = spacingLambda > 0.8;

    // Beamwidth estimate
    let bwLeft = mainLobeDir, bwRight = mainLobeDir;
    for (let deg = mainLobeDir; deg >= 0; deg--) {
      const af = computeAF((deg * Math.PI) / 180) / (maxVal || 1);
      if (af < 0.707) { bwLeft = deg; break; }
    }
    for (let deg = mainLobeDir; deg <= 180; deg++) {
      const af = computeAF((deg * Math.PI) / 180) / (maxVal || 1);
      if (af < 0.707) { bwRight = deg; break; }
    }
    const HPBW = bwRight - bwLeft;

    // Scan angle from broadside
    const scanAngle = mainLobeDir - 90;

    return { mainLobeDir, HPBW, nulls: nulls.slice(0, 4), sidelobes: sidelobes.slice(0, 3), hasGrating, gratingWarning, scanAngle };
  }, [numElements, spacingLambda, phaseDeg]);

  // SVG polar plot
  const plotR = 150;
  const cx = 180, cy = 180;

  const makePolarPath = (data: { theta: number; r: number }[]) => {
    return data.map((p, i) => {
      const r = p.r * plotR;
      const x = cx + r * Math.sin(p.theta);
      const y = cy - r * Math.cos(p.theta);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
  };

  const afPath = makePolarPath(patternData.map((p) => ({ theta: p.theta, r: p.af })));
  const totalPath = makePolarPath(patternData.map((p) => ({ theta: p.theta, r: p.total })));

  // Cartesian AF plot (dB)
  const cartData = useMemo(() => {
    const pts: { deg: number; dB: number }[] = [];
    let maxAF = 0;
    for (let deg = 0; deg <= 180; deg++) {
      const af = computeAF((deg * Math.PI) / 180);
      if (af > maxAF) maxAF = af;
    }
    for (let deg = 0; deg <= 180; deg++) {
      const af = computeAF((deg * Math.PI) / 180) / (maxAF || 1);
      const dB = af > 1e-6 ? 20 * Math.log10(af) : -60;
      pts.push({ deg, dB: Math.max(-40, dB) });
    }
    return pts;
  }, [numElements, spacingLambda, phaseDeg]);

  const cartW = 500, cartH = 200;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Number of Elements (N)</label>
          <input type="range" min={2} max={16} step={1} value={numElements}
            onChange={(e) => setNumElements(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]" />
          <div className="text-sm font-mono text-primary">{numElements}</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Element Spacing (d/λ)</label>
          <input type="range" min={0.1} max={2} step={0.01} value={spacingLambda}
            onChange={(e) => setSpacingLambda(parseFloat(e.target.value))}
            className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="flex justify-between text-sm font-mono">
            <span className="text-chart-2">{spacingLambda.toFixed(2)}λ</span>
            {analysis.gratingWarning && <span className="text-destructive text-[10px]">⚠ Grating risk</span>}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Phase Shift (β)</label>
          <input type="range" min={-180} max={180} step={1} value={phaseDeg}
            onChange={(e) => setPhaseDeg(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--chart-3))]" />
          <div className="flex justify-between text-sm font-mono">
            <span className="text-chart-3">{phaseDeg}°</span>
            <span className="text-muted-foreground text-[10px]">{phaseDeg === 0 ? "Broadside" : phaseDeg === 180 || phaseDeg === -180 ? "End-fire" : "Scanned"}</span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Element Pattern</label>
          <div className="flex gap-2 mt-1">
            {(["isotropic", "dipole"] as const).map((p) => (
              <button key={p} onClick={() => setElementPattern(p)}
                className={cn("flex-1 px-2 py-2 rounded-lg text-[10px] font-mono border transition-all capitalize",
                  elementPattern === p ? "bg-chart-4/10 border-chart-4/30 text-chart-4" : "border-border text-muted-foreground"
                )}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Main Lobe", value: `${analysis.mainLobeDir}°`, color: "text-primary" },
          { label: "HPBW", value: `${analysis.HPBW}°`, color: "text-chart-2" },
          { label: "Scan Angle", value: `${analysis.scanAngle > 0 ? "+" : ""}${analysis.scanAngle}°`, color: "text-chart-3" },
          { label: "Nulls", value: analysis.nulls.length.toString(), color: "text-chart-4" },
          { label: "Grating", value: analysis.hasGrating ? "YES ⚠" : "No", color: analysis.hasGrating ? "text-destructive" : "text-primary" },
        ].map((m) => (
          <div key={m.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className={cn("text-lg font-mono font-bold", m.color)}>{m.value}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Polar plot */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">
            POLAR PATTERN
            <span className="text-primary ml-2">■ AF</span>
            {elementPattern === "dipole" && <span className="text-chart-3 ml-2">■ Total</span>}
          </div>
          <svg width="100%" viewBox="0 0 360 360">
            {/* Grid */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle key={f} cx={cx} cy={cy} r={plotR * f} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
            ))}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <g key={deg}>
                  <line x1={cx} y1={cy} x2={cx + plotR * Math.sin(rad)} y2={cy - plotR * Math.cos(rad)}
                    stroke="hsl(var(--border))" strokeWidth="0.3" />
                  <text x={cx + (plotR + 14) * Math.sin(rad)} y={cy - (plotR + 14) * Math.cos(rad) + 3}
                    textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
                    {deg}°
                  </text>
                </g>
              );
            })}

            {/* -3dB ring */}
            <circle cx={cx} cy={cy} r={plotR * 0.707} fill="none"
              stroke="hsl(var(--chart-3))" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.4" />

            {/* Total pattern (if dipole element) */}
            {elementPattern === "dipole" && (
              <>
                <path d={totalPath} fill="hsl(var(--chart-3) / 0.06)" stroke="none" />
                <path d={totalPath} fill="none" stroke="hsl(var(--chart-3))" strokeWidth="1.5" opacity="0.7" />
              </>
            )}

            {/* AF pattern */}
            <path d={afPath} fill="hsl(var(--primary) / 0.08)" stroke="none" />
            <path d={afPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

            {/* Main lobe direction indicator */}
            {(() => {
              const rad = (analysis.mainLobeDir * Math.PI) / 180;
              return (
                <line x1={cx} y1={cy} x2={cx + (plotR + 5) * Math.sin(rad)} y2={cy - (plotR + 5) * Math.cos(rad)}
                  stroke="hsl(var(--chart-2))" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
              );
            })()}
          </svg>
        </div>

        {/* Cartesian dB plot */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">ARRAY FACTOR (dB)</div>
          <svg width="100%" viewBox={`0 0 ${cartW} ${cartH}`}>
            {/* Grid */}
            {[-40, -30, -20, -10, 0].map((dB) => {
              const y = 20 + ((0 - dB) / 40) * (cartH - 40);
              return (
                <g key={dB}>
                  <line x1="50" y1={y} x2={cartW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />
                  <text x="45" y={y + 3} textAnchor="end" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{dB}</text>
                </g>
              );
            })}
            {[0, 30, 60, 90, 120, 150, 180].map((deg) => {
              const x = 50 + (deg / 180) * (cartW - 60);
              return (
                <g key={deg}>
                  <line x1={x} y1="20" x2={x} y2={cartH - 20} stroke="hsl(var(--border))" strokeWidth="0.5" />
                  <text x={x} y={cartH - 6} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{deg}°</text>
                </g>
              );
            })}

            {/* -3dB line */}
            <line x1="50" y1={20 + (3 / 40) * (cartH - 40)} x2={cartW - 10} y2={20 + (3 / 40) * (cartH - 40)}
              stroke="hsl(var(--chart-3))" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5" />
            <text x={cartW - 8} y={20 + (3 / 40) * (cartH - 40) - 3} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="JetBrains Mono" textAnchor="end">-3dB</text>

            {/* Curve */}
            <path d={cartData.map((p, i) => {
              const x = 50 + (p.deg / 180) * (cartW - 60);
              const y = 20 + ((0 - p.dB) / 40) * (cartH - 40);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            }).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

            {/* Null markers */}
            {analysis.nulls.map((deg, i) => {
              const x = 50 + (deg / 180) * (cartW - 60);
              return (
                <g key={i}>
                  <line x1={x} y1="20" x2={x} y2={cartH - 20}
                    stroke="hsl(var(--destructive))" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.5" />
                  <text x={x} y="16" textAnchor="middle" fontSize="7" fill="hsl(var(--destructive))" fontFamily="JetBrains Mono">null</text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text x={cartW / 2} y={cartH} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">θ (degrees)</text>
            <text x="10" y={cartH / 2} textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="JetBrains Mono" transform={`rotate(-90, 10, ${cartH / 2})`}>|AF| (dB)</text>
          </svg>
        </div>
      </div>

      {/* Array geometry visual */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">ARRAY GEOMETRY</div>
        <svg width="100%" viewBox="0 0 600 80">
          {/* Elements */}
          {Array.from({ length: numElements }).map((_, i) => {
            const x = 50 + (i / (numElements - 1 || 1)) * 500;
            const phase = (i * phaseDeg) % 360;
            return (
              <g key={i}>
                {/* Phase indicator arc */}
                {phaseDeg !== 0 && (
                  <path
                    d={`M ${x} 40 L ${x + 12 * Math.cos((-90 + phase) * Math.PI / 180)} ${40 + 12 * Math.sin((-90 + phase) * Math.PI / 180)}`}
                    stroke="hsl(var(--chart-3))" strokeWidth="1.5" opacity="0.6" />
                )}
                {/* Element */}
                <line x1={x} y1="25" x2={x} y2="55" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
                <circle cx={x} cy="40" r="3" fill="hsl(var(--primary))" />
                <text x={x} y="70" textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
                  {i + 1}
                </text>
                {/* Spacing label */}
                {i < numElements - 1 && (
                  <text x={(x + 50 + ((i + 1) / (numElements - 1 || 1)) * 500) / 2} y="18"
                    textAnchor="middle" fontSize="7" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono">
                    d={spacingLambda.toFixed(2)}λ
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Presets */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">COMMON CONFIGURATIONS</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { name: "Broadside", n: 4, d: 0.5, p: 0, desc: "Max radiation ⊥ to array" },
            { name: "End-fire", n: 4, d: 0.25, p: -90, desc: "Max radiation along array" },
            { name: "Scanned 30°", n: 8, d: 0.5, p: -90, desc: "Beam steered to 30° off broadside" },
            { name: "Grating Demo", n: 4, d: 1.5, p: 0, desc: "Shows grating lobe problem" },
          ].map((preset) => (
            <button key={preset.name}
              onClick={() => { setNumElements(preset.n); setSpacingLambda(preset.d); setPhaseDeg(preset.p); }}
              className="p-3 rounded-lg border border-border hover:border-chart-2/30 text-left transition-all">
              <div className="font-mono font-bold text-foreground">{preset.name}</div>
              <div className="text-muted-foreground">N={preset.n}, d={preset.d}λ, β={preset.p}°</div>
              <div className="text-chart-2 mt-1">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Grating lobe warning */}
      {analysis.hasGrating && (
        <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
          <div className="text-xs font-mono text-destructive mb-1">⚠ GRATING LOBES PRESENT</div>
          <div className="text-xs text-destructive/80">
            Element spacing d = {spacingLambda.toFixed(2)}λ exceeds λ. Multiple main lobes appear, reducing directivity.
            For no grating lobes: d &lt; λ/(1 + |sin θ₀|) where θ₀ is the scan angle from broadside.
          </div>
        </div>
      )}
    </div>
  );
};

export default ArrayFactorVisualizer;

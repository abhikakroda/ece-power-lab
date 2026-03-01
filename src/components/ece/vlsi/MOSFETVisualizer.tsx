import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, Zap, Eye, EyeOff } from "lucide-react";

const MOSFETVisualizer = () => {
  const [tox, setTox] = useState(5);
  const [Lch, setLch] = useState(100);
  const [Na, setNa] = useState(1e17);
  const [Vgs, setVgs] = useState(0.8);
  const [Vds, setVds] = useState(1.0);
  const [sweepMode, setSweepMode] = useState<"vgs" | "vds">("vgs");
  const [showLog, setShowLog] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [compareLch, setCompareLch] = useState<number | null>(null);

  // Physical constants
  const epsOx = 3.9 * 8.854e-12;
  const epsSi = 11.7 * 8.854e-12;
  const q = 1.6e-19;
  const k = 1.38e-23;
  const T = 300;
  const ni = 1.5e10 * 1e6;
  const Vt = k * T / q; // thermal voltage

  const compute = (L: number, toxVal: number, NaVal: number) => {
    const phiF = Vt * Math.log(NaVal * 1e6 / ni);
    const Cox = epsOx / (toxVal * 1e-9);
    const Vth0 = 0.4 + 2 * phiF + Math.sqrt(2 * epsSi * q * NaVal * 1e6 * 2 * phiF) / Cox;
    const DIBL = 0.08 * (50 / L);
    const Vth = Math.max(0.05, Vth0 - DIBL * 1.0); // at Vds=1
    const mu = 400e-4;
    const W = 1e-6;
    const Kp = mu * Cox * (W / (L * 1e-9));
    const lambda = 0.05 * (50 / L);

    // Gate leakage model (tunneling)
    const Jgate = toxVal < 1.5 ? 1e4 * Math.exp(-toxVal / 0.4) :
                  toxVal < 3 ? 100 * Math.exp(-toxVal / 0.8) :
                  toxVal < 5 ? 1 * Math.exp(-toxVal / 1.5) : 0.01;
    const Igate = Jgate * W * L * 1e-9 * 1e6; // nA

    // Subthreshold swing
    const n = 1 + Math.sqrt(epsSi * q * NaVal * 1e6 / (2 * 2 * phiF)) / Cox;
    const SS = n * Vt * Math.log(10) * 1000; // mV/decade

    // Off-current (subthreshold at Vgs=0)
    const Ioff = Kp * (Vt * Vt) * Math.exp(-Vth / (n * Vt)) * 1e9; // nA

    // GIDL estimate
    const GIDL = L < 30 ? 0.1 * (30 / L) : 0.01;

    // Velocity saturation
    const vsat = 1e5; // m/s
    const Esat = 2 * vsat / mu;
    const Leff = L * 1e-9;
    const velSatFactor = 1 / (1 + Leff * Esat > 0 ? Vds / (Leff * Esat) : 0);

    return { phiF, Cox, Vth0, DIBL, Vth, Kp, lambda, Jgate, Igate, n, SS, Ioff, GIDL, velSatFactor };
  };

  const params = useMemo(() => compute(Lch, tox, Na), [Lch, tox, Na]);
  const { phiF, Cox, Vth0, DIBL, Vth, Kp, lambda, Igate, n, SS, Ioff, GIDL, velSatFactor } = params;

  const VthActual = Math.max(0.05, Vth0 - DIBL * Vds);

  const calcId = (vgs: number, vds: number): number => {
    const vth = Math.max(0.05, Vth0 - DIBL * vds);
    if (vgs < vth) {
      return Kp * (Vt * Vt) * Math.exp((vgs - vth) / (n * Vt)) * 1e3;
    }
    const vov = vgs - vth;
    if (vds < vov) {
      return Kp * (vov * vds - 0.5 * vds * vds) * (1 + lambda * vds) * velSatFactor * 1e3;
    }
    return 0.5 * Kp * vov * vov * (1 + lambda * vds) * velSatFactor * 1e3;
  };

  // Compare calc for overlay
  const calcIdCompare = compareLch ? (() => {
    const cp = compute(compareLch, tox, Na);
    return (vgs: number, vds: number): number => {
      const vth = Math.max(0.05, cp.Vth0 - cp.DIBL * vds);
      if (vgs < vth) return cp.Kp * (Vt * Vt) * Math.exp((vgs - vth) / (cp.n * Vt)) * 1e3;
      const vov = vgs - vth;
      if (vds < vov) return cp.Kp * (vov * vds - 0.5 * vds * vds) * (1 + cp.lambda * vds) * cp.velSatFactor * 1e3;
      return 0.5 * cp.Kp * vov * vov * (1 + cp.lambda * vds) * cp.velSatFactor * 1e3;
    };
  })() : null;

  const Wd = Math.sqrt(2 * epsSi * 2 * phiF / (q * Na * 1e6)) * 1e9;
  const currentId = calcId(Vgs, Vds);
  const region = Vgs < VthActual ? "Subthreshold" : (Vds < (Vgs - VthActual)) ? "Triode" : "Saturation";

  // Sweep data
  const sweepData = useMemo(() => {
    const pts: { x: number; y: number; yComp?: number }[] = [];
    if (sweepMode === "vgs") {
      for (let v = 0; v <= 1.8; v += 0.02) {
        pts.push({
          x: v,
          y: calcId(v, Vds),
          yComp: calcIdCompare ? calcIdCompare(v, Vds) : undefined,
        });
      }
    } else {
      for (let v = 0; v <= 1.8; v += 0.02) {
        pts.push({
          x: v,
          y: calcId(Vgs, v),
          yComp: calcIdCompare ? calcIdCompare(Vgs, v) : undefined,
        });
      }
    }
    return pts;
  }, [Vgs, Vds, sweepMode, VthActual, Kp, lambda, velSatFactor, calcIdCompare]);

  // Vth vs L curve data
  const vthVsL = useMemo(() => {
    const pts: { L: number; Vth: number; Ioff: number; DIBL: number }[] = [];
    for (let L = 14; L <= 500; L += (L < 50 ? 2 : L < 100 ? 5 : 10)) {
      const p = compute(L, tox, Na);
      pts.push({ L, Vth: p.Vth, Ioff: p.Ioff, DIBL: p.DIBL * 1000 });
    }
    return pts;
  }, [tox, Na]);

  // Family curves for VDS sweep
  const familyCurves = useMemo(() => {
    if (sweepMode !== "vds") return [];
    const curves: { vgs: number; path: string; color: string }[] = [];
    const vgsVals = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4];
    const colors = [
      "hsl(var(--muted-foreground))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
      "hsl(var(--primary))", "hsl(var(--chart-4))", "hsl(var(--destructive))",
    ];
    const allPts: number[] = [];
    vgsVals.forEach(vg => { for (let v = 0; v <= 1.8; v += 0.02) allPts.push(calcId(vg, v)); });
    const fMax = Math.max(...allPts, 0.01);
    vgsVals.forEach((vg, ci) => {
      const pts: string[] = [];
      for (let v = 0; v <= 1.8; v += 0.02) {
        const id = calcId(vg, v);
        const sx = 50 + (v / 1.8) * (graphW - 60);
        const sy = graphH - 20 - (id / fMax) * (graphH - 40);
        pts.push(`${pts.length === 0 ? "M" : "L"} ${sx} ${sy}`);
      }
      curves.push({ vgs: vg, path: pts.join(" "), color: colors[ci] });
    });
    return curves;
  }, [sweepMode, VthActual, Kp, lambda, Vds, velSatFactor]);

  const graphW = 400, graphH = 220;

  // SVG helpers
  const maxY = showLog
    ? Math.max(...sweepData.map(p => p.y > 0 ? Math.log10(p.y) : -6), -1)
    : Math.max(...sweepData.map(p => p.y), 0.01);
  const minY = showLog ? -6 : 0;
  const maxX = 1.8;

  const toSvg = (x: number, y: number) => {
    const yVal = showLog ? (y > 0 ? Math.log10(y) : -6) : y;
    return {
      sx: 50 + (x / maxX) * (graphW - 60),
      sy: graphH - 20 - ((yVal - minY) / (maxY - minY)) * (graphH - 40),
    };
  };

  const buildPath = (data: { x: number; y: number }[]) =>
    data.map((p, i) => {
      const { sx, sy } = toSvg(p.x, p.y);
      return `${i === 0 ? "M" : "L"} ${sx} ${Math.max(20, Math.min(graphH - 20, sy))}`;
    }).join(" ");

  const pathD = buildPath(sweepData);
  const compPathD = sweepData[0]?.yComp !== undefined
    ? buildPath(sweepData.map(p => ({ x: p.x, y: p.yComp! })))
    : null;

  // Channel viz
  const channelStrength = Vgs < VthActual ? 0 : Math.min(1, (Vgs - VthActual) / 0.8);
  const depletionWidth = Math.min(30, Wd / 5);

  // Short channel severity score (0–100)
  const sceScore = Math.min(100, Math.round(
    (DIBL * Vds * 1000) / 2 +          // DIBL contribution
    (lambda > 0.05 ? (lambda - 0.05) * 500 : 0) + // CLM
    (Ioff > 10 ? Math.min(30, Ioff / 5) : 0) +    // Leakage
    (SS > 80 ? (SS - 60) / 2 : 0)                  // SS degradation
  ));

  // Vth vs L SVG
  const vthGraph = useMemo(() => {
    const w = 380, h = 160;
    const maxVth = Math.max(...vthVsL.map(p => p.Vth), 0.5);
    const minVth = Math.min(...vthVsL.map(p => p.Vth), 0);
    const maxL = 500;

    const toS = (L: number, v: number) => ({
      sx: 40 + (L / maxL) * (w - 50),
      sy: h - 20 - ((v - minVth) / (maxVth - minVth || 1)) * (h - 35),
    });

    const path = vthVsL.map((p, i) => {
      const { sx, sy } = toS(p.L, p.Vth);
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    }).join(" ");

    // Current L marker
    const cur = toS(Lch, Vth);

    return { path, cur, w, h, maxVth, minVth, maxL, toS };
  }, [vthVsL, Lch, Vth]);

  return (
    <div className="space-y-6">
      {/* Parameter sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Oxide Thickness (t_ox)</label>
          <input type="range" min={1} max={20} step={0.5} value={tox}
            onChange={e => setTox(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="text-sm font-mono text-chart-2">{tox} nm</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-mono">Channel Length (L)</label>
            {Lch < 45 && <AlertTriangle size={12} className="text-destructive animate-pulse" />}
          </div>
          <input type="range" min={7} max={500} step={1} value={Lch}
            onChange={e => setLch(parseInt(e.target.value))} className="w-full accent-[hsl(var(--chart-3))]" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-chart-3">{Lch} nm</span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {Lch <= 7 ? "2nm node" : Lch <= 14 ? "3nm node" : Lch <= 22 ? "5nm" : Lch <= 45 ? "7nm" : Lch <= 90 ? "legacy" : "long-ch"}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Doping (N_A)</label>
          <input type="range" min={15} max={19} step={0.1} value={Math.log10(Na)}
            onChange={e => setNa(Math.pow(10, parseFloat(e.target.value)))} className="w-full accent-[hsl(var(--chart-4))]" />
          <div className="text-sm font-mono text-chart-4">10^{Math.log10(Na).toFixed(1)} /cm³</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">V_GS</label>
          <input type="range" min={0} max={1.8} step={0.01} value={Vgs}
            onChange={e => setVgs(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
          <div className="text-sm font-mono text-primary">{Vgs.toFixed(2)} V</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">V_DS</label>
          <input type="range" min={0} max={1.8} step={0.01} value={Vds}
            onChange={e => setVds(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="text-sm font-mono text-chart-2">{Vds.toFixed(2)} V</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Compare with L =</label>
          <div className="flex gap-1.5 flex-wrap">
            {[null, 14, 22, 45, 90, 250].map(v => (
              <button key={v ?? "none"} onClick={() => setCompareLch(v)}
                className={cn("px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                  compareLch === v ? "bg-chart-3/15 border-chart-3/40 text-chart-3" : "border-border text-muted-foreground"
                )}>
                {v ? `${v}nm` : "Off"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Device parameters + SCE severity */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: "V_th", value: `${VthActual.toFixed(3)}V`, color: "text-chart-2" },
          { label: "I_D", value: `${currentId.toFixed(3)}mA`, color: "text-primary" },
          { label: "Region", value: region, color: region === "Saturation" ? "text-chart-3" : region === "Subthreshold" ? "text-destructive" : "text-chart-2" },
          { label: "SS", value: `${SS.toFixed(0)}mV/dec`, color: SS > 80 ? "text-destructive" : "text-chart-2" },
          { label: "I_off", value: `${Ioff.toFixed(2)}nA`, color: Ioff > 10 ? "text-destructive" : "text-chart-4" },
          { label: "I_gate", value: `${Igate.toFixed(2)}nA`, color: Igate > 1 ? "text-destructive" : "text-chart-4" },
          { label: "λ", value: lambda.toFixed(3), color: lambda > 0.1 ? "text-destructive" : "text-chart-2" },
          { label: "W_dep", value: `${Wd.toFixed(0)}nm`, color: "text-chart-4" },
        ].map(p => (
          <div key={p.label} className="p-2 rounded-lg bg-card border border-border text-center">
            <div className="text-[8px] text-muted-foreground font-mono">{p.label}</div>
            <div className={cn("text-[11px] font-mono font-bold", p.color)}>{p.value}</div>
          </div>
        ))}
      </div>

      {/* SCE Severity bar */}
      <div className="p-3 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Short-Channel Effect Severity</span>
          <span className={cn("text-xs font-mono font-bold",
            sceScore > 60 ? "text-destructive" : sceScore > 30 ? "text-chart-3" : "text-primary"
          )}>{sceScore}/100</span>
        </div>
        <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500",
            sceScore > 60 ? "bg-destructive" : sceScore > 30 ? "bg-chart-3" : "bg-primary"
          )} style={{ width: `${sceScore}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[8px] font-mono text-muted-foreground">
          <span>Long-channel behavior</span>
          <span>Severe SCE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* I-V Characteristics */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="text-xs font-mono text-muted-foreground">I-V CHARACTERISTICS</div>
            <div className="flex-1" />
            <button onClick={() => setShowLog(!showLog)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                showLog ? "bg-chart-3/15 border-chart-3/40 text-chart-3" : "border-border text-muted-foreground"
              )}>
              {showLog ? "Log" : "Linear"}
            </button>
            <button onClick={() => setShowAnnotations(!showAnnotations)}
              className="text-muted-foreground hover:text-foreground transition-colors">
              {showAnnotations ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {(["vgs", "vds"] as const).map(m => (
              <button key={m} onClick={() => setSweepMode(m)}
                className={cn("px-2.5 py-0.5 rounded text-[10px] font-mono border transition-all",
                  sweepMode === m ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
                )}>
                I_D-V_{m.slice(1).toUpperCase()}
              </button>
            ))}
          </div>
          <svg width="100%" viewBox={`0 0 ${graphW} ${graphH}`}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const yVal = minY + f * (maxY - minY);
              const sy = graphH - 20 - f * (graphH - 40);
              return (
                <g key={f}>
                  <line x1="50" y1={sy} x2={graphW - 10} y2={sy} stroke="hsl(var(--border))" strokeWidth="0.5" />
                  <text x="45" y={sy + 3} textAnchor="end" fontSize="7"
                    fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                    {showLog ? `10^${yVal.toFixed(1)}` : yVal.toFixed(2)}
                  </text>
                </g>
              );
            })}
            {[0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8].map(v => (
              <g key={v}>
                <line x1={50 + (v / 1.8) * (graphW - 60)} y1="20" x2={50 + (v / 1.8) * (graphW - 60)} y2={graphH - 20}
                  stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x={50 + (v / 1.8) * (graphW - 60)} y={graphH - 6} textAnchor="middle" fontSize="7"
                  fill="hsl(var(--muted-foreground))" fontFamily="monospace">{v.toFixed(1)}</text>
              </g>
            ))}

            {/* Vth marker */}
            {sweepMode === "vgs" && (
              <g>
                <line x1={50 + (VthActual / 1.8) * (graphW - 60)} y1="20"
                  x2={50 + (VthActual / 1.8) * (graphW - 60)} y2={graphH - 20}
                  stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                {showAnnotations && (
                  <text x={50 + (VthActual / 1.8) * (graphW - 60) + 3} y={30} fontSize="7"
                    fill="hsl(var(--destructive))" fontFamily="monospace">V_th={VthActual.toFixed(2)}V</text>
                )}
              </g>
            )}

            {/* Subthreshold region annotation */}
            {sweepMode === "vgs" && showAnnotations && showLog && (
              <g>
                {/* SS slope line */}
                <text x={55} y={35} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace">
                  SS={SS.toFixed(0)}mV/dec
                </text>
                <text x={55} y={45} fontSize="6" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  (ideal=60mV/dec)
                </text>
              </g>
            )}

            {/* Compare curve */}
            {compPathD && (
              <path d={compPathD} fill="none" stroke="hsl(var(--chart-3))" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.7" />
            )}

            {/* Main curves */}
            {sweepMode === "vds" && familyCurves.length > 0 ? (
              familyCurves.map(c => (
                <g key={c.vgs}>
                  <path d={c.path} fill="none" stroke={c.color} strokeWidth={Math.abs(c.vgs - Vgs) < 0.05 ? 2.5 : 1.2}
                    opacity={Math.abs(c.vgs - Vgs) < 0.05 ? 1 : 0.5} />
                </g>
              ))
            ) : (
              <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
            )}

            {/* Operating point */}
            {(() => {
              const xv = sweepMode === "vgs" ? Vgs : Vds;
              const { sx, sy } = toSvg(xv, currentId);
              return <circle cx={sx} cy={Math.max(22, Math.min(graphH - 22, sy))} r="4" fill="hsl(var(--primary))" className="animate-pulse" />;
            })()}

            {/* Axis labels */}
            <text x={graphW / 2} y={graphH} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
              V_{sweepMode === "vgs" ? "GS" : "DS"} (V)
            </text>
            <text x="10" y={graphH / 2} textAnchor="middle" fontSize="8" fill="hsl(var(--primary))" fontFamily="monospace"
              transform={`rotate(-90, 10, ${graphH / 2})`}>I_D ({showLog ? "log" : "mA"})</text>

            {/* Compare legend */}
            {compareLch && (
              <g>
                <line x1={graphW - 100} y1={25} x2={graphW - 80} y2={25} stroke="hsl(var(--chart-3))" strokeWidth="1.5" strokeDasharray="5 3" />
                <text x={graphW - 76} y={28} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace">L={compareLch}nm</text>
                <line x1={graphW - 100} y1={36} x2={graphW - 80} y2={36} stroke="hsl(var(--primary))" strokeWidth="2" />
                <text x={graphW - 76} y={39} fontSize="7" fill="hsl(var(--primary))" fontFamily="monospace">L={Lch}nm</text>
              </g>
            )}
          </svg>
        </div>

        {/* MOSFET Cross-Section */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">MOSFET CROSS-SECTION</div>
          <svg width="100%" viewBox="0 0 360 240">
            <rect x="40" y="120" width="280" height="100" fill="hsl(var(--muted) / 0.6)" stroke="hsl(var(--border))" />
            <text x="180" y="200" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace">P-substrate</text>

            {/* Depletion region */}
            <rect x="100" y={120 - depletionWidth * 0.3} width="160" height={depletionWidth + 10}
              fill="hsl(var(--chart-4) / 0.15)" stroke="hsl(var(--chart-4) / 0.3)" strokeWidth="1" strokeDasharray="3 3"
              className="transition-all duration-300" />

            {/* Gate oxide */}
            <rect x="100" y={100 - tox * 0.8} width="160" height={Math.max(4, tox * 0.8)}
              fill="hsl(var(--chart-3) / 0.3)" stroke="hsl(var(--chart-3) / 0.5)" strokeWidth="1"
              className="transition-all duration-300" />
            <text x="180" y={95 - tox * 0.8} textAnchor="middle" fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace">
              SiO₂ ({tox}nm)
            </text>

            {/* Gate metal */}
            <rect x="110" y={80 - tox * 0.8} width="140" height="20" rx="3"
              fill="hsl(var(--chart-2) / 0.3)" stroke="hsl(var(--chart-2) / 0.6)" strokeWidth="1.5" />
            <text x="180" y={94 - tox * 0.8} textAnchor="middle" fontSize="10" fill="hsl(var(--chart-2))" fontFamily="monospace" fontWeight="bold">GATE</text>

            {/* Source N+ */}
            <rect x="40" y="100" width="60" height="40" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
            <text x="70" y="124" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace" fontWeight="bold">N+ Src</text>

            {/* Drain N+ */}
            <rect x="260" y="100" width="60" height="40" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
            <text x="290" y="124" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace" fontWeight="bold">N+ Drn</text>

            {/* Channel */}
            {channelStrength > 0 && (
              <rect x="100" y="115" width="160" height={4 + channelStrength * 4}
                fill={`hsl(var(--primary) / ${channelStrength * 0.4})`}
                className="transition-all duration-500" rx="1" />
            )}

            {/* Leakage arrows when subthreshold */}
            {Vgs < VthActual && Ioff > 1 && (
              <g className="animate-pulse">
                <line x1="110" y1="125" x2="250" y2="125" stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="2 3" markerEnd="url(#arrowRed)" />
                <text x="180" y="138" textAnchor="middle" fontSize="7" fill="hsl(var(--destructive))" fontFamily="monospace">
                  I_leak={Ioff.toFixed(1)}nA
                </text>
                <defs>
                  <marker id="arrowRed" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--destructive))" />
                  </marker>
                </defs>
              </g>
            )}

            {/* Gate leakage */}
            {tox < 3 && Igate > 0.5 && (
              <g className="animate-pulse">
                <line x1="180" y1={85 - tox * 0.8} x2="180" y2="118"
                  stroke="hsl(var(--chart-3))" strokeWidth="1" strokeDasharray="2 2" />
                <text x="200" y={105 - tox * 0.4} fontSize="6" fill="hsl(var(--chart-3))" fontFamily="monospace">
                  I_gate={Igate.toFixed(1)}nA
                </text>
              </g>
            )}

            {/* Electron flow */}
            {channelStrength > 0 && Vds > 0 && Array.from({ length: 5 }).map((_, i) => (
              <circle key={i} cx={120 + i * 30} cy={118} r={1.5 + channelStrength}
                fill="hsl(var(--primary))" opacity={0.4 + channelStrength * 0.5}>
                <animate attributeName="cx" from={110} to={260} dur={`${1.5 - channelStrength * 0.5}s`}
                  begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            ))}

            {/* Channel length */}
            <line x1="100" y1="155" x2="260" y2="155" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <line x1="100" y1="150" x2="100" y2="160" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <line x1="260" y1="150" x2="260" y2="160" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <text x="180" y="167" textAnchor="middle" fontSize="8" fill="hsl(var(--chart-2))" fontFamily="monospace">L={Lch}nm</text>

            <text x="30" y="70" fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace">V_GS={Vgs.toFixed(1)}V</text>

            {/* Region */}
            <rect x="255" y="55" width="95" height="24" rx="4"
              fill={region === "Saturation" ? "hsl(var(--chart-3) / 0.15)" : region === "Triode" ? "hsl(var(--chart-2) / 0.15)" : "hsl(var(--destructive) / 0.1)"}
              stroke={region === "Saturation" ? "hsl(var(--chart-3) / 0.4)" : region === "Triode" ? "hsl(var(--chart-2) / 0.4)" : "hsl(var(--destructive) / 0.3)"} />
            <text x="302" y="71" textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="bold"
              fill={region === "Saturation" ? "hsl(var(--chart-3))" : region === "Triode" ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"}>
              {region}
            </text>
          </svg>
        </div>
      </div>

      {/* Vth vs L curve — THE key insight */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={14} className="text-destructive" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">V_th Roll-Off vs Channel Length</span>
          <span className="text-[9px] font-mono text-muted-foreground ml-auto">← Reduce L to see threshold shift</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${vthGraph.w} ${vthGraph.h}`}>
          {/* Grid */}
          {[0, 100, 200, 300, 400, 500].map(L => {
            const x = 40 + (L / vthGraph.maxL) * (vthGraph.w - 50);
            return (
              <g key={L}>
                <line x1={x} y1={15} x2={x} y2={vthGraph.h - 20} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x={x} y={vthGraph.h - 8} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{L}</text>
              </g>
            );
          })}
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const v = vthGraph.minVth + f * (vthGraph.maxVth - vthGraph.minVth);
            const { sy } = vthGraph.toS(0, v);
            return (
              <g key={f}>
                <line x1={40} y1={sy} x2={vthGraph.w - 10} y2={sy} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x={36} y={sy + 3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{v.toFixed(2)}</text>
              </g>
            );
          })}

          {/* Curve */}
          <path d={vthGraph.path} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" />

          {/* Current L marker */}
          <circle cx={vthGraph.cur.sx} cy={vthGraph.cur.sy} r="5" fill="hsl(var(--destructive))" className="animate-pulse" />
          <line x1={vthGraph.cur.sx} y1={15} x2={vthGraph.cur.sx} y2={vthGraph.h - 20}
            stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
          <text x={vthGraph.cur.sx + 8} y={vthGraph.cur.sy - 6} fontSize="8" fill="hsl(var(--destructive))" fontFamily="monospace" fontWeight="bold">
            L={Lch}nm
          </text>

          {/* Annotations */}
          {showAnnotations && (
            <g>
              <text x={vthGraph.w - 10} y={25} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                Long-channel V_th ≈ {Vth0.toFixed(2)}V
              </text>
              {Lch < 100 && (
                <text x={vthGraph.cur.sx + 8} y={vthGraph.cur.sy + 12} fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace">
                  ΔV_th = {((Vth0 - VthActual) * 1000).toFixed(0)}mV
                </text>
              )}
            </g>
          )}

          <text x={vthGraph.w / 2} y={vthGraph.h} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
            Channel Length (nm)
          </text>
          <text x="8" y={vthGraph.h / 2} textAnchor="middle" fontSize="8" fill="hsl(var(--chart-2))" fontFamily="monospace"
            transform={`rotate(-90, 8, ${vthGraph.h / 2})`}>V_th (V)</text>
        </svg>
      </div>

      {/* Short-channel effects detail */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-wider">Second-Order Effects Analysis</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className={cn("p-3 rounded-lg border space-y-1",
            DIBL * Vds * 1000 > 50 ? "border-destructive/30 bg-destructive/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
              DIBL {DIBL * Vds * 1000 > 50 && <AlertTriangle size={11} className="text-destructive" />}
            </div>
            <div className="text-muted-foreground">ΔV_th = {(DIBL * Vds * 1000).toFixed(1)} mV</div>
            <div className="text-muted-foreground">η = {(DIBL * 1000).toFixed(1)} mV/V</div>
            <div className={cn("font-mono text-[10px]",
              DIBL * Vds * 1000 > 100 ? "text-destructive" : DIBL * Vds * 1000 > 30 ? "text-chart-3" : "text-primary"
            )}>
              {DIBL * Vds * 1000 > 100 ? "⚠ Severe — barrier lowered significantly" :
               DIBL * Vds * 1000 > 30 ? "Moderate — noticeable V_th shift" : "✓ Minimal effect"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              Drain field penetrates into channel, lowering source-channel barrier
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border space-y-1",
            lambda > 0.1 ? "border-destructive/30 bg-destructive/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
              Channel Length Modulation {lambda > 0.1 && <AlertTriangle size={11} className="text-destructive" />}
            </div>
            <div className="text-muted-foreground">λ = {lambda.toFixed(4)} V⁻¹</div>
            <div className="text-muted-foreground">r_o = {(1 / (lambda * Math.max(currentId, 0.001))).toFixed(0)} Ω</div>
            <div className={cn("font-mono text-[10px]",
              lambda > 0.15 ? "text-destructive" : lambda > 0.05 ? "text-chart-3" : "text-primary"
            )}>
              {lambda > 0.15 ? "⚠ Output resistance very low" :
               lambda > 0.05 ? "Finite output conductance" : "✓ Near-ideal current source"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              Effective channel shortens with increasing V_DS
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border space-y-1",
            SS > 80 ? "border-chart-3/30 bg-chart-3/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground">Subthreshold Swing</div>
            <div className="text-muted-foreground">SS = {SS.toFixed(1)} mV/decade</div>
            <div className="text-muted-foreground">n = {n.toFixed(2)} (ideality)</div>
            <div className={cn("font-mono text-[10px]",
              SS > 90 ? "text-destructive" : SS > 70 ? "text-chart-3" : "text-primary"
            )}>
              {SS > 90 ? "⚠ Poor switching — high leakage" :
               SS > 70 ? "Degraded (ideal = 60mV/dec)" : "✓ Near-ideal switching"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              How sharply transistor turns off. SS = (kT/q)·ln(10)·n
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border space-y-1",
            Ioff > 10 ? "border-destructive/30 bg-destructive/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground flex items-center gap-1.5">
              Leakage Current {Ioff > 50 && <Zap size={11} className="text-destructive" />}
            </div>
            <div className="text-muted-foreground">I_off = {Ioff.toFixed(2)} nA</div>
            <div className="text-muted-foreground">I_on/I_off = {(currentId * 1e6 / Math.max(Ioff, 0.01)).toExponential(1)}</div>
            <div className={cn("font-mono text-[10px]",
              Ioff > 50 ? "text-destructive" : Ioff > 5 ? "text-chart-3" : "text-primary"
            )}>
              {Ioff > 50 ? "⚠ Static power dominates" :
               Ioff > 5 ? "Leakage-aware design needed" : "✓ Low standby power"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              Current flowing when V_GS = 0. Key metric for mobile/IoT
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border space-y-1",
            Igate > 1 ? "border-chart-3/30 bg-chart-3/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground">Gate Tunneling</div>
            <div className="text-muted-foreground">I_gate = {Igate.toFixed(2)} nA</div>
            <div className="text-muted-foreground">t_ox = {tox} nm ({tox < 2 ? "direct tunnel" : tox < 5 ? "FN tunnel" : "negligible"})</div>
            <div className={cn("font-mono text-[10px]",
              Igate > 10 ? "text-destructive" : Igate > 0.5 ? "text-chart-3" : "text-primary"
            )}>
              {Igate > 10 ? "⚠ High-κ dielectric essential" :
               Igate > 0.5 ? "Consider HfO₂ replacement" : "✓ SiO₂ sufficient"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              Quantum tunneling through thin gate oxide. Scales exponentially with t_ox
            </div>
          </div>

          <div className={cn("p-3 rounded-lg border space-y-1",
            Lch < 22 ? "border-chart-4/30 bg-chart-4/5" : "border-border"
          )}>
            <div className="font-mono font-bold text-foreground">Velocity Saturation</div>
            <div className="text-muted-foreground">Factor = {velSatFactor.toFixed(3)}</div>
            <div className="text-muted-foreground">E_crit ~ {((2 * 1e5) / (400e-4)).toExponential(1)} V/m</div>
            <div className={cn("font-mono text-[10px]",
              velSatFactor < 0.5 ? "text-destructive" : velSatFactor < 0.8 ? "text-chart-3" : "text-primary"
            )}>
              {velSatFactor < 0.5 ? "⚠ Carriers saturated — I_D limited" :
               velSatFactor < 0.8 ? "Partial velocity saturation" : "✓ Mobility-limited regime"}
            </div>
            <div className="text-[9px] text-muted-foreground/60 mt-1">
              At high E-fields, carrier drift velocity saturates at v_sat
            </div>
          </div>
        </div>
      </div>

      {/* Educational insight */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-xs text-muted-foreground space-y-1.5">
        <div className="text-primary font-bold text-sm mb-2">💡 What to try:</div>
        <div>1. <span className="text-chart-3">Reduce L from 500→14nm</span> — watch V_th drop, I_off rise, and the SCE bar fill up</div>
        <div>2. <span className="text-chart-2">Switch to Log scale</span> — see the subthreshold slope (weak students: notice the "knee"; strong students: measure SS)</div>
        <div>3. <span className="text-destructive">Set t_ox &lt; 2nm</span> — gate tunneling leakage arrows appear on cross-section</div>
        <div>4. <span className="text-chart-4">Use Compare mode</span> — overlay L=14nm vs L=250nm to see how curves shift</div>
        <div>5. <span className="text-primary">Watch I_on/I_off ratio</span> — the fundamental metric for digital switching</div>
      </div>
    </div>
  );
};

export default MOSFETVisualizer;

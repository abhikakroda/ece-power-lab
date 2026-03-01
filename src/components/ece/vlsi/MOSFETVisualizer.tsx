import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const MOSFETVisualizer = () => {
  const [tox, setTox] = useState(5);         // Oxide thickness nm
  const [Lch, setLch] = useState(100);        // Channel length nm
  const [Na, setNa] = useState(1e17);         // Doping /cm³
  const [Vgs, setVgs] = useState(0.8);        // Gate-Source V
  const [Vds, setVds] = useState(1.0);        // Drain-Source V
  const [sweepMode, setSweepMode] = useState<"vgs" | "vds">("vgs");

  // Physical constants
  const epsOx = 3.9 * 8.854e-12;   // F/m
  const epsSi = 11.7 * 8.854e-12;
  const q = 1.6e-19;
  const k = 1.38e-23;
  const T = 300;
  const ni = 1.5e10 * 1e6; // /m³
  const phiF = (k * T / q) * Math.log(Na * 1e6 / ni);
  const Cox = epsOx / (tox * 1e-9);  // F/m²
  const Vth0 = 0.4 + 2 * phiF + Math.sqrt(2 * epsSi * q * Na * 1e6 * 2 * phiF) / Cox;
  
  // Short channel effect — Vth roll-off
  const DIBL = 0.08 * (50 / Lch); // simplified DIBL
  const Vth = Math.max(0.1, Vth0 - DIBL * Vds);
  
  const mu = 400e-4; // m²/Vs (simplified)
  const W = 1e-6;    // 1um width
  const Kp = mu * Cox * (W / (Lch * 1e-9));
  const lambda = 0.05 * (50 / Lch); // CLM

  const calcId = (vgs: number, vds: number): number => {
    if (vgs < Vth) {
      // Subthreshold
      const n = 1 + Math.sqrt(epsSi * q * Na * 1e6 / (2 * 2 * phiF)) / Cox;
      return Kp * Math.pow(k * T / q, 2) * Math.exp((vgs - Vth) / (n * k * T / q)) * 1e3;
    }
    const vov = vgs - Vth;
    if (vds < vov) {
      // Triode
      return Kp * (vov * vds - 0.5 * vds * vds) * (1 + lambda * vds) * 1e3;
    }
    // Saturation
    return 0.5 * Kp * vov * vov * (1 + lambda * vds) * 1e3;
  };

  // Depletion width
  const Wd = Math.sqrt(2 * epsSi * 2 * phiF / (q * Na * 1e6)) * 1e9; // nm

  const currentId = calcId(Vgs, Vds);
  const region = Vgs < Vth ? "Cutoff" : (Vds < (Vgs - Vth)) ? "Triode" : "Saturation";

  // Sweep data
  const sweepData = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    if (sweepMode === "vgs") {
      for (let v = 0; v <= 1.8; v += 0.02) {
        pts.push({ x: v, y: calcId(v, Vds) });
      }
    } else {
      for (let v = 0; v <= 1.8; v += 0.02) {
        pts.push({ x: v, y: calcId(Vgs, v) });
      }
    }
    return pts;
  }, [Vgs, Vds, sweepMode, Vth, Kp, lambda]);

  // Normalize for SVG
  const graphW = 400;
  const graphH = 200;
  const maxY = Math.max(...sweepData.map((p) => p.y), 0.01);
  const maxX = 1.8;

  const toSvg = (x: number, y: number) => ({
    sx: 50 + (x / maxX) * (graphW - 60),
    sy: graphH - 20 - (y / maxY) * (graphH - 40),
  });

  const pathD = sweepData.map((p, i) => {
    const { sx, sy } = toSvg(p.x, p.y);
    return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
  }).join(" ");

  // Multi-curve for VDS family
  const familyCurves = useMemo(() => {
    if (sweepMode !== "vds") return [];
    const curves: { vgs: number; path: string; color: string }[] = [];
    const vgsVals = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4];
    const colors = [
      "hsl(var(--muted-foreground))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--primary))",
      "hsl(var(--chart-4))",
      "hsl(var(--destructive))",
    ];
    const allPts: number[] = [];
    vgsVals.forEach((vg) => {
      for (let v = 0; v <= 1.8; v += 0.02) allPts.push(calcId(vg, v));
    });
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
  }, [sweepMode, Vth, Kp, lambda, Vds]);

  // Channel formation visual
  const channelStrength = Vgs < Vth ? 0 : Math.min(1, (Vgs - Vth) / 0.8);
  const depletionWidth = Math.min(30, Wd / 5);

  return (
    <div className="space-y-6">
      {/* Parameter sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Oxide Thickness (t_ox)</label>
          <input type="range" min={1} max={20} step={0.5} value={tox}
            onChange={(e) => setTox(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="text-sm font-mono text-chart-2">{tox} nm</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Channel Length (L)</label>
          <input type="range" min={14} max={500} step={1} value={Lch}
            onChange={(e) => setLch(parseInt(e.target.value))} className="w-full accent-[hsl(var(--chart-3))]" />
          <div className="text-sm font-mono text-chart-3">{Lch} nm</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">Doping (N_A)</label>
          <input type="range" min={15} max={19} step={0.1} value={Math.log10(Na)}
            onChange={(e) => setNa(Math.pow(10, parseFloat(e.target.value)))} className="w-full accent-[hsl(var(--chart-4))]" />
          <div className="text-sm font-mono text-chart-4">10^{Math.log10(Na).toFixed(1)} /cm³</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">V_GS</label>
          <input type="range" min={0} max={1.8} step={0.01} value={Vgs}
            onChange={(e) => setVgs(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
          <div className="text-sm font-mono text-primary">{Vgs.toFixed(2)} V</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border space-y-2">
          <label className="text-xs text-muted-foreground font-mono">V_DS</label>
          <input type="range" min={0} max={1.8} step={0.01} value={Vds}
            onChange={(e) => setVds(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--chart-2))]" />
          <div className="text-sm font-mono text-chart-2">{Vds.toFixed(2)} V</div>
        </div>
      </div>

      {/* Device parameters readout */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "V_th", value: `${Vth.toFixed(3)} V`, color: "text-chart-2" },
          { label: "I_D", value: `${currentId.toFixed(3)} mA`, color: "text-primary" },
          { label: "Region", value: region, color: region === "Saturation" ? "text-chart-3" : region === "Triode" ? "text-chart-2" : "text-muted-foreground" },
          { label: "W_dep", value: `${Wd.toFixed(1)} nm`, color: "text-chart-4" },
          { label: "C_ox", value: `${(Cox * 1e3).toFixed(2)} mF/m²`, color: "text-chart-2" },
        ].map((p) => (
          <div key={p.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className="text-[10px] text-muted-foreground font-mono">{p.label}</div>
            <div className={cn("text-sm font-mono font-bold", p.color)}>{p.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* I-V Characteristics */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-xs font-mono text-muted-foreground">I-V CHARACTERISTICS</div>
            <div className="flex-1" />
            {(["vgs", "vds"] as const).map((m) => (
              <button key={m} onClick={() => setSweepMode(m)}
                className={cn("px-3 py-1 rounded text-xs font-mono border transition-all",
                  sweepMode === m ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
                )}>
                I_D vs V_{m.toUpperCase().slice(1)}
              </button>
            ))}
          </div>
          <svg width="100%" viewBox={`0 0 ${graphW} ${graphH}`}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line x1="50" y1={graphH - 20 - f * (graphH - 40)} x2={graphW - 10} y2={graphH - 20 - f * (graphH - 40)}
                  stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x="45" y={graphH - 16 - f * (graphH - 40)} textAnchor="end" fontSize="8"
                  fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
                  {(f * maxY).toFixed(2)}
                </text>
              </g>
            ))}
            {[0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8].map((v) => (
              <g key={v}>
                <line x1={50 + (v / 1.8) * (graphW - 60)} y1="20" x2={50 + (v / 1.8) * (graphW - 60)} y2={graphH - 20}
                  stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x={50 + (v / 1.8) * (graphW - 60)} y={graphH - 6} textAnchor="middle" fontSize="8"
                  fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">{v.toFixed(1)}</text>
              </g>
            ))}

            {/* Vth marker for VGS sweep */}
            {sweepMode === "vgs" && (
              <line x1={50 + (Vth / 1.8) * (graphW - 60)} y1="20" x2={50 + (Vth / 1.8) * (graphW - 60)} y2={graphH - 20}
                stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
            )}

            {/* Curves */}
            {sweepMode === "vds" && familyCurves.length > 0 ? (
              familyCurves.map((c) => (
                <g key={c.vgs}>
                  <path d={c.path} fill="none" stroke={c.color} strokeWidth={c.vgs === Vgs ? 2.5 : 1.2} opacity={c.vgs === Vgs ? 1 : 0.6} />
                  <text x={graphW - 8} y={graphH - 20 - (calcId(c.vgs, 1.8) / Math.max(...familyCurves.map((fc) => calcId(fc.vgs, 1.8)), 0.01)) * (graphH - 40)}
                    fontSize="7" fill={c.color} fontFamily="JetBrains Mono">{c.vgs}V</text>
                </g>
              ))
            ) : (
              <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
            )}

            {/* Current operating point */}
            {(() => {
              const xv = sweepMode === "vgs" ? Vgs : Vds;
              const { sx, sy } = toSvg(xv, currentId);
              return <circle cx={sx} cy={sy} r="4" fill="hsl(var(--primary))" className="animate-pulse" />;
            })()}

            {/* Axis labels */}
            <text x={graphW / 2} y={graphH} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">
              V_{sweepMode === "vgs" ? "GS" : "DS"} (V)
            </text>
            <text x="12" y={graphH / 2} textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="JetBrains Mono"
              transform={`rotate(-90, 12, ${graphH / 2})`}>I_D (mA)</text>
          </svg>
        </div>

        {/* MOSFET Cross-Section Animation */}
        <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">MOSFET CROSS-SECTION</div>
          <svg width="100%" viewBox="0 0 360 240">
            {/* P-type substrate */}
            <rect x="40" y="120" width="280" height="100" fill="hsl(var(--muted) / 0.6)" stroke="hsl(var(--border))" />
            <text x="180" y="200" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="JetBrains Mono">P-substrate</text>

            {/* Depletion region */}
            <rect x="100" y={120 - depletionWidth * 0.3} width="160" height={depletionWidth + 10}
              fill="hsl(var(--chart-4) / 0.15)" stroke="hsl(var(--chart-4) / 0.3)" strokeWidth="1" strokeDasharray="3 3"
              className="transition-all duration-300" />

            {/* Gate oxide */}
            <rect x="100" y={100 - tox * 0.8} width="160" height={Math.max(4, tox * 0.8)}
              fill="hsl(var(--chart-3) / 0.3)" stroke="hsl(var(--chart-3) / 0.5)" strokeWidth="1"
              className="transition-all duration-300" />
            <text x="180" y={95 - tox * 0.8} textAnchor="middle" fontSize="7" fill="hsl(var(--chart-3))" fontFamily="JetBrains Mono">
              SiO₂ ({tox}nm)
            </text>

            {/* Gate metal */}
            <rect x="110" y={80 - tox * 0.8} width="140" height="20" rx="3"
              fill="hsl(var(--chart-2) / 0.3)" stroke="hsl(var(--chart-2) / 0.6)" strokeWidth="1.5" />
            <text x="180" y={94 - tox * 0.8} textAnchor="middle" fontSize="10" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono" fontWeight="bold">GATE</text>

            {/* Source N+ */}
            <rect x="40" y="100" width="60" height="40" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
            <text x="70" y="124" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="JetBrains Mono" fontWeight="bold">N+ Source</text>

            {/* Drain N+ */}
            <rect x="260" y="100" width="60" height="40" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
            <text x="290" y="124" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="JetBrains Mono" fontWeight="bold">N+ Drain</text>

            {/* Channel (inversion layer) */}
            {channelStrength > 0 && (
              <rect x="100" y="115" width="160" height={4 + channelStrength * 4}
                fill={`hsl(var(--primary) / ${channelStrength * 0.4})`}
                className="transition-all duration-500" rx="1" />
            )}

            {/* Channel length indicator */}
            <line x1="100" y1="150" x2="260" y2="150" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <line x1="100" y1="145" x2="100" y2="155" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <line x1="260" y1="145" x2="260" y2="155" stroke="hsl(var(--chart-2))" strokeWidth="1" />
            <text x="180" y="162" textAnchor="middle" fontSize="8" fill="hsl(var(--chart-2))" fontFamily="JetBrains Mono">L = {Lch}nm</text>

            {/* Electron flow dots when channel exists */}
            {channelStrength > 0 && Vds > 0 && Array.from({ length: 5 }).map((_, i) => (
              <circle key={i} cx={120 + i * 30} cy={118} r={1.5 + channelStrength}
                fill="hsl(var(--primary))" opacity={0.4 + channelStrength * 0.5}>
                <animate attributeName="cx" from={110} to={260} dur={`${1.5 - channelStrength * 0.5}s`}
                  begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            ))}

            {/* VGS label */}
            <text x="30" y="70" fontSize="9" fill="hsl(var(--primary))" fontFamily="JetBrains Mono">
              V_GS={Vgs.toFixed(1)}V
            </text>

            {/* Region indicator */}
            <rect x="250" y="55" width="100" height="24" rx="4"
              fill={region === "Saturation" ? "hsl(var(--chart-3) / 0.15)" : region === "Triode" ? "hsl(var(--chart-2) / 0.15)" : "hsl(var(--muted))"}
              stroke={region === "Saturation" ? "hsl(var(--chart-3) / 0.4)" : region === "Triode" ? "hsl(var(--chart-2) / 0.4)" : "hsl(var(--border))"} />
            <text x="300" y="71" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold"
              fill={region === "Saturation" ? "hsl(var(--chart-3))" : region === "Triode" ? "hsl(var(--chart-2))" : "hsl(var(--muted-foreground))"}>
              {region}
            </text>
          </svg>
        </div>
      </div>

      {/* Short-channel effects */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">SHORT-CHANNEL EFFECTS</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className={cn("p-3 rounded-lg border", Lch < 45 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <div className="font-mono font-bold mb-1">DIBL</div>
            <div className="text-muted-foreground">ΔV_th = {(DIBL * Vds * 1000).toFixed(1)} mV</div>
            <div className={cn("mt-1 font-mono", Lch < 45 ? "text-destructive" : "text-chart-2")}>
              {Lch < 45 ? "⚠ Severe" : Lch < 100 ? "Moderate" : "Minimal"}
            </div>
          </div>
          <div className={cn("p-3 rounded-lg border", Lch < 30 ? "border-destructive/30 bg-destructive/5" : "border-border")}>
            <div className="font-mono font-bold mb-1">CLM (λ)</div>
            <div className="text-muted-foreground">λ = {lambda.toFixed(3)} V⁻¹</div>
            <div className={cn("mt-1 font-mono", lambda > 0.1 ? "text-destructive" : "text-chart-2")}>
              {lambda > 0.1 ? "⚠ High output conductance" : "Acceptable"}
            </div>
          </div>
          <div className={cn("p-3 rounded-lg border", tox < 2 ? "border-chart-3/30 bg-chart-3/5" : "border-border")}>
            <div className="font-mono font-bold mb-1">Gate Leakage</div>
            <div className="text-muted-foreground">t_ox = {tox} nm</div>
            <div className={cn("mt-1 font-mono", tox < 2 ? "text-chart-3" : "text-chart-2")}>
              {tox < 2 ? "⚠ Tunnel current significant" : tox < 5 ? "High-κ recommended" : "SiO₂ viable"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MOSFETVisualizer;

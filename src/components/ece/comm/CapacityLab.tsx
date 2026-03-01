import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const CapacityLab = () => {
  const [bandwidth, setBandwidth] = useState(20); // MHz
  const [snrDb, setSnrDb] = useState(20);
  const [power, setPower] = useState(10); // dBm
  const [scenario, setScenario] = useState<"custom" | "satellite" | "mobile" | "fiber" | "wifi">("custom");

  // Presets
  const presets: Record<string, { bw: number; snr: number; pwr: number; desc: string }> = {
    satellite: { bw: 36, snr: 5, pwr: -3, desc: "GEO satellite link — low SNR, moderate BW" },
    mobile: { bw: 20, snr: 15, pwr: 23, desc: "5G NR cell — fading, moderate SNR" },
    fiber: { bw: 4000, snr: 35, pwr: 0, desc: "Fiber optic — huge BW, high SNR" },
    wifi: { bw: 40, snr: 25, pwr: 20, desc: "WiFi 6 — indoor, good SNR" },
  };

  const applyPreset = (key: string) => {
    setScenario(key as any);
    if (key !== "custom") {
      const p = presets[key];
      setBandwidth(p.bw); setSnrDb(p.snr); setPower(p.pwr);
    }
  };

  const snrLin = Math.pow(10, snrDb / 10);
  const shannonCapacity = bandwidth * Math.log2(1 + snrLin); // Mbps
  const spectralEff = Math.log2(1 + snrLin); // b/s/Hz

  // Modulation spectral efficiencies
  const modSchemes = [
    { name: "BPSK", eff: 1, reqSnr: 0 },
    { name: "QPSK", eff: 2, reqSnr: 3 },
    { name: "8PSK", eff: 3, reqSnr: 7 },
    { name: "16-QAM", eff: 4, reqSnr: 10.5 },
    { name: "64-QAM", eff: 6, reqSnr: 16.5 },
    { name: "256-QAM", eff: 8, reqSnr: 22.5 },
    { name: "1024-QAM", eff: 10, reqSnr: 28 },
  ];

  const achievable = modSchemes.filter(m => snrDb >= m.reqSnr);
  const bestMod = achievable.length > 0 ? achievable[achievable.length - 1] : null;

  // Capacity curve
  const capacityCurve = useMemo(() => {
    const pts: { snr: number; capacity: number; bpsk: number; qpsk: number; qam16: number; qam64: number }[] = [];
    for (let s = -5; s <= 40; s += 0.5) {
      const lin = Math.pow(10, s / 10);
      pts.push({
        snr: s,
        capacity: Math.log2(1 + lin),
        bpsk: s >= 0 ? 1 : 0,
        qpsk: s >= 3 ? 2 : 0,
        qam16: s >= 10.5 ? 4 : 0,
        qam64: s >= 16.5 ? 6 : 0,
      });
    }
    return pts;
  }, []);

  // SVG
  const gW = 440, gH = 220;
  const maxSnr = 40, minSnr = -5;
  const maxEff = 12;

  const toX = (s: number) => 40 + ((s - minSnr) / (maxSnr - minSnr)) * (gW - 50);
  const toY = (e: number) => gH - 20 - (e / maxEff) * (gH - 40);

  const shannonPath = capacityCurve.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${toX(p.snr)} ${toY(p.capacity)}`
  ).join(" ");

  // Power-bandwidth tradeoff
  const pbTradeoff = useMemo(() => {
    const pts: { bw: number; capacity: number }[] = [];
    const totalPowerLin = Math.pow(10, power / 10);
    const noiseDensity = 1e-3; // N0 normalized
    for (let b = 1; b <= 200; b += 2) {
      const noiseTotal = noiseDensity * b;
      const localSnr = totalPowerLin / noiseTotal;
      pts.push({ bw: b, capacity: b * Math.log2(1 + localSnr) });
    }
    return pts;
  }, [power]);

  const pbMax = Math.max(...pbTradeoff.map(p => p.capacity), 1);
  const pbW = 440, pbH = 180;

  return (
    <div className="space-y-5">
      {/* Scenario presets */}
      <div className="flex gap-1.5 flex-wrap">
        {["custom", "satellite", "mobile", "fiber", "wifi"].map(s => (
          <button key={s} onClick={() => applyPreset(s)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              scenario === s ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {s === "custom" ? "⚙ Custom" : s === "satellite" ? "🛰 Satellite" : s === "mobile" ? "📱 Mobile" : s === "fiber" ? "🔌 Fiber" : "📶 WiFi"}
          </button>
        ))}
      </div>

      {scenario !== "custom" && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-primary">
          {presets[scenario]?.desc}
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CSlider label="Bandwidth" value={bandwidth} min={1} max={5000} step={1} unit="MHz" color="primary" onChange={(v) => { setBandwidth(v); setScenario("custom"); }} />
        <CSlider label="SNR" value={snrDb} min={-5} max={40} step={0.5} unit="dB" color="chart-2" onChange={(v) => { setSnrDb(v); setScenario("custom"); }} />
        <CSlider label="TX Power" value={power} min={-10} max={40} step={1} unit="dBm" color="chart-3" onChange={(v) => { setPower(v); setScenario("custom"); }} />
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-center">
          <div className="text-lg font-mono font-bold text-primary">{shannonCapacity.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground font-mono">Shannon Capacity (Mbps)</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-lg font-mono font-bold text-chart-2">{spectralEff.toFixed(2)}</div>
          <div className="text-[9px] text-muted-foreground font-mono">Spectral Efficiency (b/s/Hz)</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-lg font-mono font-bold text-chart-3">{bestMod?.name ?? "—"}</div>
          <div className="text-[9px] text-muted-foreground font-mono">Best Modulation</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-lg font-mono font-bold text-chart-4">
            {bestMod ? `${(bestMod.eff * bandwidth).toFixed(0)}` : "—"}
          </div>
          <div className="text-[9px] text-muted-foreground font-mono">Achievable Rate (Mbps)</div>
        </div>
      </div>

      {/* Shannon limit curve */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">SHANNON LIMIT — SPECTRAL EFFICIENCY vs SNR</div>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
          {/* Grid */}
          {[-5, 0, 5, 10, 15, 20, 25, 30, 35, 40].map(s => (
            <g key={s}>
              <line x1={toX(s)} y1="15" x2={toX(s)} y2={gH - 20} stroke="hsl(var(--border))" strokeWidth="0.3" />
              <text x={toX(s)} y={gH - 6} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{s}</text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10, 12].map(e => (
            <g key={e}>
              <line x1="40" y1={toY(e)} x2={gW - 10} y2={toY(e)} stroke="hsl(var(--border))" strokeWidth="0.3" />
              <text x="36" y={toY(e) + 3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{e}</text>
            </g>
          ))}

          {/* Shannon limit */}
          <path d={shannonPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
          <text x={toX(35)} y={toY(10) - 8} fontSize="8" fill="hsl(var(--primary))" fontFamily="monospace" fontWeight="bold">Shannon Limit</text>

          {/* Modulation staircase */}
          {modSchemes.map((m, i) => {
            const nextReq = modSchemes[i + 1]?.reqSnr ?? 40;
            return (
              <g key={m.name}>
                <line x1={toX(m.reqSnr)} y1={toY(m.eff)} x2={toX(nextReq)} y2={toY(m.eff)}
                  stroke="hsl(var(--chart-3))" strokeWidth="1.5" opacity="0.6" />
                <text x={toX(m.reqSnr) + 3} y={toY(m.eff) - 4} fontSize="6" fill="hsl(var(--chart-3))" fontFamily="monospace">{m.name}</text>
              </g>
            );
          })}

          {/* Operating point */}
          <circle cx={toX(snrDb)} cy={toY(spectralEff)} r="5" fill="hsl(var(--destructive))" className="animate-pulse" />
          <text x={toX(snrDb) + 8} y={toY(spectralEff) - 5} fontSize="8" fill="hsl(var(--destructive))" fontFamily="monospace" fontWeight="bold">
            You: {spectralEff.toFixed(1)} b/s/Hz
          </text>

          {/* Shaded "impossible" region */}
          <path d={`${shannonPath} L ${toX(40)} ${toY(maxEff)} L ${toX(minSnr)} ${toY(maxEff)} Z`}
            fill="hsl(var(--destructive))" opacity="0.04" />
          <text x={toX(20)} y={toY(9)} fontSize="8" fill="hsl(var(--destructive))" fontFamily="monospace" opacity="0.5">IMPOSSIBLE</text>

          <text x={gW / 2} y={gH} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">SNR (dB)</text>
        </svg>
      </div>

      {/* Power-BW tradeoff */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">BANDWIDTH vs CAPACITY TRADEOFF (fixed power = {power} dBm)</div>
        <svg width="100%" viewBox={`0 0 ${pbW} ${pbH}`}>
          {[0, 50, 100, 150, 200].map(b => {
            const x = 40 + (b / 200) * (pbW - 50);
            return (
              <g key={b}>
                <line x1={x} y1="10" x2={x} y2={pbH - 15} stroke="hsl(var(--border))" strokeWidth="0.3" />
                <text x={x} y={pbH - 3} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{b}MHz</text>
              </g>
            );
          })}
          <path d={pbTradeoff.map((p, i) => {
            const x = 40 + (p.bw / 200) * (pbW - 50);
            const y = pbH - 15 - (p.capacity / pbMax) * (pbH - 30);
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
          }).join(" ")} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" />

          {/* Current BW marker */}
          {bandwidth <= 200 && (
            <line x1={40 + (bandwidth / 200) * (pbW - 50)} y1="10" x2={40 + (bandwidth / 200) * (pbW - 50)} y2={pbH - 15}
              stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="3 3" />
          )}
        </svg>
        <div className="text-[9px] font-mono text-muted-foreground mt-1">
          More bandwidth → diminishing returns (SNR drops as noise increases)
        </div>
      </div>

      {/* Modulation comparison table */}
      <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
        <div className="text-xs font-mono text-muted-foreground mb-2">MODULATION COMPARISON AT SNR = {snrDb} dB</div>
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 text-muted-foreground">Scheme</th>
              <th className="text-center py-1 text-muted-foreground">η (b/s/Hz)</th>
              <th className="text-center py-1 text-muted-foreground">Min SNR</th>
              <th className="text-center py-1 text-muted-foreground">Rate (Mbps)</th>
              <th className="text-center py-1 text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {modSchemes.map(m => {
              const ok = snrDb >= m.reqSnr;
              return (
                <tr key={m.name} className={cn("border-b border-border/50", ok ? "" : "opacity-40")}>
                  <td className="py-1 text-foreground">{m.name}</td>
                  <td className="text-center text-chart-2">{m.eff}</td>
                  <td className="text-center text-chart-4">{m.reqSnr} dB</td>
                  <td className="text-center text-primary">{(m.eff * bandwidth).toFixed(0)}</td>
                  <td className={cn("text-center font-bold", ok ? "text-primary" : "text-destructive")}>{ok ? "✓" : "✗"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">📊 Key Insights</div>
        <div>• <span className="text-primary">Shannon:</span> C = B·log₂(1 + SNR) — absolute maximum, no practical code achieves it</div>
        <div>• <span className="text-chart-2">Power-limited:</span> increase power → higher SNR → more bits/Hz</div>
        <div>• <span className="text-chart-3">BW-limited:</span> increase BW → more capacity, but noise floor rises too</div>
        <div>• <span className="text-chart-4">Spectral efficiency</span> above Shannon limit is impossible (shaded region)</div>
        <div>• <span className="text-destructive">Real systems</span> operate 1-3 dB from Shannon (Turbo/LDPC codes)</div>
      </div>
    </div>
  );
};

const CSlider = ({ label, value, min, max, step, unit, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; color: string; onChange: (v: number) => void;
}) => (
  <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
    <div className="flex justify-between">
      <Label className="text-[9px] text-muted-foreground font-mono uppercase">{label}</Label>
      <span className={cn("text-xs font-mono", `text-${color}`)}>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className={`w-full accent-[hsl(var(--${color}))]`} />
  </div>
);

export default CapacityLab;

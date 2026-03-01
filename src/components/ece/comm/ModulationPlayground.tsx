import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type ModType = "AM" | "DSB-SC" | "SSB" | "FM" | "PM" | "ASK" | "FSK" | "BPSK" | "QPSK" | "16-QAM";

const modGroups: { category: string; mods: { id: ModType; label: string }[] }[] = [
  { category: "Analog", mods: [
    { id: "AM", label: "AM" }, { id: "DSB-SC", label: "DSB-SC" }, { id: "SSB", label: "SSB" },
    { id: "FM", label: "FM" }, { id: "PM", label: "PM" },
  ]},
  { category: "Digital", mods: [
    { id: "ASK", label: "ASK" }, { id: "FSK", label: "FSK" }, { id: "BPSK", label: "BPSK" },
    { id: "QPSK", label: "QPSK" }, { id: "16-QAM", label: "16-QAM" },
  ]},
];

const isDigital = (m: ModType) => ["ASK", "FSK", "BPSK", "QPSK", "16-QAM"].includes(m);

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return x >= 0 ? 1 - poly * Math.exp(-x * x) : -(1 - poly * Math.exp(-x * x));
}
const Q = (x: number) => 0.5 * (1 - erf(x / Math.sqrt(2)));

const qamConstellation = (M: number) => {
  const k = Math.sqrt(M);
  const pts: [number, number][] = [];
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++)
    pts.push([2 * i - k + 1, 2 * j - k + 1]);
  return pts;
};

const ModulationPlayground = () => {
  const [mod, setMod] = useState<ModType>("AM");
  const [fc, setFc] = useState(100);
  const [fm, setFm] = useState(10);
  const [Am, setAm] = useState(1);
  const [Ac, setAc] = useState(1);
  const [kf, setKf] = useState(10);
  const [phaseOffset, setPhaseOffset] = useState(0);
  const [bitRate, setBitRate] = useState(10);
  const [bitPattern, setBitPattern] = useState("1011001010110100");

  const bits = useMemo(() => bitPattern.split("").map(Number).filter(b => b === 0 || b === 1), [bitPattern]);

  const generateSignal = (t: number) => {
    const wc = 2 * Math.PI * fc;
    const wm = 2 * Math.PI * fm;
    const phi = phaseOffset * Math.PI / 180;

    if (isDigital(mod)) {
      const Tb = 1 / bitRate;
      const bitIdx = Math.min(Math.floor(t / Tb), bits.length - 1);
      const bit = bitIdx >= 0 ? bits[bitIdx] : 0;

      switch (mod) {
        case "ASK":
          return { message: bit * Ac, modulated: bit * Ac * Math.cos(wc * t + phi), carrier: Ac * Math.cos(wc * t) };
        case "FSK": {
          const f = bit ? fc * 1.5 : fc * 0.5;
          return { message: bit * Ac, modulated: Ac * Math.cos(2 * Math.PI * f * t + phi), carrier: Ac * Math.cos(wc * t) };
        }
        case "BPSK":
          return { message: (2 * bit - 1) * Ac, modulated: Ac * Math.cos(wc * t + bit * Math.PI + phi), carrier: Ac * Math.cos(wc * t) };
        case "QPSK": {
          const symIdx = Math.min(Math.floor(t / (2 * Tb)), Math.floor(bits.length / 2) - 1);
          const b0 = bits[symIdx * 2] ?? 0, b1 = bits[symIdx * 2 + 1] ?? 0;
          const phase = ((2 * b0 + b1) * Math.PI / 2) + Math.PI / 4 + phi;
          return { message: (2 * bit - 1) * Ac, modulated: Ac * Math.cos(wc * t + phase), carrier: Ac * Math.cos(wc * t) };
        }
        case "16-QAM": {
          const symIdx = Math.min(Math.floor(t / (4 * Tb)), Math.floor(bits.length / 4) - 1);
          const b = [0, 1, 2, 3].map(i => bits[symIdx * 4 + i] ?? 0);
          const I = (2 * (b[0] * 2 + b[1]) - 3) / 3;
          const QQ = (2 * (b[2] * 2 + b[3]) - 3) / 3;
          return { message: I * Ac, modulated: Ac * (I * Math.cos(wc * t + phi) - QQ * Math.sin(wc * t + phi)), carrier: Ac * Math.cos(wc * t) };
        }
        default: return { message: 0, modulated: 0, carrier: 0 };
      }
    }

    const carrier = Ac * Math.cos(wc * t);
    const message = Am * Math.cos(wm * t);
    switch (mod) {
      case "AM": return { carrier, message, modulated: Ac * (1 + (Am / Ac) * Math.cos(wm * t)) * Math.cos(wc * t + phi) };
      case "DSB-SC": return { carrier, message, modulated: Am * Math.cos(wm * t) * Ac * Math.cos(wc * t + phi) };
      case "SSB": return { carrier, message, modulated: 0.5 * Am * Ac * Math.cos((wc - wm) * t + phi) };
      case "FM": return { carrier, message, modulated: Ac * Math.cos(wc * t + kf * Am * Math.sin(wm * t) / wm + phi) };
      case "PM": return { carrier, message, modulated: Ac * Math.cos(wc * t + kf * Am * Math.cos(wm * t) + phi) };
      default: return { carrier, message, modulated: 0 };
    }
  };

  const { timeData, specMag, bandwidth, powerInfo } = useMemo(() => {
    const N = 512;
    const tMax = isDigital(mod) ? bits.length / bitRate : 3 / fm;
    const dt = tMax / N;
    const sr = N / tMax;

    const time: { t: number; message: number; modulated: number }[] = [];
    const samples: number[] = [];
    let totalPower = 0, carrierPower = 0;

    for (let i = 0; i < N; i++) {
      const t = i * dt;
      const sig = generateSignal(t);
      time.push({ t: +t.toFixed(5), message: +sig.message.toFixed(4), modulated: +sig.modulated.toFixed(4) });
      samples.push(sig.modulated);
      totalPower += sig.modulated ** 2;
      carrierPower += sig.carrier ** 2;
    }
    totalPower /= N; carrierPower /= N;
    const sideband = totalPower - carrierPower;

    // DFT
    const half = Math.floor(N / 2);
    const freqRes = sr / N;
    const spec: { freq: number; mag: number }[] = [];
    for (let k = 0; k < half; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += samples[n] * Math.cos(angle);
        im -= samples[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im) / N;
      const f = k * freqRes;
      if (f <= fc * 3 && f > 0) spec.push({ freq: +f.toFixed(1), mag: +(20 * Math.log10(Math.max(mag, 1e-10))).toFixed(2) });
    }

    // BW
    let bw = "";
    const beta = mod === "FM" ? (kf * Am) / (2 * Math.PI * fm) : kf * Am;
    switch (mod) {
      case "AM": case "DSB-SC": bw = `${(2 * fm).toFixed(0)} Hz (2f_m)`; break;
      case "SSB": bw = `${fm.toFixed(0)} Hz (f_m)`; break;
      case "FM": bw = `${(2 * (beta + 1) * fm).toFixed(0)} Hz (Carson: β=${beta.toFixed(1)})`; break;
      case "PM": bw = `${(2 * (beta + 1) * fm).toFixed(0)} Hz (Carson: β=${beta.toFixed(1)})`; break;
      case "ASK": case "BPSK": bw = `${(2 * bitRate).toFixed(0)} Hz (2R_b)`; break;
      case "FSK": bw = `${(2 * bitRate + fc).toFixed(0)} Hz (2R_b + Δf)`; break;
      case "QPSK": bw = `${bitRate.toFixed(0)} Hz (R_b)`; break;
      case "16-QAM": bw = `${(bitRate / 2).toFixed(0)} Hz (R_b/4)`; break;
    }

    return { timeData: time, specMag: spec, bandwidth: bw, powerInfo: { total: totalPower, carrier: carrierPower, sideband, efficiency: sideband / (totalPower || 1) * 100 } };
  }, [mod, fc, fm, Am, Ac, kf, phaseOffset, bitRate, bits]);

  // SVG-based plots
  const gW = 440, gH = 180;
  const buildTimeSvg = () => {
    if (!timeData.length) return { msgPath: "", modPath: "", xLabels: [] as { x: number; label: string }[] };
    const tMax = timeData[timeData.length - 1].t;
    const allY = timeData.flatMap(d => [d.message, d.modulated]);
    const yMax = Math.max(...allY.map(Math.abs), 0.01) * 1.1;

    const toX = (t: number) => 40 + (t / tMax) * (gW - 50);
    const toY = (v: number) => gH / 2 - (v / yMax) * (gH / 2 - 15);

    const msgPath = timeData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.t)} ${toY(d.message)}`).join(" ");
    const modPath = timeData.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.t)} ${toY(d.modulated)}`).join(" ");

    const xLabels: { x: number; label: string }[] = [];
    for (let f = 0; f <= 1; f += 0.25) xLabels.push({ x: toX(f * tMax), label: (f * tMax * 1000).toFixed(1) });

    return { msgPath, modPath, xLabels };
  };

  const buildSpecSvg = () => {
    if (!specMag.length) return { path: "", xLabels: [] as { x: number; label: string }[] };
    const fMax = specMag[specMag.length - 1].freq;
    const yMin = Math.min(...specMag.map(d => d.mag));
    const yMax = Math.max(...specMag.map(d => d.mag));

    const toX = (f: number) => 40 + (f / fMax) * (gW - 50);
    const toY = (m: number) => gH - 20 - ((m - yMin) / (yMax - yMin || 1)) * (gH - 35);

    const path = specMag.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.freq)} ${toY(d.mag)}`).join(" ");
    const xLabels: { x: number; label: string }[] = [];
    for (let f = 0; f <= 1; f += 0.25) xLabels.push({ x: toX(f * fMax), label: (f * fMax).toFixed(0) });

    return { path, xLabels };
  };

  const timeSvg = buildTimeSvg();
  const specSvg = buildSpecSvg();

  return (
    <div className="space-y-5">
      {/* Mod type selector */}
      {modGroups.map(g => (
        <div key={g.category}>
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">{g.category}</div>
          <div className="flex gap-1.5 flex-wrap">
            {g.mods.map(m => (
              <button key={m.id} onClick={() => setMod(m.id)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
                  mod === m.id
                    ? g.category === "Analog" ? "bg-primary/15 border-primary/40 text-primary" : "bg-chart-3/15 border-chart-3/40 text-chart-3"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}>{m.label}</button>
            ))}
          </div>
        </div>
      ))}

      {/* Signal chain */}
      <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground overflow-x-auto py-2">
        {["Message", "→", "Modulator", "→", "Channel", "→", "Demodulator", "→", "Output"].map((s, i) => (
          <span key={i} className={cn(s === "→" ? "" : "px-2 py-1 rounded bg-muted border border-border",
            s === "Modulator" && "text-primary border-primary/30",
            s === "Channel" && "text-destructive border-destructive/30"
          )}>{s}</span>
        ))}
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Slider label="Carrier Freq" value={fc} min={10} max={500} step={5} unit="Hz" color="primary"
          onChange={setFc} />
        {!isDigital(mod) ? (
          <>
            <Slider label="Message Freq" value={fm} min={1} max={50} step={1} unit="Hz" color="chart-2" onChange={setFm} />
            <Slider label="Msg Amplitude" value={Am} min={0.1} max={3} step={0.1} unit="" color="chart-3" onChange={setAm} />
            <Slider label="Carrier Amp" value={Ac} min={0.1} max={3} step={0.1} unit="" color="chart-4" onChange={setAc} />
          </>
        ) : (
          <>
            <Slider label="Bit Rate" value={bitRate} min={1} max={50} step={1} unit="bps" color="chart-2" onChange={setBitRate} />
            <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
              <Label className="text-[9px] text-muted-foreground font-mono">BIT PATTERN</Label>
              <input value={bitPattern} onChange={e => setBitPattern(e.target.value.replace(/[^01]/g, ""))}
                className="w-full bg-muted text-foreground border border-border rounded px-2 py-1 text-xs font-mono tracking-widest" maxLength={32} />
            </div>
          </>
        )}
        {(mod === "FM" || mod === "PM") && (
          <Slider label={mod === "FM" ? "Freq Deviation" : "Phase Dev"} value={kf} min={1} max={50} step={1} unit="" color="chart-3" onChange={setKf} />
        )}
        <Slider label="Phase Offset" value={phaseOffset} min={0} max={360} step={5} unit="°" color="chart-4" onChange={setPhaseOffset} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Metric label="Modulation" value={mod} color="text-primary" />
        <Metric label="Bandwidth" value={bandwidth} color="text-chart-2" />
        <Metric label="Total Power" value={`${powerInfo.total.toFixed(3)} W`} color="text-chart-3" />
        <Metric label="Sideband Power" value={`${powerInfo.sideband.toFixed(3)} W`} color="text-chart-4" />
        <Metric label="η (efficiency)" value={`${powerInfo.efficiency.toFixed(1)}%`}
          color={powerInfo.efficiency > 50 ? "text-primary" : "text-chart-3"} />
      </div>

      {/* Time domain SVG */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">TIME DOMAIN</div>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
          <line x1="40" y1={gH / 2} x2={gW - 10} y2={gH / 2} stroke="hsl(var(--border))" strokeWidth="0.5" />
          {timeSvg.xLabels.map((l, i) => (
            <g key={i}>
              <line x1={l.x} y1="15" x2={l.x} y2={gH - 15} stroke="hsl(var(--border))" strokeWidth="0.3" />
              <text x={l.x} y={gH - 3} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{l.label}ms</text>
            </g>
          ))}
          <path d={timeSvg.msgPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
          <path d={timeSvg.modPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" />
        </svg>
      </div>

      {/* Spectrum SVG */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">FREQUENCY SPECTRUM (dB)</div>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
          {specSvg.xLabels.map((l, i) => (
            <g key={i}>
              <line x1={l.x} y1="15" x2={l.x} y2={gH - 20} stroke="hsl(var(--border))" strokeWidth="0.3" />
              <text x={l.x} y={gH - 6} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{l.label}Hz</text>
            </g>
          ))}
          <path d={specSvg.path} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="1.8" />
        </svg>
      </div>

      {/* Power bar */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-2">POWER DISTRIBUTION</div>
        <div className="flex h-5 rounded-full overflow-hidden border border-border">
          <div className="bg-chart-4/40 transition-all" style={{ width: `${(1 - powerInfo.efficiency / 100) * 100}%` }} />
          <div className="bg-primary/60 transition-all" style={{ width: `${powerInfo.efficiency}%` }} />
        </div>
        <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
          <span>Carrier: {((1 - powerInfo.efficiency / 100) * 100).toFixed(1)}%</span>
          <span>Sideband (useful): {powerInfo.efficiency.toFixed(1)}%</span>
        </div>
      </div>

      {/* Formulas */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">📐 Key Formulas</div>
        {mod === "AM" && <>
          <div>s(t) = A_c [1 + m·cos(ω_m·t)] cos(ω_c·t)</div>
          <div>m = A_m/A_c = {(Am / Ac).toFixed(2)} {Am / Ac > 1 ? "⚠ OVERMODULATION" : ""}</div>
          <div>η = m² / (2 + m²) = {((Am / Ac) ** 2 / (2 + (Am / Ac) ** 2) * 100).toFixed(1)}% (theoretical)</div>
          <div>BW = 2f_m = {2 * fm} Hz</div>
        </>}
        {mod === "DSB-SC" && <>
          <div>s(t) = A_m·cos(ω_m·t) · A_c·cos(ω_c·t)</div>
          <div>No carrier → 100% efficient but needs coherent detection</div>
          <div>BW = 2f_m = {2 * fm} Hz</div>
        </>}
        {mod === "SSB" && <>
          <div>s(t) = ½·A_m·A_c·cos((ω_c ± ω_m)·t)</div>
          <div>Half bandwidth of DSB → BW = f_m = {fm} Hz</div>
        </>}
        {mod === "FM" && <>
          <div>s(t) = A_c·cos(ω_c·t + β·sin(ω_m·t))</div>
          <div>β = Δf/f_m = k_f·A_m/(2πf_m) = {(kf * Am / (2 * Math.PI * fm)).toFixed(2)}</div>
          <div>BW ≈ 2(β+1)f_m (Carson's Rule)</div>
        </>}
        {mod === "BPSK" && <div>s(t) = A_c·cos(ω_c·t + b·π), BER = Q(√(2E_b/N₀))</div>}
        {mod === "QPSK" && <div>s(t) = A_c·cos(ω_c·t + (2k+1)π/4), BER ≈ Q(√(2E_b/N₀)), BW = R_b</div>}
        {mod === "16-QAM" && <div>16 constellation points, BER ≈ (3/2)Q(√(4E_b/(5N₀))), spectral efficiency = 4 b/s/Hz</div>}
      </div>
    </div>
  );
};

// Reusable slider
const Slider = ({ label, value, min, max, step, unit, color, onChange }: {
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

const Metric = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2.5 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[8px] text-muted-foreground font-mono">{label}</div>
  </div>
);

export default ModulationPlayground;

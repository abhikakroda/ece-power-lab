import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type ModType = "AM" | "FM" | "PM" | "ASK" | "FSK" | "PSK";

const modTypes: { id: ModType; label: string; category: "Analog" | "Digital" }[] = [
  { id: "AM", label: "AM", category: "Analog" },
  { id: "FM", label: "FM", category: "Analog" },
  { id: "PM", label: "PM", category: "Analog" },
  { id: "ASK", label: "ASK", category: "Digital" },
  { id: "FSK", label: "FSK", category: "Digital" },
  { id: "PSK", label: "PSK", category: "Digital" },
];

const isDigital = (m: ModType) => m === "ASK" || m === "FSK" || m === "PSK";

// Generate modulated signal
const generateSignal = (
  mod: ModType, fc: number, fm: number, Am: number, Ac: number, kf: number, t: number, bits: number[]
): { carrier: number; message: number; modulated: number } => {
  const wc = 2 * Math.PI * fc;
  const wm = 2 * Math.PI * fm;

  if (isDigital(mod)) {
    const bitDuration = 1 / fm;
    const bitIdx = Math.min(Math.floor(t / bitDuration), bits.length - 1);
    const bit = bitIdx >= 0 ? bits[bitIdx] : 0;
    const carrier = Ac * Math.cos(wc * t);
    const message = bit;

    switch (mod) {
      case "ASK":
        return { carrier, message: bit * Ac, modulated: bit * Ac * Math.cos(wc * t) };
      case "FSK": {
        const fHigh = fc * 1.5;
        const fLow = fc * 0.5;
        const f = bit ? fHigh : fLow;
        return { carrier, message: bit * Ac, modulated: Ac * Math.cos(2 * Math.PI * f * t) };
      }
      case "PSK":
        return { carrier, message: bit * Ac, modulated: Ac * Math.cos(wc * t + bit * Math.PI) };
      default:
        return { carrier, message: 0, modulated: 0 };
    }
  }

  const carrier = Ac * Math.cos(wc * t);
  const message = Am * Math.cos(wm * t);

  switch (mod) {
    case "AM": {
      const m = Am / Ac;
      return { carrier, message, modulated: Ac * (1 + m * Math.cos(wm * t)) * Math.cos(wc * t) };
    }
    case "FM":
      return { carrier, message, modulated: Ac * Math.cos(wc * t + kf * Am * Math.sin(wm * t) / wm) };
    case "PM":
      return { carrier, message, modulated: Ac * Math.cos(wc * t + kf * Am * Math.cos(wm * t)) };
    default:
      return { carrier, message, modulated: 0 };
  }
};

// Simple FFT magnitude (DFT for display)
const computeSpectrum = (samples: number[], sampleRate: number): { freq: number; mag: number }[] => {
  const N = samples.length;
  const result: { freq: number; mag: number }[] = [];
  const freqRes = sampleRate / N;
  const half = Math.floor(N / 2);

  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += samples[n] * Math.cos(angle);
      im -= samples[n] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im) / N;
    result.push({ freq: parseFloat((k * freqRes).toFixed(1)), mag: parseFloat((20 * Math.log10(Math.max(mag, 1e-10))).toFixed(2)) });
  }
  return result;
};

// BER approximation
const computeBER = (mod: ModType, snrDb: number): number => {
  const snr = Math.pow(10, snrDb / 10);
  const Q = (x: number) => 0.5 * (1 - erf(x / Math.sqrt(2)));
  switch (mod) {
    case "ASK": return Q(Math.sqrt(snr / 2));
    case "FSK": return Q(Math.sqrt(snr));
    case "PSK": return Q(Math.sqrt(2 * snr));
    case "AM": return Q(Math.sqrt(snr));
    case "FM": return Q(Math.sqrt(3 * snr));
    case "PM": return Q(Math.sqrt(2 * snr));
    default: return 0;
  }
};

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const val = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? val : -val;
}

// Bandwidth estimation
const estimateBW = (mod: ModType, fm: number, fc: number, kf: number, Am: number): string => {
  switch (mod) {
    case "AM": return `${(2 * fm).toFixed(1)} Hz (2fm)`;
    case "FM": {
      const beta = (kf * Am) / (2 * Math.PI * fm);
      return `${(2 * (beta + 1) * fm).toFixed(1)} Hz (Carson's rule, β=${beta.toFixed(1)})`;
    }
    case "PM": {
      const beta = kf * Am;
      return `${(2 * (beta + 1) * fm).toFixed(1)} Hz (Carson's, β=${beta.toFixed(1)})`;
    }
    case "ASK": return `${(2 * fm).toFixed(1)} Hz (2Rb)`;
    case "FSK": return `${(fc + 2 * fm).toFixed(1)} Hz (Δf + 2Rb)`;
    case "PSK": return `${(2 * fm).toFixed(1)} Hz (2Rb)`;
    default: return "—";
  }
};

const addNoise = (signal: number, snrDb: number): number => {
  if (snrDb >= 50) return signal;
  const snrLin = Math.pow(10, snrDb / 10);
  const noisePower = (signal * signal) / snrLin || 0.01;
  const noise = Math.sqrt(noisePower) * (Math.random() * 2 - 1);
  return signal + noise;
};

const ModulationPlayground = () => {
  const [mod, setMod] = useState<ModType>("AM");
  const [fc, setFc] = useState(100);
  const [fm, setFm] = useState(10);
  const [Am, setAm] = useState(1);
  const [Ac, setAc] = useState(1);
  const [kf, setKf] = useState(10);
  const [snr, setSnr] = useState(30);
  const [bitPattern, setBitPattern] = useState("10110010");

  const bits = useMemo(() => bitPattern.split("").map(Number).filter(b => b === 0 || b === 1), [bitPattern]);

  const { timeData, specData, ber, bw } = useMemo(() => {
    const N = 512;
    const periods = isDigital(mod) ? bits.length / fm : 3 / fm;
    const tMax = periods;
    const dt = tMax / N;
    const sampleRate = N / tMax;

    const timePts: { t: number; carrier: number; message: number; modulated: number; noisy: number }[] = [];
    const modSamples: number[] = [];

    for (let i = 0; i < N; i++) {
      const t = i * dt;
      const sig = generateSignal(mod, fc, fm, Am, Ac, kf, t, bits);
      const noisy = addNoise(sig.modulated, snr);
      timePts.push({
        t: parseFloat(t.toFixed(5)),
        carrier: parseFloat(sig.carrier.toFixed(4)),
        message: parseFloat(sig.message.toFixed(4)),
        modulated: parseFloat(sig.modulated.toFixed(4)),
        noisy: parseFloat(noisy.toFixed(4)),
      });
      modSamples.push(sig.modulated);
    }

    const spec = computeSpectrum(modSamples, sampleRate)
      .filter(s => s.freq <= fc * 3 && s.freq > 0);

    return {
      timeData: timePts,
      specData: spec,
      ber: computeBER(mod, snr),
      bw: estimateBW(mod, fm, fc, kf, Am),
    };
  }, [mod, fc, fm, Am, Ac, kf, snr, bits]);

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };

  return (
    <div className="space-y-6">
      {/* Modulation selector */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Analog</div>
        <div className="flex gap-1.5">
          {modTypes.filter(m => m.category === "Analog").map(m => (
            <Button key={m.id} size="sm" onClick={() => setMod(m.id)}
              className={cn("text-xs font-mono",
                mod === m.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}>
              {m.label}
            </Button>
          ))}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-2">Digital</div>
        <div className="flex gap-1.5">
          {modTypes.filter(m => m.category === "Digital").map(m => (
            <Button key={m.id} size="sm" onClick={() => setMod(m.id)}
              className={cn("text-xs font-mono",
                mod === m.id ? "bg-chart-3 text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}>
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-card border border-border">
        <div>
          <Label className="text-[10px] text-muted-foreground">Carrier Freq (Hz)</Label>
          <Input type="number" value={fc} onChange={e => setFc(parseFloat(e.target.value) || 100)}
            className="font-mono bg-muted border-border text-foreground mt-1 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{isDigital(mod) ? "Bit Rate (bps)" : "Message Freq (Hz)"}</Label>
          <Input type="number" value={fm} onChange={e => setFm(parseFloat(e.target.value) || 10)}
            className="font-mono bg-muted border-border text-foreground mt-1 text-xs" />
        </div>
        {!isDigital(mod) && (
          <>
            <div>
              <Label className="text-[10px] text-muted-foreground">Msg Amplitude</Label>
              <Input type="number" value={Am} onChange={e => setAm(parseFloat(e.target.value) || 1)}
                className="font-mono bg-muted border-border text-foreground mt-1 text-xs" step="0.1" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Carrier Amplitude</Label>
              <Input type="number" value={Ac} onChange={e => setAc(parseFloat(e.target.value) || 1)}
                className="font-mono bg-muted border-border text-foreground mt-1 text-xs" step="0.1" />
            </div>
          </>
        )}
        {(mod === "FM" || mod === "PM") && (
          <div>
            <Label className="text-[10px] text-muted-foreground">{mod === "FM" ? "Freq Deviation (kf)" : "Phase Deviation (kp)"}</Label>
            <Input type="number" value={kf} onChange={e => setKf(parseFloat(e.target.value) || 10)}
              className="font-mono bg-muted border-border text-foreground mt-1 text-xs" />
          </div>
        )}
        {isDigital(mod) && (
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground">Bit Pattern</Label>
            <Input value={bitPattern} onChange={e => setBitPattern(e.target.value.replace(/[^01]/g, ""))}
              className="font-mono bg-muted border-border text-foreground mt-1 text-xs tracking-widest" maxLength={16} />
          </div>
        )}
      </div>

      {/* SNR slider */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-[10px] text-muted-foreground font-mono">NOISE (SNR)</Label>
          <span className="text-xs font-mono text-foreground">{snr} dB</span>
        </div>
        <input type="range" min={0} max={50} step={1} value={snr}
          onChange={e => setSnr(parseInt(e.target.value))}
          className="w-full accent-[hsl(var(--destructive))]" />
        <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
          <span>Noisy (0 dB)</span>
          <span>Clean (50 dB)</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-xs font-mono font-bold text-primary">{mod}</div>
          <div className="text-[10px] text-muted-foreground">Modulation</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-xs font-mono font-bold text-chart-2">{bw}</div>
          <div className="text-[10px] text-muted-foreground">Bandwidth</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <div className="text-xs font-mono font-bold text-chart-3">{snr} dB</div>
          <div className="text-[10px] text-muted-foreground">SNR</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          ber < 1e-4 ? "border-primary/30 bg-primary/5" : ber < 1e-2 ? "border-chart-3/30 bg-chart-3/5" : "border-destructive/30 bg-destructive/5"
        )}>
          <div className={cn("text-xs font-mono font-bold",
            ber < 1e-4 ? "text-primary" : ber < 1e-2 ? "text-chart-3" : "text-destructive"
          )}>{ber.toExponential(2)}</div>
          <div className="text-[10px] text-muted-foreground">BER</div>
        </div>
      </div>

      {/* Time domain */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">TIME DOMAIN</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={timeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={tickStyle} label={{ value: "Time (s)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={tickStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="message" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Message" />
            <Line type="monotone" dataKey="modulated" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} name="Modulated" />
            {snr < 40 && <Line type="monotone" dataKey="noisy" stroke="hsl(var(--destructive))" strokeWidth={1} dot={false} name="With Noise" opacity={0.6} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Frequency domain */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">FREQUENCY SPECTRUM (dB)</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={specData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="freq" tick={tickStyle} label={{ value: "Frequency (Hz)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={tickStyle} label={{ value: "dB", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="mag" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} name="Magnitude" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BER vs SNR curve */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">BER vs SNR COMPARISON</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={Array.from({ length: 30 }, (_, i) => {
            const s = i + 1;
            return {
              snr: s,
              ASK: parseFloat(computeBER("ASK", s).toExponential(2)),
              FSK: parseFloat(computeBER("FSK", s).toExponential(2)),
              PSK: parseFloat(computeBER("PSK", s).toExponential(2)),
            };
          })}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="snr" tick={tickStyle} label={{ value: "SNR (dB)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={tickStyle} scale="log" domain={["auto", "auto"]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="ASK" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="FSK" stroke="hsl(var(--chart-2))" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="PSK" stroke="hsl(var(--chart-3))" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ModulationPlayground;

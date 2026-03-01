import { useState, useMemo } from "react";
import { Microchip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

type EmbedTab = "pwm" | "adc" | "timer" | "i2c";

const tickStyle = { fill: "hsl(220 10% 50%)", fontSize: 10 };
const tooltipStyle = { background: "hsl(220 20% 9%)", border: "1px solid hsl(220 15% 16%)", color: "hsl(140 20% 88%)" };

const tabs: { id: EmbedTab; label: string }[] = [
  { id: "pwm", label: "PWM Generator" },
  { id: "adc", label: "ADC Sampling" },
  { id: "timer", label: "Timer / Counter" },
  { id: "i2c", label: "I2C Timing" },
];

// PWM Module
const PWMModule = () => {
  const [freq, setFreq] = useState(1000);
  const [duty, setDuty] = useState(50);
  const [deadTime, setDeadTime] = useState(0);

  const period = 1 / freq;
  const tOn = period * (duty / 100);
  const tOff = period - tOn;

  const data = useMemo(() => {
    const pts = [];
    const cycles = 3;
    const steps = 500;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * cycles * period;
      const tInCycle = t % period;
      const pwm = tInCycle < tOn ? 1 : 0;
      const complement = deadTime > 0
        ? (tInCycle > tOn + deadTime * 1e-6 && tInCycle < period - deadTime * 1e-6 ? 1 : 0)
        : (pwm ? 0 : 1);
      // Filtered output (RC approximation)
      const phase = (t % period) / period;
      const filtered = duty / 100 + 0.1 * Math.sin(2 * Math.PI * phase);
      pts.push({
        time: parseFloat((t * 1000).toFixed(4)),
        PWM: pwm,
        Complement: complement,
        Filtered: parseFloat(filtered.toFixed(3)),
      });
    }
    return pts;
  }, [freq, duty, deadTime, period, tOn]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-xs text-muted-foreground">Frequency (Hz)</Label>
          <Input type="number" value={freq} onChange={(e) => setFreq(Math.max(1, parseFloat(e.target.value) || 1000))}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Duty Cycle (%)</Label>
          <Input type="number" value={duty} min={0} max={100}
            onChange={(e) => setDuty(Math.min(100, Math.max(0, parseFloat(e.target.value) || 50)))}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Dead Time (μs)</Label>
          <Input type="number" value={deadTime} onChange={(e) => setDeadTime(parseFloat(e.target.value) || 0)}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div className="space-y-1 text-xs font-mono text-muted-foreground pt-5">
          <div>Period: <span className="text-primary">{(period * 1000).toFixed(3)} ms</span></div>
          <div>T_on: <span className="text-secondary">{(tOn * 1e6).toFixed(1)} μs</span></div>
          <div>T_off: <span className="text-accent">{(tOff * 1e6).toFixed(1)} μs</span></div>
        </div>
      </div>

      {/* Duty Cycle Slider Visual */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">DUTY CYCLE: {duty}%</div>
        <div className="h-8 rounded-md overflow-hidden flex">
          <div className="bg-primary/30 border-r border-primary" style={{ width: `${duty}%` }} />
          <div className="bg-muted flex-1" />
        </div>
        <input type="range" min={0} max={100} value={duty} onChange={(e) => setDuty(parseInt(e.target.value))}
          className="w-full mt-2 accent-primary" />
      </div>

      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">PWM WAVEFORM</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (ms)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={tickStyle} domain={[-0.2, 1.4]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="stepAfter" dataKey="PWM" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} />
            <Line type="stepAfter" dataKey="Complement" stroke="hsl(0 80% 55%)" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="Filtered" stroke="hsl(38 90% 55%)" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="p-4 rounded-xl bg-card border border-border grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div><span className="text-muted-foreground">Application:</span> <span className="text-foreground">Motor speed control, LED dimming, power supplies (SMPS)</span></div>
        <div><span className="text-muted-foreground">Timer Mode:</span> <span className="text-accent font-mono">CTC or Fast PWM (ATmega328)</span></div>
        <div><span className="text-muted-foreground">Formula:</span> <span className="text-primary font-mono">f = F_CPU / (N × (1+TOP))</span></div>
      </div>
    </div>
  );
};

// ADC Sampling Module
const ADCModule = () => {
  const [signalFreq, setSignalFreq] = useState(100);
  const [sampleRate, setSampleRate] = useState(500);
  const [resolution, setResolution] = useState(8);

  const nyquistOk = sampleRate >= 2 * signalFreq;
  const levels = 1 << resolution;

  const data = useMemo(() => {
    const pts = [];
    const tStop = 3 / signalFreq;
    const analogSteps = 500;
    const samplePeriod = 1 / sampleRate;

    // Analog signal
    for (let i = 0; i <= analogSteps; i++) {
      const t = (i / analogSteps) * tStop;
      const v = Math.sin(2 * Math.PI * signalFreq * t);
      pts.push({ time: parseFloat((t * 1000).toFixed(4)), analog: parseFloat(v.toFixed(4)), sampled: null as number | null, quantized: null as number | null });
    }

    // Samples
    for (let t = 0; t < tStop; t += samplePeriod) {
      const v = Math.sin(2 * Math.PI * signalFreq * t);
      const quantized = Math.round((v + 1) / 2 * (levels - 1)) / (levels - 1) * 2 - 1;
      const idx = Math.round((t / tStop) * analogSteps);
      if (idx < pts.length) {
        pts[idx].sampled = parseFloat(v.toFixed(4));
        pts[idx].quantized = parseFloat(quantized.toFixed(4));
      }
    }

    return pts;
  }, [signalFreq, sampleRate, resolution, levels]);

  // Reconstructed (aliased) frequency
  const aliasedFreq = useMemo(() => {
    if (nyquistOk) return signalFreq;
    const fold = sampleRate / 2;
    let f = signalFreq % sampleRate;
    if (f > fold) f = sampleRate - f;
    return f;
  }, [signalFreq, sampleRate, nyquistOk]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-xs text-muted-foreground">Signal Freq (Hz)</Label>
          <Input type="number" value={signalFreq} onChange={(e) => setSignalFreq(Math.max(1, parseFloat(e.target.value) || 100))}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Sample Rate (Hz)</Label>
          <Input type="number" value={sampleRate} onChange={(e) => setSampleRate(Math.max(1, parseFloat(e.target.value) || 500))}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Resolution (bits)</Label>
          <Input type="number" value={resolution} min={1} max={16}
            onChange={(e) => setResolution(Math.min(16, Math.max(1, parseInt(e.target.value) || 8)))}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div className="space-y-1 text-xs font-mono pt-5">
          <div className={nyquistOk ? "text-primary" : "text-destructive"}>
            {nyquistOk ? "✓ Nyquist OK" : "✗ ALIASING!"}
          </div>
          <div className="text-muted-foreground">Levels: <span className="text-accent">{levels}</span></div>
          <div className="text-muted-foreground">LSB: <span className="text-secondary">{(2 / levels).toFixed(4)} V</span></div>
        </div>
      </div>

      {!nyquistOk && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive font-mono">
          ⚠ fs ({sampleRate} Hz) &lt; 2×f_signal ({2 * signalFreq} Hz) — Aliased frequency appears at {aliasedFreq.toFixed(1)} Hz
        </div>
      )}

      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">ANALOG vs SAMPLED SIGNAL</div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (ms)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={tickStyle} domain={[-1.2, 1.2]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="analog" stroke="hsl(220 10% 35%)" strokeWidth={1.5} dot={false} name="Analog" />
            <Line type="monotone" dataKey="quantized" stroke="hsl(142 100% 45%)" strokeWidth={0} dot={{ r: 3, fill: "hsl(142 100% 45%)" }} name="Quantized" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Timer Module
const TimerModule = () => {
  const [cpuFreq, setCpuFreq] = useState(16); // MHz
  const [prescaler, setPrescaler] = useState(64);
  const [topValue, setTopValue] = useState(249);
  const [mode, setMode] = useState<"CTC" | "Normal" | "FastPWM">("CTC");

  const timerFreq = (cpuFreq * 1e6) / (prescaler * (topValue + 1));
  const timerPeriod = 1 / timerFreq;
  const tickTime = prescaler / (cpuFreq * 1e6);

  const waveform = useMemo(() => {
    const pts = [];
    const cycles = 3;
    const stepsPerCycle = 100;
    for (let c = 0; c < cycles; c++) {
      for (let i = 0; i <= stepsPerCycle; i++) {
        const phase = i / stepsPerCycle;
        const t = (c + phase) * timerPeriod;
        let val: number;
        if (mode === "CTC" || mode === "Normal") {
          val = phase * (topValue + 1);
          if (val > topValue) val = 0;
        } else {
          val = phase * (topValue + 1);
        }
        pts.push({
          time: parseFloat((t * 1000).toFixed(4)),
          counter: Math.floor(val),
        });
      }
    }
    return pts;
  }, [cpuFreq, prescaler, topValue, mode, timerFreq, timerPeriod]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-xs text-muted-foreground">CPU Freq (MHz)</Label>
          <Input type="number" value={cpuFreq} onChange={(e) => setCpuFreq(parseFloat(e.target.value) || 16)}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Prescaler</Label>
          <div className="flex gap-1 mt-1">
            {[1, 8, 64, 256, 1024].map((p) => (
              <button key={p} onClick={() => setPrescaler(p)}
                className={cn("px-2 py-1 rounded text-xs font-mono border",
                  prescaler === p ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"
                )}>{p}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">TOP Value</Label>
          <Input type="number" value={topValue} onChange={(e) => setTopValue(parseInt(e.target.value) || 255)}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <div className="flex gap-1 mt-1">
            {(["CTC", "Normal", "FastPWM"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("px-2 py-1 rounded text-xs font-mono border",
                  mode === m ? "bg-secondary/20 border-secondary/40 text-secondary" : "border-border text-muted-foreground"
                )}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Computed Values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] text-muted-foreground">Timer Frequency</div>
          <div className="font-mono text-sm font-bold text-primary">
            {timerFreq >= 1e6 ? `${(timerFreq / 1e6).toFixed(2)} MHz` : timerFreq >= 1e3 ? `${(timerFreq / 1e3).toFixed(2)} kHz` : `${timerFreq.toFixed(2)} Hz`}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] text-muted-foreground">Period</div>
          <div className="font-mono text-sm font-bold text-secondary">
            {timerPeriod >= 1 ? `${timerPeriod.toFixed(3)} s` : timerPeriod >= 1e-3 ? `${(timerPeriod * 1e3).toFixed(3)} ms` : `${(timerPeriod * 1e6).toFixed(1)} μs`}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] text-muted-foreground">Tick Time</div>
          <div className="font-mono text-sm font-bold text-accent">{(tickTime * 1e6).toFixed(3)} μs</div>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border text-center">
          <div className="text-[10px] text-muted-foreground">Formula</div>
          <div className="font-mono text-[10px] text-chart-4">f = {cpuFreq}M / ({prescaler}×{topValue + 1})</div>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">COUNTER WAVEFORM ({mode})</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={waveform}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (ms)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={tickStyle} domain={[0, "auto"]} label={{ value: "Count", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <ReferenceLine y={topValue} stroke="hsl(0 80% 55%)" strokeDasharray="5 3" label={{ value: "TOP", fill: "hsl(0 80% 55%)", fontSize: 10 }} />
            <Line type="linear" dataKey="counter" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// I2C Timing Module
const I2CModule = () => {
  const [speed, setSpeed] = useState<100 | 400 | 1000>(100); // kHz
  const [address, setAddress] = useState(0x48);
  const [dataVal, setDataVal] = useState(0xA5);

  const bitPeriod = 1 / (speed * 1000);
  const addrBits = address.toString(2).padStart(7, "0").split("").map(Number);
  const dataBits = dataVal.toString(2).padStart(8, "0").split("").map(Number);

  // Full I2C frame: START + 7-bit addr + R/W + ACK + 8-bit data + ACK + STOP
  const allBits = [
    -1, // START
    ...addrBits,
    0, // R/W (write)
    -2, // ACK
    ...dataBits,
    -2, // ACK
    -3, // STOP
  ];

  const waveform = useMemo(() => {
    const pts = [];
    allBits.forEach((bit, i) => {
      const tStart = i * bitPeriod;
      const steps = 20;
      for (let s = 0; s <= steps; s++) {
        const t = tStart + (s / steps) * bitPeriod;
        const phase = s / steps;
        let sda: number, scl: number;

        if (bit === -1) { // START: SDA falls while SCL high
          scl = 1;
          sda = phase < 0.5 ? 1 : 0;
        } else if (bit === -3) { // STOP: SDA rises while SCL high
          scl = 1;
          sda = phase < 0.5 ? 0 : 1;
        } else if (bit === -2) { // ACK
          scl = phase > 0.25 && phase < 0.75 ? 1 : 0;
          sda = 0;
        } else {
          scl = phase > 0.25 && phase < 0.75 ? 1 : 0;
          sda = bit;
        }

        pts.push({
          time: parseFloat((t * 1e6).toFixed(2)),
          SCL: scl + 1.5,
          SDA: sda,
        });
      }
    });
    return pts;
  }, [allBits, bitPeriod]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div>
          <Label className="text-xs text-muted-foreground">Speed Mode</Label>
          <div className="flex gap-1 mt-1">
            {([100, 400, 1000] as const).map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={cn("px-3 py-1.5 rounded text-xs font-mono border",
                  speed === s ? "bg-secondary/20 border-secondary/40 text-secondary" : "border-border text-muted-foreground"
                )}>
                {s === 100 ? "Standard" : s === 400 ? "Fast" : "Fast+"} ({s}k)
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Slave Address (7-bit hex)</Label>
          <Input value={`0x${address.toString(16).toUpperCase()}`}
            onChange={(e) => { const v = parseInt(e.target.value, 16); if (!isNaN(v) && v <= 0x7F) setAddress(v); }}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data Byte (hex)</Label>
          <Input value={`0x${dataVal.toString(16).toUpperCase()}`}
            onChange={(e) => { const v = parseInt(e.target.value, 16); if (!isNaN(v) && v <= 0xFF) setDataVal(v); }}
            className="font-mono bg-muted border-border text-foreground mt-1" />
        </div>
      </div>

      {/* Frame breakdown */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">I2C FRAME</div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="px-2 py-1 rounded bg-accent/20 text-accent text-xs font-mono">S</span>
          {addrBits.map((b, i) => (
            <span key={`a${i}`} className={cn("px-2 py-1 rounded text-xs font-mono", b ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>{b}</span>
          ))}
          <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-xs font-mono">W</span>
          <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-mono">A</span>
          {dataBits.map((b, i) => (
            <span key={`d${i}`} className={cn("px-2 py-1 rounded text-xs font-mono", b ? "bg-chart-4/20 text-chart-4" : "bg-muted text-muted-foreground")}>{b}</span>
          ))}
          <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-mono">A</span>
          <span className="px-2 py-1 rounded bg-destructive/20 text-destructive text-xs font-mono">P</span>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
          Addr: 0x{address.toString(16).toUpperCase()} ({address}) | Data: 0x{dataVal.toString(16).toUpperCase()} ({dataVal}) | Total: {allBits.length} bit periods
        </div>
      </div>

      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">I2C TIMING DIAGRAM</div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={waveform}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
            <XAxis dataKey="time" tick={tickStyle} label={{ value: "Time (μs)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
            <YAxis tick={tickStyle} domain={[-0.3, 3]} ticks={[0, 1, 1.5, 2.5]} tickFormatter={(v) => v <= 1 ? "SDA" : "SCL"} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="stepAfter" dataKey="SDA" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} name="SDA" />
            <Line type="stepAfter" dataKey="SCL" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="SCL" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const EmbeddedPlayground = () => {
  const [activeTab, setActiveTab] = useState<EmbedTab>("pwm");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-5/20 flex items-center justify-center">
          <Microchip size={20} className="text-chart-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Embedded Systems Playground</h2>
          <p className="text-sm text-muted-foreground font-mono">PWM • ADC • Timers • I2C</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("px-4 py-2.5 rounded-xl text-sm font-medium border whitespace-nowrap transition-all",
              activeTab === tab.id ? "bg-chart-5/10 border-chart-5/40 text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "pwm" && <PWMModule />}
        {activeTab === "adc" && <ADCModule />}
        {activeTab === "timer" && <TimerModule />}
        {activeTab === "i2c" && <I2CModule />}
      </div>
    </div>
  );
};

export default EmbeddedPlayground;

import { useState, useMemo } from "react";
import { Cpu, Lightbulb, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DeviceTab = "bjt" | "mosfet";
type BjtPlot = "output" | "input" | "transfer";
type MosPlot = "output" | "transfer" | "gm";

interface BjtParams {
  beta: number;
  VT: number;
  IS: number;
  VA: number;
  VCE_max: number;
}

interface MosParams {
  KP: number;
  Vth: number;
  lambda: number;
  WL: number;
  VDS_max: number;
  VGS_max: number;
}

const bjtApplications = [
  { title: "Common Emitter Amplifier", desc: "Most widely used single-stage amplifier. Provides high voltage gain with 180° phase inversion. Used in audio preamps, sensor interfaces.", formula: "Av = -gm(RC ∥ ro), gm = IC/VT", operating: "Active region: VBE ≈ 0.7V, VCE > VCE(sat)" },
  { title: "Current Mirror", desc: "Copies a reference current to other branches. Foundation of analog IC design — used in op-amp biasing, DACs, active loads.", formula: "IOUT = IREF × (W/L)₂/(W/L)₁", operating: "Both transistors in active region with same VBE" },
  { title: "Differential Pair", desc: "Heart of every op-amp. Amplifies difference between two inputs while rejecting common-mode noise. Used in instrumentation amps.", formula: "Ad = gm × RD, CMRR = Ad/Acm", operating: "Tail current source keeps total current constant" },
  { title: "Switch (Saturation Mode)", desc: "Digital logic, relay drivers, LED drivers. BJT acts as closed switch in saturation, open switch in cutoff.", formula: "IB > IC/β for saturation, VCE(sat) ≈ 0.2V", operating: "Saturation: both junctions forward biased" },
  { title: "Emitter Follower (Buffer)", desc: "Unity voltage gain, high input impedance, low output impedance. Used to drive low-impedance loads without loading the source.", formula: "Av ≈ 1, Zin = β × (re + RE), Zout ≈ re", operating: "Active region, output follows input minus VBE" },
];

const mosfetApplications = [
  { title: "CMOS Inverter", desc: "Fundamental digital gate. NMOS pulls to GND, PMOS pulls to VDD. Zero static power consumption — basis of ALL modern digital ICs.", formula: "Vth determines switching point, tpd = 0.69 × R × C", operating: "Both MOSFETs switch between triode and cutoff" },
  { title: "Common Source Amplifier", desc: "Equivalent of CE in BJT. High gain analog amplifier used in op-amps, LNAs, and sensor readout circuits.", formula: "Av = -gm(RD ∥ ro), gm = 2ID/(VGS-Vth)", operating: "Saturation: VDS > VGS - Vth" },
  { title: "Power MOSFET Switch", desc: "Motor drivers, power supplies, inverters. Low RDS(on) allows efficient switching of large currents with minimal loss.", formula: "P_loss = ID² × RDS(on) + switching losses", operating: "Triode for ON (low RDS), cutoff for OFF" },
  { title: "Source Follower (Buffer)", desc: "Level shifter and impedance buffer. Similar to emitter follower but with infinite DC input impedance.", formula: "Av = gm×RS/(1+gm×RS) ≈ 1, Zin = ∞ (gate)", operating: "Saturation region, output follows input minus Vth" },
  { title: "CMOS Transmission Gate", desc: "Analog switch that passes both high and low voltages. NMOS + PMOS in parallel. Used in sample-and-hold, MUX, DACs.", formula: "Ron = 1/(μCox(W/L)(VDD-Vth))", operating: "Both transistors in triode when ON" },
  { title: "Current Source (Cascode)", desc: "High output impedance current source for precision analog. Used in ADCs, bandgap references, and op-amp stages.", formula: "Rout = gm × ro1 × ro2 (cascode boost)", operating: "Both MOSFETs in saturation" },
];

const TransistorSimulator = () => {
  const [device, setDevice] = useState<DeviceTab>("bjt");
  const [bjtPlot, setBjtPlot] = useState<BjtPlot>("output");
  const [mosPlot, setMosPlot] = useState<MosPlot>("output");

  const [bjt, setBjt] = useState<BjtParams>({ beta: 100, VT: 0.026, IS: 1e-14, VA: 100, VCE_max: 10 });
  const [mos, setMos] = useState<MosParams>({ KP: 200, Vth: 1, lambda: 0.02, WL: 10, VDS_max: 10, VGS_max: 5 });

  // BJT Output Characteristics: IC vs VCE for different IB
  const bjtOutputData = useMemo(() => {
    const { beta, VA, VCE_max } = bjt;
    const ibValues = [10, 20, 30, 40, 50]; // μA
    const data = [];
    for (let v = 0; v <= VCE_max; v += 0.1) {
      const point: Record<string, number> = { VCE: parseFloat(v.toFixed(2)) };
      ibValues.forEach((ib) => {
        const ic_mA = (ib * 1e-6 * beta * (1 + v / VA)) * 1000;
        const vce_sat = 0.2;
        const factor = v < vce_sat ? v / vce_sat : 1;
        point[`IB=${ib}μA`] = parseFloat((ic_mA * factor).toFixed(3));
      });
      data.push(point);
    }
    return data;
  }, [bjt]);

  // BJT Input Characteristics: IB vs VBE
  const bjtInputData = useMemo(() => {
    const { IS, VT } = bjt;
    const data = [];
    for (let vbe = 0; vbe <= 0.8; vbe += 0.005) {
      const ib_uA = (IS * (Math.exp(vbe / VT) - 1)) * 1e6;
      data.push({ VBE: parseFloat(vbe.toFixed(3)), IB: parseFloat(Math.min(ib_uA, 60).toFixed(3)) });
    }
    return data;
  }, [bjt]);

  // BJT Transfer Characteristics: IC vs VBE
  const bjtTransferData = useMemo(() => {
    const { IS, VT, beta } = bjt;
    const data = [];
    for (let vbe = 0; vbe <= 0.8; vbe += 0.005) {
      const ic_mA = (IS * beta * (Math.exp(vbe / VT) - 1)) * 1000;
      data.push({ VBE: parseFloat(vbe.toFixed(3)), IC: parseFloat(Math.min(ic_mA, 10).toFixed(3)) });
    }
    return data;
  }, [bjt]);

  // MOSFET Output Characteristics: ID vs VDS for different VGS
  const mosOutputData = useMemo(() => {
    const { KP, Vth, lambda, WL, VDS_max } = mos;
    const k = (KP * 1e-6 / 2) * WL;
    const vgsValues = [2, 2.5, 3, 3.5, 4];
    const data = [];
    for (let vds = 0; vds <= VDS_max; vds += 0.05) {
      const point: Record<string, number> = { VDS: parseFloat(vds.toFixed(2)) };
      vgsValues.forEach((vgs) => {
        if (vgs <= Vth) {
          point[`VGS=${vgs}V`] = 0;
        } else {
          const vov = vgs - Vth;
          let id;
          if (vds < vov) {
            // Triode
            id = k * (2 * vov * vds - vds * vds);
          } else {
            // Saturation
            id = k * vov * vov * (1 + lambda * vds);
          }
          point[`VGS=${vgs}V`] = parseFloat((id * 1000).toFixed(3)); // mA
        }
      });
      data.push(point);
    }
    return data;
  }, [mos]);

  // MOSFET Transfer Characteristics: ID vs VGS
  const mosTransferData = useMemo(() => {
    const { KP, Vth, lambda, WL, VGS_max } = mos;
    const k = (KP * 1e-6 / 2) * WL;
    const vds = 5; // fixed VDS
    const data = [];
    for (let vgs = 0; vgs <= VGS_max; vgs += 0.02) {
      let id = 0;
      if (vgs > Vth) {
        const vov = vgs - Vth;
        if (vds < vov) {
          id = k * (2 * vov * vds - vds * vds);
        } else {
          id = k * vov * vov * (1 + lambda * vds);
        }
      }
      data.push({
        VGS: parseFloat(vgs.toFixed(2)),
        ID: parseFloat((id * 1000).toFixed(3)),
      });
    }
    return data;
  }, [mos]);

  // MOSFET gm vs VGS
  const mosGmData = useMemo(() => {
    const { KP, Vth, WL, VGS_max } = mos;
    const k = KP * 1e-6 * WL;
    const data = [];
    for (let vgs = 0; vgs <= VGS_max; vgs += 0.02) {
      let gm = 0;
      if (vgs > Vth) {
        gm = k * (vgs - Vth); // gm = μnCox(W/L)(VGS-Vth)
      }
      data.push({
        VGS: parseFloat(vgs.toFixed(2)),
        gm: parseFloat((gm * 1000).toFixed(3)), // mS
      });
    }
    return data;
  }, [mos]);

  const chartColors = [
    "hsl(142 100% 45%)",
    "hsl(187 80% 42%)",
    "hsl(38 90% 55%)",
    "hsl(280 70% 55%)",
    "hsl(0 80% 55%)",
  ];

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
    fontSize: 13,
  };
  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-chart-3/20 flex items-center justify-center">
          <Cpu size={22} className="text-chart-3" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Transistor Simulator</h2>
          <p className="text-sm text-muted-foreground font-mono">BJT & MOSFET I-V Curves • Real Applications</p>
        </div>
      </div>

      {/* Device Toggle */}
      <div className="flex gap-2">
        <Button
          onClick={() => setDevice("bjt")}
          className={cn(
            device === "bjt"
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          BJT (NPN)
        </Button>
        <Button
          onClick={() => setDevice("mosfet")}
          className={cn(
            device === "mosfet"
              ? "bg-secondary text-secondary-foreground"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          MOSFET (NMOS)
        </Button>
      </div>

      {/* ========= BJT Section ========= */}
      {device === "bjt" && (
        <div className="space-y-8 animate-fade-in">
          {/* Params */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 rounded-xl bg-card border border-border oscilloscope-border">
            {[
              { key: "beta" as const, label: "β (hFE)", val: bjt.beta, step: "10" },
              { key: "IS" as const, label: "IS (A)", val: bjt.IS, step: "1e-15" },
              { key: "VT" as const, label: "VT (V)", val: bjt.VT, step: "0.001" },
              { key: "VA" as const, label: "Early Voltage VA", val: bjt.VA, step: "10" },
              { key: "VCE_max" as const, label: "VCE Max (V)", val: bjt.VCE_max, step: "1" },
            ].map((p) => (
              <div key={p.key}>
                <Label className="text-sm text-muted-foreground">{p.label}</Label>
                <Input type="number" value={p.val} step={p.step}
                  onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) setBjt((prev) => ({ ...prev, [p.key]: n })); }}
                  className="font-mono bg-muted border-border text-foreground mt-1"
                />
              </div>
            ))}
          </div>

          {/* Plot Selector */}
          <div className="flex gap-2">
            {([["output", "Output (IC vs VCE)"], ["input", "Input (IB vs VBE)"], ["transfer", "Transfer (IC vs VBE)"]] as const).map(([id, label]) => (
              <Button key={id} size="sm" variant={bjtPlot === id ? "default" : "outline"} onClick={() => setBjtPlot(id)}
                className={bjtPlot === id ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}>
                {label}
              </Button>
            ))}
          </div>

          {/* BJT Charts */}
           <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-base font-semibold text-foreground mb-4 font-mono">
              {bjtPlot === "output" ? "📊 OUTPUT CHARACTERISTICS (IC vs VCE)" : bjtPlot === "input" ? "📊 INPUT CHARACTERISTICS (IB vs VBE)" : "📊 TRANSFER CHARACTERISTICS (IC vs VBE)"}
            </h3>
            <ResponsiveContainer width="100%" height={420}>
              {bjtPlot === "output" ? (
                <LineChart data={bjtOutputData} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="VCE" tick={tickStyle} label={{ value: "VCE (V)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: 10 }} />
                  <YAxis tick={tickStyle} width={50} label={{ value: "IC (mA)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {[10, 20, 30, 40, 50].map((ib, i) => (
                    <Line key={ib} type="monotone" dataKey={`IB=${ib}μA`} stroke={chartColors[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              ) : bjtPlot === "input" ? (
                <LineChart data={bjtInputData} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="VBE" tick={tickStyle} label={{ value: "VBE (V)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: 10 }} />
                  <YAxis tick={tickStyle} width={50} label={{ value: "IB (μA)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="IB" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} name="IB (μA)" />
                </LineChart>
              ) : (
                <LineChart data={bjtTransferData} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="VBE" tick={tickStyle} label={{ value: "VBE (V)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 13, offset: 10 }} />
                  <YAxis tick={tickStyle} width={50} label={{ value: "IC (mA)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="IC" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="IC (mA)" />
                </LineChart>
              )}
            </ResponsiveContainer>

            {/* Region Annotations */}
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-mono">
              <div className="px-3 py-2 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Cutoff:</span> <span className="text-destructive">VBE &lt; 0.7V, IC ≈ 0</span>
              </div>
              <div className="px-3 py-2 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Active:</span> <span className="text-primary">VBE ≈ 0.7V, IC = βIB</span>
              </div>
              <div className="px-3 py-2 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Saturation:</span> <span className="text-accent">VCE &lt; 0.2V, both junctions fwd</span>
              </div>
            </div>
          </div>

          {/* BJT Applications */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-accent" /> Real-World BJT Applications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bjtApplications.map((app) => (
                <div key={app.title} className="p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group">
                  <h4 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                    <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    {app.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{app.desc}</p>
                  <div className="space-y-2">
                    <div className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1.5 rounded inline-block">{app.formula}</div>
                    <div className="text-xs text-muted-foreground"><span className="text-accent">Operating:</span> {app.operating}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========= MOSFET Section ========= */}
      {device === "mosfet" && (
        <div className="space-y-8 animate-fade-in">
          {/* Params */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-6 rounded-xl bg-card border border-border oscilloscope-border">
            {[
              { key: "KP" as const, label: "μnCox (μA/V²)", val: mos.KP, step: "10" },
              { key: "Vth" as const, label: "Vth (V)", val: mos.Vth, step: "0.1" },
              { key: "WL" as const, label: "W/L", val: mos.WL, step: "1" },
              { key: "lambda" as const, label: "λ (V⁻¹)", val: mos.lambda, step: "0.01" },
              { key: "VDS_max" as const, label: "VDS Max (V)", val: mos.VDS_max, step: "1" },
              { key: "VGS_max" as const, label: "VGS Max (V)", val: mos.VGS_max, step: "0.5" },
            ].map((p) => (
              <div key={p.key}>
                <Label className="text-sm text-muted-foreground">{p.label}</Label>
                <Input type="number" value={p.val} step={p.step}
                  onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) setMos((prev) => ({ ...prev, [p.key]: n })); }}
                  className="font-mono bg-muted border-border text-foreground mt-1"
                />
              </div>
            ))}
          </div>

          {/* Plot Selector */}
          <div className="flex gap-2">
            {([["output", "Output (ID vs VDS)"], ["transfer", "Transfer (ID vs VGS)"], ["gm", "gm vs VGS"]] as const).map(([id, label]) => (
              <Button key={id} size="sm" variant={mosPlot === id ? "default" : "outline"} onClick={() => setMosPlot(id)}
                className={mosPlot === id ? "bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:text-foreground"}>
                {label}
              </Button>
            ))}
          </div>

          {/* MOSFET Charts */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <h3 className="text-sm font-semibold text-foreground mb-4 font-mono">
              {mosPlot === "output" ? "📊 OUTPUT CHARACTERISTICS (ID vs VDS)" : mosPlot === "transfer" ? "📊 TRANSFER CHARACTERISTICS (ID vs VGS)" : "📊 TRANSCONDUCTANCE (gm vs VGS)"}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              {mosPlot === "output" ? (
                <LineChart data={mosOutputData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis dataKey="VDS" tick={tickStyle} label={{ value: "VDS (V)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis tick={tickStyle} label={{ value: "ID (mA)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  {[2, 2.5, 3, 3.5, 4].map((vgs, i) => (
                    <Line key={vgs} type="monotone" dataKey={`VGS=${vgs}V`} stroke={chartColors[i]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              ) : mosPlot === "transfer" ? (
                <LineChart data={mosTransferData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis dataKey="VGS" tick={tickStyle} label={{ value: "VGS (V)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis tick={tickStyle} label={{ value: "ID (mA)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="ID" stroke="hsl(187 80% 42%)" strokeWidth={2} dot={false} name="ID (mA)" />
                </LineChart>
              ) : (
                <LineChart data={mosGmData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                  <XAxis dataKey="VGS" tick={tickStyle} label={{ value: "VGS (V)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                  <YAxis tick={tickStyle} label={{ value: "gm (mS)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="gm" stroke="hsl(38 90% 55%)" strokeWidth={2} dot={false} name="gm (mS)" />
                </LineChart>
              )}
            </ResponsiveContainer>

            {/* Region Annotations */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-mono">
              <div className="px-3 py-1.5 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Cutoff:</span> <span className="text-destructive">VGS &lt; Vth, ID = 0</span>
              </div>
              <div className="px-3 py-1.5 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Triode:</span> <span className="text-secondary">VDS &lt; VGS - Vth</span>
              </div>
              <div className="px-3 py-1.5 rounded bg-muted border border-border">
                <span className="text-muted-foreground">Saturation:</span> <span className="text-primary">VDS ≥ VGS - Vth</span>
              </div>
            </div>
          </div>

          {/* Key Formulas */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 font-mono">📐 MOSFET EQUATIONS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-mono text-muted-foreground">
              <div><span className="text-secondary">Triode:</span> ID = KP/2 · W/L · [2(VGS-Vth)VDS - VDS²]</div>
              <div><span className="text-primary">Saturation:</span> ID = KP/2 · W/L · (VGS-Vth)²(1+λVDS)</div>
              <div><span className="text-accent">gm:</span> = 2ID/(VGS-Vth) = √(2·KP·W/L·ID)</div>
              <div><span className="text-chart-4">ro:</span> = 1/(λ·ID) = VA/ID</div>
            </div>
          </div>

          {/* MOSFET Applications */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-accent" /> Real-World MOSFET Applications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mosfetApplications.map((app) => (
                <div key={app.title} className="p-5 rounded-xl bg-card border border-border hover:border-secondary/30 transition-colors group">
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <ArrowRight size={14} className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                    {app.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{app.desc}</p>
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-secondary bg-secondary/10 px-2 py-1 rounded inline-block">{app.formula}</div>
                    <div className="text-[10px] text-muted-foreground"><span className="text-accent">Operating:</span> {app.operating}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransistorSimulator;

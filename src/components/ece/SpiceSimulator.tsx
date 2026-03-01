import { useState, useMemo } from "react";
import { Cpu, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  parseNetlist, solveDC, solveAC, solveTransient,
  type SpiceComponent, cxMag, cxPhase,
} from "@/lib/spice-engine";

type AnalysisType = "dc" | "ac" | "tran";

const exampleNetlists: { name: string; netlist: string; analysis: AnalysisType; desc: string }[] = [
  {
    name: "Voltage Divider",
    analysis: "dc",
    desc: "R1-R2 divider with 10V source",
    netlist: `V1 1 0 10
R1 1 2 1k
R2 2 0 1k`,
  },
  {
    name: "RC Low-Pass Filter",
    analysis: "ac",
    desc: "1st order LPF, fc ≈ 1.59 kHz",
    netlist: `V1 1 0 1
R1 1 2 1k
C1 2 0 100n`,
  },
  {
    name: "RLC Resonance",
    analysis: "ac",
    desc: "Series RLC, f0 ≈ 5.03 kHz",
    netlist: `V1 1 0 1
R1 1 2 100
L1 2 3 10m
C1 3 0 100n`,
  },
  {
    name: "RC Charging",
    analysis: "tran",
    desc: "Capacitor charging, τ = RC",
    netlist: `V1 1 0 10
R1 1 2 10k
C1 2 0 10u`,
  },
  {
    name: "Diode Rectifier",
    analysis: "dc",
    desc: "Half-wave rectifier DC bias",
    netlist: `V1 1 0 5
D1 1 2
R1 2 0 1k`,
  },
  {
    name: "Diode Clamp",
    analysis: "dc",
    desc: "Diode voltage clamp at ~0.7V",
    netlist: `V1 1 0 3
R1 1 2 1k
D1 2 0`,
  },
  {
    name: "BJT CE Amplifier",
    analysis: "dc",
    desc: "Common-emitter NPN biasing",
    netlist: `V1 1 0 12
R1 1 2 100k
R2 2 0 22k
Q1 3 2 4 Bf=100
R3 1 3 4.7k
R4 4 0 1k`,
  },
  {
    name: "BJT Switch",
    analysis: "dc",
    desc: "NPN switching circuit",
    netlist: `V1 1 0 5
V2 3 0 3.3
R1 3 2 10k
Q1 4 2 0 Bf=200
R2 1 4 1k`,
  },
  {
    name: "NMOS Inverter",
    analysis: "dc",
    desc: "NMOS with resistive load",
    netlist: `V1 1 0 5
V2 2 0 3
M1 3 2 0 Vth=1 Kp=1m
R1 1 3 2k`,
  },
  {
    name: "CMOS Biasing",
    analysis: "dc",
    desc: "MOSFET in saturation",
    netlist: `V1 1 0 5
V2 2 0 2.5
M1 3 2 0 Vth=0.7 Kp=500u Lambda=0.02
R1 1 3 5k`,
  },
  {
    name: "Diode + RC",
    analysis: "tran",
    desc: "Diode charging circuit",
    netlist: `V1 1 0 5
D1 1 2
R1 2 3 1k
C1 3 0 1u`,
  },
];

const chartColors = [
  "hsl(142 100% 45%)", "hsl(187 80% 42%)", "hsl(38 90% 55%)",
  "hsl(280 70% 55%)", "hsl(0 80% 55%)", "hsl(60 80% 50%)",
];

const tooltipStyle = {
  background: "hsl(220 20% 9%)",
  border: "1px solid hsl(220 15% 16%)",
  color: "hsl(140 20% 88%)",
};
const tickStyle = { fill: "hsl(220 10% 50%)", fontSize: 10 };

const SpiceSimulator = () => {
  const [netlist, setNetlist] = useState(exampleNetlists[0].netlist);
  const [analysis, setAnalysis] = useState<AnalysisType>("dc");
  const [acStart, setAcStart] = useState(10);
  const [acStop, setAcStop] = useState(1e6);
  const [acPoints, setAcPoints] = useState(200);
  const [tranStop, setTranStop] = useState(0.01);
  const [tranStep, setTranStep] = useState(1e-5);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState(1);

  const runSimulation = () => {
    try {
      setError("");
      const { components, nodeCount } = parseNetlist(netlist);
      if (components.length === 0) { setError("No valid components found"); return; }

      if (analysis === "dc") {
        const dc = solveDC(components, nodeCount);
        setResults({ type: "dc", ...dc, nodeCount });
      } else if (analysis === "ac") {
        const ac = solveAC(components, nodeCount, acStart, acStop, acPoints);
        setResults({ type: "ac", data: ac, nodeCount });
      } else {
        const tran = solveTransient(components, nodeCount, tranStop, tranStep);
        setResults({ type: "tran", data: tran, nodeCount });
      }
    } catch (e: any) {
      setError(e.message || "Simulation error");
    }
  };

  const loadExample = (ex: typeof exampleNetlists[0]) => {
    setNetlist(ex.netlist);
    setAnalysis(ex.analysis);
    setResults(null);
    if (ex.analysis === "ac") { setAcStart(10); setAcStop(1e6); }
    if (ex.analysis === "tran") {
      setTranStop(ex.name.includes("Charging") ? 0.5 : 0.01);
      setTranStep(ex.name.includes("Charging") ? 5e-4 : 1e-5);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
          <Cpu size={20} className="text-chart-1" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">SPICE Simulator</h2>
          <p className="text-sm text-muted-foreground font-mono">Netlist → MNA Solver → Waveforms</p>
        </div>
      </div>

      {/* Example Circuits */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">Example Circuits:</div>
        <div className="flex flex-wrap gap-2">
          {exampleNetlists.map((ex) => (
            <button key={ex.name} onClick={() => loadExample(ex)}
              className="px-3 py-1.5 rounded-lg text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Netlist Input */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">NETLIST (SPICE FORMAT)</div>
            <Textarea
              value={netlist}
              onChange={(e) => setNetlist(e.target.value)}
              className="font-mono text-sm bg-muted border-border text-foreground min-h-[160px] resize-none"
              placeholder="V1 1 0 10&#10;R1 1 2 1k&#10;C1 2 0 100n"
            />
            <div className="mt-2 text-[10px] text-muted-foreground font-mono space-y-0.5">
              <div>R/L/C/V/I: NAME N+ N- VALUE • D: NAME A K [Is=] [N=]</div>
              <div>Q: NAME C B E [Bf=] [Is=] • M: NAME D G S [Vth=] [Kp=] [Lambda=]</div>
            </div>
          </div>

          {/* Analysis Type */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">ANALYSIS TYPE</div>
            <div className="flex gap-2 mb-4">
              {([["dc", "DC Op Point"], ["ac", "AC Sweep"], ["tran", "Transient"]] as const).map(([id, label]) => (
                <Button key={id} size="sm" onClick={() => setAnalysis(id)}
                  className={cn(analysis === id ? "bg-primary text-primary-foreground" : "bg-muted border border-border text-muted-foreground")}>
                  {label}
                </Button>
              ))}
            </div>

            {analysis === "ac" && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Start (Hz)</Label>
                  <Input type="number" value={acStart} onChange={(e) => setAcStart(parseFloat(e.target.value) || 10)} className="font-mono bg-muted border-border text-foreground mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Stop (Hz)</Label>
                  <Input type="number" value={acStop} onChange={(e) => setAcStop(parseFloat(e.target.value) || 1e6)} className="font-mono bg-muted border-border text-foreground mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Points</Label>
                  <Input type="number" value={acPoints} onChange={(e) => setAcPoints(parseInt(e.target.value) || 100)} className="font-mono bg-muted border-border text-foreground mt-1" />
                </div>
              </div>
            )}

            {analysis === "tran" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Stop Time (s)</Label>
                  <Input type="number" value={tranStop} onChange={(e) => setTranStop(parseFloat(e.target.value) || 0.01)} step="any" className="font-mono bg-muted border-border text-foreground mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time Step (s)</Label>
                  <Input type="number" value={tranStep} onChange={(e) => setTranStep(parseFloat(e.target.value) || 1e-5)} step="any" className="font-mono bg-muted border-border text-foreground mt-1" />
                </div>
              </div>
            )}
          </div>

          <Button onClick={runSimulation} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2">
            <Play size={16} /> RUN SIMULATION
          </Button>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results?.type === "dc" && (
            <div className="animate-fade-in space-y-4">
              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">DC OPERATING POINT</div>
                <div className="space-y-2">
                  {results.nodeVoltages.map((v: number, i: number) => (
                    i > 0 && (
                      <div key={i} className="flex justify-between items-center p-2 rounded bg-muted">
                        <span className="font-mono text-sm text-muted-foreground">Node {i}</span>
                        <span className="font-mono text-sm font-bold text-primary">{v.toFixed(4)} V</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">BRANCH CURRENTS</div>
                <div className="space-y-2">
                  {Array.from(results.branchCurrents.entries()).map(([name, current]: [string, any]) => (
                    <div key={name} className="flex justify-between items-center p-2 rounded bg-muted">
                      <span className="font-mono text-sm text-muted-foreground">{name}</span>
                      <span className="font-mono text-sm font-bold text-secondary">
                        {Math.abs(current) > 0.001 ? `${(current * 1000).toFixed(3)} mA` : `${(current * 1e6).toFixed(3)} μA`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {results?.type === "ac" && (
            <div className="animate-fade-in space-y-4">
              {/* Node Selector */}
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Probe Node:</span>
                {Array.from({ length: results.nodeCount - 1 }, (_, i) => i + 1).map((node) => (
                  <button key={node} onClick={() => setSelectedNode(node)}
                    className={cn("px-3 py-1 rounded text-xs font-mono border",
                      selectedNode === node ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"
                    )}>
                    N{node}
                  </button>
                ))}
              </div>

              {/* Magnitude Plot */}
              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">MAGNITUDE (dB) — Node {selectedNode}</div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={results.data.map((d: any) => ({
                    freq: d.freq,
                    mag: d.magnitude[selectedNode] || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      label={{ value: "Frequency (Hz)", position: "bottom", fill: "hsl(220 10% 50%)" }}
                      tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v.toFixed(0)} />
                    <YAxis tick={tickStyle} label={{ value: "dB", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} dB`} />
                    <Line type="monotone" dataKey="mag" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Phase Plot */}
              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">PHASE (°) — Node {selectedNode}</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={results.data.map((d: any) => ({
                    freq: d.freq,
                    phase: d.phase[selectedNode] || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]}
                      tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(0)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : v.toFixed(0)} />
                    <YAxis tick={tickStyle} label={{ value: "Phase (°)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}°`} />
                    <Line type="monotone" dataKey="phase" stroke="hsl(38 90% 55%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {results?.type === "tran" && (
            <div className="animate-fade-in space-y-4">
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Probe Node:</span>
                {Array.from({ length: results.data[0]?.nodeVoltages.length - 1 || 0 }, (_, i) => i + 1).map((node) => (
                  <button key={node} onClick={() => setSelectedNode(node)}
                    className={cn("px-3 py-1 rounded text-xs font-mono border",
                      selectedNode === node ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground"
                    )}>
                    N{node}
                  </button>
                ))}
              </div>

              <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
                <div className="text-xs font-mono text-muted-foreground mb-3">TRANSIENT WAVEFORM — Node {selectedNode}</div>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={results.data.map((d: any) => ({
                    time: d.time * 1000,
                    voltage: d.nodeVoltages[selectedNode] || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 16%)" />
                    <XAxis dataKey="time" tick={tickStyle}
                      label={{ value: "Time (ms)", position: "bottom", fill: "hsl(220 10% 50%)" }} />
                    <YAxis tick={tickStyle} label={{ value: "Voltage (V)", angle: -90, position: "insideLeft", fill: "hsl(220 10% 50%)" }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(4)} V`} />
                    <Line type="monotone" dataKey="voltage" stroke="hsl(142 100% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Quick Measurements */}
              {(() => {
                const voltages = results.data.map((d: any) => d.nodeVoltages[selectedNode] || 0);
                const vMax = Math.max(...voltages);
                const vMin = Math.min(...voltages);
                const vFinal = voltages[voltages.length - 1];
                const vPP = vMax - vMin;
                return (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">V_max</div>
                      <div className="font-mono text-sm font-bold text-primary">{vMax.toFixed(3)} V</div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">V_min</div>
                      <div className="font-mono text-sm font-bold text-secondary">{vMin.toFixed(3)} V</div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">V_pp</div>
                      <div className="font-mono text-sm font-bold text-accent">{vPP.toFixed(3)} V</div>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">V_final</div>
                      <div className="font-mono text-sm font-bold text-chart-4">{vFinal.toFixed(3)} V</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {!results && (
            <div className="p-12 rounded-xl bg-card border border-border text-center">
              <Cpu size={40} className="text-muted-foreground mx-auto mb-3 opacity-30" />
              <div className="text-muted-foreground text-sm">Enter a netlist and click RUN SIMULATION</div>
              <div className="text-xs text-muted-foreground mt-1">Supports R, L, C, V, I, D (diode), Q (BJT), M (MOSFET)</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpiceSimulator;

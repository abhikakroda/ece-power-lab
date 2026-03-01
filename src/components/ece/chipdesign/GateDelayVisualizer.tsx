import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2, RotateCcw } from "lucide-react";

type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "BUF";

interface Gate {
  id: string;
  type: GateType;
  inputs: string[]; // gate IDs or input names
  delay: number; // ps
  x: number;
  y: number;
}

interface TimingResult {
  gateId: string;
  arrival: number;
  required: number;
  slack: number;
  onCritical: boolean;
}

const gateDelays: Record<GateType, number> = {
  AND: 30, OR: 35, NOT: 15, NAND: 25, NOR: 28, XOR: 45, BUF: 10,
};

const gateSymbols: Record<GateType, string> = {
  AND: "&", OR: "≥1", NOT: "1", NAND: "&̄", NOR: "≥̄1", XOR: "⊕", BUF: "▷",
};

const presets = [
  {
    name: "Ripple Carry Adder",
    gates: [
      { id: "X1", type: "XOR" as GateType, inputs: ["A", "B"], delay: 45, x: 120, y: 40 },
      { id: "A1", type: "AND" as GateType, inputs: ["A", "B"], delay: 30, x: 120, y: 120 },
      { id: "X2", type: "XOR" as GateType, inputs: ["X1", "Cin"], delay: 45, x: 280, y: 40 },
      { id: "A2", type: "AND" as GateType, inputs: ["X1", "Cin"], delay: 30, x: 280, y: 120 },
      { id: "O1", type: "OR" as GateType, inputs: ["A1", "A2"], delay: 35, x: 420, y: 120 },
    ],
    inputs: ["A", "B", "Cin"],
    outputs: ["X2", "O1"],
  },
  {
    name: "2:1 MUX",
    gates: [
      { id: "N1", type: "NOT" as GateType, inputs: ["S"], delay: 15, x: 100, y: 30 },
      { id: "A1", type: "AND" as GateType, inputs: ["A", "N1"], delay: 30, x: 230, y: 40 },
      { id: "A2", type: "AND" as GateType, inputs: ["B", "S"], delay: 30, x: 230, y: 130 },
      { id: "O1", type: "OR" as GateType, inputs: ["A1", "A2"], delay: 35, x: 380, y: 85 },
    ],
    inputs: ["A", "B", "S"],
    outputs: ["O1"],
  },
  {
    name: "3-Input NAND Chain",
    gates: [
      { id: "N1", type: "NAND" as GateType, inputs: ["A", "B"], delay: 25, x: 120, y: 50 },
      { id: "N2", type: "NAND" as GateType, inputs: ["N1", "C"], delay: 25, x: 270, y: 70 },
      { id: "N3", type: "NAND" as GateType, inputs: ["N2", "A"], delay: 25, x: 420, y: 50 },
    ],
    inputs: ["A", "B", "C"],
    outputs: ["N3"],
  },
  {
    name: "Complex Datapath",
    gates: [
      { id: "A1", type: "AND" as GateType, inputs: ["A", "B"], delay: 30, x: 100, y: 30 },
      { id: "O1", type: "OR" as GateType, inputs: ["C", "D"], delay: 35, x: 100, y: 110 },
      { id: "X1", type: "XOR" as GateType, inputs: ["A1", "O1"], delay: 45, x: 250, y: 60 },
      { id: "N1", type: "NOT" as GateType, inputs: ["E"], delay: 15, x: 100, y: 190 },
      { id: "A2", type: "AND" as GateType, inputs: ["N1", "X1"], delay: 30, x: 400, y: 90 },
      { id: "O2", type: "OR" as GateType, inputs: ["A2", "O1"], delay: 35, x: 540, y: 110 },
    ],
    inputs: ["A", "B", "C", "D", "E"],
    outputs: ["O2"],
  },
];

const GateDelayVisualizer = () => {
  const [gates, setGates] = useState<Gate[]>(presets[0].gates);
  const [inputs, setInputs] = useState<string[]>(presets[0].inputs);
  const [outputs, setOutputs] = useState<string[]>(presets[0].outputs);
  const [clockPeriod, setClockPeriod] = useState(200); // ps
  const [selectedGate, setSelectedGate] = useState<string | null>(null);

  const loadPreset = (idx: number) => {
    const p = presets[idx];
    setGates(p.gates);
    setInputs(p.inputs);
    setOutputs(p.outputs);
    setSelectedGate(null);
  };

  // STA — compute arrival times (forward pass)
  const timing = useMemo(() => {
    const arrival: Record<string, number> = {};
    // Inputs arrive at t=0
    for (const inp of inputs) arrival[inp] = 0;

    // Topological order — iterate until stable
    const resolved = new Set(inputs);
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      for (const gate of gates) {
        if (resolved.has(gate.id)) continue;
        if (gate.inputs.every(i => resolved.has(i))) {
          const maxInput = Math.max(...gate.inputs.map(i => arrival[i] ?? 0));
          arrival[gate.id] = maxInput + gate.delay;
          resolved.add(gate.id);
          changed = true;
        }
      }
    }

    // Critical path — max arrival at outputs
    const maxArrival = Math.max(...outputs.map(o => arrival[o] ?? 0), 0);

    // Required times (backward pass)
    const required: Record<string, number> = {};
    for (const out of outputs) required[out] = clockPeriod;

    // Backward
    const revGates = [...gates].reverse();
    changed = true;
    iterations = 0;
    while (changed && iterations < 50) {
      changed = false;
      iterations++;
      for (const gate of revGates) {
        if (required[gate.id] === undefined) continue;
        const req = required[gate.id] - gate.delay;
        for (const inp of gate.inputs) {
          if (required[inp] === undefined || req < required[inp]) {
            required[inp] = req;
            changed = true;
          }
        }
      }
    }

    // Compute slack
    const results: TimingResult[] = gates.map(g => {
      const arr = arrival[g.id] ?? 0;
      const req = required[g.id] ?? clockPeriod;
      const slack = req - arr;
      return {
        gateId: g.id,
        arrival: arr,
        required: req,
        slack,
        onCritical: Math.abs(slack - (clockPeriod - maxArrival)) < 1,
      };
    });

    // Trace critical path
    const criticalPath: string[] = [];
    let current = outputs.reduce((best, o) => (arrival[o] ?? 0) > (arrival[best] ?? 0) ? o : best, outputs[0]);
    criticalPath.unshift(current);
    while (true) {
      const gate = gates.find(g => g.id === current);
      if (!gate) break;
      const worstInput = gate.inputs.reduce((best, i) => (arrival[i] ?? 0) > (arrival[best] ?? 0) ? i : best, gate.inputs[0]);
      criticalPath.unshift(worstInput);
      if (inputs.includes(worstInput)) break;
      current = worstInput;
    }

    const violated = maxArrival > clockPeriod;

    return { arrival, required, results, maxArrival, criticalPath, violated };
  }, [gates, inputs, outputs, clockPeriod]);

  const isOnCritical = (id: string) => timing.criticalPath.includes(id);

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap">
        {presets.map((p, i) => (
          <button key={p.name} onClick={() => loadPreset(i)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
            {p.name}
          </button>
        ))}
      </div>

      {/* Clock period control */}
      <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-4">
        <span className="text-[10px] font-mono text-muted-foreground">Clock Period:</span>
        <input type="range" min={50} max={500} step={5} value={clockPeriod}
          onChange={e => setClockPeriod(parseInt(e.target.value))}
          className="flex-1 accent-[hsl(var(--primary))]" />
        <span className={cn("text-xs font-mono font-bold", timing.violated ? "text-destructive" : "text-primary")}>
          {clockPeriod} ps
        </span>
      </div>

      {/* Timing status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={cn("p-3 rounded-lg border text-center col-span-1",
          timing.violated ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
        )}>
          <div className={cn("text-sm font-mono font-bold", timing.violated ? "text-destructive" : "text-primary")}>
            {timing.violated ? "✗ VIOLATION" : "✓ MET"}
          </div>
          <div className="text-[9px] text-muted-foreground">Timing</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-3">{timing.maxArrival.toFixed(0)} ps</div>
          <div className="text-[9px] text-muted-foreground">Critical Path</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          (clockPeriod - timing.maxArrival) < 0 ? "border-destructive/20" : "border-primary/20"
        )}>
          <div className={cn("text-sm font-mono font-bold",
            (clockPeriod - timing.maxArrival) < 0 ? "text-destructive" : "text-primary"
          )}>{(clockPeriod - timing.maxArrival).toFixed(0)} ps</div>
          <div className="text-[9px] text-muted-foreground">Slack</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-2">{(1000 / clockPeriod).toFixed(1)} GHz</div>
          <div className="text-[9px] text-muted-foreground">Max Freq</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-4">{gates.length}</div>
          <div className="text-[9px] text-muted-foreground">Gates</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Circuit SVG */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
          <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Circuit Layout</div>
          <svg viewBox="0 0 640 260" className="w-full" style={{ minHeight: 240 }}>
            {/* Connections */}
            {gates.map(gate =>
              gate.inputs.map((inp, ii) => {
                const srcGate = gates.find(g => g.id === inp);
                const srcX = srcGate ? srcGate.x + 50 : 20;
                const srcY = srcGate ? srcGate.y + 20 : gate.y + 12 + ii * 16;
                const dstX = gate.x;
                const dstY = gate.y + 12 + ii * 16;
                const midX = (srcX + dstX) / 2;
                const onCrit = isOnCritical(inp) && isOnCritical(gate.id);
                return (
                  <g key={`${gate.id}-${inp}`}>
                    <path d={`M${srcX},${srcY} C${midX},${srcY} ${midX},${dstY} ${dstX},${dstY}`}
                      fill="none"
                      stroke={onCrit ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
                      strokeWidth={onCrit ? 2.5 : 1}
                      strokeDasharray={onCrit ? "0" : "3 3"}
                      opacity={onCrit ? 1 : 0.4}
                    />
                    {/* Input label */}
                    {inputs.includes(inp) && (
                      <text x={srcX - 4} y={srcY - 6} textAnchor="end"
                        fill="hsl(var(--chart-2))" fontSize={9} fontFamily="monospace" fontWeight="bold">
                        {inp}
                      </text>
                    )}
                  </g>
                );
              })
            )}

            {/* Gates */}
            {gates.map(gate => {
              const onCrit = isOnCritical(gate.id);
              const sel = selectedGate === gate.id;
              const arr = timing.arrival[gate.id] ?? 0;
              const result = timing.results.find(r => r.gateId === gate.id);

              return (
                <g key={gate.id} onClick={() => setSelectedGate(sel ? null : gate.id)} className="cursor-pointer">
                  {/* Gate body */}
                  <rect x={gate.x} y={gate.y} width={50} height={40} rx={4}
                    fill={onCrit ? "hsl(var(--destructive) / 0.15)" : sel ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))"}
                    stroke={onCrit ? "hsl(var(--destructive))" : sel ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={onCrit || sel ? 2 : 1}
                  />
                  {/* Gate type */}
                  <text x={gate.x + 25} y={gate.y + 18} textAnchor="middle"
                    fill={onCrit ? "hsl(var(--destructive))" : "hsl(var(--foreground))"}
                    fontSize={10} fontFamily="monospace" fontWeight="bold">
                    {gate.type}
                  </text>
                  {/* Gate ID */}
                  <text x={gate.x + 25} y={gate.y + 32} textAnchor="middle"
                    fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="monospace">
                    {gate.id}
                  </text>
                  {/* Delay label */}
                  <text x={gate.x + 25} y={gate.y - 4} textAnchor="middle"
                    fill={onCrit ? "hsl(var(--destructive))" : "hsl(var(--chart-3))"}
                    fontSize={8} fontFamily="monospace">
                    {gate.delay}ps
                  </text>
                  {/* Arrival time */}
                  <text x={gate.x + 52} y={gate.y + 50} textAnchor="start"
                    fill="hsl(var(--chart-4))" fontSize={7} fontFamily="monospace">
                    arr={arr.toFixed(0)}
                  </text>
                  {/* Slack */}
                  {result && (
                    <text x={gate.x + 52} y={gate.y + 58} textAnchor="start"
                      fill={result.slack < 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                      fontSize={7} fontFamily="monospace">
                      slk={result.slack.toFixed(0)}
                    </text>
                  )}
                  {/* Output label */}
                  {outputs.includes(gate.id) && (
                    <text x={gate.x + 56} y={gate.y + 22} textAnchor="start"
                      fill="hsl(var(--chart-3))" fontSize={9} fontFamily="monospace" fontWeight="bold">
                      → OUT
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Critical path */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Critical Path</div>
            <div className="flex flex-wrap gap-1 items-center">
              {timing.criticalPath.map((id, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold border",
                    inputs.includes(id) ? "border-chart-2/30 text-chart-2 bg-chart-2/10" :
                    "border-destructive/30 text-destructive bg-destructive/10"
                  )}>{id}</span>
                  {i < timing.criticalPath.length - 1 && <span className="text-muted-foreground text-[10px]">→</span>}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[10px] font-mono text-chart-3">
              Total: {timing.maxArrival.toFixed(0)} ps ({timing.criticalPath.filter(id => !inputs.includes(id)).length} gates)
            </div>
          </div>

          {/* Gate timing table */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Static Timing Analysis</div>
            <div className="space-y-1">
              <div className="flex gap-2 text-[8px] font-mono text-muted-foreground/60 uppercase">
                <span className="w-10">Gate</span>
                <span className="w-10">Type</span>
                <span className="w-12">Delay</span>
                <span className="w-12">Arrival</span>
                <span className="w-12">Req'd</span>
                <span className="w-10">Slack</span>
              </div>
              {timing.results.map(r => {
                const gate = gates.find(g => g.id === r.gateId)!;
                return (
                  <div key={r.gateId} className={cn(
                    "flex gap-2 text-[10px] font-mono py-0.5 rounded px-1",
                    isOnCritical(r.gateId) ? "bg-destructive/5" : "",
                    selectedGate === r.gateId ? "bg-primary/10" : ""
                  )} onClick={() => setSelectedGate(r.gateId)}>
                    <span className="w-10 text-foreground font-bold">{r.gateId}</span>
                    <span className="w-10 text-muted-foreground">{gate.type}</span>
                    <span className="w-12 text-chart-4">{gate.delay}ps</span>
                    <span className="w-12 text-chart-3">{r.arrival.toFixed(0)}</span>
                    <span className="w-12 text-chart-2">{r.required.toFixed(0)}</span>
                    <span className={cn("w-10 font-bold",
                      r.slack < 0 ? "text-destructive" : r.slack < 20 ? "text-chart-3" : "text-primary"
                    )}>{r.slack.toFixed(0)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gate info */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Gate Delays Reference</div>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(gateDelays) as [GateType, number][]).map(([type, delay]) => (
                <div key={type} className="p-1.5 rounded border border-border text-center">
                  <div className="text-[10px] font-mono font-bold text-foreground">{type}</div>
                  <div className="text-[9px] font-mono text-chart-4">{delay}ps</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GateDelayVisualizer;

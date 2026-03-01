import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Play } from "lucide-react";

type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "INPUT" | "OUTPUT";

interface Gate {
  id: string;
  type: GateType;
  x: number;
  y: number;
  label?: string;
  value?: number;
}

interface Wire {
  id: string;
  fromGate: string;
  fromPort: "out";
  toGate: string;
  toPort: "a" | "b";
}

const GATE_W = 80;
const GATE_H = 56;
const GRID = 20;

const snap = (v: number) => Math.round(v / GRID) * GRID;

const evalGate = (type: GateType, a: number, b: number): number => {
  switch (type) {
    case "AND": return a & b;
    case "OR": return a | b;
    case "NOT": return a ? 0 : 1;
    case "NAND": return (a & b) ? 0 : 1;
    case "NOR": return (a | b) ? 0 : 1;
    case "XOR": return a ^ b;
    default: return a;
  }
};

const getInputPos = (gate: Gate, port: "a" | "b"): { x: number; y: number } => {
  if (gate.type === "NOT" || gate.type === "OUTPUT") return { x: gate.x, y: gate.y + GATE_H / 2 };
  return port === "a" ? { x: gate.x, y: gate.y + 16 } : { x: gate.x, y: gate.y + GATE_H - 16 };
};

const getOutputPos = (gate: Gate): { x: number; y: number } => {
  return { x: gate.x + GATE_W, y: gate.y + GATE_H / 2 };
};

let idCounter = 0;
const uid = () => `g${++idCounter}`;

const palette: { type: GateType; label: string }[] = [
  { type: "INPUT", label: "IN" },
  { type: "AND", label: "AND" },
  { type: "OR", label: "OR" },
  { type: "NOT", label: "NOT" },
  { type: "NAND", label: "NAND" },
  { type: "NOR", label: "NOR" },
  { type: "XOR", label: "XOR" },
  { type: "OUTPUT", label: "OUT" },
];

const LogicBuilder = () => {
  const [gates, setGates] = useState<Gate[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [wiring, setWiring] = useState<{ fromGate: string; mx: number; my: number } | null>(null);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, number>>({});
  const svgRef = useRef<SVGSVGElement>(null);

  const SVG_W = 900;
  const SVG_H = 500;

  // Propagate values through circuit
  const computedValues = useMemo(() => {
    const vals: Record<string, number> = {};
    // Set input gates
    gates.forEach((g) => {
      if (g.type === "INPUT") vals[g.id] = inputValues[g.id] ?? 0;
    });
    // Topological pass (max 20 iterations for cycles)
    for (let iter = 0; iter < 20; iter++) {
      let changed = false;
      gates.forEach((g) => {
        if (g.type === "INPUT") return;
        const inputWires = wires.filter((w) => w.toGate === g.id);
        const aWire = inputWires.find((w) => w.toPort === "a");
        const bWire = inputWires.find((w) => w.toPort === "b");
        const aVal = aWire ? (vals[aWire.fromGate] ?? 0) : 0;
        const bVal = bWire ? (vals[bWire.fromGate] ?? 0) : 0;
        const newVal = g.type === "OUTPUT" ? aVal : evalGate(g.type, aVal, bVal);
        if (vals[g.id] !== newVal) {
          vals[g.id] = newVal;
          changed = true;
        }
      });
      if (!changed) break;
    }
    return vals;
  }, [gates, wires, inputValues]);

  // Truth table for inputs
  const truthTable = useMemo(() => {
    const inputs = gates.filter((g) => g.type === "INPUT");
    const outputs = gates.filter((g) => g.type === "OUTPUT");
    if (inputs.length === 0 || outputs.length === 0 || inputs.length > 4) return [];

    const rows: { inputs: Record<string, number>; outputs: Record<string, number> }[] = [];
    const n = inputs.length;
    for (let i = 0; i < (1 << n); i++) {
      const inputSet: Record<string, number> = {};
      inputs.forEach((inp, idx) => {
        inputSet[inp.id] = (i >> (n - 1 - idx)) & 1;
      });
      // Compute with these inputs
      const vals: Record<string, number> = { ...inputSet };
      for (let iter = 0; iter < 20; iter++) {
        let changed = false;
        gates.forEach((g) => {
          if (g.type === "INPUT") return;
          const iw = wires.filter((w) => w.toGate === g.id);
          const aw = iw.find((w) => w.toPort === "a");
          const bw = iw.find((w) => w.toPort === "b");
          const av = aw ? (vals[aw.fromGate] ?? 0) : 0;
          const bv = bw ? (vals[bw.fromGate] ?? 0) : 0;
          const nv = g.type === "OUTPUT" ? av : evalGate(g.type, av, bv);
          if (vals[g.id] !== nv) { vals[g.id] = nv; changed = true; }
        });
        if (!changed) break;
      }
      const outputSet: Record<string, number> = {};
      outputs.forEach((o) => { outputSet[o.id] = vals[o.id] ?? 0; });
      rows.push({ inputs: inputSet, outputs: outputSet });
    }
    return rows;
  }, [gates, wires]);

  const getSvgPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const addGate = (type: GateType) => {
    const inputCount = gates.filter((g) => g.type === "INPUT").length;
    const outputCount = gates.filter((g) => g.type === "OUTPUT").length;
    const label = type === "INPUT" ? String.fromCharCode(65 + inputCount) : type === "OUTPUT" ? `Y${outputCount}` : undefined;
    const g: Gate = { id: uid(), type, x: snap(100 + gates.length * 40), y: snap(100 + (gates.length % 4) * 80), label };
    setGates((p) => [...p, g]);
    if (type === "INPUT") setInputValues((p) => ({ ...p, [g.id]: 0 }));
  };

  const handleMouseDown = (e: React.MouseEvent, gateId: string) => {
    e.stopPropagation();
    const pt = getSvgPoint(e);
    const gate = gates.find((g) => g.id === gateId)!;
    setSelectedGate(gateId);
    setDragging({ id: gateId, ox: pt.x - gate.x, oy: pt.y - gate.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const pt = getSvgPoint(e);
      setGates((prev) => prev.map((g) =>
        g.id === dragging.id ? { ...g, x: snap(pt.x - dragging.ox), y: snap(pt.y - dragging.oy) } : g
      ));
    }
    if (wiring) {
      const pt = getSvgPoint(e);
      setWiring((p) => p ? { ...p, mx: pt.x, my: pt.y } : null);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const startWire = (e: React.MouseEvent, gateId: string) => {
    e.stopPropagation();
    const pt = getSvgPoint(e);
    setWiring({ fromGate: gateId, mx: pt.x, my: pt.y });
  };

  const endWire = (e: React.MouseEvent, gateId: string, port: "a" | "b") => {
    e.stopPropagation();
    if (!wiring) return;
    if (wiring.fromGate === gateId) return;
    // Don't duplicate
    const exists = wires.some((w) => w.toGate === gateId && w.toPort === port);
    if (exists) return;
    setWires((p) => [...p, { id: uid(), fromGate: wiring.fromGate, fromPort: "out", toGate: gateId, toPort: port }]);
    setWiring(null);
  };

  const cancelWire = () => setWiring(null);

  const deleteSelected = () => {
    if (!selectedGate) return;
    setGates((p) => p.filter((g) => g.id !== selectedGate));
    setWires((p) => p.filter((w) => w.fromGate !== selectedGate && w.toGate !== selectedGate));
    setSelectedGate(null);
  };

  const clearAll = () => {
    setGates([]);
    setWires([]);
    setInputValues({});
    setSelectedGate(null);
  };

  const toggleInput = (id: string) => {
    setInputValues((p) => ({ ...p, [id]: p[id] ? 0 : 1 }));
  };

  const inputGates = gates.filter((g) => g.type === "INPUT");
  const outputGates = gates.filter((g) => g.type === "OUTPUT");

  // Timing diagram
  const [showTiming, setShowTiming] = useState(false);

  return (
    <div className="space-y-4">
      {/* Palette */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono mr-1">DRAG TO ADD:</span>
        {palette.map((p) => (
          <button key={p.type} onClick={() => addGate(p.type)}
            className="px-3 py-2 rounded-lg text-xs font-mono font-bold border border-border bg-card text-muted-foreground hover:text-foreground hover:border-chart-2/40 transition-all">
            + {p.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={deleteSelected} disabled={!selectedGate}
          className="text-destructive hover:text-destructive">
          <Trash2 size={14} /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={clearAll}>
          <RotateCcw size={14} /> Clear
        </Button>
      </div>

      {/* Canvas */}
      <div className="rounded-xl bg-card border border-border oscilloscope-border overflow-hidden">
        <div className="text-xs font-mono text-muted-foreground px-4 py-2 border-b border-border flex items-center gap-4">
          <span>LOGIC BUILDER</span>
          <span className="text-[10px]">Click output port → click input port to wire • Click gate to select • Drag to move</span>
        </div>
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          className="w-full cursor-crosshair"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => { cancelWire(); setSelectedGate(null); }}
        >
          {/* Grid */}
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
            </pattern>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="hsl(var(--background))" />
          <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

          {/* Wires */}
          {wires.map((w) => {
            const fromG = gates.find((g) => g.id === w.fromGate);
            const toG = gates.find((g) => g.id === w.toGate);
            if (!fromG || !toG) return null;
            const from = getOutputPos(fromG);
            const to = getInputPos(toG, w.toPort);
            const val = computedValues[w.fromGate] ?? 0;
            const midX = (from.x + to.x) / 2;
            return (
              <path key={w.id}
                d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                fill="none" stroke={val ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeWidth={val ? 2.5 : 1.5}
                className="transition-colors" opacity={val ? 1 : 0.5}
              />
            );
          })}

          {/* Active wiring */}
          {wiring && (() => {
            const fromG = gates.find((g) => g.id === wiring.fromGate);
            if (!fromG) return null;
            const from = getOutputPos(fromG);
            return <line x1={from.x} y1={from.y} x2={wiring.mx} y2={wiring.my} stroke="hsl(var(--chart-2))" strokeWidth="2" strokeDasharray="6 3" />;
          })()}

          {/* Gates */}
          {gates.map((gate) => {
            const val = computedValues[gate.id] ?? 0;
            const isSelected = selectedGate === gate.id;
            const isInput = gate.type === "INPUT";
            const isOutput = gate.type === "OUTPUT";
            const isNot = gate.type === "NOT";

            return (
              <g key={gate.id} onMouseDown={(e) => handleMouseDown(e, gate.id)} className="cursor-grab">
                {/* Gate body */}
                <rect x={gate.x} y={gate.y} width={GATE_W} height={GATE_H} rx={8}
                  fill={val ? "hsl(var(--primary) / 0.12)" : "hsl(var(--card))"}
                  stroke={isSelected ? "hsl(var(--chart-2))" : val ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))"}
                  strokeWidth={isSelected ? 2 : 1.5} className="transition-colors" />

                {/* Label */}
                <text x={gate.x + GATE_W / 2} y={gate.y + GATE_H / 2 - 4}
                  textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fontWeight="700"
                  fill={val ? "hsl(var(--primary))" : "hsl(var(--foreground))"}>
                  {isInput ? gate.label : isOutput ? gate.label : gate.type}
                </text>
                <text x={gate.x + GATE_W / 2} y={gate.y + GATE_H / 2 + 12}
                  textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono"
                  fill={val ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}>
                  {val}
                </text>

                {/* Input toggle for INPUT gates */}
                {isInput && (
                  <rect x={gate.x + 2} y={gate.y + 2} width={GATE_W - 4} height={GATE_H - 4} rx={6}
                    fill="transparent" className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleInput(gate.id); }} />
                )}

                {/* Output port (right) */}
                {!isOutput && (
                  <circle cx={gate.x + GATE_W} cy={gate.y + GATE_H / 2} r={5}
                    fill={val ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"}
                    stroke="hsl(var(--border))" strokeWidth="1"
                    className="cursor-pointer hover:scale-125"
                    onMouseDown={(e) => startWire(e, gate.id)} />
                )}

                {/* Input ports (left) */}
                {!isInput && (
                  <>
                    {(isNot || isOutput) ? (
                      <circle cx={gate.x} cy={gate.y + GATE_H / 2} r={5}
                        fill="hsl(var(--muted-foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1"
                        className="cursor-pointer hover:scale-125"
                        onClick={(e) => endWire(e, gate.id, "a")} />
                    ) : (
                      <>
                        <circle cx={gate.x} cy={gate.y + 16} r={5}
                          fill="hsl(var(--muted-foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1"
                          className="cursor-pointer hover:scale-125"
                          onClick={(e) => endWire(e, gate.id, "a")} />
                        <text x={gate.x - 10} y={gate.y + 20} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">A</text>
                        <circle cx={gate.x} cy={gate.y + GATE_H - 16} r={5}
                          fill="hsl(var(--muted-foreground) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1"
                          className="cursor-pointer hover:scale-125"
                          onClick={(e) => endWire(e, gate.id, "b")} />
                        <text x={gate.x - 10} y={gate.y + GATE_H - 12} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">B</text>
                      </>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live outputs + input toggles */}
      {(inputGates.length > 0 || outputGates.length > 0) && (
        <div className="flex gap-4 flex-wrap">
          {inputGates.map((g) => (
            <button key={g.id} onClick={() => toggleInput(g.id)}
              className={cn("px-5 py-3 rounded-lg font-mono font-bold border transition-all",
                inputValues[g.id] ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"
              )}>
              {g.label} = {inputValues[g.id] ?? 0}
            </button>
          ))}
          {outputGates.map((g) => {
            const v = computedValues[g.id] ?? 0;
            return (
              <div key={g.id} className={cn("px-5 py-3 rounded-lg font-mono font-bold border transition-all",
                v ? "bg-primary/10 border-primary/30 text-primary text-glow" : "bg-muted border-border text-muted-foreground"
              )}>
                {g.label} = {v}
              </div>
            );
          })}
        </div>
      )}

      {/* Truth Table */}
      {truthTable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">LIVE TRUTH TABLE</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {inputGates.map((g) => (
                    <th key={g.id} className="py-2 px-3 text-center text-xs font-mono text-chart-2">{g.label}</th>
                  ))}
                  {outputGates.map((g) => (
                    <th key={g.id} className="py-2 px-3 text-center text-xs font-mono text-primary">{g.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {truthTable.map((row, i) => {
                  const isActive = inputGates.every((g) => row.inputs[g.id] === (inputValues[g.id] ?? 0));
                  return (
                    <tr key={i} className={cn("border-b border-border/50 transition-colors", isActive && "bg-primary/5")}>
                      {inputGates.map((g) => (
                        <td key={g.id} className={cn("py-2 px-3 text-center font-mono", row.inputs[g.id] ? "text-chart-2" : "text-muted-foreground")}>{row.inputs[g.id]}</td>
                      ))}
                      {outputGates.map((g) => (
                        <td key={g.id} className={cn("py-2 px-3 text-center font-mono font-bold", row.outputs[g.id] ? "text-primary text-glow" : "text-muted-foreground")}>{row.outputs[g.id]}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Timing Diagram */}
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">TIMING DIAGRAM</div>
            <svg width="100%" viewBox={`0 0 ${truthTable.length * 40 + 60} ${(inputGates.length + outputGates.length) * 45 + 20}`}>
              {[...inputGates, ...outputGates].map((g, si) => {
                const isOut = g.type === "OUTPUT";
                const yOff = si * 45 + 10;
                const values = truthTable.map((r) => isOut ? r.outputs[g.id] : r.inputs[g.id]);
                const color = isOut ? "hsl(var(--primary))" : "hsl(var(--chart-2))";
                let path = `M 50 ${yOff + (values[0] ? 5 : 30)}`;
                values.forEach((v, i) => {
                  const x = 50 + i * 40;
                  const xn = 50 + (i + 1) * 40;
                  const y = yOff + (v ? 5 : 30);
                  path += ` L ${xn} ${y}`;
                  if (i < values.length - 1) {
                    const yNext = yOff + (values[i + 1] ? 5 : 30);
                    path += ` L ${xn} ${yNext}`;
                  }
                });
                return (
                  <g key={g.id}>
                    <text x="5" y={yOff + 20} fill={color} fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">{g.label}</text>
                    <path d={path} fill="none" stroke={color} strokeWidth="2" />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {gates.length === 0 && (
        <div className="p-12 rounded-xl bg-card border border-border text-center">
          <div className="text-muted-foreground mb-2">Add INPUT and OUTPUT gates, then connect logic gates between them</div>
          <div className="text-xs text-muted-foreground">Click output port (right) → click input port (left) to wire</div>
        </div>
      )}
    </div>
  );
};

export default LogicBuilder;

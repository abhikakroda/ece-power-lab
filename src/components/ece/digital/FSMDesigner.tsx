import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, RotateCcw, Play, StepForward } from "lucide-react";

interface FSMState {
  id: string;
  name: string;
  x: number;
  y: number;
  output: string;
}

interface Transition {
  id: string;
  from: string;
  to: string;
  input: string;
  output?: string;
}

let fsmId = 0;
const uid = () => `s${++fsmId}`;

const STATE_R = 36;
const SVG_W = 800;
const SVG_H = 420;

type Mode = "select" | "state" | "transition";

const FSMDesigner = () => {
  const [states, setStates] = useState<FSMState[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [mode, setMode] = useState<Mode>("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [transStart, setTransStart] = useState<string | null>(null);
  const [editingTrans, setEditingTrans] = useState<{ id: string; input: string } | null>(null);
  const [initialState, setInitialState] = useState<string | null>(null);

  // Simulation
  const [simInput, setSimInput] = useState("");
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simHistory, setSimHistory] = useState<{ state: string; input: string; output: string }[]>([]);
  const [currentState, setCurrentState] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgPt = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (mode === "state") {
      const pt = getSvgPt(e);
      const s: FSMState = { id: uid(), name: `S${states.length}`, x: pt.x, y: pt.y, output: states.length === 0 ? "0" : "0" };
      setStates((p) => [...p, s]);
      if (states.length === 0) setInitialState(s.id);
    } else if (mode === "select") {
      setSelected(null);
      setTransStart(null);
    }
  };

  const handleStateClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === "transition") {
      if (!transStart) {
        setTransStart(id);
      } else {
        const input = prompt("Transition input (e.g., 0 or 1):", "0") ?? "0";
        const output = prompt("Transition output (optional, e.g., 0 or 1):", "") ?? "";
        setTransitions((p) => [...p, { id: uid(), from: transStart, to: id, input, output }]);
        setTransStart(null);
      }
    } else {
      setSelected(id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (mode !== "select") return;
    e.stopPropagation();
    const pt = getSvgPt(e);
    const s = states.find((st) => st.id === id)!;
    setDragging({ id, ox: pt.x - s.x, oy: pt.y - s.y });
    setSelected(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const pt = getSvgPt(e);
    setStates((prev) => prev.map((s) =>
      s.id === dragging.id ? { ...s, x: pt.x - dragging.ox, y: pt.y - dragging.oy } : s
    ));
  };

  const handleMouseUp = () => setDragging(null);

  const deleteSelected = () => {
    if (!selected) return;
    setStates((p) => p.filter((s) => s.id !== selected));
    setTransitions((p) => p.filter((t) => t.from !== selected && t.to !== selected));
    if (initialState === selected) setInitialState(states.find((s) => s.id !== selected)?.id ?? null);
    setSelected(null);
  };

  const clearAll = () => {
    setStates([]); setTransitions([]); setSelected(null); setInitialState(null);
    stopSim();
  };

  const setAsInitial = () => { if (selected) setInitialState(selected); };

  const renameState = () => {
    if (!selected) return;
    const s = states.find((st) => st.id === selected);
    if (!s) return;
    const name = prompt("State name:", s.name);
    if (name) setStates((p) => p.map((st) => st.id === selected ? { ...st, name } : st));
  };

  const setStateOutput = () => {
    if (!selected) return;
    const s = states.find((st) => st.id === selected);
    if (!s) return;
    const output = prompt("Moore output for this state:", s.output);
    if (output !== null) setStates((p) => p.map((st) => st.id === selected ? { ...st, output } : st));
  };

  // Simulation
  const startSim = () => {
    if (!initialState || simInput.length === 0) return;
    setSimRunning(true);
    setSimStep(0);
    setCurrentState(initialState);
    setSimHistory([]);
  };

  const stepSim = () => {
    if (!simRunning || !currentState || simStep >= simInput.length) {
      setSimRunning(false);
      return;
    }
    const inp = simInput[simStep];
    const trans = transitions.find((t) => t.from === currentState && t.input === inp);
    const st = states.find((s) => s.id === currentState);
    if (trans) {
      const nextState = trans.to;
      const nextSt = states.find((s) => s.id === nextState);
      setSimHistory((p) => [...p, {
        state: st?.name ?? "?",
        input: inp,
        output: trans.output || nextSt?.output || "—"
      }]);
      setCurrentState(nextState);
      setSimStep((p) => p + 1);
    } else {
      setSimHistory((p) => [...p, { state: st?.name ?? "?", input: inp, output: "✗" }]);
      setSimStep((p) => p + 1);
    }
  };

  const runAll = () => {
    if (!initialState) return;
    let cur = initialState;
    const hist: { state: string; input: string; output: string }[] = [];
    for (let i = 0; i < simInput.length; i++) {
      const inp = simInput[i];
      const st = states.find((s) => s.id === cur);
      const trans = transitions.find((t) => t.from === cur && t.input === inp);
      if (trans) {
        const nextSt = states.find((s) => s.id === trans.to);
        hist.push({ state: st?.name ?? "?", input: inp, output: trans.output || nextSt?.output || "—" });
        cur = trans.to;
      } else {
        hist.push({ state: st?.name ?? "?", input: inp, output: "✗" });
      }
    }
    setSimHistory(hist);
    setCurrentState(cur);
    setSimStep(simInput.length);
    setSimRunning(false);
  };

  const stopSim = () => {
    setSimRunning(false);
    setSimStep(0);
    setCurrentState(null);
    setSimHistory([]);
  };

  // Render transition arrow
  const renderTransition = (t: Transition) => {
    const fromS = states.find((s) => s.id === t.from);
    const toS = states.find((s) => s.id === t.to);
    if (!fromS || !toS) return null;

    const isSelf = t.from === t.to;
    const isActive = simRunning && currentState === t.from;

    if (isSelf) {
      return (
        <g key={t.id}>
          <path d={`M ${fromS.x - 12} ${fromS.y - STATE_R} Q ${fromS.x - 30} ${fromS.y - STATE_R - 50} ${fromS.x + 12} ${fromS.y - STATE_R}`}
            fill="none" stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeWidth={isActive ? 2.5 : 1.5}
            markerEnd="url(#arrow)" />
          <text x={fromS.x} y={fromS.y - STATE_R - 30}
            textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono"
            fill="hsl(var(--chart-2))">{t.input}{t.output ? `/${t.output}` : ""}</text>
        </g>
      );
    }

    const dx = toS.x - fromS.x;
    const dy = toS.y - fromS.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const x1 = fromS.x + nx * STATE_R;
    const y1 = fromS.y + ny * STATE_R;
    const x2 = toS.x - nx * (STATE_R + 6);
    const y2 = toS.y - ny * (STATE_R + 6);

    // Offset for bidirectional
    const reverse = transitions.some((tr) => tr.from === t.to && tr.to === t.from);
    const offsetX = reverse ? -ny * 8 : 0;
    const offsetY = reverse ? nx * 8 : 0;

    return (
      <g key={t.id}>
        <line x1={x1 + offsetX} y1={y1 + offsetY} x2={x2 + offsetX} y2={y2 + offsetY}
          stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} strokeWidth={isActive ? 2.5 : 1.5}
          markerEnd="url(#arrow)" />
        <text x={(x1 + x2) / 2 + offsetX - ny * 12} y={(y1 + y2) / 2 + offsetY + nx * 12}
          textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono"
          fill="hsl(var(--chart-2))">{t.input}{t.output ? `/${t.output}` : ""}</text>
      </g>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["select", "state", "transition"] as Mode[]).map((m) => (
          <button key={m} onClick={() => { setMode(m); setTransStart(null); }}
            className={cn("px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-all capitalize",
              mode === m ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
            )}>
            {m === "state" ? "➕ Add State" : m === "transition" ? "➡ Add Transition" : "🖱 Select"}
          </button>
        ))}
        <div className="flex-1" />
        {selected && (
          <>
            <Button size="sm" variant="ghost" onClick={renameState} className="text-xs font-mono">Rename</Button>
            <Button size="sm" variant="ghost" onClick={setStateOutput} className="text-xs font-mono">Set Output</Button>
            <Button size="sm" variant="ghost" onClick={setAsInitial} className="text-xs font-mono">Set Initial</Button>
            <Button size="sm" variant="ghost" onClick={deleteSelected} className="text-destructive text-xs"><Trash2 size={14} /></Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={clearAll}><RotateCcw size={14} /> Clear</Button>
      </div>

      {/* Canvas */}
      <div className="rounded-xl bg-card border border-border oscilloscope-border overflow-hidden">
        <div className="text-xs font-mono text-muted-foreground px-4 py-2 border-b border-border flex gap-4">
          <span>FSM DESIGNER</span>
          {mode === "state" && <span className="text-chart-2">Click canvas to place state</span>}
          {mode === "transition" && <span className="text-chart-2">{transStart ? "Click destination state" : "Click source state"}</span>}
        </div>
        <svg ref={svgRef} width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full" onClick={handleCanvasClick}
          onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground))" />
            </marker>
          </defs>
          <rect width={SVG_W} height={SVG_H} fill="hsl(var(--background))" />

          {/* Transitions */}
          {transitions.map(renderTransition)}

          {/* States */}
          {states.map((s) => {
            const isInit = s.id === initialState;
            const isSel = s.id === selected;
            const isActive = currentState === s.id;
            return (
              <g key={s.id} onMouseDown={(e) => handleMouseDown(e, s.id)}
                onClick={(e) => handleStateClick(e, s.id)} className="cursor-pointer">
                {isInit && (
                  <polygon points={`${s.x - STATE_R - 18},${s.y} ${s.x - STATE_R - 6},${s.y - 6} ${s.x - STATE_R - 6},${s.y + 6}`}
                    fill="hsl(var(--chart-2))" />
                )}
                <circle cx={s.x} cy={s.y} r={STATE_R}
                  fill={isActive ? "hsl(var(--primary) / 0.2)" : "hsl(var(--card))"}
                  stroke={isSel ? "hsl(var(--chart-2))" : isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isSel || isActive ? 2.5 : 1.5} />
                {isInit && <circle cx={s.x} cy={s.y} r={STATE_R - 4} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />}
                <text x={s.x} y={s.y - 4} textAnchor="middle" fontSize="13" fontFamily="JetBrains Mono" fontWeight="bold"
                  fill={isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))"}>{s.name}</text>
                <text x={s.x} y={s.y + 14} textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono"
                  fill="hsl(var(--muted-foreground))">/{s.output}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Simulation */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border space-y-3">
        <div className="text-xs font-mono text-muted-foreground">SIMULATE SEQUENCE</div>
        <div className="flex gap-3 items-center">
          <Input value={simInput} onChange={(e) => setSimInput(e.target.value.replace(/[^01]/g, ""))}
            placeholder="Enter binary sequence: 01101001"
            className="font-mono bg-muted border-border text-foreground flex-1" />
          <Button size="sm" onClick={runAll} disabled={states.length === 0 || !initialState}
            className="bg-chart-2 text-primary-foreground hover:bg-chart-2/80 font-mono">
            <Play size={14} /> Run All
          </Button>
          <Button size="sm" variant="outline" onClick={simRunning ? stepSim : startSim}
            disabled={states.length === 0 || !initialState}>
            <StepForward size={14} /> Step
          </Button>
          {simRunning && <Button size="sm" variant="ghost" onClick={stopSim}>Stop</Button>}
        </div>

        {simHistory.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-2">STATE TRACE</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 px-2 text-left text-xs font-mono text-muted-foreground">Step</th>
                    <th className="py-1 px-2 text-left text-xs font-mono text-chart-2">State</th>
                    <th className="py-1 px-2 text-left text-xs font-mono text-muted-foreground">Input</th>
                    <th className="py-1 px-2 text-left text-xs font-mono text-primary">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {simHistory.map((h, i) => (
                    <tr key={i} className={cn("border-b border-border/50", i === simStep - 1 && simRunning && "bg-primary/5")}>
                      <td className="py-1 px-2 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="py-1 px-2 font-mono text-chart-2">{h.state}</td>
                      <td className="py-1 px-2 font-mono text-foreground">{h.input}</td>
                      <td className={cn("py-1 px-2 font-mono", h.output === "✗" ? "text-destructive" : "text-primary")}>{h.output}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Output waveform */}
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-2">OUTPUT WAVEFORM</div>
              <svg width="100%" viewBox={`0 0 ${simHistory.length * 40 + 80} 130`}>
                {/* Input waveform */}
                {(() => {
                  const vals = simHistory.map((h) => parseInt(h.input) || 0);
                  let path = `M 50 ${vals[0] ? 15 : 45}`;
                  vals.forEach((v, i) => {
                    const x = 50 + (i + 1) * 40;
                    const y = v ? 15 : 45;
                    path += ` L ${x} ${v ? 15 : 45}`;
                    if (i < vals.length - 1) path += ` L ${x} ${vals[i + 1] ? 15 : 45}`;
                  });
                  return (
                    <g>
                      <text x="5" y="32" fill="hsl(var(--chart-2))" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">IN</text>
                      <path d={path} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" />
                    </g>
                  );
                })()}
                {/* Output waveform */}
                {(() => {
                  const vals = simHistory.map((h) => h.output === "1" ? 1 : 0);
                  let path = `M 50 ${vals[0] ? 75 : 105}`;
                  vals.forEach((v, i) => {
                    const x = 50 + (i + 1) * 40;
                    path += ` L ${x} ${v ? 75 : 105}`;
                    if (i < vals.length - 1) path += ` L ${x} ${vals[i + 1] ? 75 : 105}`;
                  });
                  return (
                    <g>
                      <text x="5" y="92" fill="hsl(var(--primary))" fontSize="10" fontFamily="JetBrains Mono" fontWeight="bold">OUT</text>
                      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>
        )}
      </div>

      {states.length === 0 && (
        <div className="p-10 rounded-xl bg-card border border-border text-center">
          <div className="text-muted-foreground mb-2">Switch to "Add State" mode and click the canvas to place states</div>
          <div className="text-xs text-muted-foreground">Then use "Add Transition" to connect them with input/output labels</div>
        </div>
      )}
    </div>
  );
};

export default FSMDesigner;

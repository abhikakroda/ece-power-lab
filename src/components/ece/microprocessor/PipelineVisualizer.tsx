import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, SkipForward, AlertTriangle, ArrowRight } from "lucide-react";

const stages = ["IF", "ID", "EX", "MEM", "WB"] as const;
type Stage = typeof stages[number];

const stageColors: Record<Stage, string> = {
  IF: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  ID: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  EX: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  MEM: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  WB: "bg-primary/20 text-primary border-primary/30",
};

const stageLabels: Record<Stage, string> = {
  IF: "Instruction Fetch",
  ID: "Instruction Decode",
  EX: "Execute",
  MEM: "Memory Access",
  WB: "Write Back",
};

interface Instruction {
  text: string;
  dest?: string;
  src1?: string;
  src2?: string;
  type: "alu" | "load" | "store" | "branch" | "nop";
}

interface HazardInfo {
  type: "RAW" | "WAR" | "WAW" | "control" | "structural";
  desc: string;
  instrIdx: number;
  dependsOn: number;
  canForward: boolean;
}

interface CycleCell {
  stage: Stage | "stall" | "bubble" | null;
  instrIdx: number;
}

const parseInstruction = (text: string): Instruction => {
  const parts = text.trim().replace(/,/g, " ").split(/\s+/);
  const op = parts[0]?.toUpperCase() || "";
  if (op === "NOP" || !op) return { text, type: "nop" };
  if (op === "LW" || op === "LD" || op === "LOAD") return { text, type: "load", dest: parts[1], src1: parts[2] };
  if (op === "SW" || op === "ST" || op === "STORE") return { text, type: "store", src1: parts[1], src2: parts[2] };
  if (op === "BEQ" || op === "BNE" || op === "JMP" || op === "J") return { text, type: "branch", src1: parts[1], src2: parts[2] };
  // Default ALU: ADD R1, R2, R3
  return { text, type: "alu", dest: parts[1], src1: parts[2], src2: parts[3] };
};

const defaultPipeline = `ADD R1, R2, R3
SUB R4, R1, R5
AND R6, R1, R7
LW R8, 0(R1)
SW R8, 4(R2)`;

const presets = [
  { name: "No Hazards", code: "ADD R1, R2, R3\nSUB R4, R5, R6\nAND R7, R8, R9\nOR R10, R11, R12\nXOR R13, R14, R15" },
  { name: "RAW Hazard", code: "ADD R1, R2, R3\nSUB R4, R1, R5\nAND R6, R1, R7" },
  { name: "Load-Use Hazard", code: "LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R1, R6" },
  { name: "Multiple Hazards", code: "ADD R1, R2, R3\nSUB R4, R1, R5\nLW R6, 0(R4)\nAND R7, R6, R1\nOR R8, R7, R4" },
  { name: "Control Hazard", code: "ADD R1, R2, R3\nBEQ R1, R0, label\nSUB R4, R5, R6\nAND R7, R8, R9" },
];

const PipelineVisualizer = () => {
  const [code, setCode] = useState(defaultPipeline);
  const [forwarding, setForwarding] = useState(true);
  const [cycle, setCycle] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const instructions = useMemo(() =>
    code.split("\n").map(l => l.trim()).filter(Boolean).map(parseInstruction)
  , [code]);

  // Detect hazards
  const hazards = useMemo(() => {
    const h: HazardInfo[] = [];
    for (let i = 1; i < instructions.length; i++) {
      const cur = instructions[i];
      for (let j = Math.max(0, i - 3); j < i; j++) {
        const prev = instructions[j];
        if (!prev.dest) continue;
        // RAW: cur reads what prev writes
        if (cur.src1 === prev.dest || cur.src2 === prev.dest) {
          const distance = i - j;
          const isLoad = prev.type === "load";
          const canForward = !isLoad || distance > 1;
          h.push({
            type: "RAW",
            desc: `I${i + 1} reads ${prev.dest} written by I${j + 1}`,
            instrIdx: i,
            dependsOn: j,
            canForward: canForward && forwarding,
          });
        }
      }
      if (cur.type === "branch") {
        h.push({
          type: "control",
          desc: `Branch at I${i + 1} — pipeline flush risk`,
          instrIdx: i,
          dependsOn: i,
          canForward: false,
        });
      }
    }
    return h;
  }, [instructions, forwarding]);

  // Build pipeline schedule
  const { grid, totalCycles, stallCycles, forwardPaths } = useMemo(() => {
    const n = instructions.length;
    if (n === 0) return { grid: [] as CycleCell[][], totalCycles: 0, stallCycles: 0, forwardPaths: [] as { from: string; to: string; cycle: number }[] };

    // startCycle[i] = cycle when instruction i enters IF
    const startCycle: number[] = [0];
    let stalls = 0;
    const fwdPaths: { from: string; to: string; cycle: number }[] = [];

    for (let i = 1; i < n; i++) {
      let earliest = startCycle[i - 1] + 1; // normal pipelining

      // Check for hazards requiring stalls
      for (const h of hazards.filter(hz => hz.instrIdx === i)) {
        const prevStart = startCycle[h.dependsOn];
        const prevType = instructions[h.dependsOn].type;

        if (h.type === "RAW") {
          if (h.canForward) {
            // Forwarding: EX→EX or MEM→EX, no stall for ALU, 1 stall for load
            if (prevType === "load") {
              // Load-use: 1 stall even with forwarding
              const needed = prevStart + 4; // MEM stage done
              const exStage = earliest + 2; // when cur reaches EX
              if (exStage < needed) {
                const stallsNeeded = needed - exStage;
                earliest = Math.max(earliest, earliest + stallsNeeded);
                stalls += stallsNeeded;
              }
              fwdPaths.push({ from: `I${h.dependsOn + 1}/MEM`, to: `I${i + 1}/EX`, cycle: prevStart + 4 });
            } else {
              fwdPaths.push({ from: `I${h.dependsOn + 1}/EX`, to: `I${i + 1}/EX`, cycle: prevStart + 3 });
            }
          } else {
            // No forwarding: must wait for WB
            const wbDone = prevStart + 5;
            const idStage = earliest + 1;
            if (idStage < wbDone) {
              const stallsNeeded = wbDone - idStage;
              earliest = Math.max(earliest, earliest + stallsNeeded);
              stalls += stallsNeeded;
            }
          }
        }
      }
      startCycle[i] = earliest;
    }

    const total = (startCycle[n - 1] || 0) + 5;
    const gridData: CycleCell[][] = [];

    for (let i = 0; i < n; i++) {
      const row: CycleCell[] = [];
      for (let c = 0; c < total; c++) {
        const offset = c - startCycle[i];
        if (offset >= 0 && offset < 5) {
          row.push({ stage: stages[offset], instrIdx: i });
        } else if (c < startCycle[i] && c >= (i > 0 ? startCycle[i - 1] + 1 : 0) && c < startCycle[i]) {
          row.push({ stage: "stall", instrIdx: i });
        } else {
          row.push({ stage: null, instrIdx: i });
        }
      }
      gridData.push(row);
    }

    return { grid: gridData, totalCycles: total, stallCycles: stalls, forwardPaths: fwdPaths };
  }, [instructions, hazards, forwarding]);

  useEffect(() => {
    if (!isAnimating) return;
    if (cycle >= totalCycles) { setIsAnimating(false); return; }
    const timer = setTimeout(() => setCycle(c => c + 1), 400);
    return () => clearTimeout(timer);
  }, [isAnimating, cycle, totalCycles]);

  const idealCycles = instructions.length + 4;
  const speedup = totalCycles > 0 ? (idealCycles / totalCycles).toFixed(2) : "—";
  const cpi = instructions.length > 0 ? (totalCycles / instructions.length).toFixed(2) : "—";

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap">
        {presets.map(p => (
          <button key={p.name} onClick={() => { setCode(p.code); setCycle(0); setIsAnimating(false); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Code + controls */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Instructions (MIPS-style)</div>
            <textarea value={code} onChange={e => { setCode(e.target.value); setCycle(0); setIsAnimating(false); }}
              className="w-full h-32 bg-muted rounded-lg p-3 font-mono text-xs text-foreground resize-none border border-border focus:outline-none focus:border-primary/30"
              spellCheck={false} />
          </div>

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => { setCycle(0); setIsAnimating(true); }}
              className="bg-primary text-primary-foreground gap-1.5 text-xs font-mono">
              <Play size={14} /> Animate
            </Button>
            <Button size="sm" onClick={() => setCycle(c => Math.min(c + 1, totalCycles))}
              className="bg-card border border-border text-foreground gap-1.5 text-xs font-mono">
              <SkipForward size={14} /> Step
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setCycle(0); setIsAnimating(false); }}
              className="gap-1.5 text-xs font-mono">
              <RotateCcw size={14} /> Reset
            </Button>
          </div>

          {/* Forwarding toggle */}
          <label className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border cursor-pointer">
            <input type="checkbox" checked={forwarding} onChange={e => { setForwarding(e.target.checked); setCycle(0); }}
              className="accent-[hsl(var(--primary))]" />
            <span className="text-xs font-mono text-foreground">Data Forwarding</span>
          </label>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-sm font-mono font-bold text-primary">{totalCycles}</div>
              <div className="text-[9px] text-muted-foreground">Total Cycles</div>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-sm font-mono font-bold text-destructive">{stallCycles}</div>
              <div className="text-[9px] text-muted-foreground">Stall Cycles</div>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-sm font-mono font-bold text-chart-2">{cpi}</div>
              <div className="text-[9px] text-muted-foreground">CPI</div>
            </div>
            <div className="p-3 rounded-lg border border-border text-center">
              <div className="text-sm font-mono font-bold text-chart-3">{speedup}</div>
              <div className="text-[9px] text-muted-foreground">vs Ideal</div>
            </div>
          </div>

          {/* Hazards */}
          {hazards.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">
                Hazards Detected ({hazards.length})
              </div>
              <div className="space-y-1.5">
                {hazards.map((h, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-2 text-[10px] font-mono p-1.5 rounded",
                    h.canForward ? "text-chart-3 bg-chart-3/5" : "text-destructive bg-destructive/5"
                  )}>
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{h.type}:</span> {h.desc}
                      {h.canForward && <span className="ml-1 text-primary">(forwarded)</span>}
                      {!h.canForward && h.type === "RAW" && <span className="ml-1">(stall required)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pipeline diagram */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Pipeline Diagram</div>
            <div className="text-[10px] font-mono text-muted-foreground">Cycle: {cycle}/{totalCycles}</div>
          </div>

          {/* Stage legend */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {stages.map(s => (
              <div key={s} className={cn("px-2 py-0.5 rounded text-[9px] font-mono border", stageColors[s])}>
                {s} — {stageLabels[s]}
              </div>
            ))}
            <div className="px-2 py-0.5 rounded text-[9px] font-mono border border-destructive/30 bg-destructive/10 text-destructive">
              S — Stall
            </div>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="text-[9px] font-mono text-muted-foreground text-left px-1.5 py-1 min-w-[120px] border-b border-border">Instruction</th>
                  {Array.from({ length: Math.min(totalCycles, 20) }, (_, i) => (
                    <th key={i} className={cn(
                      "text-[9px] font-mono px-1 py-1 min-w-[32px] text-center border-b border-border",
                      i === cycle ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      C{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.map((row, instrIdx) => (
                  <tr key={instrIdx}>
                    <td className="text-[10px] font-mono text-foreground px-1.5 py-1 border-b border-border/50 truncate max-w-[140px]">
                      I{instrIdx + 1}: {instructions[instrIdx]?.text}
                    </td>
                    {row.slice(0, 20).map((cell, c) => {
                      const isActive = c < cycle;
                      const isCurrent = c === cycle;
                      return (
                        <td key={c} className="px-0.5 py-0.5 border-b border-border/30">
                          {cell.stage === "stall" ? (
                            <div className={cn(
                              "w-7 h-6 rounded text-[8px] font-mono flex items-center justify-center border transition-all",
                              isActive || isCurrent
                                ? "border-destructive/40 bg-destructive/15 text-destructive"
                                : "border-border/30 bg-muted/30 text-muted-foreground/30"
                            )}>S</div>
                          ) : cell.stage ? (
                            <div className={cn(
                              "w-7 h-6 rounded text-[8px] font-mono flex items-center justify-center border transition-all",
                              isActive || isCurrent
                                ? stageColors[cell.stage]
                                : "border-border/30 bg-muted/30 text-muted-foreground/30"
                            )}>
                              {cell.stage}
                            </div>
                          ) : (
                            <div className="w-7 h-6" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Forwarding paths */}
          {forwarding && forwardPaths.length > 0 && (
            <div className="mt-4 space-y-1">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Forwarding Paths</div>
              {forwardPaths.map((fp, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-primary">
                  <ArrowRight size={12} />
                  <span>{fp.from}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{fp.to}</span>
                  <span className="text-muted-foreground/50">(cycle {fp.cycle})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline stages explanation */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-3 uppercase tracking-wider">5-Stage RISC Pipeline</div>
        <div className="grid grid-cols-5 gap-2">
          {stages.map((s, i) => (
            <div key={s} className={cn("p-2.5 rounded-lg border text-center", stageColors[s])}>
              <div className="text-sm font-mono font-bold">{s}</div>
              <div className="text-[9px] mt-0.5">{stageLabels[s]}</div>
              <div className="text-[8px] text-muted-foreground mt-1">
                {s === "IF" && "PC → Instruction Memory"}
                {s === "ID" && "Decode + Register Read"}
                {s === "EX" && "ALU Operation"}
                {s === "MEM" && "Data Memory R/W"}
                {s === "WB" && "Write to Register File"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PipelineVisualizer;

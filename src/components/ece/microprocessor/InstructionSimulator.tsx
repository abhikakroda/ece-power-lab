import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, SkipForward, RotateCcw, AlertTriangle } from "lucide-react";

// 8086 Registers
interface Registers {
  AX: number; BX: number; CX: number; DX: number;
  SP: number; BP: number; SI: number; DI: number;
  CS: number; DS: number; SS: number; ES: number;
  IP: number;
}

interface Flags {
  CF: boolean; ZF: boolean; SF: boolean; OF: boolean;
  PF: boolean; AF: boolean; DF: boolean; IF: boolean;
}

interface MemoryCell { addr: number; value: number; label?: string }

interface ExecLog { line: number; instr: string; detail: string; type: "ok" | "error" | "info" }

const initRegs = (): Registers => ({
  AX: 0, BX: 0, CX: 0, DX: 0,
  SP: 0xFFFE, BP: 0, SI: 0, DI: 0,
  CS: 0, DS: 0, SS: 0, ES: 0, IP: 0,
});

const initFlags = (): Flags => ({
  CF: false, ZF: false, SF: false, OF: false,
  PF: false, AF: false, DF: false, IF: true,
});

type RegName = "AX" | "BX" | "CX" | "DX" | "SP" | "BP" | "SI" | "DI" | "AH" | "AL" | "BH" | "BL" | "CH" | "CL" | "DH" | "DL";

const isReg16 = (r: string): r is keyof Registers =>
  ["AX", "BX", "CX", "DX", "SP", "BP", "SI", "DI"].includes(r.toUpperCase());

const isReg8H = (r: string) => ["AH", "BH", "CH", "DH"].includes(r.toUpperCase());
const isReg8L = (r: string) => ["AL", "BL", "CL", "DL"].includes(r.toUpperCase());
const isReg = (r: string) => isReg16(r) || isReg8H(r) || isReg8L(r);

const getReg = (regs: Registers, r: string): number => {
  const u = r.toUpperCase();
  if (isReg16(u)) return regs[u as keyof Registers];
  if (isReg8H(u)) return (regs[(u[0] + "X") as keyof Registers] >> 8) & 0xFF;
  if (isReg8L(u)) return regs[(u[0] + "X") as keyof Registers] & 0xFF;
  return 0;
};

const setReg = (regs: Registers, r: string, val: number): Registers => {
  const u = r.toUpperCase();
  const next = { ...regs };
  if (isReg16(u)) {
    (next as any)[u] = val & 0xFFFF;
  } else if (isReg8H(u)) {
    const full = (u[0] + "X") as keyof Registers;
    (next as any)[full] = ((val & 0xFF) << 8) | (next[full] & 0xFF);
  } else if (isReg8L(u)) {
    const full = (u[0] + "X") as keyof Registers;
    (next as any)[full] = (next[full] & 0xFF00) | (val & 0xFF);
  }
  return next;
};

const parseImm = (s: string): number | null => {
  const t = s.trim();
  if (/^0x[0-9a-fA-F]+$/i.test(t)) return parseInt(t, 16);
  if (/^[0-9]+h$/i.test(t)) return parseInt(t, 16);
  if (/^[0-9]+b$/i.test(t)) return parseInt(t, 2);
  if (/^-?[0-9]+$/.test(t)) return parseInt(t, 10);
  return null;
};

const updateFlags = (flags: Flags, result: number, is16: boolean): Flags => {
  const mask = is16 ? 0xFFFF : 0xFF;
  const signBit = is16 ? 0x8000 : 0x80;
  const masked = result & mask;
  let parity = 0;
  for (let i = 0; i < 8; i++) if (masked & (1 << i)) parity++;
  return {
    ...flags,
    ZF: masked === 0,
    SF: (masked & signBit) !== 0,
    CF: result > mask || result < 0,
    OF: false, // simplified
    PF: parity % 2 === 0,
    AF: false,
  };
};

const defaultCode = `; 8086 Assembly Simulator
MOV AX, 5
MOV BX, 3
ADD AX, BX
MOV CX, AX
SUB CX, 2
MUL BX
MOV [100h], AX
INC DX
CMP AX, 24
PUSH AX
POP BX`;

const presets = [
  { name: "Basic Arithmetic", code: "MOV AX, 10\nMOV BX, 20\nADD AX, BX\nSUB AX, 5\nMOV CX, AX" },
  { name: "Multiply & Flags", code: "MOV AX, 7\nMOV BX, 6\nMUL BX\nCMP AX, 42\nMOV DX, AX" },
  { name: "Stack Operations", code: "MOV AX, 100h\nPUSH AX\nMOV AX, 200h\nPUSH AX\nPOP BX\nPOP CX" },
  { name: "Memory Access", code: "MOV AX, 55h\nMOV [100h], AX\nMOV BX, [100h]\nADD BX, 10\nMOV [102h], BX" },
  { name: "Loop Pattern", code: "MOV CX, 5\nMOV AX, 0\nADD AX, CX\nDEC CX\nADD AX, CX\nDEC CX\nADD AX, CX" },
];

const InstructionSimulator = () => {
  const [code, setCode] = useState(defaultCode);
  const [regs, setRegs] = useState(initRegs());
  const [flags, setFlags] = useState(initFlags());
  const [memory, setMemory] = useState<Map<number, number>>(new Map());
  const [stack, setStack] = useState<number[]>([]);
  const [execLog, setExecLog] = useState<ExecLog[]>([]);
  const [pc, setPc] = useState(0);
  const [running, setRunning] = useState(false);
  const [changedRegs, setChangedRegs] = useState<Set<string>>(new Set());

  const lines = useMemo(() =>
    code.split("\n")
      .map((l, i) => ({ line: i, text: l.trim() }))
      .filter(l => l.text && !l.text.startsWith(";"))
  , [code]);

  const addLog = useCallback((line: number, instr: string, detail: string, type: ExecLog["type"] = "ok") => {
    setExecLog(prev => [...prev.slice(-30), { line, instr, detail, type }]);
  }, []);

  const reset = useCallback(() => {
    setRegs(initRegs());
    setFlags(initFlags());
    setMemory(new Map());
    setStack([]);
    setExecLog([]);
    setPc(0);
    setRunning(false);
    setChangedRegs(new Set());
  }, []);

  const executeOne = useCallback(() => {
    if (pc >= lines.length) {
      addLog(pc, "—", "Program finished", "info");
      setRunning(false);
      return;
    }

    const { line, text } = lines[pc];
    const parts = text.replace(/,/g, " ").split(/\s+/).filter(Boolean);
    const op = parts[0].toUpperCase();
    let newRegs = { ...regs };
    let newFlags = { ...flags };
    let newMem = new Map(memory);
    let newStack = [...stack];
    const changed = new Set<string>();
    let detail = "";

    try {
      switch (op) {
        case "MOV": {
          const dst = parts[1];
          const src = parts[2];
          // MOV [addr], reg
          const memMatch = dst.match(/^\[(.+)\]$/);
          const srcMemMatch = src?.match(/^\[(.+)\]$/);

          if (memMatch) {
            const addr = parseImm(memMatch[1]) ?? 0;
            const val = isReg(src) ? getReg(newRegs, src) : (parseImm(src) ?? 0);
            newMem.set(addr, val);
            detail = `MEM[0x${addr.toString(16)}] = 0x${val.toString(16).toUpperCase()}`;
          } else if (srcMemMatch) {
            const addr = parseImm(srcMemMatch[1]) ?? 0;
            const val = newMem.get(addr) ?? 0;
            newRegs = setReg(newRegs, dst, val);
            changed.add(dst.toUpperCase());
            detail = `${dst.toUpperCase()} ← MEM[0x${addr.toString(16)}] = 0x${val.toString(16).toUpperCase()}`;
          } else {
            const val = isReg(src) ? getReg(newRegs, src) : (parseImm(src) ?? 0);
            newRegs = setReg(newRegs, dst, val);
            changed.add(dst.toUpperCase());
            detail = `${dst.toUpperCase()} ← 0x${(val & 0xFFFF).toString(16).toUpperCase()}`;
          }
          break;
        }
        case "ADD": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          const result = a + b;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = 0x${a.toString(16)} + 0x${b.toString(16)} = 0x${(result & 0xFFFF).toString(16).toUpperCase()}`;
          break;
        }
        case "SUB": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          const result = a - b;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = 0x${a.toString(16)} - 0x${b.toString(16)} = 0x${(result & 0xFFFF).toString(16).toUpperCase()}`;
          break;
        }
        case "MUL": {
          const a = newRegs.AX;
          const b = isReg(parts[1]) ? getReg(newRegs, parts[1]) : (parseImm(parts[1]) ?? 0);
          const result = a * b;
          newRegs = { ...newRegs, AX: result & 0xFFFF, DX: (result >> 16) & 0xFFFF };
          newFlags = updateFlags(newFlags, result, true);
          changed.add("AX"); changed.add("DX");
          detail = `DX:AX = AX × ${parts[1]} = 0x${result.toString(16).toUpperCase()}`;
          break;
        }
        case "DIV": {
          const b = isReg(parts[1]) ? getReg(newRegs, parts[1]) : (parseImm(parts[1]) ?? 0);
          if (b === 0) { detail = "Division by zero!"; addLog(line, text, detail, "error"); setPc(p => p + 1); return; }
          const dividend = (newRegs.DX << 16) | newRegs.AX;
          newRegs = { ...newRegs, AX: Math.floor(dividend / b) & 0xFFFF, DX: (dividend % b) & 0xFFFF };
          changed.add("AX"); changed.add("DX");
          detail = `AX = ${dividend} / ${b} = ${newRegs.AX}, DX = ${dividend % b}`;
          break;
        }
        case "INC": {
          const val = getReg(newRegs, parts[1]) + 1;
          newRegs = setReg(newRegs, parts[1], val);
          newFlags = updateFlags(newFlags, val, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()}++ = 0x${(val & 0xFFFF).toString(16).toUpperCase()}`;
          break;
        }
        case "DEC": {
          const val = getReg(newRegs, parts[1]) - 1;
          newRegs = setReg(newRegs, parts[1], val);
          newFlags = updateFlags(newFlags, val, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()}-- = 0x${(val & 0xFFFF).toString(16).toUpperCase()}`;
          break;
        }
        case "CMP": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          newFlags = updateFlags(newFlags, a - b, isReg16(parts[1]));
          detail = `${parts[1].toUpperCase()}(${a}) - ${b} → ZF=${newFlags.ZF ? 1 : 0} SF=${newFlags.SF ? 1 : 0} CF=${newFlags.CF ? 1 : 0}`;
          break;
        }
        case "AND": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          const result = a & b;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = 0x${a.toString(16)} AND 0x${b.toString(16)} = 0x${result.toString(16)}`;
          break;
        }
        case "OR": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          const result = a | b;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = 0x${a.toString(16)} OR 0x${b.toString(16)} = 0x${result.toString(16)}`;
          break;
        }
        case "XOR": {
          const a = getReg(newRegs, parts[1]);
          const b = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 0);
          const result = a ^ b;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, isReg16(parts[1]));
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = 0x${a.toString(16)} XOR 0x${b.toString(16)} = 0x${result.toString(16)}`;
          break;
        }
        case "NOT": {
          const val = ~getReg(newRegs, parts[1]) & 0xFFFF;
          newRegs = setReg(newRegs, parts[1], val);
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} = NOT → 0x${val.toString(16).toUpperCase()}`;
          break;
        }
        case "SHL":
        case "SAL": {
          const a = getReg(newRegs, parts[1]);
          const n = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 1);
          const result = (a << n) & 0xFFFF;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, true);
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} <<= ${n} → 0x${result.toString(16)}`;
          break;
        }
        case "SHR": {
          const a = getReg(newRegs, parts[1]);
          const n = isReg(parts[2]) ? getReg(newRegs, parts[2]) : (parseImm(parts[2]) ?? 1);
          const result = a >>> n;
          newRegs = setReg(newRegs, parts[1], result);
          newFlags = updateFlags(newFlags, result, true);
          changed.add(parts[1].toUpperCase());
          detail = `${parts[1].toUpperCase()} >>= ${n} → 0x${result.toString(16)}`;
          break;
        }
        case "PUSH": {
          const val = isReg(parts[1]) ? getReg(newRegs, parts[1]) : (parseImm(parts[1]) ?? 0);
          newRegs = { ...newRegs, SP: (newRegs.SP - 2) & 0xFFFF };
          newStack = [val, ...newStack];
          changed.add("SP");
          detail = `PUSH 0x${val.toString(16).toUpperCase()} → SP=0x${newRegs.SP.toString(16)}`;
          break;
        }
        case "POP": {
          if (newStack.length === 0) { detail = "Stack underflow!"; addLog(line, text, detail, "error"); setPc(p => p + 1); return; }
          const val = newStack[0];
          newStack = newStack.slice(1);
          newRegs = setReg({ ...newRegs, SP: (newRegs.SP + 2) & 0xFFFF }, parts[1], val);
          changed.add(parts[1].toUpperCase()); changed.add("SP");
          detail = `POP → ${parts[1].toUpperCase()} = 0x${val.toString(16).toUpperCase()}`;
          break;
        }
        case "XCHG": {
          const a = getReg(newRegs, parts[1]);
          const b = getReg(newRegs, parts[2]);
          newRegs = setReg(setReg(newRegs, parts[1], b), parts[2], a);
          changed.add(parts[1].toUpperCase()); changed.add(parts[2].toUpperCase());
          detail = `${parts[1].toUpperCase()} ↔ ${parts[2].toUpperCase()}`;
          break;
        }
        case "NOP":
          detail = "No operation";
          break;
        default:
          detail = `Unknown instruction: ${op}`;
          addLog(line, text, detail, "error");
          setPc(p => p + 1);
          return;
      }
    } catch {
      detail = "Execution error";
      addLog(line, text, detail, "error");
      setPc(p => p + 1);
      return;
    }

    newRegs.IP = pc + 1;
    setRegs(newRegs);
    setFlags(newFlags);
    setMemory(newMem);
    setStack(newStack);
    setChangedRegs(changed);
    addLog(line, text, detail, "ok");
    setPc(p => p + 1);
  }, [pc, lines, regs, flags, memory, stack, addLog]);

  const runAll = useCallback(() => {
    reset();
    // Execute with delay
    setRunning(true);
  }, [reset]);

  // Auto-step when running
  const stepAll = useCallback(() => {
    let r = initRegs();
    let f = initFlags();
    let m = new Map<number, number>();
    let s: number[] = [];
    const logs: ExecLog[] = [];
    const changed = new Set<string>();

    for (let i = 0; i < lines.length && i < 100; i++) {
      // simplified: run all at once
    }
    // Just use step-by-step instead
  }, [lines]);

  const regList: [string, number][] = [
    ["AX", regs.AX], ["BX", regs.BX], ["CX", regs.CX], ["DX", regs.DX],
    ["SP", regs.SP], ["BP", regs.BP], ["SI", regs.SI], ["DI", regs.DI],
    ["IP", regs.IP],
  ];

  const flagList: [string, boolean][] = [
    ["CF", flags.CF], ["ZF", flags.ZF], ["SF", flags.SF], ["OF", flags.OF],
    ["PF", flags.PF], ["AF", flags.AF],
  ];

  const memEntries = useMemo(() => {
    const entries: MemoryCell[] = [];
    memory.forEach((v, k) => entries.push({ addr: k, value: v }));
    return entries.sort((a, b) => a.addr - b.addr);
  }, [memory]);

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap">
        {presets.map(p => (
          <button key={p.name} onClick={() => { setCode(p.code); reset(); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-border bg-card text-muted-foreground hover:text-foreground transition-all">
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Code editor */}
        <div className="lg:col-span-2 space-y-3">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Assembly Code</div>
            <div className="relative">
              <textarea value={code} onChange={e => { setCode(e.target.value); reset(); }}
                className="w-full h-48 bg-muted rounded-lg p-3 pl-12 font-mono text-xs text-foreground resize-none border border-border focus:outline-none focus:border-primary/30"
                spellCheck={false} />
              {/* Line numbers */}
              <div className="absolute left-0 top-0 w-10 h-48 p-3 font-mono text-[10px] text-muted-foreground/50 text-right overflow-hidden pointer-events-none">
                {code.split("\n").map((_, i) => (
                  <div key={i} className={cn("leading-[18px]",
                    lines.findIndex(l => l.line === i) === pc && running ? "text-primary font-bold" : ""
                  )}>{i + 1}</div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => { if (pc === 0) setRunning(true); executeOne(); }}
                disabled={pc >= lines.length}
                className="bg-primary text-primary-foreground gap-1.5 text-xs font-mono">
                <SkipForward size={14} /> Step
              </Button>
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 text-xs font-mono">
                <RotateCcw size={14} /> Reset
              </Button>
              <div className="flex-1" />
              <div className="text-[10px] font-mono text-muted-foreground self-center">
                Line {pc + 1}/{lines.length} | IP=0x{regs.IP.toString(16).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Execution log */}
          <div className="p-4 rounded-xl bg-card border border-border max-h-52 overflow-y-auto">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Execution Trace</div>
            {execLog.length === 0 && <div className="text-[10px] font-mono text-muted-foreground/50 italic">Click Step to execute...</div>}
            {execLog.map((entry, i) => (
              <div key={i} className={cn("text-[10px] font-mono py-0.5 flex gap-2",
                entry.type === "error" ? "text-destructive" : entry.type === "info" ? "text-chart-3" : "text-muted-foreground"
              )}>
                <span className="text-muted-foreground/40 w-4 shrink-0">{i + 1}</span>
                <span className="text-foreground shrink-0 w-28 truncate">{entry.instr}</span>
                <span className="flex-1">{entry.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: registers + flags + memory */}
        <div className="space-y-4">
          {/* Registers */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Registers</div>
            <div className="grid grid-cols-3 gap-1.5">
              {regList.map(([name, val]) => (
                <div key={name} className={cn(
                  "px-2 py-1.5 rounded-md border text-center transition-all",
                  changedRegs.has(name) ? "border-primary/40 bg-primary/5" : "border-border"
                )}>
                  <div className="text-[9px] text-muted-foreground">{name}</div>
                  <div className={cn("text-xs font-mono font-bold",
                    changedRegs.has(name) ? "text-primary" : "text-foreground"
                  )}>
                    {val.toString(16).toUpperCase().padStart(4, "0")}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Flags</div>
            <div className="flex gap-1.5 flex-wrap">
              {flagList.map(([name, val]) => (
                <div key={name} className={cn(
                  "px-2.5 py-1 rounded-md border text-[10px] font-mono font-bold transition-all",
                  val ? "border-chart-3/40 bg-chart-3/10 text-chart-3" : "border-border text-muted-foreground"
                )}>
                  {name}={val ? "1" : "0"}
                </div>
              ))}
            </div>
          </div>

          {/* Stack */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">
              Stack (SP=0x{regs.SP.toString(16).toUpperCase()})
            </div>
            {stack.length === 0 ? (
              <div className="text-[10px] font-mono text-muted-foreground/50 italic">Empty</div>
            ) : (
              <div className="space-y-0.5">
                {stack.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-muted-foreground/50 w-6">{i === 0 ? "TOS→" : ""}</span>
                    <span className="text-primary font-bold">0x{v.toString(16).toUpperCase().padStart(4, "0")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Memory */}
          {memEntries.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Memory</div>
              <div className="space-y-0.5">
                {memEntries.map(({ addr, value }) => (
                  <div key={addr} className="flex gap-2 text-[10px] font-mono">
                    <span className="text-chart-4">0x{addr.toString(16).toUpperCase().padStart(4, "0")}</span>
                    <span className="text-foreground">0x{value.toString(16).toUpperCase().padStart(4, "0")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructionSimulator;

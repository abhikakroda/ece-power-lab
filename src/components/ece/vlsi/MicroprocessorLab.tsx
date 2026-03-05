import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Cpu, HardDrive, Zap, Info, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// A simplified 8-bit architecture simulation
interface RegisterState {
    AX: number;
    BX: number;
    CX: number;
    DX: number;
    PC: number; // Program Counter
    IR: string; // Instruction Register
    Flags: { Z: boolean; C: boolean };
}

type Instruction =
    | { op: "MOV"; dest: "AX" | "BX" | "CX" | "DX"; src: number | "AX" | "BX" | "CX" | "DX" }
    | { op: "ADD"; dest: "AX" | "BX" | "CX" | "DX"; src: number | "AX" | "BX" | "CX" | "DX" }
    | { op: "SUB"; dest: "AX" | "BX" | "CX" | "DX"; src: number | "AX" | "BX" | "CX" | "DX" }
    | { op: "JNZ"; target: number } // Jump if Not Zero
    | { op: "HLT" };

// A hardcoded sample program: Count down from 5 to 0
const sampleProgram: Instruction[] = [
    { op: "MOV", dest: "CX", src: 5 },     // 0: Initialize counter CX = 5
    { op: "MOV", dest: "AX", src: 0 },     // 1: Initialize accumulator AX = 0
    { op: "ADD", dest: "AX", src: 10 },    // 2: Add 10 to AX (AX = AX + 10)
    { op: "SUB", dest: "CX", src: 1 },     // 3: Decrement CX
    { op: "JNZ", target: 2 },              // 4: If CX != 0, jump back to instruction 2
    { op: "HLT" }                          // 5: Halt
];

const formatHex = (num: number) => `0x${num.toString(16).padStart(2, '0').toUpperCase()}`;

export const MicroprocessorLab = () => {
    const [cpuState, setCpuState] = useState<RegisterState>({
        AX: 0, BX: 0, CX: 0, DX: 0, PC: 0, IR: "NOP", Flags: { Z: false, C: false }
    });

    const [isRunning, setIsRunning] = useState(false);
    const [memory] = useState<Instruction[]>(sampleProgram);
    const [activeBus, setActiveBus] = useState<"fetch" | "decode" | "execute" | "none">("none");

    // Format instruction for display
    const getInstString = (inst: Instruction) => {
        if (inst.op === "HLT") return "HLT";
        if (inst.op === "JNZ") return `JNZ ${inst.target}`;
        return `${inst.op} ${inst.dest}, ${inst.src}`;
    };

    const getSourceValue = (src: number | "AX" | "BX" | "CX" | "DX", state: RegisterState) => {
        return typeof src === "number" ? src : state[src];
    };

    const executeStep = () => {
        setCpuState(prev => {
            // If halted or out of bounds
            if (prev.PC >= memory.length || memory[prev.PC].op === "HLT") {
                setIsRunning(false);
                setActiveBus("none");
                let newState = { ...prev, IR: "HLT" };
                if (memory[prev.PC]?.op === "HLT") newState.PC = prev.PC + 1;
                return newState;
            }

            const inst = memory[prev.PC];
            let newState = { ...prev, IR: getInstString(inst) };

            setActiveBus("execute");

            switch (inst.op) {
                case "MOV":
                    newState[inst.dest] = getSourceValue(inst.src, prev);
                    newState.PC++;
                    break;
                case "ADD": {
                    const val = newState[inst.dest] + getSourceValue(inst.src, prev);
                    newState[inst.dest] = val & 0xFF; // 8-bit wrap
                    newState.Flags.Z = newState[inst.dest] === 0;
                    newState.Flags.C = val > 0xFF;
                    newState.PC++;
                    break;
                }
                case "SUB": {
                    const val = newState[inst.dest] - getSourceValue(inst.src, prev);
                    newState[inst.dest] = val < 0 ? (256 + val) : val; // 8-bit unsigned representation
                    newState.Flags.Z = newState[inst.dest] === 0;
                    newState.Flags.C = val < 0; // Borrow
                    newState.PC++;
                    break;
                }
                case "JNZ":
                    if (!prev.Flags.Z) {
                        newState.PC = inst.target;
                    } else {
                        newState.PC++;
                    }
                    break;
            }
            return newState;
        });
    };

    // Auto-run loop
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isRunning) {
            timer = setInterval(() => {
                executeStep();
            }, 1000); // 1 step per second for visibility
        }
        return () => clearInterval(timer);
    }, [isRunning, cpuState]); // Dependency on cpuState is needed to get the freshest PC in the closure

    const handleReset = () => {
        setIsRunning(false);
        setCpuState({ AX: 0, BX: 0, CX: 0, DX: 0, PC: 0, IR: "NOP", Flags: { Z: false, C: false } });
        setActiveBus("none");
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar: Program Memory */}
            <div className="w-80 border-r border-border bg-card/50 flex flex-col">
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <HardDrive size={18} className="text-primary" />
                        Program Memory
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">8-bit architecture simulation</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {memory.map((inst, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "px-3 py-2 rounded-md font-mono text-sm flex items-center justify-between border",
                                cpuState.PC === idx
                                    ? "bg-primary/20 border-primary text-primary-foreground"
                                    : "bg-background border-border text-foreground hover:border-muted-foreground"
                            )}
                        >
                            <span className="text-muted-foreground w-6">{idx}:</span>
                            <span className="flex-1">{getInstString(inst)}</span>
                            {cpuState.PC === idx && <ArrowRight size={14} className="text-primary animate-pulse" />}
                        </div>
                    ))}
                    {/* Empty memory slots */}
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`empty-${i}`} className="px-3 py-2 rounded-md font-mono text-sm text-muted-foreground/50 border border-transparent">
                            {memory.length + i}: 00 00  // Empty
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="p-4 border-t border-border bg-card flex items-center gap-2">
                    <Button
                        variant={isRunning ? "outline" : "default"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setIsRunning(!isRunning)}
                    >
                        {isRunning ? <><Pause size={16} className="mr-2" /> Pause</> : <><Play size={16} className="mr-2" /> Auto-Run</>}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={executeStep} disabled={isRunning} className="flex-1">
                        Step (Clk)
                    </Button>
                    <Button variant="destructive" size="icon" onClick={handleReset}>
                        <RotateCcw size={16} />
                    </Button>
                </div>
            </div>

            {/* Main View: CPU Architecture Datapath */}
            <div className="flex-1 flex flex-col relative bg-dot-pattern">

                <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
                    <Cpu size={400} />
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Cpu className="text-primary" /> CPU Data Path Simulator
                        </h1>
                        <p className="text-muted-foreground">Observe the Fetch-Decode-Execute cycle and register transfers.</p>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 relative z-10">

                    <div className="relative w-full max-w-4xl h-[600px] bg-card/80 backdrop-blur-sm border-2 border-border rounded-xl shadow-2xl p-8 grid grid-cols-3 gap-8">

                        {/* Left Column: Control Unit */}
                        <div className="col-span-1 border-2 border-primary/30 rounded-lg p-4 bg-background relative flex flex-col">
                            <div className="absolute -top-3 left-4 bg-background px-2 text-xs font-bold text-primary uppercase tracking-wider">Control Unit</div>

                            <div className="space-y-6 flex-1 flex flex-col">
                                <div className={cn(
                                    "border rounded-md p-3 transition-colors",
                                    activeBus !== "none" ? "border-primary/50 bg-primary/5" : "border-border"
                                )}>
                                    <div className="text-xs text-muted-foreground mb-1">Instruction Register (IR)</div>
                                    <div className="font-mono text-lg text-center font-bold tracking-widest text-primary">
                                        {cpuState.IR}
                                    </div>
                                </div>

                                <div className="border border-border rounded-md p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Program Counter (PC)</div>
                                    <div className="font-mono text-lg text-center">
                                        {cpuState.PC.toString().padStart(4, '0')}
                                    </div>
                                </div>

                                <div className="mt-auto border border-border rounded-md p-3 bg-muted/20">
                                    <div className="text-xs font-semibold mb-2 flex items-center gap-1"><Zap size={12} className="text-yellow-500" /> Status Flags</div>
                                    <div className="flex justify-around font-mono text-sm">
                                        <div className={cn("px-2 py-1 rounded", cpuState.Flags.Z ? "bg-green-500/20 text-green-400 font-bold" : "text-muted-foreground")}>Zero: {cpuState.Flags.Z ? '1' : '0'}</div>
                                        <div className={cn("px-2 py-1 rounded", cpuState.Flags.C ? "bg-red-500/20 text-red-400 font-bold" : "text-muted-foreground")}>Carry: {cpuState.Flags.C ? '1' : '0'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Middle Column: ALU */}
                        <div className="col-span-1 flex flex-col items-center justify-center relative">

                            {/* ALU Symbol (V-shape) */}
                            <div className="relative w-48 h-48">
                                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
                                    <path d="M 10 20 L 40 20 L 50 40 L 60 20 L 90 20 L 70 80 L 30 80 Z"
                                        fill="currentColor"
                                        className={cn("text-card transition-colors", activeBus === "execute" ? "text-primary/10" : "")}
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinejoin="round" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                    <span className="font-black text-2xl tracking-widest opacity-80">ALU</span>
                                    <span className="text-xs text-muted-foreground font-mono mt-1">8-bit</span>
                                </div>
                            </div>

                            {/* Simulated Buses lines */}
                            <div className={cn("absolute top-1/2 -left-8 w-24 h-1 bg-gradient-to-r from-primary/50 to-primary", activeBus === "execute" ? "opacity-100" : "opacity-20")} />
                            <div className={cn("absolute top-1/2 -right-8 w-16 h-1 bg-gradient-to-l from-primary/50 to-primary", activeBus === "execute" ? "opacity-100" : "opacity-20")} />

                        </div>

                        {/* Right Column: Register File */}
                        <div className="col-span-1 border-2 border-secondary/30 rounded-lg p-4 bg-background relative flex flex-col justify-between">
                            <div className="absolute -top-3 right-4 bg-background px-2 text-xs font-bold text-secondary uppercase tracking-wider">Register File</div>

                            <div className="grid grid-cols-1 gap-4 mt-2">
                                {(['AX', 'BX', 'CX', 'DX'] as const).map(reg => (
                                    <div key={reg} className="flex items-center gap-3 bg-muted/30 border border-border rounded-md p-2 px-3">
                                        <div className="font-bold text-secondary w-8">{reg}</div>
                                        <div className="flex-1 font-mono text-right text-lg tabular-nums">
                                            {cpuState[reg].toString().padStart(3, '0')}
                                        </div>
                                        <div className="font-mono text-xs text-muted-foreground w-12 text-right">
                                            {formatHex(cpuState[reg])}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default MicroprocessorLab;

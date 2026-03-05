import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Terminal, LineChart, Code2, Trash2, List } from "lucide-react";
import * as math from "mathjs";
import {
    LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";

type LogEntry = {
    type: "command" | "result" | "error" | "info";
    text: string;
};

type PlotData = {
    title: string;
    data: { x: number, y: number }[];
};

export default function MatlabLab() {
    const [script, setScript] = useState<string>([
        "% MATLAB Environment",
        "% Example 1: Generate & plot a complex signal",
        "fs = 100;",
        "t = linspace(0, 2, fs*2);",
        "y1 = sin(2 * pi * 5 * t);",
        "y2 = 0.5 * sin(2 * pi * 12 * t);",
        "y = y1 .+ y2; % Element-wise addition",
        "plot(t, y, 'Signal Analysis');",
        "",
        "% Example 2: Scilab-style Matrices",
        "A = magic(3);",
        "B = inv(A);",
        "C = A * B;",
    ].join("\n"));

    const [command, setCommand] = useState("");
    const [logs, setLogs] = useState<LogEntry[]>([{ type: "info", text: "ECE Math Engine (Powered by Math.js) initialized." }]);
    const [scope, setScope] = useState<Record<string, any>>({});
    const [activePlot, setActivePlot] = useState<PlotData | null>(null);

    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // Execute a single line or block
    const executeCode = (code: string, isCommand = false) => {
        if (!code.trim()) return;

        if (isCommand) {
            setLogs(prev => [...prev, { type: "command", text: `>> ${code}` }]);
            setCommand("");
        } else {
            setLogs(prev => [...prev, { type: "info", text: "Running script..." }]);
        }

        try {
            // Create a custom Scilab/MATLAB standard library scope
            const customScope = {
                ...scope,
                // SCILAB: Matrix Generators
                zeros: (r: number, c: number = r) => math.zeros(r, c),
                ones: (r: number, c: number = r) => math.ones(r, c),
                eye: (n: number) => math.identity(n),
                magic: (n: number) => {
                    // Simple magic square generator for testing
                    if (n !== 3) return math.matrix([[1, 2], [3, 4]]);
                    return math.matrix([[8, 1, 6], [3, 5, 7], [4, 9, 2]]);
                },
                linspace: (start: number, end: number, num: number = 100) => {
                    const step = (end - start) / (num - 1);
                    return math.range(start, end + step / 2, step); // + step/2 to ensure inclusivity
                },
                // SCILAB: Vectorized Trigonometry (fix for mathjs strictness)
                sin: (x: any) => math.map(x, (v: any) => math.sin(v)),
                cos: (x: any) => math.map(x, (v: any) => math.cos(v)),
                tan: (x: any) => math.map(x, (v: any) => math.tan(v)),
                exp: (x: any) => math.map(x, (v: any) => math.exp(v)),

                // SCILAB: Plotting
                plot: (x: any, y: any, title = "2D Plot") => {
                    let xArray: number[] = [];
                    let yArray: number[] = [];

                    if (x && x.toArray) xArray = x.toArray();
                    else if (Array.isArray(x)) xArray = x;
                    else if (x && x._data) xArray = x._data; // mathjs matrix

                    if (y && y.toArray) yArray = y.toArray();
                    else if (Array.isArray(y)) yArray = y;
                    else if (y && y._data) yArray = y._data;

                    // Handle if only 1 argument is provided
                    if (!yArray.length && xArray.length) {
                        yArray = xArray;
                        xArray = Array.from({ length: yArray.length }, (_, i) => i);
                    }

                    if (xArray.length !== yArray.length) {
                        throw new Error(`Plot error: X and Y vectors must be same length (${xArray.length} vs ${yArray.length})`);
                    }

                    const plotData = xArray.map((xVal, i) => ({ x: xVal, y: yArray[i] }));
                    setActivePlot({ title, data: plotData });
                    return "Plot generated.";
                }
            };

            // Mathjs evaluates expressions. For multiple lines, we split and evaluate sequentially.
            const lines = code.split("\n").filter(l => l.trim().length > 0 && !l.trim().startsWith("%"));

            let lastResult: any = undefined;

            for (const line of lines) {
                // Strip inline comments
                const pureLine = line.split("%")[0].trim();
                if (!pureLine) continue;

                const isSilent = pureLine.endsWith(";");
                const expr = isSilent ? pureLine.slice(0, -1) : pureLine;

                lastResult = math.evaluate(expr, customScope);

                if (!isSilent && lastResult !== undefined && typeof lastResult !== "function") {
                    // Format result
                    const formatted = math.format(lastResult, { precision: 6 });
                    setLogs(prev => [...prev, { type: "result", text: `ans =\n   ${formatted}` }]);
                }
            }

            // Update actual scope (exclude functions injected)
            const newScope = { ...customScope };
            ["plot", "zeros", "ones", "eye", "magic", "linspace", "sin", "cos", "tan", "exp"].forEach(k => delete newScope[k]);
            setScope(newScope);

        } catch (err: any) {
            setLogs(prev => [...prev, { type: "error", text: err.message || "Execution error" }]);
        }
    };

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            executeCode(command, true);
        }
    };

    const clearWorkspace = () => {
        setScope({});
        setLogs(prev => [...prev, { type: "info", text: "Workspace cleared." }]);
        setActivePlot(null);
    };

    // Extract variables for workspace view
    const workspaceVars = useMemo(() => {
        return Object.entries(scope).map(([key, val]) => {
            let type: string = typeof val;
            let size = "1x1";
            if (val && val.size) {
                size = val.size().join("x");
                type = "matrix";
            } else if (Array.isArray(val)) {
                size = `1x${val.length}`;
                type = "array";
            }
            return { name: key, type, size, value: math.format(val, { precision: 4, notation: "auto" }) };
        });
    }, [scope]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 animate-fade-in">
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border">
                <h2 className="text-lg font-bold flex items-center gap-2"><Code2 className="text-primary" /> MATLAB Simulation Environment</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setLogs([{ type: "info", text: "Command window cleared." }])} variant="outline" size="sm"><Trash2 size={16} className="mr-2" /> Clear Cmd</Button>
                    <Button onClick={clearWorkspace} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"><Trash2 size={16} className="mr-2" /> Clear Workspace</Button>
                    <Button onClick={() => executeCode(script, false)} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"><Play size={16} className="mr-2" /> Run Script</Button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Left pane: Editor & Command Window */}
                <div className="w-1/2 flex flex-col gap-4">
                    <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2 bg-muted/50 border-b border-border text-sm font-semibold flex items-center gap-2"><Code2 size={16} /> Editor - main.m</div>
                        <textarea
                            value={script}
                            onChange={e => setScript(e.target.value)}
                            spellCheck={false}
                            className="flex-1 w-full bg-transparent resize-none p-4 font-mono text-sm outline-none text-[hsl(var(--foreground))]"
                            placeholder="% Write MATLAB code here..."
                        />
                    </div>

                    <div className="h-1/3 flex flex-col bg-[#0d1117] rounded-xl border border-border overflow-hidden shadow-inner">
                        <div className="px-4 py-2 bg-[#161b22] border-b border-border/20 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                            <Terminal size={14} /> Command Window
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
                            {logs.map((log, i) => (
                                <div key={i} className={cn(
                                    "whitespace-pre-wrap break-words",
                                    log.type === "error" ? "text-destructive" :
                                        log.type === "info" ? "text-blue-400 italic" :
                                            log.type === "command" ? "text-primary font-bold" : "text-gray-300"
                                )}>
                                    {log.text}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                        <div className="flex items-center px-4 py-2 border-t border-border/20 bg-[#161b22]">
                            <span className="text-primary font-bold font-mono mr-2">{">>"}</span>
                            <input
                                type="text"
                                value={command}
                                onChange={e => setCommand(e.target.value)}
                                onKeyDown={handleCommandKeyDown}
                                className="flex-1 bg-transparent border-none outline-none text-gray-300 font-mono text-xs"
                                placeholder="Enter command..."
                            />
                        </div>
                    </div>
                </div>

                {/* Right pane: Workspace & Plot */}
                <div className="w-1/2 flex flex-col gap-4">
                    <div className="h-1/3 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2 bg-muted/50 border-b border-border text-sm font-semibold flex items-center gap-2"><List size={16} /> Workspace</div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {workspaceVars.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground italic">No variables in workspace.</div>
                            ) : (
                                <table className="w-full text-sm text-left font-mono">
                                    <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 font-medium">Name</th>
                                            <th className="px-4 py-2 font-medium">Value</th>
                                            <th className="px-4 py-2 font-medium">Size</th>
                                            <th className="px-4 py-2 font-medium">Class</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workspaceVars.map(v => (
                                            <tr key={v.name} className="border-b border-border/50 hover:bg-muted/20">
                                                <td className="px-4 py-1.5 font-bold text-primary">{v.name}</td>
                                                <td className="px-4 py-1.5 truncate max-w-[150px]">{v.value}</td>
                                                <td className="px-4 py-1.5 text-muted-foreground">{v.size}</td>
                                                <td className="px-4 py-1.5 text-muted-foreground">{v.type}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2 bg-muted/50 border-b border-border text-sm font-semibold flex items-center gap-2"><LineChart size={16} /> Figure 1 (Plot)</div>
                        <div className="flex-1 p-4 flex items-center justify-center relative bg-background">
                            {!activePlot ? (
                                <div className="text-sm text-muted-foreground italic">No active plot. Try plotting a vector.</div>
                            ) : (
                                <div className="w-full h-full flex flex-col">
                                    <div className="text-center font-bold text-sm mb-2">{activePlot.title}</div>
                                    <div className="flex-1 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsLineChart data={activePlot.data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.2} />
                                                <XAxis dataKey="x" type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" tickFormatter={(val) => val.toFixed(1)} />
                                                <YAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" domain={['auto', 'auto']} />
                                                <RechartsTooltip
                                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace' }}
                                                    labelFormatter={(l) => `X: ${Number(l).toFixed(3)}`}
                                                    formatter={(v: number) => [v.toFixed(3), 'Y']}
                                                />
                                                <Line type="monotone" dataKey="y" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} isAnimationActive={!!activePlot} animationDuration={500} />
                                            </RechartsLineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

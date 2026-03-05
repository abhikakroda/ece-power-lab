import React, { useState, useRef, useMemo, useEffect } from "react";
import { MousePointer2, GitCommit, Square, Circle, Zap, Play, RotateCcw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildNetlist } from "@/lib/schematic-to-spice";
import { parseNetlist, solveDC, solveAC, solveTransient } from "@/lib/spice-engine";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";

// Minimalistic styling constants
const GRID_SIZE = 20;

type Tool = "pointer" | "wire" | "R" | "C" | "L" | "V" | "D" | "GND";

interface Point {
    x: number;
    y: number;
}

interface NodeMap {
    [nodeId: string]: Point[];
}

interface MappedComponent {
    id: string;
    type: Tool;
    name: string;
    val: string;
    x: number;
    y: number;
    rotation: number;
}

interface Wire {
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export default function SchematicSimulator() {
    const [activeTool, setActiveTool] = useState<Tool>("pointer");
    const [components, setComponents] = useState<MappedComponent[]>([]);
    const [wires, setWires] = useState<Wire[]>([]);
    const [selection, setSelection] = useState<string | null>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<Point | null>(null);
    const [currentMouse, setCurrentMouse] = useState<Point | null>(null);

    const [counter, setCounter] = useState(1);
    const svgRef = useRef<SVGSVGElement>(null);

    const [simResults, setSimResults] = useState<any>(null);
    const [simError, setSimError] = useState("");
    const [showPanel, setShowPanel] = useState(false);

    // Snap to grid
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    // Extract mouse position relative to SVG
    const getMousePos = (e: React.MouseEvent | React.TouchEvent | MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };

        let clientX, clientY;
        if ("touches" in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: (clientX - CTM.e) / CTM.a,
            y: (clientY - CTM.f) / CTM.d
        };
    };

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        const rawPos = getMousePos(e);
        const pos = { x: snap(rawPos.x), y: snap(rawPos.y) };

        if (activeTool === "wire") {
            setIsDrawing(true);
            setDrawStart(pos);
            setCurrentMouse(pos);
        } else if (activeTool !== "pointer") {
            // Place component
            let defaultVal = "1k";
            if (activeTool === "C") defaultVal = "1u";
            if (activeTool === "L") defaultVal = "1m";
            if (activeTool === "V") defaultVal = "5";
            if (activeTool === "GND") defaultVal = "0";

            const comp: MappedComponent = {
                id: `comp_${counter}`,
                type: activeTool,
                name: `${activeTool}${counter}`,
                val: defaultVal,
                x: pos.x,
                y: pos.y,
                rotation: 0, // default vertical
            };
            setComponents((prev) => [...prev, comp]);
            setCounter((c) => c + 1);
            setActiveTool("pointer"); // switch back to pointer after placement
        } else {
            // Clicked with pointer to select - handled by elements themselves
        }
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        if (isDrawing && drawStart) {
            const rawPos = getMousePos(e);
            setCurrentMouse({ x: snap(rawPos.x), y: snap(rawPos.y) });
        }
    };

    const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (isDrawing && drawStart && currentMouse) {
            // Don't add a 0-length wire
            if (drawStart.x !== currentMouse.x || drawStart.y !== currentMouse.y) {
                setWires((prev) => [
                    ...prev,
                    { id: `w_${Date.now()}`, startX: drawStart.x, startY: drawStart.y, endX: currentMouse.x, endY: currentMouse.y }
                ]);
            }
        }
        setIsDrawing(false);
        setDrawStart(null);
    };

    // Component rendering helpers
    const renderCompShape = (comp: MappedComponent, isSelected: boolean) => {
        const sColor = isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))";
        const stWidth = isSelected ? 3 : 2;

        switch (comp.type) {
            case "R":
                return (
                    <g transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`} onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }}>
                        <line x1="0" y1="-20" x2="0" y2="-10" stroke={sColor} strokeWidth={stWidth} />
                        <polyline points="-5,-10 5,-5 -5,0 5,5 -5,10 0,10" fill="none" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="0" y1="10" x2="0" y2="20" stroke={sColor} strokeWidth={stWidth} />
                        <text x="10" y="5" fontSize="12" fill="currentColor" className="text-muted-foreground font-mono">{comp.name}</text>
                    </g>
                );
            case "V":
                return (
                    <g transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`} onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }}>
                        <circle cx="0" cy="0" r="12" fill="none" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="0" y1="-20" x2="0" y2="-12" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="0" y1="12" x2="0" y2="20" stroke={sColor} strokeWidth={stWidth} />
                        <text x="-4" y="-2" fontSize="10" fill={sColor}>+</text>
                        <text x="-3" y="8" fontSize="14" fill={sColor}>-</text>
                        <text x="15" y="5" fontSize="12" fill="currentColor" className="text-muted-foreground font-mono">{comp.name}</text>
                    </g>
                );
            case "GND":
                return (
                    <g transform={`translate(${comp.x}, ${comp.y})`} onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }}>
                        <line x1="0" y1="-20" x2="0" y2="0" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="-10" y1="0" x2="10" y2="0" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="-6" y1="4" x2="6" y2="4" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="-2" y1="8" x2="2" y2="8" stroke={sColor} strokeWidth={stWidth} />
                    </g>
                );
            case "C":
                return (
                    <g transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`} onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }}>
                        <line x1="0" y1="-20" x2="0" y2="-4" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="-8" y1="-4" x2="8" y2="-4" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="-8" y1="4" x2="8" y2="4" stroke={sColor} strokeWidth={stWidth} />
                        <line x1="0" y1="4" x2="0" y2="20" stroke={sColor} strokeWidth={stWidth} />
                        <text x="10" y="5" fontSize="12" fill="currentColor" className="text-muted-foreground font-mono">{comp.name}</text>
                    </g>
                );
            default:
                return (
                    <circle cx={comp.x} cy={comp.y} r="5" fill="red" onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }} />
                );
        }
    };

    const handleClear = () => {
        setComponents([]);
        setWires([]);
        setSelection(null);
        setSimResults(null);
        setShowPanel(false);
    };

    // Node resolution for netlist extraction
    const buildElectricalNodes = () => {
        // 1. Collect all pins of all placed components
        // For simplicity: each R/V/C has pins at (0, -20) and (0, 20) relative to its center, rotated.
        const pinDefinitions: any[] = [];

        components.forEach((c) => {
            // Pin offsets before rotation
            const off1 = { x: 0, y: -20 };
            const off2 = { x: 0, y: 20 };

            const rad = c.rotation * (Math.PI / 180);
            const px1 = c.x + (off1.x * Math.cos(rad) - off1.y * Math.sin(rad));
            const py1 = c.y + (off1.x * Math.sin(rad) + off1.y * Math.cos(rad));

            const px2 = c.x + (off2.x * Math.cos(rad) - off2.y * Math.sin(rad));
            const py2 = c.y + (off2.x * Math.sin(rad) + off2.y * Math.cos(rad));

            // Exception for GND mapping
            if (c.type === "GND") {
                pinDefinitions.push({ compId: c.id, pinName: "1", x: c.x, y: c.y - 20, isGnd: true });
            } else {
                pinDefinitions.push({ compId: c.id, pinName: "1", x: Math.round(px1), y: Math.round(py1) });
                pinDefinitions.push({ compId: c.id, pinName: "2", x: Math.round(px2), y: Math.round(py2) });
            }
        });

        // 2. We use a Disjoint Set (Union-Find) approach to merge connected points
        // Points are connected if they are at the exact same coordinates OR if connected by a wire
        // Every pin and every wire endpoint is a "point".
        const points: { id: string, x: number, y: number }[] = [];
        pinDefinitions.forEach((p, i) => points.push({ id: `p_${i}`, x: p.x, y: p.y }));
        wires.forEach((w, i) => {
            points.push({ id: `ws_${i}`, x: w.startX, y: w.startY });
            points.push({ id: `we_${i}`, x: w.endX, y: w.endY });
        });

        const parent: Record<string, string> = {};
        const find = (i: string): string => {
            if (parent[i] === undefined) parent[i] = i;
            if (parent[i] === i) return i;
            return parent[i] = find(parent[i]);
        };
        const union = (i: string, j: string) => {
            const rootI = find(i);
            const rootJ = find(j);
            if (rootI !== rootJ) parent[rootI] = rootJ;
        };

        // Connect points sharing identical X,Y
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                if (points[i].x === points[j].x && points[i].y === points[j].y) {
                    union(points[i].id, points[j].id);
                }
            }
        }

        // Connect wire start to wire end
        wires.forEach((w, i) => {
            union(`ws_${i}`, `we_${i}`);
        });

        // Determine "0" (GND) nets
        const gndRoots = new Set<string>();
        pinDefinitions.forEach((p, i) => {
            if (p.isGnd) {
                gndRoots.add(find(`p_${i}`));
            }
        });

        // Map each pin to its electrical node ID
        let nextNodeId = 1;
        const rootToNodeId: Record<string, string> = {};
        const compPinsMap: Record<string, Record<string, string>> = {};

        pinDefinitions.forEach((p, i) => {
            if (p.isGnd) return; // don't track the GND symbol's own pin in standard map
            const r = find(`p_${i}`);
            let netId = "0";

            if (!gndRoots.has(r)) {
                if (!rootToNodeId[r]) {
                    rootToNodeId[r] = `${nextNodeId++}`;
                }
                netId = rootToNodeId[r];
            }

            if (!compPinsMap[p.compId]) compPinsMap[p.compId] = {};
            compPinsMap[p.compId][p.pinName] = netId;
        });

        return compPinsMap;
    };

    const handleSimulate = () => {
        try {
            setSimError("");
            const pinMappings = buildElectricalNodes();

            const internalSchematicFormat: any[] = components.map(c => ({
                id: c.id, type: c.type, name: c.name, value: c.val, nodes: [], x: c.x, y: c.y, rotation: c.rotation
            }));

            const rawNetlistStr = buildNetlist(internalSchematicFormat, pinMappings);
            console.log("Generated Netlist:\n" + rawNetlistStr);

            const { components: spiceComps, nodeCount } = parseNetlist(rawNetlistStr);
            if (spiceComps.length === 0) { throw new Error("Circuit is empty or unconnected."); }

            const dcResults = solveDC(spiceComps, nodeCount);

            setSimResults({ type: "dc", data: dcResults, nodeCount });
            setShowPanel(true);
            setActiveTool("pointer");

        } catch (err: any) {
            setSimError(err.message || "Simulation Failed");
            setShowPanel(true);
        }
    };


    const selectedComp = components.find(c => c.id === selection);

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden relative font-sans">
            {/* Floating Toolbar (Figma-style) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-full shadow-lg p-1.5 flex gap-1 animate-in slide-in-from-top-4">
                <Button variant={activeTool === "pointer" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full" onClick={() => setActiveTool("pointer")} title="Select Tool (V)">
                    <MousePointer2 size={16} />
                </Button>
                <div className="w-px h-6 bg-border mx-1 my-auto" />
                <Button variant={activeTool === "wire" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full relative" onClick={() => setActiveTool("wire")} title="Draw Wire (W)">
                    <GitCommit size={16} className="rotate-45" />
                    <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
                </Button>
                <Button variant={activeTool === "R" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full font-mono text-sm font-bold" onClick={() => setActiveTool("R")} title="Resistor (R)">
                    R
                </Button>
                <Button variant={activeTool === "C" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full font-mono text-sm font-bold" onClick={() => setActiveTool("C")} title="Capacitor (C)">
                    C
                </Button>
                <Button variant={activeTool === "V" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full font-mono text-sm font-bold" onClick={() => setActiveTool("V")} title="Voltage Source (V)">
                    Vs
                </Button>
                <Button variant={activeTool === "GND" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full flex flex-col items-center justify-center p-0" onClick={() => setActiveTool("GND")} title="Ground (G)">
                    <div className="w-3 h-px bg-foreground" />
                    <div className="w-2 h-px bg-foreground mt-[2px]" />
                    <div className="w-1 h-px bg-foreground mt-[2px]" />
                </Button>
                <div className="w-px h-6 bg-border mx-1 my-auto" />
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleClear} title="Clear Canvas">
                    <RotateCcw size={16} />
                </Button>
                <Button className="h-9 rounded-full ml-1 font-mono text-xs px-4" onClick={handleSimulate}>
                    <Play size={14} className="mr-1.5" /> SIM INFO
                </Button>
            </div>

            {/* Editor Canvas Canvas */}
            <div
                className="flex-1 bg-background relative cursor-crosshair overflow-hidden"
                onClick={() => { if (activeTool === "pointer") setSelection(null); }}
            >
                {/* SVG Dot Grid Background inside Defs or CSS, simpler via SVG pattern */}
                <svg
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <defs>
                        <pattern id="dotGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.5" className="fill-muted-foreground/30" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dotGrid)" />

                    {/* Wires */}
                    {wires.map(w => (
                        <g key={w.id} onClick={(e) => { e.stopPropagation(); setSelection(w.id); }}>
                            <line
                                x1={w.startX} y1={w.startY} x2={w.endX} y2={w.endY}
                                stroke={selection === w.id ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
                                strokeWidth={selection === w.id ? 3 : 2}
                            />
                            <circle cx={w.startX} cy={w.startY} r="4" fill="hsl(var(--foreground))" />
                            <circle cx={w.endX} cy={w.endY} r="4" fill="hsl(var(--foreground))" />
                        </g>
                    ))}

                    {/* Drawing Wire */}
                    {isDrawing && drawStart && currentMouse && (
                        <line x1={drawStart.x} y1={drawStart.y} x2={currentMouse.x} y2={currentMouse.y} stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4" />
                    )}

                    {/* Components */}
                    {components.map(c => renderCompShape(c, selection === c.id))}
                </svg>
            </div>

            {/* Property & Results Panel Overlay */}
            {showPanel && (
                <div className="w-[320px] h-full absolute right-0 top-0 bg-card border-l border-border shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-right-8 z-20">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Activity size={18} className="text-primary" /> SIM REPORTS
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPanel(false)}>
                            ×
                        </Button>
                    </div>

                    {simError ? (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg font-mono">
                            [SPICE ERROR]<br />{simError}
                        </div>
                    ) : simResults && simResults.type === "dc" ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">DC Operating Point</h4>
                                <div className="space-y-2">
                                    <div className="text-sm font-mono flex justify-between px-2 py-1 bg-muted/50 rounded">
                                        <span className="text-muted-foreground">Node 0 (GND)</span>
                                        <span>0.000 V</span>
                                    </div>
                                    {simResults.data.nodeVoltages.map((v: number, i: number) => {
                                        if (i === 0) return null;
                                        return (
                                            <div key={i} className="text-sm font-mono flex justify-between px-2 py-1 bg-muted rounded border border-border">
                                                <span className="text-muted-foreground">Node {i}</span>
                                                <span className="font-bold text-primary">{v.toFixed(3)} V</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">Branch Currents</h4>
                                <div className="space-y-2">
                                    {Array.from(simResults.data.branchCurrents.entries()).map(([name, current]: [string, any]) => (
                                        <div key={name} className="text-sm font-mono flex justify-between px-2 py-1 bg-muted rounded border border-border">
                                            <span className="text-muted-foreground">{name}</span>
                                            <span className="font-bold text-secondary">{(current * 1000).toFixed(3)} mA</span>
                                        </div>
                                    ))}
                                    {simResults.data.branchCurrents.size === 0 && (
                                        <div className="text-xs text-muted-foreground italic">No measurable V-source currents found.</div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border/50">
                                <p className="text-xs text-muted-foreground">Graphing features (AC Sweep & Transient Analysis) are enabled by attaching specific probe markers, coming to this panel soon.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">Run a simulation to view results.</div>
                    )}

                    {/* Component Inspector when selected */}
                    {selectedComp && (
                        <div className="mt-8 pt-8 border-t border-border">
                            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">Selected Component</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground">Name</label>
                                    <input type="text" className="w-full bg-muted border border-border px-2 py-1.5 rounded text-sm font-mono" value={selectedComp.name} readOnly />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground">Value</label>
                                    <input type="text" className="w-full bg-background border border-border focus:border-primary px-2 py-1.5 rounded text-sm font-mono"
                                        value={selectedComp.val}
                                        onChange={(e) => setComponents(components.map(c => c.id === selectedComp.id ? { ...c, val: e.target.value } : c))}
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                                    setComponents(components.map(c => c.id === selectedComp.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c))
                                }}>
                                    Rotate 90°
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => {
                                    setComponents(components.filter(c => c.id !== selectedComp.id));
                                    setSelection(null);
                                }}>
                                    Delete Node
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

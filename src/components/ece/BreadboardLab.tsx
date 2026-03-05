import React, { useState, useRef, useMemo } from "react";
import { MousePointer2, GitCommit, Zap, Play, RotateCcw, Activity, Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseNetlist, solveDC } from "@/lib/spice-engine";
import { buildNetlist } from "@/lib/schematic-to-spice";

// Physical Component Types
type CompType = "resistor" | "led" | "battery";
type Tool = "pointer" | "wire" | CompType;

interface Point { x: number; y: number }

interface BreadboardHole {
    id: string; // e.g., "A1", "B1", "PWR_POS_1"
    x: number;
    y: number;
    netId: string; // Internal grouping for the breadboard logic (e.g. column 1 is same net)
}

interface PlacedComponent {
    id: string;
    type: CompType;
    x: number;
    y: number;
    rotation: number;
    val: string;
    name: string;
    // Pin relative offsets from (x,y)
    pins: { id: string, name: string, xOff: number, yOff: number, connectedHole?: string }[];
    state?: any; // e.g. LED on/off
}

interface Wire {
    id: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startHole?: string;
    endHole?: string;
    color: string;
}

// Wire colors to cycle through
const WIRE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#14b8a6", "#d946ef"];

export default function BreadboardLab() {
    const [activeTool, setActiveTool] = useState<Tool>("pointer");
    const [components, setComponents] = useState<PlacedComponent[]>([]);
    const [wires, setWires] = useState<Wire[]>([]);
    const [selection, setSelection] = useState<string | null>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<Point | null>(null);
    const [currentMouse, setCurrentMouse] = useState<Point | null>(null);
    const [currentColorIdx, setCurrentColorIdx] = useState(0);

    const [counter, setCounter] = useState(1);
    const [simResults, setSimResults] = useState<any>(null);
    const [simError, setSimError] = useState("");
    const [showPanel, setShowPanel] = useState(false);

    const svgRef = useRef<SVGSVGElement>(null);

    // --- Breadboard Layout Math ---
    const boardX = 100;
    const boardY = 100;
    const holePitch = 15; // Distance between holes
    const cols = 30; // 30 columns of 5-hole terminal strips

    // Generate breadboard holes
    const holes = useMemo(() => {
        const h: BreadboardHole[] = [];

        // Top Power Rail (Red +, Black -)
        for (let c = 0; c < cols; c++) {
            h.push({ id: `PWR_TOP_POS_${c}`, x: boardX + 30 + c * holePitch, y: boardY + 20, netId: "VPWR_TOP" });
            h.push({ id: `PWR_TOP_NEG_${c}`, x: boardX + 30 + c * holePitch, y: boardY + 20 + holePitch, netId: "VGND_TOP" });
        }

        // Terminal Strips (Top Half A-E)
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < 5; r++) {
                h.push({ id: `TERM_TOP_${c}_${r}`, x: boardX + 30 + c * holePitch, y: boardY + 60 + r * holePitch, netId: `TERM_TOP_${c}` });
            }
        }

        // Terminal Strips (Bottom Half F-J)
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < 5; r++) {
                h.push({ id: `TERM_BOT_${c}_${r}`, x: boardX + 30 + c * holePitch, y: boardY + 150 + r * holePitch, netId: `TERM_BOT_${c}` });
            }
        }

        // Bottom Power Rail
        for (let c = 0; c < cols; c++) {
            h.push({ id: `PWR_BOT_POS_${c}`, x: boardX + 30 + c * holePitch, y: boardY + 240, netId: "VPWR_BOT" });
            h.push({ id: `PWR_BOT_NEG_${c}`, x: boardX + 30 + c * holePitch, y: boardY + 240 + holePitch, netId: "VGND_BOT" });
        }

        return h;
    }, [boardX, boardY, holePitch]);

    // Find nearest hole within snapping radius (10px)
    const getNearestHole = (x: number, y: number): BreadboardHole | null => {
        let bestDist = 15;
        let bestHole = null;
        for (const hole of holes) {
            const d = Math.sqrt(Math.pow(hole.x - x, 2) + Math.pow(hole.y - y, 2));
            if (d < bestDist) {
                bestDist = d;
                bestHole = hole;
            }
        }
        return bestHole;
    };

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
        return { x: (clientX - CTM.e) / CTM.a, y: (clientY - CTM.f) / CTM.d };
    };

    const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        const rawPos = getMousePos(e);
        // Snap to nearest hole if possible, otherwise use raw
        const nearest = getNearestHole(rawPos.x, rawPos.y);
        const pos = nearest ? { x: nearest.x, y: nearest.y } : rawPos;

        if (activeTool === "wire") {
            setIsDrawing(true);
            setDrawStart(pos);
            setCurrentMouse(pos);
        } else if (activeTool !== "pointer") {
            // Place new component
            let newComp: PlacedComponent;

            if (activeTool === "resistor") {
                newComp = {
                    id: `comp_${counter}`, type: "resistor", name: `R${counter}`, val: "1k", x: pos.x, y: pos.y, rotation: 0,
                    pins: [{ id: "p1", name: "1", xOff: 0, yOff: 0 }, { id: "p2", name: "2", xOff: 0, yOff: 4 * holePitch }]
                };
            } else if (activeTool === "led") {
                newComp = {
                    id: `comp_${counter}`, type: "led", name: `D${counter}`, val: "LED", x: pos.x, y: pos.y, rotation: 0,
                    pins: [{ id: "p1", name: "A", xOff: 0, yOff: 0 }, { id: "p2", name: "K", xOff: holePitch, yOff: 0 }]
                };
            } else if (activeTool === "battery") {
                newComp = {
                    id: `comp_${counter}`, type: "battery", name: `V${counter}`, val: "9", x: pos.x, y: pos.y, rotation: 0,
                    pins: [{ id: "p1", name: "+", xOff: 0, yOff: 0 }, { id: "p2", name: "-", xOff: 0, yOff: holePitch }]
                };
            } else {
                return;
            }

            setComponents([...components, newComp]);
            setCounter(c => c + 1);
            setActiveTool("pointer");
        }
    };

    const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const rawPos = getMousePos(e);

        if (isDrawing && drawStart) {
            const nearest = getNearestHole(rawPos.x, rawPos.y);
            setCurrentMouse(nearest ? { x: nearest.x, y: nearest.y } : rawPos);
        } else if (activeTool === "pointer" && selection && selection.startsWith("comp_")) {
            // Drag component logic (simplified: snap pin 1 to mouse)
            if (e.buttons === 1) { // Left click held
                const nearest = getNearestHole(rawPos.x, rawPos.y);
                const newX = nearest ? nearest.x : rawPos.x;
                const newY = nearest ? nearest.y : rawPos.y;

                setComponents(components.map(c => {
                    if (c.id === selection) {
                        return { ...c, x: newX, y: newY };
                    }
                    return c;
                }));
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        if (isDrawing && drawStart && currentMouse) {
            if (drawStart.x !== currentMouse.x || drawStart.y !== currentMouse.y) {
                setWires([...wires, {
                    id: `w_${Date.now()}`,
                    startX: drawStart.x, startY: drawStart.y,
                    endX: currentMouse.x, endY: currentMouse.y,
                    color: WIRE_COLORS[currentColorIdx % WIRE_COLORS.length]
                }]);
                setCurrentColorIdx(c => c + 1);
            }
        }
        setIsDrawing(false);
        setDrawStart(null);
    };

    // Rendering standard Breadboard SVG
    const renderBreadboard = () => {
        return (
            <g transform={`translate(${boardX}, ${boardY})`}>
                {/* Board base */}
                <rect x="0" y="0" width={100 + cols * holePitch} height={280} rx="10" fill="#fdfdfd" stroke="#e5e7eb" strokeWidth="2" />
                <rect x="5" y="5" width={90 + cols * holePitch} height={270} rx="8" fill="#f8fafc" />

                {/* Center divider spine */}
                <rect x="0" y="132" width={100 + cols * holePitch} height={16} fill="#e2e8f0" />

                {/* Red/Blue rail lines */}
                <line x1="20" y1="12" x2={80 + cols * holePitch} y2="12" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
                <line x1="20" y1="43" x2={80 + cols * holePitch} y2="43" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />

                <line x1="20" y1="232" x2={80 + cols * holePitch} y2="232" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
                <line x1="20" y1="263" x2={80 + cols * holePitch} y2="263" stroke="#3b82f6" strokeWidth="2" opacity="0.6" />

                {/* Render all holes */}
                {holes.map(h => (
                    <circle key={h.id} cx={h.x - boardX} cy={h.y - boardY} r="3.5" fill="#334155" />
                ))}
            </g>
        );
    };

    const renderComponent = (comp: PlacedComponent, isSelected: boolean) => {
        const isGlowing = comp.type === "led" && comp.state?.current && comp.state.current > 0.001; // > 1mA
        const isExploded = comp.type === "led" && comp.state?.current && comp.state.current > 0.04; // > 40mA

        return (
            <g
                key={comp.id}
                transform={`translate(${comp.x}, ${comp.y}) rotate(${comp.rotation})`}
                onClick={(e) => { e.stopPropagation(); setSelection(comp.id); }}
                className="cursor-move"
            >
                {isSelected && (
                    <rect x="-10" y="-10" width="40" height="70" fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="4 4" />
                )}

                {comp.type === "resistor" && (
                    <g>
                        {/* Leads */}
                        <line x1="0" y1="0" x2="0" y2="15" stroke="#9ca3af" strokeWidth="2" />
                        <line x1="0" y1={4 * holePitch - 15} x2="0" y2={4 * holePitch} stroke="#9ca3af" strokeWidth="2" />
                        {/* Body */}
                        <rect x="-6" y="15" width="12" height={4 * holePitch - 30} rx="4" fill="#deb887" stroke="#8b4513" strokeWidth="1" />
                        {/* Color Bands (Generic) */}
                        <line x1="-6" y1="20" x2="6" y2="20" stroke="#8b4513" strokeWidth="3" />
                        <line x1="-6" y1="28" x2="6" y2="28" stroke="#000000" strokeWidth="3" />
                        <line x1="-6" y1="36" x2="6" y2="36" stroke="#ff0000" strokeWidth="3" />
                        <line x1="-6" y1="44" x2="6" y2="44" stroke="#ffd700" strokeWidth="2" />
                    </g>
                )}

                {comp.type === "led" && (
                    <g>
                        {/* Leads */}
                        <line x1="0" y1="0" x2="0" y2="-15" stroke="#9ca3af" strokeWidth="2" /> {/* Anode (longer in real life, but mapped to 0,0) */}
                        <line x1={holePitch} y1="0" x2={holePitch} y2="-15" stroke="#9ca3af" strokeWidth="2" /> {/* Cathode */}
                        {/* Bulb body Base */}
                        <path d={`M -6 -15 L ${holePitch + 6} -15 L ${holePitch + 6} -20 L -6 -20 Z`} fill={isGlowing ? "#ef4444" : "#fca5a5"} stroke="#b91c1c" strokeWidth="1" />
                        {/* Bulb Dome */}
                        <path d={`M -5 -20 C -5 -35, ${holePitch + 5} -35, ${holePitch + 5} -20 Z`} fill={isGlowing ? "#ef4444" : "#fecaca"} stroke="#b91c1c" strokeWidth="1" opacity={isGlowing ? 1 : 0.8} />
                        {isGlowing && <circle cx={holePitch / 2} cy="-23" r="4" fill="#ffffff" opacity="0.6" filter="blur(1px)" />}

                        {isExploded && (
                            <g transform={`translate(${holePitch / 2}, -25)`}>
                                <polygon points="0,-15 5,-5 15,0 5,5 0,15 -5,5 -15,0 -5,-5" fill="#facc15" stroke="#ea580c" strokeWidth="2" />
                                <text x="-8" y="25" fontSize="10" fill="#ef4444" fontWeight="bold">BOOM</text>
                            </g>
                        )}
                    </g>
                )}

                {comp.type === "battery" && (
                    <g transform="translate(-15, -40)">
                        {/* 9V Body */}
                        <rect x="0" y="0" width="30" height="45" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
                        <rect x="0" y="25" width="30" height="20" fill="#eab308" />
                        <text x="15" y="38" fontSize="10" fill="#000" textAnchor="middle" fontWeight="bold">9V</text>
                        {/* Terminals */}
                        {/* Positive Terminal (mapped to 0,0 originally, offset handles it) */}
                        <circle cx="9" cy="-3" r="4" fill="#9ca3af" stroke="#4b5563" />
                        <polygon points="6,-6 12,-6 9,-10" fill="#ef4444" /> {/* Snap connector visual */}
                        <text x="9" y="10" fontSize="8" fill="#fff" textAnchor="middle">+</text>

                        {/* Negative Terminal */}
                        <polygon points="17,-6 27,-6 27,-2 17,-2" fill="#9ca3af" stroke="#4b5563" />
                        <text x="22" y="10" fontSize="8" fill="#fff" textAnchor="middle">-</text>

                        {/* Logical Pin Overlay hidden points mapping to component offsets */}
                    </g>
                )}
            </g>
        );
    };

    // --- Network Topology for SPICE ---
    const extractNetlist = () => {
        // 1. Group breadboard holes into electrical nodes (Nets) based on NetId
        const nodeGroups: Record<string, string[]> = {};

        // We treat every component pin and wire start/end as an electrical point
        // We union them if they snap to a hole, or if wires connect them
        const points: { id: string, x: number, y: number, isGnd?: boolean }[] = [];

        // Adding breadboard implicit wire connections inside tie blocks
        // This is handled by assigning nodes that land on same netId to union

        // A mapping from Physical (X,Y) to Breadboard NetID (if any)
        const getNetAt = (x: number, y: number) => {
            const h = getNearestHole(x, y);
            // Ensure it's very close
            if (h && Math.abs(h.x - x) < 5 && Math.abs(h.y - y) < 5) return h.netId;
            return `FREE_${Math.round(x)}_${Math.round(y)}`; // Free floating point
        };

        // Build the Union Find for all generated NetIDs and physical points
        const parent: Record<string, string> = {};
        const find = (i: string): string => {
            if (parent[i] === undefined) parent[i] = i;
            if (parent[i] === i) return i;
            return parent[i] = find(parent[i]);
        };
        const union = (i: string, j: string) => {
            const rI = find(i);
            const rJ = find(j);
            if (rI !== rJ) parent[rI] = rJ;
        };

        // Initialize all breadboard NetIDs so they exist
        holes.forEach(h => find(h.netId));

        // Connect wires (merging net at start with net at end)
        wires.forEach(w => {
            const netStart = getNetAt(w.startX, w.startY);
            const netEnd = getNetAt(w.endX, w.endY);
            union(netStart, netEnd);
        });

        // Map component pins
        const compPinsMap: Record<string, Record<string, string>> = {};
        let gndNetId: string | null = null;

        components.forEach(c => {
            compPinsMap[c.id] = {};
            c.pins.forEach(p => {
                // Calculate absolute position of pin
                const rad = c.rotation * (Math.PI / 180);
                const ax = Math.round(c.x + (p.xOff * Math.cos(rad) - p.yOff * Math.sin(rad)));
                const ay = Math.round(c.y + (p.xOff * Math.sin(rad) + p.yOff * Math.cos(rad)));

                const netLabel = getNetAt(ax, ay);
                const rootNet = find(netLabel);

                compPinsMap[c.id][p.name] = rootNet;

                // Heuristic: If it's a battery negative terminal, declare that root net as SPICE 0 (GND)
                if (c.type === "battery" && p.name === "-") {
                    gndNetId = rootNet;
                }
            });
        });

        // Translate all roots to SPICE node IDs (0, 1, 2...)
        // Ensure GND root is always "0", others are 1, 2, 3...
        let spiceNodeId = 1;
        const rootToSpiceNode: Record<string, string> = {};

        if (gndNetId) {
            rootToSpiceNode[gndNetId] = "0";
        }

        const finalPinMap: Record<string, Record<string, string>> = {};

        Object.keys(compPinsMap).forEach(compId => {
            finalPinMap[compId] = {};
            Object.keys(compPinsMap[compId]).forEach(pinName => {
                const root = compPinsMap[compId][pinName];
                if (rootToSpiceNode[root] === undefined) {
                    rootToSpiceNode[root] = `${spiceNodeId++}`;
                }
                finalPinMap[compId][pinName] = rootToSpiceNode[root];
            });
        });

        return finalPinMap;
    };

    const handleSimulate = () => {
        try {
            setSimError("");
            const nodeMap = extractNetlist();

            // Convert physical components to abstract schematic for SPICE translator
            const spiceComps = components.map(c => {
                let sType: string = "R";
                if (c.type === "battery") sType = "V";
                if (c.type === "led") sType = "D"; // D for Diode

                return {
                    id: c.id,
                    type: sType as any,
                    name: c.name,
                    value: c.val,
                    nodes: [], // Handled by nodeMap instead
                    x: c.x, y: c.y, rotation: c.rotation
                };
            });

            // Use our existing netlist generator but inject standard diode model if LED used
            let rawNetlistStr = buildNetlist(spiceComps, nodeMap);

            // Add LED model to netlist (Standard red LED approx)
            if (components.some(c => c.type === "led")) {
                rawNetlistStr += `\n.MODEL LED D(IS=1e-19 N=1.6 RS=2 BV=5 IBV=10u)\n`;
                // Search and replace Dx nodes to use 'LED' model
                // The buildNetlist outputs e.g. "D1 1 2 LED" (since 'LED' is the value passed)
            }

            console.log("Physical Breadboard Netlist:\n" + rawNetlistStr);

            const { components: parsedComps, nodeCount } = parseNetlist(rawNetlistStr);
            if (parsedComps.length === 0) throw new Error("Circuit lacks measurable components.");

            const dcResults = solveDC(parsedComps, nodeCount);
            setSimResults({ type: "dc", data: dcResults, nodeCount });
            setShowPanel(true);
            setActiveTool("pointer");

            // Reflect results onto visual components (e.g. LED glow)
            const updatedComps = components.map(c => {
                if (c.type === "led") {
                    // Find current through this diode
                    const current = dcResults.branchCurrents.get(c.name);
                    return { ...c, state: { current: Math.abs(current || 0) } };
                }
                return c;
            });
            setComponents(updatedComps);

        } catch (err: any) {
            setSimError(err.message || "Simulation Failed");
            setShowPanel(true);
        }
    };

    const handleClear = () => {
        setComponents([]);
        setWires([]);
        setSelection(null);
        setSimResults(null);
        setShowPanel(false);
    };

    const selectedComp = components.find(c => c.id === selection);

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden relative font-sans">
            {/* Tinkercad-style Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-card border border-border rounded-full shadow-lg p-1.5 flex gap-1 items-center animate-in slide-in-from-top-4">
                <Button variant={activeTool === "pointer" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full" onClick={() => setActiveTool("pointer")}>
                    <MousePointer2 size={16} />
                </Button>
                <Button variant={activeTool === "wire" ? "secondary" : "ghost"} size="icon" className="h-9 w-9 rounded-full relative" onClick={() => setActiveTool("wire")}>
                    <GitCommit size={16} className="rotate-45" />
                    <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: WIRE_COLORS[currentColorIdx % WIRE_COLORS.length] }} />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />

                {/* Component Palette Library */}
                <Button variant={activeTool === "resistor" ? "secondary" : "ghost"} size="sm" className="h-9 rounded-full gap-2" onClick={() => setActiveTool("resistor")}>
                    Resistor
                </Button>
                <Button variant={activeTool === "led" ? "secondary" : "ghost"} size="sm" className="h-9 rounded-full gap-2" onClick={() => setActiveTool("led")}>
                    LED
                </Button>
                <Button variant={activeTool === "battery" ? "secondary" : "ghost"} size="sm" className="h-9 rounded-full gap-2" onClick={() => setActiveTool("battery")}>
                    9V Battery
                </Button>

                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleClear}>
                    <RotateCcw size={16} />
                </Button>
                <Button className="h-9 rounded-full ml-1 font-mono text-xs px-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSimulate}>
                    <Play size={14} className="mr-1.5" /> Start Simulation
                </Button>
            </div>

            {/* Canvas */}
            <div
                className="flex-1 bg-[#e2e8f0] dark:bg-[#0f172a] relative overflow-hidden"
                onClick={() => { if (activeTool === "pointer") setSelection(null); }}
            >
                <svg
                    ref={svgRef}
                    className="absolute inset-0 w-full h-full"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    {/* Grid pattern (different from schematic, larger layout) */}
                    <defs>
                        <pattern id="boardGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.2" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#boardGrid)" />

                    {/* Render Physical Breadboard */}
                    {renderBreadboard()}

                    {/* Render Spline Wires (Tinkercad style curves) */}
                    {wires.map(w => {
                        const isSel = selection === w.id;
                        // Generate a nice bezier curve so it looks like a floppy jumper wire
                        const midY = w.startY - 30; // arch up slightly
                        const pathData = `M ${w.startX} ${w.startY} Q ${(w.startX + w.endX) / 2} ${midY}, ${w.endX} ${w.endY}`;

                        return (
                            <g key={w.id} onClick={(e) => { e.stopPropagation(); setSelection(w.id); }}>
                                <path d={pathData} fill="none" stroke={isSel ? "#ffffff" : "#1e293b"} strokeWidth={isSel ? 6 : 4} opacity={isSel ? 0.8 : 0.4} /> {/* drop shadow */}
                                <path d={pathData} fill="none" stroke={w.color} strokeWidth="3" /> {/* Core wire */}
                                <circle cx={w.startX} cy={w.startY} r="3" fill="#1e293b" /> {/* Pin headers */}
                                <circle cx={w.endX} cy={w.endY} r="3" fill="#1e293b" />
                            </g>
                        )
                    })}

                    {/* Render Active Drawing Line (Curve) */}
                    {isDrawing && drawStart && currentMouse && (
                        <path
                            d={`M ${drawStart.x} ${drawStart.y} Q ${(drawStart.x + currentMouse.x) / 2} ${drawStart.y - 30}, ${currentMouse.x} ${currentMouse.y}`}
                            fill="none"
                            stroke={WIRE_COLORS[currentColorIdx % WIRE_COLORS.length]}
                            strokeWidth="3"
                            opacity="0.7"
                        />
                    )}

                    {/* Render Components */}
                    {components.map(c => renderComponent(c, selection === c.id))}
                </svg>
            </div>

            {/* Side Panel for Inspector / Results */}
            {showPanel && (
                <div className="w-[320px] h-full absolute right-0 top-0 bg-card border-l border-border shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-right-8 z-20">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Activity size={18} className="text-primary" /> SIMULATOR LOGS
                        </h3>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPanel(false)}>
                            ×
                        </Button>
                    </div>

                    {simError ? (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg font-mono">
                            [ERROR]<br />{simError}
                        </div>
                    ) : simResults && simResults.type === "dc" ? (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">Nodes (Power Rails)</h4>
                                <div className="space-y-2">
                                    <div className="text-sm font-mono flex justify-between px-2 py-1 bg-muted/50 rounded border border-border">
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
                                <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">Components State</h4>
                                <div className="space-y-2">
                                    {components.map(c => {
                                        if (c.type === "led") {
                                            const current = simResults?.data?.branchCurrents?.get(c.name) || 0;
                                            const cMa = Math.abs(current) * 1000;
                                            let status = cMa > 40 ? "EXPLODED" : cMa > 1 ? "ON (Glowing)" : "OFF";
                                            let color = cMa > 40 ? "text-destructive" : cMa > 1 ? "text-emerald-500" : "text-muted-foreground";
                                            return (
                                                <div key={c.id} className="text-sm font-mono flex flex-col px-2 py-1.5 bg-muted rounded border border-border">
                                                    <div className="flex justify-between">
                                                        <span className="text-foreground font-bold">{c.name} (LED)</span>
                                                        <span className={color}>{status}</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1 text-right">{cMa.toFixed(3)} mA</div>
                                                </div>
                                            )
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">Run simulation to see debug data.</div>
                    )}

                    {/* Inspector */}
                    {selectedComp && (
                        <div className="mt-8 pt-8 border-t border-border">
                            <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-widest mb-3">Component Inspector</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground">Name</label>
                                    <input type="text" className="w-full bg-muted border border-border px-2 py-1.5 rounded text-sm font-mono" value={selectedComp.name} readOnly />
                                </div>
                                {selectedComp.type === "resistor" && (
                                    <div>
                                        <label className="text-[10px] text-muted-foreground">Resistance (e.g. 1k, 330)</label>
                                        <input type="text" className="w-full bg-background border border-border focus:border-primary px-2 py-1.5 rounded text-sm font-mono"
                                            value={selectedComp.val}
                                            onChange={(e) => setComponents(components.map(c => c.id === selectedComp.id ? { ...c, val: e.target.value } : c))}
                                        />
                                    </div>
                                )}
                                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                                    setComponents(components.map(c => c.id === selectedComp.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c))
                                }}>
                                    Rotate 90°
                                </Button>
                                <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => {
                                    setComponents(components.filter(c => c.id !== selectedComp.id));
                                    setSelection(null);
                                }}>
                                    Delete Object
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Delete wire if selection is a wire */}
                    {selection && selection.startsWith("w_") && (
                        <div className="mt-8 pt-8 border-t border-border">
                            <Button variant="ghost" size="sm" className="w-full text-xs text-destructive" onClick={() => {
                                setWires(wires.filter(w => w.id !== selection));
                                setSelection(null);
                            }}>
                                Delete Wire
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

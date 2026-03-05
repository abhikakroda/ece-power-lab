import React, { useState } from 'react';
import { Activity, Zap, Info, SlidersHorizontal } from 'lucide-react';

export default function BJTBandLab() {
    const [bjtType, setBjtType] = useState<"NPN" | "PNP">("NPN");
    const [vbe, setVbe] = useState(0.7); // Base-Emitter voltage (Forward bias typically)
    const [vcb, setVcb] = useState(5.0); // Collector-Base voltage (Reverse bias typically)

    // Doping (simplified 1-10 scale for visual offset, representing e.g. 10^15 to 10^19)
    const [nD_emitter, setNdEmitter] = useState(9); // N++
    const [nA_base, setNaBase] = useState(5);       // P
    const [nD_collector, setNdCollector] = useState(4); // N-

    // --- Physical Constants & Plotting Math (Not to scale, optimized for intuition) ---
    const widthE = 80;
    const widthB = 40; // Base is thin
    const widthC = 120; // Collector is wide
    const totalW = widthE + widthB + widthC;
    const height = 300;

    const midY = height / 2; // Intrinsic Fermi Level (Ei) baseline

    const getFermiOffset = (dopingType: "N" | "P", magnitude: number) => {
        // Offset from Intrinsic level. N moves up towards Ec, P moves down towards Ev.
        const maxOffset = 100;
        const value = (magnitude / 10) * maxOffset;
        return dopingType === "N" ? -value : value;
    };

    // Base state relative offsets
    const eEf = getFermiOffset(bjtType === "NPN" ? "N" : "P", nD_emitter);
    const bEf = getFermiOffset(bjtType === "NPN" ? "P" : "N", nA_base);
    const cEf = getFermiOffset(bjtType === "NPN" ? "N" : "P", nD_collector);

    // Apply bias voltages. 
    // In NPN: Vbe > 0 lowers the Base relative to Emitter (electrons flow E->B).
    //         Vcb > 0 raises Collector relative to Base (electrons fall down the slope B->C).
    // Emitter is reference (0).
    const eV_app = 0;
    // Visual scaling factor for voltage
    const vScale = 25;

    let bV_app = 0;
    let cV_app = 0;

    if (bjtType === "NPN") {
        bV_app = -vbe * vScale; // Base bands move down (forward bias, lowering barrier)
        cV_app = bV_app - vcb * vScale; // Collector bands move further down (reverse bias C-B junction)
    } else {
        bV_app = vbe * vScale; // Base bands move up (forward bias, lowering hole barrier)
        cV_app = bV_app + vcb * vScale; // Collector bands move higher (reverse bias for holes)
    }

    const bandgap = 140; // Ec to Ev distance visually
    const halfGap = bandgap / 2;

    // Final absolute Y positions for Ec (Conduction), Ev (Valence), Ef (Fermi)
    const e_Ef_y = midY + eEf + eV_app;
    const e_Ec_y = midY - halfGap + eV_app;
    const e_Ev_y = midY + halfGap + eV_app;

    const b_Ef_y = midY + bEf + bV_app;
    const b_Ec_y = midY - halfGap + bV_app;
    const b_Ev_y = midY + halfGap + bV_app;

    const c_Ef_y = midY + cEf + cV_app;
    const c_Ec_y = midY - halfGap + cV_app;
    const c_Ev_y = midY + halfGap + cV_app;

    // Depletion widths (simplified dependency on voltage + doping difference)
    // Higher reverse bias = wider depletion. Higher doping = narrower.
    const dw_EB = Math.max(5, 20 - (vbe * 10) - (nD_emitter + nA_base) / 2);
    const dw_BC = Math.max(10, 15 + (vcb * 3) - (nA_base + nD_collector) / 2);

    // X Coordinates for the junctions
    const x0 = 0; // Emitter left edge
    const x1 = widthE - (dw_EB / 2); // EB depletion start
    const x2 = widthE + (dw_EB / 2); // EB depletion end
    const x3 = widthE + widthB - (dw_BC / 2); // BC depletion start
    const x4 = widthE + widthB + (dw_BC / 2); // BC depletion end
    const x5 = totalW; // Collector right edge

    // Identify operating region based on voltages
    let region = "Cutoff";
    if (bjtType === "NPN") {
        if (vbe > 0.4 && vcb > 0) region = "Forward-Active";
        else if (vbe > 0.4 && vcb <= 0.4) region = "Saturation";
    } else {
        if (vbe > 0.4 && vcb > 0) region = "Forward-Active";
        else if (vbe > 0.4 && vcb <= 0.4) region = "Saturation";
    }
    if (vbe < 0.2 && vcb > 0) region = "Cutoff";
    if (vbe < 0 && vcb < 0) region = "Reverse-Active";

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Zap className="text-blue-500" /> BJT Energy Band Diagram
                        </h1>
                        <p className="text-muted-foreground mt-1">Visualize dynamic Fermi levels and depletion regions under bias.</p>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 flex gap-2 items-center">
                        <span className="font-semibold text-primary">Operating Region:</span>
                        <span className="font-mono">{region}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Controls Panel */}
                    <div className="space-y-6">
                        <div className="p-5 border border-border rounded-xl bg-card shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold flex items-center gap-2"><SlidersHorizontal size={18} /> Architecture</h3>
                                <div className="flex rounded-md overflow-hidden border border-border">
                                    <button className={`px-3 py-1 text-sm font-bold ${bjtType === 'NPN' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => setBjtType("NPN")}>NPN</button>
                                    <button className={`px-3 py-1 text-sm font-bold ${bjtType === 'PNP' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`} onClick={() => setBjtType("PNP")}>PNP</button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Bias Voltages</h4>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <label>V<sub>BE</sub> (Base-Emitter)</label>
                                            <span className="font-mono text-primary">{vbe.toFixed(2)} V</span>
                                        </div>
                                        <input type="range" min="-2" max="1.2" step="0.05" value={vbe} onChange={e => setVbe(parseFloat(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-sm mb-1">
                                            <label>V<sub>CB</sub> (Collector-Base)</label>
                                            <span className="font-mono text-primary">{vcb.toFixed(2)} V</span>
                                        </div>
                                        <input type="range" min="-2" max="15" step="0.5" value={vcb} onChange={e => setVcb(parseFloat(e.target.value))} className="w-full" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-border pt-4">
                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Doping Profiles</h4>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <label>Emitter ({bjtType[0]}) Doping $N_{bjtType === 'NPN' ? 'D' : 'A'}$</label>
                                            <span>10^{nD_emitter + 10} cm⁻³</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="1" value={nD_emitter} onChange={e => setNdEmitter(parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <label>Base ({bjtType[1]}) Doping $N_{bjtType === 'NPN' ? 'A' : 'D'}$</label>
                                            <span>10^{nA_base + 10} cm⁻³</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="1" value={nA_base} onChange={e => setNaBase(parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <label>Collector ({bjtType[2]}) Doping $N_{bjtType === 'NPN' ? 'D' : 'A'}$</label>
                                            <span>10^{nD_collector + 10} cm⁻³</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="1" value={nD_collector} onChange={e => setNdCollector(parseInt(e.target.value))} className="w-full" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-sm">
                            <Info size={16} className="inline mb-1 mr-1" />
                            <strong>Energy Band Mechanics:</strong>
                            <p className="mt-2 text-xs leading-relaxed">
                                In an NPN transistor, the Emitter is heavily doped N++, pushing the Fermi level (Ef) very close to the conduction band (Ec).
                                Applying a positive Vbe lowers the energy barrier for electrons, allowing them to explicitly diffuse into the thin Base region.
                                Because the Base is very thin, most electrons sweep across into the Collector, aided by the massive potential drop of the reverse-biased B-C junction.
                            </p>
                        </div>
                    </div>

                    {/* Visualization Canvas */}
                    <div className="lg:col-span-2 relative bg-[#1e293b] rounded-xl border border-slate-700 shadow-inner overflow-hidden flex items-center justify-center p-8">
                        <svg width="100%" height={height} viewBox={`-20 -20 ${totalW + 40} ${height + 40}`} className="overflow-visible">
                            {/* Background Grid */}
                            <defs>
                                <pattern id="bjtGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <rect width="20" height="20" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.3" />
                                </pattern>
                                {/* Depletion Region Gradient */}
                                <linearGradient id="depletionE" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#475569" stopOpacity="0.1" />
                                    <stop offset="50%" stopColor="#475569" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="#475569" stopOpacity="0.1" />
                                </linearGradient>
                            </defs>
                            <rect x={-20} y={-20} width={totalW + 40} height={height + 40} fill="url(#bjtGrid)" />

                            {/* Region Background Labels */}
                            <text x={x0 + widthE / 2} y={-5} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">EMITTER ({bjtType[0]}++)</text>
                            <text x={x1 + (x4 - x1) / 2} y={-5} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">BASE ({bjtType[1]})</text>
                            <text x={x4 + (x5 - x4) / 2} y={-5} fill="#94a3b8" fontSize="12" textAnchor="middle" fontWeight="bold">COLLECTOR ({bjtType[2]}-)</text>

                            {/* Depletion Regions */}
                            <rect x={x1} y={0} width={x2 - x1} height={height} fill="url(#depletionE)" />
                            <rect x={x3} y={0} width={x4 - x3} height={height} fill="url(#depletionE)" />
                            <text x={(x1 + x2) / 2} y={height + 15} fill="#94a3b8" fontSize="8" textAnchor="middle">EB Depletion</text>
                            <text x={(x3 + x4) / 2} y={height + 15} fill="#94a3b8" fontSize="8" textAnchor="middle">CB Depletion</text>

                            {/* --- Energy Band Lines --- */}
                            {/* Conduction Band (Ec) */}
                            <path d={`
                  M ${x0} ${e_Ec_y} L ${x1} ${e_Ec_y} 
                  Q ${(x1 + x2) / 2} ${(e_Ec_y + b_Ec_y) / 2}, ${x2} ${b_Ec_y}
                  L ${x3} ${b_Ec_y} 
                  Q ${(x3 + x4) / 2} ${(b_Ec_y + c_Ec_y) / 2}, ${x4} ${c_Ec_y}
                  L ${x5} ${c_Ec_y}
               `} fill="none" stroke="#ef4444" strokeWidth="3" />
                            <text x={x5 + 5} y={c_Ec_y + 4} fill="#ef4444" fontSize="12" fontWeight="bold">Ec</text>

                            {/* Valence Band (Ev) */}
                            <path d={`
                  M ${x0} ${e_Ev_y} L ${x1} ${e_Ev_y} 
                  Q ${(x1 + x2) / 2} ${(e_Ev_y + b_Ev_y) / 2}, ${x2} ${b_Ev_y}
                  L ${x3} ${b_Ev_y} 
                  Q ${(x3 + x4) / 2} ${(b_Ev_y + c_Ev_y) / 2}, ${x4} ${c_Ev_y}
                  L ${x5} ${c_Ev_y}
               `} fill="none" stroke="#3b82f6" strokeWidth="3" />
                            <text x={x5 + 5} y={c_Ev_y + 4} fill="#3b82f6" fontSize="12" fontWeight="bold">Ev</text>

                            {/* Fermi Levels (Quasi-Fermi explicitly drawn broken per region) */}
                            {/* Emitter Fermi */}
                            <line x1={x0} y1={e_Ef_y} x2={x1} y2={e_Ef_y} stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                            <text x={x0 - 15} y={e_Ef_y + 3} fill="#10b981" fontSize="10">Efn(E)</text>
                            {/* Base Fermi */}
                            <line x1={x2} y1={b_Ef_y} x2={x3} y2={b_Ef_y} stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                            <text x={x1 + (x2 - x1) / 2 - 5} y={b_Ef_y - 5} fill="#10b981" fontSize="10">Efp(B)</text>
                            {/* Collector Fermi */}
                            <line x1={x4} y1={c_Ef_y} x2={x5} y2={c_Ef_y} stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
                            <text x={x5 + 5} y={c_Ef_y + 4} fill="#10b981" fontSize="10">Efn(C)</text>

                            {/* Visual charge Carriers based on region (NPN) */}
                            {bjtType === 'NPN' && region === "Forward-Active" && (
                                <g>
                                    {/* Emitter injecting electrons into base */}
                                    <circle cx={x1 - 10} cy={e_Ec_y + 10} r="3" fill="#ef4444" className="animate-pulse" />
                                    <circle cx={x1 - 15} cy={e_Ec_y + 15} r="3" fill="#ef4444" className="animate-pulse" />
                                    <path d={`M ${x1 - 5} ${e_Ec_y + 10} Q ${(x1 + x2) / 2} ${e_Ec_y - 10}, ${x2 + 5} ${b_Ec_y - 5}`} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                                    {/* Electrons falling down BC slope to collector */}
                                    <circle cx={x3 + 5} cy={b_Ec_y - 5} r="3" fill="#ef4444" />
                                    <path d={`M ${x3} ${b_Ec_y - 5} Q ${(x3 + x4) / 2} ${b_Ec_y + 10}, ${x4 + 10} ${c_Ec_y - 5}`} fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="2 2" />
                                </g>
                            )}

                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

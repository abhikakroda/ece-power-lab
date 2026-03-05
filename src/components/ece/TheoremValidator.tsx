import React, { useState, useMemo } from 'react';
import { Activity, Zap, Play, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TheoremValidator() {
    // A simple circuit for Thevenin/Norton analysis:
    // Voltage Source Vs in series with R1, connected to a node A.
    // Node A has R2 to ground.
    // A Load Resistor RL is connected between Node A and ground.

    const [vs, setVs] = useState(12); // Source Voltage
    const [r1, setR1] = useState(4);  // Series Resistor (Ohms)
    const [r2, setR2] = useState(6);  // Parallel Resistor (Ohms)
    const [rl, setRl] = useState(5);  // Load Resistor (Ohms)

    const calcParams = useMemo(() => {
        // Thevenin Voltage (Open Circuit Voltage at A)
        // Vth = Vs * (R2 / (R1 + R2))
        const vth = vs * (r2 / (r1 + r2));

        // Thevenin Resistance (Kill sources: short Vs)
        // Rth = R1 || R2 = (R1 * R2) / (R1 + R2)
        const rth = (r1 * r2) / (r1 + r2);

        // Norton Current (Short Circuit Current at A)
        // In = Vth / Rth = Vs / R1
        const in_current = vth / rth;

        // Load Analysis
        // Current through Load: IL = Vth / (Rth + RL)
        const il = vth / (rth + rl);

        // Voltage across Load: VL = IL * RL
        const vl = il * rl;

        // Power to Load: PL = IL^2 * RL
        const pl = Math.pow(il, 2) * rl;

        // Max Power Transfer Condition: RL = Rth
        const p_max = Math.pow(vth / (2 * rth), 2) * rth;

        return { vth, rth, in_current, il, vl, pl, p_max };
    }, [vs, r1, r2, rl]);

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Zap className="text-yellow-500" /> Network Theorems & Op-Amps
                        </h1>
                        <p className="text-muted-foreground mt-1">Verify Thevenin, Norton, and Maximum Power Transfer theorems dynamically.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Circuit Definition & SVG */}
                    <div className="space-y-6">
                        <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                            <h3 className="font-semibold flex items-center gap-2 mb-6"><Calculator size={18} /> Circuit Topology</h3>

                            {/* SVG Circuit */}
                            <div className="relative h-[250px] w-full flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800 mb-6">
                                <svg width="350" height="200" viewBox="0 0 350 200">
                                    {/* V_s (Source) */}
                                    <circle cx="50" cy="100" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <text x="50" y="95" fontSize="12" fill="currentColor" textAnchor="middle">+</text>
                                    <text x="50" y="110" fontSize="12" fill="currentColor" textAnchor="middle">-</text>
                                    <text x="20" y="105" fontSize="14" fill="currentColor" fontWeight="bold">Vs</text>

                                    {/* Wiring from Source up and right to R1 */}
                                    <path d="M 50 85 L 50 50 L 80 50" stroke="currentColor" strokeWidth="2" fill="none" />

                                    {/* R1 (Series) */}
                                    <rect x="80" y="40" width="40" height="20" fill="none" stroke="#ef4444" strokeWidth="2" />
                                    <text x="100" y="30" fontSize="12" fill="#ef4444" textAnchor="middle" fontWeight="bold">R1</text>

                                    {/* Wiring to Node A */}
                                    <path d="M 120 50 L 180 50" stroke="currentColor" strokeWidth="2" fill="none" />
                                    <circle cx="180" cy="50" r="3" fill="currentColor" />
                                    <text x="170" y="35" fontSize="14" fill="currentColor" fontWeight="bold">Node A</text>

                                    {/* R2 (Parallel to Ground) */}
                                    <path d="M 180 50 L 180 70" stroke="currentColor" strokeWidth="2" fill="none" />
                                    <rect x="170" y="70" width="20" height="40" fill="none" stroke="#3b82f6" strokeWidth="2" />
                                    <text x="205" y="95" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">R2</text>
                                    <path d="M 180 110 L 180 150" stroke="currentColor" strokeWidth="2" fill="none" />

                                    {/* Wiring Node A to Load */}
                                    <path d="M 180 50 L 260 50" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                                    <circle cx="260" cy="50" r="4" fill="none" stroke="currentColor" strokeWidth="2" /> {/* Terminal A */}
                                    <text x="270" y="45" fontSize="12" fill="currentColor">A</text>

                                    {/* RL (Load) */}
                                    <path d="M 260 54 L 260 70" stroke="#10b981" strokeWidth="2" fill="none" />
                                    <rect x="250" y="70" width="20" height="40" fill="none" stroke="#10b981" strokeWidth="2" />
                                    <text x="285" y="95" fontSize="12" fill="#10b981" textAnchor="middle" fontWeight="bold">RL</text>
                                    <path d="M 260 110 L 260 146" stroke="#10b981" strokeWidth="2" fill="none" />

                                    <circle cx="260" cy="150" r="4" fill="none" stroke="currentColor" strokeWidth="2" /> {/* Terminal B */}
                                    <text x="270" y="165" fontSize="12" fill="currentColor">B</text>

                                    {/* Ground Rail & Connect to Source */}
                                    <path d="M 50 115 L 50 150 L 256 150" stroke="currentColor" strokeWidth="2" fill="none" />
                                    <circle cx="180" cy="150" r="3" fill="currentColor" />

                                    {/* Ground Symbol */}
                                    <path d="M 170 150 L 190 150 M 175 155 L 185 155 M 178 160 L 182 160" stroke="currentColor" strokeWidth="2" fill="none" />
                                </svg>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="font-bold">Vs (Source Voltage)</label>
                                        <span className="font-mono text-foreground">{vs} V</span>
                                    </div>
                                    <input type="range" min="1" max="50" value={vs} onChange={e => setVs(parseInt(e.target.value))} className="w-full" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-red-500 font-bold">R1 (Source Resistance)</label>
                                        <span className="font-mono text-foreground">{r1} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="50" value={r1} onChange={e => setR1(parseInt(e.target.value))} className="w-full accent-red-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-blue-500 font-bold">R2 (Shunt Resistance)</label>
                                        <span className="font-mono text-foreground">{r2} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="50" value={r2} onChange={e => setR2(parseInt(e.target.value))} className="w-full accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-emerald-500 font-bold">RL (Load Resistance)</label>
                                        <span className="font-mono text-foreground">{rl} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="50" value={rl} onChange={e => setRl(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Analysis Results Display */}
                    <div className="space-y-6">
                        <div className="p-6 border border-border rounded-xl bg-card shadow-sm space-y-6">
                            <h3 className="font-semibold flex items-center gap-2 border-b border-border pb-2">
                                <Activity size={18} className="text-primary" /> Equivalent Circuits (Terminals A-B)
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Thevenin Result */}
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <h4 className="font-bold text-sm mb-3">Thevenin Equivalent</h4>
                                    <div className="space-y-2 font-mono text-sm">
                                        <div className="flex justify-between"><span>V_TH:</span> <span className="text-primary">{calcParams.vth.toFixed(2)} V</span></div>
                                        <div className="flex justify-between"><span>R_TH:</span> <span className="text-primary">{calcParams.rth.toFixed(2)} Ω</span></div>
                                    </div>
                                </div>

                                {/* Norton Result */}
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <h4 className="font-bold text-sm mb-3">Norton Equivalent</h4>
                                    <div className="space-y-2 font-mono text-sm">
                                        <div className="flex justify-between"><span>I_N:</span> <span className="text-primary">{calcParams.in_current.toFixed(2)} A</span></div>
                                        <div className="flex justify-between"><span>R_N:</span> <span className="text-primary">{calcParams.rth.toFixed(2)} Ω</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border">
                                <h4 className="font-bold text-sm mb-3">Load Analysis (RL = {rl} Ω)</h4>
                                <div className="space-y-2 font-mono text-sm bg-background p-3 rounded border border-border">
                                    <div className="flex justify-between"><span>Load Voltage (V_L):</span> <span>{calcParams.vl.toFixed(2)} V</span></div>
                                    <div className="flex justify-between"><span>Load Current (I_L):</span> <span>{calcParams.il.toFixed(2)} A</span></div>
                                    <div className="flex justify-between text-emerald-500 font-bold"><span>Load Power (P_L):</span> <span>{calcParams.pl.toFixed(2)} W</span></div>
                                </div>
                            </div>

                            {/* Maximum Power Transfer Alert */}
                            <div className={`p-4 rounded-lg border ${Math.abs(rl - calcParams.rth) < 0.1 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-muted border-border'}`}>
                                <h4 className="font-bold text-sm mb-1 flex items-center gap-2">
                                    Maximum Power Transfer {Math.abs(rl - calcParams.rth) < 0.1 && <span className="text-emerald-500">ACHIEVED ✓</span>}
                                </h4>
                                <p className="text-xs text-muted-foreground mb-3">Occurs when $R_L = R_{'{TH}'}$. In this circuit, $R_L$ must be {calcParams.rth.toFixed(2)} Ω.</p>
                                <div className="font-mono text-sm">
                                    P_Max possible: <span className="text-primary">{calcParams.p_max.toFixed(2)} W</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

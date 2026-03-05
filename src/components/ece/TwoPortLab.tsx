import React, { useState, useMemo } from 'react';
import { Activity, Network, Calculator, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TwoPortLab() {
    // A simple T-network consisting of 3 resistors: Z1 (series 1), Z2 (series 2), Z3 (shunt)
    const [z1, setZ1] = useState(10);
    const [z2, setZ2] = useState(20);
    const [z3, setZ3] = useState(30);

    // We are dealing with purely resistive T-networks for simplicity here (Z = R)
    // General T-Network parameter conversion math (assuming linear, bilateral)

    const calcParams = useMemo(() => {
        try {
            // Impedance (Z) Parameters
            // Z11 = V1/I1 | I2=0 -> Z1 + Z3
            // Z12 = V1/I2 | I1=0 -> Z3
            // Z21 = V2/I1 | I2=0 -> Z3
            // Z22 = V2/I2 | I1=0 -> Z2 + Z3
            const Z = [
                [z1 + z3, z3],
                [z3, z2 + z3]
            ];

            const detZ = Z[0][0] * Z[1][1] - Z[0][1] * Z[1][0];

            // Admittance (Y) Parameters (Inverse of Z)
            // Y = Z^-1 = 1/det(Z) * [Z22, -Z12; -Z21, Z11]
            const Y = detZ !== 0 ? [
                [Z[1][1] / detZ, -Z[0][1] / detZ],
                [-Z[1][0] / detZ, Z[0][0] / detZ]
            ] : [[Infinity, Infinity], [Infinity, Infinity]];

            // Transmission (ABCD) Parameters
            // A = V1/V2 | I2=0 -> Z11/Z21
            // B = -V1/I2 | V2=0 -> detZ/Z21
            // C = I1/V2 | I2=0 -> 1/Z21
            // D = -I1/I2 | V2=0 -> Z22/Z21
            const ABCD = Z[1][0] !== 0 ? [
                [Z[0][0] / Z[1][0], detZ / Z[1][0]],
                [1 / Z[1][0], Z[1][1] / Z[1][0]]
            ] : [[Infinity, Infinity], [Infinity, Infinity]];

            // Hybrid (h) Parameters
            // h11 = V1/I1 | V2=0 -> detZ/Z22
            // h12 = V1/V2 | I1=0 -> Z12/Z22
            // h21 = I2/I1 | V2=0 -> -Z21/Z22
            // h22 = I2/V2 | I1=0 -> 1/Z22
            const H = Z[1][1] !== 0 ? [
                [detZ / Z[1][1], Z[0][1] / Z[1][1]],
                [-Z[1][0] / Z[1][1], 1 / Z[1][1]]
            ] : [[Infinity, Infinity], [Infinity, Infinity]];

            return { Z, Y, ABCD, H };
        } catch (e) {
            return null;
        }
    }, [z1, z2, z3]);

    const renderMatrix = (matrix: number[][], name: string, units?: [string, string, string, string]) => {
        if (!matrix || matrix[0][0] === Infinity) return <div className="text-red-500 font-mono text-sm">Singular Matrix (Cannot compute {name})</div>;

        return (
            <div className="bg-muted p-4 rounded-xl border border-border flex flex-col items-center">
                <h4 className="text-sm font-bold mb-2 text-foreground">{name} Matrix</h4>
                <div className="flex items-center gap-3 font-mono text-lg text-primary">
                    <div>[</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
                        <div>{matrix[0][0].toFixed(3)} <span className="text-xs text-muted-foreground">{units?.[0] || ''}</span></div>
                        <div>{matrix[0][1].toFixed(3)} <span className="text-xs text-muted-foreground">{units?.[1] || ''}</span></div>
                        <div>{matrix[1][0].toFixed(3)} <span className="text-xs text-muted-foreground">{units?.[2] || ''}</span></div>
                        <div>{matrix[1][1].toFixed(3)} <span className="text-xs text-muted-foreground">{units?.[3] || ''}</span></div>
                    </div>
                    <div>]</div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-[calc(100vh-80px)] overflow-y-auto bg-background p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Network className="text-indigo-500" /> 2-Port Network Analyzer
                        </h1>
                        <p className="text-muted-foreground mt-1">Define a generic T-network topology and solve for generalized parametres.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Circuit Definition & SVG */}
                    <div className="space-y-6">
                        <div className="p-6 border border-border rounded-xl bg-card shadow-sm">
                            <h3 className="font-semibold flex items-center gap-2 mb-6"><Calculator size={18} /> Network Topology (T-Section)</h3>

                            {/* SVG T-Network */}
                            <div className="relative h-[200px] w-full flex items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-slate-800 mb-6">
                                <svg width="300" height="150" viewBox="0 0 300 150">
                                    {/* Terminals Port 1 */}
                                    <circle cx="20" cy="40" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <circle cx="20" cy="110" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <text x="5" y="44" fontSize="12" fill="currentColor">V1</text>
                                    <path d="M 24 40 L 70 40" stroke="currentColor" strokeWidth="2" />
                                    <path d="M 24 110 L 276 110" stroke="currentColor" strokeWidth="2" /> {/* Bottom common rail */}

                                    {/* Z1 (Series) */}
                                    <rect x="70" y="30" width="50" height="20" fill="none" stroke="#ef4444" strokeWidth="2" />
                                    <text x="95" y="22" fontSize="12" fill="#ef4444" textAnchor="middle" fontWeight="bold">Z1</text>

                                    {/* Node A (Center) */}
                                    <circle cx="150" cy="40" r="3" fill="currentColor" />
                                    <path d="M 120 40 L 180 40" stroke="currentColor" strokeWidth="2" />

                                    {/* Z3 (Shunt) */}
                                    <path d="M 150 40 L 150 60" stroke="currentColor" strokeWidth="2" />
                                    <rect x="140" y="60" width="20" height="40" fill="none" stroke="#10b981" strokeWidth="2" />
                                    <text x="175" y="85" fontSize="12" fill="#10b981" textAnchor="middle" fontWeight="bold">Z3</text>
                                    <path d="M 150 100 L 150 110" stroke="currentColor" strokeWidth="2" />

                                    {/* Z2 (Series) */}
                                    <rect x="180" y="30" width="50" height="20" fill="none" stroke="#3b82f6" strokeWidth="2" />
                                    <text x="205" y="22" fontSize="12" fill="#3b82f6" textAnchor="middle" fontWeight="bold">Z2</text>
                                    <path d="M 230 40 L 276 40" stroke="currentColor" strokeWidth="2" />

                                    {/* Terminals Port 2 */}
                                    <circle cx="280" cy="40" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <circle cx="280" cy="110" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <text x="290" y="44" fontSize="12" fill="currentColor">V2</text>
                                </svg>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-red-500 font-bold">Z1 (Series 1 Impedance)</label>
                                        <span className="font-mono text-foreground">{z1} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="500" value={z1} onChange={e => setZ1(parseInt(e.target.value))} className="w-full accent-red-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-blue-500 font-bold">Z2 (Series 2 Impedance)</label>
                                        <span className="font-mono text-foreground">{z2} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="500" value={z2} onChange={e => setZ2(parseInt(e.target.value))} className="w-full accent-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <label className="text-emerald-500 font-bold">Z3 (Shunt Impedance)</label>
                                        <span className="font-mono text-foreground">{z3} Ω</span>
                                    </div>
                                    <input type="range" min="1" max="500" value={z3} onChange={e => setZ3(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-800 dark:text-orange-300 text-sm">
                            <strong>Symmetry & Reciprocity:</strong><br />
                            <ul className="list-disc ml-5 mt-2 space-y-1">
                                <li>If $Z_{11} = Z_{22}$ (i.e. Z1 = Z2), the network is <strong>Symmetrical</strong>.</li>
                                <li>If $Z_{12} = Z_{21}$ (or $AD-BC = 1$), the network is <strong>Reciprocal</strong> (composed of passive elements without dependent sources).</li>
                            </ul>
                        </div>

                    </div>

                    {/* Analysis Results Matrix Display */}
                    <div className="space-y-4">
                        {calcParams && (
                            <>
                                {/* Impedance (Z) */}
                                {renderMatrix(calcParams.Z, "Impedance (Z)", ["Ω", "Ω", "Ω", "Ω"])}

                                {/* Admittance (Y) */}
                                {renderMatrix(calcParams.Y, "Admittance (Y)", ["S", "S", "S", "S"])}

                                {/* Transmission (ABCD) */}
                                {renderMatrix(calcParams.ABCD, "Transmission (ABCD)", ["", "Ω", "S", ""])}

                                {/* Hybrid (h) */}
                                {renderMatrix(calcParams.H, "Hybrid (h)", ["Ω", "", "", "S"])}
                            </>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

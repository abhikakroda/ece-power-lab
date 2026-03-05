import { useState, useMemo } from "react";
import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { designAnalogFilter, sweepFilterResponse, type FilterParamSpec } from "@/lib/filter-engine";
import { cxMag } from "@/lib/spice-engine";

type FilterParamSpecWithOptional = FilterParamSpec & {
    fc: number; // Cutoff frequency (Hz)
    bw?: number; // Bandwidth (Hz) for BP/BS
    ripple?: number; // Passband ripple (dB) for Chebyshev
};

const presets: { name: string, desc: string, spec: FilterParamSpecWithOptional }[] = [
    { name: "Audio Anti-Alias", desc: "44.1kHz sampling LPF", spec: { type: "lowpass", approximation: "butterworth", order: 8, fc: 20000, ripple: 1 } },
    { name: "ECG Noise", desc: "Remove 50/60Hz hum LP", spec: { type: "lowpass", approximation: "chebyshev1", order: 4, fc: 40, ripple: 0.5 } },
    { name: "Subwoofer crossover", desc: "80Hz LPF", spec: { type: "lowpass", approximation: "butterworth", order: 4, fc: 80, ripple: 1 } },
    { name: "Human Voice HPF", desc: "Remove wind rumble", spec: { type: "highpass", approximation: "butterworth", order: 3, fc: 80, ripple: 1 } },
];

const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))",
};
const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };

const FilterDesignLab = () => {
    const [spec, setSpec] = useState<FilterParamSpec>({
        type: "lowpass",
        approximation: "butterworth",
        order: 4,
        fc: 1000,
        ripple: 1, // dB
    });

    // Re-compute filter TF and Bode Sweep when specs change
    const filterData = useMemo(() => {
        try {
            if (spec.fc <= 0 || spec.order < 1) return null;
            const tf = designAnalogFilter(spec);
            // Sweep from 1 decade below to 2 decades above cutoff
            const fStart = Math.max(0.1, spec.fc / 10);
            const fStop = spec.fc * 100;
            const sweep = sweepFilterResponse(tf, fStart, fStop, 300);
            return { tf, sweep };
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [spec]);

    const handleSpecChange = (key: keyof FilterParamSpec, val: any) => {
        setSpec(prev => ({ ...prev, [key]: val }));
    };

    const polyStr = (c: number[]) => {
        if (c.length === 0) return "0";
        if (c.length === 1) return c[0].toExponential(2);
        // Highest power first: s^n
        return c.map((v, i) => {
            if (Math.abs(v) < 1e-15) return null;
            const power = c.length - 1 - i;
            const coeff = Math.abs(v) === 1 && power > 0 ? "" : v.toExponential(2);
            const s = power === 0 ? coeff : power === 1 ? `${coeff}s` : `${coeff}s^${power}`;
            if (i === 0) return v < 0 ? `-${s}` : s;
            return v < 0 ? ` - ${s.replace("-", "")}` : ` + ${s}`;
        }).filter(Boolean).join("") || "0";
    };

    return (
        <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                    <ListFilter size={20} className="text-chart-2" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-foreground">Filter Design Lab</h2>
                    <p className="text-sm text-muted-foreground">Active Analog Filter Synthesis • Butterworth • Chebyshev</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                    <button key={p.name} onClick={() => setSpec(p.spec)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:border-chart-2/40 transition-all text-left group">
                        <div className="font-semibold text-foreground group-hover:text-chart-2">{p.name}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{p.desc}</div>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Specification Panel */}
                <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-card border border-border space-y-5">
                        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">FILTER SPECIFICATIONS</h3>

                        <div className="space-y-4">
                            {/* Filter Type */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Type</Label>
                                <div className="flex bg-muted p-1 rounded-lg">
                                    {(["lowpass", "highpass"] as const).map(t => (
                                        <button key={t} onClick={() => handleSpecChange("type", t)}
                                            className={cn("flex-1 text-xs py-1.5 rounded-md capitalize font-medium transition-colors",
                                                spec.type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}>{t}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Approximation */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Approximation</Label>
                                <select
                                    value={spec.approximation}
                                    onChange={(e) => handleSpecChange("approximation", e.target.value)}
                                    className="w-full bg-muted border border-border text-foreground text-sm rounded-md p-2 outline-none focus:border-chart-2"
                                >
                                    <option value="butterworth">Butterworth (Maximally Flat)</option>
                                    <option value="chebyshev1">Chebyshev Type I (Equiripple)</option>
                                </select>
                            </div>

                            {/* Order */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label className="text-xs text-muted-foreground">Filter Order (N)</Label>
                                    <span className="text-xs font-mono text-chart-2">{spec.order}</span>
                                </div>
                                <input type="range" min="1" max="10" step="1" value={spec.order}
                                    onChange={(e) => handleSpecChange("order", parseInt(e.target.value))}
                                    className="w-full accent-chart-2" />
                            </div>

                            {/* Cutoff Freq */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Cutoff Frequency (Hz)</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="number" min="1" value={spec.fc}
                                        onChange={(e) => handleSpecChange("fc", parseFloat(e.target.value) || 1000)}
                                        className="font-mono bg-muted border-border" />
                                    <span className="text-xs text-muted-foreground">Hz</span>
                                </div>
                            </div>

                            {/* Chebyshev Ripple */}
                            {spec.approximation === "chebyshev1" && (
                                <div className="space-y-2 animate-fade-in">
                                    <div className="flex justify-between">
                                        <Label className="text-xs text-muted-foreground">Passband Ripple (dB)</Label>
                                        <span className="text-xs font-mono text-destructive">{spec.ripple} dB</span>
                                    </div>
                                    <input type="range" min="0.1" max="5" step="0.1" value={spec.ripple}
                                        onChange={(e) => handleSpecChange("ripple", parseFloat(e.target.value))}
                                        className="w-full accent-destructive" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results / Visualizations */}
                <div className="lg:col-span-2 space-y-6">
                    {filterData ? (
                        <>
                            {/* Transfer Function Display */}
                            <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                                <div className="text-xs text-muted-foreground mb-1">COMPUTED TRANSFER FUNCTION H(s)</div>
                                <div className="p-4 rounded-lg bg-muted flex flex-col items-center justify-center overflow-x-auto">
                                    <div className="font-mono text-xs text-chart-2 whitespace-nowrap px-4">{polyStr(filterData.tf.num)}</div>
                                    <div className="w-full border-t border-muted-foreground/30 my-2 max-w-md" />
                                    <div className="font-mono text-[10px] text-chart-2 whitespace-nowrap px-4 opacity-80">{polyStr(filterData.tf.den)}</div>
                                </div>

                                {/* Prototype Poles */}
                                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="col-span-full text-xs text-muted-foreground font-mono mb-1">PROTOTYPE POLES (LHP)</div>
                                    {filterData.tf.poles.map((p, i) => (
                                        <div key={i} className="text-[10px] font-mono text-muted-foreground bg-background p-1.5 rounded border border-border/50">
                                            s{i + 1}: <span className={p.re >= 0 ? "text-destructive" : "text-foreground"}>
                                                {p.re.toFixed(3)} {p.im !== 0 ? (p.im > 0 ? "+ " : "- ") + Math.abs(p.im).toFixed(3) + "j" : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Magnitude Response */}
                            <div className="p-5 rounded-xl bg-card border border-border">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-xs text-muted-foreground">BODE MAGNITUDE RESPONSE (dB)</div>
                                    <div className="px-2 py-0.5 rounded text-[10px] font-mono bg-chart-2/20 text-chart-2 border border-chart-2/30">
                                        fc = {spec.fc} Hz
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={filterData.sweep}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="freq" tick={tickStyle} scale="log" domain={["auto", "auto"]} type="number"
                                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)} />
                                        <YAxis tick={tickStyle} label={{ value: "Magnitude (dB)", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                                        <Tooltip contentStyle={tooltipStyle}
                                            formatter={(val: number) => [val.toFixed(2) + " dB", "Magnitude"]}
                                            labelFormatter={(label: number) => `${label.toFixed(1)} Hz`} />

                                        {/* -3dB line and Cutoff marking */}
                                        <ReferenceLine x={spec.fc} stroke="hsl(var(--chart-4))" strokeDasharray="3 3" opacity={0.5} />
                                        <ReferenceLine y={-3} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />

                                        <Line type="monotone" dataKey="magnitude" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center p-10 border border-dashed rounded-xl border-border text-muted-foreground text-sm">
                            Invalid specifications for filter design.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FilterDesignLab;

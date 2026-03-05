import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Activity, Waves, Zap, Info } from "lucide-react";
import { calculatePropagationParams, formatEng, MediumProperties } from "@/lib/emft-engine";

const PRESET_MEDIA: Record<string, MediumProperties> = {
    freespace: { epsilonR: 1, muR: 1, sigma: 0 },
    copper: { epsilonR: 1, muR: 1, sigma: 5.8e7 },
    seawater: { epsilonR: 81, muR: 1, sigma: 4 },
    fr4: { epsilonR: 4.4, muR: 1, sigma: 0.001 }, // Typical PCB substrate
    teflon: { epsilonR: 2.1, muR: 1, sigma: 0 }, // common in coax
};

const EMFTLab = () => {
    // Input State
    const [freqMagnitude, setFreqMagnitude] = useState(1); // 1
    const [freqMultiplier, setFreqMultiplier] = useState(1e9); // GHz default
    const [mediumKey, setMediumKey] = useState("freespace");

    // Custom Medium State (in case user selects custom)
    const [customEpsilon, setCustomEpsilon] = useState(1);
    const [customMu, setCustomMu] = useState(1);
    const [customSigma, setCustomSigma] = useState(0);

    const frequency = freqMagnitude * freqMultiplier;

    const currentMedium = useMemo(() => {
        if (mediumKey === "custom") {
            return { epsilonR: customEpsilon, muR: customMu, sigma: customSigma };
        }
        return PRESET_MEDIA[mediumKey];
    }, [mediumKey, customEpsilon, customMu, customSigma]);

    // Math Engine Calculations
    const results = useMemo(() => {
        return calculatePropagationParams({ frequency, medium: currentMedium });
    }, [frequency, currentMedium]);

    // SVG Animation State
    const [time, setTime] = useState(0);
    useEffect(() => {
        let animationFrame: number;
        const animate = () => {
            setTime(t => (t + 0.05) % (Math.PI * 2));
            animationFrame = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animationFrame);
    }, []);

    // Generate 3D SVG Wave Paths
    const wavePaths = useMemo(() => {
        const W = 600;
        const H = 300;
        const steps = 150;

        // SVG transform parameters to fake 3D
        const zScale = W / 10; // How many z-units fit in width
        const eAmp = H / 3;
        const hAmp = H / 4;

        let pathE = `M 50 ${H / 2}`;
        let pathH = `M 50 ${H / 2}`;

        // To make visualization reasonable regardless of actual frequency/beta:
        // We normalize the plot so that 1 cycle = W/2 pixels, UNLESS attenuation is extreme
        // We want to show the attenuation effect visually.
        const visAlpha = Math.min(results.alpha / results.beta, 2); // Cap visual attenuation
        const visBeta = (Math.PI * 4) / (W - 100); // 2 cycles across the screen

        for (let i = 0; i <= steps; i++) {
            const xCanvas = 50 + (i / steps) * (W - 100);
            const z = i; // nominal z distance

            // Attenuation envelope: e^(-alpha * z)
            const envelope = Math.exp(-visAlpha * (z * visBeta));

            // E-field (blue, vertical: y axis)
            // E(z,t) = E0 * e^(-az) * cos(wt - bz)
            const eY = Math.cos(time - visBeta * z) * envelope;
            const screenYE = H / 2 - (eAmp * eY);
            pathE += ` L ${xCanvas} ${screenYE}`;

            // H-field (orange, horizontal: x axis in 3D, we slant it in 2D SVG to fake 3D)
            // H(z,t) = (E0/eta) * e^(-az) * cos(wt - bz - phase(eta))
            const phaseDelay = results.etaPhase;
            const hVal = Math.cos(time - visBeta * z - phaseDelay) * envelope;

            // Fake 3D projection for H-field (slant it down-right)
            const slantX = xCanvas + (hVal * hAmp * 0.5);
            const screenYH = H / 2 + (hVal * hAmp * 0.5);
            pathH += ` L ${slantX} ${screenYH}`;
        }

        // Add plane of incidence axes
        const axes = (
            <>
                {/* Z axis (direction of propagation) */}
                <line x1="50" y1={H / 2} x2={W - 30} y2={H / 2} stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeDasharray="4 4" />
                <text x={W - 20} y={H / 2 + 5} fill="hsl(var(--muted-foreground))" fontSize="12" fontFamily="monospace">z</text>

                {/* Y-axis (E-field polarization) */}
                <line x1="50" y1="20" x2="50" y2={H - 20} stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />
                <text x="45" y="15" fill="hsl(200 80% 60%)" fontSize="12" fontFamily="monospace" textAnchor="end">E (V/m)</text>

                {/* X-axis (H-field polarization, slanted) */}
                <line x1="20" y1={H / 2 - 30} x2="80" y2={H / 2 + 30} stroke="hsl(var(--muted-foreground))" strokeWidth="2" opacity="0.3" />
                <text x="85" y={H / 2 + 40} fill="hsl(30 90% 55%)" fontSize="12" fontFamily="monospace">H (A/m)</text>
            </>
        );

        return { pathE, pathH, viewBox: `0 0 ${W} ${H}`, axes };
    }, [results, time]);


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <Waves className="text-primary w-8 h-8" />
                    EMFT & Wave Propagation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Analyze electromagnetic plane wave propagation through various media.
                    Observe impedance, attenuation, and phase velocity changes interactively.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Parameters */}
                <Card className="p-6 bg-card border-border lg:col-span-1 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity size={18} /> Signal Source</h3>
                        <div className="space-y-3">
                            <Label>Frequency (f)</Label>
                            <div className="flex gap-2">
                                <Input type="number" value={freqMagnitude} onChange={(e) => setFreqMagnitude(Number(e.target.value))} className="font-mono bg-background" />
                                <Select value={freqMultiplier.toString()} onValueChange={(v) => setFreqMultiplier(Number(v))}>
                                    <SelectTrigger className="w-24 bg-background font-mono">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Hz</SelectItem>
                                        <SelectItem value="1000">kHz</SelectItem>
                                        <SelectItem value="1000000">MHz</SelectItem>
                                        <SelectItem value="1000000000">GHz</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                                Current: {formatEng(freqMagnitude * freqMultiplier, "Hz")}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Zap size={18} /> Propagation Medium</h3>
                        <div className="space-y-3">
                            <Label>Material</Label>
                            <Select value={mediumKey} onValueChange={setMediumKey}>
                                <SelectTrigger className="font-mono bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="freespace">Free Space (Air / Vacuum)</SelectItem>
                                    <SelectItem value="fr4">FR-4 (PCB Substrate, Lossless)</SelectItem>
                                    <SelectItem value="teflon">Teflon (Coax Cable)</SelectItem>
                                    <SelectItem value="seawater">Seawater (Lossy Dielectric)</SelectItem>
                                    <SelectItem value="copper">Copper (Good Conductor)</SelectItem>
                                    <SelectItem value="custom">Custom Parameters...</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {mediumKey === "custom" ? (
                            <div className="space-y-4 pt-2 animate-fade-in bg-muted/30 p-3 rounded-lg border border-border">
                                <div className="space-y-2">
                                    <Label className="text-xs">Relative Permittivity (εᵣ)</Label>
                                    <Input type="number" step="0.1" value={customEpsilon} onChange={e => setCustomEpsilon(Number(e.target.value))} className="h-8 font-mono text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Relative Permeability (μᵣ)</Label>
                                    <Input type="number" step="0.1" value={customMu} onChange={e => setCustomMu(Number(e.target.value))} className="h-8 font-mono text-sm" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Conductivity σ (S/m)</Label>
                                    <Input type="number" step="any" value={customSigma} onChange={e => setCustomSigma(Number(e.target.value))} className="h-8 font-mono text-sm" />
                                </div>
                            </div>
                        ) : (
                            <div className="pt-2">
                                <div className="flex justify-between items-center text-xs font-mono mb-1">
                                    <span className="text-muted-foreground">εᵣ:</span><span>{currentMedium.epsilonR}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono mb-1">
                                    <span className="text-muted-foreground">μᵣ:</span><span>{currentMedium.muR}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono">
                                    <span className="text-muted-foreground">σ:</span><span>{currentMedium.sigma} S/m</span>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Results and Visualization */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-1 bg-background border-border overflow-hidden">
                        <div className="bg-card w-full aspect-video md:aspect-[21/9] flex items-center justify-center p-4 relative">
                            {/* Info badge */}
                            <div className="absolute top-4 left-4 border border-primary/20 bg-primary/10 text-primary px-3 py-1 rounded text-xs font-mono font-bold">
                                {results.mediumType.toUpperCase()}
                            </div>
                            {/* Wave equation overlay */}
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-muted-foreground bg-background/80 p-2 rounded backdrop-blur">
                                <span className="text-[hsl(200,80%,60%)]">E(z,t) = E₀ e^{results.alpha > 0 ? `-${formatEng(results.alpha)}z` : ''} cos(ωt - {formatEng(results.beta)}z) u_y</span>
                                <span className="text-[hsl(30,90%,55%)]">H(z,t) = (E₀/{formatEng(results.etaMag)}Ω) e^{results.alpha > 0 ? `-${formatEng(results.alpha)}z` : ''} cos(ωt - {formatEng(results.beta)}z - {results.etaPhaseDeg.toFixed(1)}°) u_x</span>
                            </div>

                            {/* The dynamic 3D-ish SVG */}
                            <svg viewBox={wavePaths.viewBox} className="w-full h-full">
                                {wavePaths.axes}
                                {/* H field shadow */}
                                <path d={wavePaths.pathH} fill="none" stroke="hsl(30 90% 55%)" strokeWidth="4" opacity="0.3" style={{ filter: 'blur(2px)' }} />
                                {/* H field */}
                                <path d={wavePaths.pathH} fill="none" stroke="hsl(30 90% 55%)" strokeWidth="2.5" />

                                {/* E field shadow */}
                                <path d={wavePaths.pathE} fill="none" stroke="hsl(200 80% 60%)" strokeWidth="4" opacity="0.3" style={{ filter: 'blur(2px)' }} />
                                {/* E field */}
                                <path d={wavePaths.pathE} fill="none" stroke="hsl(200 80% 60%)" strokeWidth="2.5" />
                            </svg>
                        </div>
                    </Card>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricBox label="Attenuation (α)" value={formatEng(results.alpha, "Np/m")} highlight={results.alpha > 0.1 ? "text-destructive" : "text-primary"} />
                        <MetricBox label="Phase Const (β)" value={formatEng(results.beta, "rad/m")} highlight="text-foreground" />
                        <MetricBox label="Intrinsic Imped." value={`${formatEng(results.etaMag, "Ω")} ∠${results.etaPhaseDeg.toFixed(1)}°`} highlight="text-primary" />
                        <MetricBox label="Skin Depth (δ)" value={formatEng(results.skinDepth, "m")} highlight={results.skinDepth < 1 ? "text-chart-3" : "text-foreground"} />
                        <MetricBox label="Phase Vel. (v_p)" value={formatEng(results.vp, "m/s")} highlight="text-chart-4" />
                        <MetricBox label="Wavelength (λ)" value={formatEng(results.lambda, "m")} highlight="text-foreground" />
                        <MetricBox label="Loss Tangent" value={formatEng(results.lossTangent)} highlight="text-foreground" />
                        <MetricBox label="Regime" value={results.mediumType} highlight={results.lossTangent > 100 ? "text-chart-2" : "text-primary"} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const MetricBox = ({ label, value, highlight }: { label: string, value: string, highlight: string }) => (
    <Card className="p-4 bg-card border-border">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-mono">{label}</div>
        <div className={`text-lg font-mono font-bold ${highlight}`}>{value}</div>
    </Card>
);

export default EMFTLab;

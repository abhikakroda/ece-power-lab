import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Plus, Trash2, Radio, BarChart3, Waves } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { generateSignal, calculateSpectrum, SignalComponent } from "@/lib/dsp-engine";

const DSPLab = () => {
    const [signals, setSignals] = useState<SignalComponent[]>([
        { type: 'sine', amplitude: 1, frequency: 10, phase: 0 },
    ]);

    // FFT Parameters
    const sampleRate = 1000; // Hz
    const numSamples = 1024; // Must be power of 2 for radix-2 FFT

    const handleAddSignal = () => {
        setSignals([...signals, { type: 'sine', amplitude: 0.5, frequency: 50, phase: 0 }]);
    };

    const handleRemoveSignal = (index: number) => {
        setSignals(signals.filter((_, i) => i !== index));
    };

    const updateSignal = (index: number, updates: Partial<SignalComponent>) => {
        const newSignals = [...signals];
        newSignals[index] = { ...newSignals[index], ...updates };
        setSignals(newSignals);
    };

    // DSP Math Execution
    const { timeData, freqData } = useMemo(() => {
        // 1. Generate Combined Time-Domain Signal
        const rawSignal = generateSignal(signals, sampleRate, numSamples);

        // Format for Recharts Time Domain
        const timeData = rawSignal.map((val, idx) => ({
            time: (idx / sampleRate).toFixed(3),
            amplitude: val
        })).slice(0, 500); // Only show first 500 points so it's readable

        // 2. Perform FFT for Frequency Domain
        const { frequencies, magnitudes, phases, maxMag } = calculateSpectrum(rawSignal, sampleRate);

        // Format for Recharts Frequency Domain
        const freqData = [];
        // Only show up to Nyquist or a reasonable cutoff (e.g., 200Hz if that's all the user generated)
        const maxPlotFreq = 250;
        for (let i = 0; i < frequencies.length; i++) {
            if (frequencies[i] > maxPlotFreq) break;
            freqData.push({
                frequency: frequencies[i],
                magnitude: magnitudes[i],
                phase: phases[i]
            });
        }

        return { timeData, freqData };
    }, [signals]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <Activity className="text-primary w-8 h-8" />
                    Digital Signal Processing (DSP)
                </h1>
                <p className="text-muted-foreground mt-2">
                    Synthesize composite signals and analyze their frequency spectrum using the Fast Fourier Transform (FFT).
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Signal Composer Sidebar */}
                <Card className="p-6 bg-card border-border lg:col-span-1 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Waves size={18} /> Signal Composer</h3>
                        <Button onClick={handleAddSignal} variant="outline" size="sm" className="h-8 gap-1">
                            <Plus size={14} /> Add
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {signals.map((sig, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-4 relative group">
                                {signals.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleRemoveSignal(idx)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}

                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/20 text-primary p-1.5 rounded-md">
                                        <Radio size={16} />
                                    </div>
                                    <span className="font-mono text-sm font-bold">Signal {idx + 1}</span>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground uppercase">Waveform</Label>
                                        <Select value={sig.type} onValueChange={(v: any) => updateSignal(idx, { type: v })}>
                                            <SelectTrigger className="h-8 font-mono text-sm bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="sine">Sine Wave</SelectItem>
                                                <SelectItem value="square">Square Wave</SelectItem>
                                                <SelectItem value="sawtooth">Sawtooth</SelectItem>
                                                <SelectItem value="noise">White Noise</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {sig.type !== 'noise' && (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs text-muted-foreground uppercase">Frequency</Label>
                                                <span className="text-xs font-mono">{sig.frequency} Hz</span>
                                            </div>
                                            <Slider
                                                value={[sig.frequency]}
                                                min={1}
                                                max={100}
                                                step={1}
                                                onValueChange={(val) => updateSignal(idx, { frequency: val[0] })}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xs text-muted-foreground uppercase">Amplitude</Label>
                                            <span className="text-xs font-mono">{sig.amplitude.toFixed(2)} V</span>
                                        </div>
                                        <Slider
                                            value={[sig.amplitude]}
                                            min={0.1}
                                            max={5}
                                            step={0.1}
                                            onValueChange={(val) => updateSignal(idx, { amplitude: val[0] })}
                                        />
                                    </div>

                                    {sig.type !== 'noise' && (
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-xs text-muted-foreground uppercase">Phase Shift</Label>
                                                <span className="text-xs font-mono">{sig.phase}°</span>
                                            </div>
                                            <Slider
                                                value={[sig.phase]}
                                                min={0}
                                                max={360}
                                                step={15}
                                                onValueChange={(val) => updateSignal(idx, { phase: val[0] })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Visualizers */}
                <div className="lg:col-span-2 space-y-6">
                    <Tabs defaultValue="time">
                        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                            <TabsTrigger value="time" className="font-mono gap-2"><Activity size={16} /> Time Domain</TabsTrigger>
                            <TabsTrigger value="freq" className="font-mono gap-2"><BarChart3 size={16} /> Frequency Domain (FFT)</TabsTrigger>
                        </TabsList>

                        <TabsContent value="time" className="mt-4">
                            <Card className="p-4 bg-background border-border">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-mono text-muted-foreground">x(t) = Σ signals</h3>
                                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded">Fs = {sampleRate} Hz</div>
                                </div>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={timeData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={12}
                                                tickFormatter={(val) => `${val}s`}
                                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                                tickMargin={10}
                                            />
                                            <YAxis
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={12}
                                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                                domain={['auto', 'auto']}
                                                width={40}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                                                formatter={(value: number) => [value.toFixed(3) + ' V', 'Amplitude']}
                                                labelFormatter={(label) => `Time: ${label}s`}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="amplitude"
                                                stroke="hsl(var(--primary))"
                                                strokeWidth={2}
                                                dot={false}
                                                isAnimationActive={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="freq" className="mt-4">
                            <Card className="p-4 bg-background border-border">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-sm font-mono text-muted-foreground">|X(f)| Magnitude Spectrum</h3>
                                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded">N = {numSamples}</div>
                                </div>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={freqData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                                            <defs>
                                                <linearGradient id="colorMag" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.5} />
                                                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
                                            <XAxis
                                                dataKey="frequency"
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={12}
                                                tickFormatter={(val) => `${val.toFixed(0)} Hz`}
                                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                                tickMargin={10}
                                            />
                                            <YAxis
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={12}
                                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                                width={40}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                                                formatter={(value: number) => [value.toFixed(3), 'Magnitude']}
                                                labelFormatter={(label) => `Freq: ${Number(label).toFixed(1)} Hz`}
                                            />
                                            <Area
                                                type="step"
                                                dataKey="magnitude"
                                                stroke="hsl(var(--chart-2))"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorMag)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default DSPLab;

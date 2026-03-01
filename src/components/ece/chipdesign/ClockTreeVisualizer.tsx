import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface ClockNode {
  id: string;
  label: string;
  x: number;
  y: number;
  bufferDelay: number; // ps
  wireDelay: number; // ps
  parent: string | null;
  isFlipFlop: boolean;
}

const defaultTree: ClockNode[] = [
  { id: "CLK", label: "CLK Source", x: 300, y: 20, bufferDelay: 0, wireDelay: 0, parent: null, isFlipFlop: false },
  { id: "B1", label: "Buffer 1", x: 150, y: 80, bufferDelay: 50, wireDelay: 30, parent: "CLK", isFlipFlop: false },
  { id: "B2", label: "Buffer 2", x: 450, y: 80, bufferDelay: 55, wireDelay: 35, parent: "CLK", isFlipFlop: false },
  { id: "B3", label: "Buffer 3", x: 80, y: 150, bufferDelay: 45, wireDelay: 20, parent: "B1", isFlipFlop: false },
  { id: "B4", label: "Buffer 4", x: 220, y: 150, bufferDelay: 52, wireDelay: 25, parent: "B1", isFlipFlop: false },
  { id: "B5", label: "Buffer 5", x: 380, y: 150, bufferDelay: 48, wireDelay: 28, parent: "B2", isFlipFlop: false },
  { id: "B6", label: "Buffer 6", x: 520, y: 150, bufferDelay: 60, wireDelay: 40, parent: "B2", isFlipFlop: false },
  { id: "FF1", label: "FF1", x: 50, y: 220, bufferDelay: 0, wireDelay: 15, parent: "B3", isFlipFlop: true },
  { id: "FF2", label: "FF2", x: 110, y: 220, bufferDelay: 0, wireDelay: 18, parent: "B3", isFlipFlop: true },
  { id: "FF3", label: "FF3", x: 190, y: 220, bufferDelay: 0, wireDelay: 12, parent: "B4", isFlipFlop: true },
  { id: "FF4", label: "FF4", x: 250, y: 220, bufferDelay: 0, wireDelay: 22, parent: "B4", isFlipFlop: true },
  { id: "FF5", label: "FF5", x: 350, y: 220, bufferDelay: 0, wireDelay: 16, parent: "B5", isFlipFlop: true },
  { id: "FF6", label: "FF6", x: 410, y: 220, bufferDelay: 0, wireDelay: 20, parent: "B5", isFlipFlop: true },
  { id: "FF7", label: "FF7", x: 490, y: 220, bufferDelay: 0, wireDelay: 32, parent: "B6", isFlipFlop: true },
  { id: "FF8", label: "FF8", x: 550, y: 220, bufferDelay: 0, wireDelay: 10, parent: "B6", isFlipFlop: true },
];

const ClockTreeVisualizer = () => {
  const [tree] = useState(defaultTree);
  const [clockPeriod, setClockPeriod] = useState(1000); // ps
  const [setupTime, setSetupTime] = useState(50); // ps
  const [holdTime, setHoldTime] = useState(20); // ps
  const [jitterAmplitude, setJitterAmplitude] = useState(10); // ps
  const [cycle, setCycle] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedFF, setSelectedFF] = useState<string | null>(null);

  // Compute arrival times
  const arrivals = useMemo(() => {
    const arr: Record<string, number> = { CLK: 0 };
    const resolve = (id: string): number => {
      if (arr[id] !== undefined) return arr[id];
      const node = tree.find(n => n.id === id)!;
      if (!node.parent) return 0;
      const parentArr = resolve(node.parent);
      arr[id] = parentArr + node.wireDelay + node.bufferDelay;
      return arr[id];
    };
    tree.forEach(n => resolve(n.id));
    return arr;
  }, [tree]);

  const flipFlops = tree.filter(n => n.isFlipFlop);
  const ffArrivals = flipFlops.map(ff => ({ id: ff.id, arrival: arrivals[ff.id] }));
  const minArrival = Math.min(...ffArrivals.map(f => f.arrival));
  const maxArrival = Math.max(...ffArrivals.map(f => f.arrival));
  const skew = maxArrival - minArrival;

  // Timing analysis for each FF pair
  const timingChecks = useMemo(() => {
    const checks: {
      src: string; dst: string; skew: number;
      setupSlack: number; holdSlack: number;
      setupViolation: boolean; holdViolation: boolean;
    }[] = [];

    for (let i = 0; i < flipFlops.length; i++) {
      for (let j = i + 1; j < flipFlops.length; j++) {
        const srcArr = arrivals[flipFlops[i].id];
        const dstArr = arrivals[flipFlops[j].id];
        const s = dstArr - srcArr;
        // Assume combinational delay between = 0 for simplicity; real check uses data path
        const setupSlack = clockPeriod - Math.abs(s) - setupTime;
        const holdSlack = Math.abs(s) - holdTime;
        checks.push({
          src: flipFlops[i].id,
          dst: flipFlops[j].id,
          skew: s,
          setupSlack,
          holdSlack,
          setupViolation: setupSlack < 0,
          holdViolation: holdSlack < 0,
        });
      }
    }
    return checks;
  }, [flipFlops, arrivals, clockPeriod, setupTime, holdTime]);

  const setupViolations = timingChecks.filter(c => c.setupViolation);
  const holdViolations = timingChecks.filter(c => c.holdViolation);
  const worstSetup = timingChecks.reduce((w, c) => c.setupSlack < w.setupSlack ? c : w, timingChecks[0]);
  const worstHold = timingChecks.reduce((w, c) => c.holdSlack < w.holdSlack ? c : w, timingChecks[0]);

  // Generate clock waveforms with jitter
  const waveformData = useMemo(() => {
    const data: Record<string, any>[] = [];
    const T = clockPeriod;
    const ffSel = selectedFF ? [selectedFF] : flipFlops.slice(0, 4).map(f => f.id);
    const steps = 300;
    const tMax = T * 3;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tMax;
      const point: Record<string, any> = { t: parseFloat(t.toFixed(1)) };

      // Ideal clock
      const phase = (t % T) / T;
      point.ideal = phase < 0.5 ? 1 : 0;

      // Each FF clock with delay + jitter
      for (const ffId of ffSel) {
        const arr = arrivals[ffId];
        const jitter = jitterAmplitude * Math.sin(2 * Math.PI * t / (T * 7) + arr);
        const shifted = t - arr - jitter;
        const ffPhase = shifted > 0 ? ((shifted % T) / T) : 0;
        point[ffId] = (ffPhase < 0.5 ? 1 : 0) * 0.8 - ffSel.indexOf(ffId) * 1.5;
      }

      data.push(point);
    }
    return { data, ffIds: ffSel };
  }, [clockPeriod, arrivals, flipFlops, jitterAmplitude, selectedFF]);

  // Animation
  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => setCycle(c => (c + 1) % 100), 50);
    return () => clearInterval(timer);
  }, [isAnimating]);

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };
  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };
  const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-card border border-border">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Clock Period</span><span className="text-primary">{clockPeriod} ps</span>
          </div>
          <input type="range" min={200} max={2000} step={10} value={clockPeriod}
            onChange={e => setClockPeriod(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Setup Time</span><span className="text-chart-3">{setupTime} ps</span>
          </div>
          <input type="range" min={10} max={150} step={5} value={setupTime}
            onChange={e => setSetupTime(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--chart-3))]" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Hold Time</span><span className="text-chart-4">{holdTime} ps</span>
          </div>
          <input type="range" min={5} max={80} step={5} value={holdTime}
            onChange={e => setHoldTime(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--chart-4))]" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>Jitter</span><span className="text-destructive">{jitterAmplitude} ps</span>
          </div>
          <input type="range" min={0} max={50} step={1} value={jitterAmplitude}
            onChange={e => setJitterAmplitude(parseInt(e.target.value))}
            className="w-full accent-[hsl(var(--destructive))]" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-3">{skew.toFixed(0)} ps</div>
          <div className="text-[9px] text-muted-foreground">Clock Skew</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-destructive">±{jitterAmplitude} ps</div>
          <div className="text-[9px] text-muted-foreground">Jitter</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-2">{(1000 / clockPeriod).toFixed(2)} GHz</div>
          <div className="text-[9px] text-muted-foreground">Frequency</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          setupViolations.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/20"
        )}>
          <div className={cn("text-sm font-mono font-bold",
            setupViolations.length > 0 ? "text-destructive" : "text-primary"
          )}>{setupViolations.length}</div>
          <div className="text-[9px] text-muted-foreground">Setup Violations</div>
        </div>
        <div className={cn("p-3 rounded-lg border text-center",
          holdViolations.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-primary/20"
        )}>
          <div className={cn("text-sm font-mono font-bold",
            holdViolations.length > 0 ? "text-destructive" : "text-primary"
          )}>{holdViolations.length}</div>
          <div className="text-[9px] text-muted-foreground">Hold Violations</div>
        </div>
        <div className="p-3 rounded-lg border border-border text-center">
          <div className="text-sm font-mono font-bold text-chart-4">{flipFlops.length}</div>
          <div className="text-[9px] text-muted-foreground">Flip-Flops</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Clock Tree SVG */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Clock Distribution Tree</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsAnimating(!isAnimating)}
                className="text-[10px] font-mono gap-1 h-6 px-2">
                <Play size={10} /> {isAnimating ? "Stop" : "Animate"}
              </Button>
            </div>
          </div>
          <svg viewBox="0 0 600 260" className="w-full" style={{ minHeight: 240 }}>
            {/* Connections */}
            {tree.filter(n => n.parent).map(node => {
              const parent = tree.find(n => n.id === node.parent)!;
              const worstPair = [...(setupViolations), ...(holdViolations)];
              const isViolated = worstPair.some(v => v.src === node.id || v.dst === node.id);
              return (
                <line key={`${node.parent}-${node.id}`}
                  x1={parent.x} y1={parent.y + (parent.isFlipFlop ? 0 : 12)}
                  x2={node.x} y2={node.y}
                  stroke={isViolated ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
                  strokeWidth={isViolated ? 2 : 1}
                  opacity={isViolated ? 0.8 : 0.3}
                />
              );
            })}

            {/* Pulse animation along paths */}
            {isAnimating && tree.filter(n => n.parent).map(node => {
              const parent = tree.find(n => n.id === node.parent)!;
              const progress = ((cycle * 3 + arrivals[node.id]) % 100) / 100;
              const px = parent.x + (node.x - parent.x) * progress;
              const py = (parent.y + 12) + (node.y - parent.y - 12) * progress;
              return (
                <circle key={`pulse-${node.id}`} cx={px} cy={py} r={3}
                  fill="hsl(var(--primary))" opacity={0.8}>
                  <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite" />
                </circle>
              );
            })}

            {/* Nodes */}
            {tree.map(node => {
              const isSelected = selectedFF === node.id;
              const isViolated = [...setupViolations, ...holdViolations].some(v => v.src === node.id || v.dst === node.id);

              if (node.isFlipFlop) {
                return (
                  <g key={node.id} onClick={() => setSelectedFF(isSelected ? null : node.id)} className="cursor-pointer">
                    <rect x={node.x - 14} y={node.y} width={28} height={22} rx={3}
                      fill={isViolated ? "hsl(var(--destructive) / 0.2)" : isSelected ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted))"}
                      stroke={isViolated ? "hsl(var(--destructive))" : isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={isSelected || isViolated ? 2 : 1}
                    />
                    <text x={node.x} y={node.y + 14} textAnchor="middle"
                      fill={isViolated ? "hsl(var(--destructive))" : "hsl(var(--foreground))"}
                      fontSize={8} fontFamily="monospace" fontWeight="bold">
                      {node.id}
                    </text>
                    {/* Arrival */}
                    <text x={node.x} y={node.y + 34} textAnchor="middle"
                      fill="hsl(var(--chart-4))" fontSize={7} fontFamily="monospace">
                      {arrivals[node.id].toFixed(0)}ps
                    </text>
                  </g>
                );
              }

              return (
                <g key={node.id}>
                  {node.id === "CLK" ? (
                    <>
                      <polygon points={`${node.x - 12},${node.y + 20} ${node.x},${node.y - 4} ${node.x + 12},${node.y + 20}`}
                        fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <text x={node.x} y={node.y + 14} textAnchor="middle"
                        fill="hsl(var(--primary))" fontSize={8} fontFamily="monospace" fontWeight="bold">
                        CLK
                      </text>
                    </>
                  ) : (
                    <>
                      <rect x={node.x - 16} y={node.y} width={32} height={20} rx={4}
                        fill="hsl(var(--chart-2) / 0.15)" stroke="hsl(var(--chart-2))" strokeWidth={1} />
                      <text x={node.x} y={node.y + 13} textAnchor="middle"
                        fill="hsl(var(--chart-2))" fontSize={8} fontFamily="monospace" fontWeight="bold">
                        {node.id}
                      </text>
                      <text x={node.x} y={node.y + 30} textAnchor="middle"
                        fill="hsl(var(--muted-foreground))" fontSize={7} fontFamily="monospace">
                        {node.bufferDelay}ps
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* FF Arrival times */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Clock Arrivals</div>
            <div className="space-y-0.5">
              {ffArrivals.sort((a, b) => a.arrival - b.arrival).map(ff => {
                const barWidth = ((ff.arrival - minArrival) / (maxArrival - minArrival || 1)) * 100;
                const isViolated = [...setupViolations, ...holdViolations].some(v => v.src === ff.id || v.dst === ff.id);
                return (
                  <div key={ff.id} className={cn("flex items-center gap-2 text-[10px] font-mono py-0.5 px-1 rounded cursor-pointer",
                    selectedFF === ff.id ? "bg-primary/10" : ""
                  )} onClick={() => setSelectedFF(selectedFF === ff.id ? null : ff.id)}>
                    <span className={cn("w-8 font-bold", isViolated ? "text-destructive" : "text-foreground")}>{ff.id}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full",
                        isViolated ? "bg-destructive" : "bg-primary"
                      )} style={{ width: `${Math.max(5, barWidth)}%` }} />
                    </div>
                    <span className="text-chart-4 w-12 text-right">{ff.arrival.toFixed(0)}ps</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Violations */}
          {(setupViolations.length > 0 || holdViolations.length > 0) && (
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
              <div className="text-[10px] font-mono text-destructive mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={12} /> Timing Violations
              </div>
              {setupViolations.map((v, i) => (
                <div key={`s${i}`} className="text-[10px] font-mono text-destructive py-0.5">
                  Setup: {v.src}→{v.dst} slack={v.setupSlack.toFixed(0)}ps
                </div>
              ))}
              {holdViolations.map((v, i) => (
                <div key={`h${i}`} className="text-[10px] font-mono text-chart-3 py-0.5">
                  Hold: {v.src}→{v.dst} slack={v.holdSlack.toFixed(0)}ps
                </div>
              ))}
            </div>
          )}

          {/* Timing formulas */}
          <div className="p-4 rounded-xl bg-card border border-border font-mono text-[10px] text-muted-foreground space-y-1">
            <div><span className="text-primary">Setup:</span> T_clk - skew ≥ T_setup + T_comb</div>
            <div><span className="text-chart-4">Hold:</span> skew ≥ T_hold</div>
            <div><span className="text-destructive">Jitter:</span> Reduces effective margin by ±{jitterAmplitude}ps</div>
            <div><span className="text-chart-2">Max freq:</span> 1/(T_comb + T_setup + T_skew)</div>
          </div>
        </div>
      </div>

      {/* Clock waveforms */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Clock Waveforms (with skew & jitter)</div>
          <div className="text-[9px] font-mono text-muted-foreground">
            {selectedFF ? `Showing: ${selectedFF}` : `Showing first 4 FFs`}
            {selectedFF && <button onClick={() => setSelectedFF(null)} className="ml-2 text-primary hover:underline">Show all</button>}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={waveformData.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={tickStyle} label={{ value: "Time (ps)", position: "bottom", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={tickStyle} hide />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="stepAfter" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Ideal CLK" />
            {waveformData.ffIds.map((id, i) => (
              <Line key={id} type="stepAfter" dataKey={id} stroke={colors[i % colors.length]} strokeWidth={1.5} dot={false} name={id} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ClockTreeVisualizer;

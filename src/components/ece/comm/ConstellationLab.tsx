import { useState, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return x >= 0 ? 1 - poly * Math.exp(-x * x) : -(1 - poly * Math.exp(-x * x));
}
const Q = (x: number) => 0.5 * (1 - erf(x / Math.sqrt(2)));

const presets: Record<string, [number, number][]> = {
  "BPSK": [[-1, 0], [1, 0]],
  "QPSK": [[0.707, 0.707], [-0.707, 0.707], [-0.707, -0.707], [0.707, -0.707]],
  "Custom-4": [[1, 0], [0, 1], [-1, 0], [0, -1]],
  "16-QAM": (() => {
    const pts: [number, number][] = [];
    for (let i = -3; i <= 3; i += 2) for (let q = -3; q <= 3; q += 2) pts.push([i / 3, q / 3]);
    return pts;
  })(),
};

const ConstellationLab = () => {
  const [points, setPoints] = useState<[number, number][]>(presets["QPSK"]);
  const [snrDb, setSnrDb] = useState(15);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const size = 360;
  const margin = 30;
  const scale = (size - 2 * margin) / 3;

  const toSvg = useCallback((i: number, q: number) => ({
    x: size / 2 + i * scale,
    y: size / 2 - q * scale,
  }), [scale]);

  const fromSvg = useCallback((sx: number, sy: number): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    const viewScale = size / rect.width;
    const x = (sx - rect.left) * viewScale;
    const y = (sy - rect.top) * viewScale;
    return [
      Math.max(-1.5, Math.min(1.5, (x - size / 2) / scale)),
      Math.max(-1.5, Math.min(1.5, -(y - size / 2) / scale)),
    ];
  }, [scale]);

  const handlePointerDown = (idx: number) => setDragIdx(idx);
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const [i, q] = fromSvg(e.clientX, e.clientY);
    setPoints(pts => pts.map((p, j) => j === dragIdx ? [i, q] : p));
  };
  const handlePointerUp = () => setDragIdx(null);

  // Compute minimum distance
  const minDist = useMemo(() => {
    let min = Infinity;
    for (let a = 0; a < points.length; a++)
      for (let b = a + 1; b < points.length; b++) {
        const d = Math.sqrt((points[a][0] - points[b][0]) ** 2 + (points[a][1] - points[b][1]) ** 2);
        if (d < min) min = d;
      }
    return min;
  }, [points]);

  // Average energy
  const avgEnergy = useMemo(() => {
    return points.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0) / points.length;
  }, [points]);

  // Estimated SER
  const snrLin = Math.pow(10, snrDb / 10);
  const noiseSigma = 1 / Math.sqrt(2 * snrLin);
  const estimatedSER = Q(minDist / (2 * noiseSigma));

  // Decision boundaries (Voronoi-like visualization via shading)
  // Noise circles
  const noiseRadius = noiseSigma * scale * 2;

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.keys(presets).map(name => (
          <button key={name} onClick={() => setPoints([...presets[name]])}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground transition-all">
            {name}
          </button>
        ))}
        <button onClick={() => setPoints(pts => [...pts, [Math.random() - 0.5, Math.random() - 0.5]])}
          className="px-3 py-1.5 rounded-lg text-xs font-mono border border-chart-3/40 text-chart-3 hover:bg-chart-3/10 transition-all">
          + Add Point
        </button>
        {points.length > 2 && (
          <button onClick={() => setPoints(pts => pts.slice(0, -1))}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-destructive/40 text-destructive hover:bg-destructive/10 transition-all">
            − Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[9px] text-muted-foreground font-mono">SNR (dB)</Label>
            <span className="text-xs font-mono text-primary">{snrDb} dB</span>
          </div>
          <input type="range" min={0} max={30} step={0.5} value={snrDb}
            onChange={e => setSnrDb(parseFloat(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="p-2.5 rounded-lg border border-border bg-card text-center">
          <div className="text-sm font-mono font-bold text-chart-2">{minDist.toFixed(3)}</div>
          <div className="text-[8px] text-muted-foreground font-mono">Min Distance (d_min)</div>
        </div>
        <div className={cn("p-2.5 rounded-lg border text-center",
          estimatedSER > 0.01 ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
        )}>
          <div className={cn("text-sm font-mono font-bold",
            estimatedSER > 0.01 ? "text-destructive" : "text-primary"
          )}>{estimatedSER.toExponential(2)}</div>
          <div className="text-[8px] text-muted-foreground font-mono">Estimated SER</div>
        </div>
      </div>

      {/* Interactive constellation */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">
          DRAG POINTS TO MANIPULATE — {points.length} symbols, E_avg = {avgEnergy.toFixed(3)}
        </div>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${size} ${size}`}
          className="bg-muted/20 rounded-lg cursor-crosshair touch-none"
          onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          {/* Grid */}
          <line x1={size / 2} y1={margin} x2={size / 2} y2={size - margin} stroke="hsl(var(--border))" strokeWidth="0.5" />
          <line x1={margin} y1={size / 2} x2={size - margin} y2={size / 2} stroke="hsl(var(--border))" strokeWidth="0.5" />
          {[-1, -0.5, 0.5, 1].map(v => (
            <g key={v}>
              <line x1={size / 2 + v * scale} y1={size / 2 - 3} x2={size / 2 + v * scale} y2={size / 2 + 3} stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
              <line x1={size / 2 - 3} y1={size / 2 - v * scale} x2={size / 2 + 3} y2={size / 2 - v * scale} stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
            </g>
          ))}
          <text x={size - margin + 5} y={size / 2 + 3} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">I</text>
          <text x={size / 2 + 3} y={margin - 5} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">Q</text>

          {/* Noise circles */}
          {points.map(([i, q], idx) => {
            const { x, y } = toSvg(i, q);
            return <circle key={`noise-${idx}`} cx={x} cy={y} r={noiseRadius}
              fill="hsl(var(--destructive))" opacity="0.06" />;
          })}

          {/* Distance lines between closest pair */}
          {(() => {
            let minA = 0, minB = 1, minD = Infinity;
            for (let a = 0; a < points.length; a++)
              for (let b = a + 1; b < points.length; b++) {
                const d = Math.sqrt((points[a][0] - points[b][0]) ** 2 + (points[a][1] - points[b][1]) ** 2);
                if (d < minD) { minD = d; minA = a; minB = b; }
              }
            const a = toSvg(points[minA][0], points[minA][1]);
            const b = toSvg(points[minB][0], points[minB][1]);
            return (
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--chart-3))" strokeWidth="1" strokeDasharray="4 3" />
                <text x={(a.x + b.x) / 2 + 5} y={(a.y + b.y) / 2 - 5} fontSize="8" fill="hsl(var(--chart-3))" fontFamily="monospace">
                  d={minD.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* Constellation points */}
          {points.map(([i, q], idx) => {
            const { x, y } = toSvg(i, q);
            return (
              <g key={idx} onPointerDown={() => handlePointerDown(idx)} className="cursor-grab">
                <circle cx={x} cy={y} r="10" fill="hsl(var(--primary))" opacity={dragIdx === idx ? 0.8 : 0.6} />
                <circle cx={x} cy={y} r="4" fill="hsl(var(--primary-foreground))" />
                <text x={x} y={y - 14} textAnchor="middle" fontSize="7" fill="hsl(var(--primary))" fontFamily="monospace">
                  ({i.toFixed(2)}, {q.toFixed(2)})
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">🧩 What This Teaches</div>
        <div>• <span className="text-chart-2">d_min</span> determines noise tolerance: SER ≈ Q(d_min / 2σ)</div>
        <div>• Move points <span className="text-chart-3">closer</span> → errors increase (noise clouds overlap)</div>
        <div>• Move points <span className="text-chart-4">further</span> → better BER but more power needed</div>
        <div>• <span className="text-destructive">Red circles</span> show ±1σ noise regions — overlap = errors</div>
        <div>• <span className="text-primary">QPSK</span>: all points equal distance → optimal for 4 symbols</div>
      </div>
    </div>
  );
};

export default ConstellationLab;

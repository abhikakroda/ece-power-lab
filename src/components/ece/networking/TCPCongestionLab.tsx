import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type CongAlgo = "reno" | "tahoe" | "cubic" | "bbr";

interface CwndPoint {
  rtt: number;
  cwnd: number;
  ssthresh: number;
  event: string;
  phase: string;
}

const simulateTCP = (algo: CongAlgo, lossRtts: number[], totalRtts: number, initSsthresh: number): CwndPoint[] => {
  const pts: CwndPoint[] = [];
  let cwnd = 1;
  let ssthresh = initSsthresh;
  let phase = "slow_start";
  let dupAcks = 0;

  for (let rtt = 0; rtt < totalRtts; rtt++) {
    let event = "";

    // Check for loss
    if (lossRtts.includes(rtt)) {
      event = "LOSS";
      if (algo === "tahoe") {
        ssthresh = Math.max(Math.floor(cwnd / 2), 2);
        cwnd = 1;
        phase = "slow_start";
        event = "Timeout → cwnd=1";
      } else if (algo === "reno") {
        ssthresh = Math.max(Math.floor(cwnd / 2), 2);
        cwnd = ssthresh + 3; // fast recovery
        phase = "fast_recovery";
        event = "3 dup ACKs → Fast Retransmit";
      } else if (algo === "cubic") {
        const Wmax = cwnd;
        ssthresh = Math.max(Math.floor(cwnd * 0.7), 2);
        cwnd = ssthresh;
        phase = "congestion_avoidance";
        event = `CUBIC: W_max=${Wmax.toFixed(0)}, β=0.7`;
      } else { // bbr
        ssthresh = Math.max(Math.floor(cwnd * 0.75), 2);
        cwnd = ssthresh;
        phase = "probe_bw";
        event = "BBR: rate probe adjustment";
      }
    } else {
      // Normal growth
      if (phase === "slow_start") {
        cwnd *= 2; // exponential
        if (cwnd >= ssthresh) {
          phase = "congestion_avoidance";
          cwnd = ssthresh;
          event = "ssthresh reached → CA";
        }
      } else if (phase === "congestion_avoidance") {
        if (algo === "cubic") {
          // Simplified cubic function
          cwnd += 0.4 * (1 / cwnd) * cwnd; // approximate
          cwnd = Math.min(cwnd + 1 / cwnd, cwnd + 1);
        } else if (algo === "bbr") {
          cwnd += 1.25; // BBR probes bandwidth more aggressively
        } else {
          cwnd += 1 / cwnd; // AIMD additive increase
          cwnd = Math.min(cwnd + 1, cwnd + 1); // simplified: +1 per RTT
          cwnd = pts.length > 0 ? pts[pts.length - 1].cwnd + 1 : cwnd;
        }
      } else if (phase === "fast_recovery") {
        phase = "congestion_avoidance";
        cwnd = ssthresh;
        event = "Exit Fast Recovery";
      }
    }

    cwnd = Math.max(1, Math.min(cwnd, 200));
    pts.push({ rtt, cwnd: Math.round(cwnd * 100) / 100, ssthresh, event, phase });
  }

  return pts;
};

const TCPCongestionLab = () => {
  const [algo, setAlgo] = useState<CongAlgo>("reno");
  const [compareAlgo, setCompareAlgo] = useState<CongAlgo | null>(null);
  const [initSsthresh, setInitSsthresh] = useState(32);
  const [lossPattern, setLossPattern] = useState("15,30,50");
  const [totalRtts, setTotalRtts] = useState(70);

  const lossRtts = useMemo(() =>
    lossPattern.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
    [lossPattern]
  );

  const data = useMemo(() => simulateTCP(algo, lossRtts, totalRtts, initSsthresh), [algo, lossRtts, totalRtts, initSsthresh]);
  const compData = useMemo(() => compareAlgo ? simulateTCP(compareAlgo, lossRtts, totalRtts, initSsthresh) : null, [compareAlgo, lossRtts, totalRtts, initSsthresh]);

  const maxCwnd = Math.max(...data.map(d => d.cwnd), ...(compData?.map(d => d.cwnd) || []), initSsthresh + 5);

  // SVG
  const gW = 500, gH = 260;
  const toX = (rtt: number) => 50 + (rtt / totalRtts) * (gW - 60);
  const toY = (cwnd: number) => gH - 25 - (cwnd / maxCwnd) * (gH - 50);

  const buildPath = (pts: CwndPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.rtt)} ${toY(p.cwnd)}`).join(" ");

  const mainPath = buildPath(data);
  const compPath = compData ? buildPath(compData) : null;

  // ssthresh line
  const ssthreshPath = data.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${toX(p.rtt)} ${toY(p.ssthresh)}`
  ).join(" ");

  // Throughput approximation
  const avgCwnd = data.reduce((s, p) => s + p.cwnd, 0) / data.length;
  const compAvgCwnd = compData ? compData.reduce((s, p) => s + p.cwnd, 0) / compData.length : 0;

  // Phase summary
  const phases = data.filter(d => d.event).slice(-10);

  return (
    <div className="space-y-5">
      {/* Algorithm selector */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[9px] font-mono text-muted-foreground">Algorithm:</span>
        {(["tahoe", "reno", "cubic", "bbr"] as CongAlgo[]).map(a => (
          <button key={a} onClick={() => setAlgo(a)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              algo === a ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>{a === "bbr" ? "BBR" : a.charAt(0).toUpperCase() + a.slice(1)}</button>
        ))}
        <span className="text-[9px] font-mono text-muted-foreground ml-4">Compare:</span>
        {[null, ...["tahoe", "reno", "cubic", "bbr"].filter(a => a !== algo) as CongAlgo[]].map(a => (
          <button key={a ?? "none"} onClick={() => setCompareAlgo(a)}
            className={cn("px-2 py-0.5 rounded text-[9px] font-mono border transition-all",
              compareAlgo === a ? "bg-chart-3/15 border-chart-3/40 text-chart-3" : "border-border text-muted-foreground"
            )}>{a ? (a === "bbr" ? "BBR" : a.charAt(0).toUpperCase() + a.slice(1)) : "Off"}</button>
        ))}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[9px] text-muted-foreground font-mono">INITIAL ssthresh</Label>
            <span className="text-xs font-mono text-chart-2">{initSsthresh}</span>
          </div>
          <input type="range" min={4} max={64} step={2} value={initSsthresh}
            onChange={e => setInitSsthresh(parseInt(e.target.value))} className="w-full accent-[hsl(var(--chart-2))]" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <Label className="text-[9px] text-muted-foreground font-mono">LOSS AT RTTs (comma-separated)</Label>
          <input value={lossPattern} onChange={e => setLossPattern(e.target.value)}
            className="w-full bg-muted text-foreground border border-border rounded px-2 py-1 text-xs font-mono" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <Label className="text-[9px] text-muted-foreground font-mono">TOTAL RTTs</Label>
            <span className="text-xs font-mono text-chart-4">{totalRtts}</span>
          </div>
          <input type="range" min={20} max={150} step={5} value={totalRtts}
            onChange={e => setTotalRtts(parseInt(e.target.value))} className="w-full accent-[hsl(var(--chart-4))]" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Algorithm" value={algo.toUpperCase()} color="text-primary" />
        <Stat label="Avg cwnd" value={avgCwnd.toFixed(1)} color="text-chart-2" />
        <Stat label="Max cwnd" value={`${Math.max(...data.map(d => d.cwnd)).toFixed(0)}`} color="text-chart-3" />
        <Stat label="Loss Events" value={`${lossRtts.length}`} color="text-destructive" />
        <Stat label="Throughput" value={`~${(avgCwnd * 1460 / 1000).toFixed(0)} KB/RTT`} color="text-chart-4" />
      </div>

      {/* cwnd graph */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">CONGESTION WINDOW (cwnd) vs TIME</div>
        <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
          {/* Grid */}
          {Array.from({ length: 6 }, (_, i) => {
            const v = (i / 5) * maxCwnd;
            const y = toY(v);
            return (
              <g key={i}>
                <line x1="50" y1={y} x2={gW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <text x="46" y={y + 3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{v.toFixed(0)}</text>
              </g>
            );
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const rtt = (i / 7) * totalRtts;
            const x = toX(rtt);
            return (
              <g key={i}>
                <line x1={x} y1="20" x2={x} y2={gH - 25} stroke="hsl(var(--border))" strokeWidth="0.3" />
                <text x={x} y={gH - 10} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{rtt.toFixed(0)}</text>
              </g>
            );
          })}

          {/* ssthresh */}
          <path d={ssthreshPath} fill="none" stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="5 3" opacity="0.5" />

          {/* Compare curve */}
          {compPath && <path d={compPath} fill="none" stroke="hsl(var(--chart-3))" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />}

          {/* Main curve */}
          <path d={mainPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />

          {/* Loss markers */}
          {lossRtts.map(rtt => {
            const pt = data.find(d => d.rtt === rtt);
            if (!pt) return null;
            return (
              <g key={rtt}>
                <circle cx={toX(rtt)} cy={toY(pt.cwnd)} r="5" fill="hsl(var(--destructive))" />
                <text x={toX(rtt)} y={toY(pt.cwnd) - 8} textAnchor="middle" fontSize="7" fill="hsl(var(--destructive))" fontFamily="monospace">✗</text>
              </g>
            );
          })}

          {/* Phase coloring */}
          {data.map((d, i) => {
            if (i === 0) return null;
            const x1 = toX(d.rtt - 1), x2 = toX(d.rtt);
            const color = d.phase === "slow_start" ? "hsl(var(--chart-3) / 0.05)" :
                          d.phase === "fast_recovery" ? "hsl(var(--destructive) / 0.05)" :
                          "transparent";
            return <rect key={i} x={x1} y="20" width={x2 - x1} height={gH - 45} fill={color} />;
          })}

          {/* Legend */}
          <line x1={gW - 140} y1="15" x2={gW - 120} y2="15" stroke="hsl(var(--primary))" strokeWidth="2.5" />
          <text x={gW - 116} y="18" fontSize="7" fill="hsl(var(--primary))" fontFamily="monospace">{algo}</text>
          {compareAlgo && <>
            <line x1={gW - 140} y1="27" x2={gW - 120} y2="27" stroke="hsl(var(--chart-3))" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={gW - 116} y="30" fontSize="7" fill="hsl(var(--chart-3))" fontFamily="monospace">{compareAlgo}</text>
          </>}
          <line x1={gW - 140} y1="39" x2={gW - 120} y2="39" stroke="hsl(var(--destructive))" strokeWidth="1" strokeDasharray="5 3" />
          <text x={gW - 116} y="42" fontSize="7" fill="hsl(var(--destructive))" fontFamily="monospace">ssthresh</text>

          <text x={gW / 2} y={gH - 1} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" fontFamily="monospace">RTT (round-trip time)</text>
          <text x="8" y={gH / 2} textAnchor="middle" fontSize="8" fill="hsl(var(--primary))" fontFamily="monospace"
            transform={`rotate(-90, 8, ${gH / 2})`}>cwnd (segments)</text>
        </svg>
      </div>

      {/* Event timeline */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">EVENT TIMELINE</div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {phases.map((p, i) => (
            <div key={i} className="flex text-[9px] font-mono text-muted-foreground gap-2">
              <span className="text-chart-4 w-16">RTT {p.rtt}</span>
              <span className={cn("w-12",
                p.phase === "slow_start" ? "text-chart-3" : p.phase === "fast_recovery" ? "text-destructive" : "text-primary"
              )}>{p.phase === "slow_start" ? "SS" : p.phase === "fast_recovery" ? "FR" : "CA"}</span>
              <span className="text-foreground flex-1">{p.event}</span>
              <span className="text-chart-2">cwnd={p.cwnd.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison */}
      {compareAlgo && compData && (
        <div className="p-4 rounded-xl bg-card border border-chart-3/20">
          <div className="text-[10px] font-mono text-muted-foreground mb-2">PERFORMANCE COMPARISON</div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
            <div className="p-2 rounded-lg border border-border">
              <div className="text-primary font-bold">{algo.toUpperCase()}</div>
              <div className="text-muted-foreground">Avg cwnd: {avgCwnd.toFixed(1)}</div>
              <div className="text-chart-2">~{(avgCwnd * 1460 / 1000).toFixed(0)} KB/RTT</div>
            </div>
            <div className="p-2 rounded-lg border border-border text-muted-foreground">
              <div className="text-sm">vs</div>
              <div className="text-[9px]">{avgCwnd > compAvgCwnd ? `${algo} wins` : `${compareAlgo} wins`}</div>
              <div className="text-[9px]">by {Math.abs(((avgCwnd - compAvgCwnd) / compAvgCwnd) * 100).toFixed(0)}%</div>
            </div>
            <div className="p-2 rounded-lg border border-border">
              <div className="text-chart-3 font-bold">{compareAlgo.toUpperCase()}</div>
              <div className="text-muted-foreground">Avg cwnd: {compAvgCwnd.toFixed(1)}</div>
              <div className="text-chart-2">~{(compAvgCwnd * 1460 / 1000).toFixed(0)} KB/RTT</div>
            </div>
          </div>
        </div>
      )}

      {/* Concepts */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">📚 TCP Congestion Control</div>
        <div>• <span className="text-chart-3">Slow Start:</span> cwnd doubles each RTT (exponential growth to ssthresh)</div>
        <div>• <span className="text-primary">Congestion Avoidance:</span> cwnd += 1/cwnd per ACK (linear AIMD)</div>
        <div>• <span className="text-destructive">Loss detection:</span> Tahoe=timeout→cwnd=1 | Reno=3dupACKs→fast retransmit</div>
        <div>• <span className="text-chart-2">Fast Recovery (Reno):</span> cwnd = ssthresh + 3 (skip slow start)</div>
        <div>• <span className="text-chart-4">CUBIC:</span> cwnd = C(t - K)³ + W_max — used by Linux default</div>
        <div>• <span className="text-primary">BBR:</span> model-based, probes bandwidth & RTT separately (Google)</div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[7px] text-muted-foreground font-mono">{label}</div>
  </div>
);

export default TCPCongestionLab;

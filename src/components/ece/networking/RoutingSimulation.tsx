import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, AlertTriangle } from "lucide-react";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface Link {
  from: string;
  to: string;
  cost: number;
  bandwidth: number; // Mbps
  congestion: number; // 0-1
}

const nodes: Node[] = [
  { id: "A", label: "Router A", x: 80, y: 60 },
  { id: "B", label: "Router B", x: 250, y: 30 },
  { id: "C", label: "Router C", x: 250, y: 150 },
  { id: "D", label: "Router D", x: 420, y: 60 },
  { id: "E", label: "Router E", x: 420, y: 170 },
  { id: "F", label: "Router F", x: 560, y: 100 },
];

const defaultLinks: Link[] = [
  { from: "A", to: "B", cost: 1, bandwidth: 100, congestion: 0.1 },
  { from: "A", to: "C", cost: 4, bandwidth: 50, congestion: 0.3 },
  { from: "B", to: "D", cost: 2, bandwidth: 100, congestion: 0.2 },
  { from: "B", to: "C", cost: 1, bandwidth: 80, congestion: 0.15 },
  { from: "C", to: "E", cost: 3, bandwidth: 60, congestion: 0.5 },
  { from: "D", to: "F", cost: 1, bandwidth: 100, congestion: 0.1 },
  { from: "D", to: "E", cost: 2, bandwidth: 70, congestion: 0.4 },
  { from: "E", to: "F", cost: 5, bandwidth: 40, congestion: 0.7 },
];

type Protocol = "static" | "rip" | "ospf";

// Dijkstra for OSPF
const dijkstra = (links: Link[], src: string, dst: string): { path: string[]; cost: number } => {
  const adj: Record<string, { to: string; cost: number }[]> = {};
  for (const l of links) {
    if (!adj[l.from]) adj[l.from] = [];
    if (!adj[l.to]) adj[l.to] = [];
    adj[l.from].push({ to: l.to, cost: l.cost });
    adj[l.to].push({ to: l.from, cost: l.cost });
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const n of nodes) { dist[n.id] = Infinity; prev[n.id] = null; }
  dist[src] = 0;

  while (true) {
    let u: string | null = null;
    let minD = Infinity;
    for (const n of nodes) {
      if (!visited.has(n.id) && dist[n.id] < minD) {
        minD = dist[n.id];
        u = n.id;
      }
    }
    if (!u || u === dst) break;
    visited.add(u);

    for (const edge of (adj[u] || [])) {
      const alt = dist[u] + edge.cost;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = u;
      }
    }
  }

  const path: string[] = [];
  let cur: string | null = dst;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  return { path: path[0] === src ? path : [], cost: dist[dst] };
};

// RIP — Bellman-Ford (hop count only)
const ripRoute = (links: Link[], src: string, dst: string): { path: string[]; hops: number } => {
  const adj: Record<string, string[]> = {};
  for (const l of links) {
    if (!adj[l.from]) adj[l.from] = [];
    if (!adj[l.to]) adj[l.to] = [];
    adj[l.from].push(l.to);
    adj[l.to].push(l.from);
  }

  // BFS for min hops
  const queue: string[][] = [[src]];
  const visited = new Set<string>([src]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    if (node === dst) return { path, hops: path.length - 1 };

    for (const neighbor of (adj[node] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }

  return { path: [], hops: Infinity };
};

// Static — predefined
const staticRoutes: Record<string, string[]> = {
  "A-F": ["A", "B", "D", "F"],
  "A-E": ["A", "C", "E"],
  "A-D": ["A", "B", "D"],
};

const RoutingSimulation = () => {
  const [protocol, setProtocol] = useState<Protocol>("ospf");
  const [source, setSource] = useState("A");
  const [dest, setDest] = useState("F");
  const [links, setLinks] = useState(defaultLinks);
  const [activePath, setActivePath] = useState<string[]>([]);
  const [packetPos, setPacketPos] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [droppedPackets, setDroppedPackets] = useState(0);
  const [deliveredPackets, setDeliveredPackets] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [congestionMultiplier, setCongestionMultiplier] = useState(1);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-15), msg]);
  }, []);

  const currentLinks = useMemo(() => links.map(l => ({
    ...l,
    congestion: Math.min(1, l.congestion * congestionMultiplier),
  })), [links, congestionMultiplier]);

  const routeResult = useMemo(() => {
    switch (protocol) {
      case "ospf": {
        const r = dijkstra(currentLinks, source, dest);
        return { path: r.path, metric: `Cost: ${r.cost}`, algorithm: "Dijkstra (SPF)" };
      }
      case "rip": {
        const r = ripRoute(currentLinks, source, dest);
        return { path: r.path, metric: `Hops: ${r.hops}`, algorithm: "Bellman-Ford (hop count)" };
      }
      case "static": {
        const key = `${source}-${dest}`;
        const revKey = `${dest}-${source}`;
        const p = staticRoutes[key] || (staticRoutes[revKey] ? [...staticRoutes[revKey]].reverse() : []);
        return { path: p.length ? p : [source, dest], metric: "Manual", algorithm: "Static table" };
      }
    }
  }, [protocol, source, dest, currentLinks]);

  const simulatePacket = useCallback(() => {
    setActivePath(routeResult.path);
    setPacketPos(0);
    setIsAnimating(true);
    addLog(`📤 Sending packet ${source} → ${dest} via ${protocol.toUpperCase()}`);
    addLog(`Route: ${routeResult.path.join(" → ")} | ${routeResult.metric}`);
  }, [routeResult, source, dest, protocol, addLog]);

  useEffect(() => {
    if (!isAnimating || packetPos < 0) return;

    const timer = setTimeout(() => {
      if (packetPos >= activePath.length - 1) {
        setIsAnimating(false);
        setDeliveredPackets(p => p + 1);
        addLog("✅ Packet delivered successfully!");
        return;
      }

      // Check congestion for packet drop
      const from = activePath[packetPos];
      const to = activePath[packetPos + 1];
      const link = currentLinks.find(l =>
        (l.from === from && l.to === to) || (l.to === from && l.from === to)
      );

      if (link && link.congestion > 0.8 && Math.random() < link.congestion * 0.4) {
        setIsAnimating(false);
        setDroppedPackets(p => p + 1);
        addLog(`❌ Packet DROPPED on ${from}→${to} (congestion: ${(link.congestion * 100).toFixed(0)}%)`);
        return;
      }

      addLog(`📦 Hop: ${from} → ${to} (${link ? `${(link.congestion * 100).toFixed(0)}% load` : ""})`);
      setPacketPos(p => p + 1);
    }, 600);

    return () => clearTimeout(timer);
  }, [isAnimating, packetPos, activePath, currentLinks, addLog]);

  const reset = () => {
    setActivePath([]);
    setPacketPos(-1);
    setIsAnimating(false);
    setDroppedPackets(0);
    setDeliveredPackets(0);
    setLog([]);
  };

  const isOnPath = (from: string, to: string) => {
    for (let i = 0; i < activePath.length - 1; i++) {
      if ((activePath[i] === from && activePath[i + 1] === to) ||
          (activePath[i] === to && activePath[i + 1] === from)) return true;
    }
    return false;
  };

  const getNodePos = (id: string) => nodes.find(n => n.id === id)!;

  return (
    <div className="space-y-6">
      {/* Protocol selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {([
          ["ospf", "OSPF", "Shortest path (Dijkstra)", "text-primary"],
          ["rip", "RIP", "Min hops (Bellman-Ford)", "text-chart-3"],
          ["static", "Static", "Manual routing table", "text-chart-4"],
        ] as [Protocol, string, string, string][]).map(([id, label, desc, color]) => (
          <button key={id} onClick={() => setProtocol(id)}
            className={cn(
              "px-4 py-2.5 rounded-lg text-xs font-mono border transition-all",
              protocol === id
                ? "bg-primary/10 border-primary/30 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}>
            <div className="font-bold">{label}</div>
            <div className="text-[9px] text-muted-foreground">{desc}</div>
          </button>
        ))}
      </div>

      {/* Source / Dest selectors */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">Source:</span>
          {nodes.map(n => (
            <button key={n.id} onClick={() => setSource(n.id)}
              className={cn("w-7 h-7 rounded-md text-[10px] font-mono font-bold border transition-all",
                source === n.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground bg-card hover:text-foreground"
              )}>{n.id}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">Dest:</span>
          {nodes.map(n => (
            <button key={n.id} onClick={() => setDest(n.id)}
              className={cn("w-7 h-7 rounded-md text-[10px] font-mono font-bold border transition-all",
                dest === n.id ? "bg-chart-3 text-primary-foreground border-chart-3" : "border-border text-muted-foreground bg-card hover:text-foreground"
              )}>{n.id}</button>
          ))}
        </div>
        <Button size="sm" onClick={simulatePacket} disabled={isAnimating}
          className="bg-primary text-primary-foreground gap-1.5 text-xs font-mono">
          <Play size={14} /> Send Packet
        </Button>
        <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 text-xs font-mono">
          <RotateCcw size={14} /> Reset
        </Button>
      </div>

      {/* Congestion control */}
      <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-4">
        <span className="text-[10px] font-mono text-muted-foreground">Network Load:</span>
        <input type="range" min={0.5} max={3} step={0.1} value={congestionMultiplier}
          onChange={e => setCongestionMultiplier(parseFloat(e.target.value))}
          className="flex-1 accent-[hsl(var(--destructive))]" />
        <span className={cn("text-xs font-mono font-bold",
          congestionMultiplier > 2 ? "text-destructive" : congestionMultiplier > 1.5 ? "text-chart-3" : "text-primary"
        )}>{(congestionMultiplier * 100).toFixed(0)}%</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Network Topology SVG */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Network Topology</div>
          <svg viewBox="0 0 640 220" className="w-full" style={{ minHeight: 200 }}>
            {/* Links */}
            {currentLinks.map((link, i) => {
              const from = getNodePos(link.from);
              const to = getNodePos(link.to);
              const onPath = isOnPath(link.from, link.to);
              const congColor = link.congestion > 0.6 ? "hsl(var(--destructive))" :
                               link.congestion > 0.3 ? "hsl(var(--chart-3))" :
                               "hsl(var(--muted-foreground))";
              return (
                <g key={i}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={onPath ? "hsl(var(--primary))" : congColor}
                    strokeWidth={onPath ? 3 : 1.5}
                    strokeDasharray={onPath ? "0" : "4 4"}
                    opacity={onPath ? 1 : 0.5}
                  />
                  {/* Cost label */}
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}
                    textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9} fontFamily="monospace">
                    c={link.cost}
                  </text>
                  {/* Congestion indicator */}
                  {link.congestion > 0.5 && (
                    <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 + 12}
                      textAnchor="middle" fill="hsl(var(--destructive))" fontSize={8} fontFamily="monospace">
                      {(link.congestion * 100).toFixed(0)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isSource = node.id === source;
              const isDest = node.id === dest;
              const isPacketHere = activePath[packetPos] === node.id;
              const isOnRoute = activePath.includes(node.id);

              return (
                <g key={node.id}>
                  {/* Glow for packet */}
                  {isPacketHere && (
                    <circle cx={node.x} cy={node.y} r={22}
                      fill="none" stroke="hsl(var(--chart-3))" strokeWidth={2} opacity={0.5}>
                      <animate attributeName="r" values="18;24;18" dur="1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={node.x} cy={node.y} r={16}
                    fill={isPacketHere ? "hsl(var(--chart-3))" :
                          isSource ? "hsl(var(--primary))" :
                          isDest ? "hsl(var(--chart-3))" :
                          isOnRoute ? "hsl(var(--primary) / 0.3)" :
                          "hsl(var(--muted))"}
                    stroke={isSource ? "hsl(var(--primary))" :
                            isDest ? "hsl(var(--chart-3))" :
                            "hsl(var(--border))"}
                    strokeWidth={isSource || isDest ? 2 : 1}
                  />
                  <text x={node.x} y={node.y + 4} textAnchor="middle"
                    fill={isPacketHere || isSource || isDest ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"}
                    fontSize={11} fontFamily="monospace" fontWeight="bold">
                    {node.id}
                  </text>
                  <text x={node.x} y={node.y + 30} textAnchor="middle"
                    fill="hsl(var(--muted-foreground))" fontSize={8} fontFamily="monospace">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Route info */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Computed Route</div>
            <div className="text-sm font-mono text-primary font-bold">
              {routeResult.path.join(" → ") || "No route"}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {routeResult.metric} | {routeResult.algorithm}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 text-center">
              <div className="text-sm font-mono font-bold text-primary">{deliveredPackets}</div>
              <div className="text-[9px] text-muted-foreground">Delivered</div>
            </div>
            <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-center">
              <div className="text-sm font-mono font-bold text-destructive">{droppedPackets}</div>
              <div className="text-[9px] text-muted-foreground">Dropped</div>
            </div>
          </div>

          {/* Routing table */}
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">
              {protocol.toUpperCase()} Routing Table (from {source})
            </div>
            <div className="space-y-0.5">
              {nodes.filter(n => n.id !== source).map(n => {
                const r = protocol === "ospf" ? dijkstra(currentLinks, source, n.id) :
                          protocol === "rip" ? ripRoute(currentLinks, source, n.id) :
                          { path: staticRoutes[`${source}-${n.id}`] || [source, n.id], cost: 0 };
                const path = r.path;
                const nextHop = path.length > 1 ? path[1] : "—";
                return (
                  <div key={n.id} className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground py-0.5">
                    <span className="w-8 text-foreground">{n.id}</span>
                    <span className="flex-1">→ {nextHop}</span>
                    <span className="text-primary">{protocol === "rip" ? `${path.length - 1}hop` : `c=${('cost' in r ? r.cost : 0)}`}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Log */}
          <div className="p-3 rounded-xl bg-card border border-border max-h-48 overflow-y-auto">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Packet Log</div>
            {log.length === 0 && (
              <div className="text-[10px] font-mono text-muted-foreground/50 italic">Send a packet to see logs...</div>
            )}
            {log.map((entry, i) => (
              <div key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{entry}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Protocol comparison */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-3 uppercase tracking-wider">Protocol Comparison</div>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["RIP", "Distance Vector", "Hop count (max 15)", "30s updates", "Small networks", protocol === "rip"],
            ["OSPF", "Link State", "Cost (bandwidth)", "Event-driven", "Large networks", protocol === "ospf"],
            ["Static", "Manual", "Admin-defined", "No updates", "Simple/fixed", protocol === "static"],
          ] as [string, string, string, string, string, boolean][]).map(([name, type, metric, conv, use, active]) => (
            <div key={name} className={cn(
              "p-3 rounded-lg border text-xs font-mono space-y-1 transition-all",
              active ? "border-primary/30 bg-primary/5" : "border-border"
            )}>
              <div className="font-bold text-foreground">{name}</div>
              <div className="text-muted-foreground">Type: {type}</div>
              <div className="text-muted-foreground">Metric: {metric}</div>
              <div className="text-muted-foreground">Updates: {conv}</div>
              <div className="text-muted-foreground">Best for: {use}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoutingSimulation;

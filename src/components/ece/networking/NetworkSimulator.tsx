import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, Plus, Trash2 } from "lucide-react";

interface Device {
  id: string;
  type: "router" | "switch" | "pc" | "server" | "firewall";
  label: string;
  x: number;
  y: number;
  ip: string;
  mac: string;
  interfaces: string[];
}

interface Connection {
  id: string;
  from: string;
  to: string;
  bandwidth: number; // Mbps
  delay: number; // ms
  loss: number; // %
  jitter: number; // ms
  up?: boolean; // Link status
}

interface Packet {
  id: number;
  src: string;
  dst: string;
  protocol: "TCP" | "UDP" | "ICMP" | "ARP" | "HTTP";
  size: number;
  ttl: number;
  path: string[];
  currentHop: number;
  status: "transit" | "delivered" | "dropped" | "timeout";
  startTime: number;
  latency: number;
}

const deviceIcons: Record<string, string> = {
  router: "🔀", switch: "🔲", pc: "💻", server: "🖥️", firewall: "🛡️",
};

const defaultDevices: Device[] = [
  { id: "R1", type: "router", label: "Core Router", x: 300, y: 80, ip: "10.0.0.1", mac: "AA:BB:CC:00:01:01", interfaces: ["eth0", "eth1", "eth2"] },
  { id: "R2", type: "router", label: "Edge Router", x: 520, y: 80, ip: "10.0.1.1", mac: "AA:BB:CC:00:02:01", interfaces: ["eth0", "eth1"] },
  { id: "SW1", type: "switch", label: "Switch 1", x: 160, y: 200, ip: "—", mac: "DD:EE:FF:00:01:01", interfaces: ["fa0/1", "fa0/2", "fa0/3", "fa0/4"] },
  { id: "SW2", type: "switch", label: "Switch 2", x: 460, y: 220, ip: "—", mac: "DD:EE:FF:00:02:01", interfaces: ["fa0/1", "fa0/2", "fa0/3"] },
  { id: "PC1", type: "pc", label: "Host A", x: 60, y: 320, ip: "192.168.1.10", mac: "11:22:33:44:55:01", interfaces: ["eth0"] },
  { id: "PC2", type: "pc", label: "Host B", x: 230, y: 340, ip: "192.168.1.20", mac: "11:22:33:44:55:02", interfaces: ["eth0"] },
  { id: "SRV1", type: "server", label: "Web Server", x: 580, y: 320, ip: "10.0.1.100", mac: "66:77:88:99:AA:01", interfaces: ["eth0"] },
  { id: "FW1", type: "firewall", label: "Firewall", x: 400, y: 150, ip: "10.0.0.254", mac: "CC:DD:EE:FF:00:01", interfaces: ["eth0", "eth1"] },
];

const defaultConnections: Connection[] = [
  { id: "c1", from: "PC1", to: "SW1", bandwidth: 100, delay: 1, loss: 0, jitter: 0.1 },
  { id: "c2", from: "PC2", to: "SW1", bandwidth: 100, delay: 1, loss: 0, jitter: 0.1 },
  { id: "c3", from: "SW1", to: "R1", bandwidth: 1000, delay: 2, loss: 0, jitter: 0.5 },
  { id: "c4", from: "R1", to: "FW1", bandwidth: 1000, delay: 1, loss: 0, jitter: 0.2 },
  { id: "c5", from: "FW1", to: "R2", bandwidth: 1000, delay: 3, loss: 0.5, jitter: 1 },
  { id: "c6", from: "R2", to: "SW2", bandwidth: 1000, delay: 1, loss: 0, jitter: 0.3 },
  { id: "c7", from: "SW2", to: "SRV1", bandwidth: 1000, delay: 1, loss: 0, jitter: 0.1 },
];

const topologyPresets: Record<string, { name: string; devices: Device[]; connections: Connection[] }> = {
  enterprise: { name: "Enterprise LAN", devices: defaultDevices, connections: defaultConnections },
  simple: {
    name: "Simple P2P",
    devices: [
      { id: "PC1", type: "pc", label: "Host A", x: 100, y: 180, ip: "192.168.1.1", mac: "AA:00:00:00:00:01", interfaces: ["eth0"] },
      { id: "R1", type: "router", label: "Router", x: 340, y: 180, ip: "192.168.1.254", mac: "BB:00:00:00:00:01", interfaces: ["eth0", "eth1"] },
      { id: "PC2", type: "pc", label: "Host B", x: 580, y: 180, ip: "10.0.0.1", mac: "CC:00:00:00:00:01", interfaces: ["eth0"] },
    ],
    connections: [
      { id: "c1", from: "PC1", to: "R1", bandwidth: 100, delay: 5, loss: 0, jitter: 1 },
      { id: "c2", from: "R1", to: "PC2", bandwidth: 100, delay: 10, loss: 1, jitter: 2 },
    ],
  },
  datacenter: {
    name: "Data Center",
    devices: [
      { id: "SPINE1", type: "switch", label: "Spine 1", x: 220, y: 60, ip: "—", mac: "S1:00:00:00:00:01", interfaces: ["1-4"] },
      { id: "SPINE2", type: "switch", label: "Spine 2", x: 440, y: 60, ip: "—", mac: "S2:00:00:00:00:01", interfaces: ["1-4"] },
      { id: "LEAF1", type: "switch", label: "Leaf 1", x: 120, y: 180, ip: "—", mac: "L1:00:00:00:00:01", interfaces: ["1-6"] },
      { id: "LEAF2", type: "switch", label: "Leaf 2", x: 340, y: 180, ip: "—", mac: "L2:00:00:00:00:01", interfaces: ["1-6"] },
      { id: "LEAF3", type: "switch", label: "Leaf 3", x: 540, y: 180, ip: "—", mac: "L3:00:00:00:00:01", interfaces: ["1-6"] },
      { id: "SRV1", type: "server", label: "Server 1", x: 60, y: 320, ip: "10.1.1.1", mac: "11:00:00:00:00:01", interfaces: ["eth0"] },
      { id: "SRV2", type: "server", label: "Server 2", x: 200, y: 320, ip: "10.1.1.2", mac: "11:00:00:00:00:02", interfaces: ["eth0"] },
      { id: "SRV3", type: "server", label: "Server 3", x: 340, y: 320, ip: "10.1.2.1", mac: "22:00:00:00:00:01", interfaces: ["eth0"] },
      { id: "SRV4", type: "server", label: "Server 4", x: 480, y: 320, ip: "10.1.2.2", mac: "22:00:00:00:00:02", interfaces: ["eth0"] },
      { id: "SRV5", type: "server", label: "Server 5", x: 600, y: 320, ip: "10.1.3.1", mac: "33:00:00:00:00:01", interfaces: ["eth0"] },
    ],
    connections: [
      { id: "c1", from: "SPINE1", to: "LEAF1", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c2", from: "SPINE1", to: "LEAF2", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c3", from: "SPINE1", to: "LEAF3", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c4", from: "SPINE2", to: "LEAF1", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c5", from: "SPINE2", to: "LEAF2", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c6", from: "SPINE2", to: "LEAF3", bandwidth: 10000, delay: 0.5, loss: 0, jitter: 0.05 },
      { id: "c7", from: "LEAF1", to: "SRV1", bandwidth: 1000, delay: 0.1, loss: 0, jitter: 0.01 },
      { id: "c8", from: "LEAF1", to: "SRV2", bandwidth: 1000, delay: 0.1, loss: 0, jitter: 0.01 },
      { id: "c9", from: "LEAF2", to: "SRV3", bandwidth: 1000, delay: 0.1, loss: 0, jitter: 0.01 },
      { id: "c10", from: "LEAF2", to: "SRV4", bandwidth: 1000, delay: 0.1, loss: 0, jitter: 0.01 },
      { id: "c11", from: "LEAF3", to: "SRV5", bandwidth: 1000, delay: 0.1, loss: 0, jitter: 0.01 },
    ],
  },
};

const NetworkSimulator = () => {
  const [devices, setDevices] = useState<Device[]>(defaultDevices);
  const [connections, setConnections] = useState<Connection[]>(defaultConnections);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [stats, setStats] = useState({ sent: 0, delivered: 0, dropped: 0, avgLatency: 0 });
  const [trafficType, setTrafficType] = useState<"ping" | "http" | "stream">("ping");
  const [trafficSrc, setTrafficSrc] = useState("PC1");
  const [trafficDst, setTrafficDst] = useState("SRV1");
  const [packetCount, setPacketCount] = useState(10);
  const [activePreset, setActivePreset] = useState("enterprise");
  const svgRef = useRef<SVGSVGElement>(null);
  const timerRef = useRef<number | null>(null);
  const packetIdRef = useRef(0);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Dijkstra path finding based on link properties
  const findPath = useCallback((src: string, dst: string): string[] => {
    const adj: Record<string, { to: string; cost: number; up: boolean }[]> = {};
    for (const c of connections) {
      if (!adj[c.from]) adj[c.from] = [];
      if (!adj[c.to]) adj[c.to] = [];
      // Cost metric: combining delay and inversely proportional bandwidth
      const cost = c.delay + (10000 / Math.max(c.bandwidth, 1));
      const up = c.up !== false;
      adj[c.from].push({ to: c.to, cost, up });
      adj[c.to].push({ to: c.from, cost, up });
    }

    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const visited = new Set<string>();

    for (const d of devices) { dist[d.id] = Infinity; prev[d.id] = null; }
    dist[src] = 0;

    let u: string | null = null;
    while (true) {
      u = null;
      let minD = Infinity;
      for (const d of devices) {
        if (!visited.has(d.id) && dist[d.id] < minD) {
          minD = dist[d.id];
          u = d.id;
        }
      }
      if (!u || u === dst || minD === Infinity) break;
      visited.add(u);

      for (const edge of (adj[u] || [])) {
        if (!edge.up) continue;
        const alt = dist[u] + edge.cost;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = u;
        }
      }
    }

    const path: string[] = [];
    let cur: string | null = dst;
    if (prev[cur] !== null || cur === src) {
      while (cur) { path.unshift(cur); cur = prev[cur]; }
    }
    return path.length > 0 && path[0] === src ? path : [];
  }, [connections, devices]);

  const getLink = useCallback((a: string, b: string) => {
    return connections.find(c => (c.from === a && c.to === b) || (c.from === b && c.to === a));
  }, [connections]);

  // Start simulation
  const startSimulation = useCallback(() => {
    const path = findPath(trafficSrc, trafficDst);
    if (path.length < 2) { addLog("❌ No path found!"); return; }

    setIsSimulating(true);
    setStats({ sent: 0, delivered: 0, dropped: 0, avgLatency: 0 });
    addLog(`🚀 Starting ${trafficType.toUpperCase()} traffic: ${trafficSrc} → ${trafficDst} (${packetCount} packets)`);
    addLog(`📍 Path: ${path.join(" → ")}`);

    let sent = 0;
    const sendInterval = setInterval(() => {
      if (sent >= packetCount) { clearInterval(sendInterval); return; }

      const pkt: Packet = {
        id: packetIdRef.current++,
        src: trafficSrc,
        dst: trafficDst,
        protocol: trafficType === "ping" ? "ICMP" : trafficType === "http" ? "HTTP" : "UDP",
        size: trafficType === "ping" ? 64 : trafficType === "http" ? 1460 : 1024,
        ttl: 64,
        path,
        currentHop: 0,
        status: "transit",
        startTime: Date.now(),
        latency: 0,
      };
      setPackets(prev => [...prev.slice(-50), pkt]);
      sent++;
      setStats(s => ({ ...s, sent: s.sent + 1 }));
    }, trafficType === "stream" ? 100 : 300);

    timerRef.current = sendInterval as unknown as number;
  }, [trafficSrc, trafficDst, trafficType, packetCount, findPath, addLog]);

  // Animate packets
  useEffect(() => {
    const interval = setInterval(() => {
      setPackets(prev => prev.map(pkt => {
        if (pkt.status !== "transit") return pkt;
        if (pkt.currentHop >= pkt.path.length - 1) {
          const latency = Date.now() - pkt.startTime;
          setStats(s => ({
            ...s,
            delivered: s.delivered + 1,
            avgLatency: (s.avgLatency * (s.delivered) + latency) / (s.delivered + 1),
          }));
          addLog(`✅ Packet #${pkt.id} delivered (${latency}ms)`);
          return { ...pkt, status: "delivered" as const, latency };
        }

        const from = pkt.path[pkt.currentHop];
        const to = pkt.path[pkt.currentHop + 1];
        const link = getLink(from, to);

        // Packet loss or link down
        if (!link || link.up === false || Math.random() * 100 < link.loss) {
          setStats(s => ({ ...s, dropped: s.dropped + 1 }));
          const reason = (!link || link.up === false) ? "link down" : `${link.loss}% loss`;
          addLog(`❌ Packet #${pkt.id} dropped on ${from}→${to} (${reason})`);
          return { ...pkt, status: "dropped" as const };
        }

        return { ...pkt, currentHop: pkt.currentHop + 1 };
      }));
    }, 400);
    return () => clearInterval(interval);
  }, [getLink, addLog]);

  const stopSimulation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSimulating(false);
    addLog("⏹ Simulation stopped");
  };

  const resetAll = () => {
    stopSimulation();
    setPackets([]);
    setLog([]);
    setStats({ sent: 0, delivered: 0, dropped: 0, avgLatency: 0 });
  };

  const loadPreset = (key: string) => {
    resetAll();
    setActivePreset(key);
    setDevices(topologyPresets[key].devices);
    setConnections(topologyPresets[key].connections);
    const devIds = topologyPresets[key].devices.map(d => d.id);
    if (!devIds.includes(trafficSrc)) setTrafficSrc(devIds[0]);
    if (!devIds.includes(trafficDst)) setTrafficDst(devIds[devIds.length - 1]);
    addLog(`📋 Loaded topology: ${topologyPresets[key].name}`);
  };

  // Drag devices
  const handlePointerDown = (id: string) => setDragId(id);
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 680 / rect.width;
    const scaleY = 400 / rect.height;
    const x = Math.max(30, Math.min(650, (e.clientX - rect.left) * scaleX));
    const y = Math.max(30, Math.min(370, (e.clientY - rect.top) * scaleY));
    setDevices(devs => devs.map(d => d.id === dragId ? { ...d, x, y } : d));
  };
  const handlePointerUp = () => setDragId(null);

  // Edit connection
  const editingConn = selectedConn ? connections.find(c => c.id === selectedConn) : null;
  const editingDevice = selectedDevice ? devices.find(d => d.id === selectedDevice) : null;

  const svgW = 680, svgH = 400;

  // Packet positions for animation
  const getPacketSvgPos = (pkt: Packet) => {
    if (pkt.currentHop >= pkt.path.length) return null;
    const dev = devices.find(d => d.id === pkt.path[pkt.currentHop]);
    return dev ? { x: dev.x, y: dev.y } : null;
  };

  return (
    <div className="space-y-5">
      {/* Topology presets */}
      <div className="flex gap-1.5 flex-wrap items-center">
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mr-1">Topology:</span>
        {Object.entries(topologyPresets).map(([key, preset]) => (
          <button key={key} onClick={() => loadPreset(key)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              activePreset === key ? "bg-chart-4/15 border-chart-4/40 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {preset.name}
          </button>
        ))}
      </div>

      {/* Traffic config */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Protocol</label>
          <div className="flex gap-1">
            {(["ping", "http", "stream"] as const).map(t => (
              <button key={t} onClick={() => setTrafficType(t)}
                className={cn("px-2 py-0.5 rounded text-[9px] font-mono border transition-all",
                  trafficType === t ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground"
                )}>{t.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Source</label>
          <select value={trafficSrc} onChange={e => setTrafficSrc(e.target.value)}
            className="w-full bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground">
            {devices.map(d => <option key={d.id} value={d.id}>{d.id} ({d.label})</option>)}
          </select>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Destination</label>
          <select value={trafficDst} onChange={e => setTrafficDst(e.target.value)}
            className="w-full bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground">
            {devices.map(d => <option key={d.id} value={d.id}>{d.id} ({d.label})</option>)}
          </select>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Packets</label>
          <input type="range" min={1} max={50} value={packetCount} onChange={e => setPacketCount(+e.target.value)}
            className="w-full accent-[hsl(var(--chart-4))]" />
          <div className="text-[10px] font-mono text-chart-4">{packetCount}</div>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex items-center justify-center gap-2">
          {!isSimulating ? (
            <button onClick={startSimulation}
              className="px-4 py-2 rounded-lg text-xs font-mono bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90 transition-all">
              <Play size={14} /> Run
            </button>
          ) : (
            <button onClick={stopSimulation}
              className="px-4 py-2 rounded-lg text-xs font-mono bg-destructive text-destructive-foreground flex items-center gap-1.5">
              ⏹ Stop
            </button>
          )}
          <button onClick={resetAll}
            className="px-3 py-2 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Sent" value={`${stats.sent}`} color="text-chart-4" />
        <Stat label="Delivered" value={`${stats.delivered}`} color="text-primary" />
        <Stat label="Dropped" value={`${stats.dropped}`} color="text-destructive" />
        <Stat label="Loss Rate" value={stats.sent ? `${((stats.dropped / stats.sent) * 100).toFixed(1)}%` : "—"} color={stats.dropped > 0 ? "text-destructive" : "text-primary"} />
        <Stat label="Avg Latency" value={stats.delivered ? `${stats.avgLatency.toFixed(0)}ms` : "—"} color="text-chart-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Topology canvas */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              NETWORK TOPOLOGY — Drag to rearrange
            </div>
            <div className="flex-1" />
            <div className="flex gap-2 text-[8px] font-mono text-muted-foreground">
              {Object.entries(deviceIcons).map(([type, icon]) => (
                <span key={type}>{icon} {type}</span>
              ))}
            </div>
          </div>
          <svg ref={svgRef} width="100%" viewBox={`0 0 ${svgW} ${svgH}`}
            className="bg-muted/10 rounded-lg touch-none"
            onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>

            {/* Connections */}
            {connections.map(conn => {
              const from = devices.find(d => d.id === conn.from);
              const to = devices.find(d => d.id === conn.to);
              if (!from || !to) return null;

              const isActive = packets.some(p => p.status === "transit" && p.path.includes(conn.from) && p.path.includes(conn.to));
              const isSel = selectedConn === conn.id;
              const isDown = conn.up === false;

              return (
                <g key={conn.id} onClick={() => setSelectedConn(conn.id === selectedConn ? null : conn.id)} className="cursor-pointer">
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={isDown ? "hsl(var(--destructive))" : isSel ? "hsl(var(--primary))" : isActive ? "hsl(var(--chart-3))" : "hsl(var(--muted-foreground))"}
                    strokeWidth={isSel ? 3 : isActive ? 2.5 : 1.5}
                    opacity={isDown ? 0.3 : isActive ? 1 : 0.4}
                    strokeDasharray={isDown ? "2 6" : isActive ? "0" : "4 4"} />
                  {/* Link info */}
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle"
                    fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                    {conn.bandwidth >= 1000 ? `${conn.bandwidth / 1000}G` : `${conn.bandwidth}M`} | {conn.delay}ms
                    {conn.loss > 0 ? ` | ${conn.loss}%↓` : ""}
                  </text>
                </g>
              );
            })}

            {/* Devices */}
            {devices.map(dev => {
              const isSel = selectedDevice === dev.id;
              const isSrc = dev.id === trafficSrc;
              const isDst = dev.id === trafficDst;
              const hasPacket = packets.some(p => p.status === "transit" && p.path[p.currentHop] === dev.id);

              return (
                <g key={dev.id}
                  onPointerDown={() => { handlePointerDown(dev.id); setSelectedDevice(dev.id === selectedDevice ? null : dev.id); }}
                  className="cursor-grab">

                  {/* Glow */}
                  {hasPacket && (
                    <circle cx={dev.x} cy={dev.y} r="28" fill="none" stroke="hsl(var(--chart-3))" strokeWidth="2" opacity="0.5">
                      <animate attributeName="r" values="24;30;24" dur="0.8s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Device body */}
                  <rect x={dev.x - 22} y={dev.y - 18} width="44" height="36" rx="6"
                    fill={isSel ? "hsl(var(--primary) / 0.2)" :
                      isSrc ? "hsl(var(--chart-3) / 0.15)" :
                        isDst ? "hsl(var(--chart-4) / 0.15)" :
                          "hsl(var(--muted) / 0.8)"}
                    stroke={isSel ? "hsl(var(--primary))" :
                      isSrc ? "hsl(var(--chart-3))" :
                        isDst ? "hsl(var(--chart-4))" :
                          "hsl(var(--border))"}
                    strokeWidth={isSel || isSrc || isDst ? 2 : 1} />
                  <text x={dev.x} y={dev.y + 2} textAnchor="middle" fontSize="16">{deviceIcons[dev.type]}</text>
                  <text x={dev.x} y={dev.y + 30} textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">
                    {dev.id}
                  </text>
                  <text x={dev.x} y={dev.y + 40} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                    {dev.ip !== "—" ? dev.ip : dev.label}
                  </text>
                </g>
              );
            })}

            {/* Animated packets */}
            {packets.filter(p => p.status === "transit").map(pkt => {
              const pos = getPacketSvgPos(pkt);
              if (!pos) return null;
              return (
                <g key={pkt.id}>
                  <circle cx={pos.x} cy={pos.y - 24} r="5"
                    fill={pkt.protocol === "ICMP" ? "hsl(var(--chart-3))" : pkt.protocol === "HTTP" ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                    className="animate-pulse" />
                  <text x={pos.x + 8} y={pos.y - 22} fontSize="6" fill="hsl(var(--chart-3))" fontFamily="monospace">
                    #{pkt.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Device/Connection Inspector */}
          {editingDevice && (
            <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-2">
              <div className="text-[10px] font-mono text-primary uppercase tracking-wider">
                {deviceIcons[editingDevice.type]} {editingDevice.id} — {editingDevice.label}
              </div>
              <div className="space-y-1 text-[10px] font-mono text-muted-foreground">
                <div>Type: <span className="text-foreground">{editingDevice.type}</span></div>
                <div>IP: <span className="text-chart-2">{editingDevice.ip}</span></div>
                <div>MAC: <span className="text-chart-3">{editingDevice.mac}</span></div>
                <div>Interfaces: <span className="text-chart-4">{editingDevice.interfaces.join(", ")}</span></div>
              </div>
            </div>
          )}

          {editingConn && (
            <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-2">
              <div className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                Link: {editingConn.from} ↔ {editingConn.to}
              </div>
              <div className="flex items-center gap-2 pb-1">
                <label className="text-[8px] text-muted-foreground font-mono">STATUS</label>
                <button
                  onClick={() => setConnections(conns => conns.map(c => c.id === selectedConn ? { ...c, up: c.up === false ? true : false } : c))}
                  className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all",
                    editingConn.up !== false ? "bg-primary/20 text-primary border border-primary/30" : "bg-destructive/20 text-destructive border border-destructive/30"
                  )}>
                  {editingConn.up !== false ? "UP (ACTIVE)" : "DOWN (LINK BROKEN)"}
                </button>
              </div>
              {[
                { label: "Bandwidth (Mbps)", key: "bandwidth" as const, min: 1, max: 10000, color: "chart-2" },
                { label: "Delay (ms)", key: "delay" as const, min: 0, max: 100, color: "chart-3" },
                { label: "Loss (%)", key: "loss" as const, min: 0, max: 50, color: "destructive" },
                { label: "Jitter (ms)", key: "jitter" as const, min: 0, max: 20, color: "chart-4" },
              ].map(ctrl => (
                <div key={ctrl.key} className="space-y-0.5">
                  <div className="flex justify-between">
                    <label className="text-[8px] text-muted-foreground font-mono">{ctrl.label}</label>
                    <span className={cn("text-[10px] font-mono", `text-${ctrl.color}`)}>{editingConn[ctrl.key]}</span>
                  </div>
                  <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.key === "loss" ? 0.5 : 1}
                    value={editingConn[ctrl.key]}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setConnections(conns => conns.map(c => c.id === selectedConn ? { ...c, [ctrl.key]: val } : c));
                    }}
                    className={`w-full accent-[hsl(var(--${ctrl.color}))]`} />
                </div>
              ))}
            </div>
          )}

          {/* ARP/MAC Table */}
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">ARP TABLE</div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {devices.filter(d => d.ip !== "—").map(d => (
                <div key={d.id} className="flex text-[9px] font-mono text-muted-foreground gap-2">
                  <span className="text-chart-2 w-24">{d.ip}</span>
                  <span className="text-chart-3">{d.mac}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Routing table */}
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">ROUTING (from {trafficSrc})</div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {devices.filter(d => d.id !== trafficSrc).map(d => {
                const path = findPath(trafficSrc, d.id);
                return (
                  <div key={d.id} className="flex text-[9px] font-mono text-muted-foreground gap-2">
                    <span className="text-foreground w-8">{d.id}</span>
                    <span className={cn("flex-1", path.length > 0 ? "text-primary" : "text-destructive/70 italic")}>{path.length > 0 ? path.join("→") : "unreachable"}</span>
                    <span className="text-chart-4">{path.length > 0 ? `${path.length - 1}hop` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event log */}
          <div className="p-3 rounded-xl bg-card border border-border max-h-48 overflow-y-auto">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">EVENT LOG</div>
            {log.length === 0 && <div className="text-[9px] font-mono text-muted-foreground/50 italic">Run simulation to see events...</div>}
            {log.map((entry, i) => (
              <div key={i} className="text-[9px] font-mono text-muted-foreground leading-relaxed">{entry}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Throughput visualization */}
      {stats.sent > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-[10px] font-mono text-muted-foreground mb-2">THROUGHPUT</div>
          <div className="flex h-5 rounded-full overflow-hidden border border-border">
            <div className="bg-primary/60 transition-all" style={{ width: `${(stats.delivered / Math.max(stats.sent, 1)) * 100}%` }} />
            <div className="bg-destructive/60 transition-all" style={{ width: `${(stats.dropped / Math.max(stats.sent, 1)) * 100}%` }} />
            <div className="bg-chart-3/30 flex-1" />
          </div>
          <div className="flex justify-between mt-1 text-[8px] font-mono text-muted-foreground">
            <span className="text-primary">Delivered: {stats.delivered}</span>
            <span className="text-destructive">Dropped: {stats.dropped}</span>
            <span>In-flight: {stats.sent - stats.delivered - stats.dropped}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[7px] text-muted-foreground font-mono">{label}</div>
  </div>
);

export default NetworkSimulator;

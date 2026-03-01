import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, BarChart3 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────
type Topology = "bus" | "ring" | "star" | "mesh" | "tree" | "hybrid";
type Protocol = "TCP" | "UDP";

interface SimConfig {
  topology: Topology;
  nodeCount: number;
  bandwidth: number;    // Mbps
  propDelay: number;    // ms
  packetSize: number;   // bytes
  trafficRate: number;  // packets/sec
  protocol: Protocol;
  snrDb: number;
  bufferSize: number;   // packets
}

interface SimResult {
  topology: Topology;
  throughput: number;       // Mbps
  avgDelay: number;         // ms
  packetLoss: number;       // %
  retransmissions: number;
  totalSent: number;
  totalDelivered: number;
  totalDropped: number;
  berDropped: number;
  bufferDropped: number;
  cwndHistory: number[];
  berCurve: { snr: number; ber: number }[];
  hopCount: number;
  faultTolerance: string;
  spof: string;
  scalability: string;
}

// ─── Topology Info ───────────────────────────────────────────────────────
const topoInfo: Record<Topology, { name: string; icon: string; description: string; dataFlow: string; failureImpact: string; useCases: string }> = {
  bus: {
    name: "Bus", icon: "═══",
    description: "All nodes share a single backbone cable. Data travels in both directions along the bus. Terminators at each end prevent signal reflection.",
    dataFlow: "Broadcast — every frame reaches all nodes; each NIC checks destination MAC and accepts/discards.",
    failureImpact: "Single cable break partitions the entire network. Any node failure does not affect others, but backbone failure is catastrophic.",
    useCases: "Legacy Ethernet (10BASE2, 10BASE5), small lab networks, CAN bus in automotive systems.",
  },
  ring: {
    name: "Ring", icon: "◯",
    description: "Each node connects to exactly two neighbors forming a closed loop. Data travels unidirectionally (or bidirectionally in dual-ring).",
    dataFlow: "Token-passing or sequential relay. Each node regenerates and forwards. Deterministic access delay.",
    failureImpact: "Single node/link failure breaks the ring (unless dual-ring with wrap-around). FDDI uses counter-rotating ring for redundancy.",
    useCases: "Token Ring (IEEE 802.5), SONET/SDH rings in telecom, industrial automation rings.",
  },
  star: {
    name: "Star", icon: "✦",
    description: "All nodes connect to a central hub/switch. No direct inter-node links. The hub is the single point of failure.",
    dataFlow: "Hub: broadcast to all ports. Switch: learns MAC table, forwards unicast to correct port only.",
    failureImpact: "Central device failure disconnects all nodes. Individual node failure has zero impact on others.",
    useCases: "Modern Ethernet LANs, WiFi (AP as center), home networks, office floor switches.",
  },
  mesh: {
    name: "Mesh", icon: "⬡",
    description: "Every node connects to every other node (full mesh) or most nodes (partial mesh). Maximum redundancy.",
    dataFlow: "Multiple paths available. Routing protocols (OSPF, BGP) select optimal path. Load balancing possible.",
    failureImpact: "Extremely fault-tolerant. Multiple simultaneous failures tolerated. No single point of failure in full mesh.",
    useCases: "ISP backbone, data center spine-leaf, military networks, IoT mesh (Zigbee, Thread).",
  },
  tree: {
    name: "Tree", icon: "🌳",
    description: "Hierarchical structure with root node, intermediate nodes, and leaf nodes. Combination of star topologies connected via bus backbone.",
    dataFlow: "Traffic flows up to common ancestor then down to destination. Aggregation at each level.",
    failureImpact: "Root/intermediate failure disconnects entire subtree. Leaf failure has minimal impact.",
    useCases: "Enterprise campus networks, CATV distribution, DNS hierarchy, organizational LANs.",
  },
  hybrid: {
    name: "Hybrid", icon: "⚙️",
    description: "Combines two or more basic topologies. Core uses mesh for redundancy, access layer uses star for simplicity.",
    dataFlow: "Varies by segment. Core: multi-path routing. Edge: switched star. Policies define inter-segment forwarding.",
    failureImpact: "Depends on segment. Core mesh survives failures; edge star segments have hub SPOF. Overall resilience is high.",
    useCases: "Real enterprise/ISP networks, cloud data centers (spine-leaf + ToR star), 5G transport networks.",
  },
};

// ─── Topology Graph Generation ──────────────────────────────────────────
interface Node { id: number; x: number; y: number; label: string }
interface Link { from: number; to: number }

const generateTopology = (topo: Topology, n: number): { nodes: Node[]; links: Link[] } => {
  const cx = 280, cy = 180, r = 130;
  const nodes: Node[] = [];
  const links: Link[] = [];

  switch (topo) {
    case "bus": {
      const spacing = 500 / (n + 1);
      for (let i = 0; i < n; i++) {
        nodes.push({ id: i, x: 40 + spacing * (i + 1), y: 180, label: `N${i}` });
      }
      for (let i = 0; i < n - 1; i++) links.push({ from: i, to: i + 1 });
      break;
    }
    case "ring": {
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), label: `N${i}` });
      }
      for (let i = 0; i < n; i++) links.push({ from: i, to: (i + 1) % n });
      break;
    }
    case "star": {
      nodes.push({ id: 0, x: cx, y: cy, label: "Hub" });
      for (let i = 1; i < n; i++) {
        const angle = (2 * Math.PI * (i - 1)) / (n - 1) - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), label: `N${i}` });
        links.push({ from: 0, to: i });
      }
      break;
    }
    case "mesh": {
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), label: `N${i}` });
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++)
          links.push({ from: i, to: j });
      break;
    }
    case "tree": {
      // Root
      nodes.push({ id: 0, x: cx, y: 40, label: "Root" });
      let id = 1;
      // Level 1: 2-3 children
      const l1Count = Math.min(3, n - 1);
      const l1Spacing = 400 / (l1Count + 1);
      const l1Ids: number[] = [];
      for (let i = 0; i < l1Count; i++) {
        nodes.push({ id, x: 80 + l1Spacing * (i + 1), y: 130, label: `S${i}` });
        links.push({ from: 0, to: id });
        l1Ids.push(id);
        id++;
      }
      // Level 2: distribute remaining nodes
      const remaining = n - 1 - l1Count;
      for (let i = 0; i < remaining; i++) {
        const parent = l1Ids[i % l1Count];
        const parentNode = nodes[parent];
        const childIdx = Math.floor(i / l1Count);
        nodes.push({ id, x: parentNode.x - 40 + childIdx * 50, y: 240 + (childIdx % 2) * 30, label: `L${i}` });
        links.push({ from: parent, to: id });
        id++;
      }
      break;
    }
    case "hybrid": {
      // Core mesh (3 nodes) + star leaves
      const coreCount = Math.min(3, n);
      for (let i = 0; i < coreCount; i++) {
        const angle = (2 * Math.PI * i) / coreCount - Math.PI / 2;
        nodes.push({ id: i, x: cx + 60 * Math.cos(angle), y: cy + 50 * Math.sin(angle), label: `C${i}` });
      }
      for (let i = 0; i < coreCount; i++)
        for (let j = i + 1; j < coreCount; j++)
          links.push({ from: i, to: j });
      let leafId = coreCount;
      const leafPerCore = Math.ceil((n - coreCount) / coreCount);
      for (let c = 0; c < coreCount && leafId < n; c++) {
        const coreNode = nodes[c];
        for (let l = 0; l < leafPerCore && leafId < n; l++) {
          const angle = (2 * Math.PI * c) / coreCount + (l - leafPerCore / 2) * 0.5 - Math.PI / 2;
          const dist = 120 + l * 15;
          nodes.push({ id: leafId, x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle), label: `N${leafId}` });
          links.push({ from: c, to: leafId });
          leafId++;
        }
      }
      break;
    }
  }

  return { nodes, links };
};

// ─── Simulation Engine ──────────────────────────────────────────────────
const berFromSnr = (snrDb: number): number => {
  // BPSK BER ≈ 0.5 * erfc(sqrt(SNR_linear))
  const snrLin = Math.pow(10, snrDb / 10);
  // Approximation of Q-function
  const q = Math.exp(-snrLin) / (1 + snrLin);
  return Math.max(1e-12, Math.min(0.5, q));
};

const packetErrorRate = (ber: number, packetBits: number): number => {
  return 1 - Math.pow(1 - ber, packetBits);
};

const runSimulation = (cfg: SimConfig): SimResult => {
  const { topology, nodeCount, bandwidth, propDelay, packetSize, trafficRate, protocol, snrDb, bufferSize } = cfg;
  const { links } = generateTopology(topology, nodeCount);

  // Compute average hop count
  const avgHops = (() => {
    switch (topology) {
      case "bus": return (nodeCount - 1) / 2;
      case "ring": return nodeCount / 4;
      case "star": return 2; // always through hub
      case "mesh": return 1; // direct link
      case "tree": return Math.ceil(Math.log2(nodeCount)) * 2;
      case "hybrid": return 2.5;
    }
  })();

  const ber = berFromSnr(snrDb);
  const packetBits = packetSize * 8;
  const per = packetErrorRate(ber, packetBits);

  // Transmission delay per hop
  const txDelay = (packetBits / (bandwidth * 1e6)) * 1000; // ms
  const totalPropDelay = propDelay * avgHops;
  const baseDelay = txDelay * avgHops + totalPropDelay;

  // Traffic load
  const linkCapacity = bandwidth * 1e6 / packetBits; // packets/s per link
  const totalLinks = links.length || 1;
  const effectiveLinks = Math.max(1, (() => {
    switch (topology) {
      case "bus": return 1; // shared medium
      case "ring": return 1; // sequential
      case "star": return Math.max(1, nodeCount - 1);
      case "mesh": return totalLinks;
      case "tree": return Math.ceil(nodeCount / 3);
      case "hybrid": return Math.ceil(totalLinks * 0.7);
    }
  })());

  const aggregateCapacity = linkCapacity * effectiveLinks;
  const utilization = Math.min(trafficRate / aggregateCapacity, 1);

  // Queue delay (M/M/1 model)
  const rho = Math.min(utilization, 0.99);
  const queueDelay = rho > 0.01 ? (txDelay * rho) / (1 - rho) : 0;

  // Simulate TCP congestion window
  const cwndHistory: number[] = [];
  const simDuration = 100; // RTTs
  let cwnd = 1;
  let ssthresh = 64;
  const rtt = baseDelay + queueDelay;
  let retransmissions = 0;

  if (protocol === "TCP") {
    for (let t = 0; t < simDuration; t++) {
      // Loss probability per window
      const windowLoss = 1 - Math.pow(1 - per, cwnd);
      const congestionLoss = utilization > 0.85 ? (utilization - 0.85) * 3 : 0;
      const totalLossProb = Math.min(1, windowLoss + congestionLoss);

      if (Math.random() < totalLossProb) {
        ssthresh = Math.max(2, Math.floor(cwnd / 2));
        cwnd = 1; // Tahoe-like for clarity
        retransmissions++;
      } else {
        if (cwnd < ssthresh) cwnd *= 2; // slow start
        else cwnd += 1; // congestion avoidance
      }
      cwnd = Math.min(cwnd, 128);
      cwndHistory.push(cwnd);
    }
  }

  // Total simulation
  const simSeconds = 10;
  const totalSent = Math.round(trafficRate * simSeconds);

  // Buffer overflow drops
  const overflowRate = utilization > 1 ? (utilization - 1) / utilization : (utilization > 0.9 ? (utilization - 0.9) * 0.5 : 0);
  const bufferDropped = Math.round(totalSent * overflowRate * (64 / Math.max(bufferSize, 1)));

  // BER drops
  const berDropped = Math.round((totalSent - bufferDropped) * per);

  const totalDropped = bufferDropped + berDropped;
  const totalDelivered = totalSent - totalDropped;
  const packetLoss = totalSent > 0 ? (totalDropped / totalSent) * 100 : 0;

  // Throughput
  const goodputBits = totalDelivered * packetBits;
  const throughput = goodputBits / (simSeconds * 1e6); // Mbps

  const avgDelay = baseDelay + queueDelay;

  // BER curve
  const berCurve: { snr: number; ber: number }[] = [];
  for (let s = 0; s <= 30; s += 1) {
    berCurve.push({ snr: s, ber: berFromSnr(s) });
  }

  // Topology analysis
  const faultTolerance = (() => {
    switch (topology) {
      case "bus": return "LOW — single backbone failure partitions network";
      case "ring": return "LOW — single break disrupts ring (dual-ring: MEDIUM)";
      case "star": return "MEDIUM — only hub failure is critical";
      case "mesh": return "HIGH — multiple redundant paths survive failures";
      case "tree": return "MEDIUM — subtree isolation on intermediate failure";
      case "hybrid": return "HIGH — mesh core + star edge provides layered resilience";
    }
  })();

  const spof = (() => {
    switch (topology) {
      case "bus": return "Backbone cable (any point)";
      case "ring": return "Any single link or node";
      case "star": return "Central hub/switch";
      case "mesh": return "None (full mesh)";
      case "tree": return "Root node, intermediate switches";
      case "hybrid": return "Edge hub only (core is redundant)";
    }
  })();

  const scalability = (() => {
    switch (topology) {
      case "bus": return "POOR — shared medium, collision domain grows linearly";
      case "ring": return "POOR — adding nodes increases ring latency";
      case "star": return "GOOD — add nodes to hub/switch ports";
      case "mesh": return "POOR — links grow as O(n²), impractical at scale";
      case "tree": return "GOOD — hierarchical expansion, add branches";
      case "hybrid": return "EXCELLENT — modular growth at each layer";
    }
  })();

  return {
    topology, throughput, avgDelay, packetLoss, retransmissions,
    totalSent, totalDelivered, totalDropped, berDropped, bufferDropped,
    cwndHistory, berCurve, hopCount: Math.round(avgHops * 10) / 10,
    faultTolerance, spof, scalability,
  };
};

// ─── Component ──────────────────────────────────────────────────────────
const TopologySimLab = () => {
  const [config, setConfig] = useState<SimConfig>({
    topology: "star",
    nodeCount: 8,
    bandwidth: 100,
    propDelay: 5,
    packetSize: 1024,
    trafficRate: 500,
    protocol: "TCP",
    snrDb: 15,
    bufferSize: 64,
  });

  const [result, setResult] = useState<SimResult | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState<SimResult[]>([]);
  const [animPackets, setAnimPackets] = useState<{ linkIdx: number; progress: number }[]>([]);
  const animRef = useRef<number | null>(null);

  const upd = useCallback(<K extends keyof SimConfig>(key: K, val: SimConfig[K]) => {
    setConfig(c => ({ ...c, [key]: val }));
  }, []);

  const topoGraph = useMemo(() => generateTopology(config.topology, config.nodeCount), [config.topology, config.nodeCount]);

  const runSim = useCallback(() => {
    const r = runSimulation(config);
    setResult(r);
    // Animate packets
    const pkts = topoGraph.links.slice(0, 8).map((_, i) => ({ linkIdx: i, progress: Math.random() }));
    setAnimPackets(pkts);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let frame = 0;
    const animate = () => {
      frame++;
      setAnimPackets(prev => prev.map(p => ({
        ...p,
        progress: (p.progress + 0.02 + Math.random() * 0.01) % 1,
      })));
      if (frame < 150) animRef.current = requestAnimationFrame(animate);
      else setAnimPackets([]);
    };
    animRef.current = requestAnimationFrame(animate);
  }, [config, topoGraph]);

  const runComparison = useCallback(() => {
    const topos: Topology[] = ["bus", "ring", "star", "mesh", "tree", "hybrid"];
    const results = topos.map(t => runSimulation({ ...config, topology: t }));
    setCompareResults(results);
    setCompareMode(true);
  }, [config]);

  useEffect(() => { return () => { if (animRef.current) cancelAnimationFrame(animRef.current); }; }, []);

  const info = topoInfo[config.topology];
  const svgW = 560, svgH = 360;

  // ─── Analysis text ────
  const analysisText = useMemo(() => {
    if (!result) return "";
    const t = result.topology;
    const lines: string[] = [];

    if (result.packetLoss > 10) {
      lines.push(`High packet loss (${result.packetLoss.toFixed(1)}%) observed. ${result.bufferDropped > result.berDropped ? "Buffer overflow is the dominant factor — the topology's limited parallelism creates bottlenecks under this traffic load." : "BER-induced errors dominate — at SNR=${config.snrDb}dB, the physical layer is the limiting factor. Increasing SNR or using FEC coding would help."}`);
    }
    if (result.throughput < config.bandwidth * 0.3) {
      lines.push(`Throughput is only ${(result.throughput / config.bandwidth * 100).toFixed(0)}% of link capacity. ${t === "bus" || t === "ring" ? "Shared medium topologies suffer from collision/contention overhead." : "High hop count and queuing delays reduce effective goodput."}`);
    }
    if (config.protocol === "TCP" && result.retransmissions > 5) {
      lines.push(`TCP retransmissions (${result.retransmissions}) indicate congestion. The cwnd repeatedly collapsed due to ${t === "bus" ? "shared medium contention" : t === "mesh" ? "despite redundant paths, high BER on links" : "queuing delays exceeding timeout thresholds"}.`);
    }
    lines.push(`GATE/IES Concept: This demonstrates the relationship between ${t === "mesh" ? "graph connectivity and network reliability (O(n²) links)" : t === "star" ? "centralized switching and single-point-of-failure analysis" : t === "bus" ? "CSMA/CD collision domains and throughput degradation" : "topology-dependent latency scaling"}.`);
    lines.push(`Physical Layer: At SNR=${config.snrDb}dB, BER≈${berFromSnr(config.snrDb).toExponential(2)}. Shannon capacity per link: ${(config.bandwidth * Math.log2(1 + Math.pow(10, config.snrDb / 10))).toFixed(1)} Mbps (theoretical max).`);

    return lines.join("\n\n");
  }, [result, config]);

  return (
    <div className="space-y-5">
      {/* ── Topology Selector ── */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(topoInfo) as Topology[]).map(t => (
          <button key={t} onClick={() => upd("topology", t)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              config.topology === t ? "bg-chart-4/15 border-chart-4/40 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {topoInfo[t].icon} {topoInfo[t].name}
          </button>
        ))}
      </div>

      {/* ── Configuration Panel ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
        <Ctrl label="Nodes" value={config.nodeCount} min={3} max={16} step={1} color="primary" onChange={v => upd("nodeCount", v)} />
        <Ctrl label="Bandwidth (Mbps)" value={config.bandwidth} min={1} max={1000} step={10} color="chart-2" onChange={v => upd("bandwidth", v)} />
        <Ctrl label="Prop Delay (ms)" value={config.propDelay} min={0.1} max={50} step={0.5} color="chart-3" onChange={v => upd("propDelay", v)} />
        <Ctrl label="Packet Size (B)" value={config.packetSize} min={64} max={9000} step={64} color="chart-4" onChange={v => upd("packetSize", v)} />
        <Ctrl label="Traffic (pkt/s)" value={config.trafficRate} min={10} max={5000} step={50} color="primary" onChange={v => upd("trafficRate", v)} />
        <Ctrl label="SNR (dB)" value={config.snrDb} min={0} max={30} step={1} color="chart-2" onChange={v => upd("snrDb", v)} />
        <Ctrl label="Buffer (pkts)" value={config.bufferSize} min={4} max={256} step={4} color="chart-3" onChange={v => upd("bufferSize", v)} />
        <div className="p-2.5 rounded-xl bg-card border border-border space-y-1">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Protocol</label>
          <div className="flex gap-1">
            {(["TCP", "UDP"] as const).map(p => (
              <button key={p} onClick={() => upd("protocol", p)}
                className={cn("px-3 py-1 rounded text-[10px] font-mono border transition-all flex-1",
                  config.protocol === p ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground"
                )}>{p}</button>
            ))}
          </div>
        </div>
        <div className="p-2.5 rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-1.5">
          <button onClick={runSim}
            className="px-4 py-1.5 rounded-lg text-xs font-mono bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90 transition-all w-full justify-center">
            <Play size={13} /> Simulate
          </button>
          <button onClick={runComparison}
            className="px-3 py-1 rounded-lg text-[10px] font-mono border border-chart-3/40 text-chart-3 flex items-center gap-1 hover:bg-chart-3/10 transition-all w-full justify-center">
            <BarChart3 size={12} /> Compare All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Topology Visualization ── */}
        <div className="p-4 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wider">
            {info.name} TOPOLOGY — {config.nodeCount} nodes, {topoGraph.links.length} links
          </div>
          <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="bg-muted/10 rounded-lg">
            {/* Links */}
            {topoGraph.links.map((link, i) => {
              const from = topoGraph.nodes[link.from];
              const to = topoGraph.nodes[link.to];
              if (!from || !to) return null;
              const hasPacket = animPackets.some(p => p.linkIdx === i);
              return (
                <g key={`l${i}`}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={hasPacket ? "hsl(var(--chart-3))" : "hsl(var(--muted-foreground))"}
                    strokeWidth={hasPacket ? 2.5 : 1.2} opacity={hasPacket ? 1 : 0.35}
                    strokeDasharray={hasPacket ? "0" : "4 4"} />
                  {/* Animated packet dot */}
                  {animPackets.filter(p => p.linkIdx === i).map((pkt, pi) => (
                    <circle key={pi}
                      cx={from.x + (to.x - from.x) * pkt.progress}
                      cy={from.y + (to.y - from.y) * pkt.progress}
                      r="4" fill="hsl(var(--chart-3))" className="animate-pulse" />
                  ))}
                </g>
              );
            })}
            {/* Nodes */}
            {topoGraph.nodes.map(node => (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r="16"
                  fill="hsl(var(--muted) / 0.7)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8"
                  fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">{node.label}</text>
              </g>
            ))}
          </svg>
        </div>

        {/* ── Topology Info ── */}
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-card border border-primary/20 space-y-2">
            <div className="text-sm font-mono font-bold text-primary">{info.icon} {info.name} Topology</div>
            <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">{info.description}</div>
            <div className="space-y-1.5 text-[10px] font-mono">
              <div><span className="text-chart-2 font-bold">Data Flow:</span> <span className="text-muted-foreground">{info.dataFlow}</span></div>
              <div><span className="text-destructive font-bold">Failure Impact:</span> <span className="text-muted-foreground">{info.failureImpact}</span></div>
              <div><span className="text-chart-4 font-bold">Use Cases:</span> <span className="text-muted-foreground">{info.useCases}</span></div>
            </div>
          </div>

          {/* Quick BER */}
          <div className="p-3 rounded-xl bg-card border border-border">
            <div className="text-[9px] font-mono text-muted-foreground uppercase mb-1">PHYSICAL LAYER @ SNR={config.snrDb}dB</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded-lg border border-border">
                <div className="text-[10px] font-mono font-bold text-chart-2">{berFromSnr(config.snrDb).toExponential(2)}</div>
                <div className="text-[7px] text-muted-foreground font-mono">BER</div>
              </div>
              <div className="p-1.5 rounded-lg border border-border">
                <div className="text-[10px] font-mono font-bold text-chart-3">{(packetErrorRate(berFromSnr(config.snrDb), config.packetSize * 8) * 100).toFixed(3)}%</div>
                <div className="text-[7px] text-muted-foreground font-mono">PER</div>
              </div>
              <div className="p-1.5 rounded-lg border border-border">
                <div className="text-[10px] font-mono font-bold text-chart-4">{(config.bandwidth * Math.log2(1 + Math.pow(10, config.snrDb / 10))).toFixed(1)}</div>
                <div className="text-[7px] text-muted-foreground font-mono">Shannon (Mbps)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {result && !compareMode && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <Stat label="Throughput" value={`${result.throughput.toFixed(2)} Mbps`} color="text-primary" />
            <Stat label="Avg Delay" value={`${result.avgDelay.toFixed(2)} ms`} color="text-chart-2" />
            <Stat label="Packet Loss" value={`${result.packetLoss.toFixed(2)}%`} color={result.packetLoss > 5 ? "text-destructive" : "text-chart-3"} />
            <Stat label="Retransmissions" value={`${result.retransmissions}`} color="text-chart-4" />
            <Stat label="Avg Hops" value={`${result.hopCount}`} color="text-primary" />
            <Stat label="Delivered" value={`${result.totalDelivered}/${result.totalSent}`} color="text-chart-2" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* cwnd graph */}
            {config.protocol === "TCP" && result.cwndHistory.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">TCP CONGESTION WINDOW vs RTT</div>
                <CwndGraph data={result.cwndHistory} />
              </div>
            )}

            {/* BER vs SNR */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">BER vs SNR CURVE</div>
              <BerGraph data={result.berCurve} currentSnr={config.snrDb} />
            </div>
          </div>

          {/* Drop breakdown */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">DROP ANALYSIS</div>
            <div className="flex h-6 rounded-full overflow-hidden border border-border">
              <div className="bg-primary/50 transition-all" style={{ width: `${(result.totalDelivered / Math.max(result.totalSent, 1)) * 100}%` }} />
              <div className="bg-chart-4/50 transition-all" style={{ width: `${(result.berDropped / Math.max(result.totalSent, 1)) * 100}%` }} />
              <div className="bg-destructive/50 transition-all" style={{ width: `${(result.bufferDropped / Math.max(result.totalSent, 1)) * 100}%` }} />
            </div>
            <div className="flex gap-4 mt-1.5 text-[9px] font-mono text-muted-foreground">
              <span className="text-primary">✓ Delivered: {result.totalDelivered}</span>
              <span className="text-chart-4">✗ BER drops: {result.berDropped}</span>
              <span className="text-destructive">✗ Buffer drops: {result.bufferDropped}</span>
            </div>
          </div>

          {/* Topology resilience */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[8px] text-muted-foreground font-mono uppercase">Fault Tolerance</div>
              <div className={cn("text-[10px] font-mono font-bold mt-1",
                result.faultTolerance.startsWith("HIGH") ? "text-chart-3" :
                result.faultTolerance.startsWith("MEDIUM") ? "text-chart-4" : "text-destructive"
              )}>{result.faultTolerance}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[8px] text-muted-foreground font-mono uppercase">Single Point of Failure</div>
              <div className="text-[10px] font-mono font-bold mt-1 text-destructive">{result.spof}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[8px] text-muted-foreground font-mono uppercase">Scalability</div>
              <div className={cn("text-[10px] font-mono font-bold mt-1",
                result.scalability.startsWith("EXCELLENT") || result.scalability.startsWith("GOOD") ? "text-chart-3" : "text-destructive"
              )}>{result.scalability}</div>
            </div>
          </div>

          {/* Analysis */}
          <div className="p-4 rounded-xl bg-card border border-primary/20">
            <div className="text-xs font-mono font-bold text-primary mb-2">🧠 Engineering Analysis</div>
            {analysisText.split("\n\n").map((para, i) => (
              <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed mb-2">{para}</p>
            ))}
          </div>
        </>
      )}

      {/* ── Comparison Mode ── */}
      {compareMode && compareResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm font-mono font-bold text-chart-3">📊 All-Topology Comparison</div>
            <button onClick={() => setCompareMode(false)} className="px-3 py-1 rounded-lg text-[10px] font-mono border border-border text-muted-foreground hover:text-foreground">
              <RotateCcw size={12} className="inline mr-1" /> Back
            </button>
          </div>

          {/* Comparison table */}
          <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground">Metric</th>
                  {compareResults.map(r => (
                    <th key={r.topology} className="text-center py-1.5 text-chart-4">{topoInfo[r.topology].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Throughput (Mbps)", key: "throughput", fmt: (v: number) => v.toFixed(2), best: "max" },
                  { label: "Avg Delay (ms)", key: "avgDelay", fmt: (v: number) => v.toFixed(2), best: "min" },
                  { label: "Packet Loss (%)", key: "packetLoss", fmt: (v: number) => v.toFixed(2), best: "min" },
                  { label: "Retransmissions", key: "retransmissions", fmt: (v: number) => `${v}`, best: "min" },
                  { label: "Avg Hops", key: "hopCount", fmt: (v: number) => `${v}`, best: "min" },
                  { label: "Delivered", key: "totalDelivered", fmt: (v: number) => `${v}`, best: "max" },
                ].map(metric => {
                  const values = compareResults.map(r => (r as any)[metric.key] as number);
                  const bestVal = metric.best === "max" ? Math.max(...values) : Math.min(...values);
                  return (
                    <tr key={metric.key} className="border-b border-border/30">
                      <td className="py-1.5 text-muted-foreground">{metric.label}</td>
                      {compareResults.map(r => {
                        const v = (r as any)[metric.key] as number;
                        const isBest = v === bestVal;
                        return (
                          <td key={r.topology} className={cn("text-center py-1.5",
                            isBest ? "text-chart-3 font-bold" : "text-foreground"
                          )}>
                            {isBest ? "★ " : ""}{metric.fmt(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="border-b border-border/30">
                  <td className="py-1.5 text-muted-foreground">Fault Tolerance</td>
                  {compareResults.map(r => (
                    <td key={r.topology} className={cn("text-center py-1.5 text-[9px]",
                      r.faultTolerance.startsWith("HIGH") ? "text-chart-3" :
                      r.faultTolerance.startsWith("MEDIUM") ? "text-chart-4" : "text-destructive"
                    )}>{r.faultTolerance.split("—")[0]}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-1.5 text-muted-foreground">Scalability</td>
                  {compareResults.map(r => (
                    <td key={r.topology} className={cn("text-center py-1.5 text-[9px]",
                      r.scalability.startsWith("EXCELLENT") || r.scalability.startsWith("GOOD") ? "text-chart-3" : "text-destructive"
                    )}>{r.scalability.split("—")[0]}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Visual bar comparison */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-3 uppercase">THROUGHPUT COMPARISON</div>
            <div className="space-y-1.5">
              {compareResults.sort((a, b) => b.throughput - a.throughput).map((r, i) => {
                const maxTput = Math.max(...compareResults.map(x => x.throughput));
                return (
                  <div key={r.topology} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-12">{topoInfo[r.topology].name}</span>
                    <div className="flex-1 h-4 rounded-full bg-muted/30 border border-border overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all",
                        i === 0 ? "bg-chart-3/60" : "bg-primary/40"
                      )} style={{ width: `${(r.throughput / maxTput) * 100}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-mono w-20 text-right",
                      i === 0 ? "text-chart-3 font-bold" : "text-muted-foreground"
                    )}>{r.throughput.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delay comparison */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-3 uppercase">DELAY COMPARISON (lower is better)</div>
            <div className="space-y-1.5">
              {compareResults.sort((a, b) => a.avgDelay - b.avgDelay).map((r, i) => {
                const maxDelay = Math.max(...compareResults.map(x => x.avgDelay));
                return (
                  <div key={r.topology} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-12">{topoInfo[r.topology].name}</span>
                    <div className="flex-1 h-4 rounded-full bg-muted/30 border border-border overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all",
                        i === 0 ? "bg-chart-3/60" : "bg-chart-4/40"
                      )} style={{ width: `${(r.avgDelay / maxDelay) * 100}%` }} />
                    </div>
                    <span className={cn("text-[10px] font-mono w-20 text-right",
                      i === 0 ? "text-chart-3 font-bold" : "text-muted-foreground"
                    )}>{r.avgDelay.toFixed(2)} ms</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────
const Ctrl = ({ label, value, min, max, step, color, onChange }: {
  label: string; value: number; min: number; max: number; step: number; color: string; onChange: (v: number) => void;
}) => (
  <div className="p-2.5 rounded-xl bg-card border border-border space-y-1">
    <div className="flex justify-between">
      <label className="text-[8px] text-muted-foreground font-mono uppercase">{label}</label>
      <span className={cn("text-[10px] font-mono font-bold", `text-${color}`)}>{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className={`w-full accent-[hsl(var(--${color}))]`} />
  </div>
);

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2.5 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[7px] text-muted-foreground font-mono">{label}</div>
  </div>
);

const CwndGraph = ({ data }: { data: number[] }) => {
  const gW = 460, gH = 160;
  const maxV = Math.max(...data, 10);
  const toX = (i: number) => 40 + (i / data.length) * (gW - 50);
  const toY = (v: number) => gH - 20 - (v / maxV) * (gH - 40);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");

  return (
    <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = toY(maxV * f);
        return <g key={f}>
          <line x1="40" y1={y} x2={gW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />
          <text x="36" y={y + 3} textAnchor="end" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{(maxV * f).toFixed(0)}</text>
        </g>;
      })}
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      <text x={gW / 2} y={gH - 2} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">RTT</text>
      <text x="6" y={gH / 2} textAnchor="middle" fontSize="7" fill="hsl(var(--primary))" fontFamily="monospace" transform={`rotate(-90, 6, ${gH / 2})`}>cwnd</text>
    </svg>
  );
};

const BerGraph = ({ data, currentSnr }: { data: { snr: number; ber: number }[]; currentSnr: number }) => {
  const gW = 460, gH = 160;
  const minBer = 1e-12, maxBer = 0.5;
  const toX = (snr: number) => 40 + (snr / 30) * (gW - 50);
  const toY = (ber: number) => {
    const logMin = Math.log10(minBer);
    const logMax = Math.log10(maxBer);
    const logBer = Math.log10(Math.max(ber, minBer));
    return gH - 20 - ((logBer - logMin) / (logMax - logMin)) * (gH - 40);
  };
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.snr)} ${toY(d.ber)}`).join(" ");
  const curPt = data.find(d => d.snr === currentSnr);

  return (
    <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
      {[-1, -3, -6, -9, -12].map(exp => {
        const y = toY(Math.pow(10, exp));
        return <g key={exp}>
          <line x1="40" y1={y} x2={gW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" />
          <text x="36" y={y + 3} textAnchor="end" fontSize="6" fill="hsl(var(--muted-foreground))" fontFamily="monospace">10^{exp}</text>
        </g>;
      })}
      <path d={path} fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2" />
      {curPt && (
        <g>
          <circle cx={toX(currentSnr)} cy={toY(curPt.ber)} r="5" fill="hsl(var(--destructive))" />
          <text x={toX(currentSnr) + 8} y={toY(curPt.ber) + 3} fontSize="7" fill="hsl(var(--destructive))" fontFamily="monospace">
            {curPt.ber.toExponential(1)}
          </text>
        </g>
      )}
      <text x={gW / 2} y={gH - 2} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">SNR (dB)</text>
      <text x="6" y={gH / 2} textAnchor="middle" fontSize="7" fill="hsl(var(--chart-2))" fontFamily="monospace" transform={`rotate(-90, 6, ${gH / 2})`}>BER (log)</text>
    </svg>
  );
};

export default TopologySimLab;

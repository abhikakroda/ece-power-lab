import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, RotateCcw, BarChart3, Zap, AlertTriangle, TrendingUp } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────
type Topology = "bus" | "ring" | "star" | "mesh" | "tree" | "hybrid";
type Protocol = "TCP" | "UDP";
type Modulation = "BPSK" | "QPSK" | "16QAM" | "64QAM";
type WirelessModel = "none" | "freespace" | "urban" | "indoor";
type ViewTab = "simulate" | "compare" | "scaling" | "failure" | "crosslayer";

interface SimConfig {
  topology: Topology;
  nodeCount: number;
  bandwidth: number;
  propDelay: number;
  packetSize: number;
  trafficRate: number;
  protocol: Protocol;
  snrDb: number;
  bufferSize: number;
  modulation: Modulation;
  wirelessModel: WirelessModel;
  distance: number; // meters (for wireless)
  frequency: number; // GHz (for wireless)
}

interface SimResult {
  topology: Topology;
  modulation: Modulation;
  throughput: number;
  avgDelay: number;
  packetLoss: number;
  retransmissions: number;
  totalSent: number;
  totalDelivered: number;
  totalDropped: number;
  berDropped: number;
  bufferDropped: number;
  cwndHistory: number[];
  berCurve: { snr: number; ber: number }[];
  perCurve: { snr: number; per: number }[];
  tputCurve: { snr: number; tput: number }[];
  hopCount: number;
  ber: number;
  per: number;
  effectiveSnr: number;
  shannonCapacity: number;
  spectralEfficiency: number;
  faultTolerance: string;
  spof: string;
  scalability: string;
  pathLossDb: number;
  congestionFactor: number;
}

// ─── Modulation BER Functions ────────────────────────────────────────────
const modBitsPerSymbol: Record<Modulation, number> = { BPSK: 1, QPSK: 2, "16QAM": 4, "64QAM": 6 };

const erfcApprox = (x: number): number => {
  if (x < 0) return 2 - erfcApprox(-x);
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
};

const berForModulation = (snrDb: number, mod: Modulation): number => {
  const snrLin = Math.pow(10, snrDb / 10);
  switch (mod) {
    case "BPSK": return 0.5 * erfcApprox(Math.sqrt(snrLin));
    case "QPSK": return 0.5 * erfcApprox(Math.sqrt(snrLin)); // same as BPSK per bit
    case "16QAM": return (3 / 8) * erfcApprox(Math.sqrt((2 / 5) * snrLin));
    case "64QAM": return (7 / 24) * erfcApprox(Math.sqrt((1 / 7) * snrLin));
  }
};

const packetErrorRate = (ber: number, bits: number): number => 1 - Math.pow(1 - ber, bits);

// ─── Wireless Path Loss ─────────────────────────────────────────────────
const pathLoss = (model: WirelessModel, distM: number, freqGHz: number): number => {
  if (model === "none" || distM <= 0) return 0;
  const d = Math.max(distM, 1);
  const f = freqGHz * 1e3; // MHz
  switch (model) {
    case "freespace": return 20 * Math.log10(d) + 20 * Math.log10(f) - 27.55;
    case "urban": return 69.55 + 26.16 * Math.log10(f) - 13.82 * Math.log10(30) + (44.9 - 6.55 * Math.log10(30)) * Math.log10(d / 1000 + 0.001); // simplified Okumura-Hata
    case "indoor": return 20 * Math.log10(f) + 30 * Math.log10(d) + 14; // IEEE 802.11 indoor
  }
};

// ─── Topology Info ───────────────────────────────────────────────────────
const topoInfo: Record<Topology, { name: string; icon: string; desc: string; dataFlow: string; failure: string; useCases: string; gateRelevance: string }> = {
  bus: {
    name: "Bus", icon: "═══",
    desc: "All nodes share a single backbone cable. Data travels bidirectionally. Terminators prevent signal reflection. CSMA/CD governs access.",
    dataFlow: "Broadcast — every frame reaches all nodes; each NIC checks destination MAC.",
    failure: "Single cable break partitions entire network. Backbone is critical SPOF.",
    useCases: "Legacy Ethernet (10BASE2/5), CAN bus in automotive, industrial fieldbus.",
    gateRelevance: "CSMA/CD throughput analysis, collision probability, propagation-limited vs capacity-limited networks.",
  },
  ring: {
    name: "Ring", icon: "◯",
    desc: "Each node connects to exactly two neighbors in a closed loop. Unidirectional (or bidirectional in dual-ring). Token-passing access.",
    dataFlow: "Sequential relay — each node regenerates and forwards. Deterministic delay.",
    failure: "Single break disrupts ring. Dual-ring (FDDI) provides wrap-around redundancy.",
    useCases: "Token Ring (802.5), SONET/SDH, industrial automation, RPR.",
    gateRelevance: "Token holding time, maximum access delay = n × token_time, ring latency calculation.",
  },
  star: {
    name: "Star", icon: "✦",
    desc: "All nodes connect to central hub/switch. No direct inter-node links. Most common modern LAN topology.",
    dataFlow: "Hub: broadcast. Switch: unicast via MAC table. Collision domain per port (switch).",
    failure: "Central device failure disconnects all. Individual node failure = zero network impact.",
    useCases: "Modern Ethernet LANs, WiFi (AP-centric), home/office networks.",
    gateRelevance: "Switch vs hub performance, spanning tree protocol, MAC learning, broadcast storm analysis.",
  },
  mesh: {
    name: "Mesh", icon: "⬡",
    desc: "Every node connects to every other (full) or most (partial). Maximum redundancy. Links grow O(n²).",
    dataFlow: "Multiple paths — routing protocols (OSPF/BGP) select optimal. Load balancing possible.",
    failure: "Extremely fault-tolerant. No single point of failure. Survives multiple simultaneous failures.",
    useCases: "ISP backbone, data center fabric, military, IoT mesh (Zigbee/Thread).",
    gateRelevance: "Link count = n(n-1)/2, routing algorithm complexity, Dijkstra vs Bellman-Ford, graph connectivity.",
  },
  tree: {
    name: "Tree", icon: "🌳",
    desc: "Hierarchical — root, intermediate aggregation, leaf nodes. Star topologies cascaded via backbone.",
    dataFlow: "Traffic flows up to common ancestor then down. Aggregation reduces core load.",
    failure: "Root/intermediate failure isolates subtree. Leaf failure has minimal impact.",
    useCases: "Campus networks, CATV, DNS hierarchy, enterprise multi-floor LANs.",
    gateRelevance: "Spanning tree construction, broadcast domain segmentation, hierarchical addressing.",
  },
  hybrid: {
    name: "Hybrid", icon: "⚙️",
    desc: "Combines topologies — mesh core for redundancy, star edge for simplicity. Real-world standard.",
    dataFlow: "Core: multi-path routing. Edge: switched star. Inter-segment policies.",
    failure: "Layered resilience — core survives failures, edge has hub SPOF only.",
    useCases: "Enterprise/ISP networks, cloud data centers, 5G transport.",
    gateRelevance: "Hierarchical network design, core-distribution-access model, redundancy vs cost tradeoff.",
  },
};

// ─── Topology Graph ─────────────────────────────────────────────────────
interface GNode { id: number; x: number; y: number; label: string; failed?: boolean }
interface GLink { from: number; to: number; failed?: boolean }

const generateTopology = (topo: Topology, n: number): { nodes: GNode[]; links: GLink[] } => {
  const cx = 280, cy = 180, r = 130;
  const nodes: GNode[] = [];
  const links: GLink[] = [];

  switch (topo) {
    case "bus": {
      const spacing = 500 / (n + 1);
      for (let i = 0; i < n; i++) nodes.push({ id: i, x: 40 + spacing * (i + 1), y: 180, label: `N${i}` });
      for (let i = 0; i < n - 1; i++) links.push({ from: i, to: i + 1 });
      break;
    }
    case "ring": {
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), label: `N${i}` });
      }
      for (let i = 0; i < n; i++) links.push({ from: i, to: (i + 1) % n });
      break;
    }
    case "star": {
      nodes.push({ id: 0, x: cx, y: cy, label: "Hub" });
      for (let i = 1; i < n; i++) {
        const a = (2 * Math.PI * (i - 1)) / (n - 1) - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), label: `N${i}` });
        links.push({ from: 0, to: i });
      }
      break;
    }
    case "mesh": {
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n - Math.PI / 2;
        nodes.push({ id: i, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), label: `N${i}` });
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) links.push({ from: i, to: j });
      break;
    }
    case "tree": {
      nodes.push({ id: 0, x: cx, y: 40, label: "Root" });
      let id = 1;
      const l1 = Math.min(3, n - 1), sp = 400 / (l1 + 1), l1Ids: number[] = [];
      for (let i = 0; i < l1; i++) { nodes.push({ id, x: 80 + sp * (i + 1), y: 130, label: `S${i}` }); links.push({ from: 0, to: id }); l1Ids.push(id); id++; }
      const rem = n - 1 - l1;
      for (let i = 0; i < rem; i++) {
        const p = l1Ids[i % l1]; const pn = nodes[p]; const ci = Math.floor(i / l1);
        nodes.push({ id, x: pn.x - 40 + ci * 50, y: 240 + (ci % 2) * 30, label: `L${i}` }); links.push({ from: p, to: id }); id++;
      }
      break;
    }
    case "hybrid": {
      const cc = Math.min(3, n);
      for (let i = 0; i < cc; i++) { const a = (2 * Math.PI * i) / cc - Math.PI / 2; nodes.push({ id: i, x: cx + 60 * Math.cos(a), y: cy + 50 * Math.sin(a), label: `C${i}` }); }
      for (let i = 0; i < cc; i++) for (let j = i + 1; j < cc; j++) links.push({ from: i, to: j });
      let lid = cc; const lpc = Math.ceil((n - cc) / cc);
      for (let c = 0; c < cc && lid < n; c++) for (let l = 0; l < lpc && lid < n; l++) {
        const a = (2 * Math.PI * c) / cc + (l - lpc / 2) * 0.5 - Math.PI / 2; const d = 120 + l * 15;
        nodes.push({ id: lid, x: cx + d * Math.cos(a), y: cy + d * Math.sin(a), label: `N${lid}` }); links.push({ from: c, to: lid }); lid++;
      }
      break;
    }
  }
  return { nodes, links };
};

// ─── Simulation Engine ──────────────────────────────────────────────────
const runSimulation = (cfg: SimConfig, failedLinks: number[] = []): SimResult => {
  const { topology, nodeCount, bandwidth, propDelay, packetSize, trafficRate, protocol, snrDb, bufferSize, modulation, wirelessModel, distance, frequency } = cfg;
  const graph = generateTopology(topology, nodeCount);
  const activeLinks = graph.links.filter((_, i) => !failedLinks.includes(i));

  const bps = modBitsPerSymbol[modulation];
  const plDb = pathLoss(wirelessModel, distance, frequency);
  const effectiveSnr = Math.max(0, snrDb - plDb);

  const ber = berForModulation(effectiveSnr, modulation);
  const packetBits = packetSize * 8;
  const per = packetErrorRate(ber, packetBits);

  // Average hops (adjusted for failures)
  const baseHops = (() => { switch (topology) { case "bus": return (nodeCount - 1) / 2; case "ring": return nodeCount / 4; case "star": return 2; case "mesh": return 1; case "tree": return Math.ceil(Math.log2(nodeCount)) * 2; case "hybrid": return 2.5; } })();
  const failurePenalty = failedLinks.length > 0 ? 1 + failedLinks.length * 0.5 : 1;
  const avgHops = baseHops * failurePenalty;

  const txDelay = (packetBits / (bandwidth * 1e6 * bps)) * 1000;
  const totalPropDelay = propDelay * avgHops;
  const baseDelay = txDelay * avgHops + totalPropDelay;

  const linkCapacity = (bandwidth * 1e6 * bps) / packetBits;
  const effectiveLinks = Math.max(1, (() => { switch (topology) { case "bus": return 1; case "ring": return 1; case "star": return Math.max(1, nodeCount - 1); case "mesh": return activeLinks.length; case "tree": return Math.ceil(nodeCount / 3); case "hybrid": return Math.ceil(activeLinks.length * 0.7); } })());

  const aggregateCapacity = linkCapacity * effectiveLinks;
  const utilization = Math.min(trafficRate / aggregateCapacity, 1);
  const rho = Math.min(utilization, 0.99);
  const queueDelay = rho > 0.01 ? (txDelay * rho) / (1 - rho) : 0;

  // TCP sim
  const cwndHistory: number[] = [];
  let cwnd = 1, ssthresh = 64, retransmissions = 0;
  if (protocol === "TCP") {
    for (let t = 0; t < 100; t++) {
      const wl = 1 - Math.pow(1 - per, cwnd);
      const cl = utilization > 0.85 ? (utilization - 0.85) * 3 : 0;
      if (Math.random() < Math.min(1, wl + cl)) { ssthresh = Math.max(2, Math.floor(cwnd / 2)); cwnd = 1; retransmissions++; }
      else { if (cwnd < ssthresh) cwnd *= 2; else cwnd += 1; }
      cwnd = Math.min(cwnd, 128);
      cwndHistory.push(cwnd);
    }
  }

  const simSec = 10;
  const totalSent = Math.round(trafficRate * simSec);
  const overflowRate = utilization > 1 ? (utilization - 1) / utilization : (utilization > 0.9 ? (utilization - 0.9) * 0.5 : 0);
  const bufferDropped = Math.round(totalSent * overflowRate * (64 / Math.max(bufferSize, 1)));
  const berDropped = Math.round((totalSent - bufferDropped) * per);
  const totalDropped = bufferDropped + berDropped;
  const totalDelivered = Math.max(0, totalSent - totalDropped);
  const packetLoss = totalSent > 0 ? (totalDropped / totalSent) * 100 : 0;
  const throughput = (totalDelivered * packetBits) / (simSec * 1e6);
  const avgDelay = baseDelay + queueDelay;

  // Curves for multi-modulation
  const berCurve: { snr: number; ber: number }[] = [];
  const perCurve: { snr: number; per: number }[] = [];
  const tputCurve: { snr: number; tput: number }[] = [];
  for (let s = 0; s <= 30; s++) {
    const b = berForModulation(s, modulation);
    const p = packetErrorRate(b, packetBits);
    berCurve.push({ snr: s, ber: b });
    perCurve.push({ snr: s, per: p });
    const deliveryRate = 1 - p;
    tputCurve.push({ snr: s, tput: bandwidth * bps * deliveryRate });
  }

  const shannonCap = bandwidth * Math.log2(1 + Math.pow(10, effectiveSnr / 10));
  const spectralEff = bps * (1 - per);

  const faultTolerance = (() => { switch (topology) { case "bus": return "LOW — backbone SPOF"; case "ring": return "LOW — single break fatal"; case "star": return "MEDIUM — hub-only SPOF"; case "mesh": return "HIGH — full redundancy"; case "tree": return "MEDIUM — subtree isolation"; case "hybrid": return "HIGH — layered resilience"; } })();
  const spof = (() => { switch (topology) { case "bus": return "Backbone cable"; case "ring": return "Any link/node"; case "star": return "Central hub"; case "mesh": return "None (full mesh)"; case "tree": return "Root & intermediates"; case "hybrid": return "Edge hub only"; } })();
  const scalability = (() => { switch (topology) { case "bus": return "POOR — shared medium O(n)"; case "ring": return "POOR — latency grows O(n)"; case "star": return "GOOD — add ports"; case "mesh": return "POOR — O(n²) links"; case "tree": return "GOOD — hierarchical"; case "hybrid": return "EXCELLENT — modular"; } })();

  return {
    topology, modulation, throughput, avgDelay, packetLoss, retransmissions,
    totalSent, totalDelivered, totalDropped, berDropped, bufferDropped,
    cwndHistory, berCurve, perCurve, tputCurve,
    hopCount: Math.round(avgHops * 10) / 10, ber, per,
    effectiveSnr: Math.round(effectiveSnr * 10) / 10,
    shannonCapacity: Math.round(shannonCap * 10) / 10,
    spectralEfficiency: Math.round(spectralEff * 100) / 100,
    faultTolerance, spof, scalability, pathLossDb: Math.round(plDb * 10) / 10,
    congestionFactor: Math.round(utilization * 100),
  };
};

// ─── Component ──────────────────────────────────────────────────────────
const TopologySimLab = () => {
  const [config, setConfig] = useState<SimConfig>({
    topology: "star", nodeCount: 8, bandwidth: 100, propDelay: 5,
    packetSize: 1024, trafficRate: 500, protocol: "TCP", snrDb: 15,
    bufferSize: 64, modulation: "BPSK", wirelessModel: "none", distance: 100, frequency: 2.4,
  });
  const [viewTab, setViewTab] = useState<ViewTab>("simulate");
  const [result, setResult] = useState<SimResult | null>(null);
  const [compareResults, setCompareResults] = useState<SimResult[]>([]);
  const [scalingData, setScalingData] = useState<{ n: number; tput: number; delay: number; loss: number }[]>([]);
  const [failedLinks, setFailedLinks] = useState<number[]>([]);
  const [failureResult, setFailureResult] = useState<{ before: SimResult; after: SimResult } | null>(null);
  const [animPackets, setAnimPackets] = useState<{ linkIdx: number; progress: number }[]>([]);
  const animRef = useRef<number | null>(null);

  const upd = useCallback(<K extends keyof SimConfig>(key: K, val: SimConfig[K]) => setConfig(c => ({ ...c, [key]: val })), []);
  const topoGraph = useMemo(() => generateTopology(config.topology, config.nodeCount), [config.topology, config.nodeCount]);
  const info = topoInfo[config.topology];

  const animatePackets = useCallback(() => {
    const pkts = topoGraph.links.slice(0, 10).map((_, i) => ({ linkIdx: i, progress: Math.random() }));
    setAnimPackets(pkts);
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let f = 0;
    const go = () => { f++; setAnimPackets(p => p.map(pk => ({ ...pk, progress: (pk.progress + 0.02) % 1 }))); if (f < 120) animRef.current = requestAnimationFrame(go); else setAnimPackets([]); };
    animRef.current = requestAnimationFrame(go);
  }, [topoGraph]);

  const runSim = useCallback(() => {
    setResult(runSimulation(config));
    setViewTab("simulate");
    animatePackets();
  }, [config, animatePackets]);

  const runCompare = useCallback(() => {
    const topos: Topology[] = ["bus", "ring", "star", "mesh", "tree", "hybrid"];
    setCompareResults(topos.map(t => runSimulation({ ...config, topology: t })));
    setViewTab("compare");
  }, [config]);

  const runScaling = useCallback(() => {
    const data: typeof scalingData = [];
    for (let n = 3; n <= 30; n += 1) {
      const r = runSimulation({ ...config, nodeCount: n });
      data.push({ n, tput: r.throughput, delay: r.avgDelay, loss: r.packetLoss });
    }
    setScalingData(data);
    setViewTab("scaling");
  }, [config]);

  const toggleLinkFailure = useCallback((idx: number) => {
    setFailedLinks(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }, []);

  const runFailureSim = useCallback(() => {
    const before = runSimulation(config, []);
    const after = runSimulation(config, failedLinks);
    setFailureResult({ before, after });
    setViewTab("failure");
  }, [config, failedLinks]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const svgW = 560, svgH = 360;

  // Cross-layer chain data
  const crossLayerChain = useMemo(() => {
    if (!result) return null;
    const snrEff = result.effectiveSnr;
    const modLabel = result.modulation;
    return [
      { layer: "Wireless Channel", metric: `Path Loss: ${result.pathLossDb}dB`, detail: config.wirelessModel === "none" ? "Wired link — no path loss" : `${config.wirelessModel} model @ ${config.distance}m, ${config.frequency}GHz`, color: "chart-4", severity: result.pathLossDb > 20 ? "high" : result.pathLossDb > 5 ? "med" : "low" },
      { layer: "Physical (L1)", metric: `SNR: ${snrEff}dB → BER: ${result.ber.toExponential(2)}`, detail: `${modLabel} modulation. Shannon limit: ${result.shannonCapacity} Mbps. Spectral eff: ${result.spectralEfficiency} bps/Hz`, color: "chart-2", severity: result.ber > 1e-4 ? "high" : result.ber > 1e-8 ? "med" : "low" },
      { layer: "Data Link (L2)", metric: `PER: ${(result.per * 100).toFixed(3)}% → Frame drops: ${result.berDropped}`, detail: `${config.packetSize}B frames × ${result.ber.toExponential(1)} BER = ${(result.per * 100).toFixed(3)}% frame error rate`, color: "chart-3", severity: result.per > 0.01 ? "high" : result.per > 0.001 ? "med" : "low" },
      { layer: "Network (L3)", metric: `Avg hops: ${result.hopCount} | Topology: ${info.name}`, detail: `${info.name}: ${result.faultTolerance.split("—")[0]}fault tolerance, ${result.scalability.split("—")[0]}scalability`, color: "primary", severity: result.hopCount > 3 ? "high" : result.hopCount > 1.5 ? "med" : "low" },
      { layer: "Transport (L4)", metric: config.protocol === "TCP" ? `Retx: ${result.retransmissions} | cwnd collapses due to BER+congestion` : `UDP: No retransmission — ${result.totalDropped} packets lost permanently`, detail: config.protocol === "TCP" ? `Noise-induced losses misinterpreted as congestion → cwnd reset → throughput degradation (TCP blind spot)` : `Best-effort delivery. Loss rate = ${result.packetLoss.toFixed(1)}%. Good for real-time, bad for reliability.`, color: "destructive", severity: result.retransmissions > 10 || result.packetLoss > 10 ? "high" : result.retransmissions > 3 ? "med" : "low" },
      { layer: "Application", metric: `Goodput: ${result.throughput.toFixed(2)} Mbps (${(result.throughput / config.bandwidth * 100).toFixed(0)}% efficiency)`, detail: `Buffer util: ${result.congestionFactor}% | End-to-end delay: ${result.avgDelay.toFixed(2)}ms | Delivered: ${result.totalDelivered}/${result.totalSent}`, color: "chart-4", severity: result.throughput < config.bandwidth * 0.3 ? "high" : result.throughput < config.bandwidth * 0.7 ? "med" : "low" },
    ];
  }, [result, config, info]);

  // GATE analysis
  const gateAnalysis = useMemo(() => {
    if (!result) return [];
    const lines: { title: string; content: string; formula?: string; trap?: string }[] = [];

    lines.push({
      title: "BER-Throughput Chain",
      content: `At SNR=${result.effectiveSnr}dB with ${result.modulation}, BER=${result.ber.toExponential(2)}. Over ${config.packetSize * 8} bits/packet → PER=${(result.per * 100).toFixed(3)}%. This caused ${result.berDropped} BER drops out of ${result.totalSent} packets.`,
      formula: `PER = 1 - (1 - BER)^n, where n = ${config.packetSize * 8} bits`,
      trap: "Students often confuse BER with PER. A BER of 10⁻⁶ over 8000 bits gives PER ≈ 0.8% — not negligible!",
    });

    if (config.protocol === "TCP") {
      lines.push({
        title: "TCP Misinterpretation of Noise",
        content: `TCP detected ${result.retransmissions} losses and treated them as congestion signals. But ${result.berDropped > result.bufferDropped ? "most losses were BER-induced, not congestion" : "buffer overflow was the primary cause"}. This is the classic wireless TCP problem.`,
        formula: `Throughput ≈ MSS / (RTT × √p), where p = loss probability`,
        trap: "GATE trap: TCP cannot distinguish noise-loss from congestion-loss. This is why wireless networks use link-layer ARQ (e.g., 802.11 retransmission) before TCP sees the loss.",
      });
    }

    lines.push({
      title: `${info.name} Topology Impact`,
      content: `${info.name} has avg ${result.hopCount} hops. Each hop adds ${config.propDelay}ms propagation + ${((config.packetSize * 8) / (config.bandwidth * 1e6) * 1000).toFixed(3)}ms transmission delay. Per-hop BER compounds: effective PER per path ≈ 1-(1-PER)^${Math.ceil(result.hopCount)}.`,
      formula: `End-to-end delay = Σ(t_prop + t_tx + t_queue) per hop`,
      trap: `In ${config.topology}, ${info.gateRelevance}`,
    });

    if (config.wirelessModel !== "none") {
      lines.push({
        title: "Wireless Path Loss",
        content: `${config.wirelessModel} model: ${result.pathLossDb}dB loss at ${config.distance}m, ${config.frequency}GHz. Effective SNR reduced from ${config.snrDb}dB to ${result.effectiveSnr}dB.`,
        formula: config.wirelessModel === "freespace" ? `PL(dB) = 20log₁₀(d) + 20log₁₀(f) - 27.55` : `Okumura-Hata / IEEE 802.11 indoor model`,
        trap: "Every 6dB SNR reduction roughly doubles BER for BPSK. Distance doubling = 6dB loss in free space (inverse square law).",
      });
    }

    lines.push({
      title: "Shannon Capacity Check",
      content: `Shannon limit: C = B × log₂(1 + SNR) = ${result.shannonCapacity} Mbps. Actual throughput: ${result.throughput.toFixed(2)} Mbps (${(result.throughput / result.shannonCapacity * 100).toFixed(0)}% of theoretical). ${result.modulation} spectral efficiency: ${result.spectralEfficiency} bps/Hz vs theoretical ${Math.log2(1 + Math.pow(10, result.effectiveSnr / 10)).toFixed(2)} bps/Hz.`,
      formula: `C = B × log₂(1 + SNR_linear)`,
      trap: "Shannon capacity is a theoretical upper bound. Real modulation schemes always achieve less. 64-QAM needs ~26dB SNR for BER<10⁻⁶ but gives 6 bps/Hz.",
    });

    return lines;
  }, [result, config, info]);

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ["simulate", "🔬 Simulate"], ["compare", "📊 Compare All"], ["scaling", "📈 Scaling"], ["failure", "⚡ Link Failure"], ["crosslayer", "🧠 Cross-Layer"],
        ] as [ViewTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setViewTab(id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              viewTab === id ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>{label}</button>
        ))}
      </div>

      {/* Topology selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(topoInfo) as Topology[]).map(t => (
          <button key={t} onClick={() => upd("topology", t)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              config.topology === t ? "bg-chart-4/15 border-chart-4/40 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"
            )}>{topoInfo[t].icon} {topoInfo[t].name}</button>
        ))}
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <Ctrl label="Nodes" value={config.nodeCount} min={3} max={20} step={1} color="primary" onChange={v => upd("nodeCount", v)} />
        <Ctrl label="BW (Mbps)" value={config.bandwidth} min={1} max={1000} step={10} color="chart-2" onChange={v => upd("bandwidth", v)} />
        <Ctrl label="Prop Delay (ms)" value={config.propDelay} min={0.1} max={50} step={0.5} color="chart-3" onChange={v => upd("propDelay", v)} />
        <Ctrl label="Pkt Size (B)" value={config.packetSize} min={64} max={9000} step={64} color="chart-4" onChange={v => upd("packetSize", v)} />
        <Ctrl label="Traffic (pkt/s)" value={config.trafficRate} min={10} max={5000} step={50} color="primary" onChange={v => upd("trafficRate", v)} />
        <Ctrl label="SNR (dB)" value={config.snrDb} min={0} max={30} step={1} color="chart-2" onChange={v => upd("snrDb", v)} />
        <Ctrl label="Buffer (pkts)" value={config.bufferSize} min={4} max={256} step={4} color="chart-3" onChange={v => upd("bufferSize", v)} />

        {/* Modulation */}
        <div className="p-2.5 rounded-xl bg-card border border-border space-y-1">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Modulation</label>
          <div className="flex gap-0.5 flex-wrap">
            {(["BPSK", "QPSK", "16QAM", "64QAM"] as Modulation[]).map(m => (
              <button key={m} onClick={() => upd("modulation", m)}
                className={cn("px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all",
                  config.modulation === m ? "bg-chart-2/15 border-chart-2/40 text-chart-2" : "border-border text-muted-foreground"
                )}>{m}</button>
            ))}
          </div>
        </div>

        {/* Protocol */}
        <div className="p-2.5 rounded-xl bg-card border border-border space-y-1">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Protocol</label>
          <div className="flex gap-1">
            {(["TCP", "UDP"] as const).map(p => (
              <button key={p} onClick={() => upd("protocol", p)}
                className={cn("px-3 py-0.5 rounded text-[9px] font-mono border transition-all flex-1",
                  config.protocol === p ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground"
                )}>{p}</button>
            ))}
          </div>
        </div>

        {/* Wireless */}
        <div className="p-2.5 rounded-xl bg-card border border-border space-y-1">
          <label className="text-[8px] text-muted-foreground font-mono uppercase">Wireless Model</label>
          <div className="flex gap-0.5 flex-wrap">
            {(["none", "freespace", "urban", "indoor"] as WirelessModel[]).map(w => (
              <button key={w} onClick={() => upd("wirelessModel", w)}
                className={cn("px-1.5 py-0.5 rounded text-[7px] font-mono border transition-all",
                  config.wirelessModel === w ? "bg-chart-3/15 border-chart-3/40 text-chart-3" : "border-border text-muted-foreground"
                )}>{w === "none" ? "Wired" : w}</button>
            ))}
          </div>
        </div>

        {config.wirelessModel !== "none" && (
          <>
            <Ctrl label="Distance (m)" value={config.distance} min={1} max={1000} step={10} color="chart-4" onChange={v => upd("distance", v)} />
            <Ctrl label="Freq (GHz)" value={config.frequency} min={0.9} max={60} step={0.1} color="destructive" onChange={v => upd("frequency", v)} />
          </>
        )}

        {/* Actions */}
        <div className="p-2.5 rounded-xl bg-card border border-border flex flex-col gap-1 justify-center">
          <button onClick={runSim} className="px-3 py-1.5 rounded-lg text-xs font-mono bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90 transition-all justify-center">
            <Play size={12} /> Simulate
          </button>
          <div className="flex gap-1">
            <button onClick={runCompare} className="px-2 py-1 rounded text-[8px] font-mono border border-chart-3/40 text-chart-3 hover:bg-chart-3/10 flex-1">
              <BarChart3 size={10} className="inline mr-0.5" />Compare
            </button>
            <button onClick={runScaling} className="px-2 py-1 rounded text-[8px] font-mono border border-chart-4/40 text-chart-4 hover:bg-chart-4/10 flex-1">
              <TrendingUp size={10} className="inline mr-0.5" />Scale
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ SIMULATE TAB ═══════ */}
      {viewTab === "simulate" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Topology SVG */}
            <div className="p-4 rounded-xl bg-card border border-border oscilloscope-border">
              <div className="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wider">
                {info.name} — {config.nodeCount} nodes, {topoGraph.links.length} links
                {config.wirelessModel !== "none" && ` | 📡 ${config.wirelessModel} @ ${config.distance}m`}
              </div>
              <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="bg-muted/10 rounded-lg">
                {topoGraph.links.map((link, i) => {
                  const from = topoGraph.nodes[link.from], to = topoGraph.nodes[link.to];
                  if (!from || !to) return null;
                  const isFailed = failedLinks.includes(i);
                  const hasPacket = animPackets.some(p => p.linkIdx === i);
                  return (
                    <g key={`l${i}`} onClick={() => toggleLinkFailure(i)} className="cursor-pointer">
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={isFailed ? "hsl(var(--destructive))" : hasPacket ? "hsl(var(--chart-3))" : "hsl(var(--muted-foreground))"}
                        strokeWidth={isFailed ? 3 : hasPacket ? 2.5 : 1.2} opacity={isFailed ? 0.8 : hasPacket ? 1 : 0.35}
                        strokeDasharray={isFailed ? "6 4" : hasPacket ? "0" : "4 4"} />
                      {isFailed && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--destructive))">✗</text>}
                      {animPackets.filter(p => p.linkIdx === i && !isFailed).map((pkt, pi) => (
                        <circle key={pi} cx={from.x + (to.x - from.x) * pkt.progress} cy={from.y + (to.y - from.y) * pkt.progress}
                          r="4" fill="hsl(var(--chart-3))" className="animate-pulse" />
                      ))}
                    </g>
                  );
                })}
                {topoGraph.nodes.map(node => (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r="16" fill="hsl(var(--muted) / 0.7)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">{node.label}</text>
                  </g>
                ))}
              </svg>
              {failedLinks.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] font-mono text-destructive">⚡ {failedLinks.length} link(s) disabled — click links to toggle</span>
                  <button onClick={() => { setFailedLinks([]); }} className="text-[8px] font-mono text-muted-foreground underline">Clear</button>
                  <button onClick={runFailureSim} className="px-2 py-0.5 rounded text-[8px] font-mono bg-destructive/10 border border-destructive/30 text-destructive">
                    <Zap size={10} className="inline mr-0.5" />Run Failure Sim
                  </button>
                </div>
              )}
            </div>

            {/* Info + PHY panel */}
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-primary/20 space-y-2">
                <div className="text-sm font-mono font-bold text-primary">{info.icon} {info.name} Topology</div>
                <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">{info.desc}</div>
                <div className="space-y-1 text-[10px] font-mono">
                  <div><span className="text-chart-2 font-bold">Data Flow:</span> <span className="text-muted-foreground">{info.dataFlow}</span></div>
                  <div><span className="text-destructive font-bold">Failure:</span> <span className="text-muted-foreground">{info.failure}</span></div>
                  <div><span className="text-chart-4 font-bold">Use Cases:</span> <span className="text-muted-foreground">{info.useCases}</span></div>
                  <div><span className="text-primary font-bold">GATE:</span> <span className="text-muted-foreground">{info.gateRelevance}</span></div>
                </div>
              </div>

              {/* PHY metrics */}
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[9px] font-mono text-muted-foreground uppercase mb-1.5">
                  PHY LAYER — {config.modulation} @ {result ? result.effectiveSnr : config.snrDb}dB effective SNR
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: "BER", v: berForModulation(config.snrDb - pathLoss(config.wirelessModel, config.distance, config.frequency), config.modulation).toExponential(2), c: "text-chart-2" },
                    { l: "PER", v: `${(packetErrorRate(berForModulation(config.snrDb - pathLoss(config.wirelessModel, config.distance, config.frequency), config.modulation), config.packetSize * 8) * 100).toFixed(3)}%`, c: "text-chart-3" },
                    { l: "Shannon", v: `${(config.bandwidth * Math.log2(1 + Math.pow(10, Math.max(0, config.snrDb - pathLoss(config.wirelessModel, config.distance, config.frequency)) / 10))).toFixed(1)} Mbps`, c: "text-chart-4" },
                    { l: "Spectral Eff", v: `${modBitsPerSymbol[config.modulation]} bps/Hz`, c: "text-primary" },
                    { l: "Path Loss", v: config.wirelessModel !== "none" ? `${pathLoss(config.wirelessModel, config.distance, config.frequency).toFixed(1)} dB` : "N/A (wired)", c: "text-destructive" },
                    { l: "Bits/Symbol", v: `${modBitsPerSymbol[config.modulation]}`, c: "text-chart-2" },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="p-1.5 rounded-lg border border-border text-center">
                      <div className={cn("text-[10px] font-mono font-bold", c)}>{v}</div>
                      <div className="text-[7px] text-muted-foreground font-mono">{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modulation BER comparison */}
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[9px] font-mono text-muted-foreground uppercase mb-1">BER BY MODULATION @ SNR={config.snrDb}dB</div>
                {(["BPSK", "QPSK", "16QAM", "64QAM"] as Modulation[]).map(m => {
                  const b = berForModulation(config.snrDb, m);
                  const logB = -Math.log10(Math.max(b, 1e-15));
                  return (
                    <div key={m} className="flex items-center gap-2 py-0.5">
                      <span className={cn("text-[9px] font-mono w-12", config.modulation === m ? "text-primary font-bold" : "text-muted-foreground")}>{m}</span>
                      <div className="flex-1 h-3 rounded-full bg-muted/30 border border-border overflow-hidden">
                        <div className={cn("h-full rounded-full", config.modulation === m ? "bg-primary/50" : "bg-chart-2/30")}
                          style={{ width: `${Math.min(logB / 15 * 100, 100)}%` }} />
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground w-16 text-right">{b.toExponential(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <Stat label="Throughput" value={`${result.throughput.toFixed(2)} Mbps`} color="text-primary" />
                <Stat label="Delay" value={`${result.avgDelay.toFixed(2)} ms`} color="text-chart-2" />
                <Stat label="Pkt Loss" value={`${result.packetLoss.toFixed(2)}%`} color={result.packetLoss > 5 ? "text-destructive" : "text-chart-3"} />
                <Stat label="Retx" value={`${result.retransmissions}`} color="text-chart-4" />
                <Stat label="Hops" value={`${result.hopCount}`} color="text-primary" />
                <Stat label="Eff SNR" value={`${result.effectiveSnr} dB`} color="text-chart-2" />
                <Stat label="Congestion" value={`${result.congestionFactor}%`} color={result.congestionFactor > 85 ? "text-destructive" : "text-chart-3"} />
                <Stat label="Delivered" value={`${result.totalDelivered}/${result.totalSent}`} color="text-chart-4" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {config.protocol === "TCP" && <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">TCP cwnd vs RTT</div>
                  <LineGraph data={result.cwndHistory.map((v, i) => ({ x: i, y: v }))} xLabel="RTT" yLabel="cwnd" color="primary" />
                </div>}

                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">BER vs SNR ({result.modulation})</div>
                  <LogGraph data={result.berCurve.map(d => ({ x: d.snr, y: d.ber }))} xLabel="SNR (dB)" yLabel="BER" color="chart-2" marker={config.snrDb} />
                </div>

                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">Throughput vs SNR</div>
                  <LineGraph data={result.tputCurve.map(d => ({ x: d.snr, y: d.tput }))} xLabel="SNR (dB)" yLabel="Mbps" color="chart-3" />
                </div>
              </div>

              {/* Drop breakdown */}
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">BER → FRAME ERROR → PACKET DROP → THROUGHPUT CHAIN</div>
                <div className="flex items-center gap-1 text-[9px] font-mono flex-wrap">
                  <ChainBlock label="BER" value={result.ber.toExponential(1)} color="chart-2" />
                  <span className="text-muted-foreground">→</span>
                  <ChainBlock label="PER" value={`${(result.per * 100).toFixed(2)}%`} color="chart-3" />
                  <span className="text-muted-foreground">→</span>
                  <ChainBlock label="BER Drops" value={`${result.berDropped}`} color="chart-4" />
                  <span className="text-muted-foreground">+</span>
                  <ChainBlock label="Buffer Drops" value={`${result.bufferDropped}`} color="destructive" />
                  <span className="text-muted-foreground">→</span>
                  <ChainBlock label="Total Loss" value={`${result.packetLoss.toFixed(1)}%`} color="destructive" />
                  <span className="text-muted-foreground">→</span>
                  <ChainBlock label="Goodput" value={`${result.throughput.toFixed(1)} Mbps`} color="primary" />
                </div>
                <div className="flex h-5 rounded-full overflow-hidden border border-border mt-3">
                  <div className="bg-primary/50 transition-all" style={{ width: `${(result.totalDelivered / Math.max(result.totalSent, 1)) * 100}%` }} />
                  <div className="bg-chart-4/50 transition-all" style={{ width: `${(result.berDropped / Math.max(result.totalSent, 1)) * 100}%` }} />
                  <div className="bg-destructive/50 transition-all" style={{ width: `${(result.bufferDropped / Math.max(result.totalSent, 1)) * 100}%` }} />
                </div>
                <div className="flex gap-4 mt-1 text-[8px] font-mono text-muted-foreground">
                  <span className="text-primary">✓ Delivered: {result.totalDelivered}</span>
                  <span className="text-chart-4">✗ BER: {result.berDropped}</span>
                  <span className="text-destructive">✗ Buffer: {result.bufferDropped}</span>
                </div>
              </div>

              {/* Topology resilience */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[
                  { label: "Fault Tolerance", value: result.faultTolerance, color: result.faultTolerance.startsWith("HIGH") ? "text-chart-3" : result.faultTolerance.startsWith("MEDIUM") ? "text-chart-4" : "text-destructive" },
                  { label: "SPOF", value: result.spof, color: "text-destructive" },
                  { label: "Scalability", value: result.scalability, color: result.scalability.startsWith("EXCELLENT") || result.scalability.startsWith("GOOD") ? "text-chart-3" : "text-destructive" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-xl bg-card border border-border">
                    <div className="text-[8px] text-muted-foreground font-mono uppercase">{label}</div>
                    <div className={cn("text-[10px] font-mono font-bold mt-1", color)}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════ COMPARE TAB ═══════ */}
      {viewTab === "compare" && compareResults.length > 0 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">ALL-TOPOLOGY COMPARISON — {config.modulation} | {config.protocol} | SNR={config.snrDb}dB</div>
            <table className="w-full text-[10px] font-mono">
              <thead><tr className="border-b border-border">
                <th className="text-left py-1.5 text-muted-foreground">Metric</th>
                {compareResults.map(r => <th key={r.topology} className="text-center py-1.5 text-chart-4">{topoInfo[r.topology].name}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { label: "Throughput (Mbps)", key: "throughput" as const, fmt: (v: number) => v.toFixed(2), best: "max" as const },
                  { label: "Avg Delay (ms)", key: "avgDelay" as const, fmt: (v: number) => v.toFixed(2), best: "min" as const },
                  { label: "Packet Loss (%)", key: "packetLoss" as const, fmt: (v: number) => v.toFixed(2), best: "min" as const },
                  { label: "Retransmissions", key: "retransmissions" as const, fmt: (v: number) => `${v}`, best: "min" as const },
                  { label: "Avg Hops", key: "hopCount" as const, fmt: (v: number) => `${v}`, best: "min" as const },
                  { label: "BER Drops", key: "berDropped" as const, fmt: (v: number) => `${v}`, best: "min" as const },
                  { label: "Buffer Drops", key: "bufferDropped" as const, fmt: (v: number) => `${v}`, best: "min" as const },
                  { label: "Congestion %", key: "congestionFactor" as const, fmt: (v: number) => `${v}%`, best: "min" as const },
                ].map(metric => {
                  const values = compareResults.map(r => r[metric.key] as number);
                  const bestVal = metric.best === "max" ? Math.max(...values) : Math.min(...values);
                  return (
                    <tr key={metric.key} className="border-b border-border/30">
                      <td className="py-1 text-muted-foreground">{metric.label}</td>
                      {compareResults.map(r => {
                        const v = r[metric.key] as number;
                        return <td key={r.topology} className={cn("text-center py-1", v === bestVal ? "text-chart-3 font-bold" : "text-foreground")}>
                          {v === bestVal ? "★ " : ""}{metric.fmt(v)}
                        </td>;
                      })}
                    </tr>
                  );
                })}
                <tr className="border-b border-border/30">
                  <td className="py-1 text-muted-foreground">Fault Tolerance</td>
                  {compareResults.map(r => <td key={r.topology} className={cn("text-center py-1 text-[9px]", r.faultTolerance.startsWith("HIGH") ? "text-chart-3" : r.faultTolerance.startsWith("MEDIUM") ? "text-chart-4" : "text-destructive")}>{r.faultTolerance.split("—")[0]}</td>)}
                </tr>
                <tr>
                  <td className="py-1 text-muted-foreground">Scalability</td>
                  {compareResults.map(r => <td key={r.topology} className={cn("text-center py-1 text-[9px]", r.scalability.startsWith("EXCELLENT") || r.scalability.startsWith("GOOD") ? "text-chart-3" : "text-destructive")}>{r.scalability.split("—")[0]}</td>)}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bar charts */}
          {["throughput", "avgDelay", "packetLoss"].map(metric => {
            const label = metric === "throughput" ? "THROUGHPUT (higher=better)" : metric === "avgDelay" ? "DELAY (lower=better)" : "PACKET LOSS (lower=better)";
            const vals = compareResults.map(r => (r as any)[metric] as number);
            const maxV = Math.max(...vals, 0.01);
            return (
              <div key={metric} className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">{label}</div>
                <div className="space-y-1">
                  {compareResults.map((r, i) => (
                    <div key={r.topology} className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground w-12">{topoInfo[r.topology].name}</span>
                      <div className="flex-1 h-4 rounded-full bg-muted/30 border border-border overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", vals[i] === (metric === "throughput" ? Math.max(...vals) : Math.min(...vals)) ? "bg-chart-3/60" : "bg-primary/30")}
                          style={{ width: `${(vals[i] / maxV) * 100}%` }} />
                      </div>
                      <span className={cn("text-[10px] font-mono w-24 text-right", vals[i] === (metric === "throughput" ? Math.max(...vals) : Math.min(...vals)) ? "text-chart-3 font-bold" : "text-muted-foreground")}>
                        {metric === "packetLoss" ? `${vals[i].toFixed(2)}%` : metric === "avgDelay" ? `${vals[i].toFixed(2)}ms` : `${vals[i].toFixed(2)} Mbps`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ SCALING TAB ═══════ */}
      {viewTab === "scaling" && scalingData.length > 0 && (
        <div className="space-y-4">
          <div className="p-2 rounded-lg bg-chart-4/5 border border-chart-4/20 text-xs font-mono text-chart-4">
            📈 Network Scaling: {info.name} topology, 3→30 nodes | {config.modulation} | {config.protocol} | SNR={config.snrDb}dB
          </div>
          {[
            { label: "THROUGHPUT vs NODE COUNT", data: scalingData.map(d => ({ x: d.n, y: d.tput })), yLabel: "Mbps", color: "primary" as const },
            { label: "DELAY vs NODE COUNT", data: scalingData.map(d => ({ x: d.n, y: d.delay })), yLabel: "ms", color: "chart-2" as const },
            { label: "PACKET LOSS vs NODE COUNT", data: scalingData.map(d => ({ x: d.n, y: d.loss })), yLabel: "%", color: "destructive" as const },
          ].map(({ label, data, yLabel, color }) => (
            <div key={label} className="p-4 rounded-xl bg-card border border-border">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase">{label}</div>
              <LineGraph data={data} xLabel="Nodes" yLabel={yLabel} color={color} />
            </div>
          ))}
          <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
            <div className="text-primary font-bold text-xs">📊 Scaling Analysis</div>
            <div>• <span className="text-primary">{info.name}:</span> {info.name === "Mesh" ? "Links grow O(n²) — throughput initially high but congestion increases rapidly with nodes" : info.name === "Bus" || info.name === "Ring" ? "Shared medium — throughput degrades linearly, delay grows with node count" : info.name === "Star" ? "Good scaling — throughput stable until hub saturates" : "Hierarchical scaling — moderate delay growth, good aggregation"}</div>
            <div>• <span className="text-chart-2">Delay growth:</span> {scalingData[scalingData.length - 1].delay > scalingData[0].delay * 3 ? "Significant — delay tripled from 3 to 30 nodes" : "Moderate — topology handles scale reasonably"}</div>
            <div>• <span className="text-destructive">Loss trend:</span> {scalingData[scalingData.length - 1].loss > 10 ? "Concerning — consider adding capacity or changing topology" : "Acceptable at this traffic rate"}</div>
          </div>
        </div>
      )}

      {/* ═══════ FAILURE TAB ═══════ */}
      {viewTab === "failure" && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs font-mono text-destructive flex items-center gap-2">
            <AlertTriangle size={14} />
            Click links in the topology view to disable them, then run "Failure Sim" to see impact. {failedLinks.length} link(s) currently failed.
          </div>

          {/* Show topology for clicking */}
          <div className="p-4 rounded-xl bg-card border border-border oscilloscope-border">
            <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="bg-muted/10 rounded-lg">
              {topoGraph.links.map((link, i) => {
                const from = topoGraph.nodes[link.from], to = topoGraph.nodes[link.to];
                if (!from || !to) return null;
                const isFailed = failedLinks.includes(i);
                return (
                  <g key={`l${i}`} onClick={() => toggleLinkFailure(i)} className="cursor-pointer">
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={isFailed ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
                      strokeWidth={isFailed ? 3 : 1.5} opacity={isFailed ? 0.8 : 0.4}
                      strokeDasharray={isFailed ? "6 4" : "4 4"} />
                    {isFailed && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fontSize="12" fill="hsl(var(--destructive))">✗</text>}
                  </g>
                );
              })}
              {topoGraph.nodes.map(node => (
                <g key={node.id}>
                  <circle cx={node.x} cy={node.y} r="16" fill="hsl(var(--muted) / 0.7)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="1.5" />
                  <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="8" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">{node.label}</text>
                </g>
              ))}
            </svg>
            <div className="mt-2 flex gap-2">
              <button onClick={runFailureSim} className="px-4 py-1.5 rounded-lg text-xs font-mono bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20">
                <Zap size={12} className="inline mr-1" />Run Failure Analysis
              </button>
              <button onClick={() => setFailedLinks([])} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-border text-muted-foreground">
                <RotateCcw size={12} className="inline mr-1" />Clear Failures
              </button>
            </div>
          </div>

          {failureResult && (
            <div className="space-y-3">
              <div className="text-sm font-mono font-bold text-destructive">⚡ Failure Impact: {failedLinks.length} link(s) disabled</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Throughput", before: failureResult.before.throughput, after: failureResult.after.throughput, unit: "Mbps", better: "max" },
                  { label: "Delay", before: failureResult.before.avgDelay, after: failureResult.after.avgDelay, unit: "ms", better: "min" },
                  { label: "Pkt Loss", before: failureResult.before.packetLoss, after: failureResult.after.packetLoss, unit: "%", better: "min" },
                  { label: "Retx", before: failureResult.before.retransmissions, after: failureResult.after.retransmissions, unit: "", better: "min" },
                ].map(m => {
                  const delta = m.after - m.before;
                  const pct = m.before > 0 ? (delta / m.before * 100) : 0;
                  const worse = m.better === "max" ? delta < 0 : delta > 0;
                  return (
                    <div key={m.label} className="p-3 rounded-xl bg-card border border-border">
                      <div className="text-[8px] text-muted-foreground font-mono uppercase">{m.label}</div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-[10px] font-mono text-muted-foreground line-through">{m.before.toFixed(2)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className={cn("text-[11px] font-mono font-bold", worse ? "text-destructive" : "text-chart-3")}>{m.after.toFixed(2)} {m.unit}</span>
                      </div>
                      <div className={cn("text-[9px] font-mono mt-0.5", worse ? "text-destructive" : "text-chart-3")}>
                        {delta > 0 ? "+" : ""}{pct.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
                <div className="text-primary font-bold text-xs">🧠 Failure Analysis</div>
                <div>• <span className="text-destructive">{info.name} with {failedLinks.length} failed link(s):</span> {
                  config.topology === "mesh" ? "Full mesh has maximum redundancy — alternative paths absorb the load with minimal impact." :
                  config.topology === "star" ? "If the hub link fails, the node is completely isolated. Hub failure = total network loss." :
                  config.topology === "ring" ? "Single link failure breaks the ring — traffic must traverse the long way around (dual-ring) or fails entirely." :
                  config.topology === "bus" ? "Backbone failure partitions the network. Nodes on either side cannot communicate." :
                  config.topology === "tree" ? "Intermediate failure isolates entire subtree. Impact depends on failure location in hierarchy." :
                  "Hybrid core mesh absorbs core failures. Edge star segments are vulnerable to hub loss."
                }</div>
                <div>• <span className="text-chart-2">Route convergence:</span> {config.topology === "mesh" || config.topology === "hybrid" ? "Fast — OSPF/SPF reconverges in ~1-5s" : "Slow or impossible — topology lacks alternate paths"}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ CROSS-LAYER TAB ═══════ */}
      {viewTab === "crosslayer" && (
        <div className="space-y-4">
          {!result && <div className="p-4 rounded-xl bg-card border border-border text-center text-sm font-mono text-muted-foreground">Run a simulation first to see cross-layer analysis</div>}

          {result && crossLayerChain && (
            <>
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-primary">
                🧠 Cross-Layer Analysis: {info.name} | {config.modulation} | {config.protocol} | SNR={result.effectiveSnr}dB
              </div>

              {/* Layer chain */}
              <div className="space-y-2">
                {crossLayerChain.map((layer, i) => (
                  <div key={i} className={cn("p-3 rounded-xl bg-card border transition-all",
                    layer.severity === "high" ? "border-destructive/40" : layer.severity === "med" ? "border-chart-4/30" : "border-border"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-2 h-2 rounded-full", layer.severity === "high" ? "bg-destructive" : layer.severity === "med" ? "bg-chart-4" : "bg-chart-3")} />
                      <span className={cn("text-[10px] font-mono font-bold", `text-${layer.color}`)}>{layer.layer}</span>
                      {layer.severity === "high" && <span className="text-[8px] font-mono text-destructive bg-destructive/10 px-1.5 rounded">BOTTLENECK</span>}
                    </div>
                    <div className="text-[10px] font-mono text-foreground">{layer.metric}</div>
                    <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{layer.detail}</div>
                    {i < crossLayerChain.length - 1 && (
                      <div className="text-center text-muted-foreground/40 text-lg mt-1">↓</div>
                    )}
                  </div>
                ))}
              </div>

              {/* GATE Analysis */}
              <div className="space-y-3">
                <div className="text-sm font-mono font-bold text-primary">🎯 GATE / IES Analytical Breakdown</div>
                {gateAnalysis.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-card border border-primary/15 space-y-2">
                    <div className="text-xs font-mono font-bold text-primary">{item.title}</div>
                    <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">{item.content}</div>
                    {item.formula && (
                      <div className="p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="text-[8px] text-muted-foreground font-mono uppercase mb-0.5">Formula</div>
                        <div className="text-[10px] font-mono text-chart-2">{item.formula}</div>
                      </div>
                    )}
                    {item.trap && (
                      <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                        <div className="text-[8px] text-destructive font-mono uppercase mb-0.5">⚠ Exam Trap</div>
                        <div className="text-[10px] font-mono text-destructive/80">{item.trap}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Reusable sub-components ────────────────────────────────────────────
const Ctrl = ({ label, value, min, max, step, color, onChange }: { label: string; value: number; min: number; max: number; step: number; color: string; onChange: (v: number) => void }) => (
  <div className="p-2 rounded-xl bg-card border border-border space-y-0.5">
    <div className="flex justify-between">
      <label className="text-[7px] text-muted-foreground font-mono uppercase">{label}</label>
      <span className={cn("text-[9px] font-mono font-bold", `text-${color}`)}>{value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
      className={`w-full accent-[hsl(var(--${color}))]`} />
  </div>
);

const Stat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2 rounded-lg border border-border bg-card text-center">
    <div className={cn("text-[10px] font-mono font-bold", color)}>{value}</div>
    <div className="text-[7px] text-muted-foreground font-mono">{label}</div>
  </div>
);

const ChainBlock = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className={cn("px-2 py-1 rounded-lg border bg-card", `border-${color}/30`)}>
    <div className={cn("text-[9px] font-mono font-bold", `text-${color}`)}>{value}</div>
    <div className="text-[6px] text-muted-foreground font-mono">{label}</div>
  </div>
);

const LineGraph = ({ data, xLabel, yLabel, color }: { data: { x: number; y: number }[]; xLabel: string; yLabel: string; color: string }) => {
  if (!data.length) return null;
  const gW = 420, gH = 140;
  const minX = Math.min(...data.map(d => d.x)), maxX = Math.max(...data.map(d => d.x));
  const minY = Math.min(...data.map(d => d.y)), maxY = Math.max(...data.map(d => d.y));
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const toX = (x: number) => 40 + ((x - minX) / rangeX) * (gW - 50);
  const toY = (y: number) => gH - 20 - ((y - minY) / rangeY) * (gH - 35);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.x)} ${toY(d.y)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => { const y = toY(minY + rangeY * f); return <g key={f}><line x1="40" y1={y} x2={gW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" /><text x="36" y={y + 3} textAnchor="end" fontSize="6" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{(minY + rangeY * f).toFixed(1)}</text></g>; })}
      <path d={path} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="2" />
      <text x={gW / 2} y={gH - 2} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{xLabel}</text>
      <text x="6" y={gH / 2} textAnchor="middle" fontSize="7" fill={`hsl(var(--${color}))`} fontFamily="monospace" transform={`rotate(-90, 6, ${gH / 2})`}>{yLabel}</text>
    </svg>
  );
};

const LogGraph = ({ data, xLabel, yLabel, color, marker }: { data: { x: number; y: number }[]; xLabel: string; yLabel: string; color: string; marker?: number }) => {
  if (!data.length) return null;
  const gW = 420, gH = 140;
  const minLogY = -12, maxLogY = 0;
  const minX = Math.min(...data.map(d => d.x)), maxX = Math.max(...data.map(d => d.x));
  const rangeX = maxX - minX || 1;
  const toX = (x: number) => 40 + ((x - minX) / rangeX) * (gW - 50);
  const toY = (y: number) => { const ly = Math.log10(Math.max(y, 1e-15)); return gH - 20 - ((ly - minLogY) / (maxLogY - minLogY)) * (gH - 35); };
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.x)} ${toY(d.y)}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${gW} ${gH}`}>
      {[-1, -3, -6, -9, -12].map(exp => { const y = toY(Math.pow(10, exp)); return <g key={exp}><line x1="40" y1={y} x2={gW - 10} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" /><text x="36" y={y + 3} textAnchor="end" fontSize="5" fill="hsl(var(--muted-foreground))" fontFamily="monospace">10^{exp}</text></g>; })}
      <path d={path} fill="none" stroke={`hsl(var(--${color}))`} strokeWidth="2" />
      {marker !== undefined && (() => { const pt = data.find(d => d.x === marker); if (!pt) return null; return <circle cx={toX(marker)} cy={toY(pt.y)} r="4" fill="hsl(var(--destructive))" />; })()}
      <text x={gW / 2} y={gH - 2} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{xLabel}</text>
      <text x="6" y={gH / 2} textAnchor="middle" fontSize="7" fill={`hsl(var(--${color}))`} fontFamily="monospace" transform={`rotate(-90, 6, ${gH / 2})`}>{yLabel}</text>
    </svg>
  );
};

export default TopologySimLab;

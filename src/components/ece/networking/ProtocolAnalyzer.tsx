import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw } from "lucide-react";

type Protocol = "tcp" | "udp" | "arp" | "dhcp" | "dns";

interface Step {
  from: "client" | "server" | "broadcast";
  to: "client" | "server" | "broadcast";
  label: string;
  detail: string;
  flags?: string;
  color: string;
}

const protocols: Record<Protocol, { name: string; steps: Step[] }> = {
  tcp: {
    name: "TCP 3-Way Handshake + Data + Teardown",
    steps: [
      { from: "client", to: "server", label: "SYN", detail: "seq=100, SYN flag set. Client enters SYN_SENT state.", flags: "SYN", color: "primary" },
      { from: "server", to: "client", label: "SYN-ACK", detail: "seq=300, ack=101. Server enters SYN_RCVD state.", flags: "SYN,ACK", color: "chart-2" },
      { from: "client", to: "server", label: "ACK", detail: "seq=101, ack=301. Connection ESTABLISHED.", flags: "ACK", color: "chart-3" },
      { from: "client", to: "server", label: "DATA", detail: "seq=101, len=1460 bytes. HTTP GET /index.html", flags: "PSH,ACK", color: "primary" },
      { from: "server", to: "client", label: "ACK", detail: "ack=1561. Data received, window=65535", flags: "ACK", color: "chart-2" },
      { from: "server", to: "client", label: "DATA", detail: "seq=301, len=4380 bytes. HTTP 200 OK + HTML", flags: "PSH,ACK", color: "chart-2" },
      { from: "client", to: "server", label: "ACK", detail: "ack=4681. Acknowledged server data", flags: "ACK", color: "chart-3" },
      { from: "client", to: "server", label: "FIN", detail: "seq=1561. Client initiates close → FIN_WAIT_1", flags: "FIN,ACK", color: "destructive" },
      { from: "server", to: "client", label: "ACK", detail: "ack=1562. Server → CLOSE_WAIT, Client → FIN_WAIT_2", flags: "ACK", color: "chart-4" },
      { from: "server", to: "client", label: "FIN", detail: "seq=4681. Server initiates close → LAST_ACK", flags: "FIN,ACK", color: "destructive" },
      { from: "client", to: "server", label: "ACK", detail: "ack=4682. Client → TIME_WAIT (2MSL timer). Done.", flags: "ACK", color: "chart-3" },
    ],
  },
  udp: {
    name: "UDP Datagram Exchange (DNS query example)",
    steps: [
      { from: "client", to: "server", label: "UDP Query", detail: "Src port: 49152, Dst port: 53. DNS query for example.com", color: "primary" },
      { from: "server", to: "client", label: "UDP Response", detail: "Src port: 53, Dst port: 49152. A record: 93.184.216.34", color: "chart-2" },
    ],
  },
  arp: {
    name: "ARP Resolution",
    steps: [
      { from: "client", to: "broadcast", label: "ARP Request", detail: "Who has 192.168.1.1? Tell 192.168.1.10 (broadcast FF:FF:FF:FF:FF:FF)", color: "chart-3" },
      { from: "server", to: "client", label: "ARP Reply", detail: "192.168.1.1 is at AA:BB:CC:DD:EE:FF (unicast reply)", color: "chart-2" },
      { from: "client", to: "server", label: "Cache Update", detail: "ARP cache updated: 192.168.1.1 → AA:BB:CC:DD:EE:FF (timeout 300s)", color: "primary" },
    ],
  },
  dhcp: {
    name: "DHCP DORA Process",
    steps: [
      { from: "client", to: "broadcast", label: "DISCOVER", detail: "Broadcast: Client needs IP. MAC=11:22:33:44:55:66, No IP yet (0.0.0.0)", color: "chart-3" },
      { from: "server", to: "client", label: "OFFER", detail: "Server offers 192.168.1.50 (lease: 86400s, mask: 255.255.255.0, GW: .1, DNS: .1)", color: "chart-2" },
      { from: "client", to: "broadcast", label: "REQUEST", detail: "Client requests offered IP 192.168.1.50 (broadcast so other DHCP servers see)", color: "primary" },
      { from: "server", to: "client", label: "ACK", detail: "Server confirms: IP=192.168.1.50, Lease=86400s. Client configures interface.", color: "chart-4" },
    ],
  },
  dns: {
    name: "DNS Resolution (Iterative)",
    steps: [
      { from: "client", to: "server", label: "Query", detail: "Client → Local DNS: Resolve www.example.com (Type A, Class IN)", color: "primary" },
      { from: "server", to: "broadcast", label: "→ Root DNS", detail: "Local DNS → Root (a.root-servers.net): Who handles .com?", color: "chart-3" },
      { from: "broadcast", to: "server", label: "← Referral", detail: "Root → Local DNS: Try .com TLD servers (a.gtld-servers.net)", color: "chart-2" },
      { from: "server", to: "broadcast", label: "→ TLD DNS", detail: "Local DNS → .com TLD: Who handles example.com?", color: "chart-3" },
      { from: "broadcast", to: "server", label: "← Referral", detail: "TLD → Local DNS: Authoritative NS = ns1.example.com", color: "chart-2" },
      { from: "server", to: "broadcast", label: "→ Auth DNS", detail: "Local DNS → ns1.example.com: What is www.example.com?", color: "chart-3" },
      { from: "broadcast", to: "server", label: "← Answer", detail: "Auth → Local DNS: www.example.com = 93.184.216.34 (TTL 3600)", color: "chart-4" },
      { from: "server", to: "client", label: "Response", detail: "Local DNS → Client: 93.184.216.34 (cached for TTL seconds)", color: "primary" },
    ],
  },
};

const ProtocolAnalyzer = () => {
  const [protocol, setProtocol] = useState<Protocol>("tcp");
  const [step, setStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showPacketBytes, setShowPacketBytes] = useState(false);

  const proto = protocols[protocol];
  const totalSteps = proto.steps.length;

  const reset = useCallback(() => {
    setStep(-1);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (step >= totalSteps - 1) {
        setIsPlaying(false);
        return;
      }
      setStep(s => s + 1);
    }, 1000 / speed);
    return () => clearTimeout(timer);
  }, [isPlaying, step, totalSteps, speed]);

  useEffect(() => { reset(); }, [protocol, reset]);

  const svgW = 600, svgH = Math.max(200, totalSteps * 45 + 60);
  const clientX = 100, serverX = 500, broadcastX = 300;

  const getX = (who: string) => who === "client" ? clientX : who === "server" ? serverX : broadcastX;

  // Fake packet hex dump
  const getHexDump = (s: Step) => {
    const lines = [
      "0000   45 00 00 3c 1c 46 40 00 40 06 b1 e6 c0 a8 01 0a",
      `0010   c0 a8 01 01 ${s.flags?.includes("SYN") ? "c0 12" : "00 50"} 00 50 00 00 00 64`,
      `0020   00 00 01 2c ${s.flags?.includes("SYN") ? "a0 02" : "50 18"} ff ff ${s.flags?.includes("FIN") ? "00 01" : "b8 40"} 00 00`,
    ];
    return lines;
  };

  return (
    <div className="space-y-5">
      {/* Protocol selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(protocols) as Protocol[]).map(p => (
          <button key={p} onClick={() => setProtocol(p)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              protocol === p ? "bg-chart-4/15 border-chart-4/40 text-chart-4" : "border-border text-muted-foreground hover:text-foreground"
            )}>{p.toUpperCase()}</button>
        ))}
      </div>

      <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-primary">
        {proto.name}
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={() => { if (step === -1) { setStep(0); setIsPlaying(true); } else setIsPlaying(!isPlaying); }}
          className="px-4 py-2 rounded-lg text-xs font-mono bg-primary text-primary-foreground flex items-center gap-1.5">
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {step === -1 ? "Start" : isPlaying ? "Pause" : "Resume"}
        </button>
        <button onClick={() => setStep(s => Math.min(s + 1, totalSteps - 1))}
          className="px-3 py-2 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground" disabled={step >= totalSteps - 1}>
          Step →
        </button>
        <button onClick={reset} className="px-3 py-2 rounded-lg text-xs font-mono border border-border text-muted-foreground hover:text-foreground">
          <RotateCcw size={14} />
        </button>
        <div className="flex items-center gap-2 ml-2">
          {[0.5, 1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                speed === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
              )}>{s}x</button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
          <input type="checkbox" checked={showPacketBytes} onChange={e => setShowPacketBytes(e.target.checked)} className="accent-[hsl(var(--chart-3))]" />
          <span className="text-[10px] font-mono text-chart-3">Show Hex</span>
        </label>
      </div>

      {/* Message Sequence Chart */}
      <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ minHeight: 300 }}>
          {/* Lifelines */}
          <rect x={clientX - 30} y="5" width="60" height="22" rx="4" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1" />
          <text x={clientX} y="20" textAnchor="middle" fontSize="9" fill="hsl(var(--primary))" fontFamily="monospace" fontWeight="bold">CLIENT</text>
          <line x1={clientX} y1="27" x2={clientX} y2={svgH - 10} stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

          <rect x={serverX - 30} y="5" width="60" height="22" rx="4" fill="hsl(var(--chart-2) / 0.15)" stroke="hsl(var(--chart-2) / 0.4)" strokeWidth="1" />
          <text x={serverX} y="20" textAnchor="middle" fontSize="9" fill="hsl(var(--chart-2))" fontFamily="monospace" fontWeight="bold">SERVER</text>
          <line x1={serverX} y1="27" x2={serverX} y2={svgH - 10} stroke="hsl(var(--chart-2))" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

          {protocol === "dns" && (
            <>
              <rect x={broadcastX - 30} y="5" width="60" height="22" rx="4" fill="hsl(var(--chart-3) / 0.15)" stroke="hsl(var(--chart-3) / 0.4)" strokeWidth="1" />
              <text x={broadcastX} y="20" textAnchor="middle" fontSize="8" fill="hsl(var(--chart-3))" fontFamily="monospace" fontWeight="bold">DNS SERVERS</text>
              <line x1={broadcastX} y1="27" x2={broadcastX} y2={svgH - 10} stroke="hsl(var(--chart-3))" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
            </>
          )}

          {/* Messages */}
          {proto.steps.map((s, i) => {
            const y = 55 + i * 45;
            const fromX = getX(s.from);
            const toX = getX(s.to);
            const isActive = i === step;
            const isPast = i < step;
            const isFuture = i > step;
            const midX = (fromX + toX) / 2;
            const isLeft = toX < fromX;

            return (
              <g key={i} opacity={isFuture ? 0.15 : isPast ? 0.6 : 1}
                className={isActive ? "animate-fade-in" : ""}>
                {/* Arrow */}
                <line x1={fromX} y1={y} x2={toX} y2={y}
                  stroke={`hsl(var(--${s.color}))`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  markerEnd="url(#arrowhead)" />
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" opacity="0.5" />
                  </marker>
                </defs>

                {/* Label */}
                <rect x={midX - 35} y={y - 14} width="70" height="14" rx="3"
                  fill={isActive ? `hsl(var(--${s.color}) / 0.2)` : "hsl(var(--muted) / 0.5)"}
                  stroke={`hsl(var(--${s.color}) / 0.3)`} strokeWidth="0.5" />
                <text x={midX} y={y - 4} textAnchor="middle" fontSize="8"
                  fill={`hsl(var(--${s.color}))`} fontFamily="monospace" fontWeight="bold">
                  {s.label}
                </text>

                {/* Flags */}
                {s.flags && (
                  <text x={midX} y={y + 12} textAnchor="middle" fontSize="6"
                    fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                    [{s.flags}]
                  </text>
                )}

                {/* Step number */}
                <text x={fromX + (isLeft ? 8 : -8)} y={y + 4} textAnchor={isLeft ? "start" : "end"} fontSize="7"
                  fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity="0.5">
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Step detail */}
      {step >= 0 && step < totalSteps && (
        <div className="p-4 rounded-xl bg-card border border-primary/20 space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-mono font-bold text-primary-foreground",
              `bg-${proto.steps[step].color}`
            )} style={{ backgroundColor: `hsl(var(--${proto.steps[step].color}))` }}>
              Step {step + 1}/{totalSteps}
            </span>
            <span className="text-sm font-mono font-bold text-foreground">{proto.steps[step].label}</span>
          </div>
          <div className="text-xs font-mono text-muted-foreground">{proto.steps[step].detail}</div>

          {showPacketBytes && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="text-[9px] font-mono text-muted-foreground mb-1">PACKET HEX DUMP</div>
              {getHexDump(proto.steps[step]).map((line, i) => (
                <div key={i} className="text-[10px] font-mono text-chart-3">{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TCP State Diagram (for TCP protocol) */}
      {protocol === "tcp" && (
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">TCP STATE TRANSITIONS</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-mono text-primary mb-1">CLIENT STATE</div>
              <div className="flex gap-1 flex-wrap">
                {["CLOSED", "SYN_SENT", "ESTABLISHED", "FIN_WAIT_1", "FIN_WAIT_2", "TIME_WAIT", "CLOSED"].map((state, i) => (
                  <span key={i} className={cn("px-2 py-0.5 rounded text-[8px] font-mono border",
                    step >= [0, 0, 2, 7, 8, 10, 11][i] && step < ([0, 2, 7, 8, 10, 11, 99] as number[])[i]
                      ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground/40"
                  )}>{state}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-mono text-chart-2 mb-1">SERVER STATE</div>
              <div className="flex gap-1 flex-wrap">
                {["LISTEN", "SYN_RCVD", "ESTABLISHED", "CLOSE_WAIT", "LAST_ACK", "CLOSED"].map((state, i) => (
                  <span key={i} className={cn("px-2 py-0.5 rounded text-[8px] font-mono border",
                    step >= [-1, 0, 2, 7, 9, 10][i] && step < ([0, 2, 9, 9, 10, 99] as number[])[i]
                      ? "bg-chart-2/15 border-chart-2/40 text-chart-2" : "border-border text-muted-foreground/40"
                  )}>{state}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key concepts */}
      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">📋 {protocol.toUpperCase()} Key Concepts</div>
        {protocol === "tcp" && <>
          <div>• <span className="text-primary">3-way handshake:</span> SYN → SYN-ACK → ACK (reliable connection setup)</div>
          <div>• <span className="text-chart-2">Seq/Ack numbers:</span> track byte stream position for ordered delivery</div>
          <div>• <span className="text-destructive">4-way teardown:</span> FIN → ACK → FIN → ACK (graceful close)</div>
          <div>• <span className="text-chart-3">TIME_WAIT:</span> 2×MSL (Maximum Segment Lifetime) — prevents late duplicates</div>
        </>}
        {protocol === "udp" && <>
          <div>• <span className="text-primary">Connectionless:</span> no handshake, no state, no reliability</div>
          <div>• <span className="text-chart-2">Low overhead:</span> 8-byte header vs TCP's 20+ bytes</div>
          <div>• <span className="text-chart-3">Use cases:</span> DNS, streaming, VoIP, gaming (latency-sensitive)</div>
        </>}
        {protocol === "arp" && <>
          <div>• <span className="text-primary">Purpose:</span> Maps IP → MAC address within a broadcast domain</div>
          <div>• <span className="text-chart-3">Broadcast:</span> ARP Request → all hosts; unicast reply from target</div>
          <div>• <span className="text-destructive">Security:</span> ARP spoofing / poisoning — no authentication!</div>
        </>}
        {protocol === "dhcp" && <>
          <div>• <span className="text-primary">DORA:</span> Discover → Offer → Request → Acknowledge</div>
          <div>• <span className="text-chart-2">Provides:</span> IP, subnet mask, gateway, DNS, lease time</div>
          <div>• <span className="text-chart-3">Broadcast:</span> Discover & Request are broadcast (client has no IP yet)</div>
        </>}
        {protocol === "dns" && <>
          <div>• <span className="text-primary">Iterative:</span> Local DNS queries root → TLD → authoritative</div>
          <div>• <span className="text-chart-2">Recursive:</span> Client → Local DNS (one query, server does the work)</div>
          <div>• <span className="text-chart-3">Caching:</span> TTL-based caching at every level reduces load</div>
        </>}
      </div>
    </div>
  );
};

export default ProtocolAnalyzer;

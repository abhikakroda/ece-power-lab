import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw, ArrowDown, ArrowUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Layer {
  num: number;
  name: string;
  protocol: string;
  pdu: string;
  color: string;
  headerInfo: string;
  errorCheck: string;
}

const layers: Layer[] = [
  { num: 7, name: "Application", protocol: "HTTP / FTP / SMTP", pdu: "Data", color: "text-chart-1", headerInfo: "Content-Type, Host, Auth", errorCheck: "Application validation" },
  { num: 6, name: "Presentation", protocol: "SSL / TLS / JPEG", pdu: "Data", color: "text-chart-2", headerInfo: "Encryption, Compression", errorCheck: "Format verification" },
  { num: 5, name: "Session", protocol: "NetBIOS / RPC", pdu: "Data", color: "text-chart-3", headerInfo: "Session ID, Sync points", errorCheck: "Session state check" },
  { num: 4, name: "Transport", protocol: "TCP / UDP", pdu: "Segment", color: "text-chart-4", headerInfo: "Src Port, Dst Port, Seq#, Ack#", errorCheck: "TCP Checksum (16-bit)" },
  { num: 3, name: "Network", protocol: "IP / ICMP / ARP", pdu: "Packet", color: "text-primary", headerInfo: "Src IP, Dst IP, TTL, Protocol", errorCheck: "Header Checksum" },
  { num: 2, name: "Data Link", protocol: "Ethernet / Wi-Fi", pdu: "Frame", color: "text-chart-5", headerInfo: "Src MAC, Dst MAC, Type", errorCheck: "CRC-32 (FCS)" },
  { num: 1, name: "Physical", protocol: "Cables / Radio", pdu: "Bits", color: "text-muted-foreground", headerInfo: "Preamble, SFD", errorCheck: "Signal integrity" },
];

type Phase = "idle" | "encapsulating" | "transmitting" | "decapsulating" | "done" | "error";

const OSIAnimation = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeLayer, setActiveLayer] = useState(-1);
  const [direction, setDirection] = useState<"down" | "up">("down");
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [encapsulated, setEncapsulated] = useState<number[]>([]);
  const [errorLayer, setErrorLayer] = useState<number | null>(null);
  const [injectError, setInjectError] = useState(false);
  const [packetData, setPacketData] = useState("Hello, World!");
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog(prev => [...prev.slice(-20), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setActiveLayer(-1);
    setDirection("down");
    setIsPlaying(false);
    setEncapsulated([]);
    setErrorLayer(null);
    setLog([]);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const delay = 800 / speed;
    const timer = setTimeout(() => {
      if (phase === "idle") {
        setPhase("encapsulating");
        setDirection("down");
        setActiveLayer(0);
        addLog("📤 Starting encapsulation at Application layer");
        return;
      }

      if (phase === "encapsulating") {
        if (activeLayer < 7) {
          const layer = layers[activeLayer];
          setEncapsulated(prev => [...prev, layer.num]);
          addLog(`⬇ L${layer.num} ${layer.name}: Adding ${layer.pdu} header [${layer.headerInfo}]`);

          // Error injection at Data Link layer
          if (injectError && layer.num === 2) {
            setErrorLayer(2);
            setPhase("error");
            addLog(`❌ CRC Error detected at Data Link layer! Frame corrupted.`);
            setIsPlaying(false);
            return;
          }

          setActiveLayer(prev => prev + 1);
        } else {
          setPhase("transmitting");
          addLog("⚡ Transmitting bits over physical medium...");
        }
        return;
      }

      if (phase === "transmitting") {
        setPhase("decapsulating");
        setDirection("up");
        setActiveLayer(6);
        addLog("📥 Received at destination — starting decapsulation");
        return;
      }

      if (phase === "decapsulating") {
        if (activeLayer >= 0) {
          const layer = layers[activeLayer];
          setEncapsulated(prev => prev.filter(n => n !== layer.num));
          addLog(`⬆ L${layer.num} ${layer.name}: Removing header, ${layer.errorCheck} ✓`);
          setActiveLayer(prev => prev - 1);
        } else {
          setPhase("done");
          addLog("✅ Data delivered successfully to Application layer!");
          setIsPlaying(false);
        }
        return;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [isPlaying, phase, activeLayer, speed, injectError, addLog]);

  const getPacketVisualization = () => {
    const headers = encapsulated.sort((a, b) => b - a);
    if (headers.length === 0) return [{ label: "Data", color: "bg-muted text-foreground" }];

    const parts: { label: string; color: string }[] = [];
    for (const h of headers) {
      const layer = layers.find(l => l.num === h)!;
      parts.push({
        label: `L${h}`,
        color: h === 7 ? "bg-chart-1/20 text-chart-1" :
               h === 6 ? "bg-chart-2/20 text-chart-2" :
               h === 5 ? "bg-chart-3/20 text-chart-3" :
               h === 4 ? "bg-chart-4/20 text-chart-4" :
               h === 3 ? "bg-primary/20 text-primary" :
               h === 2 ? "bg-chart-5/20 text-chart-5" :
               "bg-muted text-muted-foreground"
      });
    }
    parts.push({ label: packetData.slice(0, 12), color: "bg-muted text-foreground" });
    if (headers.includes(2)) {
      parts.push({ label: errorLayer === 2 ? "FCS ✗" : "FCS", color: errorLayer === 2 ? "bg-destructive/20 text-destructive" : "bg-chart-5/20 text-chart-5" });
    }
    return parts;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" onClick={() => { if (phase === "idle") { setIsPlaying(true); } else { setIsPlaying(!isPlaying); } }}
          className="bg-primary text-primary-foreground gap-1.5 text-xs font-mono">
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {phase === "idle" ? "Start" : isPlaying ? "Pause" : "Resume"}
        </Button>
        <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 text-xs font-mono">
          <RotateCcw size={14} /> Reset
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[10px] text-muted-foreground font-mono">Speed:</span>
          {[0.5, 1, 2].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                speed === s ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"
              )}>
              {s}x
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 ml-4 cursor-pointer">
          <input type="checkbox" checked={injectError} onChange={e => setInjectError(e.target.checked)}
            className="accent-[hsl(var(--destructive))]" />
          <span className="text-[10px] font-mono text-destructive">Inject CRC Error</span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* OSI Stack */}
        <div className="lg:col-span-2 space-y-1">
          {/* Sender label */}
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {direction === "down" ? "📤 SENDER — Encapsulation" : "📥 RECEIVER — Decapsulation"}
            </div>
            <div className="flex-1 h-px bg-border" />
            {direction === "down" ? <ArrowDown size={14} className="text-chart-2 animate-bounce" /> : <ArrowUp size={14} className="text-primary animate-bounce" />}
          </div>

          {layers.map((layer, idx) => {
            const isActive = idx === activeLayer && (phase === "encapsulating" || phase === "decapsulating");
            const isEncapsulated = encapsulated.includes(layer.num);
            const isError = errorLayer === layer.num;
            
            return (
              <div key={layer.num}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-300",
                  isActive ? "border-primary/50 bg-primary/5 scale-[1.02] shadow-lg shadow-primary/5" :
                  isError ? "border-destructive/50 bg-destructive/5" :
                  isEncapsulated ? "border-border bg-card/80" :
                  "border-border/50 bg-card/40"
                )}
                style={{ transitionDelay: `${idx * 30}ms` }}
              >
                {/* Layer number */}
                <div className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center text-xs font-mono font-bold border shrink-0 transition-all",
                  isActive ? "bg-primary/20 border-primary/40 text-primary" :
                  isError ? "bg-destructive/20 border-destructive/40 text-destructive" :
                  isEncapsulated ? "bg-muted border-border text-foreground" :
                  "bg-muted/50 border-border/50 text-muted-foreground"
                )}>
                  L{layer.num}
                </div>

                {/* Layer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{layer.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{layer.protocol}</span>
                  </div>
                  {isActive && (
                    <div className="text-[10px] font-mono text-primary mt-0.5 animate-fade-in">
                      {direction === "down" ? `Adding: ${layer.headerInfo}` : `Verifying: ${layer.errorCheck}`}
                    </div>
                  )}
                </div>

                {/* PDU */}
                <div className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono border shrink-0",
                  isEncapsulated ? "border-primary/20 text-primary bg-primary/5" : "border-border/50 text-muted-foreground"
                )}>
                  {layer.pdu}
                </div>

                {/* Status icon */}
                <div className="w-5 shrink-0">
                  {isActive && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                  {isError && <AlertTriangle size={14} className="text-destructive" />}
                  {!isActive && !isError && isEncapsulated && phase === "decapsulating" && idx > activeLayer && (
                    <CheckCircle2 size={14} className="text-primary/50" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Physical medium */}
          {phase === "transmitting" && (
            <div className="mt-2 p-3 rounded-lg border border-chart-3/30 bg-chart-3/5 animate-fade-in">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-1.5 h-3 rounded-sm bg-chart-3 animate-pulse"
                      style={{ animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-chart-3">Transmitting over physical medium...</span>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: packet viz + log */}
        <div className="space-y-4">
          {/* Packet visualization */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-3 uppercase tracking-wider">Packet Structure</div>
            <div className="flex flex-wrap gap-1">
              {getPacketVisualization().map((part, i) => (
                <div key={i} className={cn(
                  "px-2 py-1.5 rounded text-[10px] font-mono border border-border/50 transition-all",
                  part.color,
                  i === 0 && encapsulated.length > 0 ? "animate-fade-in" : ""
                )}>
                  {part.label}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] font-mono text-muted-foreground">
              Total headers: {encapsulated.length} | Size: ~{20 * encapsulated.length + packetData.length} bytes
            </div>
          </div>

          {/* Status */}
          <div className={cn("p-3 rounded-lg border text-center",
            phase === "done" ? "border-primary/30 bg-primary/5" :
            phase === "error" ? "border-destructive/30 bg-destructive/5" :
            "border-border bg-card"
          )}>
            <div className={cn("text-xs font-mono font-bold",
              phase === "done" ? "text-primary" :
              phase === "error" ? "text-destructive" :
              "text-foreground"
            )}>
              {phase === "idle" && "⏳ Ready to transmit"}
              {phase === "encapsulating" && `⬇ Encapsulating — Layer ${7 - activeLayer}`}
              {phase === "transmitting" && "⚡ In transit..."}
              {phase === "decapsulating" && `⬆ Decapsulating — Layer ${layers[activeLayer]?.num || "done"}`}
              {phase === "done" && "✅ Delivered!"}
              {phase === "error" && "❌ Transmission Error!"}
            </div>
          </div>

          {/* Log */}
          <div className="p-3 rounded-xl bg-card border border-border max-h-64 overflow-y-auto">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Event Log</div>
            <div className="space-y-0.5">
              {log.length === 0 && (
                <div className="text-[10px] font-mono text-muted-foreground/50 italic">Press Start to begin...</div>
              )}
              {log.map((entry, i) => (
                <div key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 rounded-lg bg-card border border-border">
        <div className="flex gap-4 flex-wrap text-[10px] font-mono text-muted-foreground">
          <span>L7–L5: <span className="text-chart-3">Upper layers</span> (Data)</span>
          <span>L4: <span className="text-chart-4">Transport</span> (Segment)</span>
          <span>L3: <span className="text-primary">Network</span> (Packet)</span>
          <span>L2: <span className="text-chart-5">Data Link</span> (Frame + FCS)</span>
          <span>L1: Physical (Bits)</span>
        </div>
      </div>
    </div>
  );
};

export default OSIAnimation;

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const SubnetCalculator = () => {
  const [ip, setIp] = useState("192.168.1.0");
  const [cidr, setCidr] = useState(24);
  const [vlsmSubnets, setVlsmSubnets] = useState("50,30,10,5");

  const parseIp = (s: string): number[] => s.split(".").map(Number);
  const ipToNum = (octets: number[]) => (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
  const numToIp = (n: number) => `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;

  const subnet = useMemo(() => {
    const octets = parseIp(ip);
    if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) return null;

    const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const ipNum = ipToNum(octets) >>> 0;
    const network = (ipNum & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : totalHosts - 2;
    const firstHost = cidr >= 31 ? network : (network + 1) >>> 0;
    const lastHost = cidr >= 31 ? broadcast : (broadcast - 1) >>> 0;
    const wildcard = (~mask) >>> 0;

    // Class
    const classType = octets[0] < 128 ? "A" : octets[0] < 192 ? "B" : octets[0] < 224 ? "C" : octets[0] < 240 ? "D" : "E";
    const isPrivate = (octets[0] === 10) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);

    // Binary representation
    const toBin = (n: number) => n.toString(2).padStart(32, "0").match(/.{8}/g)!.join(".");

    return {
      network: numToIp(network),
      broadcast: numToIp(broadcast),
      mask: numToIp(mask),
      wildcard: numToIp(wildcard),
      firstHost: numToIp(firstHost),
      lastHost: numToIp(lastHost),
      totalHosts,
      usableHosts,
      classType,
      isPrivate,
      binaryIp: toBin(ipNum),
      binaryMask: toBin(mask),
      networkBits: cidr,
      hostBits: 32 - cidr,
    };
  }, [ip, cidr]);

  // VLSM calculation
  const vlsmResult = useMemo(() => {
    const needs = vlsmSubnets.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (!needs.length || !subnet) return [];

    // Sort descending
    const sorted = needs.map((hosts, i) => ({ idx: i, hosts })).sort((a, b) => b.hosts - a.hosts);

    const octets = parseIp(subnet.network);
    let currentNetwork = ipToNum(octets) >>> 0;
    const results: { idx: number; hosts: number; needed: number; cidr: number; network: string; broadcast: string; mask: string; first: string; last: string }[] = [];

    for (const sub of sorted) {
      // Find smallest power of 2 that fits hosts + 2 (network + broadcast)
      let hostBits = 0;
      while (Math.pow(2, hostBits) < sub.hosts + 2) hostBits++;
      const subCidr = 32 - hostBits;
      const subMask = (~0 << hostBits) >>> 0;
      const subSize = Math.pow(2, hostBits);

      // Align to subnet boundary
      currentNetwork = (Math.ceil(currentNetwork / subSize) * subSize) >>> 0;

      const broadcast = (currentNetwork + subSize - 1) >>> 0;

      results.push({
        idx: sub.idx,
        hosts: sub.hosts,
        needed: subSize - 2,
        cidr: subCidr,
        network: numToIp(currentNetwork),
        broadcast: numToIp(broadcast),
        mask: numToIp(subMask),
        first: numToIp((currentNetwork + 1) >>> 0),
        last: numToIp((broadcast - 1) >>> 0),
      });

      currentNetwork = (broadcast + 1) >>> 0;
    }

    return results.sort((a, b) => a.idx - b.idx);
  }, [vlsmSubnets, subnet]);

  // Visual subnet map
  const totalSpace = subnet ? subnet.totalHosts : 256;
  const mapW = 500, mapH = 30;

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">IP Address</label>
          <input value={ip} onChange={e => setIp(e.target.value)}
            className="w-full bg-muted text-foreground border border-border rounded px-2 py-1.5 text-sm font-mono" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <div className="flex justify-between">
            <label className="text-[9px] text-muted-foreground font-mono uppercase">CIDR Prefix</label>
            <span className="text-xs font-mono text-primary">/{cidr}</span>
          </div>
          <input type="range" min={0} max={32} step={1} value={cidr}
            onChange={e => setCidr(parseInt(e.target.value))} className="w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="p-3 rounded-xl bg-card border border-border space-y-1.5">
          <label className="text-[9px] text-muted-foreground font-mono uppercase">VLSM Hosts (comma-sep)</label>
          <input value={vlsmSubnets} onChange={e => setVlsmSubnets(e.target.value)}
            className="w-full bg-muted text-foreground border border-border rounded px-2 py-1 text-xs font-mono"
            placeholder="50,30,10,5" />
        </div>
      </div>

      {subnet && (
        <>
          {/* Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <InfoBox label="Network" value={`${subnet.network}/${cidr}`} color="text-primary" />
            <InfoBox label="Broadcast" value={subnet.broadcast} color="text-chart-2" />
            <InfoBox label="Subnet Mask" value={subnet.mask} color="text-chart-3" />
            <InfoBox label="Wildcard" value={subnet.wildcard} color="text-chart-4" />
            <InfoBox label="First Usable" value={subnet.firstHost} color="text-primary" />
            <InfoBox label="Last Usable" value={subnet.lastHost} color="text-chart-2" />
            <InfoBox label="Usable Hosts" value={`${subnet.usableHosts.toLocaleString()}`} color="text-chart-3" />
            <InfoBox label={`Class ${subnet.classType}`} value={subnet.isPrivate ? "Private" : "Public"} color={subnet.isPrivate ? "text-chart-4" : "text-destructive"} />
          </div>

          {/* Binary breakdown */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">BINARY REPRESENTATION</div>
            <div className="space-y-2 overflow-x-auto">
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground w-16">IP:</span>
                <span className="flex gap-0">
                  {subnet.binaryIp.split("").map((c, i) => (
                    <span key={i} className={cn(
                      c === "." ? "mx-1 text-muted-foreground" :
                      i < (cidr + Math.floor(cidr / 8)) ? "text-primary font-bold" : "text-chart-2"
                    )}>{c}</span>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground w-16">Mask:</span>
                <span className="flex gap-0">
                  {subnet.binaryMask.split("").map((c, i) => (
                    <span key={i} className={cn(
                      c === "." ? "mx-1 text-muted-foreground" :
                      c === "1" ? "text-primary" : "text-muted-foreground/30"
                    )}>{c}</span>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                <span className="w-16"></span>
                <span><span className="text-primary">■ {subnet.networkBits} network bits</span> | <span className="text-chart-2">■ {subnet.hostBits} host bits</span></span>
              </div>
            </div>
          </div>

          {/* Subnet visual map */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">ADDRESS SPACE MAP</div>
            <svg width="100%" viewBox={`0 0 ${mapW} ${vlsmResult.length > 0 ? mapH + 20 : mapH}`}>
              {/* Full range */}
              <rect x="0" y="0" width={mapW} height={mapH} rx="4" fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--border))" strokeWidth="1" />

              {/* VLSM subnets */}
              {vlsmResult.map((sub, i) => {
                const colors = ["primary", "chart-2", "chart-3", "chart-4", "destructive"];
                const c = colors[i % colors.length];
                const startFrac = 0; // simplified
                const widthFrac = (Math.pow(2, 32 - sub.cidr) / totalSpace);
                // Calculate offset
                let offset = 0;
                for (let j = 0; j < i; j++) offset += Math.pow(2, 32 - vlsmResult[j].cidr) / totalSpace;

                return (
                  <g key={i}>
                    <rect x={offset * mapW} y="2" width={Math.max(widthFrac * mapW, 2)} height={mapH - 4} rx="2"
                      fill={`hsl(var(--${c}) / 0.3)`} stroke={`hsl(var(--${c}) / 0.6)`} strokeWidth="1" />
                    <text x={offset * mapW + widthFrac * mapW / 2} y={mapH / 2 + 3} textAnchor="middle" fontSize="7"
                      fill={`hsl(var(--${c}))`} fontFamily="monospace">
                      /{sub.cidr}
                    </text>
                    <text x={offset * mapW + widthFrac * mapW / 2} y={mapH + 12} textAnchor="middle" fontSize="6"
                      fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                      {sub.hosts}h
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* VLSM results table */}
          {vlsmResult.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border overflow-x-auto">
              <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">VLSM SUBNETTING</div>
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 text-muted-foreground">#</th>
                    <th className="text-left py-1 text-muted-foreground">Need</th>
                    <th className="text-left py-1 text-muted-foreground">Network</th>
                    <th className="text-left py-1 text-muted-foreground">Range</th>
                    <th className="text-left py-1 text-muted-foreground">Broadcast</th>
                    <th className="text-left py-1 text-muted-foreground">Mask</th>
                    <th className="text-center py-1 text-muted-foreground">Avail</th>
                    <th className="text-center py-1 text-muted-foreground">Waste</th>
                  </tr>
                </thead>
                <tbody>
                  {vlsmResult.map((sub, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1 text-chart-4">{i + 1}</td>
                      <td className="py-1 text-foreground">{sub.hosts}</td>
                      <td className="py-1 text-primary">{sub.network}/{sub.cidr}</td>
                      <td className="py-1 text-chart-2">{sub.first} — {sub.last}</td>
                      <td className="py-1 text-chart-3">{sub.broadcast}</td>
                      <td className="py-1 text-muted-foreground">{sub.mask}</td>
                      <td className="py-1 text-center text-primary">{sub.needed}</td>
                      <td className={cn("py-1 text-center",
                        sub.needed - sub.hosts > sub.hosts * 0.5 ? "text-destructive" : "text-chart-3"
                      )}>{sub.needed - sub.hosts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Common subnets reference */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-[10px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">CIDR QUICK REFERENCE</div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1">
          {[8, 16, 20, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32].map(c => (
            <button key={c} onClick={() => setCidr(c)}
              className={cn("p-1.5 rounded text-[9px] font-mono border text-center transition-all",
                cidr === c ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}>
              /{c}
              <div className="text-[7px]">{Math.pow(2, 32 - c) - 2 > 0 ? `${(Math.pow(2, 32 - c) - 2).toLocaleString()}` : "p2p"}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-card border border-primary/20 font-mono text-[10px] text-muted-foreground space-y-1">
        <div className="text-primary font-bold text-xs mb-1">🌐 Subnetting Concepts</div>
        <div>• <span className="text-primary">CIDR:</span> /{cidr} means {cidr} network bits, {32 - cidr} host bits</div>
        <div>• <span className="text-chart-2">VLSM:</span> Variable Length Subnet Masking — allocate exactly what's needed</div>
        <div>• <span className="text-chart-3">Rule:</span> Always allocate largest subnet first, then fill remaining space</div>
        <div>• <span className="text-destructive">Exam trap:</span> Hosts = 2^(host bits) − 2 (minus network & broadcast)</div>
        <div>• <span className="text-chart-4">Private ranges:</span> 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16</div>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="p-2.5 rounded-lg border border-border bg-card">
    <div className="text-[8px] text-muted-foreground font-mono">{label}</div>
    <div className={cn("text-[11px] font-mono font-bold", color)}>{value}</div>
  </div>
);

export default SubnetCalculator;

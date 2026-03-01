import { useState } from "react";
import { Network } from "lucide-react";
import { cn } from "@/lib/utils";
import OSIAnimation from "./networking/OSIAnimation";
import RoutingSimulation from "./networking/RoutingSimulation";
import NetworkSimulator from "./networking/NetworkSimulator";
import ProtocolAnalyzer from "./networking/ProtocolAnalyzer";
import TCPCongestionLab from "./networking/TCPCongestionLab";
import SubnetCalculator from "./networking/SubnetCalculator";
import TopologySimLab from "./networking/TopologySimLab";

type Tab = "simulator" | "topology" | "protocol" | "tcp" | "osi" | "routing" | "subnet";

const tabs: [Tab, string][] = [
  ["simulator", "🖧 Network Simulator"],
  ["topology", "🔷 Topology Lab"],
  ["protocol", "📋 Protocol Analyzer"],
  ["tcp", "📈 TCP Congestion"],
  ["routing", "🌐 Routing"],
  ["osi", "📦 OSI Layers"],
  ["subnet", "🔢 Subnet Calculator"],
];

const NetworkingLab = () => {
  const [tab, setTab] = useState<Tab>("simulator");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
          <Network size={20} className="text-chart-4" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Network Simulator</h2>
          <p className="text-sm text-muted-foreground">NS3/GNS3-Style Lab • Topology Builder • Protocol Analysis • TCP/IP</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              tab === id
                ? "bg-chart-4/15 border-chart-4/40 text-chart-4"
                : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === "simulator" && <NetworkSimulator />}
      {tab === "topology" && <TopologySimLab />}
      {tab === "protocol" && <ProtocolAnalyzer />}
      {tab === "tcp" && <TCPCongestionLab />}
      {tab === "routing" && <RoutingSimulation />}
      {tab === "osi" && <OSIAnimation />}
      {tab === "subnet" && <SubnetCalculator />}
    </div>
  );
};

export default NetworkingLab;

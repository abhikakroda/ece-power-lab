import { useState } from "react";
import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import OSIAnimation from "./networking/OSIAnimation";
import RoutingSimulation from "./networking/RoutingSimulation";

type Tab = "osi" | "routing";

const NetworkingLab = () => {
  const [tab, setTab] = useState<Tab>("osi");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
          <Network size={20} className="text-chart-4" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Data Networking</h2>
          <p className="text-sm text-muted-foreground">Packet Simulation • OSI Model • Routing</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ["osi", "📦 OSI Layer Animation"],
          ["routing", "🌐 Routing Simulation"],
        ] as [Tab, string][]).map(([id, label]) => (
          <Button key={id} size="sm" onClick={() => setTab(id)}
            className={cn("text-xs font-mono",
              tab === id
                ? "bg-chart-4 text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "osi" && <OSIAnimation />}
      {tab === "routing" && <RoutingSimulation />}
    </div>
  );
};

export default NetworkingLab;

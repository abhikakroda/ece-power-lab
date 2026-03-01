import { useState } from "react";
import { Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ModulationPlayground from "./comm/ModulationPlayground";
import SamplingVisualizer from "./comm/SamplingVisualizer";

type Tab = "modulation" | "sampling";

const CommSystemsLab = () => {
  const [tab, setTab] = useState<Tab>("modulation");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
          <Waves size={20} className="text-chart-2" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Communication Systems</h2>
          <p className="text-sm text-muted-foreground">Signal Chain Simulator • Modulation • Sampling</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ["modulation", "📡 Modulation Playground"],
          ["sampling", "🎚️ Sampling & Aliasing"],
        ] as [Tab, string][]).map(([id, label]) => (
          <Button key={id} size="sm" onClick={() => setTab(id)}
            className={cn("text-xs font-mono",
              tab === id
                ? "bg-chart-2 text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "modulation" && <ModulationPlayground />}
      {tab === "sampling" && <SamplingVisualizer />}
    </div>
  );
};

export default CommSystemsLab;

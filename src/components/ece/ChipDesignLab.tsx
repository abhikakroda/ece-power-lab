import { useState } from "react";
import { Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import GateDelayVisualizer from "./chipdesign/GateDelayVisualizer";
import ClockTreeVisualizer from "./chipdesign/ClockTreeVisualizer";

type Tab = "delay" | "clock";

const ChipDesignLab = () => {
  const [tab, setTab] = useState<Tab>("delay");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-5/20 flex items-center justify-center">
          <Gem size={20} className="text-chart-5" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Chip Design Lab</h2>
          <p className="text-sm text-muted-foreground">Layout • Timing • Clock Distribution</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ["delay", "⚡ Gate Delay & STA"],
          ["clock", "🕐 Clock Tree Distribution"],
        ] as [Tab, string][]).map(([id, label]) => (
          <Button key={id} size="sm" onClick={() => setTab(id)}
            className={cn("text-xs font-mono",
              tab === id
                ? "bg-chart-5 text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "delay" && <GateDelayVisualizer />}
      {tab === "clock" && <ClockTreeVisualizer />}
    </div>
  );
};

export default ChipDesignLab;

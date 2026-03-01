import { useState } from "react";
import { Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InstructionSimulator from "./microprocessor/InstructionSimulator";
import PipelineVisualizer from "./microprocessor/PipelineVisualizer";

type Tab = "asm" | "pipeline";

const MicroprocessorLab = () => {
  const [tab, setTab] = useState<Tab>("asm");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
          <Cpu size={20} className="text-chart-1" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Microprocessor Lab</h2>
          <p className="text-sm text-muted-foreground">8086 Simulator • Pipeline Visualization</p>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ["asm", "🔧 8086 Instruction Sim"],
          ["pipeline", "⚙️ Pipeline Visualizer"],
        ] as [Tab, string][]).map(([id, label]) => (
          <Button key={id} size="sm" onClick={() => setTab(id)}
            className={cn("text-xs font-mono",
              tab === id
                ? "bg-chart-1 text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "asm" && <InstructionSimulator />}
      {tab === "pipeline" && <PipelineVisualizer />}
    </div>
  );
};

export default MicroprocessorLab;

import { useState } from "react";
import { CircuitBoard, Columns3, ToggleRight, Binary, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import LogicGateSandbox from "./digital/LogicGateSandbox";
import KMapSolver from "./digital/KMapSolver";
import FlipFlopLab from "./digital/FlipFlopLab";
import NumberSystemWorkshop from "./digital/NumberSystemWorkshop";
import BooleanEngine from "./digital/BooleanEngine";

type DigitalTab = "gates" | "kmap" | "flipflop" | "numbers" | "boolean";

const tabs: { id: DigitalTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "gates", label: "Logic Gates", icon: <CircuitBoard size={16} />, desc: "Sandbox" },
  { id: "boolean", label: "Boolean", icon: <FileCode2 size={16} />, desc: "Engine" },
  { id: "kmap", label: "K-Map", icon: <Columns3 size={16} />, desc: "Solver" },
  { id: "flipflop", label: "Flip-Flops", icon: <ToggleRight size={16} />, desc: "Timing Lab" },
  { id: "numbers", label: "Number Systems", icon: <Binary size={16} />, desc: "Workshop" },
];

const DigitalLab = () => {
  const [activeTab, setActiveTab] = useState<DigitalTab>("gates");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
          <CircuitBoard size={20} className="text-chart-2" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Digital Electronics Lab</h2>
          <p className="text-sm text-muted-foreground font-mono">Logic • Boolean • K-Maps • Flip-Flops • Number Systems</p>
        </div>
      </div>

      {/* Sub-navigation — ecosystem feel */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border whitespace-nowrap min-w-fit",
              activeTab === tab.id
                ? "bg-chart-2/10 border-chart-2/40 text-foreground oscilloscope-border"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className={activeTab === tab.id ? "text-chart-2" : ""}>{tab.icon}</span>
            <div className="text-left">
              <div className="leading-tight">{tab.label}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{tab.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "gates" && <LogicGateSandbox />}
        {activeTab === "boolean" && <BooleanEngine />}
        {activeTab === "kmap" && <KMapSolver />}
        {activeTab === "flipflop" && <FlipFlopLab />}
        {activeTab === "numbers" && <NumberSystemWorkshop />}
      </div>
    </div>
  );
};

export default DigitalLab;

import { useState } from "react";
import { Radio, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import DipoleSimulator from "./antenna/DipoleSimulator";
import ArrayFactorVisualizer from "./antenna/ArrayFactorVisualizer";

type AntennaTab = "dipole" | "array";

const tabs: { id: AntennaTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "dipole", label: "Dipole Antenna", icon: <Radio size={16} />, desc: "Radiation Sim" },
  { id: "array", label: "Array Factor", icon: <Grid3X3 size={16} />, desc: "Beam Steering" },
];

const AntennaLab = () => {
  const [activeTab, setActiveTab] = useState<AntennaTab>("dipole");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center">
          <Radio size={20} className="text-chart-3" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Antenna Radiation Lab</h2>
          <p className="text-sm text-muted-foreground font-mono">Dipole Patterns • Array Factor • Beam Steering • Grating Lobes</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border whitespace-nowrap min-w-fit",
              activeTab === tab.id
                ? "bg-chart-3/10 border-chart-3/40 text-foreground oscilloscope-border"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
            <span className={activeTab === tab.id ? "text-chart-3" : ""}>{tab.icon}</span>
            <div className="text-left">
              <div className="leading-tight">{tab.label}</div>
              <div className="text-[10px] text-muted-foreground font-mono">{tab.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "dipole" && <DipoleSimulator />}
        {activeTab === "array" && <ArrayFactorVisualizer />}
      </div>
    </div>
  );
};

export default AntennaLab;

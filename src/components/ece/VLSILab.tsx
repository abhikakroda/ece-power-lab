import { useState } from "react";
import { Cpu, Factory, Pencil, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import MOSFETVisualizer from "./vlsi/MOSFETVisualizer";
import FabricationFlow from "./vlsi/FabricationFlow";
import MicroCADLab from "./vlsi/MicroCADLab";
import CMOSInverterLab from "./vlsi/CMOSInverterLab";

type VLSITab = "microcad" | "cmos" | "mosfet" | "fab";

const tabs: { id: VLSITab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "microcad", label: "MicroCAD Lab", icon: <Pencil size={16} />, desc: "MOSFET Design" },
  { id: "cmos", label: "CMOS Inverter", icon: <Layers size={16} />, desc: "NMOS + PMOS" },
  { id: "mosfet", label: "MOSFET Physics", icon: <Cpu size={16} />, desc: "Device Sim" },
  { id: "fab", label: "Fabrication", icon: <Factory size={16} />, desc: "Flow Game" },
];

const VLSILab = () => {
  const [activeTab, setActiveTab] = useState<VLSITab>("microcad");

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-lg bg-chart-4/20 flex items-center justify-center">
          <Cpu size={22} className="text-chart-4" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">VLSI Technology Lab</h2>
          <p className="text-sm text-muted-foreground font-mono">MicroCAD • MOSFET Physics • Fabrication Flow</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border whitespace-nowrap min-w-fit",
              activeTab === tab.id
                ? "bg-chart-4/10 border-chart-4/40 text-foreground oscilloscope-border"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
            <span className={activeTab === tab.id ? "text-chart-4" : ""}>{tab.icon}</span>
            <div className="text-left">
              <div className="leading-tight">{tab.label}</div>
              <div className="text-xs text-muted-foreground font-mono">{tab.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="animate-fade-in" key={activeTab}>
        {activeTab === "microcad" && <MicroCADLab />}
        {activeTab === "cmos" && <CMOSInverterLab />}
        {activeTab === "mosfet" && <MOSFETVisualizer />}
        {activeTab === "fab" && <FabricationFlow />}
      </div>
    </div>
  );
};

export default VLSILab;

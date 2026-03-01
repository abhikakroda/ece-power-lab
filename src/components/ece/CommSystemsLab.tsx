import { useState } from "react";
import { Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import ModulationPlayground from "./comm/ModulationPlayground";
import ChannelNoiseEngine from "./comm/ChannelNoiseEngine";
import BERCodingLab from "./comm/BERCodingLab";
import CapacityLab from "./comm/CapacityLab";
import ConstellationLab from "./comm/ConstellationLab";
import SamplingVisualizer from "./comm/SamplingVisualizer";

type Tab = "modulation" | "channel" | "ber" | "capacity" | "constellation" | "sampling";

const tabs: [Tab, string][] = [
  ["modulation", "📡 Modulation"],
  ["channel", "📶 Channel & Noise"],
  ["ber", "🔬 BER & Coding"],
  ["capacity", "📊 Capacity"],
  ["constellation", "🧩 Constellation"],
  ["sampling", "🎚️ Sampling"],
];

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
          <p className="text-sm text-muted-foreground">Signal Transmission Playground • Modulation → Channel → BER</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
              tab === id
                ? "bg-chart-2/15 border-chart-2/40 text-chart-2"
                : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === "modulation" && <ModulationPlayground />}
      {tab === "channel" && <ChannelNoiseEngine />}
      {tab === "ber" && <BERCodingLab />}
      {tab === "capacity" && <CapacityLab />}
      {tab === "constellation" && <ConstellationLab />}
      {tab === "sampling" && <SamplingVisualizer />}
    </div>
  );
};

export default CommSystemsLab;

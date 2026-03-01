import { Zap, Radio, BookOpen, BrainCircuit, Timer, ArrowRight, Cpu, CircuitBoard, Activity, Settings2, Microchip } from "lucide-react";
import type { LabSection } from "./LabLayout";

interface DashboardHomeProps {
  onNavigate: (section: LabSection) => void;
}

const features = [
  { id: "circuit" as LabSection, title: "Circuit Solver", desc: "RLC analysis with impedance, phasors & frequency response", icon: <Zap size={20} /> },
  { id: "signal" as LabSection, title: "Signal Visualizer", desc: "Plot, transform & animate continuous and discrete signals", icon: <Radio size={20} /> },
  { id: "formula" as LabSection, title: "Formula Engine", desc: "Subject-wise formulas with proper rendering & tips", icon: <BookOpen size={20} /> },
  { id: "interview" as LabSection, title: "Interview Mode", desc: "Top questions, explanations & trap question alerts", icon: <BrainCircuit size={20} /> },
  { id: "drill" as LabSection, title: "Numerical Drill", desc: "Timed tests with step-by-step solutions", icon: <Timer size={20} /> },
  { id: "transistor" as LabSection, title: "BJT / MOSFET Lab", desc: "Interactive I-V curves & operating regions", icon: <Cpu size={20} /> },
  { id: "digital" as LabSection, title: "Digital Lab", desc: "Logic gates, K-Maps, flip-flops, boolean algebra", icon: <CircuitBoard size={20} /> },
  { id: "spice" as LabSection, title: "SPICE Simulator", desc: "Netlist-based MNA solver with DC, AC & transient", icon: <Activity size={20} /> },
  { id: "control" as LabSection, title: "Control Systems", desc: "Transfer functions, Bode plots, pole-zero maps", icon: <Settings2 size={20} /> },
  { id: "embedded" as LabSection, title: "Embedded Lab", desc: "PWM, ADC sampling, timers, I2C timing", icon: <Microchip size={20} /> },
];

const DashboardHome = ({ onNavigate }: DashboardHomeProps) => {
  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10">
      {/* Hero */}
      <div className="pt-8 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Online
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-3">
          ECE Intelligence Lab
        </h1>
        <p className="text-muted-foreground text-base max-w-xl">
          Your personal electronics engineering workbench — circuits, signals, formulas, interviews, and more.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((f, i) => (
          <button
            key={f.id}
            onClick={() => onNavigate(f.id)}
            className="group text-left p-5 rounded-xl border border-border bg-card hover:bg-muted/50
              hover:border-primary/20 transition-all duration-200 animate-fade-in"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center mb-3 text-primary">
              {f.icon}
            </div>
            <h3 className="text-foreground font-medium text-sm mb-1">{f.title}</h3>
            <p className="text-muted-foreground text-xs leading-relaxed mb-3">{f.desc}</p>
            <div className="flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight size={12} />
            </div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Subjects", value: "7+" },
          { label: "Formulas", value: "200+" },
          { label: "Questions", value: "500+" },
          { label: "Topics", value: "50+" },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg bg-card border border-border text-center">
            <div className="text-lg font-semibold font-mono text-foreground">{stat.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;

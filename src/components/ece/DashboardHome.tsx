import { Zap, Radio, BookOpen, BrainCircuit, Timer, ArrowRight, Cpu } from "lucide-react";
import type { LabSection } from "./LabLayout";
import heroBg from "@/assets/hero-bg.png";

interface DashboardHomeProps {
  onNavigate: (section: LabSection) => void;
}

const features = [
  {
    id: "circuit" as LabSection,
    title: "Circuit Solver",
    desc: "RLC analysis with impedance, phasors & frequency response",
    icon: <Zap size={24} />,
    gradient: "from-primary/20 to-primary/5",
    borderColor: "border-primary/30",
    iconColor: "text-primary",
    glowClass: "box-glow",
  },
  {
    id: "signal" as LabSection,
    title: "Signal Visualizer",
    desc: "Plot, transform & animate continuous and discrete signals",
    icon: <Radio size={24} />,
    gradient: "from-secondary/20 to-secondary/5",
    borderColor: "border-secondary/30",
    iconColor: "text-secondary",
    glowClass: "box-glow-cyan",
  },
  {
    id: "formula" as LabSection,
    title: "Formula Engine",
    desc: "Subject-wise formulas, concept maps & memory tricks",
    icon: <BookOpen size={24} />,
    gradient: "from-accent/20 to-accent/5",
    borderColor: "border-accent/30",
    iconColor: "text-accent",
    glowClass: "",
  },
  {
    id: "interview" as LabSection,
    title: "Interview Mode",
    desc: "Top questions, deep explanations & trap question alerts",
    icon: <BrainCircuit size={24} />,
    gradient: "from-chart-4/20 to-chart-4/5",
    borderColor: "border-chart-4/30",
    iconColor: "text-chart-4",
    glowClass: "",
  },
  {
    id: "drill" as LabSection,
    title: "Numerical Drill",
    desc: "Timed tests with step-by-step solutions & accuracy analysis",
    icon: <Timer size={24} />,
    gradient: "from-destructive/20 to-destructive/5",
    borderColor: "border-destructive/30",
    iconColor: "text-destructive",
    glowClass: "",
  },
  {
    id: "transistor" as LabSection,
    title: "BJT / MOSFET Lab",
    desc: "Interactive I-V curves, operating regions & real-world applications",
    icon: <Cpu size={24} />,
    gradient: "from-chart-3/20 to-chart-3/5",
    borderColor: "border-chart-3/30",
    iconColor: "text-chart-3",
    glowClass: "",
  },
];

const DashboardHome = ({ onNavigate }: DashboardHomeProps) => {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-10">
      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden oscilloscope-border">
        <img src={heroBg} alt="Circuit board background" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="relative z-10 px-8 py-16 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            SYSTEM ONLINE
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">
            ECE Intelligence <span className="text-primary text-glow">Lab</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your personal electronics engineering workbench. Solve circuits, visualize signals,
            master formulas, ace interviews, and drill numericals — all in one place.
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <button
            key={f.id}
            onClick={() => onNavigate(f.id)}
            className={`group text-left p-6 rounded-xl border ${f.borderColor} bg-gradient-to-br ${f.gradient} backdrop-blur-sm
              hover:scale-[1.02] transition-all duration-300 ${f.glowClass} animate-fade-in`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`w-12 h-12 rounded-lg bg-card flex items-center justify-center mb-4 ${f.iconColor}`}>
              {f.icon}
            </div>
            <h3 className="text-foreground font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-muted-foreground text-sm mb-4">{f.desc}</p>
            <div className={`flex items-center gap-1 text-sm ${f.iconColor} group-hover:gap-2 transition-all`}>
              Launch <ArrowRight size={14} />
            </div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Subjects", value: "7+", color: "text-primary" },
          { label: "Formulas", value: "200+", color: "text-secondary" },
          { label: "Questions", value: "500+", color: "text-accent" },
          { label: "Topics", value: "50+", color: "text-chart-4" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-lg bg-card border border-border text-center">
            <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;

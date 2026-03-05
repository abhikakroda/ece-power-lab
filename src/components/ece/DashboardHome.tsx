import {
  Zap, Radio, BookOpen, BrainCircuit, Timer, ArrowRight, Cpu,
  CircuitBoard, Activity, Settings2, Microchip, ListFilter, Waves,
  AudioWaveform, Component, Network, Terminal, Calculator, Sparkles,
} from "lucide-react";
import type { LabSection } from "./LabLayout";

interface DashboardHomeProps {
  onNavigate: (section: LabSection) => void;
}

const categories = [
  {
    label: "Circuits & Signals",
    accent: "from-blue-500/10 to-cyan-500/10 border-blue-500/20",
    iconBg: "bg-blue-500/10 text-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    items: [
      { id: "schematic" as LabSection, title: "Schematic Sim",   desc: "Drag-and-drop schematic editor with live simulation", icon: <Activity size={16} /> },
      { id: "circuit"   as LabSection, title: "Circuit Solver",  desc: "RLC analysis with impedance, phasors & frequency response", icon: <Zap size={16} /> },
      { id: "signal"    as LabSection, title: "Signal Lab",      desc: "Plot, transform & animate continuous and discrete signals", icon: <Radio size={16} /> },
      { id: "filter"    as LabSection, title: "Filter Design",   desc: "Synthesize Butterworth & Chebyshev active analog filters", icon: <ListFilter size={16} /> },
      { id: "dsp"       as LabSection, title: "DSP Lab",         desc: "Signal synthesis and FFT spectrum analysis", icon: <AudioWaveform size={16} /> },
    ],
  },
  {
    label: "Analog Electronics",
    accent: "from-orange-500/10 to-amber-500/10 border-orange-500/20",
    iconBg: "bg-orange-500/10 text-orange-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    items: [
      { id: "transistor"      as LabSection, title: "BJT / MOSFET",    desc: "Interactive I-V curves & operating regions", icon: <Cpu size={16} /> },
      { id: "analog_bjt"      as LabSection, title: "Band Diagram",    desc: "NPN/PNP energy band diagrams under bias", icon: <Cpu size={16} /> },
      { id: "analog_twoport"  as LabSection, title: "2-Port Networks", desc: "Solve Z, Y, ABCD & h-parameters for T-Networks", icon: <Network size={16} /> },
      { id: "analog_theorems" as LabSection, title: "Network Theorems",desc: "Verify Thevenin, Norton & Max Power Transfer", icon: <Zap size={16} /> },
    ],
  },
  {
    label: "RF & Waves",
    accent: "from-purple-500/10 to-violet-500/10 border-purple-500/20",
    iconBg: "bg-purple-500/10 text-purple-500",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    items: [
      { id: "emft"    as LabSection, title: "EMFT & Waves",  desc: "EM wave propagation and attenuation analysis", icon: <Waves size={16} /> },
      { id: "antenna" as LabSection, title: "Antenna Lab",   desc: "Antenna patterns, gain and radiation analysis", icon: <Radio size={16} /> },
      { id: "comm"    as LabSection, title: "Comm Systems",  desc: "Modulation, demodulation & channel analysis", icon: <Waves size={16} /> },
    ],
  },
  {
    label: "Digital & Embedded",
    accent: "from-green-500/10 to-emerald-500/10 border-green-500/20",
    iconBg: "bg-green-500/10 text-green-500",
    badge: "bg-green-500/10 text-green-600 dark:text-green-400",
    items: [
      { id: "digital"        as LabSection, title: "Digital Lab",     desc: "Logic gates, K-Maps, flip-flops, boolean algebra", icon: <CircuitBoard size={16} /> },
      { id: "spice"          as LabSection, title: "SPICE Sim",       desc: "Netlist-based MNA solver with DC, AC & transient", icon: <Activity size={16} /> },
      { id: "control"        as LabSection, title: "Control Systems", desc: "Transfer functions, Bode plots, pole-zero maps", icon: <Settings2 size={16} /> },
      { id: "embedded"       as LabSection, title: "Embedded Lab",    desc: "PWM, ADC, timers, I2C timing diagrams", icon: <Microchip size={16} /> },
      { id: "microprocessor" as LabSection, title: "Microprocessor",  desc: "Visual 8-bit CPU datapath simulator", icon: <Cpu size={16} /> },
    ],
  },
  {
    label: "VLSI & Design",
    accent: "from-rose-500/10 to-pink-500/10 border-rose-500/20",
    iconBg: "bg-rose-500/10 text-rose-500",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    items: [
      { id: "vlsi"       as LabSection, title: "VLSI Lab",      desc: "Layout, LVS, DRC and device modeling", icon: <CircuitBoard size={16} /> },
      { id: "networking" as LabSection, title: "Networking Lab", desc: "Packet flow, protocols and topology design", icon: <Network size={16} /> },
      { id: "breadboard" as LabSection, title: "Breadboard Lab", desc: "Drag-and-drop physical component modeling", icon: <Component size={16} /> },
    ],
  },
  {
    label: "Software Environments",
    accent: "from-yellow-500/10 to-amber-500/10 border-yellow-500/20",
    iconBg: "bg-yellow-500/10 text-yellow-600",
    badge: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    items: [
      { id: "matlab"  as LabSection, title: "MATLAB",  desc: "Browser-based MATLAB IDE with math.js & plotting", icon: <Terminal size={16} /> },
      { id: "scilab"  as LabSection, title: "Scilab",  desc: "Scilab workspace with matrix algebra & 7 plot types", icon: <Calculator size={16} /> },
    ],
  },
  {
    label: "Study & Practice",
    accent: "from-indigo-500/10 to-blue-500/10 border-indigo-500/20",
    iconBg: "bg-indigo-500/10 text-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    items: [
      { id: "formula"   as LabSection, title: "Formula Engine",  desc: "Subject-wise formulas with rendered math & tips", icon: <BookOpen size={16} /> },
      { id: "recall"    as LabSection, title: "Formula Recall",  desc: "Active recall flashcards for every topic", icon: <BookOpen size={16} /> },
      { id: "interview" as LabSection, title: "Interview Mode",  desc: "Top questions, explanations & trap alerts", icon: <BrainCircuit size={16} /> },
      { id: "drill"     as LabSection, title: "Numerical Drill", desc: "Timed tests with step-by-step solutions", icon: <Timer size={16} /> },
    ],
  },
];

const stats = [
  { label: "Labs",      value: "25+", sub: "Interactive environments" },
  { label: "Formulas",  value: "200+", sub: "Rendered with KaTeX" },
  { label: "Questions", value: "500+", sub: "Interview & drill bank" },
  { label: "Topics",    value: "50+",  sub: "Across 8 ECE subjects" },
];

const DashboardHome = ({ onNavigate }: DashboardHomeProps) => {
  return (
    <div className="min-h-full bg-background">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-primary/[0.03] to-background px-8 py-10">
        {/* Decorative grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-4xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/25 bg-primary/8 text-primary text-[11px] font-semibold mb-4 tracking-wide">
            <Sparkles size={10} />
            ECE Intelligence Lab · v1.0
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
            Your Engineering Workbench
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-lg leading-relaxed">
            25+ interactive labs covering circuits, signals, VLSI, RF, and software environments — all in one desktop app.
          </p>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-8 py-4 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {stats.map((s) => (
            <div key={s.label} className="px-4 first:pl-0 last:pr-0">
              <div className="text-xl font-bold font-mono text-foreground">{s.value}</div>
              <div className="text-[11px] font-medium text-foreground/70">{s.label}</div>
              <div className="text-[10px] text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Lab categories ─────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {categories.map((cat) => (
          <div key={cat.label}>
            {/* Category header */}
            <div className="flex items-center gap-2.5 mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cat.badge}`}>
                {cat.label}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`group text-left p-4 rounded-xl border bg-gradient-to-br ${cat.accent} hover:shadow-md hover:-translate-y-[1px] transition-all duration-150`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2.5 ${cat.iconBg}`}>
                    {item.icon}
                  </div>
                  <p className="text-[13px] font-semibold text-foreground mb-1 leading-snug">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{item.desc}</p>
                  <div className="flex items-center gap-1 mt-2.5 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open lab <ArrowRight size={11} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;

import { useState } from "react";
import {
  Zap, Radio, BookOpen, BrainCircuit, Timer, Home, Brain,
  ChevronLeft, ChevronRight, Menu, Cpu, Settings2, Microchip,
  Activity, Factory, Waves, Network, MemoryStick, Gem,
  Filter, Binary, AudioWaveform, Terminal, Calculator,
  FlaskConical, LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

export type LabSection =
  | "home" | "formula" | "interview" | "numerical"
  | "spice" | "control" | "digital" | "bjt" | "embedded" | "microprocessor"
  | "chip_design" | "filter" | "emft" | "dsp" | "schematic" | "circuit"
  | "signal" | "recall" | "transistor" | "vlsi" | "antenna" | "comm"
  | "networking" | "matlab" | "scilab" | string;

interface NavItem { id: LabSection; label: string; icon: React.ReactNode }
interface NavGroup { label: string; color: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    color: "text-blue-500",
    items: [
      { id: "home",         label: "Dashboard",       icon: <LayoutDashboard size={14} /> },
    ],
  },
  {
    label: "Circuits & Signals",
    color: "text-cyan-500",
    items: [
      { id: "schematic",    label: "Schematic Sim",   icon: <Activity size={14} /> },
      { id: "circuit",      label: "Circuit Solver",  icon: <Zap size={14} /> },
      { id: "signal",       label: "Signal Lab",      icon: <Radio size={14} /> },
      { id: "filter",       label: "Filter Design",   icon: <Filter size={14} /> },
      { id: "dsp",          label: "DSP Lab",         icon: <AudioWaveform size={14} /> },
    ],
  },
  {
    label: "Analog Electronics",
    color: "text-orange-500",
    items: [
      { id: "transistor",      label: "BJT / MOSFET",    icon: <Cpu size={14} /> },
      { id: "analog_bjt",      label: "Band Diagram",    icon: <FlaskConical size={14} /> },
      { id: "analog_twoport",  label: "2-Port Networks", icon: <Network size={14} /> },
      { id: "analog_theorems", label: "Net. Theorems",   icon: <Zap size={14} /> },
    ],
  },
  {
    label: "RF & Waves",
    color: "text-purple-500",
    items: [
      { id: "emft",    label: "EMFT & Waves",  icon: <Waves size={14} /> },
      { id: "antenna", label: "Antenna Lab",   icon: <Radio size={14} /> },
      { id: "comm",    label: "Comm Systems",  icon: <Waves size={14} /> },
    ],
  },
  {
    label: "Digital & Embedded",
    color: "text-green-500",
    items: [
      { id: "digital",       label: "Digital Lab",    icon: <Binary size={14} /> },
      { id: "spice",         label: "SPICE Sim",      icon: <Activity size={14} /> },
      { id: "control",       label: "Control Sys.",   icon: <Settings2 size={14} /> },
      { id: "embedded",      label: "Embedded Lab",   icon: <Microchip size={14} /> },
      { id: "microprocessor",label: "Microprocessor", icon: <MemoryStick size={14} /> },
    ],
  },
  {
    label: "VLSI & Design",
    color: "text-rose-500",
    items: [
      { id: "vlsi",       label: "VLSI Lab",    icon: <Factory size={14} /> },
      { id: "chipdesign", label: "Chip Design", icon: <Gem size={14} /> },
      { id: "networking", label: "Networking",  icon: <Network size={14} /> },
    ],
  },
  {
    label: "Software Envs",
    color: "text-yellow-500",
    items: [
      { id: "matlab",  label: "MATLAB",  icon: <Terminal size={14} /> },
      { id: "scilab",  label: "Scilab",  icon: <Calculator size={14} /> },
    ],
  },
  {
    label: "Study Tools",
    color: "text-indigo-500",
    items: [
      { id: "formula",   label: "Formula Engine",  icon: <BookOpen size={14} /> },
      { id: "recall",    label: "Formula Recall",  icon: <Brain size={14} /> },
      { id: "interview", label: "Interview Mode",  icon: <BrainCircuit size={14} /> },
      { id: "drill",     label: "Numerical Drill", icon: <Timer size={14} /> },
    ],
  },
];

interface LabLayoutProps {
  activeSection: LabSection;
  onSectionChange: (section: LabSection) => void;
  children: React.ReactNode;
}

const LabLayout = ({ activeSection, onSectionChange, children }: LabLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3.5 left-3.5 z-50 md:hidden p-1.5 rounded-md bg-card border border-border shadow-sm"
      >
        <Menu size={15} className="text-foreground" />
      </button>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed md:relative z-40 h-full flex flex-col shrink-0",
          "bg-card border-r border-border",
          "transition-all duration-200 ease-in-out",
          collapsed ? "w-[48px]" : "w-[210px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center shrink-0 h-[52px] border-b border-border",
            collapsed ? "justify-center" : "gap-2 px-3"
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shrink-0">
            <Zap size={13} className="text-white" />
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">ECE Intelligence</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Engineering Lab</p>
              </div>
              <ThemeToggle />
            </>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-3 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className={cn(
                  "px-2 mb-1 text-[9.5px] font-bold uppercase tracking-[0.08em]",
                  group.color, "opacity-70"
                )}>
                  {group.label}
                </p>
              )}
              {collapsed && <div className="h-px bg-border mx-1 my-1.5" />}
              <div className="space-y-px">
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onSectionChange(item.id); setMobileOpen(false); }}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center rounded-md text-[12.5px] transition-all duration-100",
                        collapsed
                          ? "justify-center h-8 w-8 mx-auto"
                          : "gap-2 px-2 py-[5px]",
                        isActive
                          ? "bg-primary/12 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span className={cn("shrink-0 opacity-80", isActive && "opacity-100 text-primary")}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="truncate leading-none">{item.label}</span>
                      )}
                      {!collapsed && isActive && (
                        <span className="ml-auto w-1 h-1 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center h-9 border-t border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
};

export default LabLayout;

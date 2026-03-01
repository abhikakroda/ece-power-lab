import { useState } from "react";
import {
  Zap, Radio, BookOpen, BrainCircuit, Timer, Home, Brain,
  ChevronLeft, ChevronRight, Menu, Cpu, CircuitBoard, Settings2, Microchip, Activity, Factory, Waves, Network, MemoryStick, Gem
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

export type LabSection = "home" | "circuit" | "signal" | "formula" | "recall" | "interview" | "drill" | "transistor" | "digital" | "spice" | "control" | "embedded" | "vlsi" | "antenna" | "comm" | "networking" | "microprocessor" | "chipdesign";

interface LabLayoutProps {
  activeSection: LabSection;
  onSectionChange: (section: LabSection) => void;
  children: React.ReactNode;
}

const navItems: { id: LabSection; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Dashboard", icon: <Home size={18} /> },
  { id: "circuit", label: "Circuit Solver", icon: <Zap size={18} /> },
  { id: "signal", label: "Signal Lab", icon: <Radio size={18} /> },
  { id: "formula", label: "Formula Engine", icon: <BookOpen size={18} /> },
  { id: "recall", label: "Formula Recall", icon: <Brain size={18} /> },
  { id: "interview", label: "Interview Mode", icon: <BrainCircuit size={18} /> },
  { id: "drill", label: "Numerical Drill", icon: <Timer size={18} /> },
  { id: "transistor", label: "BJT / MOSFET", icon: <Cpu size={18} /> },
  { id: "digital", label: "Digital Lab", icon: <CircuitBoard size={18} /> },
  { id: "spice", label: "SPICE Sim", icon: <Activity size={18} /> },
  { id: "control", label: "Control Systems", icon: <Settings2 size={18} /> },
  { id: "embedded", label: "Embedded Lab", icon: <Microchip size={18} /> },
  { id: "vlsi", label: "VLSI Lab", icon: <Factory size={18} /> },
  { id: "antenna", label: "Antenna Lab", icon: <Radio size={18} /> },
  { id: "comm", label: "Comm Systems", icon: <Waves size={18} /> },
  { id: "networking", label: "Networking", icon: <Network size={18} /> },
  { id: "microprocessor", label: "Microprocessor", icon: <MemoryStick size={18} /> },
  { id: "chipdesign", label: "Chip Design", icon: <Gem size={18} /> },
];

const LabLayout = ({ activeSection, onSectionChange, children }: LabLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border"
      >
        <Menu size={18} className="text-foreground" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-40 h-full bg-card/80 backdrop-blur-sm border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-14" : "w-56",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-2.5 p-4 border-b border-border", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">ECE Lab</h1>
            </div>
          )}
          {!collapsed && <ThemeToggle />}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSectionChange(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all",
                collapsed && "justify-center px-0",
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center p-2.5 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default LabLayout;

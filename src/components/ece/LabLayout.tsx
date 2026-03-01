import { useState } from "react";
import {
  Zap, Radio, BookOpen, BrainCircuit, Timer, Home,
  ChevronLeft, ChevronRight, Menu, Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LabSection = "home" | "circuit" | "signal" | "formula" | "interview" | "drill" | "transistor";

interface LabLayoutProps {
  activeSection: LabSection;
  onSectionChange: (section: LabSection) => void;
  children: React.ReactNode;
}

const navItems: { id: LabSection; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "home", label: "Dashboard", icon: <Home size={20} />, color: "text-primary" },
  { id: "circuit", label: "Circuit Solver", icon: <Zap size={20} />, color: "text-primary" },
  { id: "signal", label: "Signal Lab", icon: <Radio size={20} />, color: "text-secondary" },
  { id: "formula", label: "Formula Engine", icon: <BookOpen size={20} />, color: "text-accent" },
  { id: "interview", label: "Interview Mode", icon: <BrainCircuit size={20} />, color: "text-chart-4" },
  { id: "drill", label: "Numerical Drill", icon: <Timer size={20} />, color: "text-destructive" },
  { id: "transistor", label: "BJT / MOSFET Lab", icon: <Cpu size={20} />, color: "text-chart-3" },
];

const LabLayout = ({ activeSection, onSectionChange, children }: LabLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-card border border-border"
      >
        <Menu size={20} className="text-primary" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative z-40 h-full bg-card border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 p-4 border-b border-border", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center">
            <Zap size={18} className="text-primary" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground">ECE Intel Lab</h1>
              <p className="text-[10px] text-muted-foreground font-mono">v1.0</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSectionChange(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-200",
                collapsed && "justify-center px-0",
                activeSection === item.id
                  ? "bg-muted text-foreground oscilloscope-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span className={cn(activeSection === item.id ? item.color : "")}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center p-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-background/80 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="grid-bg scanline min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default LabLayout;

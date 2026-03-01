import { useState } from "react";
import LabLayout, { type LabSection } from "@/components/ece/LabLayout";
import DashboardHome from "@/components/ece/DashboardHome";
import CircuitSolver from "@/components/ece/CircuitSolver";
import SignalVisualizer from "@/components/ece/SignalVisualizer";
import FormulaEngine from "@/components/ece/FormulaEngine";
import InterviewMode from "@/components/ece/InterviewMode";
import NumericalDrill from "@/components/ece/NumericalDrill";
import TransistorSimulator from "@/components/ece/TransistorSimulator";
import DigitalLab from "@/components/ece/DigitalLab";

const Index = () => {
  const [section, setSection] = useState<LabSection>("home");

  const renderSection = () => {
    switch (section) {
      case "home": return <DashboardHome onNavigate={setSection} />;
      case "circuit": return <CircuitSolver />;
      case "signal": return <SignalVisualizer />;
      case "formula": return <FormulaEngine />;
      case "interview": return <InterviewMode />;
      case "drill": return <NumericalDrill />;
      case "transistor": return <TransistorSimulator />;
      case "digital": return <DigitalLab />;
      default: return <DashboardHome onNavigate={setSection} />;
    }
  };

  return (
    <LabLayout activeSection={section} onSectionChange={setSection}>
      {renderSection()}
    </LabLayout>
  );
};

export default Index;

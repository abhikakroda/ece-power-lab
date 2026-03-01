import { useState } from "react";
import LabLayout, { type LabSection } from "@/components/ece/LabLayout";
import DashboardHome from "@/components/ece/DashboardHome";
import CircuitSolver from "@/components/ece/CircuitSolver";
import SignalVisualizer from "@/components/ece/SignalVisualizer";
import FormulaEngine from "@/components/ece/FormulaEngine";
import FormulaRecall from "@/components/ece/FormulaRecall";
import InterviewMode from "@/components/ece/InterviewMode";
import NumericalDrill from "@/components/ece/NumericalDrill";
import TransistorSimulator from "@/components/ece/TransistorSimulator";
import DigitalLab from "@/components/ece/DigitalLab";
import SpiceSimulator from "@/components/ece/SpiceSimulator";
import ControlSystemsLab from "@/components/ece/ControlSystemsLab";
import EmbeddedPlayground from "@/components/ece/EmbeddedPlayground";
import VLSILab from "@/components/ece/VLSILab";
import AntennaLab from "@/components/ece/AntennaLab";
import CommSystemsLab from "@/components/ece/CommSystemsLab";
import NetworkingLab from "@/components/ece/NetworkingLab";
import MicroprocessorLab from "@/components/ece/MicroprocessorLab";
import ChipDesignLab from "@/components/ece/ChipDesignLab";

const Index = () => {
  const [section, setSection] = useState<LabSection>("home");

  const renderSection = () => {
    switch (section) {
      case "home": return <DashboardHome onNavigate={setSection} />;
      case "circuit": return <CircuitSolver />;
      case "signal": return <SignalVisualizer />;
      case "formula": return <FormulaEngine />;
      case "recall": return <FormulaRecall />;
      case "interview": return <InterviewMode />;
      case "drill": return <NumericalDrill />;
      case "transistor": return <TransistorSimulator />;
      case "digital": return <DigitalLab />;
      case "spice": return <SpiceSimulator />;
      case "control": return <ControlSystemsLab />;
      case "embedded": return <EmbeddedPlayground />;
      case "vlsi": return <VLSILab />;
      case "antenna": return <AntennaLab />;
      case "comm": return <CommSystemsLab />;
      case "networking": return <NetworkingLab />;
      case "microprocessor": return <MicroprocessorLab />;
      case "chipdesign": return <ChipDesignLab />;
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

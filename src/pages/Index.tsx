import { useState, Suspense, lazy } from "react";
import LabLayout, { type LabSection } from "@/components/ece/LabLayout";

// ── Lazy-load every lab — only the active one is downloaded ──────────────────
const DashboardHome       = lazy(() => import("@/components/ece/DashboardHome"));
const SchematicSimulator  = lazy(() => import("@/components/ece/SchematicSimulator"));
const CircuitSolver       = lazy(() => import("@/components/ece/CircuitSolver"));
const SignalVisualizer    = lazy(() => import("@/components/ece/SignalVisualizer"));
const FormulaEngine       = lazy(() => import("@/components/ece/FormulaEngine"));
const FormulaRecall       = lazy(() => import("@/components/ece/FormulaRecall"));
const InterviewMode       = lazy(() => import("@/components/ece/InterviewMode"));
const NumericalDrill      = lazy(() => import("@/components/ece/NumericalDrill"));
const TransistorSimulator = lazy(() => import("@/components/ece/TransistorSimulator"));
const DigitalLab          = lazy(() => import("@/components/ece/DigitalLab"));
const SpiceSimulator      = lazy(() => import("@/components/ece/SpiceSimulator"));
const ControlSystemsLab   = lazy(() => import("@/components/ece/ControlSystemsLab"));
const EmbeddedPlayground  = lazy(() => import("@/components/ece/EmbeddedPlayground"));
const VLSILab             = lazy(() => import("@/components/ece/VLSILab"));
const AntennaLab          = lazy(() => import("@/components/ece/AntennaLab"));
const CommSystemsLab      = lazy(() => import("@/components/ece/CommSystemsLab"));
const NetworkingLab       = lazy(() => import("@/components/ece/NetworkingLab"));
const MicroprocessorLab   = lazy(() => import("@/components/ece/MicroprocessorLab"));
const ChipDesignLab       = lazy(() => import("@/components/ece/ChipDesignLab"));
const FilterDesignLab     = lazy(() => import("@/components/ece/FilterDesignLab"));
const EMFTLab             = lazy(() => import("@/components/ece/EMFTLab"));
const DSPLab              = lazy(() => import("@/components/ece/DSPLab"));
const BreadboardLab       = lazy(() => import("@/components/ece/BreadboardLab"));
const BJTBandLab          = lazy(() => import("@/components/ece/BJTBandLab"));
const TwoPortLab          = lazy(() => import("@/components/ece/TwoPortLab"));
const TheoremValidator    = lazy(() => import("@/components/ece/TheoremValidator"));
const MatlabLab           = lazy(() => import("@/components/ece/software/MatlabLab"));
const ScilabLab           = lazy(() => import("@/components/ece/software/ScilabLab"));

const LabLoader = () => (
  <div className="flex-1 flex items-center justify-center h-full w-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-7 h-7 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-xs text-muted-foreground tracking-wide">Loading lab…</p>
    </div>
  </div>
);

const Index = () => {
  const [section, setSection] = useState<LabSection>("home");

  const renderSection = () => {
    switch (section) {
      case "home":            return <DashboardHome onNavigate={setSection} />;
      case "schematic":       return <SchematicSimulator />;
      case "circuit":         return <CircuitSolver />;
      case "signal":          return <SignalVisualizer />;
      case "formula":         return <FormulaEngine />;
      case "recall":          return <FormulaRecall />;
      case "interview":       return <InterviewMode />;
      case "drill":           return <NumericalDrill />;
      case "transistor":      return <TransistorSimulator />;
      case "digital":         return <DigitalLab />;
      case "spice":           return <SpiceSimulator />;
      case "control":         return <ControlSystemsLab />;
      case "embedded":        return <EmbeddedPlayground />;
      case "vlsi":            return <VLSILab />;
      case "antenna":         return <AntennaLab />;
      case "comm":            return <CommSystemsLab />;
      case "networking":      return <NetworkingLab />;
      case "microprocessor":  return <MicroprocessorLab />;
      case "chipdesign":      return <ChipDesignLab />;
      case "filter":          return <FilterDesignLab />;
      case "emft":            return <EMFTLab />;
      case "dsp":             return <DSPLab />;
      case "breadboard":      return <BreadboardLab />;
      case "analog_bjt":      return <BJTBandLab />;
      case "analog_twoport":  return <TwoPortLab />;
      case "analog_theorems": return <TheoremValidator />;
      case "matlab":          return <MatlabLab />;
      case "scilab":          return <ScilabLab />;
      default:                return <DashboardHome onNavigate={setSection} />;
    }
  };

  return (
    <LabLayout activeSection={section} onSectionChange={setSection}>
      <Suspense fallback={<LabLoader />}>
        {renderSection()}
      </Suspense>
    </LabLayout>
  );
};

export default Index;

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play, RotateCcw, ChevronRight, ChevronLeft, Eye, Layers, Zap,
  AlertTriangle, CheckCircle, Info,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────
interface ProcessStep {
  id: string;
  name: string;
  category: "prep" | "oxidation" | "deposition" | "litho" | "etch" | "implant" | "anneal" | "metal";
  description: string;
  theory: string;
  params: StepParam[];
  layerEffect: LayerEffect;
}

interface StepParam {
  name: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  step: number;
  tooltip: string;
}

interface LayerEffect {
  type: "add" | "remove" | "modify" | "pattern";
  layer: string;
  color: string;
  opacity?: number;
}

interface FabState {
  completedSteps: string[];
  currentParams: Record<string, number>;
  layers: LayerState[];
  defects: string[];
  yieldScore: number;
}

interface LayerState {
  id: string;
  name: string;
  color: string;
  y: number;
  height: number;
  pattern?: "doped" | "oxide" | "metal" | "poly" | "nitride" | "photoresist" | "silicide";
  opacity: number;
  regions?: { x: number; w: number; color: string; label?: string }[];
}

// ─── Process Steps ──────────────────────────────────────────────────────
const processSteps: ProcessStep[] = [
  {
    id: "substrate",
    name: "1. Substrate Preparation",
    category: "prep",
    description: "Start with a p-type silicon wafer. The substrate forms the body of the MOSFET.",
    theory: "Crystal orientation <100> preferred for MOSFETs due to lower interface trap density. Typical doping: 10¹⁵ to 10¹⁷ cm⁻³ Boron.",
    params: [
      { name: "Substrate Doping (×10¹⁵)", unit: "cm⁻³", min: 1, max: 1000, default: 100, step: 10, tooltip: "Higher doping → higher Vth, less punch-through" },
      { name: "Wafer Diameter", unit: "mm", min: 150, max: 450, default: 300, step: 50, tooltip: "300mm is standard. 450mm increases throughput" },
    ],
    layerEffect: { type: "add", layer: "substrate", color: "hsl(var(--chart-4))" },
  },
  {
    id: "field_oxide",
    name: "2. Field Oxide (LOCOS / STI)",
    category: "oxidation",
    description: "Grow thick oxide in field regions to isolate adjacent transistors. STI (Shallow Trench Isolation) replaced LOCOS at 250nm node.",
    theory: "LOCOS: pad oxide + Si₃N₄ mask → thermal oxidation → bird's beak encroachment. STI: trench etch → oxide fill → CMP planarization. STI eliminates bird's beak problem.",
    params: [
      { name: "Isolation Method", unit: "", min: 0, max: 1, default: 1, step: 1, tooltip: "0 = LOCOS, 1 = STI" },
      { name: "Field Oxide Thickness", unit: "nm", min: 100, max: 800, default: 400, step: 50, tooltip: "Thicker → better isolation, but more topography" },
    ],
    layerEffect: { type: "add", layer: "field_oxide", color: "hsl(var(--chart-2))" },
  },
  {
    id: "gate_oxide",
    name: "3. Gate Oxide Growth",
    category: "oxidation",
    description: "Grow ultra-thin SiO₂ (or High-κ) in the active region. This is the most critical layer — controls Vth and leakage.",
    theory: "Dry thermal oxidation at 800-1000°C gives best quality. High-κ (HfO₂, κ≈25) allows thicker physical oxide with same capacitance. EOT = t_highk × (3.9/κ). Below ~1.2nm SiO₂, direct quantum tunneling dominates leakage.",
    params: [
      { name: "Gate Oxide Thickness", unit: "nm", min: 0.8, max: 20, default: 2, step: 0.2, tooltip: "Thinner → higher Cox → more current, but more leakage" },
      { name: "Dielectric Type", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = SiO₂ (κ=3.9), 1 = HfO₂ (κ=25)" },
      { name: "Growth Temperature", unit: "°C", min: 700, max: 1100, default: 900, step: 25, tooltip: "Higher T → faster growth, better quality but more diffusion" },
    ],
    layerEffect: { type: "add", layer: "gate_oxide", color: "hsl(213 80% 70%)" },
  },
  {
    id: "poly_dep",
    name: "4. Polysilicon Deposition",
    category: "deposition",
    description: "Deposit polysilicon gate electrode via LPCVD. This forms the gate that controls the channel.",
    theory: "LPCVD at 600-650°C using SiH₄. Heavily doped n+ poly for NMOS gate. Modern nodes use metal gates (TiN, TaN) to eliminate poly depletion effect. Gate height affects aspect ratio during etch.",
    params: [
      { name: "Poly Thickness", unit: "nm", min: 50, max: 400, default: 200, step: 25, tooltip: "Thicker → lower gate resistance, harder to etch" },
      { name: "Gate Material", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = Poly-Si, 1 = Metal Gate (TiN)" },
    ],
    layerEffect: { type: "add", layer: "poly_gate", color: "hsl(var(--chart-3))" },
  },
  {
    id: "gate_litho",
    name: "5. Gate Patterning (Lithography)",
    category: "litho",
    description: "Apply photoresist, expose through mask to define gate pattern. This determines the channel length — the most critical dimension.",
    theory: "Resolution = k₁ × λ/NA. DUV (193nm) with immersion → ~38nm. EUV (13.5nm) → sub-7nm. Double/quadruple patterning for intermediate nodes. Overlay accuracy must be <1nm at advanced nodes.",
    params: [
      { name: "Channel Length", unit: "nm", min: 5, max: 500, default: 45, step: 5, tooltip: "Defines transistor speed. Shorter → faster but more SCE" },
      { name: "Lithography Type", unit: "", min: 0, max: 2, default: 1, step: 1, tooltip: "0 = DUV, 1 = Immersion, 2 = EUV" },
    ],
    layerEffect: { type: "pattern", layer: "photoresist", color: "hsl(0 70% 60%)" },
  },
  {
    id: "gate_etch",
    name: "6. Gate Etch (RIE)",
    category: "etch",
    description: "Anisotropic dry etch to transfer gate pattern. Must stop precisely on thin gate oxide without damaging it.",
    theory: "RIE uses Cl₂/HBr plasma for Si etch. High selectivity to oxide is critical (>50:1). Sidewall profile must be vertical (< 2° taper). Over-etch damages gate oxide. Under-etch leaves poly stringers.",
    params: [
      { name: "Etch Selectivity", unit: ":1", min: 5, max: 100, default: 50, step: 5, tooltip: "Ratio of poly etch rate to oxide etch rate" },
      { name: "Sidewall Angle", unit: "°", min: 80, max: 90, default: 88, step: 1, tooltip: "90° = perfectly vertical. <85° causes Leff variation" },
    ],
    layerEffect: { type: "remove", layer: "poly_etch", color: "transparent" },
  },
  {
    id: "ldd_implant",
    name: "7. LDD Implant (Lightly Doped Drain)",
    category: "implant",
    description: "Low-dose n-type implant to create lightly doped extension regions. Reduces hot carrier effects at drain junction.",
    theory: "Phosphorus at 20-40 keV, dose ~10¹³ cm⁻². Creates graded junction that spreads the electric field. Without LDD, high E-field at drain → hot carrier injection into gate oxide → reliability failure.",
    params: [
      { name: "Implant Dose (×10¹³)", unit: "cm⁻²", min: 0.5, max: 10, default: 2, step: 0.5, tooltip: "Higher → lower series resistance but more overlap capacitance" },
      { name: "Implant Energy", unit: "keV", min: 5, max: 80, default: 30, step: 5, tooltip: "Higher → deeper junction, more SCE" },
    ],
    layerEffect: { type: "modify", layer: "ldd", color: "hsl(142 60% 50%)" },
  },
  {
    id: "spacer",
    name: "8. Spacer Formation",
    category: "deposition",
    description: "Deposit Si₃N₄, then anisotropic etch to leave spacers on gate sidewalls. Spacers define the offset between gate edge and S/D implant.",
    theory: "LPCVD Si₃N₄ → blanket RIE etchback. Spacer width = deposited thickness. Controls LDD-to-HDD offset. Also serves as self-aligned silicide (salicide) block.",
    params: [
      { name: "Spacer Width", unit: "nm", min: 5, max: 50, default: 20, step: 5, tooltip: "Wider → more offset, less overlap cap but higher resistance" },
      { name: "Spacer Material", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = Si₃N₄, 1 = SiO₂/Si₃N₄ dual" },
    ],
    layerEffect: { type: "add", layer: "spacer", color: "hsl(280 50% 55%)" },
  },
  {
    id: "sd_implant",
    name: "9. Source/Drain Implant",
    category: "implant",
    description: "Heavy n+ implant for source and drain regions. Self-aligned to gate + spacer stack.",
    theory: "Arsenic at 40-80 keV, dose ~5×10¹⁵ cm⁻². Must achieve >10²⁰ cm⁻³ for low contact resistance. Junction depth controls punch-through. Activation anneal repairs lattice damage.",
    params: [
      { name: "Implant Dose (×10¹⁵)", unit: "cm⁻²", min: 1, max: 10, default: 5, step: 0.5, tooltip: "Higher → lower sheet resistance" },
      { name: "Junction Depth", unit: "nm", min: 10, max: 200, default: 50, step: 10, tooltip: "Deeper → more punch-through risk at short L" },
    ],
    layerEffect: { type: "modify", layer: "sd", color: "hsl(142 80% 40%)" },
  },
  {
    id: "anneal",
    name: "10. Activation Anneal",
    category: "anneal",
    description: "Rapid Thermal Anneal (RTA) to activate dopants and repair implant damage. Must minimize diffusion to preserve junction profile.",
    theory: "RTA at 1000-1050°C for 5-10 seconds. Spike anneal (<1s peak) for advanced nodes. Flash anneal and laser anneal for ultra-shallow junctions. Trade-off: higher T → better activation but more diffusion.",
    params: [
      { name: "Anneal Temperature", unit: "°C", min: 800, max: 1100, default: 1000, step: 25, tooltip: "Higher → better activation but more junction spreading" },
      { name: "Anneal Type", unit: "", min: 0, max: 2, default: 1, step: 1, tooltip: "0 = Furnace (slow), 1 = RTA (fast), 2 = Spike/Laser" },
    ],
    layerEffect: { type: "modify", layer: "anneal", color: "hsl(30 90% 55%)" },
  },
  {
    id: "silicide",
    name: "11. Silicide Formation",
    category: "metal",
    description: "Deposit metal (Ni, Co, Ti) → anneal → reacts with exposed Si to form low-resistance silicide on gate, source, drain.",
    theory: "Self-aligned silicide (salicide): metal on Si₃N₄ spacers doesn't react → selective removal. NiSi preferred for ≤65nm (low resistivity, low thermal budget). CoSi₂ for older nodes.",
    params: [
      { name: "Metal Type", unit: "", min: 0, max: 2, default: 0, step: 1, tooltip: "0 = NiSi, 1 = CoSi₂, 2 = TiSi₂" },
      { name: "Silicide Thickness", unit: "nm", min: 10, max: 50, default: 20, step: 5, tooltip: "Thicker → lower R but consumes more Si" },
    ],
    layerEffect: { type: "add", layer: "silicide", color: "hsl(45 80% 55%)" },
  },
  {
    id: "contact",
    name: "12. Contact & Metal Interconnect",
    category: "metal",
    description: "Deposit ILD, etch contact holes, fill with W plugs, then Cu/Al metal lines. Connects transistor to the outside world.",
    theory: "ILD: SiO₂ or low-κ. Contact: W plug with Ti/TiN barrier. Metal: Cu damascene (etch trench in ILD → fill Cu → CMP). Barrier prevents Cu diffusion into Si. Via connects metal layers.",
    params: [
      { name: "Metal Layers", unit: "", min: 1, max: 12, default: 6, step: 1, tooltip: "More layers → more routing flexibility" },
      { name: "Contact Metal", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = Tungsten, 1 = Cobalt (advanced)" },
    ],
    layerEffect: { type: "add", layer: "metal", color: "hsl(200 60% 55%)" },
  },
];

// ─── Category colors & icons ────────────────────────────────────────────
const catStyle: Record<string, { color: string; icon: string }> = {
  prep: { color: "text-chart-4", icon: "🔬" },
  oxidation: { color: "text-chart-2", icon: "🔥" },
  deposition: { color: "text-chart-3", icon: "⬇️" },
  litho: { color: "text-primary", icon: "💡" },
  etch: { color: "text-destructive", icon: "⚡" },
  implant: { color: "text-chart-4", icon: "☢️" },
  anneal: { color: "text-chart-3", icon: "🌡️" },
  metal: { color: "text-chart-2", icon: "🔗" },
};

// ─── Component ──────────────────────────────────────────────────────────
const MicroCADLab = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    processSteps.forEach(s => s.params.forEach(p => { init[`${s.id}_${p.name}`] = p.default; }));
    return init;
  });
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showTheory, setShowTheory] = useState(false);
  const [viewMode, setViewMode] = useState<"process" | "crosssection" | "summary">("process");

  const step = processSteps[currentStep];
  const getParam = (stepId: string, name: string) => params[`${stepId}_${name}`] ?? 0;
  const setParam = (stepId: string, name: string, val: number) => {
    setParams(p => ({ ...p, [`${stepId}_${name}`]: val }));
  };

  const executeStep = () => {
    setCompletedSteps(prev => new Set([...prev, step.id]));
    if (currentStep < processSteps.length - 1) {
      setCurrentStep(c => c + 1);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    const init: Record<string, number> = {};
    processSteps.forEach(s => s.params.forEach(p => { init[`${s.id}_${p.name}`] = p.default; }));
    setParams(init);
    setViewMode("process");
  };

  const allDone = completedSteps.size === processSteps.length;

  // ─── Cross-section SVG generation ──────────────────────────────────────
  const crossSection = useMemo(() => {
    const W = 600, H = 350;
    const gateX = 220, gateW = getParam("gate_litho", "Channel Length") * 0.8 + 40;
    const spacerW = getParam("spacer", "Spacer Width") * 0.6 + 5;
    const tox = getParam("gate_oxide", "Gate Oxide Thickness");
    const polyH = getParam("poly_dep", "Poly Thickness") * 0.15 + 20;
    const oxH = Math.max(3, tox * 2);
    const fieldOxH = getParam("field_oxide", "Field Oxide Thickness") * 0.04 + 10;
    const junctionDepth = getParam("sd_implant", "Junction Depth") * 0.3 + 10;
    const lddDepth = junctionDepth * 0.5;
    const silicideH = getParam("silicide", "Silicide Thickness") * 0.3 + 3;
    const isMetalGate = getParam("poly_dep", "Gate Material") === 1;
    const isHighK = getParam("gate_oxide", "Dielectric Type") === 1;

    const subY = 200;
    const layers: JSX.Element[] = [];

    // Substrate
    if (completedSteps.has("substrate")) {
      layers.push(
        <rect key="sub" x={0} y={subY} width={W} height={150} fill="hsl(var(--chart-4))" opacity={0.25} />,
        <text key="sub-lbl" x={W / 2} y={subY + 80} textAnchor="middle" fontSize="13" fill="hsl(var(--chart-4))" fontFamily="monospace" fontWeight="bold">p-Si Substrate</text>
      );
    }

    // Field oxide
    if (completedSteps.has("field_oxide")) {
      layers.push(
        <rect key="fox-l" x={20} y={subY - fieldOxH} width={gateX - 60} height={fieldOxH} fill="hsl(var(--chart-2))" opacity={0.5} rx={3} />,
        <rect key="fox-r" x={gateX + gateW + 40} y={subY - fieldOxH} width={W - gateX - gateW - 60} height={fieldOxH} fill="hsl(var(--chart-2))" opacity={0.5} rx={3} />,
        <text key="fox-lbl-l" x={gateX / 2 - 10} y={subY - fieldOxH / 2 + 4} textAnchor="middle" fontSize="10" fill="hsl(var(--chart-2))" fontFamily="monospace">STI</text>,
        <text key="fox-lbl-r" x={gateX + gateW + 40 + (W - gateX - gateW - 60) / 2} y={subY - fieldOxH / 2 + 4} textAnchor="middle" fontSize="10" fill="hsl(var(--chart-2))" fontFamily="monospace">STI</text>
      );
    }

    // S/D implant regions
    if (completedSteps.has("sd_implant")) {
      layers.push(
        <rect key="sd-s" x={gateX - spacerW - 60} y={subY} width={60 + spacerW} height={junctionDepth} fill="hsl(142 80% 40%)" opacity={0.4} rx={0} />,
        <rect key="sd-d" x={gateX + gateW} y={subY} width={60 + spacerW} height={junctionDepth} fill="hsl(142 80% 40%)" opacity={0.4} rx={0} />,
        <text key="sd-s-lbl" x={gateX - 30} y={subY + junctionDepth / 2 + 4} textAnchor="middle" fontSize="11" fill="hsl(142 80% 40%)" fontFamily="monospace" fontWeight="bold">n+ Source</text>,
        <text key="sd-d-lbl" x={gateX + gateW + 30 + spacerW} y={subY + junctionDepth / 2 + 4} textAnchor="middle" fontSize="11" fill="hsl(142 80% 40%)" fontFamily="monospace" fontWeight="bold">n+ Drain</text>
      );
    }

    // LDD regions
    if (completedSteps.has("ldd_implant")) {
      layers.push(
        <rect key="ldd-s" x={gateX} y={subY} width={15} height={lddDepth} fill="hsl(142 60% 55%)" opacity={0.35} />,
        <rect key="ldd-d" x={gateX + gateW - 15} y={subY} width={15} height={lddDepth} fill="hsl(142 60% 55%)" opacity={0.35} />,
      );
    }

    // Gate oxide
    if (completedSteps.has("gate_oxide")) {
      layers.push(
        <rect key="gox" x={gateX} y={subY - oxH} width={gateW} height={oxH}
          fill={isHighK ? "hsl(213 80% 55%)" : "hsl(213 80% 70%)"} opacity={0.6} />,
        <text key="gox-lbl" x={gateX + gateW / 2} y={subY - oxH / 2 + 3} textAnchor="middle" fontSize="9"
          fill={isHighK ? "hsl(213 80% 55%)" : "hsl(213 80% 70%)"} fontFamily="monospace">
          {isHighK ? `HfO₂ ${tox}nm` : `SiO₂ ${tox}nm`}
        </text>
      );
    }

    // Polysilicon / Metal gate
    if (completedSteps.has("poly_dep") && completedSteps.has("gate_etch")) {
      const gateColor = isMetalGate ? "hsl(200 50% 45%)" : "hsl(var(--chart-3))";
      const gateLabel = isMetalGate ? "Metal Gate" : "Poly-Si";
      layers.push(
        <rect key="gate" x={gateX} y={subY - oxH - polyH} width={gateW} height={polyH}
          fill={gateColor} opacity={0.7} rx={2} />,
        <text key="gate-lbl" x={gateX + gateW / 2} y={subY - oxH - polyH / 2 + 4} textAnchor="middle"
          fontSize="12" fill={gateColor} fontFamily="monospace" fontWeight="bold">{gateLabel}</text>,
      );
    } else if (completedSteps.has("poly_dep")) {
      // Unpatterned poly (full width)
      const gateColor = isMetalGate ? "hsl(200 50% 45%)" : "hsl(var(--chart-3))";
      layers.push(
        <rect key="gate-full" x={20} y={subY - oxH - polyH} width={W - 40} height={polyH}
          fill={gateColor} opacity={0.4} rx={2} />,
        <text key="gate-full-lbl" x={W / 2} y={subY - oxH - polyH / 2 + 4} textAnchor="middle"
          fontSize="12" fill={gateColor} fontFamily="monospace">Blanket Poly (unpatterned)</text>,
      );
    }

    // Photoresist (during litho, before etch)
    if (completedSteps.has("gate_litho") && !completedSteps.has("gate_etch")) {
      layers.push(
        <rect key="pr-l" x={20} y={subY - oxH - polyH - 15} width={gateX - 20} height={15}
          fill="hsl(0 70% 60%)" opacity={0.6} rx={2} />,
        <rect key="pr-r" x={gateX + gateW} y={subY - oxH - polyH - 15} width={W - gateX - gateW - 20} height={15}
          fill="hsl(0 70% 60%)" opacity={0.6} rx={2} />,
        <text key="pr-lbl" x={W / 2} y={subY - oxH - polyH - 5} textAnchor="middle"
          fontSize="10" fill="hsl(0 70% 60%)" fontFamily="monospace">Photoresist Mask</text>,
      );
    }

    // Spacers
    if (completedSteps.has("spacer") && completedSteps.has("gate_etch")) {
      layers.push(
        <polygon key="sp-l" points={`${gateX},${subY} ${gateX - spacerW},${subY} ${gateX},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.5} />,
        <polygon key="sp-r" points={`${gateX + gateW},${subY} ${gateX + gateW + spacerW},${subY} ${gateX + gateW},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.5} />,
      );
    }

    // Silicide
    if (completedSteps.has("silicide") && completedSteps.has("gate_etch")) {
      layers.push(
        <rect key="sil-g" x={gateX + 2} y={subY - oxH - polyH - silicideH} width={gateW - 4} height={silicideH}
          fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-s" x={gateX - spacerW - 50} y={subY - silicideH} width={50} height={silicideH}
          fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-d" x={gateX + gateW + spacerW} y={subY - silicideH} width={50} height={silicideH}
          fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
      );
    }

    // Contacts & metal
    if (completedSteps.has("contact")) {
      const metalY = subY - oxH - polyH - silicideH - 40;
      layers.push(
        <rect key="ild" x={10} y={metalY} width={W - 20} height={subY - metalY} fill="hsl(var(--muted))" opacity={0.15} rx={3} />,
        // Contact plugs
        <rect key="ct-s" x={gateX - 30} y={metalY + 10} width={12} height={subY - metalY - 10} fill="hsl(200 60% 55%)" opacity={0.7} rx={1} />,
        <rect key="ct-d" x={gateX + gateW + spacerW + 10} y={metalY + 10} width={12} height={subY - metalY - 10} fill="hsl(200 60% 55%)" opacity={0.7} rx={1} />,
        <rect key="ct-g" x={gateX + gateW / 2 - 6} y={metalY + 10} width={12} height={subY - oxH - polyH - silicideH - metalY - 10} fill="hsl(200 60% 55%)" opacity={0.7} rx={1} />,
        // Metal lines
        <rect key="m1-s" x={gateX - 60} y={metalY} width={70} height={8} fill="hsl(200 60% 55%)" opacity={0.8} rx={2} />,
        <rect key="m1-d" x={gateX + gateW + spacerW - 10} y={metalY} width={70} height={8} fill="hsl(200 60% 55%)" opacity={0.8} rx={2} />,
        <rect key="m1-g" x={gateX + gateW / 2 - 30} y={metalY - 15} width={60} height={8} fill="hsl(200 60% 55%)" opacity={0.8} rx={2} />,
        // Labels
        <text key="m-s" x={gateX - 25} y={metalY - 4} textAnchor="middle" fontSize="10" fill="hsl(200 60% 55%)" fontFamily="monospace" fontWeight="bold">S</text>,
        <text key="m-g" x={gateX + gateW / 2} y={metalY - 22} textAnchor="middle" fontSize="10" fill="hsl(200 60% 55%)" fontFamily="monospace" fontWeight="bold">G</text>,
        <text key="m-d" x={gateX + gateW + spacerW + 25} y={metalY - 4} textAnchor="middle" fontSize="10" fill="hsl(200 60% 55%)" fontFamily="monospace" fontWeight="bold">D</text>,
      );
    }

    // Channel inversion layer hint
    if (completedSteps.has("gate_oxide") && completedSteps.has("gate_etch")) {
      layers.push(
        <line key="channel" x1={gateX + 3} y1={subY} x2={gateX + gateW - 3} y2={subY}
          stroke="hsl(var(--primary))" strokeWidth={2.5} strokeDasharray="4 3" opacity={0.7} />,
        <text key="ch-lbl" x={gateX + gateW / 2} y={subY + 14} textAnchor="middle" fontSize="9"
          fill="hsl(var(--primary))" fontFamily="monospace">channel</text>,
      );
    }

    // Dimension annotations
    if (completedSteps.has("gate_litho")) {
      const Lch = getParam("gate_litho", "Channel Length");
      const aY = subY - oxH - polyH - (completedSteps.has("silicide") ? silicideH : 0) - 25;
      layers.push(
        <line key="dim-l" x1={gateX} y1={aY} x2={gateX + gateW} y2={aY} stroke="hsl(var(--foreground))" strokeWidth={0.8} markerStart="url(#arrow)" markerEnd="url(#arrow)" />,
        <text key="dim-lbl" x={gateX + gateW / 2} y={aY - 5} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">L = {Lch}nm</text>,
      );
    }

    return { layers, W, H };
  }, [completedSteps, params]);

  // ─── Device metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!allDone) return null;
    const Lch = getParam("gate_litho", "Channel Length");
    const tox = getParam("gate_oxide", "Gate Oxide Thickness");
    const isHighK = getParam("gate_oxide", "Dielectric Type") === 1;
    const Nsub = getParam("substrate", "Substrate Doping (×10¹⁵)") * 1e15;
    const jd = getParam("sd_implant", "Junction Depth");

    const epsOx = 3.9 * 8.854e-12;
    const kHighK = 25;
    const eps = isHighK ? kHighK * 8.854e-12 : epsOx;
    const Cox = eps / (tox * 1e-9);
    const EOT = isHighK ? tox * 3.9 / kHighK : tox;
    const Vth = 0.4 + 0.03 * Math.log10(Nsub / 1e15) + (Lch < 45 ? 0.08 * (45 / Lch - 1) : 0);
    const leakage = tox < 2 && !isHighK ? "HIGH" : tox < 1.5 ? "CRITICAL" : "Low";
    const sce = Lch < 3 * jd ? "SEVERE" : Lch < 5 * jd ? "Moderate" : "Minimal";

    let yieldScore = 100;
    if (tox < 1.5 && !isHighK) yieldScore -= 20;
    if (Lch < 20) yieldScore -= 10;
    if (jd > Lch * 0.3) yieldScore -= 15;
    const etchSel = getParam("gate_etch", "Etch Selectivity");
    if (etchSel < 20) yieldScore -= 10;
    const sidewall = getParam("gate_etch", "Sidewall Angle");
    if (sidewall < 85) yieldScore -= 10;
    yieldScore = Math.max(0, Math.min(100, yieldScore));

    return { Lch, tox, EOT, Cox, Vth, leakage, sce, yieldScore, isHighK, jd };
  }, [allDone, params]);

  return (
    <div className="space-y-6">
      {/* View mode tabs */}
      <div className="flex gap-2">
        {([
          { id: "process" as const, label: "Process Steps", icon: <Layers size={16} /> },
          { id: "crosssection" as const, label: "Cross-Section View", icon: <Eye size={16} /> },
          ...(allDone ? [{ id: "summary" as const, label: "Device Summary", icon: <Zap size={16} /> }] : []),
        ]).map(t => (
          <button key={t.id} onClick={() => setViewMode(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
              viewMode === t.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {processSteps.map((s, i) => {
          const done = completedSteps.has(s.id);
          const active = i === currentStep && !allDone;
          const cat = catStyle[s.category];
          return (
            <button key={s.id} onClick={() => { if (done || i === currentStep) setCurrentStep(i); }}
              className={cn("shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-mono transition-all border",
                done ? "bg-primary/10 border-primary/30 text-primary" :
                active ? "bg-chart-2/10 border-chart-2/40 text-chart-2" :
                "border-transparent text-muted-foreground/50"
              )}>
              <span>{cat.icon}</span>
              <span className="hidden md:inline">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════ CROSS-SECTION VIEW ═══════ */}
      {viewMode === "crosssection" && (
        <div className="p-6 rounded-xl bg-card border border-border animate-fade-in">
          <h3 className="text-base font-semibold text-foreground mb-4 font-mono flex items-center gap-2">
            <Eye size={18} className="text-primary" /> MOSFET Cross-Section — {completedSteps.size}/{processSteps.length} steps done
          </h3>
          <div className="bg-background rounded-lg p-4 border border-border overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${crossSection.W} ${crossSection.H}`} className="min-w-[500px]">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--foreground))" />
                </marker>
              </defs>
              {crossSection.layers}
              {completedSteps.size === 0 && (
                <text x={crossSection.W / 2} y={crossSection.H / 2} textAnchor="middle" fontSize="14"
                  fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  Complete process steps to build the MOSFET →
                </text>
              )}
            </svg>
          </div>
          {/* Layer legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-mono">
            {[
              { color: "hsl(var(--chart-4))", label: "p-Si Substrate" },
              { color: "hsl(var(--chart-2))", label: "SiO₂ / STI" },
              { color: "hsl(213 80% 70%)", label: "Gate Dielectric" },
              { color: "hsl(var(--chart-3))", label: "Poly / Metal Gate" },
              { color: "hsl(142 80% 40%)", label: "n+ S/D" },
              { color: "hsl(280 50% 55%)", label: "Spacer (Si₃N₄)" },
              { color: "hsl(45 80% 55%)", label: "Silicide" },
              { color: "hsl(200 60% 55%)", label: "Metal / Contact" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color, opacity: 0.7 }} />
                <span className="text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ PROCESS STEP VIEW ═══════ */}
      {viewMode === "process" && !allDone && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in">
          {/* Step card */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border space-y-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{catStyle[step.category].icon}</span>
              <div className="flex-1">
                <div className="text-lg font-bold text-foreground">{step.name}</div>
                <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                <span className={cn("inline-block mt-2 px-2 py-0.5 rounded text-xs font-mono border",
                  catStyle[step.category].color, "border-current/20 bg-current/5"
                )}>{step.category.toUpperCase()}</span>
              </div>
              <div className="text-sm font-mono text-muted-foreground">{currentStep + 1}/{processSteps.length}</div>
            </div>

            {/* Theory toggle */}
            <button onClick={() => setShowTheory(!showTheory)}
              className="flex items-center gap-2 text-sm text-primary hover:underline font-mono">
              <Info size={14} /> {showTheory ? "Hide" : "Show"} Theory & Details
            </button>
            {showTheory && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground leading-relaxed animate-fade-in">
                {step.theory}
              </div>
            )}

            {/* Parameters */}
            <div className="space-y-4">
              {step.params.map(p => {
                const key = `${step.id}_${p.name}`;
                const val = params[key] ?? p.default;
                const isToggle = p.min === 0 && p.max <= 2 && p.step === 1 && !p.unit;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-foreground">{p.name} {p.unit && <span className="text-muted-foreground">({p.unit})</span>}</Label>
                      <span className="text-sm font-mono text-primary font-bold">
                        {isToggle ? (
                          p.max === 1 ? (val === 0 ? "Option A" : "Option B") : ["A", "B", "C"][val]
                        ) : val}
                      </span>
                    </div>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                      onChange={e => setParam(step.id, p.name, parseFloat(e.target.value))}
                      className="w-full accent-[hsl(var(--primary))]" />
                    <div className="text-xs text-muted-foreground">{p.tooltip}</div>
                  </div>
                );
              })}
            </div>

            {/* Execute */}
            <div className="flex gap-3">
              <Button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} variant="outline" disabled={currentStep === 0}
                className="font-mono"><ChevronLeft size={16} /> Prev</Button>
              <Button onClick={executeStep} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-base">
                <Play size={16} /> Execute: {step.name.split(".")[0]}...
              </Button>
            </div>
          </div>

          {/* Live cross-section preview */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-mono text-muted-foreground mb-3 flex items-center gap-2">
              <Eye size={14} /> LIVE CROSS-SECTION PREVIEW
            </h3>
            <div className="bg-background rounded-lg p-3 border border-border">
              <svg width="100%" viewBox={`0 0 ${crossSection.W} ${crossSection.H}`}>
                <defs>
                  <marker id="arrow2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--foreground))" />
                  </marker>
                </defs>
                {crossSection.layers}
                {completedSteps.size === 0 && (
                  <text x={crossSection.W / 2} y={crossSection.H / 2} textAnchor="middle" fontSize="13"
                    fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                    Execute Step 1 to begin →
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ ALL DONE — PROCESS VIEW ═══════ */}
      {viewMode === "process" && allDone && (
        <div className="p-6 rounded-xl bg-card border border-primary/30 text-center space-y-4 animate-fade-in">
          <div className="text-3xl">🏭</div>
          <h3 className="text-xl font-bold text-foreground">MOSFET Fabrication Complete!</h3>
          <p className="text-muted-foreground">All 12 process steps executed. View the cross-section or device summary.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setViewMode("crosssection")} variant="outline" className="font-mono">
              <Eye size={16} /> View Cross-Section
            </Button>
            <Button onClick={() => setViewMode("summary")} className="bg-primary text-primary-foreground font-mono">
              <Zap size={16} /> Device Summary
            </Button>
            <Button onClick={reset} variant="outline" className="font-mono text-muted-foreground">
              <RotateCcw size={16} /> Restart
            </Button>
          </div>
        </div>
      )}

      {/* ═══════ DEVICE SUMMARY ═══════ */}
      {viewMode === "summary" && metrics && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Channel Length", value: `${metrics.Lch} nm`, color: "text-primary" },
              { label: "EOT", value: `${metrics.EOT.toFixed(2)} nm`, color: "text-chart-2" },
              { label: "Threshold V", value: `${metrics.Vth.toFixed(3)} V`, color: "text-chart-3" },
              { label: "Cox", value: `${(metrics.Cox * 1e6).toFixed(2)} μF/cm²`, color: "text-chart-4" },
              { label: "Gate Dielectric", value: metrics.isHighK ? "HfO₂ (High-κ)" : "SiO₂", color: "text-primary" },
              { label: "Gate Leakage", value: metrics.leakage, color: metrics.leakage === "Low" ? "text-primary" : "text-destructive" },
              { label: "SCE Severity", value: metrics.sce, color: metrics.sce === "Minimal" ? "text-primary" : metrics.sce === "Moderate" ? "text-chart-3" : "text-destructive" },
              { label: "Process Yield", value: `${metrics.yieldScore}%`, color: metrics.yieldScore >= 80 ? "text-primary" : "text-destructive" },
            ].map(m => (
              <div key={m.label} className="p-4 rounded-xl bg-card border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{m.label}</div>
                <div className={cn("text-xl font-mono font-bold", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Yield bar */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono text-muted-foreground">PROCESS YIELD SCORE</span>
              <span className={cn("text-lg font-mono font-bold",
                metrics.yieldScore >= 80 ? "text-primary" : metrics.yieldScore >= 60 ? "text-chart-3" : "text-destructive"
              )}>{metrics.yieldScore}%</span>
            </div>
            <div className="w-full h-4 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-700",
                metrics.yieldScore >= 80 ? "bg-primary" : metrics.yieldScore >= 60 ? "bg-chart-3" : "bg-destructive"
              )} style={{ width: `${metrics.yieldScore}%` }} />
            </div>
            <div className={cn("mt-2 flex items-center gap-2 text-sm",
              metrics.yieldScore >= 80 ? "text-primary" : "text-chart-3"
            )}>
              {metrics.yieldScore >= 80 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {metrics.yieldScore >= 80 ? "Production-ready process" : "Process needs optimization — review parameter choices"}
            </div>
          </div>

          {/* Design rules & tips */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <h3 className="text-sm font-mono text-muted-foreground mb-3 uppercase">DESIGN RULE CHECKS</h3>
            <div className="space-y-2 text-sm">
              {[
                { rule: `Junction depth (${metrics.jd}nm) < L/3 (${(metrics.Lch / 3).toFixed(0)}nm)`, pass: metrics.jd < metrics.Lch / 3 },
                { rule: `Gate oxide ${metrics.tox}nm ${metrics.isHighK ? "(High-κ)" : ""} — leakage: ${metrics.leakage}`, pass: metrics.leakage === "Low" },
                { rule: `SCE: ${metrics.sce} at L=${metrics.Lch}nm`, pass: metrics.sce === "Minimal" },
                { rule: `EOT = ${metrics.EOT.toFixed(2)}nm — ${metrics.EOT < 1 ? "aggressive" : metrics.EOT < 3 ? "standard" : "conservative"}`, pass: metrics.EOT < 5 },
              ].map((r, i) => (
                <div key={i} className={cn("flex items-center gap-2 p-2 rounded-lg",
                  r.pass ? "text-primary bg-primary/5" : "text-destructive bg-destructive/5"
                )}>
                  {r.pass ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  <span className="font-mono">{r.rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => setViewMode("crosssection")} variant="outline" className="font-mono">
              <Eye size={16} /> View Cross-Section
            </Button>
            <Button onClick={reset} variant="outline" className="font-mono text-muted-foreground">
              <RotateCcw size={16} /> Redesign from Scratch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MicroCADLab;

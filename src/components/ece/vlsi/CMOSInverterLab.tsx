import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Play, RotateCcw, Eye, Zap, ChevronRight, ChevronLeft,
  Info, CheckCircle, AlertTriangle, Layers
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────
interface CMOSStep {
  id: string;
  name: string;
  category: string;
  description: string;
  theory: string;
  params: { name: string; unit: string; min: number; max: number; default: number; step: number; tooltip: string }[];
}

// ─── CMOS Inverter Fabrication Steps ────────────────────────────────────
const cmosSteps: CMOSStep[] = [
  {
    id: "substrate", name: "1. P-Substrate Preparation", category: "prep",
    description: "Start with a lightly-doped p-type silicon substrate. This serves as the body for the NMOS transistor and the base for the n-well.",
    theory: "Boron-doped <100> wafer at ~10¹⁵ cm⁻³. Lightly doped to allow both n-well formation (for PMOS) and p-channel operation (for NMOS).",
    params: [
      { name: "Substrate Doping (×10¹⁵)", unit: "cm⁻³", min: 1, max: 100, default: 10, step: 5, tooltip: "Light p-type doping for the base wafer" },
    ],
  },
  {
    id: "nwell", name: "2. N-Well Formation", category: "implant",
    description: "Create n-well region for the PMOS transistor. Phosphorus implant followed by drive-in diffusion defines the PMOS body.",
    theory: "Twin-tub or retrograde n-well. Phosphorus implant at 150-400 keV, dose ~10¹³ cm⁻². Drive-in at 1100°C for 4-8 hours. Well depth ~2-4 μm. The n-well doping (~10¹⁷) must exceed substrate doping to form the junction.",
    params: [
      { name: "Well Doping (×10¹⁷)", unit: "cm⁻³", min: 0.5, max: 10, default: 3, step: 0.5, tooltip: "Higher doping → higher |Vtp| and better latch-up immunity" },
      { name: "Well Depth", unit: "μm", min: 1, max: 5, default: 3, step: 0.5, tooltip: "Deeper well → better isolation but more lateral spread" },
    ],
  },
  {
    id: "sti", name: "3. Shallow Trench Isolation (STI)", category: "oxidation",
    description: "Isolate NMOS and PMOS active areas with oxide-filled trenches. Prevents current leakage between adjacent transistors.",
    theory: "Trench etched into silicon → thermal liner oxide → TEOS/HDP oxide fill → CMP planarization. Replaces LOCOS to eliminate bird's beak. Critical for preventing latch-up in CMOS by isolating n-well/p-sub junction.",
    params: [
      { name: "Trench Depth", unit: "nm", min: 200, max: 600, default: 350, step: 50, tooltip: "Deeper trench → better isolation" },
      { name: "STI Width", unit: "nm", min: 50, max: 300, default: 150, step: 25, tooltip: "Wider → better isolation but uses more area" },
    ],
  },
  {
    id: "gate_ox", name: "4. Gate Oxide Growth", category: "oxidation",
    description: "Grow thin gate dielectric simultaneously over both NMOS and PMOS active regions. Identical oxide ensures matched transistor characteristics.",
    theory: "Dry oxidation at 800-900°C. For advanced nodes, SiO₂ replaced by HfO₂ (High-κ) with interfacial SiO₂ layer. Both NMOS and PMOS share the same oxide thickness for symmetry.",
    params: [
      { name: "Oxide Thickness", unit: "nm", min: 0.8, max: 10, default: 2, step: 0.2, tooltip: "Same oxide for both NMOS and PMOS" },
      { name: "Dielectric Type", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = SiO₂, 1 = HfO₂ (High-κ)" },
    ],
  },
  {
    id: "poly_gate", name: "5. Gate Deposition & Patterning", category: "deposition",
    description: "Deposit polysilicon (or metal), pattern two gate electrodes — one over NMOS channel, one over PMOS channel. They are electrically connected as the inverter input (Vin).",
    theory: "Dual work-function metal gates: n+ poly/TiN for NMOS (mid-gap or n-type WF), p+ poly/TiAl for PMOS (p-type WF). Connected input allows complementary switching. Gate length defines speed.",
    params: [
      { name: "Gate Length", unit: "nm", min: 7, max: 250, default: 45, step: 5, tooltip: "Channel length for both transistors" },
      { name: "Gate Material", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = Poly-Si, 1 = Metal Gate" },
    ],
  },
  {
    id: "nmos_sd", name: "6. NMOS Source/Drain (n+ Implant)", category: "implant",
    description: "Implant n+ dopants (Arsenic/Phosphorus) into the p-substrate on both sides of the NMOS gate. PMOS region is masked with photoresist.",
    theory: "Arsenic 40-80 keV, dose ~5×10¹⁵ cm⁻². Self-aligned to NMOS gate. The PMOS active area is protected by photoresist during this step. LDD implant before spacer formation reduces hot carrier effects.",
    params: [
      { name: "N+ Junction Depth", unit: "nm", min: 10, max: 150, default: 50, step: 10, tooltip: "Shallow junctions reduce SCE" },
      { name: "LDD Dose (×10¹³)", unit: "cm⁻²", min: 0.5, max: 5, default: 2, step: 0.5, tooltip: "LDD reduces hot carrier injection" },
    ],
  },
  {
    id: "pmos_sd", name: "7. PMOS Source/Drain (p+ Implant)", category: "implant",
    description: "Implant p+ dopants (Boron/BF₂) into the n-well on both sides of the PMOS gate. NMOS region is masked.",
    theory: "BF₂ at 20-40 keV, dose ~3×10¹⁵ cm⁻². Boron diffuses faster than Arsenic, so lower energy and BF₂ (heavier ion) used for shallower junctions. Complementary to NMOS n+ implant.",
    params: [
      { name: "P+ Junction Depth", unit: "nm", min: 10, max: 150, default: 50, step: 10, tooltip: "Should match NMOS depth for symmetry" },
      { name: "Well Contact Doping", unit: "", min: 0, max: 1, default: 1, step: 1, tooltip: "0 = no tap, 1 = add well/substrate taps (latch-up prevention)" },
    ],
  },
  {
    id: "spacer", name: "8. Spacer Formation", category: "deposition",
    description: "Deposit and etch Si₃N₄ spacers on both gate sidewalls. Spacers offset heavy S/D implant from gate edge.",
    theory: "Blanket Si₃N₄ deposition → anisotropic etch. Spacer width controls LDD-to-HDD offset. Both gates get spacers simultaneously in CMOS.",
    params: [
      { name: "Spacer Width", unit: "nm", min: 5, max: 40, default: 15, step: 5, tooltip: "Offset distance for S/D implant" },
    ],
  },
  {
    id: "silicide", name: "9. Silicide (Self-Aligned)", category: "metal",
    description: "Form NiSi/CoSi₂ on all exposed silicon — gates, sources, drains. Reduces contact and sheet resistance.",
    theory: "Salicide process: Ni deposition → RTA1 (Ni₂Si) → selective etch unreacted Ni on spacers/STI → RTA2 (NiSi). All four S/D contacts + both gates get silicide simultaneously.",
    params: [
      { name: "Silicide Type", unit: "", min: 0, max: 1, default: 0, step: 1, tooltip: "0 = NiSi, 1 = CoSi₂" },
    ],
  },
  {
    id: "contact", name: "10. Contact & Metal Interconnect", category: "metal",
    description: "Deposit ILD, etch contact holes to all terminals, fill with W plugs. Wire the CMOS inverter: connect drains (Vout), PMOS source to VDD, NMOS source to GND, gates together (Vin).",
    theory: "CMOS inverter wiring: Input (Vin) → both gates. Output (Vout) → NMOS drain + PMOS drain. VDD → PMOS source. GND → NMOS source. N-well tied to VDD, p-sub tied to GND (body ties prevent latch-up).",
    params: [
      { name: "Metal Layers", unit: "", min: 1, max: 8, default: 4, step: 1, tooltip: "More layers for complex routing" },
    ],
  },
];

const catStyle: Record<string, { color: string; icon: string }> = {
  prep: { color: "text-chart-4", icon: "🔬" },
  oxidation: { color: "text-chart-2", icon: "🔥" },
  deposition: { color: "text-chart-3", icon: "⬇️" },
  implant: { color: "text-chart-4", icon: "☢️" },
  metal: { color: "text-chart-2", icon: "🔗" },
};

// ─── Component ──────────────────────────────────────────────────────────
const CMOSInverterLab = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    cmosSteps.forEach(s => s.params.forEach(p => { init[`${s.id}_${p.name}`] = p.default; }));
    return init;
  });
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showTheory, setShowTheory] = useState(false);
  const [viewMode, setViewMode] = useState<"process" | "crosssection" | "vtc">("process");

  const step = cmosSteps[currentStep];
  const getP = (sid: string, name: string) => params[`${sid}_${name}`] ?? 0;
  const setP = (sid: string, name: string, val: number) => setParams(p => ({ ...p, [`${sid}_${name}`]: val }));
  const allDone = completedSteps.size === cmosSteps.length;

  const executeStep = () => {
    setCompletedSteps(prev => new Set([...prev, step.id]));
    if (currentStep < cmosSteps.length - 1) setCurrentStep(c => c + 1);
  };
  const reset = () => {
    setCurrentStep(0); setCompletedSteps(new Set()); setViewMode("process");
    const init: Record<string, number> = {};
    cmosSteps.forEach(s => s.params.forEach(p => { init[`${s.id}_${p.name}`] = p.default; }));
    setParams(init);
  };

  // ─── CMOS Cross-Section SVG ─────────────────────────────────────────
  const crossSection = useMemo(() => {
    const W = 800, H = 420;
    const layers: JSX.Element[] = [];
    const subY = 260; // substrate top line
    const subH = 140;
    const nmosX = 80; // NMOS region center-ish
    const pmosX = 480; // PMOS region center-ish
    const stiX = 290; // STI between them
    const stiW = getP("sti", "STI Width") * 0.5 + 30;
    const wellDepth = getP("nwell", "Well Depth") * 30 + 20;
    const gateL = getP("poly_gate", "Gate Length") * 0.7 + 30;
    const tox = getP("gate_ox", "Oxide Thickness");
    const oxH = Math.max(3, tox * 2.5);
    const polyH = 30;
    const spacerW = getP("spacer", "Spacer Width") * 0.5 + 4;
    const nJD = getP("nmos_sd", "N+ Junction Depth") * 0.3 + 8;
    const pJD = getP("pmos_sd", "P+ Junction Depth") * 0.3 + 8;
    const isHighK = getP("gate_ox", "Dielectric Type") === 1;
    const isMetalGate = getP("poly_gate", "Gate Material") === 1;
    const hasTaps = getP("pmos_sd", "Well Contact Doping") === 1;
    const stiH = getP("sti", "Trench Depth") * 0.08 + 15;

    // P-Substrate (full width)
    if (completedSteps.has("substrate")) {
      layers.push(
        <rect key="psub" x={0} y={subY} width={W} height={subH} fill="hsl(var(--chart-4))" opacity={0.2} />,
        <text key="psub-lbl" x={40} y={subY + subH - 15} fontSize="12" fill="hsl(var(--chart-4))" fontFamily="monospace" fontWeight="bold" opacity={0.7}>p-Substrate</text>
      );
    }

    // N-Well (right side for PMOS)
    if (completedSteps.has("nwell")) {
      const nwX = stiX + stiW / 2 - 10;
      const nwW = W - nwX - 20;
      layers.push(
        <rect key="nwell" x={nwX} y={subY - 5} width={nwW} height={Math.min(wellDepth, subH + 5)}
          fill="hsl(200 70% 55%)" opacity={0.15} rx={6}
          stroke="hsl(200 70% 55%)" strokeWidth={1.5} strokeDasharray="6 3" />,
        <text key="nwell-lbl" x={nwX + nwW / 2} y={subY + Math.min(wellDepth, subH) - 12}
          textAnchor="middle" fontSize="12" fill="hsl(200 70% 55%)" fontFamily="monospace" fontWeight="bold" opacity={0.8}>N-Well</text>
      );
    }

    // STI (isolation between NMOS and PMOS)
    if (completedSteps.has("sti")) {
      layers.push(
        <rect key="sti" x={stiX} y={subY - stiH} width={stiW} height={stiH + 5}
          fill="hsl(var(--chart-2))" opacity={0.45} rx={2} />,
        <text key="sti-lbl" x={stiX + stiW / 2} y={subY - stiH / 2 + 4}
          textAnchor="middle" fontSize="10" fill="hsl(var(--chart-2))" fontFamily="monospace">STI</text>,
        // Outer STI
        <rect key="sti-l" x={10} y={subY - stiH} width={35} height={stiH + 5}
          fill="hsl(var(--chart-2))" opacity={0.35} rx={2} />,
        <rect key="sti-r" x={W - 45} y={subY - stiH} width={35} height={stiH + 5}
          fill="hsl(var(--chart-2))" opacity={0.35} rx={2} />,
      );
    }

    // ─── NMOS (left side, in p-substrate) ───
    const nmosGateX = nmosX + 50;

    // NMOS n+ S/D
    if (completedSteps.has("nmos_sd")) {
      layers.push(
        <rect key="nsd-s" x={nmosGateX - spacerW - 55} y={subY} width={55 + spacerW} height={nJD}
          fill="hsl(142 80% 40%)" opacity={0.4} />,
        <rect key="nsd-d" x={nmosGateX + gateL} y={subY} width={55 + spacerW} height={nJD}
          fill="hsl(142 80% 40%)" opacity={0.4} />,
        <text key="ns-lbl" x={nmosGateX - 30} y={subY + nJD / 2 + 4} textAnchor="middle" fontSize="10"
          fill="hsl(142 80% 40%)" fontFamily="monospace" fontWeight="bold">n+</text>,
        <text key="nd-lbl" x={nmosGateX + gateL + 30 + spacerW} y={subY + nJD / 2 + 4} textAnchor="middle" fontSize="10"
          fill="hsl(142 80% 40%)" fontFamily="monospace" fontWeight="bold">n+</text>,
      );
    }

    // NMOS gate oxide
    if (completedSteps.has("gate_ox")) {
      layers.push(
        <rect key="ngox" x={nmosGateX} y={subY - oxH} width={gateL} height={oxH}
          fill={isHighK ? "hsl(213 80% 55%)" : "hsl(213 80% 70%)"} opacity={0.6} />,
      );
    }

    // NMOS gate
    if (completedSteps.has("poly_gate")) {
      const gc = isMetalGate ? "hsl(200 50% 45%)" : "hsl(var(--chart-3))";
      layers.push(
        <rect key="ngate" x={nmosGateX} y={subY - oxH - polyH} width={gateL} height={polyH}
          fill={gc} opacity={0.7} rx={2} />,
        <text key="ngate-lbl" x={nmosGateX + gateL / 2} y={subY - oxH - polyH / 2 + 4}
          textAnchor="middle" fontSize="11" fill={gc} fontFamily="monospace" fontWeight="bold">
          {isMetalGate ? "TiN" : "n+ Poly"}
        </text>,
      );
    }

    // NMOS spacers
    if (completedSteps.has("spacer") && completedSteps.has("poly_gate")) {
      layers.push(
        <polygon key="nsp-l" points={`${nmosGateX},${subY} ${nmosGateX - spacerW},${subY} ${nmosGateX},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.4} />,
        <polygon key="nsp-r" points={`${nmosGateX + gateL},${subY} ${nmosGateX + gateL + spacerW},${subY} ${nmosGateX + gateL},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.4} />,
      );
    }

    // NMOS channel
    if (completedSteps.has("gate_ox") && completedSteps.has("poly_gate")) {
      layers.push(
        <line key="nch" x1={nmosGateX + 3} y1={subY} x2={nmosGateX + gateL - 3} y2={subY}
          stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="3 2" opacity={0.6} />,
      );
    }

    // ─── PMOS (right side, in n-well) ───
    const pmosGateX = pmosX + 50;

    // PMOS p+ S/D
    if (completedSteps.has("pmos_sd")) {
      layers.push(
        <rect key="psd-s" x={pmosGateX - spacerW - 55} y={subY} width={55 + spacerW} height={pJD}
          fill="hsl(340 70% 55%)" opacity={0.4} />,
        <rect key="psd-d" x={pmosGateX + gateL} y={subY} width={55 + spacerW} height={pJD}
          fill="hsl(340 70% 55%)" opacity={0.4} />,
        <text key="ps-lbl" x={pmosGateX - 30} y={subY + pJD / 2 + 4} textAnchor="middle" fontSize="10"
          fill="hsl(340 70% 55%)" fontFamily="monospace" fontWeight="bold">p+</text>,
        <text key="pd-lbl" x={pmosGateX + gateL + 30 + spacerW} y={subY + pJD / 2 + 4} textAnchor="middle" fontSize="10"
          fill="hsl(340 70% 55%)" fontFamily="monospace" fontWeight="bold">p+</text>,
      );
    }

    // PMOS gate oxide
    if (completedSteps.has("gate_ox")) {
      layers.push(
        <rect key="pgox" x={pmosGateX} y={subY - oxH} width={gateL} height={oxH}
          fill={isHighK ? "hsl(213 80% 55%)" : "hsl(213 80% 70%)"} opacity={0.6} />,
      );
    }

    // PMOS gate
    if (completedSteps.has("poly_gate")) {
      const gc = isMetalGate ? "hsl(200 50% 45%)" : "hsl(var(--chart-3))";
      layers.push(
        <rect key="pgate" x={pmosGateX} y={subY - oxH - polyH} width={gateL} height={polyH}
          fill={gc} opacity={0.7} rx={2} />,
        <text key="pgate-lbl" x={pmosGateX + gateL / 2} y={subY - oxH - polyH / 2 + 4}
          textAnchor="middle" fontSize="11" fill={gc} fontFamily="monospace" fontWeight="bold">
          {isMetalGate ? "TiAl" : "p+ Poly"}
        </text>,
      );
    }

    // PMOS spacers
    if (completedSteps.has("spacer") && completedSteps.has("poly_gate")) {
      layers.push(
        <polygon key="psp-l" points={`${pmosGateX},${subY} ${pmosGateX - spacerW},${subY} ${pmosGateX},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.4} />,
        <polygon key="psp-r" points={`${pmosGateX + gateL},${subY} ${pmosGateX + gateL + spacerW},${subY} ${pmosGateX + gateL},${subY - oxH - polyH}`}
          fill="hsl(280 50% 55%)" opacity={0.4} />,
      );
    }

    // PMOS channel
    if (completedSteps.has("gate_ox") && completedSteps.has("poly_gate")) {
      layers.push(
        <line key="pch" x1={pmosGateX + 3} y1={subY} x2={pmosGateX + gateL - 3} y2={subY}
          stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="3 2" opacity={0.6} />,
      );
    }

    // Silicide on all gates and S/D
    if (completedSteps.has("silicide")) {
      const silH = 5;
      layers.push(
        // NMOS
        <rect key="sil-ng" x={nmosGateX + 2} y={subY - oxH - polyH - silH} width={gateL - 4} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-ns" x={nmosGateX - spacerW - 45} y={subY - silH} width={40} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-nd" x={nmosGateX + gateL + spacerW + 5} y={subY - silH} width={40} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        // PMOS
        <rect key="sil-pg" x={pmosGateX + 2} y={subY - oxH - polyH - silH} width={gateL - 4} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-ps" x={pmosGateX - spacerW - 45} y={subY - silH} width={40} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
        <rect key="sil-pd" x={pmosGateX + gateL + spacerW + 5} y={subY - silH} width={40} height={silH} fill="hsl(45 80% 55%)" opacity={0.7} rx={1} />,
      );
    }

    // Contacts & Metal wiring
    if (completedSteps.has("contact")) {
      const mY = subY - oxH - polyH - 70;
      const contactW = 8;

      // ILD fill
      layers.push(
        <rect key="ild" x={5} y={mY - 10} width={W - 10} height={subY - mY + 10} fill="hsl(var(--muted))" opacity={0.1} rx={3} />,
      );

      // Contact plugs (W plugs)
      const plugColor = "hsl(200 60% 55%)";
      // NMOS source contact
      layers.push(<rect key="ct-ns" x={nmosGateX - 30} y={mY + 15} width={contactW} height={subY - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);
      // NMOS drain contact
      layers.push(<rect key="ct-nd" x={nmosGateX + gateL + spacerW + 15} y={mY + 15} width={contactW} height={subY - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);
      // PMOS source contact
      layers.push(<rect key="ct-ps" x={pmosGateX - 30} y={mY + 15} width={contactW} height={subY - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);
      // PMOS drain contact
      layers.push(<rect key="ct-pd" x={pmosGateX + gateL + spacerW + 15} y={mY + 15} width={contactW} height={subY - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);
      // Gate contacts
      layers.push(<rect key="ct-ng" x={nmosGateX + gateL / 2 - 4} y={mY + 15} width={contactW} height={subY - oxH - polyH - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);
      layers.push(<rect key="ct-pg" x={pmosGateX + gateL / 2 - 4} y={mY + 15} width={contactW} height={subY - oxH - polyH - mY - 15} fill={plugColor} opacity={0.7} rx={1} />);

      // Metal lines
      const metalH = 7;
      // VDD rail (PMOS source)
      layers.push(
        <rect key="m-vdd" x={pmosGateX - 50} y={mY - 5} width={gateL + spacerW * 2 + 100} height={metalH} fill="hsl(0 75% 55%)" opacity={0.7} rx={2} />,
        <text key="vdd-lbl" x={pmosGateX + gateL / 2} y={mY - 12} textAnchor="middle" fontSize="12" fill="hsl(0 75% 55%)" fontFamily="monospace" fontWeight="bold">VDD</text>,
      );
      // GND rail (NMOS source)
      layers.push(
        <rect key="m-gnd" x={nmosGateX - 50} y={mY - 5} width={gateL + spacerW * 2 + 100} height={metalH} fill="hsl(220 70% 50%)" opacity={0.7} rx={2} />,
        <text key="gnd-lbl" x={nmosGateX + gateL / 2} y={mY - 12} textAnchor="middle" fontSize="12" fill="hsl(220 70% 50%)" fontFamily="monospace" fontWeight="bold">GND</text>,
      );
      // Vin (gates connected)
      layers.push(
        <line key="m-vin" x1={nmosGateX + gateL / 2} y1={mY + 15} x2={pmosGateX + gateL / 2} y2={mY + 15}
          stroke="hsl(var(--chart-3))" strokeWidth={3} opacity={0.7} />,
        <text key="vin-lbl" x={(nmosGateX + pmosGateX + gateL) / 2} y={mY + 10} textAnchor="middle" fontSize="11"
          fill="hsl(var(--chart-3))" fontFamily="monospace" fontWeight="bold">Vin (Input)</text>,
      );
      // Vout (drains connected)
      const dNx = nmosGateX + gateL + spacerW + 15 + contactW / 2;
      const dPx = pmosGateX + gateL + spacerW + 15 + contactW / 2;
      layers.push(
        <line key="m-vout" x1={dNx} y1={mY + 30} x2={dPx} y2={mY + 30}
          stroke="hsl(30 90% 50%)" strokeWidth={3} opacity={0.8} />,
        <text key="vout-lbl" x={(dNx + dPx) / 2} y={mY + 25} textAnchor="middle" fontSize="11"
          fill="hsl(30 90% 50%)" fontFamily="monospace" fontWeight="bold">Vout (Output)</text>,
      );

      // Body ties
      if (hasTaps) {
        layers.push(
          <text key="btie-n" x={nmosGateX - 50} y={subY + 15} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">p+ tap→GND</text>,
          <text key="btie-p" x={pmosGateX + gateL + spacerW + 55} y={subY + 15} fontSize="9" fill="hsl(var(--muted-foreground))" fontFamily="monospace">n+ tap→VDD</text>,
        );
      }
    }

    // Labels: NMOS and PMOS
    if (completedSteps.size > 0) {
      layers.push(
        <text key="nmos-title" x={nmosGateX + gateL / 2} y={subY + 50} textAnchor="middle" fontSize="14"
          fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold" opacity={0.6}>NMOS</text>,
        <text key="pmos-title" x={pmosGateX + gateL / 2} y={subY + 50} textAnchor="middle" fontSize="14"
          fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold" opacity={0.6}>PMOS</text>,
      );
    }

    return { layers, W, H };
  }, [completedSteps, params]);

  // ─── VTC (Voltage Transfer Characteristic) ──────────────────────────
  const vtcData = useMemo(() => {
    if (!allDone) return null;
    const Vdd = 1.8;
    const tox = getP("gate_ox", "Oxide Thickness");
    const isHighK = getP("gate_ox", "Dielectric Type") === 1;
    const Lch = getP("poly_gate", "Gate Length");
    const eps = isHighK ? 25 * 8.854e-12 : 3.9 * 8.854e-12;
    const Cox = eps / (tox * 1e-9);
    const Vtn = 0.35 + 0.02 * Math.log10(getP("substrate", "Substrate Doping (×10¹⁵)"));
    const Vtp = -(0.35 + 0.02 * Math.log10(getP("nwell", "Well Doping (×10¹⁷)") * 100));

    const points: { vin: number; vout: number }[] = [];
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const vin = (i / steps) * Vdd;
      // Simplified CMOS inverter VTC model
      let vout: number;
      const vm = Vdd / 2; // switching point (ideal symmetric)
      const gain = 10 + (Lch < 45 ? 15 : Lch < 100 ? 10 : 5); // steepness
      vout = Vdd / (1 + Math.exp(gain * (vin - vm) / Vdd));
      vout = Math.max(0, Math.min(Vdd, vout));
      points.push({ vin, vout });
    }

    return { points, Vdd, Vtn, Vtp, Cox };
  }, [allDone, params]);

  return (
    <div className="space-y-6">
      {/* View tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "process" as const, label: "Fabrication Steps", icon: <Layers size={16} /> },
          { id: "crosssection" as const, label: "CMOS Cross-Section", icon: <Eye size={16} /> },
          ...(allDone ? [{ id: "vtc" as const, label: "VTC Curve", icon: <Zap size={16} /> }] : []),
        ]).map(t => (
          <button key={t.id} onClick={() => setViewMode(t.id)}
            className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
              viewMode === t.id ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Step progress */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {cmosSteps.map((s, i) => {
          const done = completedSteps.has(s.id);
          const active = i === currentStep && !allDone;
          const cat = catStyle[s.category] ?? { icon: "⚙️", color: "text-muted-foreground" };
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
            <Eye size={18} className="text-primary" /> CMOS Inverter Cross-Section — {completedSteps.size}/{cmosSteps.length} steps
          </h3>
          <div className="bg-background rounded-lg p-4 border border-border overflow-x-auto">
            <svg width="100%" viewBox={`0 0 ${crossSection.W} ${crossSection.H}`} className="min-w-[600px]">
              <defs>
                <marker id="cmos-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--foreground))" />
                </marker>
              </defs>
              {crossSection.layers}
              {completedSteps.size === 0 && (
                <text x={crossSection.W / 2} y={crossSection.H / 2} textAnchor="middle" fontSize="14"
                  fill="hsl(var(--muted-foreground))" fontFamily="monospace">
                  Execute fabrication steps to build CMOS inverter →
                </text>
              )}
            </svg>
          </div>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-mono">
            {[
              { color: "hsl(var(--chart-4))", label: "p-Substrate" },
              { color: "hsl(200 70% 55%)", label: "N-Well" },
              { color: "hsl(var(--chart-2))", label: "STI Oxide" },
              { color: "hsl(213 80% 70%)", label: "Gate Dielectric" },
              { color: "hsl(var(--chart-3))", label: "Gate (Poly/Metal)" },
              { color: "hsl(142 80% 40%)", label: "n+ (NMOS S/D)" },
              { color: "hsl(340 70% 55%)", label: "p+ (PMOS S/D)" },
              { color: "hsl(280 50% 55%)", label: "Spacer" },
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

      {/* ═══════ VTC VIEW ═══════ */}
      {viewMode === "vtc" && vtcData && (
        <div className="p-6 rounded-xl bg-card border border-border animate-fade-in space-y-4">
          <h3 className="text-base font-semibold text-foreground font-mono flex items-center gap-2">
            <Zap size={18} className="text-primary" /> Voltage Transfer Characteristic (VTC)
          </h3>
          <div className="bg-background rounded-lg border border-border overflow-hidden">
            <svg width="100%" viewBox="0 0 600 350" className="min-w-[500px]">
              {(() => {
                const W_px = 600, H_px = 350;
                const m = { top: 35, right: 30, bottom: 50, left: 60 };
                const gW = W_px - m.left - m.right;
                const gH = H_px - m.top - m.bottom;
                const Vdd = vtcData.Vdd;
                const getX = (v: number) => m.left + (v / Vdd) * gW;
                const getY = (v: number) => H_px - m.bottom - (v / Vdd) * gH;
                const pathD = vtcData.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.vin)},${getY(p.vout)}`).join(' ');
                // Unity gain line
                const unityD = `M ${getX(0)},${getY(0)} L ${getX(Vdd)},${getY(Vdd)}`;
                return (
                  <>
                    {/* Grid */}
                    {[0.25, 0.5, 0.75, 1].map(f => (
                      <g key={f}>
                        <line x1={getX(f * Vdd)} y1={m.top} x2={getX(f * Vdd)} y2={H_px - m.bottom} stroke="hsl(var(--border))" strokeWidth={0.5} />
                        <line x1={m.left} y1={getY(f * Vdd)} x2={W_px - m.right} y2={getY(f * Vdd)} stroke="hsl(var(--border))" strokeWidth={0.5} />
                      </g>
                    ))}
                    {/* Axes */}
                    <path d={`M ${m.left} ${m.top} L ${m.left} ${H_px - m.bottom} L ${W_px - m.right} ${H_px - m.bottom}`}
                      stroke="hsl(var(--muted-foreground))" strokeWidth={1} fill="none" />
                    {/* Unity gain line */}
                    <path d={unityD} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
                    <text x={getX(Vdd * 0.85)} y={getY(Vdd * 0.88)} fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace" opacity={0.5}>unity</text>
                    {/* VTC curve */}
                    <path d={pathD} stroke="hsl(var(--primary))" strokeWidth={3} fill="none" />
                    {/* Noise margins shading */}
                    <rect x={getX(0)} y={getY(Vdd)} width={getX(Vdd * 0.3) - getX(0)} height={gH} fill="hsl(142 80% 40%)" opacity={0.06} />
                    <text x={getX(Vdd * 0.15)} y={m.top + 15} textAnchor="middle" fontSize="9" fill="hsl(142 80% 40%)" fontFamily="monospace">VOH</text>
                    <rect x={getX(Vdd * 0.7)} y={getY(Vdd)} width={getX(Vdd) - getX(Vdd * 0.7)} height={gH} fill="hsl(0 75% 55%)" opacity={0.06} />
                    <text x={getX(Vdd * 0.85)} y={H_px - m.bottom - 10} textAnchor="middle" fontSize="9" fill="hsl(0 75% 55%)" fontFamily="monospace">VOL</text>
                    {/* Labels */}
                    <text x={W_px / 2} y={H_px - 10} textAnchor="middle" fontSize="12" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold">Input Voltage Vin (V)</text>
                    <text x={15} y={H_px / 2} textAnchor="middle" fontSize="12" fill="hsl(var(--foreground))" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 15 ${H_px / 2})`}>Output Vout (V)</text>
                    {/* Tick labels */}
                    <text x={m.left - 8} y={m.top + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{Vdd}</text>
                    <text x={m.left - 8} y={H_px - m.bottom + 4} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace">0</text>
                    <text x={W_px - m.right} y={H_px - m.bottom + 18} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace">{Vdd}</text>
                    <text x={m.left} y={H_px - m.bottom + 18} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontFamily="monospace">0</text>
                    {/* Switching point */}
                    <circle cx={getX(Vdd / 2)} cy={getY(Vdd / 2)} r={5} fill="none" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                    <text x={getX(Vdd / 2) + 12} y={getY(Vdd / 2) + 4} fontSize="10" fill="hsl(var(--chart-3))" fontFamily="monospace" fontWeight="bold">VM = {(Vdd / 2).toFixed(2)}V</text>
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "VDD", value: `${vtcData.Vdd} V`, color: "text-destructive" },
              { label: "Vtn (NMOS)", value: `${vtcData.Vtn.toFixed(3)} V`, color: "text-chart-4" },
              { label: "Vtp (PMOS)", value: `${vtcData.Vtp.toFixed(3)} V`, color: "text-chart-3" },
              { label: "NM_H ≈ NM_L", value: `~${(vtcData.Vdd * 0.35).toFixed(2)} V`, color: "text-primary" },
            ].map(m => (
              <div key={m.label} className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</div>
                <div className={cn("text-lg font-mono font-bold", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ PROCESS STEP VIEW ═══════ */}
      {viewMode === "process" && !allDone && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Step card */}
            <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border space-y-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{(catStyle[step.category] ?? { icon: "⚙️" }).icon}</span>
                <div className="flex-1">
                  <div className="text-lg font-bold text-foreground">{step.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{step.description}</div>
                  <span className={cn("inline-block mt-2 px-2 py-0.5 rounded text-xs font-mono border",
                    (catStyle[step.category] ?? { color: "text-muted-foreground" }).color, "border-current/20 bg-current/5"
                  )}>{step.category.toUpperCase()}</span>
                </div>
                <div className="text-sm font-mono text-muted-foreground">{currentStep + 1}/{cmosSteps.length}</div>
              </div>

              <button onClick={() => setShowTheory(!showTheory)}
                className="flex items-center gap-2 text-sm text-primary hover:underline font-mono">
                <Info size={14} /> {showTheory ? "Hide" : "Show"} Theory
              </button>
              {showTheory && (
                <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground leading-relaxed animate-fade-in">
                  {step.theory}
                </div>
              )}

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
                          {isToggle ? (val === 0 ? "Option A" : "Option B") : val}
                        </span>
                      </div>
                      <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                        onChange={e => setP(step.id, p.name, parseFloat(e.target.value))}
                        className="w-full accent-[hsl(var(--primary))]" />
                      <div className="text-xs text-muted-foreground">{p.tooltip}</div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} variant="outline" disabled={currentStep === 0} className="font-mono">
                  <ChevronLeft size={16} /> Prev
                </Button>
                <Button onClick={executeStep} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-base">
                  <Play size={16} /> Execute Step {currentStep + 1}
                </Button>
              </div>
            </div>

            {/* Live preview */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-mono text-muted-foreground mb-3 flex items-center gap-2">
                <Eye size={14} /> LIVE CMOS CROSS-SECTION
              </h3>
              <div className="bg-background rounded-lg p-3 border border-border">
                <svg width="100%" viewBox={`0 0 ${crossSection.W} ${crossSection.H}`}>
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
        </div>
      )}

      {/* All done */}
      {viewMode === "process" && allDone && (
        <div className="p-6 rounded-xl bg-card border border-primary/30 text-center space-y-4 animate-fade-in">
          <div className="text-3xl">🏭</div>
          <h3 className="text-xl font-bold text-foreground">CMOS Inverter Fabrication Complete!</h3>
          <p className="text-muted-foreground">Both NMOS and PMOS transistors fabricated with n-well isolation, ready for circuit operation.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={() => setViewMode("crosssection")} variant="outline" className="font-mono">
              <Eye size={16} /> Cross-Section
            </Button>
            <Button onClick={() => setViewMode("vtc")} className="bg-primary text-primary-foreground font-mono">
              <Zap size={16} /> View VTC Curve
            </Button>
            <Button onClick={reset} variant="outline" className="font-mono text-muted-foreground">
              <RotateCcw size={16} /> Restart
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMOSInverterLab;

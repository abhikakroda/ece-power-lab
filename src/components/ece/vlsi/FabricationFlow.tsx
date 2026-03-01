import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, XCircle, RotateCcw } from "lucide-react";

interface FabStep {
  id: string;
  name: string;
  desc: string;
  icon: string;
  params: FabParam[];
  tips: string;
}

interface FabParam {
  name: string;
  options: { label: string; value: string; yield: number; defectRisk: number; scalingIssue: string }[];
}

interface StepResult {
  stepId: string;
  choices: Record<string, string>;
  yield: number;
  defectRisk: number;
  scalingIssues: string[];
}

const fabSteps: FabStep[] = [
  {
    id: "oxidation",
    name: "Thermal Oxidation",
    desc: "Grow SiO₂ gate dielectric on silicon wafer",
    icon: "🔥",
    tips: "Thinner oxide → higher C_ox → more drive current, but increases gate leakage below ~2nm.",
    params: [
      {
        name: "Oxide Type",
        options: [
          { label: "Dry O₂ (high quality)", value: "dry", yield: 95, defectRisk: 5, scalingIssue: "" },
          { label: "Wet O₂ (faster)", value: "wet", yield: 88, defectRisk: 12, scalingIssue: "Lower quality interface" },
          { label: "High-κ (HfO₂)", value: "highk", yield: 90, defectRisk: 8, scalingIssue: "" },
        ],
      },
      {
        name: "Thickness Target",
        options: [
          { label: "1.2 nm (aggressive)", value: "1.2", yield: 75, defectRisk: 25, scalingIssue: "Quantum tunneling leakage" },
          { label: "2.0 nm (standard)", value: "2.0", yield: 92, defectRisk: 8, scalingIssue: "" },
          { label: "5.0 nm (conservative)", value: "5.0", yield: 97, defectRisk: 3, scalingIssue: "Limits drive current" },
        ],
      },
    ],
  },
  {
    id: "litho",
    name: "Photolithography",
    desc: "Pattern transfer using UV light through photomask",
    icon: "💡",
    tips: "Resolution ~ 0.25 × λ/NA. EUV (13.5nm) enables sub-7nm nodes.",
    params: [
      {
        name: "Light Source",
        options: [
          { label: "DUV (193nm ArF)", value: "duv", yield: 93, defectRisk: 7, scalingIssue: "Limited to ~40nm features" },
          { label: "EUV (13.5nm)", value: "euv", yield: 85, defectRisk: 15, scalingIssue: "" },
          { label: "Immersion DUV", value: "immersion", yield: 90, defectRisk: 10, scalingIssue: "Multi-patterning needed <20nm" },
        ],
      },
      {
        name: "Resist Type",
        options: [
          { label: "Positive (standard)", value: "positive", yield: 94, defectRisk: 6, scalingIssue: "" },
          { label: "Negative (high res)", value: "negative", yield: 88, defectRisk: 12, scalingIssue: "Swelling issues" },
          { label: "Chemically amplified", value: "car", yield: 91, defectRisk: 9, scalingIssue: "" },
        ],
      },
    ],
  },
  {
    id: "etch",
    name: "Etching",
    desc: "Remove material to define device geometry",
    icon: "⚡",
    tips: "RIE gives anisotropic profiles for vertical sidewalls. Wet etch is isotropic — undercuts mask.",
    params: [
      {
        name: "Etch Method",
        options: [
          { label: "RIE (Reactive Ion)", value: "rie", yield: 92, defectRisk: 8, scalingIssue: "" },
          { label: "Wet Chemical (HF)", value: "wet", yield: 85, defectRisk: 15, scalingIssue: "Isotropic undercut" },
          { label: "Plasma (ICP)", value: "icp", yield: 94, defectRisk: 6, scalingIssue: "" },
        ],
      },
      {
        name: "Selectivity",
        options: [
          { label: "High selectivity (>20:1)", value: "high", yield: 95, defectRisk: 5, scalingIssue: "" },
          { label: "Medium (10:1)", value: "med", yield: 88, defectRisk: 12, scalingIssue: "May damage underlayer" },
          { label: "Low (<5:1)", value: "low", yield: 78, defectRisk: 22, scalingIssue: "Over-etch risk" },
        ],
      },
    ],
  },
  {
    id: "implant",
    name: "Ion Implantation",
    desc: "Dope silicon with precise dose and energy control",
    icon: "☢️",
    tips: "Higher energy = deeper junction. Dose controls concentration. Anneal repairs lattice damage.",
    params: [
      {
        name: "Dopant Species",
        options: [
          { label: "Boron (p-type)", value: "B", yield: 94, defectRisk: 6, scalingIssue: "" },
          { label: "Phosphorus (n-type)", value: "P", yield: 93, defectRisk: 7, scalingIssue: "" },
          { label: "Arsenic (shallow n+)", value: "As", yield: 91, defectRisk: 9, scalingIssue: "" },
        ],
      },
      {
        name: "Energy / Depth",
        options: [
          { label: "Ultra-shallow (<10nm)", value: "shallow", yield: 82, defectRisk: 18, scalingIssue: "Dopant activation challenge" },
          { label: "Standard (50nm)", value: "standard", yield: 94, defectRisk: 6, scalingIssue: "" },
          { label: "Deep well (200nm)", value: "deep", yield: 90, defectRisk: 10, scalingIssue: "Latch-up risk" },
        ],
      },
    ],
  },
  {
    id: "metal",
    name: "Metallization",
    desc: "Deposit and pattern metal interconnects",
    icon: "🔗",
    tips: "Cu replaced Al at 180nm node for lower resistance. Barrier layers prevent Cu diffusion into Si.",
    params: [
      {
        name: "Metal",
        options: [
          { label: "Copper (damascene)", value: "Cu", yield: 91, defectRisk: 9, scalingIssue: "" },
          { label: "Aluminum (sputtered)", value: "Al", yield: 87, defectRisk: 13, scalingIssue: "Electromigration at high current" },
          { label: "Cobalt (advanced)", value: "Co", yield: 85, defectRisk: 15, scalingIssue: "" },
        ],
      },
      {
        name: "Dielectric",
        options: [
          { label: "Low-κ (SiOCH)", value: "lowk", yield: 88, defectRisk: 12, scalingIssue: "" },
          { label: "SiO₂ (standard)", value: "sio2", yield: 95, defectRisk: 5, scalingIssue: "High RC delay" },
          { label: "Air gap", value: "airgap", yield: 78, defectRisk: 22, scalingIssue: "Mechanical weakness" },
        ],
      },
    ],
  },
];

const FabricationFlow = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [results, setResults] = useState<StepResult[]>([]);
  const [completed, setCompleted] = useState(false);

  const step = fabSteps[currentStep];

  const handleChoice = (paramName: string, value: string) => {
    setChoices((p) => ({ ...p, [`${step.id}_${paramName}`]: value }));
  };

  const getChoice = (paramName: string) => choices[`${step.id}_${paramName}`];

  const allChosen = step.params.every((p) => getChoice(p.name));

  const submitStep = () => {
    // Calculate step metrics
    let yieldPct = 100;
    let defectRisk = 0;
    const scalingIssues: string[] = [];

    step.params.forEach((param) => {
      const chosen = getChoice(param.name);
      const opt = param.options.find((o) => o.value === chosen);
      if (opt) {
        yieldPct = yieldPct * (opt.yield / 100);
        defectRisk = Math.max(defectRisk, opt.defectRisk);
        if (opt.scalingIssue) scalingIssues.push(opt.scalingIssue);
      }
    });

    const stepChoices: Record<string, string> = {};
    step.params.forEach((p) => { stepChoices[p.name] = getChoice(p.name) ?? ""; });

    setResults((p) => [...p, {
      stepId: step.id,
      choices: stepChoices,
      yield: Math.round(yieldPct),
      defectRisk,
      scalingIssues,
    }]);

    if (currentStep < fabSteps.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      setCompleted(true);
    }
  };

  const resetGame = () => {
    setCurrentStep(0);
    setChoices({});
    setResults([]);
    setCompleted(false);
  };

  const overallYield = results.reduce((acc, r) => acc * (r.yield / 100), 1) * 100;
  const maxDefect = Math.max(...results.map((r) => r.defectRisk), 0);
  const allIssues = results.flatMap((r) => r.scalingIssues);

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {fabSteps.map((s, i) => {
          const done = i < currentStep || completed;
          const active = i === currentStep && !completed;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono transition-all",
                done ? "bg-primary/20 text-primary" : active ? "bg-chart-2/20 text-chart-2 ring-2 ring-chart-2/40" : "bg-muted text-muted-foreground"
              )}>
                {done ? "✓" : s.icon}
              </div>
              {i < fabSteps.length - 1 && (
                <div className={cn("h-0.5 flex-1 mx-1 transition-all", done ? "bg-primary/40" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step names */}
      <div className="flex gap-1">
        {fabSteps.map((s, i) => (
          <div key={s.id} className={cn("flex-1 text-center text-[9px] font-mono truncate",
            i === currentStep && !completed ? "text-chart-2" : i < currentStep || completed ? "text-primary" : "text-muted-foreground"
          )}>
            {s.name}
          </div>
        ))}
      </div>

      {!completed ? (
        <>
          {/* Current step */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{step.icon}</span>
              <div>
                <div className="text-lg font-bold text-foreground">{step.name}</div>
                <div className="text-sm text-muted-foreground">{step.desc}</div>
              </div>
              <div className="flex-1" />
              <div className="text-xs font-mono text-muted-foreground">Step {currentStep + 1}/{fabSteps.length}</div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
              💡 {step.tips}
            </div>

            {/* Parameter choices */}
            {step.params.map((param) => (
              <div key={param.name} className="space-y-2">
                <div className="text-sm font-mono text-foreground">{param.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {param.options.map((opt) => {
                    const selected = getChoice(param.name) === opt.value;
                    return (
                      <button key={opt.value} onClick={() => handleChoice(param.name, opt.value)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all text-sm",
                          selected
                            ? "bg-chart-2/10 border-chart-2/40 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-chart-2/20"
                        )}>
                        <div className="font-mono font-medium text-xs">{opt.label}</div>
                        {selected && (
                          <div className="mt-2 space-y-1 text-[10px] animate-fade-in">
                            <div className="flex justify-between">
                              <span>Yield:</span>
                              <span className={cn("font-mono", opt.yield >= 90 ? "text-primary" : opt.yield >= 80 ? "text-chart-3" : "text-destructive")}>{opt.yield}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Defect risk:</span>
                              <span className={cn("font-mono", opt.defectRisk <= 10 ? "text-primary" : opt.defectRisk <= 15 ? "text-chart-3" : "text-destructive")}>{opt.defectRisk}%</span>
                            </div>
                            {opt.scalingIssue && (
                              <div className="text-destructive flex items-center gap-1">
                                <AlertTriangle size={10} /> {opt.scalingIssue}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <Button onClick={submitStep} disabled={!allChosen}
              className="w-full bg-chart-2 text-primary-foreground hover:bg-chart-2/80 font-mono">
              {currentStep < fabSteps.length - 1 ? "Next Step →" : "Complete Fabrication ✓"}
            </Button>
          </div>

          {/* Previous results */}
          {results.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {results.map((r, i) => {
                const s = fabSteps[i];
                return (
                  <div key={r.stepId} className="shrink-0 p-3 rounded-lg bg-card border border-border min-w-[140px]">
                    <div className="text-[10px] font-mono text-muted-foreground">{s.name}</div>
                    <div className={cn("text-sm font-mono font-bold", r.yield >= 90 ? "text-primary" : r.yield >= 80 ? "text-chart-3" : "text-destructive")}>
                      Yield: {r.yield}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Final Results */
        <div className="space-y-4 animate-fade-in">
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border text-center space-y-4">
            <div className="text-2xl">🏭</div>
            <div className="text-xl font-bold text-foreground">Fabrication Complete</div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-border">
                <div className={cn("text-3xl font-mono font-bold",
                  overallYield >= 80 ? "text-primary" : overallYield >= 60 ? "text-chart-3" : "text-destructive"
                )}>
                  {overallYield.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Overall Yield</div>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <div className={cn("text-3xl font-mono font-bold",
                  maxDefect <= 10 ? "text-primary" : maxDefect <= 20 ? "text-chart-3" : "text-destructive"
                )}>
                  {maxDefect}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">Max Defect Risk</div>
              </div>
              <div className="p-4 rounded-lg border border-border">
                <div className={cn("text-3xl font-mono font-bold", allIssues.length === 0 ? "text-primary" : "text-chart-3")}>
                  {allIssues.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Scaling Issues</div>
              </div>
            </div>

            {/* Grade */}
            <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-mono",
              overallYield >= 80 ? "bg-primary/10 border-primary/30 text-primary" :
              overallYield >= 60 ? "bg-chart-3/10 border-chart-3/30 text-chart-3" :
              "bg-destructive/10 border-destructive/30 text-destructive"
            )}>
              {overallYield >= 80 ? <CheckCircle size={16} /> : overallYield >= 60 ? <AlertTriangle size={16} /> : <XCircle size={16} />}
              {overallYield >= 80 ? "Production Ready" : overallYield >= 60 ? "Needs Optimization" : "Process Failure — Redesign Required"}
            </div>
          </div>

          {/* Step-by-step breakdown */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">STEP-BY-STEP ANALYSIS</div>
            <div className="space-y-2">
              {results.map((r, i) => {
                const s = fabSteps[i];
                return (
                  <div key={r.stepId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <span>{s.icon}</span>
                    <span className="text-xs font-mono text-foreground flex-1">{s.name}</span>
                    <span className={cn("text-xs font-mono font-bold",
                      r.yield >= 90 ? "text-primary" : r.yield >= 80 ? "text-chart-3" : "text-destructive"
                    )}>
                      {r.yield}%
                    </span>
                    {r.scalingIssues.length > 0 && (
                      <span className="text-[10px] text-destructive">{r.scalingIssues.join(", ")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {allIssues.length > 0 && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5">
              <div className="text-xs font-mono text-destructive mb-2">⚠ SCALING ISSUES DETECTED</div>
              <ul className="text-xs text-destructive/80 space-y-1">
                {allIssues.map((issue, i) => <li key={i}>• {issue}</li>)}
              </ul>
            </div>
          )}

          <Button onClick={resetGame} variant="outline" className="w-full font-mono">
            <RotateCcw size={14} /> Try Again with Different Parameters
          </Button>
        </div>
      )}
    </div>
  );
};

export default FabricationFlow;

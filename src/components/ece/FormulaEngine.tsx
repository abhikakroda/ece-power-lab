import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Formula {
  name: string;
  formula: string;
  where?: string;
  used: string;
  mistake?: string;
  trick?: string;
}

interface Subject {
  id: string;
  name: string;
  color: string;
  formulas: Formula[];
}

const subjects: Subject[] = [
  {
    id: "signals",
    name: "Signals & Systems",
    color: "text-primary",
    formulas: [
      { name: "Fourier Transform", formula: "X(ω) = ∫ x(t)·e^(-jωt) dt", used: "Frequency domain analysis, filter design", mistake: "Forgetting the 1/2π factor in inverse transform", trick: "Remember: time→freq = integrate with e^(-jωt)" },
      { name: "Laplace Transform", formula: "X(s) = ∫₀^∞ x(t)·e^(-st) dt", used: "Control systems, circuit analysis, stability", mistake: "ROC must be specified for uniqueness", trick: "s = σ + jω, σ handles convergence" },
      { name: "Convolution", formula: "y(t) = x(t) * h(t) = ∫ x(τ)·h(t-τ) dτ", used: "LTI system output, filtering", mistake: "Flip h(τ), not x(τ)", trick: "Convolution in time = multiplication in frequency" },
      { name: "Sampling Theorem", formula: "fs ≥ 2·fmax (Nyquist Rate)", used: "ADC, digital signal processing", mistake: "Aliasing occurs when fs < 2fmax", trick: "fs = 2B for bandpass signals (B = bandwidth)" },
      { name: "Z-Transform", formula: "X(z) = Σ x[n]·z^(-n)", used: "Discrete-time system analysis, digital filters", trick: "z = e^(sT), bridges continuous and discrete" },
      { name: "Parseval's Theorem", formula: "∫|x(t)|² dt = (1/2π)∫|X(ω)|² dω", used: "Energy calculation in both domains", trick: "Energy is conserved between time and frequency" },
    ],
  },
  {
    id: "control",
    name: "Control Systems",
    color: "text-secondary",
    formulas: [
      { name: "Transfer Function", formula: "G(s) = C(s)/R(s) = Y(s)/X(s)", used: "System modeling, stability analysis", trick: "Poles → stability, Zeros → response shape" },
      { name: "Routh-Hurwitz", formula: "First column of Routh array > 0 → stable", used: "Stability check without solving characteristic eq", mistake: "Row of zeros needs auxiliary polynomial derivative", trick: "Count sign changes in first column = RHP poles" },
      { name: "Gain Margin", formula: "GM = -20log|G(jω_pc)| dB", used: "Relative stability measure", trick: "GM > 0 dB means stable (for minimum phase)" },
      { name: "Phase Margin", formula: "PM = 180° + ∠G(jω_gc)", used: "Transient response quality indicator", mistake: "PM should be 30-60° for good response", trick: "More PM = less overshoot" },
      { name: "Steady-State Error", formula: "ess = 1/(1+Kp) for step, 1/Kv for ramp", used: "Accuracy analysis of feedback systems", trick: "Type 0: finite step error, Type 1: finite ramp error" },
      { name: "Root Locus Rules", formula: "Angles of departure = 180°-(sum of angles)", used: "Plotting root locus for varying K", trick: "# branches = # poles, start at poles, end at zeros" },
    ],
  },
  {
    id: "analog",
    name: "Analog Electronics",
    color: "text-accent",
    formulas: [
      { name: "BJT Current Gain", formula: "β = IC/IB, α = IC/IE, β = α/(1-α)", used: "Transistor biasing calculations", mistake: "β varies with temperature and operating point", trick: "α ≈ 0.98-0.99, so β ≈ 50-200" },
      { name: "Op-Amp Gain (Inverting)", formula: "Av = -Rf/R1", used: "Inverting amplifier design", trick: "Virtual ground: V+ = V- = 0V" },
      { name: "Op-Amp Gain (Non-Inv)", formula: "Av = 1 + Rf/R1", used: "Non-inverting amplifier, buffer", mistake: "Gain is always ≥ 1 for non-inverting", trick: "Set Rf=0, R1=∞ for voltage follower (Av=1)" },
      { name: "MOSFET Saturation", formula: "ID = (μnCox/2)(W/L)(VGS-Vth)²", used: "Amplifier design, digital switching", trick: "Square law device, current ∝ (VGS-Vth)²" },
      { name: "Small Signal gm", formula: "gm = 2ID/(VGS-Vth) = √(2μnCox(W/L)ID)", used: "Amplifier gain calculation", trick: "gm = ΔID/ΔVGS at operating point" },
      { name: "Common Emitter Gain", formula: "Av = -gm·(RC || ro)", used: "Single stage amplifier analysis", trick: "gm = IC/VT, VT = 26mV at room temp" },
    ],
  },
  {
    id: "digital",
    name: "Digital Electronics",
    color: "text-chart-4",
    formulas: [
      { name: "De Morgan's Theorem", formula: "(A·B)' = A'+B', (A+B)' = A'·B'", used: "Logic simplification, NAND/NOR conversion", trick: "Break the bar, change the sign" },
      { name: "Flip-Flop Excitation", formula: "JK: J=Q(n+1), K=Q'(n+1)", used: "Sequential circuit design", mistake: "Don't confuse characteristic and excitation tables" },
      { name: "Shannon's Theorem", formula: "C = B·log₂(1 + SNR)", used: "Channel capacity calculation", trick: "Doubling bandwidth doubles capacity, doubling SNR adds ~log₂ bits" },
      { name: "Number of States", formula: "N states → ⌈log₂N⌉ flip-flops needed", used: "Counter design, state machine", trick: "2^n ≥ N, solve for n" },
      { name: "Setup & Hold Time", formula: "Tsetup + Thold ≤ Tclock", used: "Timing analysis, metastability prevention", mistake: "Violating setup time causes metastability" },
      { name: "Propagation Delay", formula: "tpd = tpHL + tpLH / 2", used: "Speed analysis of digital circuits", trick: "Critical path determines max frequency" },
    ],
  },
  {
    id: "comm",
    name: "Communication Systems",
    color: "text-destructive",
    formulas: [
      { name: "AM Modulation Index", formula: "μ = Am/Ac (0 ≤ μ ≤ 1)", used: "AM transmitter design", mistake: "μ > 1 causes overmodulation and distortion", trick: "Total power = Pc(1 + μ²/2)" },
      { name: "FM Bandwidth (Carson)", formula: "BW = 2(Δf + fm)", used: "FM spectrum allocation", trick: "β = Δf/fm, narrowband if β << 1" },
      { name: "Noise Figure", formula: "NF = 10·log₁₀(F), F = SNRin/SNRout", used: "Receiver sensitivity analysis", trick: "Friis: Ftotal = F1 + (F2-1)/G1 + ..." },
      { name: "Bit Error Rate (BPSK)", formula: "BER = Q(√(2Eb/N0))", used: "Digital communication performance", trick: "BPSK and QPSK have same BER per bit" },
      { name: "Link Budget", formula: "Pr = Pt + Gt + Gr - Lpath", used: "Wireless link design (all in dB)", trick: "Free space loss = 20log(4πd/λ)" },
      { name: "Capacity (AWGN)", formula: "C = B·log₂(1 + P/(N0·B))", used: "Theoretical max data rate", trick: "Power-limited: increase P; BW-limited: increase B" },
    ],
  },
];

const FormulaEngine = () => {
  const [activeSubject, setActiveSubject] = useState<string>("signals");
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  const currentSubject = subjects.find((s) => s.id === activeSubject)!;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <BookOpen size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Formula Engine</h2>
          <p className="text-sm text-muted-foreground font-mono">Formulas • Concept Maps • Memory Tricks</p>
        </div>
      </div>

      {/* Subject Tabs */}
      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => { setActiveSubject(s.id); setExpandedFormula(null); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              activeSubject === s.id
                ? "bg-muted border-border text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Formulas */}
      <div className="space-y-3">
        {currentSubject.formulas.map((f) => {
          const isExpanded = expandedFormula === f.name;
          return (
            <div key={f.name} className="rounded-xl bg-card border border-border overflow-hidden transition-all">
              <button
                onClick={() => setExpandedFormula(isExpanded ? null : f.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div>
                  <div className={`text-sm font-semibold ${currentSubject.color}`}>{f.name}</div>
                  <div className="text-lg font-mono text-foreground mt-1">{f.formula}</div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-border pt-3">
                  {f.where && (
                    <div className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Where:</span> {f.where}</div>
                  )}
                  <div className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Used in:</span> {f.used}</div>
                  {f.mistake && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                      <div className="text-sm text-destructive">{f.mistake}</div>
                    </div>
                  )}
                  {f.trick && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <Lightbulb size={14} className="text-accent mt-0.5 shrink-0" />
                      <div className="text-sm text-accent">{f.trick}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FormulaEngine;

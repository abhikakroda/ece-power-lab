import { useState, useEffect, useRef } from "react";
import { BookOpen, ChevronDown, ChevronRight, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import katex from "katex";

interface Formula {
  name: string;
  formula: string;
  latex: string;
  where?: string;
  used: string;
  mistake?: string;
  trick?: string;
}

interface Subject {
  id: string;
  name: string;
  formulas: Formula[];
}

const KaTeXBlock = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        if (ref.current) ref.current.textContent = latex;
      }
    }
  }, [latex]);
  return <div ref={ref} className="py-2" />;
};

const KaTeXInline = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(latex, ref.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        if (ref.current) ref.current.textContent = latex;
      }
    }
  }, [latex]);
  return <span ref={ref} />;
};

const subjects: Subject[] = [
  {
    id: "signals",
    name: "Signals & Systems",
    formulas: [
      { name: "Fourier Transform", formula: "X(ω) = ∫ x(t)·e^(-jωt) dt", latex: "X(\\omega) = \\int_{-\\infty}^{\\infty} x(t) \\cdot e^{-j\\omega t} \\, dt", used: "Frequency domain analysis, filter design", mistake: "Forgetting the 1/2π factor in inverse transform", trick: "Time→freq = integrate with e^{-jωt}" },
      { name: "Laplace Transform", formula: "X(s) = ∫₀^∞ x(t)·e^(-st) dt", latex: "X(s) = \\int_{0}^{\\infty} x(t) \\cdot e^{-st} \\, dt", used: "Control systems, circuit analysis, stability", mistake: "ROC must be specified for uniqueness", trick: "s = σ + jω, σ handles convergence" },
      { name: "Convolution", formula: "y(t) = x(t) * h(t)", latex: "y(t) = x(t) * h(t) = \\int_{-\\infty}^{\\infty} x(\\tau) \\cdot h(t - \\tau) \\, d\\tau", used: "LTI system output, filtering", mistake: "Flip h(τ), not x(τ)", trick: "Convolution in time = multiplication in frequency" },
      { name: "Sampling Theorem", formula: "fs ≥ 2·fmax", latex: "f_s \\geq 2 f_{\\max} \\quad \\text{(Nyquist Rate)}", used: "ADC, digital signal processing", mistake: "Aliasing occurs when fs < 2fmax", trick: "fs = 2B for bandpass signals" },
      { name: "Z-Transform", formula: "X(z) = Σ x[n]·z^(-n)", latex: "X(z) = \\sum_{n=-\\infty}^{\\infty} x[n] \\cdot z^{-n}", used: "Discrete-time system analysis, digital filters", trick: "z = e^{sT}, bridges continuous and discrete" },
      { name: "Parseval's Theorem", formula: "∫|x(t)|² dt = (1/2π)∫|X(ω)|² dω", latex: "\\int_{-\\infty}^{\\infty} |x(t)|^2 \\, dt = \\frac{1}{2\\pi} \\int_{-\\infty}^{\\infty} |X(\\omega)|^2 \\, d\\omega", used: "Energy calculation in both domains", trick: "Energy is conserved between time and frequency" },
    ],
  },
  {
    id: "control",
    name: "Control Systems",
    formulas: [
      { name: "Transfer Function", formula: "G(s) = C(s)/R(s)", latex: "G(s) = \\frac{C(s)}{R(s)} = \\frac{Y(s)}{X(s)}", used: "System modeling, stability analysis", trick: "Poles → stability, Zeros → response shape" },
      { name: "Routh-Hurwitz Criterion", formula: "First column > 0 → stable", latex: "\\text{All elements in first column of Routh array} > 0 \\implies \\text{Stable}", used: "Stability check without solving characteristic eq", mistake: "Row of zeros needs auxiliary polynomial derivative", trick: "Count sign changes = RHP poles" },
      { name: "Gain Margin", formula: "GM = -20log|G(jω_pc)| dB", latex: "GM = -20 \\log_{10} |G(j\\omega_{pc})| \\text{ dB}", used: "Relative stability measure", trick: "GM > 0 dB means stable (minimum phase)" },
      { name: "Phase Margin", formula: "PM = 180° + ∠G(jω_gc)", latex: "PM = 180° + \\angle G(j\\omega_{gc})", used: "Transient response quality indicator", mistake: "PM should be 30–60° for good response", trick: "More PM = less overshoot" },
      { name: "Steady-State Error", formula: "ess = 1/(1+Kp)", latex: "e_{ss} = \\frac{1}{1 + K_p} \\text{ (step)}, \\quad e_{ss} = \\frac{1}{K_v} \\text{ (ramp)}", used: "Accuracy analysis of feedback systems", trick: "Type 0: finite step error, Type 1: finite ramp error" },
      { name: "Root Locus Rules", formula: "Angles = 180° - (sum)", latex: "\\angle_{dep} = 180° - \\sum \\angle \\text{(from other poles/zeros)}", used: "Plotting root locus for varying K", trick: "Branches = poles, start at poles, end at zeros" },
    ],
  },
  {
    id: "analog",
    name: "Analog Electronics",
    formulas: [
      { name: "BJT Current Gain", formula: "β = IC/IB", latex: "\\beta = \\frac{I_C}{I_B}, \\quad \\alpha = \\frac{I_C}{I_E}, \\quad \\beta = \\frac{\\alpha}{1 - \\alpha}", used: "Transistor biasing calculations", mistake: "β varies with temperature and operating point", trick: "α ≈ 0.98–0.99, so β ≈ 50–200" },
      { name: "Op-Amp Gain (Inverting)", formula: "Av = -Rf/R1", latex: "A_v = -\\frac{R_f}{R_1}", used: "Inverting amplifier design", trick: "Virtual ground: V⁺ = V⁻ = 0V" },
      { name: "Op-Amp Gain (Non-Inv)", formula: "Av = 1 + Rf/R1", latex: "A_v = 1 + \\frac{R_f}{R_1}", used: "Non-inverting amplifier, buffer", mistake: "Gain always ≥ 1 for non-inverting", trick: "Rf = 0, R1 = ∞ for voltage follower" },
      { name: "MOSFET Saturation", formula: "ID = (μnCox/2)(W/L)(VGS-Vth)²", latex: "I_D = \\frac{\\mu_n C_{ox}}{2} \\cdot \\frac{W}{L} (V_{GS} - V_{th})^2", used: "Amplifier design, digital switching", trick: "Square law: current ∝ (VGS - Vth)²" },
      { name: "Small Signal gm", formula: "gm = 2ID/(VGS-Vth)", latex: "g_m = \\frac{2I_D}{V_{GS} - V_{th}} = \\sqrt{2 \\mu_n C_{ox} \\frac{W}{L} I_D}", used: "Amplifier gain calculation", trick: "gm = ΔID/ΔVGS at operating point" },
      { name: "Common Emitter Gain", formula: "Av = -gm·(RC || ro)", latex: "A_v = -g_m \\cdot (R_C \\| r_o)", used: "Single stage amplifier analysis", trick: "gm = IC/VT, VT = 26mV at room temp" },
    ],
  },
  {
    id: "digital",
    name: "Digital Electronics",
    formulas: [
      { name: "De Morgan's Theorem", formula: "(A·B)' = A'+B'", latex: "\\overline{A \\cdot B} = \\bar{A} + \\bar{B}, \\quad \\overline{A + B} = \\bar{A} \\cdot \\bar{B}", used: "Logic simplification, NAND/NOR", trick: "Break the bar, change the sign" },
      { name: "Flip-Flop Excitation", formula: "JK: J=Q(n+1), K=Q'(n+1)", latex: "JK: \\; J = Q_{n+1}, \\; K = \\overline{Q_{n+1}}", used: "Sequential circuit design", mistake: "Don't confuse characteristic and excitation tables" },
      { name: "Shannon's Theorem", formula: "C = B·log₂(1 + SNR)", latex: "C = B \\cdot \\log_2(1 + \\text{SNR})", used: "Channel capacity", trick: "Doubling BW doubles capacity" },
      { name: "Number of States", formula: "⌈log₂N⌉ flip-flops", latex: "n = \\lceil \\log_2 N \\rceil \\text{ flip-flops}", used: "Counter design, state machine", trick: "2ⁿ ≥ N, solve for n" },
      { name: "Setup & Hold Time", formula: "Tsetup + Thold ≤ Tclock", latex: "T_{setup} + T_{hold} \\leq T_{clock}", used: "Timing analysis", mistake: "Violating setup time → metastability" },
      { name: "Propagation Delay", formula: "tpd = (tpHL + tpLH) / 2", latex: "t_{pd} = \\frac{t_{pHL} + t_{pLH}}{2}", used: "Speed analysis", trick: "Critical path determines max frequency" },
    ],
  },
  {
    id: "comm",
    name: "Communication Systems",
    formulas: [
      { name: "AM Modulation Index", formula: "μ = Am/Ac", latex: "\\mu = \\frac{A_m}{A_c}, \\quad 0 \\leq \\mu \\leq 1", used: "AM transmitter design", mistake: "μ > 1 causes overmodulation", trick: "Total power = Pc(1 + μ²/2)" },
      { name: "FM Bandwidth (Carson)", formula: "BW = 2(Δf + fm)", latex: "BW = 2(\\Delta f + f_m)", used: "FM spectrum allocation", trick: "β = Δf/fm, narrowband if β ≪ 1" },
      { name: "Noise Figure", formula: "NF = 10·log₁₀(F)", latex: "NF = 10 \\cdot \\log_{10}(F), \\quad F = \\frac{SNR_{in}}{SNR_{out}}", used: "Receiver sensitivity", trick: "Friis: F_{total} = F_1 + (F_2-1)/G_1 + ..." },
      { name: "Bit Error Rate (BPSK)", formula: "BER = Q(√(2Eb/N0))", latex: "BER = Q\\left(\\sqrt{\\frac{2E_b}{N_0}}\\right)", used: "Digital comm performance", trick: "BPSK and QPSK have same BER/bit" },
      { name: "Link Budget", formula: "Pr = Pt + Gt + Gr - Lpath", latex: "P_r = P_t + G_t + G_r - L_{path} \\quad \\text{(dB)}", used: "Wireless link design", trick: "Free space loss = 20log(4πd/λ)" },
      { name: "Capacity (AWGN)", formula: "C = B·log₂(1 + P/(N0·B))", latex: "C = B \\cdot \\log_2\\left(1 + \\frac{P}{N_0 B}\\right)", used: "Theoretical max data rate", trick: "Power-limited: ↑P; BW-limited: ↑B" },
    ],
  },
];

const FormulaEngine = () => {
  const [activeSubject, setActiveSubject] = useState<string>("signals");
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  const currentSubject = subjects.find((s) => s.id === activeSubject)!;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Formula Engine</h2>
        <p className="text-sm text-muted-foreground mt-1">Formulas with proper rendering, tips & common mistakes</p>
      </div>

      {/* Subject Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => { setActiveSubject(s.id); setExpandedFormula(null); }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all",
              activeSubject === s.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Formulas */}
      <div className="space-y-2">
        {currentSubject.formulas.map((f) => {
          const isExpanded = expandedFormula === f.name;
          return (
            <div key={f.name} className="rounded-xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => setExpandedFormula(isExpanded ? null : f.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{f.name}</div>
                  <div className="mt-1 overflow-x-auto">
                    <KaTeXInline latex={f.latex} />
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground shrink-0 ml-3" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0 ml-3" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {/* Full display render */}
                  <div className="p-4 rounded-lg bg-muted/50 overflow-x-auto">
                    <KaTeXBlock latex={f.latex} />
                  </div>
                  {f.where && (
                    <div className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Where:</span> {f.where}</div>
                  )}
                  <div className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Used in:</span> {f.used}</div>
                  {f.mistake && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                      <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                      <div className="text-sm text-destructive/90">{f.mistake}</div>
                    </div>
                  )}
                  {f.trick && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <Lightbulb size={14} className="text-primary mt-0.5 shrink-0" />
                      <div className="text-sm text-primary/90">{f.trick}</div>
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

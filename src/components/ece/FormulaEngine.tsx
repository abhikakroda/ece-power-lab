import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, Lightbulb } from "lucide-react";
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
        katex.render(latex, ref.current, { throwOnError: false, displayMode: true });
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
        katex.render(latex, ref.current, { throwOnError: false, displayMode: false });
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
      { name: "Inverse Fourier Transform", formula: "x(t) = (1/2π)∫ X(ω)·e^(jωt) dω", latex: "x(t) = \\frac{1}{2\\pi} \\int_{-\\infty}^{\\infty} X(\\omega) \\cdot e^{j\\omega t} \\, d\\omega", used: "Recovering time-domain signal from spectrum", mistake: "Missing 1/2π factor — this is the most common GATE error", trick: "FT pair: rect↔sinc, δ↔1, e^{jω₀t}↔2πδ(ω-ω₀)" },
      { name: "Laplace Transform", formula: "X(s) = ∫₀^∞ x(t)·e^(-st) dt", latex: "X(s) = \\int_{0}^{\\infty} x(t) \\cdot e^{-st} \\, dt", used: "Control systems, circuit analysis, stability", mistake: "ROC must be specified for uniqueness", trick: "s = σ + jω, σ handles convergence" },
      { name: "Convolution", formula: "y(t) = x(t) * h(t)", latex: "y(t) = x(t) * h(t) = \\int_{-\\infty}^{\\infty} x(\\tau) \\cdot h(t - \\tau) \\, d\\tau", used: "LTI system output, filtering", mistake: "Flip h(τ), not x(τ)", trick: "Convolution in time = multiplication in frequency" },
      { name: "Sampling Theorem", formula: "fs ≥ 2·fmax", latex: "f_s \\geq 2 f_{\\max} \\quad \\text{(Nyquist Rate)}", used: "ADC, digital signal processing", mistake: "Aliasing occurs when fs < 2fmax", trick: "fs = 2B for bandpass signals" },
      { name: "Z-Transform", formula: "X(z) = Σ x[n]·z^(-n)", latex: "X(z) = \\sum_{n=-\\infty}^{\\infty} x[n] \\cdot z^{-n}", used: "Discrete-time system analysis, digital filters", trick: "z = e^{sT}, bridges continuous and discrete" },
      { name: "Parseval's Theorem", formula: "∫|x(t)|² dt = (1/2π)∫|X(ω)|² dω", latex: "\\int_{-\\infty}^{\\infty} |x(t)|^2 \\, dt = \\frac{1}{2\\pi} \\int_{-\\infty}^{\\infty} |X(\\omega)|^2 \\, d\\omega", used: "Energy calculation in both domains", trick: "Energy is conserved between time and frequency" },
      { name: "DFT", formula: "X[k] = Σ x[n]·e^(-j2πkn/N)", latex: "X[k] = \\sum_{n=0}^{N-1} x[n] \\cdot e^{-j2\\pi kn/N}, \\quad k=0,1,\\ldots,N-1", used: "Spectral analysis of discrete signals, FFT basis", mistake: "DFT assumes periodicity — windowing needed for non-periodic signals", trick: "FFT computes DFT in O(N log N) vs O(N²)" },
      { name: "Transfer Function (Discrete)", formula: "H(z) = Y(z)/X(z)", latex: "H(z) = \\frac{Y(z)}{X(z)} = \\frac{\\sum b_k z^{-k}}{\\sum a_k z^{-k}}", used: "Digital filter design (IIR/FIR)", trick: "FIR: all poles at origin. IIR: poles anywhere inside unit circle for stability" },
      { name: "Fast Fourier Transform (Radix-2)", formula: "X[k] = E[k] + WN^k * O[k]", latex: "X[k] = E[k] + e^{-j\\frac{2\\pi}{N}k} O[k]", used: "Efficient computation of DFT", trick: "Reduces O(N^2) complexity of DFT to O(N log N)" },
      { name: "Gibbs Phenomenon", formula: "9% overshoot", latex: "\\text{Peak Overshoot} \\approx 8.95\\text{\\% of jump}", used: "Fourier series of discontinuities", mistake: "Increasing terms N does not eliminate the overshoot, it only compresses it towards the discontinuity", trick: "Use windowing functions (Hamming, Hanning) to mitigate" },
      { name: "Parseval's Relation for DFT", formula: "Σ |x[n]|^2 = (1/N) Σ |X[k]|^2", latex: "\\sum_{n=0}^{N-1} |x[n]|^2 = \\frac{1}{N} \\sum_{k=0}^{N-1} |X[k]|^2", used: "Energy conservation in discrete domain", trick: "Total energy in time domain equals total energy in frequency domain" }
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
      { name: "Peak Overshoot", formula: "Mp = e^(-πζ/√(1-ζ²))", latex: "M_p = e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}} \\times 100\\%", used: "Transient response specification", where: "ζ = damping ratio", mistake: "Only valid for underdamped 2nd-order systems (0 < ζ < 1)", trick: "ζ ≈ 0.707 gives ~4.3% overshoot — optimal for most designs" },
      { name: "Settling Time", formula: "ts = 4/(ζωn)", latex: "t_s \\approx \\frac{4}{\\zeta\\omega_n} \\text{ (2\\% criterion)}", used: "Speed of response specification", trick: "ts × ωn = constant for given ζ. Faster response needs higher ωn" },
      { name: "Mason's Gain Formula", formula: "T = Σ(Pk·Δk)/Δ", latex: "T = \\frac{\\sum_{k} P_k \\Delta_k}{\\Delta}", where: "Pk = kth forward path gain, Δ = 1 - Σloops + Σ(non-touching loop pairs) - ...", used: "Signal flow graph analysis", trick: "Avoids block diagram reduction. Δk = Δ with loops touching Pk removed" },
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
      { name: "Frequency Response (CE)", formula: "fL = 1/(2πRCE)", latex: "f_L = \\frac{1}{2\\pi R_{eq} C_{coupling}}, \\quad f_H = \\frac{1}{2\\pi R_{eq} C_{Miller}}", used: "Bandwidth calculation of amplifier stages", mistake: "Miller effect multiplies Cgd by (1+|Av|), drastically reducing fH", trick: "GBW = constant. Higher gain → lower bandwidth" },
      { name: "CMRR", formula: "CMRR = |Ad/Acm|", latex: "\\text{CMRR} = \\left|\\frac{A_d}{A_{cm}}\\right| = 20\\log_{10}\\left(\\frac{A_d}{A_{cm}}\\right) \\text{ dB}", used: "Op-amp and diff-amp quality metric", trick: "Ideal op-amp: CMRR → ∞. Practical: 80–120 dB" },
    ],
  },
  {
    id: "digital",
    name: "Digital Electronics",
    formulas: [
      { name: "De Morgan's Theorem", formula: "(A·B)' = A'+B'", latex: "\\overline{A \\cdot B} = \\bar{A} + \\bar{B}, \\quad \\overline{A + B} = \\bar{A} \\cdot \\bar{B}", used: "Logic simplification, NAND/NOR", trick: "Break the bar, change the sign" },
      { name: "Flip-Flop Excitation", formula: "JK: J=Q(n+1), K=Q'(n+1)", latex: "JK: \\; J = Q_{n+1}, \\; K = \\overline{Q_{n+1}}", used: "Sequential circuit design", mistake: "Don't confuse characteristic and excitation tables" },
      { name: "Shannon's Expansion", formula: "f = x·f(x=1) + x'·f(x=0)", latex: "f(x_1,\\ldots,x_n) = x_1 \\cdot f(1,x_2,\\ldots) + \\bar{x}_1 \\cdot f(0,x_2,\\ldots)", used: "MUX implementation, function decomposition", trick: "Directly maps to 2:1 MUX: x₁ is select, cofactors are inputs" },
      { name: "Number of States", formula: "⌈log₂N⌉ flip-flops", latex: "n = \\lceil \\log_2 N \\rceil \\text{ flip-flops}", used: "Counter design, state machine", trick: "2ⁿ ≥ N, solve for n" },
      { name: "Setup & Hold Time", formula: "Tsetup + Thold ≤ Tclock", latex: "T_{clk} \\geq T_{cq} + T_{comb} + T_{setup}", where: "Tcq = clock-to-Q, Tcomb = combinational delay", used: "Timing analysis, max clock frequency", mistake: "Violating setup time → metastability. Hold violation is worse — can't fix with clock", trick: "fmax = 1/(Tcq + Tcomb_max + Tsetup)" },
      { name: "Propagation Delay", formula: "tpd = (tpHL + tpLH) / 2", latex: "t_{pd} = \\frac{t_{pHL} + t_{pLH}}{2}", used: "Speed analysis", trick: "Critical path determines max frequency" },
      { name: "Quine-McCluskey", formula: "Minimize SOP by combining minterms", latex: "\\text{Group minterms by \\# of 1s} \\to \\text{combine pairs differing by 1 bit} \\to \\text{prime implicants}", used: "Systematic K-Map alternative for >4 variables", trick: "Essential PI = covers a minterm no other PI covers. Always include these first." },
      { name: "Hamming Distance", formula: "d(x,y) = # bits different", latex: "d(x,y) = \\sum_{i} x_i \\oplus y_i, \\quad \\text{Detect: } d_{min}-1, \\quad \\text{Correct: } \\lfloor(d_{min}-1)/2\\rfloor", used: "Error detection & correction codes", trick: "Hamming(7,4): 4 data + 3 parity bits. dmin = 3 → detect 2, correct 1" },
    ],
  },
  {
    id: "comm",
    name: "Communication Systems",
    formulas: [
      { name: "AM Modulation Index", formula: "μ = Am/Ac", latex: "\\mu = \\frac{A_m}{A_c}, \\quad 0 \\leq \\mu \\leq 1", used: "AM transmitter design", mistake: "μ > 1 causes overmodulation", trick: "Total power = Pc(1 + μ²/2)" },
      { name: "FM Bandwidth (Carson)", formula: "BW = 2(Δf + fm)", latex: "BW = 2(\\Delta f + f_m)", used: "FM spectrum allocation", trick: "β = Δf/fm, narrowband if β ≪ 1" },
      { name: "Noise Figure", formula: "NF = 10·log₁₀(F)", latex: "NF = 10 \\cdot \\log_{10}(F), \\quad F = \\frac{SNR_{in}}{SNR_{out}}", used: "Receiver sensitivity", trick: "Friis: F_{total} = F_1 + (F_2-1)/G_1 + ..." },
      { name: "Bit Error Rate (BPSK)", formula: "BER = Q(√(2Eb/N0))", latex: "BER_{BPSK} = Q\\left(\\sqrt{\\frac{2E_b}{N_0}}\\right)", used: "Digital comm performance", trick: "BPSK and QPSK have same BER/bit" },
      { name: "Link Budget", formula: "Pr = Pt + Gt + Gr - Lpath", latex: "P_r = P_t + G_t + G_r - L_{path} \\quad \\text{(dB)}", used: "Wireless link design", trick: "Free space loss = 20log(4πd/λ)" },
      { name: "Shannon Capacity", formula: "C = B·log₂(1 + SNR)", latex: "C = B \\cdot \\log_2\\left(1 + \\frac{P}{N_0 B}\\right)", used: "Theoretical max data rate", trick: "Power-limited: ↑P; BW-limited: ↑B" },
      { name: "BER for M-QAM", formula: "BER ≈ (4/log₂M)·Q(√(3SNR/(M-1)))", latex: "BER_{M\\text{-}QAM} \\approx \\frac{4}{\\log_2 M} \\cdot Q\\left(\\sqrt{\\frac{3 \\cdot SNR}{M-1}}\\right)", used: "Higher order modulation analysis", mistake: "Higher M = more bits/symbol but needs much higher SNR", trick: "16-QAM needs ~10dB more SNR than BPSK for same BER" },
      { name: "Friis Transmission", formula: "Pr/Pt = GtGr(λ/4πd)²", latex: "\\frac{P_r}{P_t} = G_t G_r \\left(\\frac{\\lambda}{4\\pi d}\\right)^2", used: "Free-space link power budget", trick: "Power falls as 1/d². Double distance → 6dB loss" },
    ],
  },
  {
    id: "emag",
    name: "Electromagnetics",
    formulas: [
      { name: "Maxwell's Equations (Differential)", formula: "∇×E = -∂B/∂t", latex: "\\nabla \\times \\vec{E} = -\\frac{\\partial \\vec{B}}{\\partial t}, \\quad \\nabla \\times \\vec{H} = \\vec{J} + \\frac{\\partial \\vec{D}}{\\partial t}", used: "Foundation of all EM theory", trick: "Faraday's law + Ampere's law with displacement current" },
      { name: "Wave Equation", formula: "∇²E = με·∂²E/∂t²", latex: "\\nabla^2 \\vec{E} = \\mu\\varepsilon \\frac{\\partial^2 \\vec{E}}{\\partial t^2}", where: "v = 1/√(με), in free space v = c = 3×10⁸ m/s", used: "EM wave propagation", trick: "v = c/√(εr·μr). Phase velocity in medium is always ≤ c" },
      { name: "Intrinsic Impedance", formula: "η = √(μ/ε)", latex: "\\eta = \\sqrt{\\frac{\\mu}{\\varepsilon}}, \\quad \\eta_0 = \\sqrt{\\frac{\\mu_0}{\\varepsilon_0}} = 377 \\, \\Omega", used: "Wave impedance, reflection/transmission", trick: "η₀ = 120π ≈ 377Ω for free space" },
      { name: "Skin Depth", formula: "δ = √(2/(ωμσ))", latex: "\\delta = \\sqrt{\\frac{2}{\\omega\\mu\\sigma}} = \\frac{1}{\\sqrt{\\pi f \\mu \\sigma}}", used: "RF conductor design, shielding", mistake: "At 1GHz in copper, δ ≈ 2μm — current flows only on surface", trick: "Higher frequency → thinner skin depth → more AC resistance" },
      { name: "Poynting Vector", formula: "S = E × H", latex: "\\vec{S} = \\vec{E} \\times \\vec{H} \\quad \\text{(W/m²)}", used: "Power flow direction and magnitude", trick: "Average power: S_avg = |E|²/(2η)" },
      { name: "Reflection Coefficient", formula: "Γ = (η₂-η₁)/(η₂+η₁)", latex: "\\Gamma = \\frac{\\eta_2 - \\eta_1}{\\eta_2 + \\eta_1}, \\quad T = 1 + \\Gamma = \\frac{2\\eta_2}{\\eta_1 + \\eta_2}", used: "Transmission line and wave boundaries", trick: "Γ = 0 when η₁ = η₂ (matched). |Γ| = 1 for PEC (total reflection)" },
      { name: "Transmission Line Input Z", formula: "Zin = Z0·(ZL+jZ0·tan(βl))/(Z0+jZL·tan(βl))", latex: "Z_{in} = Z_0 \\frac{Z_L + jZ_0 \\tan(\\beta l)}{Z_0 + jZ_L \\tan(\\beta l)}", used: "Impedance transformation, Smith chart", mistake: "At l = λ/4: Zin = Z₀²/ZL (quarter-wave transformer)", trick: "Smith chart is just this equation plotted on complex Γ plane" },
    ],
  },
  {
    id: "network",
    name: "Network Theory",
    formulas: [
      { name: "KVL", formula: "ΣV = 0 (around loop)", latex: "\\sum_{k} V_k = 0 \\quad \\text{(around any closed loop)}", used: "Circuit analysis foundation", trick: "Conservation of energy. Algebraic sum of voltages = 0" },
      { name: "KCL", formula: "ΣI = 0 (at node)", latex: "\\sum_{k} I_k = 0 \\quad \\text{(at any node)}", used: "Nodal analysis", trick: "Conservation of charge. Current in = current out" },
      { name: "Thevenin's Theorem", formula: "Vth = Voc, Rth = Voc/Isc", latex: "V_{th} = V_{oc}, \\quad R_{th} = \\frac{V_{oc}}{I_{sc}}", used: "Circuit simplification, max power transfer", trick: "Any linear circuit → single voltage source + series resistance" },
      { name: "Max Power Transfer", formula: "PL_max when RL = Rth", latex: "P_{L,max} = \\frac{V_{th}^2}{4R_{th}} \\quad \\text{when } R_L = R_{th}", used: "Load matching, antenna design", mistake: "Efficiency is only 50% at max power transfer", trick: "For AC: ZL = Zth* (conjugate match)" },
      { name: "Time Constant", formula: "τ = RC or L/R", latex: "\\tau = RC \\text{ (RC circuit)}, \\quad \\tau = \\frac{L}{R} \\text{ (RL circuit)}", used: "Transient response", trick: "After 5τ, circuit reaches ~99.3% of final value" },
      { name: "Resonant Frequency", formula: "f₀ = 1/(2π√LC)", latex: "f_0 = \\frac{1}{2\\pi\\sqrt{LC}}, \\quad Q = \\frac{f_0}{BW} = \\frac{1}{R}\\sqrt{\\frac{L}{C}}", used: "Filter design, oscillators, tuning circuits", mistake: "Series RLC: impedance minimum at resonance. Parallel: impedance maximum", trick: "Higher Q = sharper selectivity = narrower bandwidth" },
      { name: "Superposition", formula: "Response = Σ individual source responses", latex: "V_{total} = \\sum_k V_k \\text{ (with one source active at a time)}", used: "Multi-source linear circuit analysis", mistake: "Turn off voltage sources = short. Turn off current sources = open", trick: "Only works for linear circuits. Power cannot be superposed!" },
      { name: "Star-Delta Transformation", formula: "R1 = (Rab·Rca)/(Rab+Rbc+Rca)", latex: "R_1 = \\frac{R_{ab}R_{ca}}{R_{ab}+R_{bc}+R_{ca}}", used: "Simplifying bridge networks", trick: "Star resistor = (product of adjacent Delta resistors) / (sum of all Delta resistors)" },
      { name: "Two-Port Z-Parameters", formula: "V1 = Z11·I1 + Z12·I2", latex: "\\begin{bmatrix} V_1 \\\\ V_2 \\end{bmatrix} = \\begin{bmatrix} Z_{11} & Z_{12} \\\\ Z_{21} & Z_{22} \\end{bmatrix} \\begin{bmatrix} I_1 \\\\ I_2 \\end{bmatrix}", used: "Open-circuit impedance network analysis", trick: "Reciprocal if Z12 = Z21. Symmetrical if Z11 = Z22" },
      { name: "Two-Port h-Parameters", formula: "V1 = h11·I1 + h12·V2", latex: "\\begin{bmatrix} V_1 \\\\ I_2 \\end{bmatrix} = \\begin{bmatrix} h_{11} & h_{12} \\\\ h_{21} & h_{22} \\end{bmatrix} \\begin{bmatrix} I_1 \\\\ V_2 \\end{bmatrix}", used: "BJT transistor modeling", trick: "Hybrid: mixture of open and short circuit parameters" }
    ],
  },
  {
    id: "power",
    name: "Power Electronics",
    formulas: [
      { name: "Half-Wave Rectifier", formula: "Vdc = Vm/π", latex: "V_{dc} = \\frac{V_m}{\\pi}, \\quad V_{rms} = \\frac{V_m}{2}, \\quad \\text{Ripple} = 1.21", used: "Basic AC-DC conversion", mistake: "PIV = Vm for half-wave, 2Vm for bridge", trick: "Ripple factor = √((Vrms/Vdc)² - 1)" },
      { name: "Full-Wave Rectifier", formula: "Vdc = 2Vm/π", latex: "V_{dc} = \\frac{2V_m}{\\pi}, \\quad V_{rms} = \\frac{V_m}{\\sqrt{2}}, \\quad \\text{Ripple} = 0.48", used: "Better AC-DC conversion", trick: "Full-wave has double the frequency → easier to filter" },
      { name: "Buck Converter", formula: "Vo = D·Vin", latex: "V_o = D \\cdot V_{in}, \\quad D = \\frac{t_{on}}{T}", where: "D = duty cycle (0 to 1)", used: "Step-down DC-DC conversion", trick: "Vo ≤ Vin always. Inductor smooths current, capacitor smooths voltage" },
      { name: "Boost Converter", formula: "Vo = Vin/(1-D)", latex: "V_o = \\frac{V_{in}}{1 - D}", used: "Step-up DC-DC conversion", mistake: "Theoretical gain → ∞ as D → 1, but parasitic losses limit it", trick: "Vo ≥ Vin always. Energy stored in inductor during on-time" },
      { name: "Buck-Boost Converter", formula: "Vo = -D·Vin/(1-D)", latex: "V_o = -\\frac{D \\cdot V_{in}}{1 - D}", used: "Inverting DC-DC conversion", trick: "Output polarity is inverted. D < 0.5 → buck, D > 0.5 → boost" },
      { name: "Thyristor Controlled Rectifier", formula: "Vdc = (Vm/π)(1+cosα)", latex: "V_{dc} = \\frac{V_m}{\\pi}(1 + \\cos\\alpha) \\quad \\text{(single-phase half-controlled)}", used: "Controlled AC-DC conversion", trick: "α = firing angle. α = 0° → max Vdc. α = 180° → Vdc = 0" },
    ],
  },
  {
    id: "micro",
    name: "Microprocessors",
    formulas: [
      { name: "CPU Time", formula: "CPU Time = IC × CPI × Tc", latex: "T_{CPU} = IC \\times CPI \\times T_{clk} = \\frac{IC \\times CPI}{f_{clk}}", where: "IC = instruction count, CPI = cycles per instruction", used: "Processor performance analysis", trick: "MIPS = fclk / (CPI × 10⁶). Higher MIPS ≠ always faster (instruction mix varies)" },
      { name: "Amdahl's Law", formula: "Speedup = 1/((1-f) + f/S)", latex: "\\text{Speedup} = \\frac{1}{(1-f) + \\frac{f}{S}}", where: "f = fraction parallelizable, S = speedup of parallel part", used: "Parallel computing limits", mistake: "Even infinite speedup of parallel part is limited by serial fraction", trick: "If 5% is serial, max speedup = 20× regardless of cores" },
      { name: "Cache Hit Rate", formula: "AMAT = Hit_time + Miss_rate × Miss_penalty", latex: "AMAT = T_{hit} + (1-H) \\times T_{miss}", where: "H = hit rate, AMAT = average memory access time", used: "Memory hierarchy analysis", trick: "L1 miss → L2 check → L3 check → main memory. Each level 5-10× slower" },
      { name: "Pipeline Speedup", formula: "S = n·k / (k + n - 1)", latex: "S = \\frac{n \\cdot k}{k + (n-1)}", where: "n = # instructions, k = # pipeline stages", used: "Pipeline efficiency", trick: "As n → ∞, S → k (ideal). Hazards reduce actual speedup" },
      { name: "Memory Address Bits", formula: "Address bits = log₂(memory size)", latex: "\\text{Address bits} = \\log_2(\\text{Memory size in bytes})", used: "Memory system design", trick: "4GB → 32 bits. 64KB → 16 bits. Cache: tag + index + offset" },
      { name: "DMA Transfer Time", formula: "T = N × (Tbus + Tmem)", latex: "T_{DMA} = \\frac{N \\times \\text{word\\_size}}{\\text{bus\\_bandwidth}}", used: "I/O performance analysis", trick: "DMA frees CPU during bulk transfers. Interrupt only at completion" },
      { name: "Cache Mapping (Direct)", formula: "Block Address % Cache Blocks", latex: "\\text{Index} = (\\text{Block Address}) \\bmod (\\text{Number of Blocks in Cache})", used: "Cache memory organization", mistake: "High conflict miss rate if multiple accessed blocks map to same index", trick: "Fully associative has no index, only tag and offset" }
    ],
  },
  {
    id: "semiconductor",
    name: "Semiconductor Physics",
    formulas: [
      { name: "Mass Action Law", formula: "n·p = ni²", latex: "n \\cdot p = n_i^2", used: "Carrier concentration calculations", trick: "Valid in thermal equilibrium. Doping with ND primarily increases n, decreasing p." },
      { name: "Conductivity", formula: "σ = q(n·μn + p·μp)", latex: "\\sigma = q(n\\mu_n + p\\mu_p)", used: "Resistivity and sheet resistance", mistake: "Mobility (μ) decreases with higher doping due to impurity scattering", trick: "In N-type, σ ≈ q·ND·μn" },
      { name: "Built-in Potential (PN)", formula: "V0 = VT·ln(NaNd/ni²)", latex: "V_0 = V_T \\ln\\left(\\frac{N_A N_D}{n_i^2}\\right)", where: "VT = kT/q ≈ 26mV at 300K", used: "Diode junction analysis", trick: "Cannot be measured with a voltmeter!" },
      { name: "Depletion Width", formula: "W = √[2ε/q(1/Na+1/Nd)(V0-VD)]", latex: "W = \\sqrt{\\frac{2\\varepsilon}{q}\\left(\\frac{1}{N_A}+\\frac{1}{N_D}\\right)(V_0 - V_D)}", used: "Junction capacitance, breakdown voltage", trick: "Wider on the lightly doped side" }
    ]
  }
];

const FormulaEngine = () => {
  const [activeSubject, setActiveSubject] = useState<string>("signals");
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const currentSubject = subjects.find((s) => s.id === activeSubject)!;

  const filteredFormulas = searchQuery.trim()
    ? currentSubject.formulas.filter(f =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.formula.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.used.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : currentSubject.formulas;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Formula Engine</h2>
        <p className="text-sm text-muted-foreground mt-1">ECE formulas with KaTeX rendering, exam tips & common mistakes</p>
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

      {/* Search */}
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search formulas..."
        className="w-full px-4 py-2 rounded-lg border border-border bg-card text-foreground font-mono text-sm placeholder:text-muted-foreground"
      />

      {/* Formula count */}
      <div className="text-xs font-mono text-muted-foreground">
        {filteredFormulas.length} formula{filteredFormulas.length !== 1 ? "s" : ""} in {currentSubject.name}
      </div>

      {/* Formulas */}
      <div className="space-y-2">
        {filteredFormulas.map((f) => {
          const isExpanded = expandedFormula === f.name;
          return (
            <div key={f.name} className="rounded-xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => setExpandedFormula(isExpanded ? null : f.name)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="text-sm font-medium text-foreground">{f.name}</div>
                  <div className="mt-2 w-full text-foreground/80 font-serif">
                    <KaTeXInline latex={f.latex} />
                  </div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
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
                      <div className="text-sm text-destructive/90"><span className="font-bold">Common mistake:</span> {f.mistake}</div>
                    </div>
                  )}
                  {f.trick && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/15">
                      <Lightbulb size={14} className="text-primary mt-0.5 shrink-0" />
                      <div className="text-sm text-primary/90"><span className="font-bold">Quick trick:</span> {f.trick}</div>
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

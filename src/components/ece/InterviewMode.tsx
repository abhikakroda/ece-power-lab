import { useState } from "react";
import { BrainCircuit, ChevronDown, ChevronRight, AlertTriangle, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  q: string;
  answer: string;
  followUp: string;
  trap?: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

interface Subject {
  id: string;
  name: string;
  questions: Question[];
}

const subjects: Subject[] = [
  {
    id: "signals",
    name: "Signals & Systems",
    questions: [
      { q: "What is the difference between Fourier Transform and Laplace Transform?", answer: "Fourier Transform decomposes signals into sinusoidal components (purely imaginary axis, s=jω). Laplace Transform is a generalization that includes a real part σ (s=σ+jω), making it applicable to unstable and transient signals. FT exists only when signal has finite energy; LT uses ROC for convergence.", followUp: "When would LT converge but FT not exist?", trap: "Interviewer may ask if FT is a special case of LT — it is, but only when ROC includes jω axis", difficulty: "Medium" },
      { q: "Explain the significance of ROC in Z-transform", answer: "Region of Convergence determines which sequence corresponds to a given Z-transform (uniqueness). The ROC must be specified because different sequences can have the same Z-transform expression. For causal systems, ROC is outside the outermost pole. For stable systems, ROC includes unit circle.", followUp: "Can a system be both causal and stable? What does the ROC look like?", trap: "They might give you a Z-transform without ROC and ask you to find the sequence — trick: you can't without ROC!", difficulty: "Hard" },
      { q: "What is aliasing and how do you prevent it?", answer: "Aliasing occurs when a signal is sampled below the Nyquist rate (fs < 2fmax), causing high-frequency components to appear as lower frequencies. Prevention: anti-aliasing low-pass filter before sampling to remove frequencies above fs/2.", followUp: "What happens to a 7kHz signal sampled at 10kHz?", difficulty: "Easy" },
      { q: "Explain convolution theorem and its practical significance", answer: "Convolution in time domain equals multiplication in frequency domain (and vice versa). Practically, this means we can compute LTI system output by multiplying transfer functions instead of integrating convolution — much simpler in frequency domain.", followUp: "How does this apply to FIR filter design?", difficulty: "Medium" },
      { q: "What is causality and how do you determine if a system is causal?", answer: "A causal system's output depends only on present and past inputs (h(t)=0 for t<0). For LTI: impulse response is zero for t<0. In Z-domain: ROC extends outward from outermost pole. In s-domain: ROC is right half-plane from rightmost pole.", followUp: "Is a non-causal system physically realizable?", trap: "They might ask about anti-causal systems — output depends only on future inputs", difficulty: "Medium" },
    ],
  },
  {
    id: "analog",
    name: "Analog Electronics",
    questions: [
      { q: "Why is MOSFET preferred over BJT in digital circuits?", answer: "MOSFET has: (1) near-zero gate current = low power, (2) simpler fabrication = higher integration density, (3) complementary pairs (CMOS) enable rail-to-rail output and zero static power, (4) better scaling with technology node. BJT has higher gm/area but higher static power.", followUp: "Where is BJT still preferred over MOSFET?", trap: "They might say 'MOSFET is always better' — no, BJT has higher gm and better linearity for RF/analog", difficulty: "Medium" },
      { q: "Explain virtual ground concept in op-amps", answer: "In an ideal op-amp with negative feedback, the differential input voltage is driven to zero (V+ ≈ V-). In inverting config, V+ is grounded, so V- is at 0V — a 'virtual ground.' No current flows into the op-amp (infinite input impedance), so we can use KCL at the virtual ground node.", followUp: "Does virtual ground exist in open-loop op-amp?", difficulty: "Easy" },
      { q: "What is Miller Effect and why does it matter?", answer: "Miller Effect multiplies a feedback capacitance by (1+Av), dramatically increasing the effective input capacitance. In common emitter/source amplifiers, Cgd/Cbc between output and input gets multiplied, reducing bandwidth. This is the dominant bandwidth limitation in single-stage amplifiers.", followUp: "How does cascode configuration reduce Miller Effect?", trap: "Don't confuse Miller Effect with Miller theorem — theorem is the general technique, effect is the specific capacitance problem", difficulty: "Hard" },
      { q: "Explain the difference between Class A, B, and AB amplifiers", answer: "Class A: transistor conducts full 360° — best linearity, worst efficiency (~25%). Class B: each transistor conducts 180° — crossover distortion, ~78.5% efficiency. Class AB: slight bias to eliminate crossover, conducts slightly more than 180° — good compromise of linearity and efficiency.", followUp: "What causes crossover distortion in Class B?", difficulty: "Easy" },
      { q: "What is CMRR and why is it important?", answer: "Common Mode Rejection Ratio = Ad/Acm (differential gain / common mode gain). Ideally infinite. It measures an amplifier's ability to reject signals common to both inputs (noise, interference). CMRR > 80dB is typical for good op-amps. In dB: CMRR = 20log(Ad/Acm).", followUp: "What degrades CMRR in real circuits?", difficulty: "Medium" },
    ],
  },
  {
    id: "digital",
    name: "Digital Electronics",
    questions: [
      { q: "Explain setup time, hold time, and metastability", answer: "Setup time: minimum time data must be stable BEFORE clock edge. Hold time: minimum time data must be stable AFTER clock edge. Violating either causes metastability — flip-flop output oscillates between 0 and 1 for unpredictable duration. This is a critical failure mode in clock domain crossing.", followUp: "How do you handle clock domain crossing safely?", trap: "Metastability is NOT a glitch — it can last arbitrarily long in theory", difficulty: "Hard" },
      { q: "What is the difference between FPGA and ASIC?", answer: "FPGA: Field-Programmable, reconfigurable, fast time-to-market, higher per-unit cost, lower performance/power efficiency. Uses LUTs. ASIC: Application-Specific, fixed function, long design cycle, high NRE cost, lower per-unit cost at volume, optimized performance/power.", followUp: "At what volume does ASIC become cost-effective?", difficulty: "Easy" },
      { q: "Explain pipeline architecture and its tradeoffs", answer: "Pipelining divides combinational logic into stages with registers between them. Increases throughput (higher clock freq) but adds latency (more clock cycles per operation). Hazards: data hazards (dependencies), control hazards (branches), structural hazards (resource conflicts).", followUp: "How do you handle data hazards?", difficulty: "Medium" },
      { q: "What is clock skew and clock jitter?", answer: "Clock skew: spatial variation — clock arrives at different flip-flops at different times due to routing. Can cause setup/hold violations. Clock jitter: temporal variation — clock edge varies from ideal position over time. Both limit maximum clock frequency.", followUp: "Which is worse for design: skew or jitter?", difficulty: "Medium" },
      { q: "Explain the concept of critical path", answer: "The critical path is the longest combinational delay path between any two sequential elements (flip-flops). It determines the maximum clock frequency: fmax = 1/(Tcritical + Tsetup + Tskew). To increase speed: reduce logic depth, add pipeline stages, or use faster cells.", followUp: "How does retiming help with critical path?", difficulty: "Medium" },
    ],
  },
  {
    id: "comm",
    name: "Communication Systems",
    questions: [
      { q: "Why is FM preferred over AM for high-quality audio?", answer: "FM provides: (1) better noise immunity — noise adds to amplitude, not frequency, (2) constant amplitude = efficient power amplifiers, (3) capture effect — stronger signal suppresses weaker, (4) pre-emphasis/de-emphasis improves SNR. But FM requires more bandwidth.", followUp: "Then why is AM still used for broadcasting?", trap: "FM is NOT always better — in mobile comm, digital modulation surpasses both", difficulty: "Easy" },
      { q: "Explain the concept of channel capacity", answer: "Shannon's theorem: C = B·log₂(1+SNR). Maximum error-free data rate over a noisy channel. No coding scheme can exceed this. Practical systems achieve ~70-90% of capacity. Key insight: can trade bandwidth for SNR and vice versa.", followUp: "How do modern 5G systems approach channel capacity?", difficulty: "Medium" },
      { q: "What is ISI and how do you mitigate it?", answer: "Inter-Symbol Interference: when a transmitted symbol spreads and interferes with adjacent symbols due to channel bandwidth limitation and multipath. Mitigation: raised cosine filter (Nyquist criterion), equalization (ZF, MMSE, DFE), OFDM (converts wideband to narrowband subcarriers).", followUp: "What is the Nyquist criterion for zero ISI?", trap: "Don't confuse ISI with ICI (Inter-Carrier Interference in OFDM)", difficulty: "Hard" },
      { q: "Explain OFDM and why it's used in 4G/5G", answer: "Orthogonal Frequency Division Multiplexing: divides wideband channel into many narrowband subcarriers that are orthogonal. Benefits: robust to multipath (each subcarrier sees flat fading), efficient spectrum use, easy equalization (one-tap per subcarrier), implemented efficiently via FFT.", followUp: "What is the PAPR problem in OFDM?", difficulty: "Medium" },
      { q: "What is the difference between SNR, Eb/N0, and C/N?", answer: "SNR = signal power / noise power (in bandwidth B). Eb/N0 = energy per bit / noise density — fundamental measure independent of bandwidth and modulation. C/N = carrier to noise ratio. Relationship: Eb/N0 = (C/N)·(B/R) where R is data rate.", followUp: "Why is Eb/N0 the standard metric for digital comm?", difficulty: "Hard" },
    ],
  },
];

const difficultyColors = { Easy: "text-primary", Medium: "text-accent", Hard: "text-destructive" };

const InterviewMode = () => {
  const [activeSubject, setActiveSubject] = useState("signals");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  const current = subjects.find((s) => s.id === activeSubject)!;

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center">
          <BrainCircuit size={20} className="text-chart-4" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Interview Mode</h2>
          <p className="text-sm text-muted-foreground font-mono">Top Questions • Deep Answers • Trap Alerts</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => { setActiveSubject(s.id); setExpandedQ(null); }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              activeSubject === s.id ? "bg-muted border-border text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {current.questions.map((q, idx) => {
          const isExpanded = expandedQ === idx;
          return (
            <div key={idx} className="rounded-xl bg-card border border-border overflow-hidden">
              <button
                onClick={() => setExpandedQ(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-mono ${difficultyColors[q.difficulty]}`}>[{q.difficulty}]</span>
                    <span className="text-xs text-muted-foreground font-mono">Q{idx + 1}</span>
                  </div>
                  <div className="text-sm font-medium text-foreground">{q.q}</div>
                </div>
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-border pt-3">
                  <div>
                    <div className="text-xs font-mono text-chart-4 mb-1">ANSWER</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">{q.answer}</div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                    <Target size={14} className="text-secondary mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-mono text-secondary mb-1">FOLLOW-UP QUESTION</div>
                      <div className="text-sm text-secondary/80">{q.followUp}</div>
                    </div>
                  </div>
                  {q.trap && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-mono text-destructive mb-1">⚠ TRAP ALERT</div>
                        <div className="text-sm text-destructive/80">{q.trap}</div>
                      </div>
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

export default InterviewMode;

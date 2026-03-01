import { useState, useEffect, useCallback } from "react";
import { Timer, CheckCircle, XCircle, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Problem {
  question: string;
  options: string[];
  correct: number;
  solution: string;
  topic: string;
}

const problems: Problem[] = [
  { question: "A series RLC circuit has R=10Ω, L=1mH, C=10μF. Find the resonant frequency.", options: ["1.59 kHz", "15.9 kHz", "159 Hz", "5.03 kHz"], correct: 0, solution: "f₀ = 1/(2π√LC) = 1/(2π√(10⁻³ × 10⁻⁵)) = 1/(2π × 3.16×10⁻⁴) = 1591.5 Hz ≈ 1.59 kHz", topic: "Circuit Analysis" },
  { question: "A signal x(t) = 3cos(200πt) + 4sin(600πt) is sampled. Minimum sampling frequency?", options: ["300 Hz", "600 Hz", "400 Hz", "200 Hz"], correct: 1, solution: "fmax = max(200π/(2π), 600π/(2π)) = max(100, 300) = 300 Hz. Nyquist: fs ≥ 2×300 = 600 Hz", topic: "Signals & Systems" },
  { question: "An op-amp inverting amplifier has Rf=100kΩ, R1=10kΩ. Input = 0.5V. Output?", options: ["-5V", "5V", "-50V", "0.5V"], correct: 0, solution: "Av = -Rf/R1 = -100k/10k = -10. Vout = -10 × 0.5 = -5V", topic: "Analog Electronics" },
  { question: "How many flip-flops needed for a mod-12 counter?", options: ["3", "4", "5", "12"], correct: 1, solution: "⌈log₂(12)⌉ = ⌈3.58⌉ = 4 flip-flops. 2⁴ = 16 ≥ 12 ✓, 2³ = 8 < 12 ✗", topic: "Digital Electronics" },
  { question: "An AM signal has carrier power 10W and modulation index 0.5. Total power?", options: ["11.25W", "10.5W", "12.5W", "15W"], correct: 0, solution: "Pt = Pc(1 + μ²/2) = 10(1 + 0.25/2) = 10 × 1.125 = 11.25W", topic: "Communication" },
  { question: "A BJT has β=100, IB=20μA. Find IC.", options: ["2mA", "0.2mA", "20mA", "200μA"], correct: 0, solution: "IC = β × IB = 100 × 20μA = 2000μA = 2mA", topic: "Analog Electronics" },
  { question: "Transfer function G(s) = 10/(s²+3s+2). Find DC gain.", options: ["5", "10", "2", "3.33"], correct: 0, solution: "DC gain = G(0) = 10/(0+0+2) = 10/2 = 5", topic: "Control Systems" },
  { question: "The Nyquist rate for x(t) = sinc(200t) is:", options: ["200 Hz", "400 Hz", "100 Hz", "800 Hz"], correct: 0, solution: "sinc(200t) has bandwidth B = 200/2 = 100 Hz. Nyquist rate = 2B = 200 Hz", topic: "Signals & Systems" },
  { question: "Channel bandwidth 4kHz, SNR = 31. Maximum data rate (Shannon)?", options: ["20 kbps", "16 kbps", "32 kbps", "8 kbps"], correct: 0, solution: "C = B·log₂(1+SNR) = 4000 × log₂(32) = 4000 × 5 = 20,000 bps = 20 kbps", topic: "Communication" },
  { question: "MOSFET with μnCox=200μA/V², W/L=10, Vth=1V, VGS=3V (saturation). ID?", options: ["4mA", "2mA", "0.4mA", "8mA"], correct: 1, solution: "ID = (μnCox/2)(W/L)(VGS-Vth)² = (200×10⁻⁶/2)(10)(3-1)² = 10⁻⁴ × 10 × 4 = 2mA", topic: "Analog Electronics" },
];

const DRILL_TIME = 120; // seconds

const NumericalDrill = () => {
  const [state, setState] = useState<"idle" | "active" | "review">("idle");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(problems.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(DRILL_TIME);
  const [shuffled, setShuffled] = useState<Problem[]>([]);

  const startDrill = useCallback(() => {
    const s = [...problems].sort(() => Math.random() - 0.5).slice(0, 5);
    setShuffled(s);
    setAnswers(Array(5).fill(null));
    setCurrentQ(0);
    setTimeLeft(DRILL_TIME);
    setState("active");
  }, []);

  useEffect(() => {
    if (state !== "active") return;
    if (timeLeft <= 0) { setState("review"); return; }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [state, timeLeft]);

  const selectAnswer = (idx: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = idx;
    setAnswers(newAnswers);
  };

  const nextQ = () => {
    if (currentQ < shuffled.length - 1) setCurrentQ((p) => p + 1);
    else setState("review");
  };

  const prevQ = () => {
    if (currentQ > 0) setCurrentQ((p) => p - 1);
  };

  const score = answers.reduce((acc: number, a, i) => acc + (a === shuffled[i]?.correct ? 1 : 0), 0);
  const accuracy = shuffled.length > 0 ? Math.round((score / shuffled.length) * 100) : 0;
  const timeTaken = DRILL_TIME - timeLeft;

  if (state === "idle") {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
            <Timer size={20} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Numerical Drill</h2>
            <p className="text-sm text-muted-foreground font-mono">Timed Tests • Step-by-Step Solutions</p>
          </div>
        </div>

        <div className="max-w-lg mx-auto text-center space-y-6 py-16">
          <div className="w-24 h-24 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <Timer size={40} className="text-destructive" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Ready for the Drill?</h3>
          <p className="text-muted-foreground text-base">5 random numerical problems • 2 minutes • Step-by-step solutions after submission</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-card border border-border">
              <div className="text-lg font-mono font-bold text-primary">5</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <div className="text-lg font-mono font-bold text-accent">2:00</div>
              <div className="text-xs text-muted-foreground">Time Limit</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border">
              <div className="text-lg font-mono font-bold text-secondary">MCQ</div>
              <div className="text-xs text-muted-foreground">Format</div>
            </div>
          </div>
          <Button onClick={startDrill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
            <Play size={16} /> START DRILL
          </Button>
        </div>
      </div>
    );
  }

  if (state === "active") {
    const problem = shuffled[currentQ];
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={16} className={cn("text-destructive", timeLeft < 30 && "animate-pulse-glow")} />
            <span className={cn("font-mono text-lg font-bold", timeLeft < 30 ? "text-destructive" : "text-foreground")}>
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
          <div className="flex gap-1">
            {shuffled.map((_, i) => (
              <div key={i} className={cn("w-8 h-8 rounded-md flex items-center justify-center text-xs font-mono border transition-all cursor-pointer",
                i === currentQ ? "border-primary bg-primary/20 text-primary" :
                answers[i] !== null ? "border-border bg-muted text-foreground" : "border-border text-muted-foreground"
              )} onClick={() => setCurrentQ(i)}>{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{problem.topic}</span>
            <span className="text-xs font-mono text-muted-foreground">Q{currentQ + 1}/{shuffled.length}</span>
          </div>
          <p className="text-lg md:text-xl text-foreground font-medium leading-relaxed">{problem.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {problem.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => selectAnswer(idx)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all text-base",
                answers[currentQ] === idx
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <span className="font-mono text-xs mr-3 text-muted-foreground">{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevQ} disabled={currentQ === 0} className="border-border text-muted-foreground">Previous</Button>
          <Button onClick={nextQ} className="bg-primary text-primary-foreground">
            {currentQ === shuffled.length - 1 ? "Submit" : "Next"}
          </Button>
        </div>
      </div>
    );
  }

  // Review
  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
          <Timer size={20} className="text-destructive" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Drill Results</h2>
          <p className="text-sm text-muted-foreground font-mono">Performance Analysis</p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border text-center">
          <div className={cn("text-3xl font-mono font-bold", accuracy >= 80 ? "text-primary" : accuracy >= 50 ? "text-accent" : "text-destructive")}>{accuracy}%</div>
          <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border text-center">
          <div className="text-3xl font-mono font-bold text-secondary">{score}/{shuffled.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Correct</div>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border text-center">
          <div className="text-3xl font-mono font-bold text-accent">{timeTaken}s</div>
          <div className="text-xs text-muted-foreground mt-1">Time Taken</div>
        </div>
      </div>

      {/* Solutions */}
      <div className="space-y-4">
        {shuffled.map((p, i) => {
          const isCorrect = answers[i] === p.correct;
          return (
            <div key={i} className={cn("p-4 rounded-xl border", isCorrect ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20")}>
              <div className="flex items-start gap-3">
                {isCorrect ? <CheckCircle size={18} className="text-primary mt-0.5 shrink-0" /> : <XCircle size={18} className="text-destructive mt-0.5 shrink-0" />}
                <div className="flex-1 space-y-2">
                  <div className="text-base font-medium text-foreground">{p.question}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Your answer: <span className={isCorrect ? "text-primary" : "text-destructive"}>{answers[i] !== null ? p.options[answers[i]!] : "Not answered"}</span>
                    {!isCorrect && <> • Correct: <span className="text-primary">{p.options[p.correct]}</span></>}
                  </div>
                  <div className="text-sm font-mono text-muted-foreground bg-muted p-4 rounded-lg mt-2">
                    💡 {p.solution}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={startDrill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2">
        <RotateCcw size={16} /> RETRY DRILL
      </Button>
    </div>
  );
};

export default NumericalDrill;

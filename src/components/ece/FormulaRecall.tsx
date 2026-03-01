import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Play, RotateCcw, Clock, CheckCircle2, XCircle, Zap, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import katex from "katex";

interface RecallFormula {
  name: string;
  subject: string;
  answer: string;
  latex: string;
  keywords: string[];
  constants?: string[];
  units?: string[];
}

const formulaBank: RecallFormula[] = [
  { name: "Fourier Transform", subject: "Signals", answer: "X(w) = integral x(t) e^(-jwt) dt", latex: "X(\\omega) = \\int_{-\\infty}^{\\infty} x(t) e^{-j\\omega t} dt", keywords: ["integral", "e", "jwt", "jωt", "jωt", "x(t)", "dt", "e^(-jwt)", "e^-jwt"], constants: ["j"], units: [] },
  { name: "Laplace Transform", subject: "Signals", answer: "X(s) = integral 0 to inf x(t) e^(-st) dt", latex: "X(s) = \\int_0^{\\infty} x(t) e^{-st} dt", keywords: ["integral", "e", "st", "x(t)", "dt", "e^(-st)", "e^-st", "0", "inf"], constants: ["s"], units: [] },
  { name: "Nyquist Rate", subject: "Signals", answer: "fs >= 2 fmax", latex: "f_s \\geq 2 f_{\\max}", keywords: ["2", "fmax", "fs", ">=", "≥"], constants: [], units: ["hz", "Hz"] },
  { name: "Convolution Integral", subject: "Signals", answer: "y(t) = integral x(tau) h(t-tau) dtau", latex: "y(t) = \\int x(\\tau) h(t-\\tau) d\\tau", keywords: ["integral", "x", "h", "tau", "τ", "t-tau", "t-τ"], constants: [], units: [] },
  { name: "Inverting Op-Amp Gain", subject: "Analog", answer: "Av = -Rf/R1", latex: "A_v = -\\frac{R_f}{R_1}", keywords: ["-", "rf", "r1", "rf/r1", "-rf/r1", "/"], constants: [], units: [] },
  { name: "Non-Inverting Op-Amp Gain", subject: "Analog", answer: "Av = 1 + Rf/R1", latex: "A_v = 1 + \\frac{R_f}{R_1}", keywords: ["1", "+", "rf", "r1", "rf/r1", "1+rf/r1"], constants: [], units: [] },
  { name: "BJT Current Gain (β)", subject: "Analog", answer: "β = Ic/Ib", latex: "\\beta = \\frac{I_C}{I_B}", keywords: ["ic", "ib", "ic/ib", "/"], constants: [], units: ["A", "ampere"] },
  { name: "MOSFET Saturation Current", subject: "Analog", answer: "Id = (unCox/2)(W/L)(Vgs-Vth)^2", latex: "I_D = \\frac{\\mu_n C_{ox}}{2} \\frac{W}{L}(V_{GS}-V_{th})^2", keywords: ["un", "μn", "cox", "w/l", "w", "l", "vgs", "vth", "^2", "squared", "/2"], constants: ["μn", "Cox"], units: ["A"] },
  { name: "Transconductance (gm)", subject: "Analog", answer: "gm = 2Id/(Vgs-Vth)", latex: "g_m = \\frac{2I_D}{V_{GS}-V_{th}}", keywords: ["2", "id", "vgs", "vth", "2id", "/"], constants: [], units: ["S", "siemens", "A/V"] },
  { name: "De Morgan's Theorem", subject: "Digital", answer: "(AB)' = A' + B'", latex: "\\overline{AB} = \\bar{A} + \\bar{B}", keywords: ["a'", "b'", "+", "complement", "bar", "not"], constants: [], units: [] },
  { name: "Shannon Channel Capacity", subject: "Comm", answer: "C = B log2(1+SNR)", latex: "C = B \\log_2(1 + SNR)", keywords: ["b", "log", "log2", "snr", "1+snr", "1+", "bandwidth"], constants: [], units: ["bps", "bits/s"] },
  { name: "AM Modulation Index", subject: "Comm", answer: "μ = Am/Ac", latex: "\\mu = \\frac{A_m}{A_c}", keywords: ["am", "ac", "am/ac", "/"], constants: [], units: [] },
  { name: "Carson's Rule (FM BW)", subject: "Comm", answer: "BW = 2(Δf + fm)", latex: "BW = 2(\\Delta f + f_m)", keywords: ["2", "delta", "Δf", "fm", "+", "2("], constants: [], units: ["hz", "Hz"] },
  { name: "Transfer Function", subject: "Control", answer: "G(s) = C(s)/R(s)", latex: "G(s) = \\frac{C(s)}{R(s)}", keywords: ["c(s)", "r(s)", "/", "y(s)", "x(s)"], constants: [], units: [] },
  { name: "Gain Margin", subject: "Control", answer: "GM = -20 log|G(jwpc)| dB", latex: "GM = -20\\log|G(j\\omega_{pc})| \\text{ dB}", keywords: ["-20", "log", "g(j", "db", "phase crossover"], constants: [], units: ["dB"] },
  { name: "Phase Margin", subject: "Control", answer: "PM = 180 + angle G(jwgc)", latex: "PM = 180° + \\angle G(j\\omega_{gc})", keywords: ["180", "+", "angle", "∠", "gain crossover"], constants: [], units: ["degrees", "°"] },
  { name: "Steady State Error (Step)", subject: "Control", answer: "ess = 1/(1+Kp)", latex: "e_{ss} = \\frac{1}{1+K_p}", keywords: ["1", "kp", "1+kp", "/", "1/(1+kp)"], constants: ["Kp"], units: [] },
  { name: "Propagation Delay", subject: "Digital", answer: "tpd = (tpHL + tpLH)/2", latex: "t_{pd} = \\frac{t_{pHL}+t_{pLH}}{2}", keywords: ["tphl", "tplh", "+", "/2", "2"], constants: [], units: ["s", "ns", "seconds"] },
  { name: "Noise Figure", subject: "Comm", answer: "NF = 10 log10(F)", latex: "NF = 10\\log_{10}(F)", keywords: ["10", "log", "f", "snrin", "snrout"], constants: [], units: ["dB"] },
  { name: "Z-Transform", subject: "Signals", answer: "X(z) = sum x[n] z^(-n)", latex: "X(z) = \\sum x[n] z^{-n}", keywords: ["sum", "σ", "Σ", "x[n]", "z^-n", "z^(-n)", "z"], constants: [], units: [] },
];

type GameState = "idle" | "playing" | "feedback" | "results";

interface AttemptResult {
  formula: RecallFormula;
  userAnswer: string;
  score: number;
  timeUsed: number;
  feedback: string[];
}

function scoreAnswer(formula: RecallFormula, userAnswer: string): { score: number; feedback: string[] } {
  const input = userAnswer.toLowerCase().replace(/\s+/g, " ").trim();
  if (!input) return { score: 0, feedback: ["No answer provided"] };

  const feedback: string[] = [];
  let matchedKeywords = 0;

  for (const kw of formula.keywords) {
    if (input.includes(kw.toLowerCase())) matchedKeywords++;
  }

  const keywordRatio = formula.keywords.length > 0 ? matchedKeywords / formula.keywords.length : 0;

  // Check constants
  if (formula.constants && formula.constants.length > 0) {
    const missingConstants = formula.constants.filter(c => !input.includes(c.toLowerCase()));
    if (missingConstants.length > 0) feedback.push(`Missing constant(s): ${missingConstants.join(", ")}`);
  }

  // Check units
  if (formula.units && formula.units.length > 0) {
    const hasUnit = formula.units.some(u => input.includes(u.toLowerCase()));
    if (!hasUnit && formula.units.length > 0 && formula.units[0]) {
      feedback.push(`Consider units: ${formula.units.join(" or ")}`);
    }
  }

  // Score
  let score: number;
  if (keywordRatio >= 0.8) { score = 100; feedback.unshift("Excellent recall!"); }
  else if (keywordRatio >= 0.6) { score = 75; feedback.unshift("Good — minor details missing"); }
  else if (keywordRatio >= 0.35) { score = 50; feedback.unshift("Partial recall — review needed"); }
  else if (keywordRatio > 0) { score = 25; feedback.unshift("Weak recall — study this formula"); }
  else { score = 0; feedback.unshift("Incorrect — review the formula"); }

  return { score, feedback };
}

const KaTeXRender = ({ latex, display = false }: { latex: string; display?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      try { katex.render(latex, ref.current, { throwOnError: false, displayMode: display }); }
      catch { if (ref.current) ref.current.textContent = latex; }
    }
  }, [latex, display]);
  return <div ref={ref} />;
};

const FormulaRecall = () => {
  const [state, setState] = useState<GameState>("idle");
  const [timeLimit, setTimeLimit] = useState(10);
  const [questionCount, setQuestionCount] = useState(10);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [userAnswer, setUserAnswer] = useState("");
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [currentFormulas, setCurrentFormulas] = useState<RecallFormula[]>([]);
  const [lastResult, setLastResult] = useState<AttemptResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = useCallback(() => {
    const shuffled = [...formulaBank].sort(() => Math.random() - 0.5).slice(0, questionCount);
    setCurrentFormulas(shuffled);
    setCurrentIndex(0);
    setResults([]);
    setUserAnswer("");
    setLastResult(null);
    setTimeLeft(timeLimit);
    setState("playing");
  }, [questionCount, timeLimit]);

  const submitAnswer = useCallback(() => {
    if (state !== "playing" || !currentFormulas[currentIndex]) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const formula = currentFormulas[currentIndex];
    const { score, feedback } = scoreAnswer(formula, userAnswer);
    const attempt: AttemptResult = {
      formula,
      userAnswer,
      score,
      timeUsed: timeLimit - timeLeft,
      feedback,
    };

    setLastResult(attempt);
    setResults(prev => [...prev, attempt]);
    setState("feedback");
  }, [state, currentFormulas, currentIndex, userAnswer, timeLimit, timeLeft]);

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 >= currentFormulas.length) {
      setState("results");
    } else {
      setCurrentIndex(prev => prev + 1);
      setUserAnswer("");
      setTimeLeft(timeLimit);
      setLastResult(null);
      setState("playing");
    }
  }, [currentIndex, currentFormulas.length, timeLimit]);

  // Timer
  useEffect(() => {
    if (state === "playing") {
      inputRef.current?.focus();
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            submitAnswer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [state, currentIndex]);

  // Handle enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (state === "playing") submitAnswer();
      else if (state === "feedback") nextQuestion();
    }
  };

  const avgScore = results.length > 0 ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0;
  const avgTime = results.length > 0 ? (results.reduce((a, r) => a + r.timeUsed, 0) / results.length).toFixed(1) : "0";
  const perfectCount = results.filter(r => r.score === 100).length;

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Formula Recall</h2>
        <p className="text-sm text-muted-foreground mt-1">Rapid-fire formula memory under time pressure</p>
      </div>

      {/* Idle — Setup */}
      {state === "idle" && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 rounded-xl bg-card border border-border space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Time per question</label>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map(t => (
                    <button key={t} onClick={() => setTimeLimit(t)}
                      className={cn("px-3 py-1.5 rounded-lg text-sm font-mono border transition-all",
                        timeLimit === t ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}>{t}s</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Number of questions</label>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map(q => (
                    <button key={q} onClick={() => setQuestionCount(q)}
                      className={cn("px-3 py-1.5 rounded-lg text-sm font-mono border transition-all",
                        questionCount === q ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                      )}>{q}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground text-sm mb-2">How it works</div>
              <div>• A formula name appears — type the formula from memory</div>
              <div>• System checks: accuracy, missing constants, wrong units</div>
              <div>• Scoring: 100 (perfect), 75 (minor miss), 50 (partial), 25 (weak), 0 (wrong)</div>
            </div>

            <Button onClick={startGame} className="w-full gap-2">
              <Play size={16} /> Start Recall Drill
            </Button>
          </div>

          {/* Formula bank preview */}
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs text-muted-foreground mb-2">{formulaBank.length} formulas in bank across all subjects</div>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(formulaBank.map(f => f.subject))).map(s => (
                <span key={s} className="px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">{s} ({formulaBank.filter(f => f.subject === s).length})</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Playing */}
      {state === "playing" && currentFormulas[currentIndex] && (
        <div className="space-y-5 animate-fade-in" key={currentIndex}>
          {/* Progress + Timer */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-mono">
              {currentIndex + 1} / {currentFormulas.length}
            </div>
            <div className={cn("flex items-center gap-1.5 text-sm font-mono font-semibold",
              timeLeft <= 3 ? "text-destructive" : "text-foreground"
            )}>
              <Clock size={14} />
              {timeLeft}s
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-1000 ease-linear",
                timeLeft <= 3 ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${(timeLeft / timeLimit) * 100}%` }}
            />
          </div>

          {/* Question */}
          <div className="p-8 rounded-xl bg-card border border-border text-center">
            <div className="text-xs text-muted-foreground mb-1">{currentFormulas[currentIndex].subject}</div>
            <div className="text-2xl font-semibold text-foreground">{currentFormulas[currentIndex].name}</div>
            <div className="text-xs text-muted-foreground mt-3">Type the formula below</div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Input
              ref={inputRef}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Av = -Rf/R1"
              className="font-mono text-base h-12 bg-card border-border text-foreground"
              autoFocus
            />
            <Button onClick={submitAnswer} className="w-full gap-2" size="lg">
              <Zap size={16} /> Submit (Enter)
            </Button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {state === "feedback" && lastResult && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-mono">{currentIndex + 1} / {currentFormulas.length}</div>
            <div className="text-xs text-muted-foreground font-mono">{lastResult.timeUsed.toFixed(1)}s used</div>
          </div>

          {/* Score */}
          <div className={cn("p-6 rounded-xl border text-center",
            lastResult.score >= 75 ? "bg-primary/5 border-primary/20" :
            lastResult.score >= 50 ? "bg-accent/50 border-accent" :
            "bg-destructive/5 border-destructive/20"
          )}>
            <div className={cn("text-4xl font-bold font-mono",
              lastResult.score >= 75 ? "text-primary" :
              lastResult.score >= 50 ? "text-accent-foreground" :
              "text-destructive"
            )}>
              {lastResult.score}%
            </div>
            <div className="text-sm text-muted-foreground mt-1">{lastResult.feedback[0]}</div>
          </div>

          {/* Correct answer */}
          <div className="p-5 rounded-xl bg-card border border-border space-y-3">
            <div className="text-xs text-muted-foreground">Correct formula:</div>
            <div className="p-4 rounded-lg bg-muted/50 overflow-x-auto">
              <KaTeXRender latex={lastResult.formula.latex} display />
            </div>

            {lastResult.userAnswer && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Your answer:</div>
                <div className="p-2.5 rounded-lg bg-muted font-mono text-sm text-foreground">{lastResult.userAnswer}</div>
              </div>
            )}

            {lastResult.feedback.length > 1 && (
              <div className="space-y-1">
                {lastResult.feedback.slice(1).map((fb, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                    {fb}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={nextQuestion} className="w-full gap-2" size="lg">
            {currentIndex + 1 >= currentFormulas.length ? "See Results" : "Next Question"} →
          </Button>
        </div>
      )}

      {/* Results */}
      {state === "results" && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary */}
          <div className="p-6 rounded-xl bg-card border border-border text-center">
            <Trophy size={32} className="text-primary mx-auto mb-3" />
            <div className="text-3xl font-bold font-mono text-foreground">{avgScore}%</div>
            <div className="text-sm text-muted-foreground mt-1">Average Score</div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-card border border-border text-center">
              <div className="text-lg font-semibold font-mono text-primary">{perfectCount}/{results.length}</div>
              <div className="text-[11px] text-muted-foreground">Perfect</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border text-center">
              <div className="text-lg font-semibold font-mono text-foreground">{avgTime}s</div>
              <div className="text-[11px] text-muted-foreground">Avg Time</div>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border text-center">
              <div className="text-lg font-semibold font-mono text-destructive">{results.filter(r => r.score <= 25).length}</div>
              <div className="text-[11px] text-muted-foreground">Needs Review</div>
            </div>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Breakdown</div>
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                {r.score >= 75 ? <CheckCircle2 size={16} className="text-primary shrink-0" /> : <XCircle size={16} className="text-destructive shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{r.formula.name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.formula.subject} · {r.timeUsed.toFixed(1)}s</div>
                </div>
                <div className={cn("text-sm font-mono font-semibold",
                  r.score >= 75 ? "text-primary" : r.score >= 50 ? "text-foreground" : "text-destructive"
                )}>{r.score}%</div>
              </div>
            ))}
          </div>

          {/* Weak formulas to review */}
          {results.filter(r => r.score < 75).length > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border space-y-3">
              <div className="text-sm font-medium text-foreground">Review these formulas</div>
              {results.filter(r => r.score < 75).map((r, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50 overflow-x-auto">
                  <div className="text-xs text-muted-foreground mb-1">{r.formula.name}</div>
                  <KaTeXRender latex={r.formula.latex} display />
                </div>
              ))}
            </div>
          )}

          <Button onClick={() => setState("idle")} variant="outline" className="w-full gap-2">
            <RotateCcw size={16} /> Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default FormulaRecall;

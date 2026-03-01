import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FFType = "D" | "JK" | "T" | "SR";
type LabMode = "timing" | "shift" | "violation";

interface ClockCycle {
  clk: number;
  inputs: Record<string, number>;
  Q: number;
  Qbar: number;
}

const ffInfo: Record<FFType, { desc: string; excitation: string; ic: string; inputs: string[] }> = {
  D:  { desc: "Data flip-flop. Q follows D at clock edge. Simplest and most used in registers.", excitation: "D = Q(next)", ic: "IC 7474", inputs: ["D"] },
  JK: { desc: "Most versatile. J=K=1 toggles. No invalid state unlike SR.", excitation: "J = Q'·Q(next) + Q'·X, K = Q·Q'·(next) + Q·X", ic: "IC 7476", inputs: ["J", "K"] },
  T:  { desc: "Toggle flip-flop. T=1 toggles output each clock. Used in counters.", excitation: "T = Q ⊕ Q(next)", ic: "IC 7476 (JK tied)", inputs: ["T"] },
  SR: { desc: "Set-Reset. S=R=1 is invalid. Foundation of latch theory.", excitation: "S = Q'·Q(next), R = Q·Q'(next)", ic: "IC 7474 variant", inputs: ["S", "R"] },
};

const computeNext = (type: FFType, inputs: Record<string, number>, Q: number): number => {
  switch (type) {
    case "D": return inputs.D;
    case "JK": {
      const { J, K } = inputs;
      if (J === 0 && K === 0) return Q;
      if (J === 0 && K === 1) return 0;
      if (J === 1 && K === 0) return 1;
      return Q ? 0 : 1;
    }
    case "T": return inputs.T ? (Q ? 0 : 1) : Q;
    case "SR": {
      const { S, R } = inputs;
      if (S === 0 && R === 0) return Q;
      if (S === 0 && R === 1) return 0;
      if (S === 1 && R === 0) return 1;
      return -1;
    }
  }
};

const FlipFlopLab = () => {
  const [ffType, setFfType] = useState<FFType>("D");
  const [labMode, setLabMode] = useState<LabMode>("timing");
  const [inputSequence, setInputSequence] = useState<Record<string, number>[]>([]);
  const [initialQ, setInitialQ] = useState(0);
  const info = ffInfo[ffType];

  // Shift register state
  const [shiftBits, setShiftBits] = useState(4);
  const [shiftInput, setShiftInput] = useState("");
  const [shiftHistory, setShiftHistory] = useState<number[][]>([]);
  const [shiftType, setShiftType] = useState<"SISO" | "SIPO" | "PISO" | "PIPO">("SISO");

  // Setup/hold violation state
  const [setupTime, setSetupTime] = useState(5); // ns
  const [holdTime, setHoldTime] = useState(2); // ns
  const [dataTransitionTime, setDataTransitionTime] = useState(4); // ns before clock edge
  const [clockPeriod] = useState(20); // ns

  // Generate 8 random clock cycles
  const generateSequence = () => {
    const seq: Record<string, number>[] = [];
    for (let i = 0; i < 8; i++) {
      const inputs: Record<string, number> = {};
      info.inputs.forEach((inp) => {
        inputs[inp] = Math.random() > 0.5 ? 1 : 0;
      });
      if (ffType === "SR" && inputs.S === 1 && inputs.R === 1) inputs.R = 0;
      seq.push(inputs);
    }
    setInputSequence(seq);
  };

  const cycles = useMemo<ClockCycle[]>(() => {
    if (inputSequence.length === 0) return [];
    const result: ClockCycle[] = [];
    let Q = initialQ;
    inputSequence.forEach((inputs, i) => {
      const nextQ = computeNext(ffType, inputs, Q);
      const qVal = nextQ === -1 ? Q : nextQ;
      result.push({ clk: i, inputs, Q: qVal, Qbar: qVal ? 0 : 1 });
      Q = qVal;
    });
    return result;
  }, [inputSequence, ffType, initialQ]);

  const waveH = 40;
  const stepW = 60;
  const totalW = Math.max(500, cycles.length * stepW + 80);

  const drawWave = (values: number[], yOffset: number, color: string) => {
    if (values.length === 0) return null;
    let path = `M 60 ${yOffset + (values[0] ? 5 : waveH - 5)}`;
    values.forEach((v, i) => {
      const x = 60 + i * stepW;
      const xn = 60 + (i + 1) * stepW;
      const y = yOffset + (v ? 5 : waveH - 5);
      const yNext = i < values.length - 1 ? yOffset + (values[i + 1] ? 5 : waveH - 5) : y;
      path += ` L ${xn} ${y}`;
      if (i < values.length - 1) path += ` L ${xn} ${yNext}`;
    });
    return <path d={path} fill="none" stroke={color} strokeWidth="2.5" />;
  };

  const drawClock = (n: number, yOffset: number) => {
    let path = `M 60 ${yOffset + waveH - 5}`;
    for (let i = 0; i < n; i++) {
      const x = 60 + i * stepW;
      path += ` L ${x} ${yOffset + waveH - 5} L ${x} ${yOffset + 5} L ${x + stepW / 2} ${yOffset + 5} L ${x + stepW / 2} ${yOffset + waveH - 5}`;
    }
    return <path d={path} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />;
  };

  // Shift register simulation
  const runShiftRegister = () => {
    const bits = shiftInput.replace(/[^01]/g, "");
    if (bits.length === 0) return;
    const history: number[][] = [];
    const reg = Array(shiftBits).fill(0);
    history.push([...reg]);
    for (const b of bits) {
      // Shift right, input from left
      for (let i = reg.length - 1; i > 0; i--) reg[i] = reg[i - 1];
      reg[0] = parseInt(b);
      history.push([...reg]);
    }
    setShiftHistory(history);
  };

  // Setup/hold violation check
  const hasSetupViolation = dataTransitionTime < setupTime;
  const hasHoldViolation = dataTransitionTime > (clockPeriod / 2 - holdTime);
  const hasViolation = hasSetupViolation; // simplification for visualization

  const signals = [
    { label: "CLK", color: "hsl(var(--muted-foreground))" },
    ...info.inputs.map((inp) => ({
      label: inp,
      color: inp === "D" || inp === "J" || inp === "T" || inp === "S"
        ? "hsl(var(--chart-2))"
        : "hsl(var(--chart-3))"
    })),
    { label: "Q", color: "hsl(var(--primary))" },
    { label: "Q'", color: "hsl(var(--destructive))" },
  ];
  const totalH = signals.length * (waveH + 15) + 30;

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["timing", "shift", "violation"] as LabMode[]).map((m) => (
          <button key={m} onClick={() => setLabMode(m)}
            className={cn("px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-all",
              labMode === m ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
            )}>
            {m === "timing" ? "⏱ Timing Diagram" : m === "shift" ? "📟 Shift Register" : "⚠ Setup/Hold"}
          </button>
        ))}
      </div>

      {/* FF Type Selector */}
      {labMode === "timing" && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Flip-Flop:</span>
            {(["D", "JK", "T", "SR"] as FFType[]).map((t) => (
              <button key={t} onClick={() => { setFfType(t); setInputSequence([]); }}
                className={cn("px-4 py-2 rounded-lg font-mono text-sm border transition-all",
                  ffType === t ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
                )}>
                {t} FF
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => setInitialQ((p) => p ? 0 : 1)}
              className={cn("px-3 py-1.5 rounded text-xs font-mono border transition-all",
                initialQ ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
              )}>
              Q₀ = {initialQ}
            </button>
            <Button size="sm" onClick={generateSequence} className="bg-chart-2 text-primary-foreground hover:bg-chart-2/80 font-mono">
              ⏱ Generate Timing
            </Button>
          </div>

          {/* Info Card */}
          <div className="p-4 rounded-xl bg-card border border-border grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Description</div>
              <div className="text-sm text-foreground">{info.desc}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Excitation Equation</div>
              <div className="text-sm font-mono text-chart-2">{info.excitation}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">IC Number</div>
              <div className="text-sm font-mono text-accent-foreground">{info.ic}</div>
            </div>
          </div>

          {cycles.length > 0 && (
            <>
              <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
                <div className="text-xs font-mono text-muted-foreground mb-4">TIMING DIAGRAM</div>
                <svg width={totalW} height={totalH} className="min-w-[500px]">
                  {signals.map((sig, si) => {
                    const yOff = si * (waveH + 15) + 10;
                    return (
                      <g key={sig.label}>
                        <text x="5" y={yOff + waveH / 2 + 4} fill={sig.color} fontSize="12" fontFamily="JetBrains Mono" fontWeight="bold">{sig.label}</text>
                        {cycles.map((_, ci) => (
                          <line key={ci} x1={60 + ci * stepW} y1={yOff} x2={60 + ci * stepW} y2={yOff + waveH}
                            stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="2 4" />
                        ))}
                        {sig.label === "CLK" && drawClock(cycles.length, yOff)}
                        {sig.label === "Q" && drawWave(cycles.map((c) => c.Q), yOff, sig.color)}
                        {sig.label === "Q'" && drawWave(cycles.map((c) => c.Qbar), yOff, sig.color)}
                        {info.inputs.includes(sig.label) && drawWave(cycles.map((c) => c.inputs[sig.label]), yOff, sig.color)}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
                <div className="text-xs font-mono text-muted-foreground mb-3">STATE TABLE</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-left font-mono text-muted-foreground">CLK</th>
                      {info.inputs.map((inp) => (
                        <th key={inp} className="py-2 px-3 text-left font-mono text-chart-2">{inp}</th>
                      ))}
                      <th className="py-2 px-3 text-left font-mono text-primary">Q(n+1)</th>
                      <th className="py-2 px-3 text-left font-mono text-destructive">Q'</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map((c, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono text-muted-foreground">↑ {i + 1}</td>
                        {info.inputs.map((inp) => (
                          <td key={inp} className={cn("py-2 px-3 font-mono", c.inputs[inp] ? "text-chart-2" : "text-muted-foreground")}>{c.inputs[inp]}</td>
                        ))}
                        <td className={cn("py-2 px-3 font-mono font-bold", c.Q ? "text-primary" : "text-muted-foreground")}>{c.Q}</td>
                        <td className={cn("py-2 px-3 font-mono", c.Qbar ? "text-destructive" : "text-muted-foreground")}>{c.Qbar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {cycles.length === 0 && (
            <div className="p-12 rounded-xl bg-card border border-border text-center">
              <div className="text-muted-foreground mb-2">Click "Generate Timing" to create a random input sequence</div>
              <div className="text-xs text-muted-foreground">The timing diagram and state table will appear here</div>
            </div>
          )}
        </>
      )}

      {/* SHIFT REGISTER MODE */}
      {labMode === "shift" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-muted-foreground">Type:</span>
            {(["SISO", "SIPO", "PISO", "PIPO"] as const).map((t) => (
              <button key={t} onClick={() => setShiftType(t)}
                className={cn("px-4 py-2 rounded-lg font-mono text-sm border transition-all",
                  shiftType === t ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
                )}>
                {t}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">Bits:</span>
            {[4, 8].map((n) => (
              <button key={n} onClick={() => { setShiftBits(n); setShiftHistory([]); }}
                className={cn("px-3 py-1.5 rounded text-xs font-mono border transition-all",
                  shiftBits === n ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                )}>
                {n}
              </button>
            ))}
          </div>

          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border space-y-3">
            <div className="text-xs font-mono text-muted-foreground">
              {shiftType === "SISO" && "Serial In → Serial Out: Data enters and leaves one bit at a time"}
              {shiftType === "SIPO" && "Serial In → Parallel Out: Data enters serially, all bits available at once"}
              {shiftType === "PISO" && "Parallel In → Serial Out: Load all bits, shift out one at a time"}
              {shiftType === "PIPO" && "Parallel In → Parallel Out: All bits loaded and output simultaneously"}
            </div>
            <div className="flex gap-3">
              <input value={shiftInput} onChange={(e) => setShiftInput(e.target.value.replace(/[^01]/g, ""))}
                placeholder="Enter serial data: 10110100"
                className="flex-1 px-3 py-2 rounded-lg font-mono text-sm bg-muted border border-border text-foreground" />
              <Button size="sm" onClick={runShiftRegister} className="bg-chart-2 text-primary-foreground hover:bg-chart-2/80 font-mono">
                Shift!
              </Button>
            </div>
          </div>

          {shiftHistory.length > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
              <div className="text-xs font-mono text-muted-foreground mb-3">SHIFT REGISTER ANIMATION</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-2 text-left text-xs font-mono text-muted-foreground">CLK</th>
                    <th className="py-2 px-2 text-left text-xs font-mono text-chart-2">Input</th>
                    {Array.from({ length: shiftBits }).map((_, i) => (
                      <th key={i} className="py-2 px-2 text-center text-xs font-mono text-muted-foreground">FF{i}</th>
                    ))}
                    <th className="py-2 px-2 text-right text-xs font-mono text-primary">
                      {shiftType === "SISO" || shiftType === "PISO" ? "Serial Out" : "Parallel Out"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shiftHistory.map((row, i) => (
                    <tr key={i} className={cn("border-b border-border/50", i === shiftHistory.length - 1 && "bg-primary/5")}>
                      <td className="py-2 px-2 font-mono text-muted-foreground">{i === 0 ? "Init" : `↑ ${i}`}</td>
                      <td className="py-2 px-2 font-mono text-chart-2">{i === 0 ? "—" : shiftInput[i - 1] ?? "—"}</td>
                      {row.map((bit, j) => (
                        <td key={j} className={cn("py-2 px-2 text-center font-mono font-bold transition-colors",
                          bit ? "text-primary" : "text-muted-foreground"
                        )}>
                          <span className={cn("inline-block w-8 h-8 rounded-md border flex items-center justify-center text-lg",
                            bit ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
                          )}>{bit}</span>
                        </td>
                      ))}
                      <td className={cn("py-2 px-2 text-right font-mono font-bold",
                        row[row.length - 1] ? "text-primary" : "text-muted-foreground"
                      )}>
                        {shiftType === "SISO" || shiftType === "PISO" ? row[row.length - 1] : row.join("")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SETUP/HOLD VIOLATION MODE */}
      {labMode === "violation" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border space-y-4">
            <div className="text-xs font-mono text-muted-foreground">SETUP & HOLD TIME VISUALIZER</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Setup Time (t_su) — ns</label>
                <input type="range" min={1} max={10} value={setupTime}
                  onChange={(e) => setSetupTime(parseInt(e.target.value))}
                  className="w-full accent-chart-2" />
                <div className="text-sm font-mono text-chart-2 mt-1">{setupTime} ns</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Hold Time (t_h) — ns</label>
                <input type="range" min={1} max={10} value={holdTime}
                  onChange={(e) => setHoldTime(parseInt(e.target.value))}
                  className="w-full accent-chart-3" />
                <div className="text-sm font-mono text-chart-3 mt-1">{holdTime} ns</div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Data Transition (before edge) — ns</label>
                <input type="range" min={0} max={15} value={dataTransitionTime}
                  onChange={(e) => setDataTransitionTime(parseInt(e.target.value))}
                  className="w-full accent-primary" />
                <div className={cn("text-sm font-mono mt-1", hasSetupViolation ? "text-destructive" : "text-primary")}>
                  {dataTransitionTime} ns
                </div>
              </div>
            </div>
          </div>

          {/* Visual timing diagram with violation zones */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-4">TIMING CONSTRAINT DIAGRAM</div>
            <svg width="100%" viewBox="0 0 600 260">
              {/* Clock */}
              <text x="5" y="35" fill="hsl(var(--muted-foreground))" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">CLK</text>
              <path d="M 60 50 L 60 10 L 300 10 L 300 50 L 540 50" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />

              {/* Clock edge marker */}
              <line x1="300" y1="0" x2="300" y2="260" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
              <text x="303" y="258" fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="JetBrains Mono">Clock Edge ↑</text>

              {/* Setup time zone */}
              <rect x={300 - setupTime * 20} y="70" width={setupTime * 20} height="40"
                fill="hsl(var(--chart-2) / 0.12)" stroke="hsl(var(--chart-2) / 0.4)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={300 - setupTime * 10} y="85" textAnchor="middle" fill="hsl(var(--chart-2))" fontSize="9" fontFamily="JetBrains Mono">
                t_su = {setupTime}ns
              </text>
              {/* Setup arrow */}
              <line x1={300 - setupTime * 20} y1="105" x2={300} y2="105" stroke="hsl(var(--chart-2))" strokeWidth="1.5" markerEnd="url(#arrowG)" />

              {/* Hold time zone */}
              <rect x="300" y="70" width={holdTime * 20} height="40"
                fill="hsl(var(--chart-3) / 0.12)" stroke="hsl(var(--chart-3) / 0.4)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={300 + holdTime * 10} y="85" textAnchor="middle" fill="hsl(var(--chart-3))" fontSize="9" fontFamily="JetBrains Mono">
                t_h = {holdTime}ns
              </text>

              {/* Data signal */}
              <text x="5" y="155" fill="hsl(var(--chart-2))" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">DATA</text>
              {(() => {
                const transX = 300 - dataTransitionTime * 20;
                return (
                  <>
                    <path d={`M 60 170 L ${transX} 170 L ${transX + 10} 140 L 540 140`}
                      fill="none" stroke="hsl(var(--chart-2))" strokeWidth="2.5" />
                    {/* Data transition marker */}
                    <line x1={transX + 5} y1="120" x2={transX + 5} y2="185" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="2 2" />
                    <text x={transX + 8} y="195" fill="hsl(var(--primary))" fontSize="8" fontFamily="JetBrains Mono">
                      Data changes here
                    </text>
                  </>
                );
              })()}

              {/* Q output */}
              <text x="5" y="225" fill="hsl(var(--primary))" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">Q</text>
              {hasSetupViolation ? (
                <>
                  <path d="M 60 240 L 300 240" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
                  <path d="M 300 240 L 310 220 L 320 240 L 330 220 L 340 240 L 540 240"
                    fill="none" stroke="hsl(var(--destructive))" strokeWidth="2.5" strokeDasharray="4 2" />
                  <text x="350" y="218" fill="hsl(var(--destructive))" fontSize="9" fontFamily="JetBrains Mono" fontWeight="bold">
                    METASTABLE ⚠
                  </text>
                </>
              ) : (
                <path d="M 60 240 L 310 240 L 310 220 L 540 220" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
              )}

              <defs>
                <marker id="arrowG" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--chart-2))" />
                </marker>
              </defs>
            </svg>
          </div>

          {/* Status */}
          <div className={cn("p-4 rounded-xl border text-sm font-mono",
            hasSetupViolation
              ? "bg-destructive/5 border-destructive/20 text-destructive"
              : "bg-primary/5 border-primary/20 text-primary"
          )}>
            {hasSetupViolation
              ? `⚠ SETUP VIOLATION: Data changes ${dataTransitionTime}ns before clock edge, but requires ${setupTime}ns. Output may become metastable (oscillate between 0 and 1).`
              : `✓ TIMING MET: Data stable ${dataTransitionTime}ns before clock edge (requires ${setupTime}ns setup, ${holdTime}ns hold). Output will be valid.`
            }
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">CONCEPTS</div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li><span className="text-chart-2 font-mono">Setup time (t_su):</span> Data must be stable BEFORE the clock edge by this duration</li>
              <li><span className="text-chart-3 font-mono">Hold time (t_h):</span> Data must remain stable AFTER the clock edge for this duration</li>
              <li><span className="text-destructive font-mono">Metastability:</span> When setup/hold is violated, output oscillates unpredictably — can propagate errors in synchronous systems</li>
              <li><span className="text-primary font-mono">Synchronizer:</span> Two flip-flops in series reduce metastability probability exponentially (MTBF increases)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Characteristic Table — show only in timing mode */}
      {labMode === "timing" && (
        <div className="p-5 rounded-xl bg-card border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">CHARACTERISTIC TABLE — {ffType} FLIP-FLOP</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {info.inputs.map((inp) => <th key={inp} className="py-2 px-3 text-left font-mono text-chart-2">{inp}</th>)}
                <th className="py-2 px-3 text-left font-mono text-muted-foreground">Q(n)</th>
                <th className="py-2 px-3 text-left font-mono text-primary">Q(n+1)</th>
                <th className="py-2 px-3 text-left font-mono text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {ffType === "D" && [
                { D: 0, q: "X", qn: "0", action: "Reset" },
                { D: 1, q: "X", qn: "1", action: "Set" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-chart-2">{r.D}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">{r.q}</td>
                  <td className="py-2 px-3 font-mono text-primary">{r.qn}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.action}</td>
                </tr>
              ))}
              {ffType === "JK" && [
                { J: 0, K: 0, qn: "Q(n)", action: "No change" },
                { J: 0, K: 1, qn: "0", action: "Reset" },
                { J: 1, K: 0, qn: "1", action: "Set" },
                { J: 1, K: 1, qn: "Q'(n)", action: "Toggle" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-chart-2">{r.J}</td>
                  <td className="py-2 px-3 font-mono text-accent-foreground">{r.K}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">X</td>
                  <td className="py-2 px-3 font-mono text-primary">{r.qn}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.action}</td>
                </tr>
              ))}
              {ffType === "T" && [
                { T: 0, qn: "Q(n)", action: "No change" },
                { T: 1, qn: "Q'(n)", action: "Toggle" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-chart-2">{r.T}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">X</td>
                  <td className="py-2 px-3 font-mono text-primary">{r.qn}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.action}</td>
                </tr>
              ))}
              {ffType === "SR" && [
                { S: 0, R: 0, qn: "Q(n)", action: "No change" },
                { S: 0, R: 1, qn: "0", action: "Reset" },
                { S: 1, R: 0, qn: "1", action: "Set" },
                { S: 1, R: 1, qn: "?", action: "Invalid ⚠" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-chart-2">{r.S}</td>
                  <td className="py-2 px-3 font-mono text-accent-foreground">{r.R}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">X</td>
                  <td className={cn("py-2 px-3 font-mono", r.qn === "?" ? "text-destructive" : "text-primary")}>{r.qn}</td>
                  <td className={cn("py-2 px-3", r.action.includes("Invalid") ? "text-destructive" : "text-muted-foreground")}>{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FlipFlopLab;

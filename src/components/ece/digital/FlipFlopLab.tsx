import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FFType = "D" | "JK" | "T" | "SR";

interface ClockCycle {
  clk: number;
  inputs: Record<string, number>;
  Q: number;
  Qbar: number;
}

const ffInfo: Record<FFType, { desc: string; excitation: string; ic: string; inputs: string[] }> = {
  D:  { desc: "Data flip-flop. Q follows D at clock edge. Simplest and most used in registers.", excitation: "D = Q(next)", ic: "IC 7474", inputs: ["D"] },
  JK: { desc: "Most versatile. J=K=1 toggles. No invalid state unlike SR.", excitation: "J = Q'·Q(next) + Q'·X, K = Q·Q'(next) + Q·X", ic: "IC 7476", inputs: ["J", "K"] },
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
      return Q ? 0 : 1; // toggle
    }
    case "T": return inputs.T ? (Q ? 0 : 1) : Q;
    case "SR": {
      const { S, R } = inputs;
      if (S === 0 && R === 0) return Q;
      if (S === 0 && R === 1) return 0;
      if (S === 1 && R === 0) return 1;
      return -1; // invalid
    }
  }
};

const FlipFlopLab = () => {
  const [ffType, setFfType] = useState<FFType>("D");
  const [inputSequence, setInputSequence] = useState<Record<string, number>[]>([]);
  const [initialQ, setInitialQ] = useState(0);
  const info = ffInfo[ffType];

  // Generate 8 random clock cycles
  const generateSequence = () => {
    const seq: Record<string, number>[] = [];
    for (let i = 0; i < 8; i++) {
      const inputs: Record<string, number> = {};
      info.inputs.forEach((inp) => {
        inputs[inp] = Math.random() > 0.5 ? 1 : 0;
      });
      // Avoid SR invalid
      if (ffType === "SR" && inputs.S === 1 && inputs.R === 1) {
        inputs.R = 0;
      }
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
    return <path d={path} fill="none" stroke="hsl(220 10% 50%)" strokeWidth="2" />;
  };

  const signals = [
    { label: "CLK", color: "hsl(220 10% 50%)" },
    ...info.inputs.map((inp) => ({ label: inp, color: inp === "D" || inp === "J" || inp === "T" || inp === "S" ? "hsl(187 80% 42%)" : "hsl(38 90% 55%)" })),
    { label: "Q", color: "hsl(142 100% 45%)" },
    { label: "Q'", color: "hsl(0 80% 55%)" },
  ];

  const totalH = signals.length * (waveH + 15) + 30;

  return (
    <div className="space-y-6">
      {/* FF Type Selector */}
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
        <Button size="sm" onClick={generateSequence} className="bg-chart-2 text-chart-2/90 hover:bg-chart-2/80 text-primary-foreground font-mono">
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
          <div className="text-sm font-mono text-accent">{info.ic}</div>
        </div>
      </div>

      {cycles.length > 0 && (
        <>
          {/* Timing Diagram */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border overflow-x-auto">
            <div className="text-xs font-mono text-muted-foreground mb-4">TIMING DIAGRAM</div>
            <svg width={totalW} height={totalH} className="min-w-[500px]">
              {signals.map((sig, si) => {
                const yOff = si * (waveH + 15) + 10;
                return (
                  <g key={sig.label}>
                    <text x="5" y={yOff + waveH / 2 + 4} fill={sig.color} fontSize="12" fontFamily="JetBrains Mono" fontWeight="bold">{sig.label}</text>
                    {/* Grid lines */}
                    {cycles.map((_, ci) => (
                      <line key={ci} x1={60 + ci * stepW} y1={yOff} x2={60 + ci * stepW} y2={yOff + waveH} stroke="hsl(220 15% 16%)" strokeWidth="1" strokeDasharray="2 4" />
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

          {/* State Table */}
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

      {/* Characteristic Table */}
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
                <td className="py-2 px-3 font-mono text-accent">{r.K}</td>
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
                <td className="py-2 px-3 font-mono text-accent">{r.R}</td>
                <td className="py-2 px-3 font-mono text-muted-foreground">X</td>
                <td className={cn("py-2 px-3 font-mono", r.qn === "?" ? "text-destructive" : "text-primary")}>{r.qn}</td>
                <td className={cn("py-2 px-3", r.action.includes("Invalid") ? "text-destructive" : "text-muted-foreground")}>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FlipFlopLab;

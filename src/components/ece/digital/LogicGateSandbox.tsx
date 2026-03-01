import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR";

const gateInfo: Record<GateType, { expr: string; desc: string; ic: string }> = {
  AND:  { expr: "Y = A · B", desc: "Output HIGH only when ALL inputs are HIGH", ic: "IC 7408" },
  OR:   { expr: "Y = A + B", desc: "Output HIGH when ANY input is HIGH", ic: "IC 7432" },
  NOT:  { expr: "Y = A'", desc: "Inverts the input signal", ic: "IC 7404" },
  NAND: { expr: "Y = (A · B)'", desc: "Universal gate — AND followed by NOT", ic: "IC 7400" },
  NOR:  { expr: "Y = (A + B)'", desc: "Universal gate — OR followed by NOT", ic: "IC 7402" },
  XOR:  { expr: "Y = A ⊕ B", desc: "Output HIGH when inputs are DIFFERENT", ic: "IC 7486" },
  XNOR: { expr: "Y = (A ⊕ B)'", desc: "Output HIGH when inputs are SAME", ic: "IC 74266" },
};

const evaluate = (gate: GateType, a: number, b: number): number => {
  switch (gate) {
    case "AND": return a & b;
    case "OR": return a | b;
    case "NOT": return a ? 0 : 1;
    case "NAND": return (a & b) ? 0 : 1;
    case "NOR": return (a | b) ? 0 : 1;
    case "XOR": return a ^ b;
    case "XNOR": return (a ^ b) ? 0 : 1;
  }
};

const GateSVG = ({ type, a, b, out }: { type: GateType; a: number; b: number; out: number }) => {
  const w = 280, h = 160;
  const inputColor = (v: number) => v ? "hsl(142 100% 45%)" : "hsl(220 10% 30%)";
  const outColor = out ? "hsl(142 100% 45%)" : "hsl(220 10% 30%)";
  const isNot = type === "NOT";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[280px]">
      {/* Input lines */}
      <line x1="20" y1={isNot ? "80" : "50"} x2="90" y2={isNot ? "80" : "50"} stroke={inputColor(a)} strokeWidth="3" />
      {!isNot && <line x1="20" y1="110" x2="90" y2="110" stroke={inputColor(b)} strokeWidth="3" />}
      
      {/* Input labels */}
      <text x="10" y={isNot ? "84" : "54"} fill={inputColor(a)} fontSize="14" fontFamily="JetBrains Mono" textAnchor="end">A</text>
      {!isNot && <text x="10" y="114" fill={inputColor(b)} fontSize="14" fontFamily="JetBrains Mono" textAnchor="end">B</text>}
      
      {/* Gate body */}
      <rect x="90" y="30" width="100" height="100" rx="8" fill="hsl(220 20% 12%)" stroke="hsl(220 15% 25%)" strokeWidth="2" />
      <text x="140" y="85" fill="hsl(140 20% 88%)" fontSize="16" fontFamily="Space Grotesk" fontWeight="bold" textAnchor="middle">{type}</text>

      {/* Bubble for inverted gates */}
      {(type === "NOT" || type === "NAND" || type === "NOR" || type === "XNOR") && (
        <circle cx="196" cy="80" r="6" fill="none" stroke="hsl(220 15% 25%)" strokeWidth="2" />
      )}

      {/* Output line */}
      <line x1={type === "NOT" || type === "NAND" || type === "NOR" || type === "XNOR" ? "202" : "190"} y1="80" x2="260" y2="80" stroke={outColor} strokeWidth="3" />
      <text x="270" y="84" fill={outColor} fontSize="14" fontFamily="JetBrains Mono">Y</text>

      {/* Input dots */}
      <circle cx="20" cy={isNot ? 80 : 50} r="5" fill={inputColor(a)} />
      {!isNot && <circle cx="20" cy="110" r="5" fill={inputColor(b)} />}
      <circle cx="260" cy="80" r="5" fill={outColor} />
    </svg>
  );
};

const LogicGateSandbox = () => {
  const [gate, setGate] = useState<GateType>("AND");
  const [inputA, setInputA] = useState(0);
  const [inputB, setInputB] = useState(0);

  const output = evaluate(gate, inputA, inputB);
  const info = gateInfo[gate];
  const isNot = gate === "NOT";

  const truthTable = useMemo(() => {
    if (isNot) {
      return [0, 1].map((a) => ({ a, b: 0, y: evaluate(gate, a, 0) }));
    }
    const rows = [];
    for (let a = 0; a <= 1; a++)
      for (let b = 0; b <= 1; b++)
        rows.push({ a, b, y: evaluate(gate, a, b) });
    return rows;
  }, [gate, isNot]);

  return (
    <div className="space-y-6">
      {/* Gate selector */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(gateInfo) as GateType[]).map((g) => (
          <button
            key={g}
            onClick={() => setGate(g)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all border",
              gate === g
                ? "bg-chart-2/15 border-chart-2/40 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Interactive Gate */}
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">INTERACTIVE GATE</div>
            <GateSVG type={gate} a={inputA} b={inputB} out={output} />

            {/* Toggle Switches */}
            <div className="flex gap-6 mt-4 justify-center">
              <button onClick={() => setInputA((p) => p ? 0 : 1)}
                className={cn("px-6 py-3 rounded-lg font-mono font-bold text-lg transition-all border",
                  inputA ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"
                )}>
                A = {inputA}
              </button>
              {!isNot && (
                <button onClick={() => setInputB((p) => p ? 0 : 1)}
                  className={cn("px-6 py-3 rounded-lg font-mono font-bold text-lg transition-all border",
                    inputB ? "bg-primary/20 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"
                  )}>
                  B = {inputB}
                </button>
              )}
            </div>

            {/* Output Display */}
            <div className={cn("mt-4 p-4 rounded-lg border text-center font-mono text-2xl font-bold transition-all",
              output ? "bg-primary/10 border-primary/30 text-primary text-glow" : "bg-muted border-border text-muted-foreground"
            )}>
              OUTPUT: {output}
            </div>
          </div>

          {/* Gate Info */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="text-sm font-mono text-chart-2">{info.expr}</div>
            <div className="text-xs text-muted-foreground">{info.desc}</div>
            <div className="text-xs text-muted-foreground">IC: <span className="text-accent font-mono">{info.ic}</span></div>
          </div>
        </div>

        {/* Truth Table */}
        <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-3">TRUTH TABLE</div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-4 text-left text-xs font-mono text-chart-2">A</th>
                {!isNot && <th className="py-2 px-4 text-left text-xs font-mono text-chart-2">B</th>}
                <th className="py-2 px-4 text-left text-xs font-mono text-primary">Y</th>
              </tr>
            </thead>
            <tbody>
              {truthTable.map((row, i) => {
                const isActive = isNot ? row.a === inputA : row.a === inputA && row.b === inputB;
                return (
                  <tr key={i} className={cn("border-b border-border/50 transition-colors",
                    isActive && "bg-primary/5"
                  )}>
                    <td className={cn("py-3 px-4 font-mono text-lg", row.a ? "text-primary" : "text-muted-foreground")}>{row.a}</td>
                    {!isNot && <td className={cn("py-3 px-4 font-mono text-lg", row.b ? "text-primary" : "text-muted-foreground")}>{row.b}</td>}
                    <td className={cn("py-3 px-4 font-mono text-lg font-bold", row.y ? "text-primary text-glow" : "text-muted-foreground")}>{row.y}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Minterm/Maxterm */}
          <div className="mt-4 space-y-2 text-xs font-mono">
            <div className="text-muted-foreground">
              Minterms (Y=1): <span className="text-primary">
                {truthTable.filter((r) => r.y === 1).map((r) => isNot ? `m${r.a}` : `m${r.a * 2 + r.b}`).join(", ") || "∅"}
              </span>
            </div>
            <div className="text-muted-foreground">
              Maxterms (Y=0): <span className="text-destructive">
                {truthTable.filter((r) => r.y === 0).map((r) => isNot ? `M${r.a}` : `M${r.a * 2 + r.b}`).join(", ") || "∅"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Input Extension */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-2">CASCADING CONCEPT</div>
        <p className="text-sm text-muted-foreground">
          {gate === "NAND" || gate === "NOR"
            ? `${gate} is a universal gate. Any logic function can be built using only ${gate} gates. Example: NOT using ${gate}: connect both inputs together.`
            : gate === "XOR"
            ? "XOR is used in parity checkers, adders (half adder sum = A⊕B), and comparators."
            : gate === "AND"
            ? "Cascading: 3-input AND = (A·B)·C. Used in address decoders, enable logic, and masking operations."
            : gate === "OR"
            ? "Cascading: 3-input OR = (A+B)+C. Used in interrupt logic, bus arbitration, and priority encoders."
            : gate === "NOT"
            ? "Buffers use two NOT gates in series. Schmitt trigger inverters (IC 7414) clean noisy signals."
            : "XNOR is used as a 1-bit comparator. If A XNOR B = 1, then A equals B. Used in magnitude comparators."
          }
        </p>
      </div>
    </div>
  );
};

export default LogicGateSandbox;

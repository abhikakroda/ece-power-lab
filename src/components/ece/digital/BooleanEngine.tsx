import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BoolOp = "AND" | "OR" | "XOR" | "NAND" | "NOR" | "XNOR";

const BooleanEngine = () => {
  const [numVars, setNumVars] = useState(2);
  const [expression, setExpression] = useState("A.B + A'.B'");
  const [showEval, setShowEval] = useState(false);

  const varNames = ["A", "B", "C", "D"].slice(0, numVars);
  const totalRows = 1 << numVars;

  // Parse and evaluate boolean expression
  const evaluateExpr = (expr: string, values: Record<string, number>): number | null => {
    try {
      let e = expr.trim();
      // Replace notations
      e = e.replace(/([A-D])'/g, "(1-$1)");  // A' -> NOT
      e = e.replace(/\./g, "&");              // . -> AND
      e = e.replace(/\+/g, "|");              // + -> OR
      e = e.replace(/⊕/g, "^");              // XOR
      // Implicit AND: AB -> A&B
      e = e.replace(/([A-D)\d])([A-D(])/g, "$1&$2");
      e = e.replace(/([A-D)\d])([A-D(])/g, "$1&$2"); // 2nd pass

      // Replace variable names with values
      for (const [name, val] of Object.entries(values)) {
        e = e.split(name).join(String(val));
      }

      // Evaluate safely
      const sanitized = e.replace(/[^0-9&|^()\-+\s]/g, "");
      // eslint-disable-next-line no-eval
      const result = Function(`"use strict"; return (${sanitized}) ? 1 : 0;`)();
      return typeof result === "number" ? result : null;
    } catch {
      return null;
    }
  };

  const truthTable = useMemo(() => {
    if (!showEval) return [];
    const rows = [];
    for (let i = 0; i < totalRows; i++) {
      const values: Record<string, number> = {};
      varNames.forEach((v, vi) => {
        values[v] = (i >> (numVars - 1 - vi)) & 1;
      });
      const result = evaluateExpr(expression, values);
      rows.push({ values, result });
    }
    return rows;
  }, [expression, numVars, showEval, totalRows, varNames]);

  const minterms = truthTable.filter((r) => r.result === 1).map((_, i) => {
    const row = truthTable[i];
    if (row.result !== 1) return -1;
    let num = 0;
    varNames.forEach((v, vi) => {
      num += row.values[v] << (numVars - 1 - vi);
    });
    return num;
  }).filter((x) => x >= 0);

  const maxterms = truthTable.filter((r) => r.result === 0).map((_, i) => {
    const row = truthTable[i];
    if (row.result !== 0) return -1;
    let num = 0;
    varNames.forEach((v, vi) => {
      num += row.values[v] << (numVars - 1 - vi);
    });
    return num;
  }).filter((x) => x >= 0);

  // Quick expression generators
  const quickOps: { label: string; expr: string }[] = [
    { label: "AND", expr: varNames.join(".") },
    { label: "OR", expr: varNames.join("+") },
    { label: "NAND", expr: `(${varNames.join(".")})'` },
    { label: "NOR", expr: `(${varNames.join("+")})'` },
    { label: "XOR", expr: varNames.join("⊕") },
    { label: "Half Adder Sum", expr: "A⊕B" },
    { label: "Half Adder Carry", expr: "A.B" },
    { label: "Full Adder Sum", expr: "A⊕B⊕C" },
    { label: "MUX 2:1", expr: "A'.B + A.C" },
  ].filter((op) => {
    if (numVars < 3 && (op.label === "Full Adder Sum" || op.label === "MUX 2:1")) return false;
    return true;
  });

  const hasError = showEval && truthTable.some((r) => r.result === null);

  return (
    <div className="space-y-6">
      {/* Variables */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Variables:</span>
        {[2, 3, 4].map((v) => (
          <button key={v} onClick={() => { setNumVars(v); setShowEval(false); }}
            className={cn("px-4 py-2 rounded-lg font-mono text-sm border transition-all",
              numVars === v ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
            )}>
            {v}-var ({["A", "B", "C", "D"].slice(0, v).join(", ")})
          </button>
        ))}
      </div>

      {/* Expression Input */}
      <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
        <Label className="text-xs text-muted-foreground mb-2 block">Boolean Expression</Label>
        <div className="flex gap-3">
          <Input
            value={expression}
            onChange={(e) => { setExpression(e.target.value); setShowEval(false); }}
            placeholder="A.B + A'.B'"
            className="font-mono text-lg bg-muted border-border text-foreground h-12 flex-1"
          />
          <Button onClick={() => setShowEval(true)} className="bg-chart-2 text-primary-foreground hover:bg-chart-2/80 font-mono h-12 px-6">
            EVALUATE
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground font-mono">
          Syntax: <span className="text-chart-2">.</span> = AND, <span className="text-chart-2">+</span> = OR, <span className="text-chart-2">'</span> = NOT, <span className="text-chart-2">⊕</span> = XOR, <span className="text-chart-2">( )</span> = grouping
        </div>
      </div>

      {/* Quick expressions */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center mr-1">Quick:</span>
        {quickOps.map((op) => (
          <button key={op.label} onClick={() => { setExpression(op.expr); setShowEval(true); }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono border border-border bg-card text-muted-foreground hover:text-foreground hover:border-chart-2/30 transition-all">
            {op.label}
          </button>
        ))}
      </div>

      {hasError && (
        <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive">
          Could not evaluate expression. Check syntax: use A, B{numVars >= 3 ? ", C" : ""}{numVars >= 4 ? ", D" : ""} with operators . + ' ⊕
        </div>
      )}

      {showEval && !hasError && truthTable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Truth Table */}
          <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">TRUTH TABLE</div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {varNames.map((v) => (
                    <th key={v} className="py-2 px-3 text-center text-xs font-mono text-chart-2">{v}</th>
                  ))}
                  <th className="py-2 px-3 text-center text-xs font-mono text-primary">F</th>
                </tr>
              </thead>
              <tbody>
                {truthTable.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {varNames.map((v) => (
                      <td key={v} className={cn("py-2 px-3 text-center font-mono", row.values[v] ? "text-chart-2" : "text-muted-foreground")}>{row.values[v]}</td>
                    ))}
                    <td className={cn("py-2 px-3 text-center font-mono font-bold text-lg", row.result ? "text-primary text-glow" : "text-muted-foreground")}>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Analysis */}
          <div className="space-y-4">
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs font-mono text-muted-foreground mb-2">EXPRESSION</div>
              <div className="text-lg font-mono text-chart-2">F = {expression}</div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs font-mono text-muted-foreground mb-2">MINTERMS (SOP)</div>
              <div className="text-sm font-mono text-primary">
                {minterms.length > 0 ? `F = Σm(${minterms.join(", ")})` : "F = 0"}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs font-mono text-muted-foreground mb-2">MAXTERMS (POS)</div>
              <div className="text-sm font-mono text-destructive">
                {maxterms.length > 0 ? `F = ΠM(${maxterms.join(", ")})` : "F = 1"}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs font-mono text-muted-foreground mb-2">CANONICAL SOP</div>
              <div className="text-sm font-mono text-primary break-all">
                {minterms.length > 0
                  ? minterms.map((m) => {
                      const bits = m.toString(2).padStart(numVars, "0");
                      return bits.split("").map((b, i) => b === "1" ? varNames[i] : `${varNames[i]}'`).join("");
                    }).join(" + ")
                  : "0"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border text-center">
                <div className="text-2xl font-mono font-bold text-primary">{minterms.length}</div>
                <div className="text-[10px] text-muted-foreground">Minterms (1s)</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border text-center">
                <div className="text-2xl font-mono font-bold text-destructive">{maxterms.length}</div>
                <div className="text-[10px] text-muted-foreground">Maxterms (0s)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Laws Reference */}
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs font-mono text-muted-foreground mb-3">BOOLEAN ALGEBRA LAWS</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs font-mono text-muted-foreground">
          <div><span className="text-chart-2">Identity:</span> A+0=A, A·1=A</div>
          <div><span className="text-chart-2">Null:</span> A+1=1, A·0=0</div>
          <div><span className="text-chart-2">Complement:</span> A+A'=1, A·A'=0</div>
          <div><span className="text-chart-2">Idempotent:</span> A+A=A, A·A=A</div>
          <div><span className="text-chart-2">De Morgan:</span> (A·B)' = A'+B'</div>
          <div><span className="text-chart-2">De Morgan:</span> (A+B)' = A'·B'</div>
          <div><span className="text-chart-2">Absorption:</span> A+A·B=A, A·(A+B)=A</div>
          <div><span className="text-chart-2">Consensus:</span> AB+A'C+BC = AB+A'C</div>
        </div>
      </div>
    </div>
  );
};

export default BooleanEngine;

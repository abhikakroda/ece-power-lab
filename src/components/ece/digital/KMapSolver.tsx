import { useState, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import katex from "katex";

type Variables = 2 | 3 | 4;

const grayCode = (n: number): number[] => {
  if (n === 1) return [0, 1];
  const prev = grayCode(n - 1);
  return [...prev.map((x) => x), ...prev.reverse().map((x) => x + (1 << (n - 1)))];
};

// ─── Quine-McCluskey Minimization ───────────────────────────────────────
const countOnes = (n: number): number => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };

interface Implicant {
  minterms: number[];
  bits: (0 | 1 | -1)[]; // -1 = don't care
  used: boolean;
}

const implicantCovers = (imp: Implicant, minterm: number, numVars: number): boolean => {
  for (let i = 0; i < numVars; i++) {
    if (imp.bits[i] === -1) continue;
    const bit = (minterm >> (numVars - 1 - i)) & 1;
    if (imp.bits[i] !== bit) return false;
  }
  return true;
};

const canCombine = (a: Implicant, b: Implicant, numVars: number): number => {
  let diffPos = -1, diffs = 0;
  for (let i = 0; i < numVars; i++) {
    if (a.bits[i] !== b.bits[i]) { diffs++; diffPos = i; }
    if (diffs > 1) return -1;
  }
  return diffs === 1 ? diffPos : -1;
};

const combine = (a: Implicant, b: Implicant, diffPos: number, numVars: number): Implicant => {
  const bits = [...a.bits] as (0 | 1 | -1)[];
  bits[diffPos] = -1;
  const minterms = [...new Set([...a.minterms, ...b.minterms])].sort((x, y) => x - y);
  return { minterms, bits, used: false };
};

const quineMcCluskey = (minterms: number[], dontCares: number[], numVars: number): Implicant[] => {
  if (minterms.length === 0) return [];
  const allTerms = [...minterms, ...dontCares];

  let implicants: Implicant[] = allTerms.map(m => ({
    minterms: [m],
    bits: Array.from({ length: numVars }, (_, i) => ((m >> (numVars - 1 - i)) & 1) as 0 | 1),
    used: false,
  }));

  const primeImplicants: Implicant[] = [];

  // Iteratively combine
  let changed = true;
  while (changed) {
    changed = false;
    const nextGen: Implicant[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < implicants.length; i++) {
      for (let j = i + 1; j < implicants.length; j++) {
        const diffPos = canCombine(implicants[i], implicants[j], numVars);
        if (diffPos >= 0) {
          implicants[i].used = true;
          implicants[j].used = true;
          const combined = combine(implicants[i], implicants[j], diffPos, numVars);
          const key = combined.bits.join(",");
          if (!seen.has(key)) {
            seen.add(key);
            nextGen.push(combined);
            changed = true;
          }
        }
      }
    }

    // Unused implicants are prime
    implicants.filter(imp => !imp.used).forEach(imp => {
      const key = imp.bits.join(",");
      if (!seen.has(key)) {
        seen.add(key);
        primeImplicants.push(imp);
      }
    });

    implicants = nextGen;
  }

  // Add remaining
  implicants.filter(imp => !imp.used).forEach(imp => primeImplicants.push(imp));

  // Petrick's method (simplified) — greedy essential PI selection
  const essentialPIs: Implicant[] = [];
  const covered = new Set<number>();

  // Find essential PIs (cover a minterm that no other PI covers)
  for (const m of minterms) {
    const coveringPIs = primeImplicants.filter(pi => implicantCovers(pi, m, numVars));
    if (coveringPIs.length === 1) {
      if (!essentialPIs.includes(coveringPIs[0])) essentialPIs.push(coveringPIs[0]);
      coveringPIs[0].minterms.forEach(mt => { if (minterms.includes(mt)) covered.add(mt); });
    }
  }

  // Greedy cover remaining
  const remaining = minterms.filter(m => !covered.has(m));
  const selectedPIs = [...essentialPIs];

  for (const m of remaining) {
    if (covered.has(m)) continue;
    // Pick PI that covers most uncovered minterms
    let bestPI: Implicant | null = null, bestCount = 0;
    for (const pi of primeImplicants) {
      if (selectedPIs.includes(pi)) continue;
      if (!implicantCovers(pi, m, numVars)) continue;
      const count = minterms.filter(mt => !covered.has(mt) && implicantCovers(pi, mt, numVars)).length;
      if (count > bestCount) { bestCount = count; bestPI = pi; }
    }
    if (bestPI) {
      selectedPIs.push(bestPI);
      minterms.filter(mt => implicantCovers(bestPI!, mt, numVars)).forEach(mt => covered.add(mt));
    }
  }

  return selectedPIs;
};

const implicantToTerm = (imp: Implicant, varNames: string[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < imp.bits.length; i++) {
    if (imp.bits[i] === -1) continue;
    parts.push(imp.bits[i] === 1 ? varNames[i] : `${varNames[i]}'`);
  }
  return parts.length === 0 ? "1" : parts.join("");
};

const implicantToLatex = (imp: Implicant, varNames: string[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < imp.bits.length; i++) {
    if (imp.bits[i] === -1) continue;
    parts.push(imp.bits[i] === 1 ? varNames[i] : `\\overline{${varNames[i]}}`);
  }
  return parts.length === 0 ? "1" : parts.join(" \\cdot ");
};

// ─── KaTeX Rendering ───────────────────────────────────────────────────
const KaTeXBlock = ({ latex }: { latex: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      try { katex.render(latex, ref.current, { throwOnError: false, displayMode: true }); }
      catch { if (ref.current) ref.current.textContent = latex; }
    }
  }, [latex]);
  return <div ref={ref} className="py-1 overflow-x-auto" />;
};

// ─── Group colors for K-Map highlighting ────────────────────────────────
const groupColors = [
  "bg-primary/20 border-primary/50",
  "bg-chart-2/20 border-chart-2/50",
  "bg-chart-3/20 border-chart-3/50",
  "bg-chart-4/20 border-chart-4/50",
  "bg-destructive/20 border-destructive/50",
  "bg-accent/20 border-accent/50",
];

const KMapSolver = () => {
  const [vars, setVars] = useState<Variables>(3);
  const [cells, setCells] = useState<number[]>(Array(16).fill(0));

  const toggleCell = (idx: number) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = next[idx] === 0 ? 1 : next[idx] === 1 ? 2 : 0; // 0, 1, don't care (2)
      return next;
    });
  };

  const totalCells = 1 << vars;
  const rows = vars <= 2 ? 2 : vars === 3 ? 2 : 4;
  const cols = vars <= 2 ? 2 : vars === 3 ? 4 : 4;

  const rowGray = grayCode(vars <= 2 ? 1 : vars === 3 ? 1 : 2);
  const colGray = grayCode(vars <= 2 ? 1 : 2);

  const varNames = vars === 2 ? ["A", "B"] : vars === 3 ? ["A", "B", "C"] : ["A", "B", "C", "D"];

  const rowVars = vars <= 3 ? varNames[0] : `${varNames[0]}${varNames[1]}`;
  const colVars = vars <= 2 ? varNames[1] : vars === 3 ? `${varNames[1]}${varNames[2]}` : `${varNames[2]}${varNames[3]}`;

  const getCellIndex = (r: number, c: number): number => {
    const rowBits = rowGray[r];
    const colBits = colGray[c];
    if (vars === 2) return rowBits * 2 + colBits;
    if (vars === 3) return rowBits * 4 + colBits;
    return rowBits * 4 + colBits;
  };

  const getMintermNumber = (r: number, c: number): number => {
    const rowBits = rowGray[r];
    const colBits = colGray[c];
    if (vars === 2) return rowBits * 2 + colBits;
    if (vars === 3) return rowBits * 4 + colBits;
    return rowBits * 4 + colBits;
  };

  const minterms = useMemo(() => {
    const result: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = getCellIndex(r, c);
        if (cells[idx] === 1) result.push(getMintermNumber(r, c));
      }
    }
    return result.sort((a, b) => a - b);
  }, [cells, rows, cols, vars]);

  const dontCares = useMemo(() => {
    const result: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = getCellIndex(r, c);
        if (cells[idx] === 2) result.push(getMintermNumber(r, c));
      }
    }
    return result.sort((a, b) => a - b);
  }, [cells, rows, cols, vars]);

  // Quine-McCluskey minimization
  const minimizedResult = useMemo(() => {
    if (minterms.length === 0) return { sop: "0", pos: "1", sopLatex: "F = 0", posLatex: "F = 1", pis: [], steps: [] as string[] };
    if (minterms.length === totalCells) return { sop: "1", pos: "0", sopLatex: "F = 1", posLatex: "F = 0", pis: [], steps: ["All minterms = 1, F = 1"] };

    const pis = quineMcCluskey(minterms, dontCares, vars);
    const sop = pis.map(pi => implicantToTerm(pi, varNames)).join(" + ");
    const sopLatex = "F = " + pis.map(pi => implicantToLatex(pi, varNames)).join(" + ");

    // POS: minimize complement
    const maxterms: number[] = [];
    for (let i = 0; i < totalCells; i++) {
      if (!minterms.includes(i) && !dontCares.includes(i)) maxterms.push(i);
    }
    let pos = "", posLatex = "";
    if (maxterms.length === 0) { pos = "1"; posLatex = "F = 1"; }
    else {
      const posPIs = quineMcCluskey(maxterms, dontCares, vars);
      const posTerms = posPIs.map(pi => {
        const parts: string[] = [];
        for (let i = 0; i < pi.bits.length; i++) {
          if (pi.bits[i] === -1) continue;
          // POS: inverted from SOP
          parts.push(pi.bits[i] === 0 ? varNames[i] : `${varNames[i]}'`);
        }
        return parts.length === 0 ? "0" : `(${parts.join("+")})`;
      });
      pos = posTerms.join("·");
      const posLatexTerms = posPIs.map(pi => {
        const parts: string[] = [];
        for (let i = 0; i < pi.bits.length; i++) {
          if (pi.bits[i] === -1) continue;
          parts.push(pi.bits[i] === 0 ? varNames[i] : `\\overline{${varNames[i]}}`);
        }
        return parts.length === 0 ? "0" : `(${parts.join(" + ")})`;
      });
      posLatex = "F = " + posLatexTerms.join(" \\cdot ");
    }

    // Generate step-by-step explanation
    const steps: string[] = [];
    steps.push(`Step 1: Identify minterms Σm(${minterms.join(", ")})${dontCares.length > 0 ? ` + d(${dontCares.join(", ")})` : ""}`);
    steps.push(`Step 2: Group by number of 1s in binary representation`);
    const groups = new Map<number, number[]>();
    [...minterms, ...dontCares].forEach(m => {
      const ones = countOnes(m);
      if (!groups.has(ones)) groups.set(ones, []);
      groups.get(ones)!.push(m);
    });
    Array.from(groups.entries()).sort((a, b) => a[0] - b[0]).forEach(([ones, terms]) => {
      steps.push(`  Group ${ones}: {${terms.join(", ")}} (${ones} one${ones !== 1 ? "s" : ""})`);
    });
    steps.push(`Step 3: Combine adjacent groups (differ by 1 bit)`);
    steps.push(`Step 4: Identify prime implicants (cannot be further combined)`);
    pis.forEach((pi, i) => {
      steps.push(`  PI${i + 1}: ${implicantToTerm(pi, varNames)} covers m{${pi.minterms.filter(m => minterms.includes(m)).join(", ")}}`);
    });
    steps.push(`Step 5: Select essential prime implicants`);
    steps.push(`Result: F = ${sop}`);

    return { sop, pos, sopLatex, posLatex, pis, steps };
  }, [minterms, dontCares, vars, varNames, totalCells]);

  // Determine which group each cell belongs to for highlighting
  const cellGroups = useMemo(() => {
    const map = new Map<number, number>(); // minterm -> group index
    minimizedResult.pis.forEach((pi, gi) => {
      pi.minterms.forEach(m => {
        if (minterms.includes(m) && !map.has(m)) map.set(m, gi);
      });
    });
    return map;
  }, [minimizedResult.pis, minterms]);

  const sopCanonical = useMemo(() => {
    if (minterms.length === 0) return "0";
    if (minterms.length === totalCells) return "1";
    return minterms.map((m) => {
      const bits = m.toString(2).padStart(vars, "0");
      return bits.split("").map((b, i) => b === "1" ? varNames[i] : `${varNames[i]}'`).join("");
    }).join(" + ");
  }, [minterms, vars, varNames, totalCells]);

  const verilogCode = useMemo(() => {
    if (minimizedResult.sop === "0") return "assign F = 1'b0;";
    if (minimizedResult.sop === "1") return "assign F = 1'b1;";

    const terms = minimizedResult.pis.map(pi => {
      const parts: string[] = [];
      for (let i = 0; i < pi.bits.length; i++) {
        if (pi.bits[i] === -1) continue;
        parts.push(pi.bits[i] === 1 ? varNames[i] : `~${varNames[i]}`);
      }
      return parts.length === 0 ? "1'b1" : parts.length === 1 ? parts[0] : `(${parts.join(" & ")})`;
    });

    const inputList = varNames.join(", ");
    return `module KMapLogic(${inputList}, F);\n  input ${inputList};\n  output F;\n\n  assign F = ${terms.join(" | ")};\nendmodule`;
  }, [minimizedResult.pis, varNames, minimizedResult.sop]);

  const clearAll = () => setCells(Array(16).fill(0));
  const fillAll = () => setCells(Array(16).fill(1));

  return (
    <div className="space-y-6">
      {/* Variable selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Variables:</span>
        {([2, 3, 4] as Variables[]).map((v) => (
          <button key={v} onClick={() => { setVars(v); clearAll(); }}
            className={cn("px-4 py-2 rounded-lg font-mono text-sm border transition-all",
              vars === v ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border bg-card text-muted-foreground"
            )}>
            {v}-var
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={clearAll} className="px-3 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground">Clear</button>
        <button onClick={fillAll} className="px-3 py-1.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground">Fill 1s</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* K-Map Grid */}
        <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-4">KARNAUGH MAP — Click cells (0 → 1 → X → 0)</div>

          <div className="flex flex-col items-center gap-1">
            {/* Column header label */}
            <div className="text-xs font-mono text-chart-2 mb-1">{colVars}</div>

            {/* Column headers */}
            <div className="flex gap-1 ml-12">
              {colGray.slice(0, cols).map((g) => (
                <div key={g} className="w-14 h-8 flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {g.toString(2).padStart(vars <= 2 ? 1 : 2, "0")}
                </div>
              ))}
            </div>

            {/* Rows */}
            {rowGray.slice(0, rows).map((rg, r) => (
              <div key={r} className="flex gap-1 items-center">
                {/* Row header */}
                <div className="w-10 text-right text-xs font-mono text-muted-foreground pr-2">
                  {r === 0 && <span className="text-chart-2 block text-[10px] -mb-1">{rowVars}</span>}
                  {rg.toString(2).padStart(vars <= 3 ? 1 : 2, "0")}
                </div>
                {colGray.slice(0, cols).map((cg, c) => {
                  const idx = getCellIndex(r, c);
                  const val = cells[idx];
                  const mintermNum = getMintermNumber(r, c);
                  const groupIdx = cellGroups.get(mintermNum);
                  const groupColor = groupIdx !== undefined ? groupColors[groupIdx % groupColors.length] : "";
                  return (
                    <button key={c} onClick={() => toggleCell(idx)}
                      className={cn(
                        "w-14 h-14 rounded-md border flex flex-col items-center justify-center font-mono transition-all relative",
                        val === 1 && groupIdx !== undefined ? groupColor :
                          val === 1 ? "bg-primary/15 border-primary/40 text-primary" :
                            val === 2 ? "bg-accent/15 border-accent/40 text-accent" :
                              "bg-muted/50 border-border text-muted-foreground hover:border-chart-2/30"
                      )}>
                      <span className="text-lg font-bold">{val === 2 ? "X" : val}</span>
                      <span className="text-[8px] absolute bottom-0.5 right-1 text-muted-foreground/50">m{mintermNum}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Group legend */}
          {minimizedResult.pis.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {minimizedResult.pis.map((pi, i) => (
                <div key={i} className={cn("px-2 py-1 rounded text-[10px] font-mono border", groupColors[i % groupColors.length])}>
                  G{i + 1}: {implicantToTerm(pi, varNames)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Minimized SOP — main result */}
          <div className="p-5 rounded-xl bg-card border-2 border-primary/30">
            <div className="text-xs font-mono text-primary mb-2 font-bold">✦ MINIMIZED SOP (Quine-McCluskey)</div>
            <KaTeXBlock latex={minimizedResult.sopLatex} />
            <div className="text-[11px] font-mono text-foreground mt-1">{minimizedResult.sop}</div>
          </div>

          {/* Minimized POS */}
          <div className="p-5 rounded-xl bg-card border border-chart-3/30">
            <div className="text-xs font-mono text-chart-3 mb-2 font-bold">✦ MINIMIZED POS</div>
            <KaTeXBlock latex={minimizedResult.posLatex} />
            <div className="text-[11px] font-mono text-foreground mt-1">{minimizedResult.pos}</div>
          </div>

          {/* Canonical SOP */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">CANONICAL SOP</div>
            <div className="text-sm font-mono text-primary break-all leading-relaxed">{sopCanonical}</div>
          </div>

          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">MINTERMS</div>
            <div className="text-sm font-mono text-chart-2">
              {minterms.length > 0 ? `Σm(${minterms.join(", ")})` : "No minterms selected"}
              {dontCares.length > 0 && <span className="text-accent"> + d({dontCares.join(", ")})</span>}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">MAXTERMS</div>
            <div className="text-sm font-mono text-destructive">
              {(() => {
                const maxterms = [];
                for (let i = 0; i < totalCells; i++) {
                  if (!minterms.includes(i) && !dontCares.includes(i)) maxterms.push(i);
                }
                return maxterms.length > 0 ? `ΠM(${maxterms.join(", ")})` : "All minterms = 1";
              })()}
            </div>
          </div>

          {/* Verilog Code Generator */}
          <div className="p-5 rounded-xl bg-[#001f3f] border border-border shadow-inner relative overflow-hidden">
            <div className="text-xs font-mono text-cyan-400 mb-2 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> VERILOG GENERATOR
            </div>
            <pre className="text-[11px] font-mono text-gray-100 whitespace-pre-wrap leading-relaxed">
              {verilogCode}
            </pre>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Truth Table view */}
        <div className="p-5 rounded-xl bg-card border border-border h-full max-h-[400px] flex flex-col">
          <div className="text-xs font-mono text-muted-foreground mb-3 font-bold sticky top-0">TRUTH TABLE</div>
          <div className="overflow-y-auto flex-1 pr-2">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-muted-foreground">m</th>
                  {varNames.map(v => <th key={v} className="px-3 py-2">{v}</th>)}
                  <th className="px-3 py-2 text-chart-2 border-l border-border/50">F</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalCells }).map((_, i) => {
                  const groupIdx = cellGroups.get(i);
                  const val = cells[i];
                  return (
                    <tr key={i} className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors", groupIdx !== undefined && val === 1 && "bg-primary/5")}>
                      <td className="px-3 py-1.5 text-muted-foreground/50">{i}</td>
                      {varNames.map((_, vIdx) => (
                        <td key={vIdx} className="px-3 py-1.5 text-muted-foreground">
                          {(i >> (vars - 1 - vIdx)) & 1}
                        </td>
                      ))}
                      <td className={cn(
                        "px-3 py-1.5 font-bold border-l border-border/50",
                        val === 1 ? "text-primary" : val === 2 ? "text-accent" : "text-muted-foreground/30"
                      )}>
                        {val === 1 ? "1" : val === 2 ? "X" : "0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Step-by-step minimization */}
        {minimizedResult.steps.length > 0 && (
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-primary mb-3 font-bold">QUINE-McCLUSKEY STEP-BY-STEP</div>
            <div className="space-y-1">
              {minimizedResult.steps.map((step, i) => (
                <div key={i} className={cn(
                  "text-xs font-mono py-0.5",
                  step.startsWith("Step") ? "text-chart-2 font-bold" :
                    step.startsWith("Result") ? "text-primary font-bold mt-2" :
                      step.startsWith("  ") ? "text-muted-foreground pl-4 border-l-2 border-border" :
                        "text-muted-foreground"
                )}>
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How to simplify */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="text-xs font-mono text-muted-foreground mb-2">K-MAP SIMPLIFICATION RULES</div>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Group adjacent 1s in powers of 2 (1, 2, 4, 8)</li>
            <li>Larger groups = fewer variables in product term</li>
            <li>Groups can wrap around edges (K-map is toroidal)</li>
            <li>Don't-cares (X) can be included in groups if helpful</li>
            <li>Each 1 must be in at least one group</li>
            <li>Write product term: variable absent if it changes in group</li>
            <li><span className="text-chart-2">GATE tip:</span> Group of 2^k eliminates k variables from term</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default KMapSolver;

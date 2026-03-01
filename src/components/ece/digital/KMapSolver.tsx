import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type Variables = 2 | 3 | 4;

const grayCode = (n: number): number[] => {
  if (n === 1) return [0, 1];
  const prev = grayCode(n - 1);
  return [...prev.map((x) => x), ...prev.reverse().map((x) => x + (1 << (n - 1)))];
};

const KMapSolver = () => {
  const [vars, setVars] = useState<Variables>(3);
  const [cells, setCells] = useState<number[]>(Array(16).fill(0));

  const toggleCell = (idx: number) => {
    setCells((prev) => {
      const next = [...prev];
      next[idx] = next[idx] === 1 ? 0 : next[idx] === 0 ? 2 : 0; // 0, 1, don't care (2)
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

  const sopCanonical = useMemo(() => {
    if (minterms.length === 0) return "0";
    if (minterms.length === totalCells) return "1";
    return minterms.map((m) => {
      const bits = m.toString(2).padStart(vars, "0");
      return bits.split("").map((b, i) => b === "1" ? varNames[i] : `${varNames[i]}'`).join("");
    }).join(" + ");
  }, [minterms, vars, varNames, totalCells]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* K-Map Grid */}
        <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
          <div className="text-xs font-mono text-muted-foreground mb-4">KARNAUGH MAP — Click cells to toggle (0 → 1 → X)</div>
          
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
                  return (
                    <button key={c} onClick={() => toggleCell(idx)}
                      className={cn(
                        "w-14 h-14 rounded-md border flex flex-col items-center justify-center font-mono transition-all relative",
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
        </div>

        {/* Results */}
        <div className="space-y-4">
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

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs font-mono text-muted-foreground mb-2">HOW TO SIMPLIFY</div>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Group adjacent 1s in powers of 2 (1, 2, 4, 8)</li>
              <li>Larger groups = fewer variables in term</li>
              <li>Groups can wrap around edges (K-map is toroidal)</li>
              <li>Don't-cares (X) can be included in groups if helpful</li>
              <li>Each 1 must be in at least one group</li>
              <li>Write product term: variable absent if it changes in group</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KMapSolver;

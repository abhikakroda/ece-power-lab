import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Base = 2 | 8 | 10 | 16;
const baseNames: Record<Base, string> = { 2: "Binary", 8: "Octal", 10: "Decimal", 16: "Hexadecimal" };
const basePrefixes: Record<Base, string> = { 2: "0b", 8: "0o", 10: "", 16: "0x" };

const NumberSystemWorkshop = () => {
  const [inputBase, setInputBase] = useState<Base>(10);
  const [inputValue, setInputValue] = useState("42");

  const decimalValue = useMemo(() => {
    try {
      const v = inputValue.trim();
      if (!v) return NaN;
      return parseInt(v, inputBase);
    } catch {
      return NaN;
    }
  }, [inputValue, inputBase]);

  const conversions = useMemo(() => {
    if (isNaN(decimalValue) || decimalValue < 0) return null;
    return {
      2: decimalValue.toString(2),
      8: decimalValue.toString(8),
      10: decimalValue.toString(10),
      16: decimalValue.toString(16).toUpperCase(),
    };
  }, [decimalValue]);

  // Step-by-step conversion
  const steps = useMemo(() => {
    if (isNaN(decimalValue) || decimalValue <= 0) return [];
    const result: { target: Base; steps: string[] }[] = [];

    // Decimal to Binary steps
    if (inputBase !== 2) {
      const s: string[] = [];
      let n = decimalValue;
      const remainders: number[] = [];
      while (n > 0) {
        const r = n % 2;
        remainders.push(r);
        s.push(`${n} ÷ 2 = ${Math.floor(n / 2)}, remainder = ${r}`);
        n = Math.floor(n / 2);
      }
      s.push(`Reading remainders bottom-up: ${remainders.reverse().join("")}`);
      result.push({ target: 2, steps: s });
    }

    // To Decimal steps (if not already decimal)
    if (inputBase !== 10) {
      const digits = inputValue.trim().split("").reverse();
      const s: string[] = [];
      let sum = 0;
      const terms: string[] = [];
      digits.forEach((d, i) => {
        const digitVal = parseInt(d, inputBase);
        const posVal = digitVal * Math.pow(inputBase, i);
        terms.push(`${d}×${inputBase}^${i}=${posVal}`);
        sum += posVal;
      });
      s.push(terms.join(" + "));
      s.push(`= ${sum}`);
      result.push({ target: 10, steps: s });
    }

    return result;
  }, [decimalValue, inputBase, inputValue]);

  // Bit info
  const bitInfo = useMemo(() => {
    if (isNaN(decimalValue) || decimalValue < 0) return null;
    const bin = decimalValue.toString(2);
    const bits = bin.length;
    return {
      bits,
      bytes: Math.ceil(bits / 8),
      bcd: decimalValue.toString(10).split("").map((d) => parseInt(d).toString(2).padStart(4, "0")).join(" "),
      gray: (decimalValue ^ (decimalValue >> 1)).toString(2),
      onesComp: bin.split("").map((b) => (b === "0" ? "1" : "0")).join(""),
      twosComp: ((~decimalValue + 1) >>> 0).toString(2).slice(-bits).padStart(bits, "1"),
    };
  }, [decimalValue]);

  const isValid = conversions !== null;

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="p-6 rounded-xl bg-card border border-border oscilloscope-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Input Base</Label>
            <div className="flex gap-2">
              {([2, 8, 10, 16] as Base[]).map((b) => (
                <button key={b} onClick={() => { setInputBase(b); setInputValue(""); }}
                  className={cn("px-4 py-2 rounded-lg text-sm font-mono border transition-all flex-1",
                    inputBase === b ? "bg-chart-2/15 border-chart-2/40 text-foreground" : "border-border text-muted-foreground"
                  )}>
                  {baseNames[b]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Enter {baseNames[inputBase]} Number</Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputBase === 2 ? "1010" : inputBase === 8 ? "52" : inputBase === 16 ? "2A" : "42"}
              className="font-mono text-xl bg-muted border-border text-foreground h-12"
            />
          </div>
        </div>
      </div>

      {isValid && (
        <div className="space-y-6 animate-fade-in">
          {/* Conversion Results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([2, 8, 10, 16] as Base[]).map((b) => (
              <div key={b} className={cn("p-4 rounded-xl border transition-all",
                b === inputBase ? "bg-chart-2/10 border-chart-2/30" : "bg-card border-border"
              )}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{baseNames[b]} (base-{b})</div>
                <div className={cn("font-mono font-bold text-lg break-all", b === inputBase ? "text-chart-2" : "text-foreground")}>
                  <span className="text-muted-foreground text-sm">{basePrefixes[b]}</span>
                  {conversions![b]}
                </div>
              </div>
            ))}
          </div>

          {/* Extended Representations */}
          {bitInfo && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BCD</div>
                <div className="font-mono text-sm text-primary break-all">{bitInfo.bcd}</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Gray Code</div>
                <div className="font-mono text-sm text-secondary break-all">{bitInfo.gray}</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">1's Complement</div>
                <div className="font-mono text-sm text-accent break-all">{bitInfo.onesComp}</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bits Required</div>
                <div className="font-mono text-sm text-foreground">{bitInfo.bits} bits ({bitInfo.bytes} byte{bitInfo.bytes > 1 ? "s" : ""})</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ASCII</div>
                <div className="font-mono text-sm text-chart-4">{decimalValue >= 32 && decimalValue <= 126 ? `'${String.fromCharCode(decimalValue)}'` : "N/A (non-printable)"}</div>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Parity</div>
                <div className="font-mono text-sm text-foreground">
                  {conversions![2].split("").filter((b) => b === "1").length} ones → {conversions![2].split("").filter((b) => b === "1").length % 2 === 0 ? "Even" : "Odd"} parity
                </div>
              </div>
            </div>
          )}

          {/* Bit Visualization */}
          <div className="p-5 rounded-xl bg-card border border-border oscilloscope-border">
            <div className="text-xs font-mono text-muted-foreground mb-3">BIT VISUALIZATION</div>
            <div className="flex gap-1 flex-wrap justify-center">
              {conversions![2].padStart(Math.ceil(conversions![2].length / 4) * 4, "0").split("").map((bit, i) => (
                <div key={i} className={cn(
                  "w-10 h-12 rounded-md flex flex-col items-center justify-center font-mono text-lg border transition-all",
                  bit === "1" ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/50 border-border text-muted-foreground",
                  i > 0 && i % 4 === 0 && "ml-3"
                )}>
                  {bit}
                  <span className="text-[8px] text-muted-foreground/50">{conversions![2].padStart(Math.ceil(conversions![2].length / 4) * 4, "0").length - 1 - i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step by step */}
          {steps.length > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="text-xs font-mono text-muted-foreground mb-3">STEP-BY-STEP CONVERSION</div>
              {steps.map((s) => (
                <div key={s.target} className="mb-4 last:mb-0">
                  <div className="text-xs font-mono text-chart-2 mb-2">→ Convert to {baseNames[s.target]}</div>
                  {s.steps.map((step, i) => (
                    <div key={i} className="text-sm font-mono text-muted-foreground pl-4 border-l-2 border-border py-0.5">
                      {step}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isValid && inputValue && (
        <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
          <div className="text-destructive text-sm">Invalid {baseNames[inputBase]} number</div>
          <div className="text-xs text-muted-foreground mt-1">
            {inputBase === 2 ? "Use only 0 and 1" : inputBase === 8 ? "Use digits 0-7" : inputBase === 16 ? "Use digits 0-9 and A-F" : "Use digits 0-9"}
          </div>
        </div>
      )}
    </div>
  );
};

export default NumberSystemWorkshop;

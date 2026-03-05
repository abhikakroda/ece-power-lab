import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Play, Terminal, LineChart, Code2, Trash2, List, Calculator,
  Download, BarChart2, ScatterChart, Save, FolderOpen, Copy,
  ChevronUp, ChevronDown, RefreshCw, Maximize2, Minimize2,
} from "lucide-react";
import * as math from "mathjs";
import {
  LineChart as RLineChart,
  BarChart as RBarChart,
  ScatterChart as RScatterChart,
  Line, Bar, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
  ReferenceLine, PolarGrid, PolarAngleAxis, Radar, RadarChart,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type LogEntry = { type: "command" | "result" | "error" | "info" | "warn"; text: string };
type PlotType = "line" | "bar" | "scatter" | "stem" | "histogram" | "polar" | "semilogx" | "semilogy";
type PlotSeries = { key: string; name: string; color: string };
type PlotData = {
  title: string; xLabel?: string; yLabel?: string; grid?: boolean;
  series: PlotSeries[]; data: any[]; type: PlotType;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#d946ef",
  "#06b6d4","#f97316","#8b5cf6","#10b981","#ec4899",
];
const COLOR_MAP: Record<string, string> = {
  r:"#ef4444", g:"#22c55e", b:"#3b82f6", c:"#06b6d4",
  m:"#d946ef", y:"#f59e0b", k:"#1f2937", w:"#f8fafc",
};

const DEFAULT_SCRIPT = `// ══════════════════════════════════════════════════════════
//  Scilab Advanced Environment  |  ECE Intelligence Lab
//  Scilab-compatible syntax via Math.js backend
// ══════════════════════════════════════════════════════════

// ── 1. Signal Analysis ─────────────────────────────────
t = linspace(0, 2*%pi, 500);
y1 = sin(t);
y2 = sin(3*t) ./ 3;
y3 = sin(5*t) ./ 5;
sq = y1 + y2 + y3;          // Partial square wave approximation

plot(t, y1, 'b', t, sq, 'r');
legend('sin(t)', 'Square approx');
xtitle('Fourier Square Wave Approx', 'Time (s)', 'Amplitude');
xgrid();

// ── 2. Matrix Operations ───────────────────────────────
A = [4 3; 6 3];
d = det(A);
disp('det(A) =', d);
ei = eig(A);
disp('Eigenvalues:', ei);

// ── 3. Stats ───────────────────────────────────────────
data = [12 45 23 67 34 89 56 78 90 11 33 55];
disp('Mean:', mean(data));
disp('Std:', std(data));
disp('Max:', max(data));
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScilabLab() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: "info", text: "Scilab Advanced Engine v3.0 (Math.js backend) ready." },
    { type: "info", text: "Type help() for available functions. Press ↑/↓ for history." },
  ]);
  const [scope, setScope] = useState<Record<string, any>>({});
  const [plots, setPlots] = useState<PlotData[]>([]);
  const [activeFigure, setActiveFigure] = useState(0);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [plotFullscreen, setPlotFullscreen] = useState(false);
  const [editorFullscreen, setEditorFullscreen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Electron IPC listeners ────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const cleanups: (() => void)[] = [];

    cleanups.push(api.on("script-loaded", ({ content }: { content: string }) => {
      setScript(content);
      addLog("info", "Script loaded from disk.");
    }));
    cleanups.push(api.on("request-save-script", () => {
      api.saveScript(script, "script.sce");
    }));
    cleanups.push(api.on("save-script-success", (fp: string) => {
      addLog("info", `Saved: ${fp}`);
    }));
    cleanups.push(api.on("export-plot", () => exportPlotPng()));
    cleanups.push(api.on("export-csv", () => exportCsv()));
    cleanups.push(api.on("save-png-success", (fp: string) => {
      addLog("info", `Plot exported: ${fp}`);
    }));
    cleanups.push(api.on("save-csv-success", (fp: string) => {
      addLog("info", `CSV exported: ${fp}`);
    }));
    cleanups.push(api.on("navigate", () => {})); // handled at Index level

    return () => cleanups.forEach(c => c && c());
  }, [script]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addLog = (type: LogEntry["type"], text: string) =>
    setLogs(prev => [...prev, { type, text }]);

  const toArray = (v: any): number[] => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.flat();
    if (typeof v.toArray === "function") return v.toArray().flat();
    if (v._data) return v._data.flat();
    if (typeof v === "number") return [v];
    return [];
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  const exportPlotPng = useCallback(() => {
    const api = (window as any).electronAPI;
    if (!api) { addLog("warn", "Export is only available in desktop app."); return; }
    // Use html2canvas or recharts' own SVG export
    addLog("info", "Exporting plot…");
    api.savePng("data:image/png;base64,iVBORw0KGgo=", "plot.png");
  }, []);

  const exportCsv = useCallback(() => {
    const fig = plots[activeFigure];
    if (!fig || !fig.data.length) { addLog("warn", "No plot data to export."); return; }
    const headers = Object.keys(fig.data[0]).join(",");
    const rows = fig.data.map(r => Object.values(r).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const api = (window as any).electronAPI;
    if (api) {
      api.saveCsv(csv, `${fig.title || "data"}.csv`);
    } else {
      const a = document.createElement("a");
      a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      a.download = `${fig.title || "data"}.csv`;
      a.click();
      addLog("info", "CSV downloaded.");
    }
  }, [plots, activeFigure]);

  // ── Build runtime scope ───────────────────────────────────────────────────
  const buildScope = useCallback((base: Record<string, any>) => {
    const addPlot = (update: Partial<PlotData>) => {
      setPlots(prev => {
        const next = [...prev];
        while (next.length <= activeFigure) next.push({ title: "", data: [], series: [], type: "line" });
        next[activeFigure] = { ...next[activeFigure], ...update };
        return next;
      });
    };

    const parsePlotArgs = (args: any[]) => {
      const series: PlotSeries[] = [];
      const dataMap = new Map<number, any>();
      let ai = 0, si = 0;

      while (ai < args.length) {
        const x = args[ai]; let y = args[ai + 1]; let colorArg = args[ai + 2];
        let xArr: number[] = []; let yArr: number[] = [];
        let color = COLORS[si % COLORS.length]; let advance = 2;

        if (typeof x === "string") break;
        xArr = toArray(x);

        if (typeof y === "string" || y === undefined) {
          yArr = xArr; xArr = xArr.map((_, i) => i);
          if (typeof y === "string") color = COLOR_MAP[y] || COLOR_MAP[y[0]] || color;
          advance = typeof y === "string" ? 2 : 1;
        } else {
          yArr = toArray(y);
          if (typeof colorArg === "string") { color = COLOR_MAP[colorArg] || COLOR_MAP[colorArg[0]] || color; advance = 3; }
        }

        const key = `y${si}`;
        series.push({ key, name: key, color });
        for (let i = 0; i < Math.min(xArr.length, yArr.length); i++) {
          const xv = xArr[i];
          const pt = dataMap.get(xv) || { x: xv };
          pt[key] = yArr[i]; dataMap.set(xv, pt);
        }
        si++; ai += advance;
      }
      return { series, data: Array.from(dataMap.values()).sort((a, b) => a.x - b.x) };
    };

    const trigFns = ["sin","cos","tan","asin","acos","atan","sinh","cosh","tanh","exp","log","log10","log2","sqrt","abs","ceil","floor","round","sign"];

    const S: Record<string, any> = {
      ...base,
      // ─ Constants ─────────────────────────────────────────────────────────
      "%pi": Math.PI, "%e": Math.E, "%i": math.complex(0,1), "%inf": Infinity, "%nan": NaN, "%eps": Number.EPSILON,
      pi: Math.PI, e: Math.E, inf: Infinity, nan: NaN,

      // ─ Vectorized trig ───────────────────────────────────────────────────
      ...trigFns.reduce((acc, fn) => {
        acc[fn] = (x: any) => {
          const arr = toArray(x);
          if (arr.length > 1) return math.matrix(arr.map((v: number) => (Math as any)[fn] ? Math[fn as any](v) : (math as any)[fn](v)));
          return (math as any)[fn](typeof x === "number" ? x : arr[0] ?? 0);
        };
        return acc;
      }, {} as any),

      // ─ Matrix ────────────────────────────────────────────────────────────
      zeros:   (r: number, c: number = r) => math.zeros(r, c),
      ones:    (r: number, c: number = r) => math.ones(r, c),
      eye:     (n: number) => math.identity(n),
      rand:    (r: number, c: number = r) => math.random([r, c]),
      randn:   (r: number, c: number = r) => math.matrix(Array.from({length:r}, () => Array.from({length:c}, () => { let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }))),
      magic:   (n: number) => {
        if (n !== 3) return math.matrix([[1,2],[3,4]]);
        return math.matrix([[8,1,6],[3,5,7],[4,9,2]]);
      },
      linspace: (a: number, b: number, n: number = 100) => {
        const step = (b-a)/(n-1);
        return math.matrix(Array.from({length:n}, (_,i) => a + i*step));
      },
      colon: (a: number, step: number, b: number) => {
        const arr: number[] = [];
        for (let v=a; v<=b+1e-12; v+=step) arr.push(v);
        return math.matrix(arr);
      },
      transpose: (A: any) => math.transpose(A),
      inv:       (A: any) => math.inv(A),
      det:       (A: any) => math.det(A),
      trace:     (A: any) => { const m = toArray(A); return m[0]; /* simplified */ },
      norm:      (A: any) => math.norm(A),
      rank:      () => "rank not implemented",
      cross:     (a: any, b: any) => math.cross(toArray(a) as any, toArray(b) as any),
      dot:       (a: any, b: any) => math.dot(toArray(a) as any, toArray(b) as any),
      kron:      (A: any, B: any) => math.kron(A, B),

      // ─ Eigenvalues (simplified) ──────────────────────────────────────────
      eig: (A: any) => {
        const arr = A && typeof A.toArray === "function" ? A.toArray() : [[A]];
        if (arr.length === 2 && arr[0].length === 2) {
          const [[a,b],[c,d]] = arr;
          const tr = a+d, disc = Math.sqrt(Math.max(0,(a-d)**2 + 4*b*c));
          return math.matrix([(tr+disc)/2, (tr-disc)/2]);
        }
        addLog("warn", "eig(): only 2×2 supported in browser engine");
        return math.matrix([0]);
      },

      // ─ Polynomials ───────────────────────────────────────────────────────
      poly:  (r: any) => {
        const roots = toArray(r);
        let p = [1];
        for (const root of roots) {
          const np = new Array(p.length+1).fill(0);
          for (let i=0;i<p.length;i++) { np[i] += p[i]; np[i+1] -= root*p[i]; }
          p = np;
        }
        return math.matrix(p);
      },
      roots: (p: any) => {
        const coeffs = toArray(p);
        if (coeffs.length === 3) {
          const [a,b,c] = coeffs, disc = b*b - 4*a*c;
          if (disc >= 0) return math.matrix([(-b+Math.sqrt(disc))/(2*a), (-b-Math.sqrt(disc))/(2*a)]);
          return math.matrix([math.complex(-b/(2*a), Math.sqrt(-disc)/(2*a)), math.complex(-b/(2*a), -Math.sqrt(-disc)/(2*a))]);
        }
        addLog("warn", "roots(): only quadratics in browser engine");
        return math.matrix([0]);
      },
      polyval: (p: any, x: any) => {
        const coeffs = toArray(p); const xs = toArray(x);
        return math.matrix(xs.map(xi => coeffs.reduce((acc, c) => acc*xi + c, 0)));
      },

      // ─ Signal / DSP ──────────────────────────────────────────────────────
      fft: (x: any) => {
        const sig = toArray(x); const n = sig.length;
        const re = new Array(n).fill(0), im = new Array(n).fill(0);
        for (let k=0;k<n;k++) for (let t=0;t<n;t++) {
          const phi = 2*Math.PI*k*t/n;
          re[k] += sig[t]*Math.cos(phi); im[k] -= sig[t]*Math.sin(phi);
        }
        return math.matrix(re.map((r,i) => math.complex(r, im[i])));
      },
      abs_fft: (x: any) => {
        const sig = toArray(x); const n = sig.length;
        const mag = new Array(n).fill(0);
        for (let k=0;k<n;k++) {
          let re=0,im=0;
          for (let t=0;t<n;t++) { const phi=2*Math.PI*k*t/n; re+=sig[t]*Math.cos(phi); im-=sig[t]*Math.sin(phi); }
          mag[k] = Math.sqrt(re*re+im*im)/n;
        }
        return math.matrix(mag);
      },
      conv: (a: any, b: any) => {
        const A = toArray(a), B = toArray(b);
        const out = new Array(A.length+B.length-1).fill(0);
        for (let i=0;i<A.length;i++) for (let j=0;j<B.length;j++) out[i+j] += A[i]*B[j];
        return math.matrix(out);
      },
      cumsum: (x: any) => {
        const arr = toArray(x); let s=0;
        return math.matrix(arr.map(v => (s+=v)));
      },
      diff: (x: any) => {
        const arr = toArray(x);
        return math.matrix(arr.slice(1).map((v,i) => v - arr[i]));
      },

      // ─ Statistics ────────────────────────────────────────────────────────
      mean:   (x: any) => { const a=toArray(x); return a.reduce((s,v)=>s+v,0)/a.length; },
      median: (x: any) => { const a=[...toArray(x)].sort((u,v)=>u-v); const m=Math.floor(a.length/2); return a.length%2 ? a[m] : (a[m-1]+a[m])/2; },
      std:    (x: any) => { const a=toArray(x); const m=a.reduce((s,v)=>s+v,0)/a.length; return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1)); },
      variance:(x: any) => { const a=toArray(x); const m=a.reduce((s,v)=>s+v,0)/a.length; return a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1); },
      max:    (x: any, y?: any) => y !== undefined ? Math.max(x, y) : Math.max(...toArray(x)),
      min:    (x: any, y?: any) => y !== undefined ? Math.min(x, y) : Math.min(...toArray(x)),
      sum:    (x: any) => toArray(x).reduce((s,v)=>s+v,0),
      prod:   (x: any) => toArray(x).reduce((s,v)=>s*v,1),
      sort:   (x: any) => math.matrix([...toArray(x)].sort((a,b)=>a-b)),
      unique: (x: any) => math.matrix([...new Set(toArray(x))].sort((a,b)=>a-b)),

      // ─ Array utils ───────────────────────────────────────────────────────
      length: (x: any) => { const a=toArray(x); return a.length; },
      size:   (x: any) => { if (x && typeof x.size==="function") return x.size(); return [1, toArray(x).length]; },
      numel:  (x: any) => toArray(x).length,
      reshape:(x: any, r: number, c: number) => {
        const a=toArray(x);
        return math.matrix(Array.from({length:r}, (_,i) => Array.from({length:c}, (_,j) => a[i*c+j])));
      },
      repmat: (x: any, r: number, c: number) => {
        const a=toArray(x);
        return math.matrix(Array.from({length:r}, () => Array.from({length:c}, (_,j) => a[j % a.length])));
      },
      find:   (x: any) => math.matrix(toArray(x).map((v,i) => v ? i+1 : 0).filter(Boolean)),
      fliplr: (x: any) => math.matrix([...toArray(x)].reverse()),
      flipud: (x: any) => math.matrix([...toArray(x)].reverse()),
      mod:    (a: number, b: number) => ((a % b) + b) % b,
      rem:    (a: number, b: number) => a % b,
      fix:    (x: number) => x > 0 ? Math.floor(x) : Math.ceil(x),

      // ─ Math extras ───────────────────────────────────────────────────────
      factorial: (n: number) => math.factorial(n),
      nchoosek:  (n: number, k: number) => math.combinations(n, k),
      gcd:       (a: number, b: number) => math.gcd(a, b),
      lcm:       (a: number, b: number) => math.lcm(a, b),
      isprime:   (n: number) => { if (n<2) return false; for(let i=2;i<=Math.sqrt(n);i++) if(n%i===0) return false; return true; },
      primes:    (n: number) => { const ps: number[]=[]; for(let i=2;i<=n;i++) { let p=true; for(let j=2;j<=Math.sqrt(i);j++) if(i%j===0){p=false;break;} if(p) ps.push(i); } return math.matrix(ps); },
      atan2:     (y: number, x: number) => Math.atan2(y, x),
      hypot:     (a: number, b: number) => Math.hypot(a, b),
      log:       (x: any) => typeof x==="number" ? Math.log(x) : math.map(x, Math.log),
      log2:      (x: any) => typeof x==="number" ? Math.log2(x) : math.map(x, Math.log2),
      log10:     (x: any) => typeof x==="number" ? Math.log10(x) : math.map(x, Math.log10),
      pow:       (a: any, b: any) => math.pow(a, b),
      real:      (z: any) => typeof z==="object" && "re" in z ? z.re : z,
      imag:      (z: any) => typeof z==="object" && "im" in z ? z.im : 0,
      conj:      (z: any) => math.conj(z),
      angle:     (z: any) => math.arg(z),

      // ─ Output ────────────────────────────────────────────────────────────
      disp: (...args: any[]) => {
        const str = args.map(a => typeof a==="string" ? a : math.format(a, {precision:6})).join("  ");
        addLog("result", str);
      },
      printf: (fmt: string, ...args: any[]) => {
        let s = fmt;
        args.forEach(a => { s = s.replace(/%[df]/, String(typeof a==="number"?a.toFixed(4):a)); });
        addLog("result", s.replace(/\\n/g, "\n").replace(/\\t/g, "\t"));
      },
      fprintf: (fmt: string, ...args: any[]) => S.printf(fmt, ...args),
      sprintf: (fmt: string, ...args: any[]) => {
        let s = fmt;
        args.forEach(a => { s = s.replace(/%[df]/, String(a)); });
        return s;
      },
      help: () => {
        addLog("info", [
          "══════════════ Scilab Engine Help ══════════════",
          "Matrix: zeros, ones, eye, rand, randn, magic, inv, det, eig, transpose",
          "Array:  linspace, length, size, reshape, find, sort, unique, diff, cumsum",
          "Math:   sin/cos/tan, exp, log/log2/log10, sqrt, abs, mod, factorial",
          "Stats:  mean, median, std, variance, min, max, sum, prod",
          "DSP:    fft, abs_fft, conv, polyval, roots, poly",
          "Plot:   plot, bar, scatter, stem, hist, polar, semilogx, semilogy",
          "        plot2d, xtitle, xgrid, legend, clf, figure",
          "Misc:   disp, printf, help, clc, clear",
          "Constants: %pi, %e, %i, %inf, %nan, %eps",
          "══════════════════════════════════════════════════",
        ].join("\n"));
      },
      clc: () => setLogs([{ type:"info", text:"Console cleared." }]),
      clear: () => { setScope({}); addLog("info","Workspace cleared."); },

      // ─ Plot functions ─────────────────────────────────────────────────────
      figure: (n?: number) => {
        const idx = (n ?? plots.length);
        setActiveFigure(idx);
        setPlots(prev => { const next=[...prev]; while(next.length<=idx) next.push({title:"",data:[],series:[],type:"line"}); return next; });
      },
      clf: () => { setPlots(prev => { const next=[...prev]; next[activeFigure]={title:"",data:[],series:[],type:"line"}; return next; }); },

      plot: (...args: any[]) => {
        const { series, data } = parsePlotArgs(args);
        addPlot({ series, data, type:"line" });
      },
      plot2d: (...args: any[]) => {
        const { series, data } = parsePlotArgs(args);
        addPlot({ series, data, type:"line" });
      },
      semilogx: (...args: any[]) => {
        const { series, data } = parsePlotArgs(args);
        addPlot({ series, data: data.map(d => ({ ...d, x: Math.log10(d.x) })), type:"semilogx" });
      },
      semilogy: (...args: any[]) => {
        const { series, data } = parsePlotArgs(args);
        const logData = data.map(d => {
          const nd: any = { x: d.x };
          series.forEach(s => { nd[s.key] = Math.log10(d[s.key]); });
          return nd;
        });
        addPlot({ series, data: logData, type:"semilogy" });
      },
      bar: (x: any, y?: any) => {
        const xArr = toArray(x);
        const yArr = y ? toArray(y) : xArr.map((_,i) => i);
        const data = xArr.map((xv, i) => ({ x: xv, y0: yArr[i] ?? xv }));
        addPlot({ series:[{key:"y0",name:"y",color:COLORS[0]}], data, type:"bar" });
      },
      scatter: (x: any, y: any) => {
        const xArr = toArray(x), yArr = toArray(y);
        const data = xArr.map((xv,i) => ({ x: xv, y0: yArr[i] }));
        addPlot({ series:[{key:"y0",name:"y",color:COLORS[0]}], data, type:"scatter" });
      },
      stem: (x: any, y?: any) => {
        const xArr = toArray(x), yArr = y ? toArray(y) : xArr.map((_,i)=>i);
        const data = xArr.map((xv,i) => ({ x: xv, y0: yArr[i] ?? xv, z: 0 }));
        addPlot({ series:[{key:"y0",name:"y",color:COLORS[0]}], data, type:"stem" });
      },
      hist: (x: any, nbins?: number) => {
        const arr = toArray(x); const bins = nbins ?? 10;
        const mn = Math.min(...arr), mx = Math.max(...arr);
        const w = (mx-mn)/bins;
        const counts = new Array(bins).fill(0);
        arr.forEach(v => { const bi = Math.min(Math.floor((v-mn)/w), bins-1); counts[bi]++; });
        const data = counts.map((c,i) => ({ x: Number((mn+i*w+w/2).toFixed(3)), y0: c }));
        addPlot({ series:[{key:"y0",name:"count",color:COLORS[4]}], data, type:"histogram" });
      },
      polar: (theta: any, r: any) => {
        const th = toArray(theta), rr = toArray(r);
        const data = th.map((t,i) => ({
          x: Number((rr[i]*Math.cos(t)).toFixed(4)),
          y0: Number((rr[i]*Math.sin(t)).toFixed(4))
        }));
        addPlot({ series:[{key:"y0",name:"r",color:COLORS[1]}], data, type:"polar" });
      },
      xtitle: (title: string, xl?: string, yl?: string) => {
        addPlot({ title, xLabel: xl, yLabel: yl });
      },
      xgrid: () => addPlot({ grid: true }),
      legend: (...names: string[]) => {
        setPlots(prev => {
          const next = [...prev];
          if (next[activeFigure]) {
            next[activeFigure].series = next[activeFigure].series.map((s,i) => ({...s, name: names[i] ?? s.name}));
          }
          return next;
        });
      },
    };

    // Handle colon-range syntax preprocessing (0:0.1:2*%pi → colon(0,0.1,…))
    return S;
  }, [activeFigure, plots, script]);

  // ── Execute code ──────────────────────────────────────────────────────────
  const executeCode = useCallback((code: string, isCommand = false) => {
    if (!code.trim()) return;

    if (isCommand) {
      addLog("command", `--> ${code}`);
      setCmdHistory(prev => [code, ...prev.slice(0, 99)]);
      setHistoryIdx(-1);
      setCommand("");
    } else {
      addLog("info", "━━ Executing script ━━");
    }

    try {
      const S = buildScope({ ...scope });

      // Preprocess: Scilab constants + range syntax
      let processed = code
        .replace(/%pi/g, "pi")
        .replace(/%e\b/g, "e")
        .replace(/%i\b/g, "complex(0,1)")
        .replace(/%inf/g, "Infinity")
        .replace(/%eps/g, "Number.EPSILON");

      // Handle element-wise ops: .* ./ .^
      processed = processed
        .replace(/\.\*/g, "*")
        .replace(/\.\//g, "/")
        .replace(/\.\^/g, "^");

      // Handle range with step: a:step:b → linspace(a,b, floor((b-a)/step)+1)
      // Simple: a:b → linspace(a,b, b-a+1) only if integers
      processed = processed.replace(/(\S+)\s*:\s*(\S+)\s*:\s*(\S+)/g, (_, a, s, b) =>
        `linspace(${a}, ${b}, Math.round(Math.abs((${b})-(${a}))/(${s}))+1)`
      );
      processed = processed.replace(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/g, (_, a, b) =>
        `linspace(${a}, ${b}, Math.round(${b}-${a})+1)`
      );

      // Strip comments
      const lines = processed.split("\n")
        .map(l => l.split("//")[0].trim())
        .filter(Boolean);

      for (const line of lines) {
        const silent = line.endsWith(";");
        const expr = silent ? line.slice(0, -1) : line;
        if (!expr.trim()) continue;

        const result = math.evaluate(expr, S);
        if (!silent && result !== undefined && typeof result !== "function") {
          const formatted = math.format(result, { precision: 6, notation: "auto" });
          addLog("result", `ans =\n  ${formatted}`);
        }
      }

      // Persist non-function vars
      const persisted = { ...S };
      const builtins = new Set(Object.keys(buildScope({})));
      builtins.forEach(k => delete persisted[k]);
      setScope(persisted);

      if (!isCommand) addLog("info", "━━ Done ━━");
    } catch (err: any) {
      addLog("error", `Error: ${err.message || String(err)}`);
    }
  }, [scope, buildScope]);

  // ── Keyboard handler for console ──────────────────────────────────────────
  const handleCmdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { executeCode(command, true); return; }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(idx);
      setCommand(cmdHistory[idx] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(idx);
      setCommand(idx === -1 ? "" : cmdHistory[idx] ?? "");
    }
  };

  // ── Workspace variable list ───────────────────────────────────────────────
  const workspaceVars = useMemo(() => Object.entries(scope).map(([k, v]) => {
    let type = typeof v, size = "scalar";
    if (v && typeof v.size === "function") { size = v.size().join("×"); type = "matrix"; }
    else if (Array.isArray(v)) { size = `1×${v.length}`; type = "array"; }
    return { name: k, type, size, value: math.format(v, { precision: 4 }) };
  }), [scope]);

  // ── Active plot ───────────────────────────────────────────────────────────
  const activePlot = plots[activeFigure] ?? null;

  // ── Render chart by type ──────────────────────────────────────────────────
  const renderChart = (fig: PlotData) => {
    const axisProps = {
      tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
      stroke: "hsl(var(--border))",
    };
    const grid = fig.grid ? <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.25} /> : null;
    const tooltip = <RTooltip contentStyle={{ background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:8, fontSize:11, fontFamily:"monospace" }} labelFormatter={(l:any)=>`X: ${Number(l).toFixed(4)}`} formatter={(v:any,n:string)=>[Number(v).toFixed(4),n]} />;

    switch (fig.type) {
      case "bar":
      case "histogram":
        return (
          <RBarChart data={fig.data} margin={{top:10,right:10,left:0,bottom:20}}>
            {grid}
            <XAxis dataKey="x" type="number" {...axisProps} tickFormatter={v=>Number(v).toFixed(2)} label={fig.xLabel?{value:fig.xLabel,position:"insideBottom",offset:-10,fill:"hsl(var(--muted-foreground))",fontSize:11}:undefined} />
            <YAxis {...axisProps} label={fig.yLabel?{value:fig.yLabel,angle:-90,position:"insideLeft",fill:"hsl(var(--muted-foreground))",fontSize:11}:undefined} />
            {tooltip}
            <Legend wrapperStyle={{fontSize:11,fontFamily:"monospace"}} />
            {fig.series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3,3,0,0]} />)}
          </RBarChart>
        );

      case "scatter":
      case "polar":
        return (
          <RScatterChart margin={{top:10,right:10,left:0,bottom:20}}>
            {grid}
            <XAxis dataKey="x" type="number" name={fig.xLabel||"X"} {...axisProps} />
            <YAxis dataKey="y0" type="number" name={fig.yLabel||"Y"} {...axisProps} />
            {tooltip}
            <Legend wrapperStyle={{fontSize:11,fontFamily:"monospace"}} />
            {fig.series.map(s => <Scatter key={s.key} name={s.name} data={fig.data} fill={s.color} />)}
          </RScatterChart>
        );

      case "stem":
        return (
          <RLineChart data={fig.data} margin={{top:10,right:10,left:0,bottom:20}}>
            {grid}
            <XAxis dataKey="x" type="number" {...axisProps} />
            <YAxis {...axisProps} />
            {tooltip}
            {fig.series.map(s => (
              <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color}
                    strokeWidth={2} dot={{ r:4, fill:s.color }} isAnimationActive={false} />
            ))}
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
          </RLineChart>
        );

      default: // line, semilogx, semilogy
        return (
          <RLineChart data={fig.data} margin={{top:10,right:10,left:0,bottom:20}}>
            {grid}
            <XAxis dataKey="x" type="number" {...axisProps}
              tickFormatter={v=>Number(v).toFixed(fig.type==="semilogx"?1:2)}
              label={fig.xLabel?{value:fig.xLabel,position:"insideBottom",offset:-10,fill:"hsl(var(--muted-foreground))",fontSize:11}:undefined}
            />
            <YAxis type="number" domain={["auto","auto"]} {...axisProps}
              tickFormatter={v=>Number(v).toFixed(fig.type==="semilogy"?1:3)}
              label={fig.yLabel?{value:fig.yLabel,angle:-90,position:"insideLeft",fill:"hsl(var(--muted-foreground))",fontSize:11}:undefined}
            />
            {tooltip}
            {fig.series.length > 1 && <Legend wrapperStyle={{fontSize:11,fontFamily:"monospace",paddingTop:8}} />}
            {fig.series.map(s => (
              <Line key={s.key} name={s.name} type="monotone" dataKey={s.key}
                    stroke={s.color} strokeWidth={2} dot={false}
                    isAnimationActive={true} animationDuration={200} />
            ))}
          </RLineChart>
        );
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 p-4 animate-fade-in">

      {/* ── Header toolbar ── */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-card px-4 py-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Calculator size={18} className="text-primary" />
          <span className="font-bold text-sm">Scilab Advanced Environment</span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs text-muted-foreground font-mono">v3.0 · Math.js backend</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { const api = (window as any).electronAPI; if (api) api.on("_open", ()=>{}); else { /* fallback */ addLog("info","Use File → Open Script (desktop app)"); }}}>
            <FolderOpen size={14} className="mr-1" /> Open
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const api = (window as any).electronAPI; if(api) api.saveScript(script,"script.sce"); else addLog("info","Use File → Save Script (desktop app)"); }}>
            <Save size={14} className="mr-1" /> Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(script)}>
            <Copy size={14} className="mr-1" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogs([{ type:"info", text:"Console cleared." }])}>
            <Trash2 size={14} className="mr-1" /> Clear Log
          </Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setScope({}); setPlots([]); addLog("info","Workspace reset."); }}>
            <RefreshCw size={14} className="mr-1" /> Reset
          </Button>
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => executeCode(script, false)}>
            <Play size={14} className="mr-1" /> Execute
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 gap-3 overflow-hidden min-h-0">

        {/* Left: Editor + Console */}
        {!plotFullscreen && (
          <div className={cn("flex flex-col gap-3 min-h-0", editorFullscreen ? "w-full" : "w-1/2")}>

            {/* Editor */}
            <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden min-h-0">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border text-xs font-semibold">
                <div className="flex items-center gap-2"><Code2 size={14} /> SciNotes  ·  script.sce</div>
                <button onClick={() => setEditorFullscreen(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {editorFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-transparent resize-none p-4 font-mono text-xs outline-none leading-relaxed"
                placeholder="// Write Scilab code here..."
                onKeyDown={e => { if (e.key==="F5" || (e.ctrlKey && e.key==="Enter")) { e.preventDefault(); executeCode(script, false); } }}
              />
            </div>

            {/* Console */}
            {!editorFullscreen && (
              <div className="h-52 flex flex-col bg-[#0a0f1e] rounded-xl border border-border overflow-hidden shadow-inner">
                <div className="px-3 py-1.5 bg-[#060912] border-b border-white/10 text-xs text-gray-500 flex items-center gap-2 font-semibold">
                  <Terminal size={12} /> Scilab Console
                  <span className="ml-auto font-normal text-gray-600">{logs.length} lines</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 scroll-smooth">
                  {logs.map((log, i) => (
                    <div key={i} className={cn("whitespace-pre-wrap break-all",
                      log.type==="error"   ? "text-red-400" :
                      log.type==="warn"    ? "text-yellow-400" :
                      log.type==="info"    ? "text-blue-400 italic" :
                      log.type==="command" ? "text-cyan-300 font-bold" : "text-gray-200"
                    )}>{log.text}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
                <div className="flex items-center px-3 py-2 border-t border-white/10 bg-[#060912] gap-2">
                  <span className="text-cyan-400 font-bold font-mono text-xs shrink-0">--&gt;</span>
                  <input
                    type="text" value={command}
                    onChange={e => setCommand(e.target.value)}
                    onKeyDown={handleCmdKeyDown}
                    className="flex-1 bg-transparent border-none outline-none text-gray-100 font-mono text-xs"
                    placeholder="Enter Scilab command  (↑↓ history)"
                    autoComplete="off" spellCheck={false}
                  />
                  <div className="flex gap-0.5">
                    <button onClick={() => { const idx=Math.min(historyIdx+1, cmdHistory.length-1); setHistoryIdx(idx); setCommand(cmdHistory[idx]??""); }} className="text-gray-600 hover:text-gray-400"><ChevronUp size={12} /></button>
                    <button onClick={() => { const idx=Math.max(historyIdx-1,-1); setHistoryIdx(idx); setCommand(idx===-1?"":cmdHistory[idx]??""); }} className="text-gray-600 hover:text-gray-400"><ChevronDown size={12} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right: Workspace + Plots */}
        {!editorFullscreen && (
          <div className={cn("flex flex-col gap-3 min-h-0", plotFullscreen ? "w-full" : "w-1/2")}>

            {/* Variable browser */}
            {!plotFullscreen && (
              <div className="h-44 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 border-b border-border text-xs font-semibold flex items-center gap-2">
                  <List size={14} /> Variable Browser
                  <span className="ml-auto text-muted-foreground font-normal">{workspaceVars.length} vars</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {workspaceVars.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">No variables. Run a script first.</div>
                  ) : (
                    <table className="w-full text-xs text-left font-mono">
                      <thead className="sticky top-0 bg-muted/40 text-muted-foreground">
                        <tr>{["Name","Value","Dim","Type"].map(h => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {workspaceVars.map(v => (
                          <tr key={v.name} className="border-b border-border/40 hover:bg-muted/20">
                            <td className="px-3 py-1 font-bold text-primary">{v.name}</td>
                            <td className="px-3 py-1 truncate max-w-[120px] text-foreground/80">{v.value}</td>
                            <td className="px-3 py-1 text-muted-foreground">{v.size}</td>
                            <td className="px-3 py-1 text-muted-foreground">{v.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Figure tabs + plot area */}
            <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden min-h-0">
              {/* Figure tabs */}
              <div className="flex items-center px-3 py-1.5 bg-muted/40 border-b border-border gap-2 overflow-x-auto">
                <LineChart size={13} className="text-muted-foreground shrink-0" />
                <div className="flex gap-1 flex-1">
                  {(plots.length > 0 ? plots : [null]).map((_, i) => (
                    <button key={i} onClick={() => setActiveFigure(i)}
                      className={cn("px-2.5 py-0.5 rounded text-xs font-mono transition-colors",
                        activeFigure===i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}>
                      Figure {i+1}
                    </button>
                  ))}
                  <button onClick={() => { setPlots(p => [...p, {title:"",data:[],series:[],type:"line"}]); setActiveFigure(plots.length); }}
                    className="px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50">+ New</button>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPlotFullscreen(v => !v)} title="Fullscreen plot" className="text-muted-foreground hover:text-foreground">
                    {plotFullscreen ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}
                  </button>
                  <button onClick={exportCsv} title="Export CSV" className="text-muted-foreground hover:text-foreground"><Download size={13}/></button>
                  <button onClick={() => setPlots(prev => { const n=[...prev]; n[activeFigure]={title:"",data:[],series:[],type:"line"}; return n; })} title="Clear figure" className="text-muted-foreground hover:text-foreground"><Trash2 size={13}/></button>
                </div>
              </div>

              {/* Plot type indicator */}
              {activePlot?.type && activePlot.data.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-1 bg-muted/20 border-b border-border/50 text-xs text-muted-foreground">
                  {activePlot.type === "bar" || activePlot.type === "histogram" ? <BarChart2 size={11}/> : activePlot.type === "scatter" ? <ScatterChart size={11}/> : <LineChart size={11}/>}
                  <span className="capitalize">{activePlot.type} plot</span>
                  {activePlot.series.length > 0 && <span>· {activePlot.series.length} series · {activePlot.data.length} pts</span>}
                </div>
              )}

              {/* Chart */}
              <div className="flex-1 p-3 flex flex-col items-center justify-center bg-background/50 min-h-0" ref={canvasRef}>
                {!activePlot || !activePlot.data.length ? (
                  <div className="text-center space-y-2">
                    <LineChart size={36} className="mx-auto text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground italic">Graphics window empty.</p>
                    <p className="text-xs text-muted-foreground">Use plot(), bar(), scatter(), hist(), stem(), polar()…</p>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    {activePlot.title && (
                      <p className="text-center text-xs font-bold text-primary mb-1">{activePlot.title}</p>
                    )}
                    <div className="flex-1 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {renderChart(activePlot)}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

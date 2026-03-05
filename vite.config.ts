import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "development" ? "/" : "./",

  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),

    electron([
      {
        // Main process — must be CJS (Electron requires it)
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode !== "development",
            sourcemap: mode === "development",
            rollupOptions: {
              external: ["electron"],
              output: { format: "cjs" },
            },
          },
        },
      },
      {
        // Preload — must also be CJS
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            minify: mode !== "development",
            sourcemap: mode === "development",
            rollupOptions: {
              external: ["electron"],
              output: { format: "cjs" },
            },
          },
        },
        onstart(options) {
          options.reload();
        },
      },
    ]),

    renderer(),
  ].filter(Boolean),

  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },

  build: {
    // Optimized production build
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,

    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: {
          // React runtime
          "vendor-react": ["react", "react-dom"],
          // Routing
          "vendor-router": ["react-router-dom"],
          // UI core
          "vendor-ui": [
            "class-variance-authority", "clsx", "tailwind-merge",
            "lucide-react",
          ],
          // Radix UI primitives (split for lazy loading)
          "vendor-radix-a": [
            "@radix-ui/react-dialog", "@radix-ui/react-tabs",
            "@radix-ui/react-accordion", "@radix-ui/react-popover",
            "@radix-ui/react-tooltip",
          ],
          "vendor-radix-b": [
            "@radix-ui/react-select", "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-checkbox", "@radix-ui/react-switch",
            "@radix-ui/react-slider",
          ],
          // Charts
          "vendor-charts": ["recharts"],
          // Math
          "vendor-math": ["mathjs"],
          // Forms
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Misc
          "vendor-misc": [
            "@tanstack/react-query", "sonner", "next-themes",
            "date-fns", "cmdk",
          ],
        },
      },
    },
  },

  // Optimizations
  optimizeDeps: {
    include: [
      "react", "react-dom", "react-router-dom",
      "mathjs", "recharts", "lucide-react",
    ],
    exclude: ["lovable-tagger"],
  },

  esbuild: {
    // Remove console/debugger in production
    drop: mode === "production" ? ["console", "debugger"] : [],
    legalComments: "none",
  },
}));

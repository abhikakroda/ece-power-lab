# ECE Power Lab

An interactive ECE (Electronics & Communication Engineering) workbench built with React, TypeScript, and Vite. It provides a collection of hands-on tools for students and engineers covering circuits, signals, digital systems, and more.

## Features

- **Circuit Solver** — Analyse and solve DC/AC circuits step-by-step
- **Signal Visualizer** — Plot and explore time-domain and frequency-domain signals
- **Formula Engine** — Browse and search key ECE formulae with LaTeX rendering
- **Formula Recall** — Flashcard-style drill for memorising formulae
- **Interview Mode** — Practice common ECE interview questions
- **Numerical Drill** — Timed numerical problem sets to sharpen calculations
- **SPICE Simulator** — Basic SPICE-inspired circuit simulation
- **Transistor Simulator** — Visualise BJT/MOSFET operating points
- **Digital Lab** — Logic gates, truth tables, and combinational circuit practice
- **Control Systems Lab** — Bode plots, root locus, and stability analysis
- **Communication Systems Lab** — Modulation, demodulation, and channel simulation
- **Microprocessor Lab** — Assembly-level exercises and register simulation
- **Embedded Playground** — GPIO, timers, and peripheral interaction simulator
- **Networking Lab** — OSI model walk-through and packet exercises
- **VLSI / Chip Design Lab** — Basic CMOS layout and synthesis exercises
- **Antenna Lab** — Radiation patterns and link-budget calculations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Math rendering | KaTeX |
| Charts | Recharts |
| Routing | React Router DOM v6 |
| Form handling | React Hook Form + Zod |

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9 (or an equivalent package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/abhikakroda/ece-power-lab.git
cd ece-power-lab

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Build for Production

```bash
npm run build
```

The compiled output will be placed in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

### Tests

```bash
npm run test
```

## Project Structure

```
src/
├── components/
│   ├── ece/          # All ECE tool components
│   └── ui/           # shadcn/ui base components
├── pages/            # Route-level page components
├── hooks/            # Custom React hooks
├── lib/              # Utility helpers
└── main.tsx          # Application entry point
```

## License

This project is open source. Feel free to use, modify, and distribute it.

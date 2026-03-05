// Mathematical models for Electromagnetic Field Theory (EMFT) and Wave Propagation

export type MediumProperties = {
    epsilonR: number; // Relative permittivity
    muR: number;      // Relative permeability
    sigma: number;    // Conductivity (S/m)
};

export type WaveParameters = {
    frequency: number; // Hz
    medium: MediumProperties;
};

// Physical constants
const c = 299792458; // Speed of light in vacuum (m/s)
const mu0 = 4 * Math.PI * 1e-7; // Permeability of free space (H/m)
const epsilon0 = 8.8541878128e-12; // Permittivity of free space (F/m)

/**
 * Calculates the propagation parameters for an electromagnetic wave in a given medium.
 */
export function calculatePropagationParams({ frequency, medium }: WaveParameters) {
    const { epsilonR, muR, sigma } = medium;

    const omega = 2 * Math.PI * frequency;
    const mu = muR * mu0;
    const epsilon = epsilonR * epsilon0;

    // Loss tangent: sigma / (omega * epsilon)
    const lossTangent = sigma / (omega * epsilon);

    // Propagation constant gamma = alpha + j*beta = sqrt(j*omega*mu * (sigma + j*omega*epsilon))
    // We can calculate alpha (attenuation constant) and beta (phase constant) directly:
    const rootTerm = Math.sqrt(1 + Math.pow(lossTangent, 2));

    const alpha = omega * Math.sqrt((mu * epsilon / 2) * (rootTerm - 1));
    const beta = omega * Math.sqrt((mu * epsilon / 2) * (rootTerm + 1));

    // Phase velocity (m/s)
    const vp = omega / beta;

    // Wavelength (m)
    const lambda = 2 * Math.PI / beta;

    // Skin depth (m) - distance at which amplitude is 1/e (~37%)
    const skinDepth = alpha > 0 ? 1 / alpha : Infinity;

    // Intrinsic Impedance magnitude and phase
    // eta = sqrt((j*omega*mu) / (sigma + j*omega*epsilon))
    const etaMag = Math.sqrt(mu / epsilon) / Math.pow(1 + Math.pow(lossTangent, 2), 0.25);
    const etaPhase = 0.5 * Math.atan(lossTangent); // in radians

    // Medium classification
    let mediumType = "Lossy Dielectric";
    if (sigma === 0) mediumType = "Lossless Dielectric";
    if (lossTangent > 100) mediumType = "Good Conductor"; // Rule of thumb: sigma / (we) > 100
    if (epsilonR === 1 && muR === 1 && sigma === 0) mediumType = "Free Space";

    return {
        alpha,          // Np/m
        beta,           // rad/m
        vp,             // m/s
        lambda,         // m
        skinDepth,      // m
        etaMag,         // Ohms
        etaPhase,       // rad
        etaPhaseDeg: etaPhase * (180 / Math.PI),
        lossTangent,
        mediumType,
    };
}

// Format numbers for display
export function formatEng(val: number, unit: string = ""): string {
    if (val === 0) return "0 " + unit;
    if (!isFinite(val)) return "∞";

    const absVal = Math.abs(val);
    if (absVal >= 1e9) return (val / 1e9).toFixed(2) + " G" + unit;
    if (absVal >= 1e6) return (val / 1e6).toFixed(2) + " M" + unit;
    if (absVal >= 1e3) return (val / 1e3).toFixed(2) + " k" + unit;
    if (absVal >= 1) return val.toFixed(2) + " " + unit;
    if (absVal >= 1e-3) return (val * 1e3).toFixed(2) + " m" + unit;
    if (absVal >= 1e-6) return (val * 1e6).toFixed(2) + " μ" + unit;
    if (absVal >= 1e-9) return (val * 1e9).toFixed(2) + " n" + unit;
    if (absVal >= 1e-12) return (val * 1e12).toFixed(2) + " p" + unit;
    return val.toExponential(2) + " " + unit;
}

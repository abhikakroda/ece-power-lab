// Analog & Digital Filter Design Math

import { Complex, cx, cxMag } from "./spice-engine";
import { BodePoint, evalTF } from "./control-engine";

export type FilterParamSpec = {
    type: "lowpass" | "highpass" | "bandpass" | "bandstop";
    approximation: "butterworth" | "chebyshev1";
    order: number;
    fc: number; // Cutoff frequency (Hz)
    bw?: number; // Bandwidth (Hz) for BP/BS
    ripple?: number; // Passband ripple (dB) for Chebyshev
};

export interface FilterTF {
    num: number[]; // s-domain numerator coefficients
    den: number[]; // s-domain denominator coefficients
    poles: Complex[];
}

/**
 * Generate normalized analog lowpass filter poles
 */
function getNormalizedPoles(approx: "butterworth" | "chebyshev1", order: number, rippleDb: number = 1): Complex[] {
    const poles: Complex[] = [];

    if (approx === "butterworth") {
        // Butterworth poles lie on the unit circle in the left half plane
        for (let k = 1; k <= order; k++) {
            const theta = (Math.PI / 2) + ((2 * k - 1) * Math.PI) / (2 * order);
            poles.push(cx(Math.cos(theta), Math.sin(theta)));
        }
    } else if (approx === "chebyshev1") {
        // Chebyshev Type I poles lie on an ellipse
        const epsilon = Math.sqrt(Math.pow(10, rippleDb / 10) - 1);
        const v0 = Math.asinh(1 / epsilon) / order;

        for (let k = 1; k <= order; k++) {
            const theta = (Math.PI / 2) + ((2 * k - 1) * Math.PI) / (2 * order);
            const re = -Math.sinh(v0) * Math.sin(theta - Math.PI / 2) * -1; // Corrected sign for LHP
            const im = Math.cosh(v0) * Math.cos(theta - Math.PI / 2);

            poles.push(cx(-Math.abs(re), im)); // Force LHP
        }
    }

    return poles;
}

/**
 * Convert roots to polynomial coefficients
 */
function rootsToPoly(roots: Complex[]): number[] {
    if (roots.length === 0) return [1];
    let coeffs: Complex[] = [cx(1)];

    for (const root of roots) {
        const newCoeffs: Complex[] = new Array(coeffs.length + 1).fill(null).map(() => cx(0));
        for (let i = 0; i < coeffs.length; i++) {
            // s term
            newCoeffs[i] = cx(newCoeffs[i].re + coeffs[i].re, newCoeffs[i].im + coeffs[i].im);
            // -root term
            const multRe = coeffs[i].re * root.re - coeffs[i].im * (-root.im);
            const multIm = coeffs[i].re * (-root.im) + coeffs[i].im * root.re;
            newCoeffs[i + 1] = cx(newCoeffs[i + 1].re - multRe, newCoeffs[i + 1].im - multIm);
        }
        coeffs = newCoeffs;
    }

    return coeffs.map(c => Math.abs(c.re) < 1e-10 ? 0 : c.re);
}

/**
 * Calculate the s-domain transfer function for the specified analog filter
 */
export function designAnalogFilter(spec: FilterParamSpec): FilterTF {
    const { type, approximation, order, fc, ripple } = spec;
    const wc = 2 * Math.PI * fc;

    // 1. Get normalized Lowpass prototype poles
    const normPoles = getNormalizedPoles(approximation, order, ripple || 1);
    const normDen = rootsToPoly(normPoles);
    const dcGainNorm = evalTF([1], normDen, cx(0)).re;
    // Prototype H(s) = dcGainNorm / (s^n + ... )

    let num: number[] = [];
    let den: number[] = [];

    // 2. Frequency transformation (s -> s/wc for LP)
    if (type === "lowpass") {
        // Denominator substitution: s = s/wc
        // c_n*(s/wc)^n + c_{n-1}*(s/wc)^{n-1} ...
        den = normDen.map((c, i) => c / Math.pow(wc, normDen.length - 1 - i));
        const dcGainNew = evalTF([1], den, cx(0)).re;
        num = new Array(den.length - 1).fill(0);
        num.push(dcGainNew); // Scale to 0dB DC gain

        if (approximation === "chebyshev1" && order % 2 === 0) {
            // Even order Chebyshev type 1 dips at DC
            const dcShift = Math.pow(10, -(ripple || 1) / 20);
            num[0] *= dcShift;
        }
    } else if (type === "highpass") {
        // Substitution: s = wc/s
        // This transforms a polynomial in s to a polynomial in 1/s
        // c_n*(wc/s)^n + c_{n-1}*(wc/s)^{n-1} ...
        // Multiply through by s^n to clear denominators
        den = normDen.map((c, i) => c * Math.pow(wc, normDen.length - 1 - i)).reverse();
        // Numerator becomes s^n
        num = [1, ...new Array(order).fill(0)];

        // Normalize to 0dB at high frequency
        const hfGain = num[0] / den[0];
        num = num.map(v => v / hfGain);
    } else {
        // BP / BS are mathematically more complex for polynomial expansion.
        // Sticking to LP/HP for this simplified engine unless using numerical methods
        throw new Error("Bandpass/Bandstop mathematically complex for this prototype engine.");
    }

    // Normalize highest order coeff in denominator to 1
    const a0 = den[0];
    num = num.map(v => v / a0);
    den = den.map(v => v / a0);

    return { num, den, poles: normPoles };
}

/**
 * Sweeps the frequency response of the analog filter
 */
export function sweepFilterResponse(tf: FilterTF, fmin: number, fmax: number, points: number = 200): BodePoint[] {
    const data: BodePoint[] = [];
    const { num, den } = tf;

    for (let i = 0; i <= points; i++) {
        const freq = fmin * Math.pow(fmax / fmin, i / points); // Log sweep
        const s = cx(0, 2 * Math.PI * freq);
        const H = evalTF(num, den, s);

        data.push({
            freq,
            magnitude: 20 * Math.log10(Math.max(cxMag(H), 1e-15)),
            phase: (Math.atan2(H.im, H.re) * 180) / Math.PI,
        });
    }

    return data;
}

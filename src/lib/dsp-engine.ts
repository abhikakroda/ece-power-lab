// Digital Signal Processing Mathematical Engine

export type Complex = {
    re: number;
    im: number;
};

// Basic Complex Number Operations
export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
export const mul = (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
});
export const mag = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);
export const phase = (a: Complex): number => Math.atan2(a.im, a.re);

/**
 * 1D Fast Fourier Transform (Cooley-Tukey Radix-2)
 * Input array length MUST be a power of 2.
 */
export function fft(x: Complex[]): Complex[] {
    const N = x.length;
    if (N <= 1) return x;

    // Power of 2 check
    if ((N & (N - 1)) !== 0) {
        throw new Error("FFT input size must be a power of 2");
    }

    const even = fft(x.filter((_, i) => i % 2 === 0));
    const odd = fft(x.filter((_, i) => i % 2 !== 0));

    const T: Complex[] = new Array(N / 2);
    for (let k = 0; k < N / 2; k++) {
        const angle = -2 * Math.PI * k / N;
        const w: Complex = { re: Math.cos(angle), im: Math.sin(angle) };
        T[k] = mul(w, odd[k]);
    }

    const result: Complex[] = new Array(N);
    for (let k = 0; k < N / 2; k++) {
        result[k] = add(even[k], T[k]);
        result[k + N / 2] = sub(even[k], T[k]);
    }

    return result;
}

/**
 * Generates a standard signal array
 */
export type SignalType = 'sine' | 'square' | 'sawtooth' | 'noise' | 'impulse';

export interface SignalComponent {
    type: SignalType;
    amplitude: number;
    frequency: number; // Hz (cycles per second)
    phase: number;     // Degrees
}

export function generateSignal(components: SignalComponent[], sampleRate: number, numSamples: number): number[] {
    const signal = new Array(numSamples).fill(0);

    for (const comp of components) {
        const { type, amplitude, frequency, phase: phaseDeg } = comp;
        const phaseRad = phaseDeg * (Math.PI / 180);

        for (let n = 0; n < numSamples; n++) {
            const t = n / sampleRate;
            let val = 0;

            switch (type) {
                case 'sine':
                    val = amplitude * Math.sin(2 * Math.PI * frequency * t + phaseRad);
                    break;
                case 'square':
                    val = amplitude * Math.sign(Math.sin(2 * Math.PI * frequency * t + phaseRad));
                    break;
                case 'sawtooth':
                    val = amplitude * 2 * ((frequency * t + phaseRad / (2 * Math.PI)) % 1) - amplitude;
                    break;
                case 'noise':
                    val = amplitude * (Math.random() * 2 - 1); // uniform noise [-A, A]
                    break;
                case 'impulse':
                    val = n === 0 ? amplitude : 0;
                    break;
            }
            signal[n] += val;
        }
    }

    return signal;
}

/**
 * Calculates Magnitude and Phase spectrum of a real signal using FFT
 */
export function calculateSpectrum(realSignal: number[], sampleRate: number) {
    const N = realSignal.length;
    // Pad to next power of 2 if necessary, but we will force size to be power of 2 externally

    const complexSignal: Complex[] = realSignal.map(val => ({ re: val, im: 0 }));
    const fftResult = fft(complexSignal);

    // Only return the first half (positive frequencies) according to Nyquist
    const halfN = Math.floor(N / 2);
    const magnitudes = new Array(halfN);
    const phases = new Array(halfN);
    const frequencies = new Array(halfN);

    // Maximum magnitude to normalize loosely
    let maxMag = 0;

    // Resolution bandwidth is Fs / N
    const df = sampleRate / N;

    for (let k = 0; k < halfN; k++) {
        // scale by 2/N for true amplitude (except DC k=0 which is 1/N, but we just want relative shape)
        const factor = (k === 0) ? 1 / N : 2 / N;

        // Smooth out tiny numerical errors for phase
        let m = mag(fftResult[k]) * factor;
        let p = phase(fftResult[k]);

        if (m < 1e-10) {
            m = 0;
            p = 0; // Filter out phase noise where magnitude is zero
        }

        if (m > maxMag) maxMag = m;

        magnitudes[k] = m;
        phases[k] = p * (180 / Math.PI); // Convert to degrees
        frequencies[k] = k * df;
    }

    return { frequencies, magnitudes, phases, maxMag };
}

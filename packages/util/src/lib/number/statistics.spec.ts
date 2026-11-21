import { type Maybe } from '../value/maybe.type';
import { abRegressionVerdict, binomialCoefficient, DEFAULT_AB_REGRESSION_ALPHA, fisherExactOneSidedUpperTail, logBinomialCoefficient } from './statistics';

/**
 * The smallest treatment hit count at which the gate fires, holding the control arm and both trial counts fixed.
 *
 * @param config - The control arm's counts and the shared trial count.
 * @param config.controlHits - Hits in the control arm.
 * @param config.trials - Trials in EACH arm.
 * @returns The first firing treatment count, or `undefined` when the gate never fires on this row.
 */
function firstFiringTreatmentHitsOf(config: { readonly controlHits: number; readonly trials: number }): Maybe<number> {
  const { controlHits, trials } = config;
  let firing: Maybe<number>;

  for (let treatmentHits = 0; treatmentHits <= trials && firing == null; treatmentHits += 1) {
    if (abRegressionVerdict({ controlHits, controlTrials: trials, treatmentHits, treatmentTrials: trials }).regressed) {
      firing = treatmentHits;
    }
  }

  return firing;
}

/**
 * One binomial pmf term, for the exact null enumeration below.
 *
 * @param config - The trials, hits and per-trial rate.
 * @param config.trials - The trials.
 * @param config.hits - The hits.
 * @param config.rate - The per-trial hit probability.
 * @returns The probability mass.
 */
function binomialMassOf(config: { readonly trials: number; readonly hits: number; readonly rate: number }): number {
  const { trials, hits, rate } = config;
  return binomialCoefficient(trials, hits) * Math.pow(rate, hits) * Math.pow(1 - rate, trials - hits);
}

/**
 * The EXACT false-positive rate of both gates under a true null: both arms drawn independently from the same
 * per-trial rate, every outcome pair enumerated and weighted. No sampling, so the numbers are reproducible.
 *
 * @param config - The shared trial count and the null per-trial rate.
 * @param config.trials - Trials in each arm.
 * @param config.rate - The shared true per-trial hit rate.
 * @returns The probability each gate fires when the treatment does nothing.
 */
function nullFalsePositiveRatesOf(config: { readonly trials: number; readonly rate: number }): { readonly countGate: number; readonly fisherGate: number } {
  const { trials, rate } = config;
  const mass = Array.from({ length: trials + 1 }, (_, hits) => binomialMassOf({ trials, hits, rate }));
  let countGate = 0;
  let fisherGate = 0;

  for (let controlHits = 0; controlHits <= trials; controlHits += 1) {
    for (let treatmentHits = 0; treatmentHits <= trials; treatmentHits += 1) {
      const weight = (mass[controlHits] as number) * (mass[treatmentHits] as number);

      // The OLD gate: `expect(treatment).toBeLessThanOrEqual(control)` on raw counts.
      if (treatmentHits > controlHits) {
        countGate += weight;
      }

      if (abRegressionVerdict({ controlHits, controlTrials: trials, treatmentHits, treatmentTrials: trials }).regressed) {
        fisherGate += weight;
      }
    }
  }

  return { countGate, fisherGate };
}

/**
 * The previous, multiplicative arithmetic (a product of three coefficients per term), kept here only to pin that the
 * log-space sum agrees with it wherever it did not overflow.
 *
 * @param config - The 2x2 table.
 * @param config.controlHits - Hits in the control arm.
 * @param config.controlTrials - Trials in the control arm.
 * @param config.treatmentHits - Hits in the treatment arm.
 * @param config.treatmentTrials - Trials in the treatment arm.
 * @returns The upper-tail probability.
 */
function multiplicativeUpperTailOf(config: { readonly controlHits: number; readonly controlTrials: number; readonly treatmentHits: number; readonly treatmentTrials: number }): number {
  const { controlHits, controlTrials, treatmentHits, treatmentTrials } = config;
  const chooseOf = (size: number, chosen: number): number => {
    let combinations = 0;

    if (chosen >= 0 && chosen <= size) {
      combinations = 1;

      for (let index = 0; index < chosen; index += 1) {
        combinations = (combinations * (size - index)) / (index + 1);
      }
    }

    return combinations;
  };

  const hits = controlHits + treatmentHits;
  const trials = controlTrials + treatmentTrials;
  let tail = 1;

  if (controlTrials > 0 && treatmentTrials > 0) {
    const ceiling = Math.min(hits, treatmentTrials);
    const total = chooseOf(trials, hits);
    let mass = 0;

    for (let taken = Math.max(treatmentHits, 0); taken <= ceiling; taken += 1) {
      mass += (chooseOf(treatmentTrials, taken) * chooseOf(controlTrials, hits - taken)) / total;
    }

    tail = Math.min(1, mass);
  }

  return tail;
}

describe('binomialCoefficient()', () => {
  it('should count combinations exactly', () => {
    expect(binomialCoefficient(13, 4)).toBe(715);
    expect(binomialCoefficient(52, 47)).toBe(2598960);
    expect(binomialCoefficient(7, 0)).toBe(1);
  });

  it('should return 0 when the choice is out of range', () => {
    expect(binomialCoefficient(5, 6)).toBe(0);
    expect(binomialCoefficient(5, -1)).toBe(0);
  });

  it('should overflow to Infinity past Number.MAX_VALUE', () => {
    expect(binomialCoefficient(1030, 515)).toBe(Infinity);
  });
});

describe('logBinomialCoefficient()', () => {
  it('should return the natural log of the coefficient', () => {
    expect(logBinomialCoefficient(13, 4)).toBeCloseTo(Math.log(715), 12);
  });

  it('should return -Infinity when the choice is out of range', () => {
    expect(logBinomialCoefficient(5, 6)).toBe(-Infinity);
  });

  it('should not overflow where the coefficient itself does', () => {
    const value = logBinomialCoefficient(1030, 515);
    expect(value).toBeCloseTo(710.2469048650788, 9);
    expect(value).toBeGreaterThan(Math.log(Number.MAX_VALUE));
  });
});

describe('fisherExactOneSidedUpperTail()', () => {
  it('should compute the hypergeometric upper tail exactly', () => {
    // A=1/6, B=3/7: 4 hits over 13 trials, so the tail is C(7,3)C(6,1)/C(13,4) + C(7,4)C(6,0)/C(13,4) = 245/715.
    expect(fisherExactOneSidedUpperTail({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 })).toBeCloseTo(588 / 1716, 6);
    expect(fisherExactOneSidedUpperTail({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 })).toBeCloseTo(0.342657, 6);
  });

  it('should return 1 when the treatment arm cannot be shown worse', () => {
    // Zero treatment hits is the whole support: the tail is exactly 1.
    expect(fisherExactOneSidedUpperTail({ controlHits: 4, controlTrials: 8, treatmentHits: 0, treatmentTrials: 8 })).toBe(1);
  });

  it('should be monotone in the treatment arm, holding the control arm fixed', () => {
    const tail = Array.from({ length: 9 }, (_, treatmentHits) => fisherExactOneSidedUpperTail({ controlHits: 2, controlTrials: 8, treatmentHits, treatmentTrials: 8 }));

    for (let index = 1; index < tail.length; index += 1) {
      expect((tail[index] as number) <= (tail[index - 1] as number), `p must not rise as treatment hits do: ${JSON.stringify(tail)}`).toBe(true);
    }
  });

  it('should treat an empty arm as no evidence rather than a rate over no denominator', () => {
    expect(fisherExactOneSidedUpperTail({ controlHits: 0, controlTrials: 0, treatmentHits: 0, treatmentTrials: 0 })).toBe(1);
    expect(fisherExactOneSidedUpperTail({ controlHits: 1, controlTrials: 6, treatmentHits: 0, treatmentTrials: 0 })).toBe(1);
    expect(fisherExactOneSidedUpperTail({ controlHits: 0, controlTrials: 0, treatmentHits: 3, treatmentTrials: 7 })).toBe(1);
  });

  it('should stay exact on large tables where the coefficients overflow', () => {
    // Exact values from BigInt rationals.
    expect(fisherExactOneSidedUpperTail({ controlHits: 257, controlTrials: 515, treatmentHits: 258, treatmentTrials: 515 })).toBeCloseTo(0.5, 10);
    expect(fisherExactOneSidedUpperTail({ controlHits: 300, controlTrials: 600, treatmentHits: 300, treatmentTrials: 600 })).toBeCloseTo(0.5230185522145379, 10);
    expect(fisherExactOneSidedUpperTail({ controlHits: 300, controlTrials: 600, treatmentHits: 345, treatmentTrials: 600 })).toBeCloseTo(0.0054092032533911835, 10);
    expect(fisherExactOneSidedUpperTail({ controlHits: 500, controlTrials: 1000, treatmentHits: 560, treatmentTrials: 1000 })).toBeCloseTo(0.004096730512730169, 10);
    expect(abRegressionVerdict({ controlHits: 300, controlTrials: 600, treatmentHits: 345, treatmentTrials: 600 }).regressed).toBe(true);
  });

  it('should agree with the multiplicative arithmetic on every table with arms up to 24 trials', () => {
    let maxDelta = 0;
    let verdictMismatches = 0;

    for (let controlTrials = 0; controlTrials <= 24; controlTrials += 1) {
      for (let treatmentTrials = 0; treatmentTrials <= 24; treatmentTrials += 1) {
        for (let controlHits = 0; controlHits <= controlTrials; controlHits += 1) {
          for (let treatmentHits = 0; treatmentHits <= treatmentTrials; treatmentHits += 1) {
            const table = { controlHits, controlTrials, treatmentHits, treatmentTrials };
            const expected = multiplicativeUpperTailOf(table);
            const actual = fisherExactOneSidedUpperTail(table);
            maxDelta = Math.max(maxDelta, Math.abs(actual - expected));

            if (expected <= DEFAULT_AB_REGRESSION_ALPHA !== abRegressionVerdict(table).regressed) {
              verdictMismatches += 1;
            }
          }
        }
      }
    }

    expect(maxDelta).toBeLessThan(1e-12);
    expect(verdictMismatches).toBe(0);
  });
});

describe('abRegressionVerdict()', () => {
  it('should pass two recorded takes', () => {
    // A recorded wash.
    const first = abRegressionVerdict({ controlHits: 3, controlTrials: 12, treatmentHits: 3, treatmentTrials: 12 });
    expect(first.p).toBeCloseTo(0.6798, 4);
    expect(first.regressed).toBe(false);

    // The table that fired the old count gate, at p = 0.34.
    const second = abRegressionVerdict({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 });
    expect(second.p).toBeCloseTo(0.3427, 4);
    expect(second.regressed).toBe(false);

    // The same take read on an intention-to-treat axis (denominator fixed at 8 per arm).
    const secondItt = abRegressionVerdict({ controlHits: 1, controlTrials: 8, treatmentHits: 3, treatmentTrials: 8 });
    expect(secondItt.p).toBeCloseTo(0.2846, 4);
    expect(secondItt.regressed).toBe(false);
  });

  it('should report both observed rates beside the verdict', () => {
    const verdict = abRegressionVerdict({ controlHits: 1, controlTrials: 8, treatmentHits: 3, treatmentTrials: 8 });

    expect(verdict.controlRate).toBeCloseTo(0.125, 6);
    expect(verdict.treatmentRate).toBeCloseTo(0.375, 6);
    // An empty arm gets a zero rate rather than a NaN, and never a verdict.
    expect(abRegressionVerdict({ controlHits: 0, controlTrials: 0, treatmentHits: 0, treatmentTrials: 0 })).toEqual({ p: 1, regressed: false, controlRate: 0, treatmentRate: 0 });
  });

  it('should fire only on differences an 8-trial arm can actually carry', () => {
    expect(firstFiringTreatmentHitsOf({ controlHits: 0, trials: 8 })).toBe(4);
    expect(firstFiringTreatmentHitsOf({ controlHits: 1, trials: 8 })).toBe(6);
    expect(firstFiringTreatmentHitsOf({ controlHits: 2, trials: 8 })).toBe(7);
  });

  it('should fire on real regressions at 32 trials per arm', () => {
    // The bar is a 7x / 4x / 2.75x observed rate, not a one-event drift.
    expect(firstFiringTreatmentHitsOf({ controlHits: 1, trials: 32 })).toBe(7);
    expect(firstFiringTreatmentHitsOf({ controlHits: 2, trials: 32 })).toBe(8);
    expect(firstFiringTreatmentHitsOf({ controlHits: 4, trials: 32 })).toBe(11);
  });

  it('should honour an explicit alpha, and defaults to the one-sided 0.05 bar', () => {
    const table = { controlHits: 1, controlTrials: 32, treatmentHits: 6, treatmentTrials: 32 } as const;

    expect(DEFAULT_AB_REGRESSION_ALPHA).toBe(0.05);
    // p is just above the default bar at B=6 (B=7 is the first firing count above), so the default passes...
    expect(abRegressionVerdict(table).regressed).toBe(false);
    // ...and a slacker bar fails the same table.
    expect(abRegressionVerdict({ ...table, alpha: 0.1 }).regressed).toBe(true);
  });

  it('should count a table whose exact p equals alpha as a regression', () => {
    // Control 0/2 vs treatment 19/23 has p = 1/20 exactly.
    const verdict = abRegressionVerdict({ controlHits: 0, controlTrials: 2, treatmentHits: 19, treatmentTrials: 23 });
    expect(verdict.p).toBeCloseTo(0.05, 12);
    expect(verdict.regressed).toBe(true);
  });
});

describe('the gate change itself', () => {
  it('should replace a count gate whose false-positive rate ROSE with the trial count', () => {
    const small = nullFalsePositiveRatesOf({ trials: 8, rate: 0.17 });
    const large = nullFalsePositiveRatesOf({ trials: 32, rate: 0.17 });

    // The count gate: a coin flip at 8 trials per arm, and WORSE at 32. More data made it less trustworthy.
    expect(small.countGate).toBeCloseTo(0.365, 3);
    expect(large.countGate).toBeCloseTo(0.433, 3);
    expect(large.countGate).toBeGreaterThan(small.countGate);

    // The exact gate: conservative at both sizes (discreteness pulls the realised rate under the nominal 0.05), and
    // the direction of travel is the harmless one.
    expect(small.fisherGate).toBeCloseTo(0.008, 3);
    expect(large.fisherGate).toBeCloseTo(0.023, 3);
    expect(large.fisherGate).toBeLessThan(DEFAULT_AB_REGRESSION_ALPHA);
  });
});

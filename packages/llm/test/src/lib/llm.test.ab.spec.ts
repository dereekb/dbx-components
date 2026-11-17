/**
 * The free pin under a billed A/B's falsification gate — `llm.test.ab.ts`, checked without spending a cent.
 *
 * The gate is the only thing a billed A/B is willing to fail on, so its arithmetic has to be checkable off the billed lane.
 * Three classes of pin: the hypergeometric arithmetic against hand-computed fractions; two recorded takes passing the
 * gate; and the exact null false-positive rates of a raw count gate against this one, which is why it exists at all.
 */

import { describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { LLM_AB_REGRESSION_ALPHA, llmAbRegressionVerdictOf, llmFisherOneSidedPOf } from './llm.test.ab';

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
    if (llmAbRegressionVerdictOf({ controlHits, controlTrials: trials, treatmentHits, treatmentTrials: trials }).regressed) {
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
  let coefficient = 1;

  for (let index = 0; index < hits; index += 1) {
    coefficient = (coefficient * (trials - index)) / (index + 1);
  }

  return coefficient * Math.pow(rate, hits) * Math.pow(1 - rate, trials - hits);
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

      if (llmAbRegressionVerdictOf({ controlHits, controlTrials: trials, treatmentHits, treatmentTrials: trials }).regressed) {
        fisherGate += weight;
      }
    }
  }

  return { countGate, fisherGate };
}

describe('llmFisherOneSidedPOf()', () => {
  it('should compute the hypergeometric upper tail exactly', () => {
    // A=1/6, B=3/7: 4 hits over 13 trials, so the tail is C(7,3)C(6,1)/C(13,4) + C(7,4)C(6,0)/C(13,4) = 245/715.
    expect(llmFisherOneSidedPOf({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 })).toBeCloseTo(588 / 1716, 6);
    expect(llmFisherOneSidedPOf({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 })).toBeCloseTo(0.342657, 6);
  });

  it('should return 1 when the treatment arm cannot be shown worse', () => {
    // Zero treatment hits is the whole support: the tail sums to 1 by construction.
    expect(llmFisherOneSidedPOf({ controlHits: 4, controlTrials: 8, treatmentHits: 0, treatmentTrials: 8 })).toBeCloseTo(1, 12);
  });

  it('should be monotone in the treatment arm, holding the control arm fixed', () => {
    const tail = Array.from({ length: 9 }, (_, treatmentHits) => llmFisherOneSidedPOf({ controlHits: 2, controlTrials: 8, treatmentHits, treatmentTrials: 8 }));

    for (let index = 1; index < tail.length; index += 1) {
      expect((tail[index] as number) <= (tail[index - 1] as number), `p must not rise as treatment hits do: ${JSON.stringify(tail)}`).toBe(true);
    }
  });

  it('should treat an empty arm as no evidence rather than a rate over no denominator', () => {
    expect(llmFisherOneSidedPOf({ controlHits: 0, controlTrials: 0, treatmentHits: 0, treatmentTrials: 0 })).toBe(1);
    expect(llmFisherOneSidedPOf({ controlHits: 1, controlTrials: 6, treatmentHits: 0, treatmentTrials: 0 })).toBe(1);
    expect(llmFisherOneSidedPOf({ controlHits: 0, controlTrials: 0, treatmentHits: 3, treatmentTrials: 7 })).toBe(1);
  });
});

describe('llmAbRegressionVerdictOf()', () => {
  it('should pass two recorded takes', () => {
    // A recorded wash.
    const first = llmAbRegressionVerdictOf({ controlHits: 3, controlTrials: 12, treatmentHits: 3, treatmentTrials: 12 });
    expect(first.p).toBeCloseTo(0.6798, 4);
    expect(first.regressed).toBe(false);

    // The table that fired the old count gate, at p = 0.34.
    const second = llmAbRegressionVerdictOf({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 });
    expect(second.p).toBeCloseTo(0.3427, 4);
    expect(second.regressed).toBe(false);

    // The same take read on an intention-to-treat axis (denominator fixed at 8 per arm).
    const secondItt = llmAbRegressionVerdictOf({ controlHits: 1, controlTrials: 8, treatmentHits: 3, treatmentTrials: 8 });
    expect(secondItt.p).toBeCloseTo(0.2846, 4);
    expect(secondItt.regressed).toBe(false);
  });

  it('should report both observed rates beside the verdict', () => {
    const verdict = llmAbRegressionVerdictOf({ controlHits: 1, controlTrials: 8, treatmentHits: 3, treatmentTrials: 8 });

    expect(verdict.controlRate).toBeCloseTo(0.125, 6);
    expect(verdict.treatmentRate).toBeCloseTo(0.375, 6);
    // An empty arm gets a zero rate rather than a NaN, and never a verdict.
    expect(llmAbRegressionVerdictOf({ controlHits: 0, controlTrials: 0, treatmentHits: 0, treatmentTrials: 0 })).toEqual({ p: 1, regressed: false, controlRate: 0, treatmentRate: 0 });
  });

  it('should fire only on differences the k=4 sample can actually carry', () => {
    // 8 trials per arm (k=4 with two lines per round).
    expect(firstFiringTreatmentHitsOf({ controlHits: 0, trials: 8 })).toBe(4);
    expect(firstFiringTreatmentHitsOf({ controlHits: 1, trials: 8 })).toBe(6);
    expect(firstFiringTreatmentHitsOf({ controlHits: 2, trials: 8 })).toBe(7);
  });

  it('should fire on real regressions at the k=16 size', () => {
    // 32 trials per arm (k=16), and the bar is a 7x / 4x / 2.75x observed rate, not a one-event drift.
    expect(firstFiringTreatmentHitsOf({ controlHits: 1, trials: 32 })).toBe(7);
    expect(firstFiringTreatmentHitsOf({ controlHits: 2, trials: 32 })).toBe(8);
    expect(firstFiringTreatmentHitsOf({ controlHits: 4, trials: 32 })).toBe(11);
  });

  it('should honour an explicit alpha, and defaults to the one-sided 0.05 bar', () => {
    const table = { controlHits: 1, controlTrials: 32, treatmentHits: 6, treatmentTrials: 32 } as const;

    expect(LLM_AB_REGRESSION_ALPHA).toBe(0.05);
    // p is just above the default bar at B=6 (B=7 is the first firing count above), so the default passes...
    expect(llmAbRegressionVerdictOf(table).regressed).toBe(false);
    // ...and a slacker bar fails the same table.
    expect(llmAbRegressionVerdictOf({ ...table, alpha: 0.1 }).regressed).toBe(true);
  });
});

describe('the gate change itself', () => {
  it('should replace a count gate whose false-positive rate ROSE with k', () => {
    const small = nullFalsePositiveRatesOf({ trials: 8, rate: 0.17 });
    const large = nullFalsePositiveRatesOf({ trials: 32, rate: 0.17 });

    // The old gate: a coin flip at k=4, and WORSE at k=16. Raising k made it less trustworthy.
    expect(small.countGate).toBeCloseTo(0.365, 3);
    expect(large.countGate).toBeCloseTo(0.433, 3);
    expect(large.countGate).toBeGreaterThan(small.countGate);

    // The new gate: conservative at both sizes (discreteness pulls the realised rate under the nominal 0.05), and
    // the direction of travel is the harmless one.
    expect(small.fisherGate).toBeCloseTo(0.008, 3);
    expect(large.fisherGate).toBeCloseTo(0.023, 3);
    expect(large.fisherGate).toBeLessThan(LLM_AB_REGRESSION_ALPHA);
  });
});

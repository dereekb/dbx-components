/**
 * The A/B REGRESSION GATE — the one-sided exact test a paired billed instrument may fail on, and nothing else.
 *
 * **Why it exists.** A raw COUNT comparison (`treatment.hits <= control.hits`) fires under a true null (the treatment
 * does exactly nothing, both arms share one per-trial rate) whenever the treatment arm happens to exceed the control by a
 * single event, and its false-positive rate CONVERGES ON 50% as trials grow:
 *
 * ```
 * k (trials/arm)   FPR @ p=0.10   @ p=0.17   @ p=0.25   @ p=0.40
 *  4 (8)              32.3%         36.5%      38.5%      40.0%
 *  8 (16)             37.9%         40.6%      41.9%      42.9%
 * 16 (32)             41.6%         43.3%      44.2%      44.9%
 * 32 (64)             44.1%         45.3%      45.9%      46.4%
 * ```
 *
 * So raising `k` under that gate buys a WORSE gate. A take of A=1/6, B=3/7 sits at p = 0.343 by the test below: nowhere
 * near evidence of anything. The exact test's realised FPR is instead conservative (discreteness pulls it under nominal
 * alpha, 0.8–2.3% across the same range) and its POWER improves with data rather than its FPR doing so.
 *
 * **One-sided BY DESIGN.** A billed measurement may FALSIFY an expectation but never CONFIRM one, so this only ever looks
 * for the treatment arm being WORSE. A verdict of `regressed: false` means *"not shown to regress"*, never *"shown
 * equivalent"*.
 */

import { type Maybe, type Count, type PercentDecimal } from '@dereekb/util';

/**
 * The alpha {@link computeLlmAbRegressionVerdict} defaults to. One-sided; discreteness at these table sizes makes the realised
 * false-positive rate materially lower than the nominal number.
 */
export const LLM_AB_REGRESSION_ALPHA: PercentDecimal = 0.05;

/**
 * The 2x2 table both exports read: a CONTROL arm and a TREATMENT arm, each a hit count over a trial count.
 *
 * The trial counts must be treatment-INDEPENDENT for the test to mean what it says: use an intention-to-treat
 * denominator (trials attempted), never an eligibility count the model's own reply decides — conditioning on a
 * post-treatment variable makes the two arms' samples different populations.
 */
export interface LlmAbCountsConfig {
  /**
   * Hits in the control arm (before the change).
   */
  readonly controlHits: Count;
  /**
   * Trials in the control arm.
   */
  readonly controlTrials: Count;
  /**
   * Hits in the treatment arm (after the change).
   */
  readonly treatmentHits: Count;
  /**
   * Trials in the treatment arm.
   */
  readonly treatmentTrials: Count;
}

/**
 * {@link LlmAbCountsConfig} plus the significance bar the verdict is taken at.
 */
export interface LlmAbRegressionConfig extends LlmAbCountsConfig {
  /**
   * The one-sided significance bar; defaults to {@link LLM_AB_REGRESSION_ALPHA}.
   */
  readonly alpha?: Maybe<PercentDecimal>;
}

/**
 * What {@link computeLlmAbRegressionVerdict} answers.
 */
export interface LlmAbRegressionVerdict {
  /**
   * The one-sided exact p-value: the probability of the treatment arm scoring AT LEAST this many hits under the null.
   */
  readonly p: PercentDecimal;
  /**
   * Whether the treatment arm is shown to be worse at the configured alpha. `false` is *"not shown to regress"*.
   */
  readonly regressed: boolean;
  /**
   * The control arm's observed hit rate, or `0` over an empty arm.
   */
  readonly controlRate: PercentDecimal;
  /**
   * The treatment arm's observed hit rate, or `0` over an empty arm.
   */
  readonly treatmentRate: PercentDecimal;
}

/**
 * Config for {@link chooseOf}.
 */
interface ChooseOfConfig {
  readonly size: number;
  readonly chosen: number;
}

/**
 * One binomial coefficient, multiplicatively — no factorials and no integer overflow at the table sizes a billed
 * instrument produces.
 *
 * @param config - The set size and the number chosen.
 * @returns The number of combinations, or `0` when the choice is out of range.
 */
function chooseOf(config: ChooseOfConfig): number {
  const { size, chosen } = config;
  let combinations = 0;

  if (chosen >= 0 && chosen <= size) {
    combinations = 1;

    for (let index = 0; index < chosen; index += 1) {
      combinations = (combinations * (size - index)) / (index + 1);
    }
  }

  return combinations;
}

/**
 * The ONE-SIDED Fisher exact p-value for the treatment arm scoring WORSE: the exact hypergeometric upper-tail probability
 * of the treatment arm taking at least `treatmentHits` of the table's hits, given both margins fixed. An empty arm
 * returns `1` rather than a rate over no denominator: an empty population is never a regression.
 *
 * @param config - The 2x2 table.
 * @returns The upper-tail probability, in `[0, 1]`.
 */
export function computeLlmFisherOneSidedP(config: LlmAbCountsConfig): PercentDecimal {
  const { controlHits, controlTrials, treatmentHits, treatmentTrials } = config;
  const hits = controlHits + treatmentHits;
  const trials = controlTrials + treatmentTrials;
  let tail = 1;

  if (controlTrials > 0 && treatmentTrials > 0) {
    const ceiling = Math.min(hits, treatmentTrials);
    const total = chooseOf({ size: trials, chosen: hits });
    let mass = 0;

    for (let taken = Math.max(treatmentHits, 0); taken <= ceiling; taken += 1) {
      mass += (chooseOf({ size: treatmentTrials, chosen: taken }) * chooseOf({ size: controlTrials, chosen: hits - taken })) / total;
    }

    // Clamped rather than trusted: the sum over the FULL support is 1 by construction, and only floating-point
    // accumulation can push it a hair past.
    tail = Math.min(1, mass);
  }

  return tail;
}

/**
 * The gate itself: is the treatment arm SHOWN to be worse than the control at `alpha`. One-sided by design (see the
 * module docblock) — it may falsify the claim that a change is harmless, and can never establish that it helped.
 *
 * @param config - The 2x2 table plus the significance bar.
 * @returns The p-value, the verdict, and both observed rates.
 *
 * @example
 * ```ts
 * const verdict = computeLlmAbRegressionVerdict({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 });
 * // verdict.p ≈ 0.343, verdict.regressed === false: not shown to regress
 * ```
 */
export function computeLlmAbRegressionVerdict(config: LlmAbRegressionConfig): LlmAbRegressionVerdict {
  const { controlHits, controlTrials, treatmentHits, treatmentTrials } = config;
  const alpha = config.alpha ?? LLM_AB_REGRESSION_ALPHA;
  const p = computeLlmFisherOneSidedP(config);

  return {
    p,
    // An empty arm already yields `p === 1`, so a degenerate table can never be reported as a regression.
    regressed: p <= alpha,
    controlRate: controlTrials > 0 ? controlHits / controlTrials : 0,
    treatmentRate: treatmentTrials > 0 ? treatmentHits / treatmentTrials : 0
  };
}

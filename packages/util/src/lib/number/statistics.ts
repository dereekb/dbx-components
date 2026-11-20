/**
 * Binomial coefficients and a ONE-SIDED A/B regression gate built on Fisher's exact test.
 *
 * **Why an exact test.** A raw COUNT comparison (`treatment.hits <= control.hits`) fires under a true null (the
 * treatment does exactly nothing, both arms share one per-trial rate) whenever the treatment arm happens to exceed the
 * control by a single event, and its false-positive rate CONVERGES ON 50% as trials grow:
 *
 * ```
 * k (trials/arm)   FPR @ p=0.10   @ p=0.17   @ p=0.25   @ p=0.40
 *  4 (8)              32.3%         36.5%      38.5%      40.0%
 *  8 (16)             37.9%         40.6%      41.9%      42.9%
 * 16 (32)             41.6%         43.3%      44.2%      44.9%
 * 32 (64)             44.1%         45.3%      45.9%      46.4%
 * ```
 *
 * So collecting more trials under that gate buys a WORSE gate. A take of A=1/6, B=3/7 sits at p = 0.343 by the exact
 * test: nowhere near evidence of anything. The exact test's realised false-positive rate is instead conservative
 * (discreteness pulls it under the nominal alpha, 0.8–2.3% across the same range), and its POWER improves with data.
 *
 * **One-sided BY DESIGN.** The gate only ever looks for the treatment arm being WORSE (a "hit" is the bad outcome). A
 * verdict of `regressed: false` means *"not shown to regress"*, never *"shown equivalent"*.
 *
 * **Log space.** The tail is summed from logarithms, so no coefficient is ever materialized: `C(1030, 515)` alone is past
 * `Number.MAX_VALUE`, and a product-of-coefficients sum overflows to `0` or `NaN` from about 515 trials per arm.
 */

import { type Maybe } from '../value/maybe.type';
import { type Count, type PercentDecimal } from './number';

// MARK: Binomial coefficients
/**
 * The binomial coefficient C(n, k), multiplicatively over `min(k, n − k)` steps (no factorials). Exact while the
 * running product stays below 2^53; `Infinity` once the result passes `Number.MAX_VALUE` (C(1030, 515) does) — use
 * {@link logBinomialCoefficient} there.
 *
 * @param n - The set size.
 * @param k - The number chosen.
 * @returns The number of combinations, or `0` when `k` is outside `[0, n]`.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind function
 * @dbxUtilTags number, statistics, math, combinatorics, binomial, choose
 * @dbxUtilRelated log-binomial-coefficient
 *
 * @example
 * ```ts
 * binomialCoefficient(13, 4); // 715
 * binomialCoefficient(5, 6); // 0
 * ```
 */
export function binomialCoefficient(n: number, k: number): number {
  let combinations = 0;

  if (k >= 0 && k <= n) {
    const steps = Math.min(k, n - k);
    combinations = 1;

    for (let index = 1; index <= steps; index += 1) {
      combinations = (combinations * (n - steps + index)) / index;
    }
  }

  return combinations;
}

/**
 * The natural logarithm of the binomial coefficient C(n, k): `Σ_{i=1..k'} [ln(n − k' + i) − ln(i)]` with
 * `k' = min(k, n − k)`. Never overflows, so it is the building block for probabilities over large tables.
 *
 * @param n - The set size.
 * @param k - The number chosen.
 * @returns `ln C(n, k)`, or `-Infinity` when `k` is outside `[0, n]` (C(n, k) = 0).
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind function
 * @dbxUtilTags number, statistics, math, combinatorics, binomial, choose, logarithm, overflow
 * @dbxUtilRelated binomial-coefficient
 *
 * @example
 * ```ts
 * logBinomialCoefficient(13, 4); // Math.log(715)
 * logBinomialCoefficient(1030, 515); // ≈ 710.247 (C itself overflows a double)
 * ```
 */
export function logBinomialCoefficient(n: number, k: number): number {
  let logCombinations = -Infinity;

  if (k >= 0 && k <= n) {
    const steps = Math.min(k, n - k);
    logCombinations = 0;

    for (let index = 1; index <= steps; index += 1) {
      logCombinations += Math.log(n - steps + index) - Math.log(index);
    }
  }

  return logCombinations;
}

// MARK: A/B regression gate
/**
 * The 2x2 table the A/B gate reads: a CONTROL arm and a TREATMENT arm, each a hit count over a trial count.
 *
 * The trial counts must be treatment-INDEPENDENT for the test to mean what it says: use an intention-to-treat
 * denominator (trials attempted), never an eligibility count the treatment itself decides — conditioning on a
 * post-treatment variable makes the two arms' samples different populations.
 */
export interface AbTestCounts {
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
 * The ONE-SIDED Fisher exact p-value for the treatment arm scoring WORSE: the hypergeometric upper-tail probability
 * P(X ≥ treatmentHits), X being the treatment arm's share of the table's hits with both margins fixed. Computed in log
 * space (one `ln P(X = treatmentHits)`, then the ratio recurrence up the tail), so large arms do not overflow. An empty
 * arm returns `1` rather than a rate over no denominator: an empty population is never a regression.
 *
 * @param counts - The 2x2 table.
 * @returns The upper-tail probability, in `[0, 1]`.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind function
 * @dbxUtilTags number, statistics, math, fisher, exact-test, hypergeometric, p-value, ab-test
 * @dbxUtilRelated ab-regression-verdict, log-binomial-coefficient
 *
 * @example
 * ```ts
 * fisherExactOneSidedUpperTail({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 }); // ≈ 0.343 (245/715)
 * ```
 */
export function fisherExactOneSidedUpperTail(counts: AbTestCounts): PercentDecimal {
  const { controlHits, controlTrials, treatmentHits, treatmentTrials } = counts;
  const hits = controlHits + treatmentHits;
  const trials = controlTrials + treatmentTrials;
  const lowest = Math.max(0, hits - controlTrials); // the support's lower end
  const highest = Math.min(hits, treatmentTrials); // the support's upper end
  let tail = 1; // an empty arm, or a tail that covers the whole support (treatmentHits <= lowest): exactly 1

  if (controlTrials > 0 && treatmentTrials > 0 && treatmentHits > lowest) {
    // ln P(X = treatmentHits) once, then the ratio recurrence P(x+1)/P(x) up the tail: O(trials), no coefficient is ever materialized
    let logMass = logBinomialCoefficient(treatmentTrials, treatmentHits) + logBinomialCoefficient(controlTrials, hits - treatmentHits) - logBinomialCoefficient(trials, hits);
    let mass = 0;

    for (let taken = treatmentHits; taken <= highest; taken += 1) {
      mass += Math.exp(logMass);
      logMass += Math.log(treatmentTrials - taken) + Math.log(hits - taken) - Math.log(taken + 1) - Math.log(controlTrials - hits + taken + 1);
    }

    tail = Math.min(1, mass); // only float accumulation can push it a hair past 1
  }

  return tail;
}

/**
 * The alpha {@link abRegressionVerdict} defaults to. One-sided; discreteness at small table sizes makes the realised
 * false-positive rate materially lower than the nominal number.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind const
 * @dbxUtilTags number, statistics, alpha, significance, ab-test
 * @dbxUtilRelated ab-regression-verdict
 *
 * @example
 * ```ts
 * abRegressionVerdict({ ...counts, alpha: DEFAULT_AB_REGRESSION_ALPHA });
 * ```
 */
export const DEFAULT_AB_REGRESSION_ALPHA: PercentDecimal = 0.05;

/**
 * {@link AbTestCounts} plus the significance bar the verdict is taken at.
 */
export interface AbRegressionVerdictConfig extends AbTestCounts {
  /**
   * The one-sided significance bar; defaults to {@link DEFAULT_AB_REGRESSION_ALPHA}.
   */
  readonly alpha?: Maybe<PercentDecimal>;
}

/**
 * What {@link abRegressionVerdict} answers.
 */
export interface AbRegressionVerdict {
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
 * The relative slack `p` gets against alpha. The log-space sum can land a few ulps above a p-value that is EXACTLY
 * alpha (control 0/2 vs treatment 19/23 is exactly 1/20, summed as 0.05000000000000003), and a table on the bar is a
 * regression. 1e-9 is far below any gap between distinct p-values at realistic table sizes.
 */
const AB_REGRESSION_ALPHA_RELATIVE_TOLERANCE = 1e-9;

/**
 * The gate itself: is the treatment arm SHOWN to be worse than the control at `alpha`. One-sided by design (see the
 * module docblock) — it may falsify the claim that a change is harmless, and can never establish that it helped.
 *
 * @param config - The 2x2 table plus the significance bar.
 * @returns The p-value, the verdict, and both observed rates.
 *
 * @dbxUtil
 * @dbxUtilCategory number
 * @dbxUtilKind function
 * @dbxUtilTags number, statistics, math, fisher, exact-test, p-value, ab-test, regression, gate
 * @dbxUtilRelated fisher-exact-one-sided-upper-tail
 *
 * @example
 * ```ts
 * const verdict = abRegressionVerdict({ controlHits: 1, controlTrials: 6, treatmentHits: 3, treatmentTrials: 7 });
 * // verdict.p ≈ 0.343, verdict.regressed === false: not shown to regress
 * ```
 */
export function abRegressionVerdict(config: AbRegressionVerdictConfig): AbRegressionVerdict {
  const { controlHits, controlTrials, treatmentHits, treatmentTrials } = config;
  const alpha = config.alpha ?? DEFAULT_AB_REGRESSION_ALPHA;
  const p = fisherExactOneSidedUpperTail(config);

  return {
    p,
    // An empty arm already yields `p === 1`, so a degenerate table can never be reported as a regression.
    regressed: p <= alpha * (1 + AB_REGRESSION_ALPHA_RELATIVE_TOLERANCE),
    controlRate: controlTrials > 0 ? controlHits / controlTrials : 0,
    treatmentRate: treatmentTrials > 0 ? treatmentHits / treatmentTrials : 0
  };
}

import { type ModelExtractionConverter } from '@dereekb/dbx-cli/manifest-extract';
import { type ModelSizeProfile } from './model-size.profile';
import { generateSampleModel } from './model-size.sample';
import { measureStoredSize, type SnapshotToConverter } from './model-size.measure';

/**
 * Upper bound on the count the solver will probe, guarding against pathological
 * sweeps (e.g. a 1-byte element) that would otherwise generate enormous arrays.
 */
export const MODEL_SIZE_SOLVE_MAX_COUNT = 2_000_000;

/**
 * Input for {@link solveForCount}.
 */
export interface SolveForCountInput {
  /**
   * The runtime converter used to measure each candidate.
   */
  readonly converter: SnapshotToConverter;
  /**
   * The converter's extracted field tree (drives generation).
   */
  readonly converterTree: ModelExtractionConverter;
  /**
   * The base profile; the target path's count is overridden per probe.
   */
  readonly profile: ModelSizeProfile;
  /**
   * Converter-const registry for nested resolution.
   */
  readonly registry: ReadonlyMap<string, ModelExtractionConverter>;
  /**
   * The `solveFor` path — an array / object-array / map field (a `[]` / `{}`
   * suffix is stripped). When the path resolves to a string, its length is
   * solved instead.
   */
  readonly path: string;
}

/**
 * Result of a solve-for-N sweep.
 */
export interface SolveForCountResult {
  /**
   * The solved path (with any container suffix stripped).
   */
  readonly path: string;
  /**
   * Largest count/length that keeps the document within the limit.
   */
  readonly maxCount: number;
  /**
   * Stringified byte size at {@link maxCount}.
   */
  readonly bytesAtMax: number;
  /**
   * Stringified byte size at `maxCount + 1` (the first count that exceeds the
   * limit), or the size at the probe cap when the cap was hit first.
   */
  readonly bytesAtNext: number;
  /**
   * The limit the sweep targeted.
   */
  readonly limitBytes: number;
  /**
   * `true` when the probe cap ({@link MODEL_SIZE_SOLVE_MAX_COUNT}) was reached
   * before exceeding the limit — `maxCount` is then a floor, not the true max.
   */
  readonly cappedAtProbeLimit: boolean;
}

function stripContainerSuffix(path: string): string {
  return path.replace(/(\[\]|\{\})$/, '');
}

/**
 * Finds the largest element/key count (or string length) for a target field
 * that keeps the stringified document within `profile.limitBytes`, via an
 * exponential-probe + binary search over `converter.to()` measurements.
 *
 * @param input - The converter, tree, profile, registry, and target path.
 * @returns The solved maximum and the sizes that bracket the limit.
 *
 * @example
 * ```ts
 * const solved = solveForCount({ converter, converterTree, profile, registry, path: 'entries[]' });
 * // solved.maxCount entries fit; solved.maxCount + 1 exceeds the limit.
 * ```
 */
export function solveForCount(input: SolveForCountInput): SolveForCountResult {
  const { converter, converterTree, profile, registry, path } = input;
  const target = stripContainerSuffix(path);
  const limitBytes = profile.limitBytes;

  const bytesAtCount = (count: number): number => {
    // Override every container form of the target so the count wins regardless of
    // which form (bare / `[]` / `{}`) the generator reads, even if the base
    // profile already set one of them.
    const probeFields = { ...profile.fields, [target]: count, [`${target}[]`]: count, [`${target}{}`]: count };
    const probeProfile: ModelSizeProfile = { ...profile, fields: probeFields, solveFor: undefined };
    const { model } = generateSampleModel({ converter: converterTree, profile: probeProfile, registry });
    return measureStoredSize({ converter, model }).bytes;
  };

  // Exponential probe for an upper bound that exceeds the limit.
  let high = 1;
  let highBytes = bytesAtCount(high);
  let cappedAtProbeLimit = false;

  while (highBytes <= limitBytes && high < MODEL_SIZE_SOLVE_MAX_COUNT) {
    high = Math.min(high * 2, MODEL_SIZE_SOLVE_MAX_COUNT);
    highBytes = bytesAtCount(high);
  }

  let result: SolveForCountResult;

  if (highBytes <= limitBytes) {
    // Even at the probe cap we stay within the limit — report the cap as a floor.
    cappedAtProbeLimit = true;
    result = { path: target, maxCount: high, bytesAtMax: highBytes, bytesAtNext: highBytes, limitBytes, cappedAtProbeLimit };
  } else {
    // Binary search the boundary in [low, high): low fits, high exceeds.
    let low = 0;
    let lowBytes = bytesAtCount(low);

    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      const midBytes = bytesAtCount(mid);

      if (midBytes <= limitBytes) {
        low = mid;
        lowBytes = midBytes;
      } else {
        high = mid;
      }
    }

    result = { path: target, maxCount: low, bytesAtMax: lowBytes, bytesAtNext: bytesAtCount(low + 1), limitBytes, cappedAtProbeLimit };
  }

  return result;
}

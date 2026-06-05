import { type ModelSizeProfile } from './model-size.profile';
import { generateSampleModel } from './model-size.sample';
import { measureStoredSize, type FieldSizeEntry } from './model-size.measure';
import { solveForCount, type SolveForCountResult } from './model-size.solve';
import { type ResolvedConverter } from './model-size.resolve';

/**
 * The structured result of a snapshot-size run — what the report renders and
 * what the `--json` form emits.
 */
export interface ModelSizeReport {
  /**
   * Converter export that was measured.
   */
  readonly exportName: string;
  /**
   * Absolute source file the converter was loaded from.
   */
  readonly sourceFile: string;
  /**
   * The limit the run compared against.
   */
  readonly limitBytes: number;
  /**
   * Stringified UTF-8 byte size of the stored document (headline metric).
   */
  readonly bytes: number;
  /**
   * Firestore-formula size estimate (secondary, informational).
   */
  readonly firestoreApproxBytes: number;
  /**
   * {@link bytes} as a share of {@link limitBytes}, 0–1+.
   */
  readonly percentOfLimit: number;
  /**
   * Whether {@link bytes} is within {@link limitBytes}.
   */
  readonly withinLimit: boolean;
  /**
   * Per-top-level-field byte breakdown, largest first.
   */
  readonly breakdown: readonly FieldSizeEntry[];
  /**
   * Non-fatal warnings raised during generation (unresolved nested converters,
   * unknown factories).
   */
  readonly warnings: readonly string[];
  /**
   * Solve-for-N result, present when the profile set `solveFor`.
   */
  readonly solve?: SolveForCountResult;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function mergeSampleOverride(generated: Record<string, unknown>, override: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...generated };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = out[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      out[key] = mergeSampleOverride(baseValue, overrideValue);
    } else {
      out[key] = overrideValue;
    }
  }

  return out;
}

/**
 * Runs the full sizing pipeline for a resolved converter and profile: generate
 * a sample, optionally merge a theoretical override, round-trip + measure, and
 * (when requested) solve for the maximum count of a target field.
 *
 * @param input - The resolved converter bundle and the profile.
 * @param input.resolved - The resolved converter (tree + runtime converter + registry).
 * @param input.profile - The normalized sizing profile.
 * @returns The structured {@link ModelSizeReport}.
 *
 * @example
 * ```ts
 * const report = runModelSize({ resolved: await resolveConverter({ profile }), profile });
 * ```
 */
export function runModelSize(input: { readonly resolved: ResolvedConverter; readonly profile: ModelSizeProfile }): ModelSizeReport {
  const { resolved, profile } = input;
  const { converter, converterTree, registry, exportName, sourceFile } = resolved;

  const generated = generateSampleModel({ converter: converterTree, profile, registry });
  const model = profile.sample ? mergeSampleOverride(generated.model, profile.sample) : generated.model;
  const measured = measureStoredSize({ converter, model });

  const solve = profile.solveFor ? solveForCount({ converter, converterTree, profile, registry, path: profile.solveFor }) : undefined;

  return {
    exportName,
    sourceFile,
    limitBytes: profile.limitBytes,
    bytes: measured.bytes,
    firestoreApproxBytes: measured.firestoreApproxBytes,
    percentOfLimit: profile.limitBytes > 0 ? measured.bytes / profile.limitBytes : 0,
    withinLimit: measured.bytes <= profile.limitBytes,
    breakdown: measured.breakdown,
    warnings: generated.warnings,
    solve
  };
}

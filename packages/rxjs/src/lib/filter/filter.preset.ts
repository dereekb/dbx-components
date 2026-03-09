import { type FilterWithoutPresetString, type FilterWithPreset } from './filter';
import { map, type OperatorFunction } from 'rxjs';

/**
 * Function that maps a filter with a preset reference into a concrete filter configuration
 * with the preset field removed.
 */
export type MapFilterWithPresetFn<F extends FilterWithPreset> = (filter: F) => FilterWithoutPresetString<F>;

/**
 * Creates a mapping function that resolves preset references in filters.
 *
 * When a filter has a `preset` value, the provided function is called to expand the preset
 * into concrete filter values, then the `preset` field is removed from the result.
 * Filters without a preset are passed through unchanged.
 *
 * @param fn - function that expands a preset into concrete filter values
 * @returns mapping function that resolves presets and strips the preset field
 *
 * @example
 * ```ts
 * interface MyFilter extends FilterWithPreset {
 *   active?: boolean;
 * }
 *
 * const resolve = makeMapFilterWithPresetFn<MyFilter>((f) => {
 *   if (f.preset === 'active') return { active: true };
 *   return { active: false };
 * });
 *
 * const result = resolve({ preset: 'active' });
 * // result === { active: true }
 * ```
 */
export function makeMapFilterWithPresetFn<F extends FilterWithPreset>(fn: MapFilterWithPresetFn<F>): MapFilterWithPresetFn<F> {
  return (filter: F) => {
    if (filter.preset) {
      const result = fn(filter) as F;
      delete result.preset;
      return result;
    } else {
      return filter;
    }
  };
}

/**
 * RxJS operator that resolves preset references in a filter stream using the provided mapping function.
 *
 * @param fn - function that expands a preset into concrete filter values
 * @returns operator that maps filter emissions, resolving any preset references
 */
export function mapFilterWithPreset<F extends FilterWithPreset>(fn: MapFilterWithPresetFn<F>): OperatorFunction<F, FilterWithoutPresetString<F>> {
  return map(makeMapFilterWithPresetFn(fn));
}

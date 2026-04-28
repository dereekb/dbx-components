import { type Maybe, flattenObject } from '@dereekb/util';
import { type AnalyticsEventData } from './analytics.event';

/**
 * Configuration for {@link asAnalyticsEventData}.
 */
export interface AsAnalyticsEventDataConfig {
  /**
   * Whether to flatten nested objects into dot-separated keys before filtering.
   *
   * When true, nested plain objects are recursively flattened so their primitive values
   * are preserved with concatenated key paths (e.g., `{ user: { age: 25 } }` becomes `{ 'user.age': 25 }`).
   *
   * @defaultValue true
   */
  readonly flattenObjects?: boolean;
  /**
   * Separator for flattened key paths.
   *
   * Only applicable when {@link flattenObjects} is true.
   *
   * @defaultValue '.'
   */
  readonly separator?: string;
  /**
   * Maximum nesting depth to flatten.
   *
   * Only applicable when {@link flattenObjects} is true.
   *
   * @defaultValue Infinity (unlimited)
   */
  readonly maxDepth?: number;
}

/**
 * Converts an arbitrary object into valid {@link AnalyticsEventData} by flattening nested objects
 * and filtering out values that are not compatible with analytics providers.
 *
 * Processing steps:
 * 1. Flattens nested plain objects into dot-separated key paths (configurable, enabled by default)
 * 2. Filters out any values that are not `string`, `number`, or `boolean`
 * 3. Filters out non-finite numbers (`NaN`, `Infinity`, `-Infinity`)
 *
 * @example
 * ```ts
 * asAnalyticsEventData({ action: 'click', user: { age: 25, name: 'Jo' }, tags: [1, 2] });
 * // { action: 'click', 'user.age': 25, 'user.name': 'Jo' }
 *
 * asAnalyticsEventData({ a: 'ok', b: { nested: 1 } }, { flattenObjects: false });
 * // { a: 'ok' }
 * ```
 *
 * @param input - The object to convert. If nullish, returns an empty object.
 * @param config - Optional configuration for flattening behavior.
 * @returns A new {@link AnalyticsEventData} object containing only valid analytics values.
 */
export function asAnalyticsEventData(input: Maybe<Record<string, unknown>>, config?: AsAnalyticsEventDataConfig): AnalyticsEventData {
  const result: Record<string, string | number | boolean> = {};

  if (input != null) {
    const flattenObjects = config?.flattenObjects !== false;
    const flattened = flattenObjects ? flattenObject(input, { separator: config?.separator, maxDepth: config?.maxDepth }) : input;

    for (const key of Object.keys(flattened)) {
      const value = flattened[key];
      const type = typeof value;

      if (type === 'string' || type === 'boolean') {
        result[key] = value as string | boolean;
      } else if (type === 'number' && Number.isFinite(value as number)) {
        result[key] = value as number;
      }
    }
  }

  return result;
}

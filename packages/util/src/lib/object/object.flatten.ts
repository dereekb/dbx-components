import { type Maybe } from '../value/maybe.type';

/**
 * Configuration for {@link flattenObject}.
 */
export interface FlattenObjectConfig {
  /**
   * Separator between key segments.
   *
   * @defaultValue '.'
   */
  readonly separator?: string;
  /**
   * Maximum nesting depth to flatten. A depth of 1 means only the first level of nested objects is flattened.
   *
   * @defaultValue Infinity (unlimited)
   */
  readonly maxDepth?: number;
}

/**
 * Flattens a nested object into a single-level object with concatenated keys.
 *
 * Recursively traverses plain objects and joins nested keys with a separator (default `'.'`).
 * Non-plain-object values (arrays, Dates, null, functions, etc.) are treated as leaf values and kept as-is.
 * Empty nested objects are omitted from the result (they produce no keys).
 * Circular references are detected and treated as leaf values to avoid infinite recursion.
 *
 * @example
 * ```ts
 * flattenObject({ a: 1, b: { c: 2, d: { e: 3 } } });
 * // { a: 1, 'b.c': 2, 'b.d.e': 3 }
 *
 * flattenObject({ a: { b: 1 } }, { separator: '_' });
 * // { a_b: 1 }
 *
 * flattenObject({ a: { b: { c: 1 } } }, { maxDepth: 1 });
 * // { 'a.b': { c: 1 } }
 * ```
 *
 * @param input - The object to flatten. If nullish, returns an empty object.
 * @param config - Optional configuration for separator and max depth.
 * @returns A new flat object with concatenated key paths.
 */
export function flattenObject(input: Maybe<Record<string, unknown>>, config?: FlattenObjectConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input != null) {
    const separator = config?.separator ?? '.';
    const maxDepth = config?.maxDepth ?? Infinity;
    const seen = new Set<Record<string, unknown>>();

    const recurse = (obj: Record<string, unknown>, prefix: string, currentDepth: number): void => {
      seen.add(obj);
      const keys = Object.keys(obj);

      for (const key of keys) {
        const value = obj[key];
        const fullKey = prefix ? `${prefix}${separator}${key}` : key;

        if (_isPlainObject(value) && currentDepth < maxDepth && !seen.has(value)) {
          recurse(value, fullKey, currentDepth + 1);
        } else {
          result[fullKey] = value;
        }
      }
    };

    recurse(input, '', 0);
  }

  return result;
}

/**
 * Returns true if the value is a plain object (not an array, Date, RegExp, null, etc.).
 */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
  let result = false;

  if (value != null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    result = proto === Object.prototype || proto === null;
  }

  return result;
}

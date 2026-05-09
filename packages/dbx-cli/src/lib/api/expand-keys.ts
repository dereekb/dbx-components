import type { CliModelField, CliModelManifest, CliModelManifestEntry } from '../manifest/types';

/**
 * Resolves the manifest entry for `modelType`. Lookup tries
 * `modelType` first, then falls back to `identityConst` and `collectionPrefix`
 * so callers can pass any of the three forms a user might type at the CLI.
 *
 * @param modelType - identifier to look up.
 * @param manifest - generated model manifest.
 * @returns the matching entry, or `undefined` when none exists.
 * @__NO_SIDE_EFFECTS__
 */
export function findCliModelManifestEntry(modelType: string, manifest: CliModelManifest): CliModelManifestEntry | undefined {
  let result: CliModelManifestEntry | undefined;
  for (const entry of manifest) {
    if (entry.modelType === modelType || entry.identityConst === modelType || entry.collectionPrefix === modelType) {
      result = entry;
      break;
    }
  }
  return result;
}

/**
 * Rewrites the persisted (short) keys in `data` to the long-name form
 * declared in the model's manifest entry. Recurses into nested object-array
 * and sub-object fields when the manifest captured a nested field map.
 *
 * Returns the input untouched when `modelType` is not in the manifest, when
 * the model has no fields, or when the input is not a plain object/array.
 * Unknown keys, primitives, `Date`, `null`, and `undefined` pass through
 * unchanged.
 *
 * @param modelType - the model identifier (`modelType`, `identityConst`,
 *   or `collectionPrefix`) used to look up the rewrite map.
 * @param data - the value to rewrite (typically a `read`/`query` response
 *   payload).
 * @param manifest - generated model manifest.
 * @returns the rewritten value, or `data` unchanged when no rewrite applies.
 * @__NO_SIDE_EFFECTS__
 */
export function expandModelKeys(modelType: string, data: unknown, manifest: CliModelManifest): unknown {
  const entry = findCliModelManifestEntry(modelType, manifest);
  if (!entry) return data;
  return rewriteWithFields(data, entry.fields);
}

function rewriteWithFields(value: unknown, fields: readonly CliModelField[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteWithFields(item, fields));
  }
  if (!isPlainObject(value)) return value;

  const fieldByName = new Map<string, CliModelField>();
  for (const field of fields) fieldByName.set(field.name, field);

  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    const field = fieldByName.get(key);
    if (!field) {
      out[key] = raw;
      continue;
    }
    const longKey = field.longName.length > 0 ? field.longName : key;
    out[longKey] = rewriteFieldValue(raw, field);
  }
  return out;
}

function rewriteFieldValue(value: unknown, field: CliModelField): unknown {
  const nested = field.nestedFields;
  if (!nested || nested.length === 0) return value;
  if (field.nestedIsArray) {
    if (!Array.isArray(value)) return value;
    return value.map((item) => rewriteWithFields(item, nested));
  }
  if (!isPlainObject(value)) return value;
  return rewriteWithFields(value, nested);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  // Objects from JSON.parse have Object.prototype as their proto. Anything
  // exotic (Map, Set, Buffer, class instances) we leave untouched.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

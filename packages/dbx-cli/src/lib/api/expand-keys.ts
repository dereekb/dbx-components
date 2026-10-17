import { findModelManifestEntry as findCliModelManifestEntry } from '@dereekb/firebase/manifest';
import type { CliModelField, CliModelManifest } from '../manifest/types';

// The manifest lookup is shared with the firebase-server MCP catalog tools; re-exported under its CLI name.
export { findModelManifestEntry as findCliModelManifestEntry } from '@dereekb/firebase/manifest';

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
 * @param modelType - The model identifier (`modelType`, `identityConst`,
 *   or `collectionPrefix`) used to look up the rewrite map.
 * @param data - The value to rewrite (typically a `read`/`query` response
 *   payload).
 * @param manifest - Generated model manifest.
 * @returns The rewritten value, or `data` unchanged when no rewrite applies.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function expandModelKeys(modelType: string, data: unknown, manifest: CliModelManifest): unknown {
  const entry = findCliModelManifestEntry(modelType, manifest);
  return entry ? rewriteWithFields(data, entry.fields) : data;
}

function rewriteWithFields(value: unknown, fields: readonly CliModelField[]): unknown {
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => rewriteWithFields(item, fields));
  } else if (isPlainObject(value)) {
    const fieldByName = new Map<string, CliModelField>();
    for (const field of fields) fieldByName.set(field.name, field);

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const field = fieldByName.get(key);
      if (field) {
        const longKey = field.longName.length > 0 ? field.longName : key;
        out[longKey] = rewriteFieldValue(raw, field);
      } else {
        out[key] = raw;
      }
    }
    result = out;
  } else {
    result = value;
  }
  return result;
}

function rewriteFieldValue(value: unknown, field: CliModelField): unknown {
  const nested = field.nestedFields;
  let result: unknown;
  if (!nested || nested.length === 0) {
    result = value;
  } else if (field.nestedIsArray) {
    result = Array.isArray(value) ? value.map((item) => rewriteWithFields(item, nested)) : value;
  } else if (isPlainObject(value)) {
    result = rewriteWithFields(value, nested);
  } else {
    result = value;
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  let result: boolean;
  if (value === null || typeof value !== 'object') {
    result = false;
  } else if (Array.isArray(value) || value instanceof Date) {
    result = false;
  } else {
    // Objects from JSON.parse have Object.prototype as their proto. Anything
    // exotic (Map, Set, Buffer, class instances) we leave untouched.
    const proto = Object.getPrototypeOf(value);
    result = proto === Object.prototype || proto === null;
  }
  return result;
}

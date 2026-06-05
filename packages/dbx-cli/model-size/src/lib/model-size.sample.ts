import { type ModelExtractionConverter, type ModelExtractionConverterField } from '@dereekb/dbx-cli/manifest-extract';
import { type ModelSizeProfile } from './model-size.profile';
import { inferFieldKind, isOptionalConverterField } from './model-size.kind';

/**
 * Fixed timestamp used for every generated date value, so a run is deterministic.
 * Stored as an ISO string (~24 bytes) by `firestoreDate`, or as an epoch number by
 * `firestoreDateNumber` — the converter decides; the calculator measures the result.
 */
export const MODEL_SIZE_SAMPLE_DATE = new Date('2024-06-01T12:00:00.000Z');

/**
 * Input for {@link generateSampleModel}.
 */
export interface GenerateSampleModelInput {
  /**
   * The target converter's extracted field tree (top-level).
   */
  readonly converter: ModelExtractionConverter;
  /**
   * The normalized sizing profile.
   */
  readonly profile: ModelSizeProfile;
  /**
   * Converter-const registry used to resolve `firestoreObjectArray` /
   * `firestoreSubObject` fields declared via a cross-reference const.
   */
  readonly registry: ReadonlyMap<string, ModelExtractionConverter>;
}

/**
 * Output of {@link generateSampleModel}: the synthesized model plus any
 * non-fatal warnings (unresolved nested converters, unknown factories).
 */
export interface GeneratedSample {
  readonly model: Record<string, unknown>;
  readonly warnings: readonly string[];
}

function joinPath(prefix: string, key: string): string {
  return prefix.length === 0 ? key : `${prefix}.${key}`;
}

/**
 * Builds a string of (at least) `len` characters that is unique for a given
 * `seed`, so array elements stay distinct — `firestoreModelIdArrayField` and
 * other unique-array converters dedupe identical values on write, which would
 * otherwise collapse a generated array to a single element.
 *
 * @param len - Minimum character length of the generated string.
 * @param seed - Optional uniqueness seed; when set, it is embedded so sibling values differ.
 * @returns The generated string.
 */
function fillString(len: number, seed?: number): string {
  let result: string;

  if (seed === undefined) {
    result = 'x'.repeat(len);
  } else {
    const suffix = String(seed);
    result = suffix.length >= len ? suffix : `${'x'.repeat(len - suffix.length)}${suffix}`;
  }

  return result;
}

/**
 * Generates a model-typed sample object for a converter from a sizing profile.
 *
 * Each field is synthesized at its inferred kind and the size resolved for its
 * path (`fields[path]`, then a per-kind default). Object-arrays and sub-objects
 * recurse; array/object-array elements are seeded by index so unique-array
 * converters do not collapse them.
 *
 * @param input - The converter tree, profile, and converter registry.
 * @returns The generated model and accumulated warnings.
 *
 * @example
 * ```ts
 * const { model } = generateSampleModel({ converter, profile, registry });
 * const stored = runtimeConverter.to(model);
 * ```
 */
export function generateSampleModel(input: GenerateSampleModelInput): GeneratedSample {
  const { profile, registry } = input;
  const { fields, defaults, includeOptional } = profile;
  const warnings: string[] = [];

  const numberAt = (path: string, seed?: number): number => (fields[path] ?? defaults.number) + (seed ?? 0);
  const stringLenAt = (path: string): number => fields[path] ?? defaults.string;
  const arrayCountAt = (path: string): number => fields[`${path}[]`] ?? fields[path] ?? defaults.arrayCount;
  const mapCountAt = (path: string): number => fields[`${path}{}`] ?? fields[path] ?? defaults.mapCount;

  const resolveNested = (field: ModelExtractionConverterField, path: string): ModelExtractionConverter | undefined => {
    let result: ModelExtractionConverter | undefined;

    if (field.nestedConverterInline !== undefined) {
      result = field.nestedConverterInline;
    } else if (field.nestedConverterRef !== undefined) {
      result = registry.get(field.nestedConverterRef);

      if (result === undefined) {
        warnings.push(`Field '${path}' references converter '${field.nestedConverterRef}', which could not be resolved (likely cross-file). Generating an empty nested shape.`);
      }
    }

    return result;
  };

  const generateFromConverter = (converter: ModelExtractionConverter, prefix: string, seed?: number): Record<string, unknown> => {
    const out: Record<string, unknown> = {};

    for (const field of converter.fields) {
      if (!includeOptional && isOptionalConverterField(field)) {
        continue;
      }

      out[field.key] = generateField(field, joinPath(prefix, field.key), seed);
    }

    return out;
  };

  function generateField(field: ModelExtractionConverterField, path: string, seed?: number): unknown {
    const kind = inferFieldKind(field);
    let result: unknown;

    switch (kind) {
      case 'string':
        result = fillString(stringLenAt(path), seed);
        break;
      case 'number':
        result = numberAt(path, seed);
        break;
      case 'boolean':
        result = true;
        break;
      case 'date':
        result = MODEL_SIZE_SAMPLE_DATE;
        break;
      case 'enum':
        result = fillString(Math.max(1, fields[path] ?? 1), seed);
        break;
      case 'stringArray': {
        const count = arrayCountAt(path);
        result = Array.from({ length: count }, (_unused, index) => fillString(defaults.string, index));
        break;
      }
      case 'map': {
        result = buildMap(mapCountAt(path), (index) => fillString(defaults.string, index));
        break;
      }
      case 'arrayMap': {
        result = buildMap(mapCountAt(path), (index) => Array.from({ length: defaults.arrayCount }, (_unused, elementIndex) => fillString(defaults.string, index * defaults.arrayCount + elementIndex)));
        break;
      }
      case 'subObject': {
        const nested = resolveNested(field, path);
        result = nested ? generateFromConverter(nested, path, seed) : {};
        break;
      }
      case 'objectArray': {
        const nested = resolveNested(field, path);
        const count = arrayCountAt(path);
        result = nested ? Array.from({ length: count }, (_unused, index) => generateFromConverter(nested, `${path}[]`, index)) : new Array(count).fill({});
        break;
      }
      default:
        warnings.push(`Field '${path}' uses unrecognized converter '${field.converter}'; generated a string fallback (size may be approximate).`);
        result = fillString(stringLenAt(path), seed);
        break;
    }

    return result;
  }

  const model = generateFromConverter(input.converter, '');
  return { model, warnings };
}

function buildMap(count: number, valueFactory: (index: number) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (let i = 0; i < count; i += 1) {
    out[`k${i}`] = valueFactory(i);
  }

  return out;
}

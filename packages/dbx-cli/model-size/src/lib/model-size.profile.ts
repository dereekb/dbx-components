/**
 * Firestore's hard per-document storage limit, in bytes (1 MiB).
 *
 * The calculator compares an estimated document size against this value to
 * report headroom. Firestore rejects writes whose document exceeds it.
 */
export const FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES = 1_048_576;

/**
 * Per-kind default sizes applied to any field the profile does not size
 * explicitly via {@link ModelSizeProfile.fields}.
 */
export interface ModelSizeDefaults {
  /**
   * Default character length for generated string-like values.
   */
  readonly string: number;
  /**
   * Default numeric value used for generated number fields (its magnitude
   * drives the digit count in the stringified document).
   */
  readonly number: number;
  /**
   * Default element count for arrays / object-arrays.
   */
  readonly arrayCount: number;
  /**
   * Default key count for maps.
   */
  readonly mapCount: number;
}

/**
 * Built-in {@link ModelSizeDefaults}. Counts default to 1 so nested structures
 * do not multiply out unless the profile sizes them deliberately.
 */
export const DEFAULT_MODEL_SIZE_DEFAULTS: ModelSizeDefaults = {
  string: 16,
  number: 1_000_000,
  arrayCount: 1,
  mapCount: 1
};

/**
 * A normalized, validated snapshot-size profile.
 *
 * Produced by {@link parseModelSizeProfile} from the raw JSON a user authors.
 * Targets a converter by `source` file (+ optional `export`), describes the
 * sizes of variable fields, and optionally supplies a theoretical `sample`
 * object and a `solveFor` target for the inverse calculation.
 */
export interface ModelSizeProfile {
  /**
   * Path to the `.ts` source file exporting the snapshot converter, resolved
   * relative to the profile file (then the working directory).
   */
  readonly source: string;
  /**
   * Converter export name. When omitted, the single converter in the source
   * file is used (an error is thrown when the file exports more than one).
   */
  readonly export?: string;
  /**
   * Storage limit to compare against. Defaults to
   * {@link FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES}.
   */
  readonly limitBytes: number;
  /**
   * Whether `optionalFirestore*` fields are included when generating the
   * sample (worst-case sizing). Defaults to `true`.
   */
  readonly includeOptional: boolean;
  /**
   * Per-kind default sizes; see {@link ModelSizeDefaults}.
   */
  readonly defaults: ModelSizeDefaults;
  /**
   * Per-path size overrides. A key is a dot path whose segments may carry a
   * `[]` (array) or `{}` (map) marker; the numeric value applies to the leaf:
   * string length, number value, array element count, or map key count.
   *
   * @example
   * ```jsonc
   * { "name": 40, "tags[]": 8, "entries[]": 500, "entries[].note": 120 }
   * ```
   */
  readonly fields: Readonly<Record<string, number>>;
  /**
   * Path of an array / object-array / map field to solve for: the calculator
   * reports the largest element/key count that stays within `limitBytes`.
   */
  readonly solveFor?: string;
  /**
   * A theoretical model object merged over the generated sample (provided
   * values win). May be partial — unspecified fields are auto-filled.
   */
  readonly sample?: Readonly<Record<string, unknown>>;
  /**
   * Path to a JSON file whose contents are used as {@link sample}, resolved
   * the same way as {@link source}.
   */
  readonly sampleFile?: string;
}

/**
 * Thrown when a raw profile fails validation in {@link parseModelSizeProfile}.
 */
export class ModelSizeProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelSizeProfileError';
  }
}

function readPositiveInteger(raw: unknown, label: string, fallback: number): number {
  let result: number;

  if (raw === undefined) {
    result = fallback;
  } else if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    result = raw;
  } else {
    throw new ModelSizeProfileError(`'${label}' must be a non-negative number.`);
  }

  return result;
}

function readDefaults(raw: unknown): ModelSizeDefaults {
  let result: ModelSizeDefaults;

  if (raw === undefined) {
    result = DEFAULT_MODEL_SIZE_DEFAULTS;
  } else if (raw !== null && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    result = {
      string: readPositiveInteger(record['string'], 'defaults.string', DEFAULT_MODEL_SIZE_DEFAULTS.string),
      number: readPositiveInteger(record['number'], 'defaults.number', DEFAULT_MODEL_SIZE_DEFAULTS.number),
      arrayCount: readPositiveInteger(record['arrayCount'], 'defaults.arrayCount', DEFAULT_MODEL_SIZE_DEFAULTS.arrayCount),
      mapCount: readPositiveInteger(record['mapCount'], 'defaults.mapCount', DEFAULT_MODEL_SIZE_DEFAULTS.mapCount)
    };
  } else {
    throw new ModelSizeProfileError(`'defaults' must be an object.`);
  }

  return result;
}

function readFields(raw: unknown): Readonly<Record<string, number>> {
  let result: Record<string, number>;

  if (raw === undefined) {
    result = {};
  } else if (raw !== null && typeof raw === 'object') {
    result = {};

    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new ModelSizeProfileError(`'fields["${key}"]' must be a non-negative number.`);
      }

      result[key] = value;
    }
  } else {
    throw new ModelSizeProfileError(`'fields' must be an object mapping field paths to sizes.`);
  }

  return result;
}

/**
 * Validates and normalizes a raw profile (typically `JSON.parse` output) into a
 * {@link ModelSizeProfile}, filling defaults for omitted values.
 *
 * @param raw - The untrusted parsed profile.
 * @returns The normalized profile.
 * @throws {ModelSizeProfileError} When the shape or a value is invalid.
 *
 * @example
 * ```ts
 * const profile = parseModelSizeProfile(JSON.parse(readFileSync(path, 'utf8')));
 * ```
 */
export function parseModelSizeProfile(raw: unknown): ModelSizeProfile {
  if (raw === null || typeof raw !== 'object') {
    throw new ModelSizeProfileError('Profile must be a JSON object.');
  }

  const record = raw as Record<string, unknown>;
  const source = record['source'];

  if (typeof source !== 'string' || source.length === 0) {
    throw new ModelSizeProfileError(`'source' is required and must be a path to the converter's .ts source file.`);
  }

  const exportName = record['export'];

  if (exportName !== undefined && typeof exportName !== 'string') {
    throw new ModelSizeProfileError(`'export' must be a string when provided.`);
  }

  const solveFor = record['solveFor'];

  if (solveFor !== undefined && typeof solveFor !== 'string') {
    throw new ModelSizeProfileError(`'solveFor' must be a string field path when provided.`);
  }

  const sample = record['sample'];

  if (sample !== undefined && (sample === null || typeof sample !== 'object' || Array.isArray(sample))) {
    throw new ModelSizeProfileError(`'sample' must be an object when provided.`);
  }

  const sampleFile = record['sampleFile'];

  if (sampleFile !== undefined && typeof sampleFile !== 'string') {
    throw new ModelSizeProfileError(`'sampleFile' must be a string path when provided.`);
  }

  const includeOptionalRaw = record['includeOptional'];

  if (includeOptionalRaw !== undefined && typeof includeOptionalRaw !== 'boolean') {
    throw new ModelSizeProfileError(`'includeOptional' must be a boolean when provided.`);
  }

  return {
    source,
    export: exportName,
    limitBytes: readPositiveInteger(record['limitBytes'], 'limitBytes', FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES),
    includeOptional: includeOptionalRaw ?? true,
    defaults: readDefaults(record['defaults']),
    fields: readFields(record['fields']),
    solveFor,
    sample: sample as Readonly<Record<string, unknown>> | undefined,
    sampleFile
  };
}

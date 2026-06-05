/**
 * Minimal structural view of a snapshot converter's `to` (model -> stored data)
 * function. Kept structural so the measurement engine does not depend on
 * `@dereekb/firebase` types — any object exposing a compatible `to` works.
 */
export interface SnapshotToConverter {
  readonly to: (model: object) => object;
}

/**
 * Per-field contribution to the stringified document size.
 */
export interface FieldSizeEntry {
  /**
   * Stored (persisted) field key.
   */
  readonly key: string;
  /**
   * Bytes the field contributes to the stringified document (key + value).
   */
  readonly bytes: number;
  /**
   * Share of the total stringified size, 0–1.
   */
  readonly percent: number;
}

/**
 * Result of measuring a generated sample through a converter.
 */
export interface MeasuredSize {
  /**
   * The stored document produced by `converter.to(model)`.
   */
  readonly stored: Record<string, unknown>;
  /**
   * The stored document stringified (the measured artifact).
   */
  readonly json: string;
  /**
   * UTF-8 byte length of {@link json} — the headline size metric.
   */
  readonly bytes: number;
  /**
   * Secondary, informational estimate using Firestore's documented per-type
   * size rules (ignores the document name/path and index entries). More
   * accurate to the real 1 MB trigger than the stringified length.
   */
  readonly firestoreApproxBytes: number;
  /**
   * Per-top-level-field byte breakdown, largest first.
   */
  readonly breakdown: readonly FieldSizeEntry[];
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

/**
 * Estimates a value's Firestore storage size using the documented per-type
 * rules: string = bytes + 1, number = 8, boolean = 1, null = 1, array = sum of
 * elements, map = 32 + sum of (key bytes + 1 + value size).
 *
 * @param value - A JSON-safe stored value (post `to` conversion).
 * @returns The estimated size in bytes.
 */
export function firestoreValueSize(value: unknown): number {
  let result: number;

  if (value === null || value === undefined) {
    result = 1;
  } else if (typeof value === 'boolean') {
    result = 1;
  } else if (typeof value === 'number') {
    result = 8;
  } else if (typeof value === 'string') {
    result = utf8Bytes(value) + 1;
  } else if (Array.isArray(value)) {
    result = value.reduce<number>((sum, element) => sum + firestoreValueSize(element), 0);
  } else {
    const entries = Object.entries(value as Record<string, unknown>);
    result = entries.reduce<number>((sum, [key, entryValue]) => sum + utf8Bytes(key) + 1 + firestoreValueSize(entryValue), 32);
  }

  return result;
}

/**
 * Round-trips a generated model through a converter and measures the stored
 * document size both ways (stringified byte length + Firestore-formula estimate).
 *
 * @param input - The runtime converter and the generated model.
 * @param input.converter - The converter whose `to` performs the conversion.
 * @param input.model - The generated model to convert and measure.
 * @returns The stored document, its stringification, and size metrics.
 *
 * @example
 * ```ts
 * const measured = measureStoredSize({ converter: guestbookConverter, model });
 * console.log(measured.bytes, '/', FIRESTORE_DOCUMENT_SIZE_LIMIT_BYTES);
 * ```
 */
export function measureStoredSize(input: { readonly converter: SnapshotToConverter; readonly model: object }): MeasuredSize {
  const stored = input.converter.to(input.model) as Record<string, unknown>;
  const json = JSON.stringify(stored);
  const bytes = utf8Bytes(json);
  const firestoreApproxBytes = firestoreValueSize(stored);

  const breakdown: FieldSizeEntry[] = Object.entries(stored)
    .map(([key, value]) => {
      const fieldBytes = utf8Bytes(`${JSON.stringify(key)}:`) + utf8Bytes(JSON.stringify(value) ?? '');
      return { key, bytes: fieldBytes, percent: bytes > 0 ? fieldBytes / bytes : 0 };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return { stored, json, bytes, firestoreApproxBytes, breakdown };
}

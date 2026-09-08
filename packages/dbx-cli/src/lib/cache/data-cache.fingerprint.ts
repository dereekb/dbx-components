import { createHash } from 'node:crypto';
import { isPlainObject, type Maybe } from '@dereekb/util';

/**
 * Number of hex characters of the SHA-256 digest kept as a fingerprint.
 *
 * 16 hex chars is 64 bits of the digest. The namespace being distinguished is "the filters one
 * developer ran against one env for one dataset", so 64 bits is far past the point where a collision
 * is a practical concern, and a short fingerprint keeps a cache path readable.
 */
export const CLI_DATA_CACHE_FINGERPRINT_LENGTH = 16;

/**
 * Normalizes a filter into its canonical comparison form.
 *
 * The point is that two filters a human would call "the same" produce the SAME fingerprint:
 *
 * - `null`, `undefined`, `''`, and empty arrays are DROPPED, so `{}`, `{ agentId: undefined }`, and
 *   `{ tg: [] }` all normalize to `{}`. That is what makes the very common unfiltered export share
 *   one cache entry no matter which flags were left off.
 * - Object keys are sorted, so key order in a literal never matters.
 * - Arrays are sorted, because every filter array in practice names a SET (tags, regions, uids,
 *   requirement keys). A filter whose array order is meaningful must not be normalized through here.
 * - `Date`s become ISO strings, so a `Date` and the string it serializes to agree.
 *
 * @param filter - The filter value to normalize.
 * @returns The canonical form, or `undefined` when the value drops out entirely.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function normalizeCliCacheFilter(filter: unknown): unknown {
  let result: unknown;

  if (filter === null || filter === undefined || filter === '') {
    result = undefined;
  } else if (filter instanceof Date) {
    const time = filter.getTime();
    result = Number.isNaN(time) ? undefined : filter.toISOString();
  } else if (Array.isArray(filter)) {
    const members = filter.map(normalizeCliCacheFilter).filter((member) => member !== undefined);
    // sorted on the canonical rendering rather than the raw value so mixed-type arrays still order
    // deterministically instead of relying on JS's default string coercion
    const sorted = members.map((member) => [canonicalCliCacheJson(member), member] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    result = sorted.length === 0 ? undefined : sorted.map(([, member]) => member);
  } else if (isPlainObject(filter)) {
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(filter).sort()) {
      const value = normalizeCliCacheFilter(filter[key]);

      if (value !== undefined) {
        normalized[key] = value;
      }
    }

    result = Object.keys(normalized).length === 0 ? undefined : normalized;
  } else {
    result = filter;
  }

  return result;
}

/**
 * Renders a normalized value as deterministic JSON.
 *
 * Object keys are sorted here as well as in {@link normalizeCliCacheFilter} so the function is
 * order-stable on its own — it is also used to sort array members, which happens before the
 * enclosing object's keys have been walked.
 *
 * @param value - The value to render. Expected to already be normalized.
 * @returns The canonical JSON rendering.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function canonicalCliCacheJson(value: unknown): string {
  let result: string;

  if (value === undefined) {
    result = 'null';
  } else if (Array.isArray(value)) {
    result = `[${value.map(canonicalCliCacheJson).join(',')}]`;
  } else if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalCliCacheJson(value[key])}`);
    result = `{${entries.join(',')}}`;
  } else {
    result = JSON.stringify(value) ?? 'null';
  }

  return result;
}

/**
 * Input for {@link cliCacheFingerprint}.
 */
export interface CliCacheFingerprintInput {
  /**
   * Identifier of the cached pipeline stage, e.g. `worker.lineDetails`.
   */
  readonly dataset: string;
  /**
   * The stage's shape/behavior version. Bumping it invalidates every entry for that dataset in one
   * shot — required whenever the stage's output shape OR the code that builds it changes, because a
   * stage rebuilt by newer code is a wrong-output bug rather than a slow one.
   */
  readonly datasetVersion: number;
  /**
   * The env the data was read from. Never omitted: the same filter against staging and prod are
   * different data.
   */
  readonly env: string;
  /**
   * The inputs the stage's contents depend on. MUST exclude anything applied after the stage —
   * output format, export flavour, destination file, and any row filter the pipeline applies in
   * memory downstream.
   */
  readonly filter?: Maybe<unknown>;
}

/**
 * Builds the fingerprint identifying one build of one dataset.
 *
 * @param input - The fingerprint inputs.
 * @param input.dataset - Identifier of the cached pipeline stage.
 * @param input.datasetVersion - The stage's shape/behavior version.
 * @param input.env - The env the data was read from.
 * @param input.filter - The inputs the stage's contents depend on.
 * @returns The first {@link CLI_DATA_CACHE_FINGERPRINT_LENGTH} hex characters of the SHA-256 digest.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliCacheFingerprint(input: CliCacheFingerprintInput): string {
  const canonical = canonicalCliCacheJson({
    dataset: input.dataset,
    datasetVersion: input.datasetVersion,
    env: input.env,
    filter: normalizeCliCacheFilter(input.filter) ?? {}
  });

  return createHash('sha256').update(canonical).digest('hex').slice(0, CLI_DATA_CACHE_FINGERPRINT_LENGTH);
}

/**
 * Builds the index key one cache entry is stored under.
 *
 * @param input - The key parts.
 * @param input.env - The env the data was read from.
 * @param input.dataset - Identifier of the cached pipeline stage.
 * @param input.fingerprint - The fingerprint from {@link cliCacheFingerprint}.
 * @returns The `<env>/<dataset>/<fingerprint>` index key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliDataCacheKey(input: { readonly env: string; readonly dataset: string; readonly fingerprint: string }): string {
  return `${input.env}/${input.dataset}/${input.fingerprint}`;
}

/**
 * Sanitizes one path segment of a cache file path.
 *
 * A dataset id is developer-authored (`worker.lineDetails`, `firestore-query:workers-query`), so it
 * can carry characters — a `:` most notably — that are illegal in a filename on some platforms.
 * Mirrors what the lint cache does to a project name.
 *
 * @param segment - The raw segment.
 * @returns The segment with every character outside `[A-Za-z0-9._-]` replaced by `_`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliDataCachePathSegment(segment: string): string {
  return segment.replaceAll(/[^A-Za-z0-9._-]/g, '_');
}

import { isPlainObject } from '@dereekb/util';
import { CliError } from '../util/output';

/**
 * Error code thrown when a value handed to {@link toCliCacheJson} contains a reference cycle.
 */
export const CLI_DATA_CACHE_CYCLE_ERROR_CODE = 'CLI_DATA_CACHE_CYCLE';

/**
 * Error code thrown when a value handed to {@link toCliCacheJson} holds something that cannot be
 * persisted and re-read at all — a function or a symbol.
 */
export const CLI_DATA_CACHE_UNSUPPORTED_VALUE_ERROR_CODE = 'CLI_DATA_CACHE_UNSUPPORTED_VALUE';

/**
 * Tag key marking an encoded `Date`. The value is the ISO string, or `null` for an Invalid Date.
 */
const DATE_TAG = '$d';

/**
 * Tag key marking an encoded `Map`. The value is an array of encoded `[key, value]` pairs.
 */
const MAP_TAG = '$m';

/**
 * Tag key marking an encoded `Set`. The value is an array of encoded members.
 */
const SET_TAG = '$s';

/**
 * Tag key marking an encoded `undefined`.
 *
 * `JSON.stringify` DROPS a property whose value is `undefined`, which would make an explicitly-unset
 * field indistinguishable from an absent one after a round trip.
 */
const UNDEFINED_TAG = '$u';

/**
 * Tag key marking a non-finite number (`NaN`, `Infinity`, `-Infinity`), which `JSON.stringify`
 * silently rewrites to `null`.
 */
const NUMBER_TAG = '$n';

/**
 * Tag key marking a `bigint`, which `JSON.stringify` throws on.
 */
const BIGINT_TAG = '$b';

/**
 * Tag key wrapping a plain object that itself looks like one of the tag shapes above, so decoding
 * cannot mistake real data for a tag. See {@link toCliCacheJson}.
 */
const ESCAPE_TAG = '$e';

const TAG_KEYS: ReadonlySet<string> = new Set([DATE_TAG, MAP_TAG, SET_TAG, UNDEFINED_TAG, NUMBER_TAG, BIGINT_TAG, ESCAPE_TAG]);

/**
 * Whether a decoded object is one of this codec's tag envelopes rather than user data.
 *
 * A tag is recognized ONLY as a single-key object whose key is a known tag, which is what makes the
 * {@link ESCAPE_TAG} wrapper sufficient: any user object that could be confused for a tag is exactly
 * a single-key object with a tag key, and those are always wrapped on the way out.
 *
 * @param value - The plain object to test.
 * @returns The tag key when `value` is a tag envelope, otherwise `undefined`.
 *
 * @__NO_SIDE_EFFECTS__
 */
function tagKeyOf(value: Record<string, unknown>): string | undefined {
  const keys = Object.keys(value);
  return keys.length === 1 && TAG_KEYS.has(keys[0] as string) ? keys[0] : undefined;
}

/**
 * Converts a value into a JSON-safe tree, tagging the types a plain `JSON.stringify` round trip
 * would lose.
 *
 * This is a PRE-WALK rather than a `JSON.stringify` replacer, and that is load-bearing:
 * `Date.prototype.toJSON` runs BEFORE a replacer sees the value, so a replacer is handed an ISO
 * string and cannot tell a `Date` from a string that merely looks like one. Every model in a
 * dbx-components app persists its dates through `firestoreDate` (an ISO string on the wire, a live
 * `Date` in memory), so that distinction is the whole problem.
 *
 * Handled: `Date`, `Map`, `Set`, `undefined`, non-finite numbers, `bigint`, arrays, plain objects,
 * and the JSON primitives. A class instance that is none of the above is FLATTENED to its own
 * enumerable properties — the one lossy case, and the reason a stage whose output holds a class
 * instance must supply its own codec.
 *
 * @param value - The value to encode.
 * @returns A tree containing only values `JSON.stringify` renders losslessly.
 * @throws {CliError} On a reference cycle, or on a function/symbol anywhere in the tree.
 */
export function toCliCacheJson(value: unknown): unknown {
  return encodeValue(value, new Set<object>());
}

/**
 * Encodes one value, tracking the objects on the current path so a cycle is reported rather than
 * recursed into forever.
 *
 * @param value - The value to encode.
 * @param seen - The objects on the path from the root to `value`.
 * @returns The encoded value.
 * @throws {CliError} On a reference cycle, or on a function/symbol.
 */
function encodeValue(value: unknown, seen: Set<object>): unknown {
  let result: unknown;

  if (value === undefined) {
    result = { [UNDEFINED_TAG]: 1 };
  } else if (value === null) {
    result = null;
  } else if (typeof value === 'number') {
    result = Number.isFinite(value) ? value : { [NUMBER_TAG]: String(value) };
  } else if (typeof value === 'string' || typeof value === 'boolean') {
    result = value;
  } else if (typeof value === 'bigint') {
    result = { [BIGINT_TAG]: value.toString() };
  } else if (typeof value === 'function' || typeof value === 'symbol') {
    throw new CliError({
      message: `A cached value contains a ${typeof value}, which cannot be persisted.`,
      code: CLI_DATA_CACHE_UNSUPPORTED_VALUE_ERROR_CODE,
      suggestion: 'Strip the live reference before caching — cache the data the function produces, not the function.'
    });
  } else {
    result = encodeObject(value as object, seen);
  }

  return result;
}

/**
 * Encodes an object-typed value (including arrays, `Date`, `Map`, and `Set`).
 *
 * @param value - The object to encode.
 * @param seen - The objects on the path from the root to `value`.
 * @returns The encoded value.
 * @throws {CliError} On a reference cycle.
 */
function encodeObject(value: object, seen: Set<object>): unknown {
  if (seen.has(value)) {
    throw new CliError({
      message: 'A cached value contains a reference cycle.',
      code: CLI_DATA_CACHE_CYCLE_ERROR_CODE,
      suggestion: 'Cache a projection of the data rather than a graph that points back at itself.'
    });
  }

  seen.add(value);
  let result: unknown;

  if (value instanceof Date) {
    const time = value.getTime();
    // an Invalid Date would make toISOString() throw; it is still a real value a bad stored ISO
    // string can produce, so it round-trips as null rather than exploding the whole cache write
    result = { [DATE_TAG]: Number.isNaN(time) ? null : value.toISOString() };
  } else if (value instanceof Map) {
    result = { [MAP_TAG]: [...value.entries()].map(([key, entryValue]) => [encodeValue(key, seen), encodeValue(entryValue, seen)]) };
  } else if (value instanceof Set) {
    result = { [SET_TAG]: [...value.values()].map((member) => encodeValue(member, seen)) };
  } else if (Array.isArray(value)) {
    result = value.map((member) => encodeValue(member, seen));
  } else {
    const encoded: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value)) {
      encoded[key] = encodeValue(entryValue, seen);
    }

    // a user object shaped exactly like a tag (`{ $d: … }`) is wrapped so decoding cannot read it
    // back as one; this is the only case the escape is needed for
    result = tagKeyOf(encoded) === undefined ? encoded : { [ESCAPE_TAG]: encoded };
  }

  seen.delete(value);
  return result;
}

/**
 * Rebuilds a value encoded by {@link toCliCacheJson}, restoring the tagged types.
 *
 * @param raw - The JSON-parsed tree written by {@link toCliCacheJson}.
 * @returns The decoded value.
 */
export function fromCliCacheJson(raw: unknown): unknown {
  let result: unknown;

  if (Array.isArray(raw)) {
    result = raw.map(fromCliCacheJson);
  } else if (isPlainObject(raw)) {
    result = decodeObject(raw);
  } else {
    result = raw;
  }

  return result;
}

/**
 * Decodes a plain object, resolving a tag envelope back into the type it stands for.
 *
 * @param raw - The plain object to decode.
 * @returns The decoded value.
 */
function decodeObject(raw: Record<string, unknown>): unknown {
  const tag = tagKeyOf(raw);
  let result: unknown;

  switch (tag) {
    case DATE_TAG: {
      const iso = raw[DATE_TAG];
      result = iso == null ? new Date(Number.NaN) : new Date(String(iso));
      break;
    }
    case MAP_TAG: {
      const entries = (raw[MAP_TAG] as unknown[]) ?? [];
      result = new Map(entries.map((entry) => [fromCliCacheJson((entry as unknown[])[0]), fromCliCacheJson((entry as unknown[])[1])]));
      break;
    }
    case SET_TAG: {
      const members = (raw[SET_TAG] as unknown[]) ?? [];
      result = new Set(members.map(fromCliCacheJson));
      break;
    }
    case UNDEFINED_TAG:
      result = undefined;
      break;
    case NUMBER_TAG:
      result = Number(raw[NUMBER_TAG]);
      break;
    case BIGINT_TAG:
      result = BigInt(String(raw[BIGINT_TAG]));
      break;
    case ESCAPE_TAG:
      result = decodePlainEntries(raw[ESCAPE_TAG] as Record<string, unknown>);
      break;
    default:
      result = decodePlainEntries(raw);
      break;
  }

  return result;
}

/**
 * Decodes every entry of a plain object, preserving keys whose decoded value is `undefined`.
 *
 * Assigning the key explicitly (rather than skipping it) is what makes an encoded
 * {@link UNDEFINED_TAG} survive as a PRESENT key holding `undefined`, matching what the value looked
 * like before it was cached.
 *
 * @param raw - The plain object whose entries to decode.
 * @returns The decoded object.
 */
function decodePlainEntries(raw: Record<string, unknown>): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    decoded[key] = fromCliCacheJson(value);
  }

  return decoded;
}

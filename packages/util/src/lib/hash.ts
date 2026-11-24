import { filterMaybeArrayValues } from './array';
import { type HexString } from './number/encoded';

/**
 * Represents a salt value used in hashing.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-util:hash
 */
export type HashSalt = string;

/**
 * A Map used for decoding hashed string values.
 *
 * @template H The type of the hashed string (key).
 * @template V The type of the original string (value).
 */
export type HashDecodeMap<H extends string = string, V extends string = string> = Map<H, V>;

/**
 * Decodes a list of hashed string values using a provided list of potential original values and a hash function.
 *
 * @param hashedValues - Hashed inputs awaiting reverse lookup.
 * @param decodeValues - Plaintext candidates that may match one of the hashes.
 * @param hashFn - Deterministic hashing used to align the candidate set with the input hashes.
 * @returns Plaintext recovered from `decodeValues`, dropping any hash that lacks a match.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, decode, lookup, reverse, salt
 * @dbxUtilRelated make-hash-decode-map, decode-hashed-values-with-decode-map
 *
 * @example
 * ```ts
 * const hashed = [hashFn('apple'), hashFn('banana')];
 * decodeHashedValues(hashed, ['apple', 'banana', 'cherry'], hashFn);
 * // ['apple', 'banana']
 * ```
 */
export function decodeHashedValues(hashedValues: string[], decodeValues: string[], hashFn: (value: string) => string) {
  const hashDecodeMap = makeHashDecodeMap(decodeValues, hashFn);
  return decodeHashedValuesWithDecodeMap(hashedValues, hashDecodeMap);
}

/**
 * Creates a `HashDecodeMap` from a list of potential original string values and a hash function.
 * The map's keys are the hashed versions of the `decodeValues`, and the values are the original `decodeValues`.
 *
 * @param decodeValues - Plaintext candidates whose hashes the map should index.
 * @param hashFn - Deterministic hashing used to compute each key.
 * @returns Hash-to-plaintext lookup ready for reverse decoding.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, decode, map, lookup, reverse, factory
 * @dbxUtilRelated decode-hashed-values, decode-hashed-values-with-decode-map
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeHashDecodeMap(decodeValues: string[], hashFn: (value: string) => string): HashDecodeMap {
  const keyValuePairs = decodeValues.map((x) => [hashFn(x), x] as [string, string]);
  const map: HashDecodeMap = new Map(keyValuePairs);
  return map;
}

/**
 * Decodes a list of hashed string values using a pre-built `HashDecodeMap`.
 *
 * @param hashedValues - Hashed inputs awaiting reverse lookup.
 * @param decodeMap - Pre-built hash-to-plaintext lookup.
 * @returns Plaintext recovered via `decodeMap`, dropping any hash missing from it.
 */
export function decodeHashedValuesWithDecodeMap(hashedValues: string[], decodeMap: HashDecodeMap): string[] {
  const values = hashedValues.map((x) => decodeMap.get(x));
  return filterMaybeArrayValues(values);
}

/**
 * FNV-1a 32-bit offset basis.
 */
const FNV_1A_OFFSET_BASIS = 0x811c9dc5;

/**
 * FNV-1a 32-bit prime.
 */
const FNV_1A_PRIME = 0x01000193;

/**
 * Computes a stable, non-negative 32-bit integer hash for the input string using the FNV-1a algorithm.
 *
 * Deterministic and dependency-free (no `Math.random`): the same input always yields the same value,
 * making it suitable for deterministically mapping a string onto a fixed-size set (e.g. picking a
 * curated color for a name via `hashStringToNumber(value) % colors.length`).
 *
 * @param value - String to hash.
 * @returns A non-negative integer in the range `[0, 2^32)`.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, string, number, deterministic, fnv, bucket, index
 * @dbxUtilRelated decode-hashed-values
 *
 * @example
 * ```ts
 * hashStringToNumber('Michelle B'); // stable integer, same every call
 * hashStringToNumber('Michelle B') % 12; // deterministic bucket index 0-11
 * ```
 */
export function hashStringToNumber(value: string): number {
  let hash = FNV_1A_OFFSET_BASIS;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_1A_PRIME);
  }

  return hash >>> 0;
}

/**
 * The 64 SHA-256 round constants (FIPS 180-4 §4.2.2).
 */
const SHA256_ROUND_CONSTANTS = /* @__PURE__ */ new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/**
 * The SHA-256 initial hash value (FIPS 180-4 §5.3.3).
 */
const SHA256_INITIAL_HASH = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

/**
 * Bytes per SHA-256 message block.
 */
const SHA256_BLOCK_BYTES = 64;

/**
 * The mutable working state shared by every block of one digest.
 */
interface Sha256Work {
  /**
   * The eight running hash words H0..H7. A `Uint32Array`, so additions wrap modulo 2^32 on assignment.
   */
  readonly state: Uint32Array;
  /**
   * The reused 64-word message schedule W0..W63.
   */
  readonly schedule: Uint32Array;
  /**
   * Big-endian view over the padded message.
   */
  readonly view: DataView;
}

/**
 * SHA-256 of a string's UTF-8 bytes as 64 lowercase hex characters — synchronous and dependency-free, so it runs
 * unchanged in browsers, workers and Node.
 *
 * Byte-identical to node:crypto `createHash('sha256').update(text, 'utf8').digest('hex')` for EVERY JS string: the
 * text is encoded with `TextEncoder` (the WHATWG UTF-8 rules Node also applies), so a lone surrogate encodes as U+FFFD
 * (`EF BF BD`) instead of throwing. Use {@link sha256HexPrefix} for a short digest.
 *
 * @param text - The text to hash.
 * @returns The lowercase hex digest.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, sha256, digest, hex, sync, crypto, fingerprint
 * @dbxUtilRelated sha256-hex-prefix, hash-string-to-number
 *
 * @example
 * ```ts
 * sha256Hex('abc'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 * ```
 */
export function sha256Hex(text: string): HexString {
  const padded = padSha256Message(new TextEncoder().encode(text));
  const work: Sha256Work = {
    state: new Uint32Array(SHA256_INITIAL_HASH),
    schedule: new Uint32Array(64),
    view: new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  };

  for (let offset = 0; offset < padded.length; offset += SHA256_BLOCK_BYTES) {
    compressSha256Block(work, offset);
  }

  return Array.from(work.state, (word) => word.toString(16).padStart(8, '0')).join('');
}

/**
 * The first `length` characters of {@link sha256Hex} — a short, stable fingerprint of a string's UTF-8 bytes.
 *
 * @param text - The text to hash.
 * @param length - How many leading hex characters to keep (at most 64).
 * @returns The lowercase hex digest prefix.
 *
 * @dbxUtil
 * @dbxUtilCategory hash
 * @dbxUtilTags hash, sha256, digest, hex, prefix, short, fingerprint
 * @dbxUtilRelated sha256-hex
 *
 * @example
 * ```ts
 * sha256HexPrefix('abc', 8); // 'ba7816bf'
 * ```
 */
export function sha256HexPrefix(text: string, length: number): HexString {
  return sha256Hex(text).slice(0, length);
}

/**
 * Pads a message per FIPS 180-4 §5.1.1: a `0x80` byte, zeros, then the 64-bit big-endian bit length, to a multiple of
 * 64 bytes.
 *
 * @param bytes - The message bytes.
 * @returns A new padded buffer.
 */
function padSha256Message(bytes: Uint8Array): Uint8Array {
  const byteLength = bytes.length;
  const paddedLength = Math.ceil((byteLength + 9) / SHA256_BLOCK_BYTES) * SHA256_BLOCK_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[byteLength] = 0x80;

  // The bit length is byteLength * 8; split into two 32-bit words. Exact: JS strings stay far below 2^53 / 8 bytes.
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(byteLength / 0x20000000));
  view.setUint32(paddedLength - 4, (byteLength * 8) >>> 0);

  return padded;
}

/**
 * Rotates a 32-bit word right.
 *
 * @param x - The word.
 * @param n - The rotation, 1..31.
 * @returns The rotated word (as a signed 32-bit number; callers wrap with `>>> 0` or a `Uint32Array` store).
 */
function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Fills the message schedule for the block at `offset` (FIPS 180-4 §6.2.2 step 1).
 *
 * @param work - The digest working state.
 * @param offset - Byte offset of the block in the padded message.
 */
function fillSha256Schedule(work: Sha256Work, offset: number): void {
  const { schedule, view } = work;

  for (let t = 0; t < 16; t += 1) {
    schedule[t] = view.getUint32(offset + t * 4);
  }

  for (let t = 16; t < 64; t += 1) {
    const w15 = schedule[t - 15];
    const w2 = schedule[t - 2];
    const sigma0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
    const sigma1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
    schedule[t] = schedule[t - 16] + sigma0 + schedule[t - 7] + sigma1;
  }
}

/**
 * Compresses one 64-byte block into the running state (FIPS 180-4 §6.2.2).
 *
 * @param work - The digest working state.
 * @param offset - Byte offset of the block in the padded message.
 */
function compressSha256Block(work: Sha256Work, offset: number): void {
  fillSha256Schedule(work, offset);

  const { state, schedule } = work;
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];

  for (let t = 0; t < 64; t += 1) {
    const bigSigma1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const choose = (e & f) ^ (~e & g);
    const temp1 = (h + bigSigma1 + choose + SHA256_ROUND_CONSTANTS[t] + schedule[t]) >>> 0;
    const bigSigma0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (bigSigma0 + majority) >>> 0;

    h = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }

  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

function nodeSha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Deterministic 32-bit PRNG (mulberry32), so the random parity cases are stable across runs.
 *
 * @param seed - The fixed seed.
 * @returns A function returning the next value in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('sha256Hex()', () => {
  describe('FIPS 180-2 vectors', () => {
    const vectors: [string, string, string][] = [
      ['empty string', '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      ['abc', 'abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
      ['two-block 56-byte message', 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
      ['one million a', 'a'.repeat(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
    ];

    it.each(vectors)('should hash the %s vector', (_label, text, expected) => {
      const digest = sha256Hex(text);
      expect(digest).toBe(expected);
      expect(digest).toBe(nodeSha256Hex(text));
    });
  });

  describe('digests the node:crypto helpers produce today', () => {
    it('should match a 16-character prompt-cache digest', () => {
      expect(sha256Hex('the bytes').slice(0, 16)).toBe('ed589341c9fd5da9');
    });

    it('should match a 12-character tape key', () => {
      expect(sha256Hex('PROMPT ONE').slice(0, 12)).toBe('5f6b03b4d2e8');
    });
  });

  describe('node:crypto parity', () => {
    const paddingEdges: [string, string][] = [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128].map((n) => [`${n} ASCII bytes`, 'a'.repeat(n)]);

    const cases: [string, string][] = [
      ...paddingEdges,
      ['2-byte character ending at 56 bytes', 'a'.repeat(54) + 'é'],
      ['3-byte character ending at 56 bytes', 'a'.repeat(53) + '€'],
      ['4-byte character ending at 56 bytes', 'a'.repeat(52) + '😀'],
      ['2-byte character ending at 64 bytes', 'a'.repeat(62) + 'é'],
      ['28 two-byte characters', 'é'.repeat(28)],
      ['lone high surrogate', '\uD800'],
      ['lone low surrogate', '\uDC00'],
      ['lone high surrogate between ASCII', 'a\uD800b'],
      ['reversed surrogate pair', '\uDC00\uD800'],
      ['high surrogate at the end', 'x\uD83D'],
      ['low surrogate at the start', '\uDE00x'],
      ['valid surrogate pair', '😀'],
      ['NUL', '\u0000'],
      ['NUL between ASCII', 'a\u0000b'],
      ['64 NUL bytes', '\u0000'.repeat(64)],
      ['encoder boundaries', '\u007F\u0080߿ࠀ￿\u{10000}\u{10FFFF}'],
      ['accented text', 'héllo wörld'],
      ['CJK text', '日本語のテキスト'],
      ['emoji with modifiers and joiners', '👍🏽 👨‍👩‍👧‍👦']
    ];

    it.each(cases)('should match node:crypto for %s', (_label, text) => {
      expect(sha256Hex(text)).toBe(nodeSha256Hex(text));
    });

    it('should encode a lone surrogate as U+FFFD', () => {
      expect(sha256Hex('\uD800')).toBe(sha256Hex('�'));
    });

    it('should match node:crypto for 500 seeded random UTF-16 strings', () => {
      const random = mulberry32(0x5eed);
      const mismatches: string[] = [];

      for (let i = 0; i < 500; i += 1) {
        const length = Math.floor(random() * 201);
        const codeUnits = Array.from({ length }, () => Math.floor(random() * 0x10000));
        const text = String.fromCodePoint(...codeUnits);

        if (sha256Hex(text) !== nodeSha256Hex(text)) {
          mismatches.push(JSON.stringify(text));
        }
      }

      expect(mismatches).toEqual([]);
    });
  });

  it('should always return 64 lowercase hex characters', () => {
    for (const text of ['', 'abc', '\uD800', 'a'.repeat(1000)]) {
      expect(sha256Hex(text)).toMatch(SHA256_HEX_REGEX);
    }
  });
});

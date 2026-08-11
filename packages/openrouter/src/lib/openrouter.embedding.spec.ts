import { describe, expect, it } from 'vitest';
import { openRouterDecodeBase64, openRouterEmbeddingVector } from './openrouter.embedding';

function base64OfFloat32Array(values: number[]): string {
  const buffer = new ArrayBuffer(values.length * 4);
  const view = new DataView(buffer);
  values.forEach((value, i) => view.setFloat32(i * 4, value, true));

  const bytes = new Uint8Array(buffer);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += alphabet[(chunk >> 18) & 63] + alphabet[(chunk >> 12) & 63] + alphabet[(chunk >> 6) & 63] + alphabet[chunk & 63];
  }

  return out;
}

describe('openRouterDecodeBase64()', () => {
  it('should decode ascii bytes', () => {
    expect(Array.from(openRouterDecodeBase64('QUJD'))).toEqual([65, 66, 67]);
  });

  it('should tolerate padding and whitespace', () => {
    expect(Array.from(openRouterDecodeBase64('QQ=='))).toEqual([65]);
  });
});

describe('openRouterEmbeddingVector()', () => {
  it('should pass a number array through', () => {
    expect(openRouterEmbeddingVector([0.5, -1])).toEqual([0.5, -1]);
  });

  it('should decode a base64 little-endian float32 vector', () => {
    const values = [1, 0.5, -2, 0];
    const decoded = openRouterEmbeddingVector(base64OfFloat32Array(values));
    expect(decoded.length).toBe(4);
    decoded.forEach((value, i) => expect(value).toBeCloseTo(values[i], 5));
  });
});

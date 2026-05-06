import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonFileAsyncKeyedValueCache, createJsonFileAsyncValueCache, createMemoizedJsonFileAsyncKeyedValueCache, createMemoizedJsonFileAsyncValueCache } from './cache.file';

describe('createJsonFileAsyncValueCache', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nestjs-file-cache-'));
    filePath = join(dir, 'value.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns undefined when file does not exist', async () => {
    const cache = createJsonFileAsyncValueCache<{ access: string }>({ filePath });
    expect(await cache.load()).toBeUndefined();
  });

  it('roundtrips a value across separate factories pointing at the same file', async () => {
    const writer = createJsonFileAsyncValueCache<{ access: string }>({ filePath });
    await writer.update({ access: 'a' });

    const reader = createJsonFileAsyncValueCache<{ access: string }>({ filePath });
    expect(await reader.load()).toEqual({ access: 'a' });
  });

  it('writes the file with mode 0o600 by default', async () => {
    const cache = createJsonFileAsyncValueCache<{ access: string }>({ filePath });
    await cache.update({ access: 'a' });

    const stats = statSync(filePath);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('respects an explicit mode override', async () => {
    const cache = createJsonFileAsyncValueCache<{ access: string }>({ filePath, mode: 0o644 });
    await cache.update({ access: 'a' });

    const stats = statSync(filePath);
    expect(stats.mode & 0o777).toBe(0o644);
  });

  it('clear() deletes the file', async () => {
    const cache = createJsonFileAsyncValueCache<{ access: string }>({ filePath });
    await cache.update({ access: 'a' });
    await cache.clear();

    expect(() => statSync(filePath)).toThrow();
    expect(await cache.load()).toBeUndefined();
  });

  it('reviver runs on load and replacer runs on update', async () => {
    interface Token {
      readonly value: string;
      readonly expiresAt: Date;
    }
    const cache = createJsonFileAsyncValueCache<Token>({
      filePath,
      reviver: (raw) => {
        const v = raw as { value: string; expiresAt: string };
        return { value: v.value, expiresAt: new Date(v.expiresAt) };
      }
    });

    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    await cache.update({ value: 'token', expiresAt });

    const loaded = await cache.load();
    expect(loaded?.expiresAt).toBeInstanceOf(Date);
    expect(loaded?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });
});

describe('createMemoizedJsonFileAsyncValueCache', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nestjs-file-cache-'));
    filePath = join(dir, 'value.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves loads from memory after the first read', async () => {
    const cache = createMemoizedJsonFileAsyncValueCache<{ access: string }>({ filePath });
    await cache.update({ access: 'a' });

    rmSync(filePath);
    expect(await cache.load()).toEqual({ access: 'a' });
  });
});

describe('createJsonFileAsyncKeyedValueCache', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nestjs-file-cache-'));
    filePath = join(dir, 'keyed.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty record when file does not exist', async () => {
    const cache = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    expect(await cache.load()).toEqual({});
  });

  it('roundtrips keyed entries across separate factories', async () => {
    const writer = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    await writer.set('a', 1);
    await writer.set('b', 2);

    const reader = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    expect(await reader.get('a')).toBe(1);
    expect(await reader.get('b')).toBe(2);
    expect(await reader.load()).toEqual({ a: 1, b: 2 });
  });

  it('remove() drops only the requested key on disk', async () => {
    const cache = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.remove('a');

    const reader = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    expect(await reader.load()).toEqual({ b: 2 });
  });

  it('clear() deletes the file', async () => {
    const cache = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    await cache.set('a', 1);
    await cache.clear();

    expect(() => statSync(filePath)).toThrow();
  });

  it('writes the file with mode 0o600 by default', async () => {
    const cache = createJsonFileAsyncKeyedValueCache<number>({ filePath });
    await cache.set('a', 1);

    const stats = statSync(filePath);
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

describe('createMemoizedJsonFileAsyncKeyedValueCache', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nestjs-file-cache-'));
    filePath = join(dir, 'keyed.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves reads from memory after the first read', async () => {
    const cache = createMemoizedJsonFileAsyncKeyedValueCache<number>({ filePath });
    await cache.set('a', 1);

    rmSync(filePath);
    expect(await cache.get('a')).toBe(1);
    expect(await cache.load()).toEqual({ a: 1 });
  });
});

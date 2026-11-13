import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError } from '../util/output';
import { cliAvailableBytes, cliSha256HexPrefix, ensureCliPrivateDir, isCliDirEmptyOrMissing, resolveCliDirChildPath, writeCliFileAtomic } from './download.fs';

describe('download.fs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-download-fs-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('ensureCliPrivateDir()', () => {
    it('creates nested directories with mode 0700', async () => {
      const nested = join(dir, 'a', 'b');
      await ensureCliPrivateDir(nested);

      expect(statSync(join(dir, 'a')).mode & 0o777).toBe(0o700);
      expect(statSync(nested).mode & 0o777).toBe(0o700);
    });
  });

  describe('resolveCliDirChildPath()', () => {
    it('joins a relative path inside the directory', () => {
      expect(resolveCliDirChildPath(dir, 'reports/2026/q1.pdf')).toBe(join(dir, 'reports', '2026', 'q1.pdf'));
      expect(resolveCliDirChildPath(dir, 'a/../b.txt')).toBe(join(dir, 'b.txt'));
    });

    it.each(['../x', '/abs', 'a/../../b', '', '.', 'a/..', 'x\0y'])('refuses %j', (relativePath) => {
      expect(() => resolveCliDirChildPath(dir, relativePath)).toThrow(CliError);
    });
  });

  describe('writeCliFileAtomic()', () => {
    it('writes the data with mode 0600 and returns the bytes', async () => {
      const path = join(dir, 'manifest.json');
      const bytes = await writeCliFileAtomic({ path, data: 'héllo' });

      expect(bytes).toBe(6);
      expect(readFileSync(path, 'utf8')).toBe('héllo');
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(readdirSync(dir)).toEqual(['manifest.json']);
    });

    it('replaces an existing file', async () => {
      const path = join(dir, 'f.bin');
      writeFileSync(path, 'old');
      await writeCliFileAtomic({ path, data: new Uint8Array([1, 2]) });

      expect(Array.from(readFileSync(path))).toEqual([1, 2]);
    });

    it('leaves no temporary file when the rename fails', async () => {
      // a non-empty directory cannot be replaced by a file
      const path = join(dir, 'taken');
      mkdirSync(path);
      writeFileSync(join(path, 'inside'), 'x');

      await expect(writeCliFileAtomic({ path, data: 'data' })).rejects.toThrow();
      expect(readdirSync(dir)).toEqual(['taken']);
    });
  });

  describe('cliSha256HexPrefix()', () => {
    it('returns the first 8 hex characters of the sha256 by default', () => {
      // sha256('abc') = ba7816bf8f01cfea…
      expect(cliSha256HexPrefix('abc')).toBe('ba7816bf');
      expect(cliSha256HexPrefix('abc', 16)).toBe('ba7816bf8f01cfea');
    });
  });

  describe('cliAvailableBytes()', () => {
    it('measures the nearest existing ancestor of a missing path', async () => {
      const bytes = await cliAvailableBytes(join(dir, 'missing', 'deeper'));
      expect(typeof bytes).toBe('number');
      expect(bytes).toBeGreaterThan(0);
    });
  });

  describe('isCliDirEmptyOrMissing()', () => {
    it('is true for a missing or empty directory', async () => {
      expect(await isCliDirEmptyOrMissing(join(dir, 'missing'))).toBe(true);
      expect(await isCliDirEmptyOrMissing(dir)).toBe(true);
    });

    it('ignores the allowed names', async () => {
      writeFileSync(join(dir, '.manifest.json'), '{}');
      expect(await isCliDirEmptyOrMissing(dir, ['.manifest.json'])).toBe(true);

      writeFileSync(join(dir, 'other.txt'), 'x');
      expect(await isCliDirEmptyOrMissing(dir, ['.manifest.json'])).toBe(false);
    });

    it('is false for a file', async () => {
      const file = join(dir, 'file.txt');
      writeFileSync(file, 'x');
      expect(await isCliDirEmptyOrMissing(file)).toBe(false);
      expect(existsSync(file)).toBe(true);
    });
  });
});

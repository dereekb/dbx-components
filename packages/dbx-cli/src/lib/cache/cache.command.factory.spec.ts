import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Maybe } from '@dereekb/util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCli } from '../runner/run';
import { type CliDataCache, createCliDataCache } from './data-cache';

describe('cache command', () => {
  let dir: string;
  let cache: CliDataCache;
  let stdout: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-cache-command-'));
    cache = createCliDataCache({ dataCacheDir: dir, cliBuildStamp: '1.0.0' });
    stdout = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout += String(chunk);
      return true;
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdout += args.map(String).join(' ');
    });
    // `wrapCommandHandler` exits the process on a thrown CliError; without this the vitest worker
    // would go down with it
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    logSpy.mockRestore();
    exitSpy.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Drives a full `createCli` parse and returns whatever failed, or `undefined` on success.
   *
   * Going through `createCli` is what makes these tests cover the auth-bypass wiring: a command
   * registered as an API command would run the auth middleware and exit instead.
   *
   * Both failure shapes are collapsed into the return value — a yargs validation error rejects the
   * parse under `.fail(false)`, while a handler error reaches the callback (and a thrown `CliError`
   * arrives as the stubbed `process.exit`).
   */
  async function run(args: readonly string[]): Promise<Maybe<Error>> {
    let captured: Maybe<Error>;

    try {
      await createCli({ cliName: 'demo-cli', dataCache: { cache, cliBuildStamp: '1.0.0' }, argv: [...args] })
        .exitProcess(false)
        .parse([...args], (err: Maybe<Error>) => {
          captured = err;
        });
    } catch (e) {
      captured = e as Error;
    }

    return captured;
  }

  async function rootHelp(input: Parameters<typeof createCli>[0]): Promise<string> {
    let result = '';

    await createCli({ ...input, argv: ['--help'] })
      .exitProcess(false)
      .parse(['--help'], (_err: Error | undefined, _argv: unknown, output: string) => {
        result = output;
      });

    return result;
  }

  describe('registration', () => {
    it('registers the cache command and the cache flags when dataCache is enabled', async () => {
      const help = await rootHelp({ cliName: 'demo-cli', dataCache: true });
      expect(help).toContain('cache');
      expect(help).toContain('--refresh');
    });

    it('registers neither when dataCache is omitted', async () => {
      // a CLI without a cache should REJECT `--cache` under .strict() rather than accept a flag that
      // silently does nothing
      const help = await rootHelp({ cliName: 'demo-cli' });
      expect(help).not.toContain('--refresh');
    });
  });

  describe('cache list', () => {
    it('runs with no token configured, because inspecting a local cache must work offline', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', filter: { tg: ['a'] }, data: [{ id: 'a' }] });

      const error = await run(['cache', 'list']);

      expect(error).toBeFalsy();
      expect(stdout).toContain('worker.source');
      expect(stdout).toContain('DATASET');
    });

    it('reports an empty cache plainly', async () => {
      await run(['cache', 'list']);
      expect(stdout).toContain('No recorded dataset builds.');
    });

    it('narrows by env', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });
      await cache.saveData({ dataset: 'job.invoiceOutput', datasetVersion: 1, env: 'staging', data: [{ id: 'b' }] });

      await run(['cache', 'list', '--env', 'staging']);

      expect(stdout).toContain('job.invoiceOutput');
      expect(stdout).not.toContain('worker.source');
    });

    it('emits the JSON envelope under --json', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });

      await run(['cache', 'list', '--json']);

      const envelope = JSON.parse(stdout);
      expect(envelope.ok).toBe(true);
      expect(envelope.data[0].dataset).toBe('worker.source');
      expect(envelope.data[0].itemCount).toBe(1);
    });
  });

  describe('cache show', () => {
    it('shows an entry without its payload by default', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });

      await run(['cache', 'show', 'worker.source']);

      const envelope = JSON.parse(stdout);
      expect(envelope.data.fingerprint).toBeTruthy();
      expect(envelope.data.data).toBeUndefined();
    });

    it('includes the payload under --data', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });

      await run(['cache', 'show', 'worker.source', '--data']);

      const envelope = JSON.parse(stdout);
      expect(envelope.data.data).toEqual([{ id: 'a' }]);
    });

    it('fails clearly when nothing was recorded for the dataset', async () => {
      const error = await run(['cache', 'show', 'worker.missing']);

      expect(error?.message).toMatch(/process\.exit:1/);
      const envelope = JSON.parse(stdout);
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('CLI_DATA_CACHE_ENTRY_NOT_FOUND');
    });
  });

  describe('cache clear', () => {
    it('refuses an unnarrowed clear without --all', async () => {
      // re-downloading every dataset is the expensive mistake this whole feature exists to avoid
      const error = await run(['cache', 'clear']);
      expect(error?.message).toContain('--all');
      expect(await cache.listEntries()).toHaveLength(0);
    });

    it('clears everything under --all', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });

      await run(['cache', 'clear', '--all']);

      expect(JSON.parse(stdout).data.cleared).toBe(1);
      expect(await cache.listEntries()).toHaveLength(0);
    });

    it('clears only the named dataset', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });
      await cache.saveData({ dataset: 'job.invoiceOutput', datasetVersion: 1, env: 'prod', data: [{ id: 'b' }] });

      await run(['cache', 'clear', '--dataset', 'worker.source']);

      const remaining = await cache.listEntries();
      expect(remaining.map((entry) => entry.dataset)).toEqual(['job.invoiceOutput']);
    });
  });

  describe('cache prune', () => {
    it('demands an age', async () => {
      const error = await run(['cache', 'prune']);
      expect(error?.message).toContain('older-than');
    });

    it('keeps builds younger than the given age', async () => {
      await cache.saveData({ dataset: 'worker.source', datasetVersion: 1, env: 'prod', data: [{ id: 'a' }] });

      await run(['cache', 'prune', '--older-than', '24']);

      expect(JSON.parse(stdout).data.pruned).toBe(0);
      expect(await cache.listEntries()).toHaveLength(1);
    });
  });
});

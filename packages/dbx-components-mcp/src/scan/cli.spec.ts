import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type BuildManifestGlobber } from './build-manifest.js';
import { runScanCli, type ScanCliReadFile, type ScanCliWriteFile } from './cli.js';

const PROJECT_ARG = 'apps/example';
const CWD = '/repo';
const PROJECT_ROOT = resolve(CWD, PROJECT_ARG);
const SCAN_CONFIG_PATH = resolve(PROJECT_ROOT, 'dbx-mcp.scan.json');
const PACKAGE_PATH = resolve(PROJECT_ROOT, 'package.json');

const VALID_SCAN_CONFIG = JSON.stringify({
  version: 1,
  source: '@dereekb/util',
  topicNamespace: 'dereekb-util',
  include: ['src/**/*.ts']
});

const VALID_PACKAGE_JSON = JSON.stringify({ name: '@dereekb/util' });

const SOURCE_PATH = resolve(PROJECT_ROOT, 'src/email.ts');
const SOURCE_TEXT = `
  /**
   * @semanticType
   * @semanticTopic email
   */
  export type EmailAddress = string;
`;

const OUT_PATH = resolve(PROJECT_ROOT, 'semantic-types.mcp.json');

interface Sinks {
  readonly logs: string[];
  readonly errors: string[];
  readonly writes: { path: string; data: string }[];
}

function makeSinks(): Sinks {
  return { logs: [], errors: [], writes: [] };
}

function makeReader(files: Record<string, string>): ScanCliReadFile {
  return async (path) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`fixture: no entry for path ${path}`);
    }
    return content;
  };
}

function makeWriter(sinks: Sinks): ScanCliWriteFile {
  return async (path, data) => {
    sinks.writes.push({ path, data });
  };
}

function makeGlobber(matches: readonly string[]): BuildManifestGlobber {
  return async () => matches;
}

const SOURCE_GLOB_MATCHES = ['src/email.ts'];
const FROZEN_NOW = () => new Date('2026-04-25T00:00:00.000Z');

describe('runScanCli — usage and parsing', () => {
  it('exits 2 when --project is missing', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: [],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({}),
      writeFile: makeWriter(sinks),
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(2);
    expect(sinks.errors.some((e) => e.includes('--project is required'))).toBe(true);
  });

  it('exits 2 with a usage message when an unknown flag is supplied', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--unknown'],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({}),
      writeFile: makeWriter(sinks),
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(2);
    expect(sinks.errors.some((e) => e.includes('Unknown argument'))).toBe(true);
  });

  it('exits 0 when --help is supplied', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--help'],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({}),
      writeFile: makeWriter(sinks),
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(0);
    expect(sinks.logs.some((l) => l.includes('Usage:'))).toBe(true);
  });
});

describe('runScanCli — write mode', () => {
  it('writes the manifest to the resolved out path on success', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--project', PROJECT_ARG],
      cwd: CWD,
      generator: '@dereekb/dbx-components-mcp@test',
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [SOURCE_PATH]: SOURCE_TEXT
      }),
      writeFile: makeWriter(sinks),
      globber: makeGlobber(SOURCE_GLOB_MATCHES),
      now: FROZEN_NOW,
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });

    expect(result.exitCode).toBe(0);
    expect(sinks.writes.length).toBe(1);
    expect(sinks.writes[0].path).toBe(OUT_PATH);
    const parsed = JSON.parse(sinks.writes[0].data);
    expect(parsed.entries.length).toBe(1);
    expect(parsed.entries[0].name).toBe('EmailAddress');
  });

  it('emits an error and exits 1 when the scan config is missing', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--project', PROJECT_ARG],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({ [PACKAGE_PATH]: VALID_PACKAGE_JSON }),
      writeFile: makeWriter(sinks),
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(1);
    expect(sinks.errors.some((e) => e.includes('no scan config'))).toBe(true);
    expect(sinks.writes.length).toBe(0);
  });
});

describe('runScanCli — check mode', () => {
  it('exits 0 when the on-disk manifest matches a fresh scan', async () => {
    const sinks = makeSinks();
    const generated = await runScanCli({
      argv: ['--project', PROJECT_ARG],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [SOURCE_PATH]: SOURCE_TEXT
      }),
      writeFile: makeWriter(sinks),
      globber: makeGlobber(SOURCE_GLOB_MATCHES),
      now: FROZEN_NOW,
      log: () => undefined,
      errorLog: () => undefined
    });
    expect(generated.exitCode).toBe(0);

    // Re-run with the just-written manifest in the readFile fixture as if it were on disk.
    const writtenManifest = sinks.writes[0].data;
    const checkSinks = makeSinks();
    const result = await runScanCli({
      argv: ['--project', PROJECT_ARG, '--check'],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [SOURCE_PATH]: SOURCE_TEXT,
        [OUT_PATH]: writtenManifest
      }),
      writeFile: makeWriter(checkSinks),
      globber: makeGlobber(SOURCE_GLOB_MATCHES),
      now: FROZEN_NOW,
      log: (m) => checkSinks.logs.push(m),
      errorLog: (m) => checkSinks.errors.push(m)
    });

    expect(result.exitCode).toBe(0);
    expect(checkSinks.logs.some((l) => l.includes('Manifest fresh'))).toBe(true);
    expect(checkSinks.writes.length).toBe(0);
  });

  it('exits 1 when the on-disk manifest differs from a fresh scan', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--project', PROJECT_ARG, '--check'],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [SOURCE_PATH]: SOURCE_TEXT,
        [OUT_PATH]: '{"version":1,"source":"@dereekb/util","topicNamespace":"dereekb-util","generatedAt":"2020-01-01T00:00:00.000Z","generator":"old","topics":[],"entries":[]}\n'
      }),
      writeFile: makeWriter(sinks),
      globber: makeGlobber(SOURCE_GLOB_MATCHES),
      now: FROZEN_NOW,
      log: (m) => sinks.logs.push(m),
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(1);
    expect(sinks.errors.some((e) => e.includes('Manifest is stale'))).toBe(true);
    expect(sinks.writes.length).toBe(0);
  });

  it('exits 1 in check mode when the on-disk manifest is absent', async () => {
    const sinks = makeSinks();
    const result = await runScanCli({
      argv: ['--project', PROJECT_ARG, '--check'],
      cwd: CWD,
      generator: 'test',
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [SOURCE_PATH]: SOURCE_TEXT
      }),
      writeFile: makeWriter(sinks),
      globber: makeGlobber(SOURCE_GLOB_MATCHES),
      now: FROZEN_NOW,
      log: () => undefined,
      errorLog: (m) => sinks.errors.push(m)
    });
    expect(result.exitCode).toBe(1);
    expect(sinks.errors.some((e) => e.includes('Manifest is stale'))).toBe(true);
  });
});

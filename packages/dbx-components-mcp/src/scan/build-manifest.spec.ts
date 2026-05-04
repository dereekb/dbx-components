import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildManifest, serializeManifest, type BuildManifestGlobber, type BuildManifestReadFile } from './build-manifest.js';

const PROJECT_ROOT = '/proj';
const SCAN_CONFIG_PATH = resolve(PROJECT_ROOT, 'dbx-mcp.scan.json');
const PACKAGE_PATH = resolve(PROJECT_ROOT, 'package.json');

const VALID_SCAN_CONFIG = JSON.stringify({
  version: 1,
  source: '@dereekb/util',
  topicNamespace: 'dereekb-util',
  include: ['src/**/*.ts'],
  exclude: ['**/*.spec.ts'],
  declaredTopics: ['dereekb-util:duration']
});

const VALID_PACKAGE_JSON = JSON.stringify({ name: '@dereekb/util' });

const FROZEN_NOW = () => new Date('2026-04-25T00:00:00.000Z');

function makeReader(files: Record<string, string>): BuildManifestReadFile {
  return async (path) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`fixture: no entry for path ${path}`);
    }
    return content;
  };
}

function makeGlobber(matches: readonly string[]): BuildManifestGlobber {
  return async () => matches;
}

describe('buildManifest — config and package resolution', () => {
  it('returns no-config when dbx-mcp.scan.json is missing', async () => {
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      readFile: makeReader({ [PACKAGE_PATH]: VALID_PACKAGE_JSON }),
      globber: makeGlobber([]),
      now: FROZEN_NOW
    });
    expect(result.kind).toBe('no-config');
  });

  it('returns invalid-scan-config when the config is malformed JSON', async () => {
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      readFile: makeReader({ [SCAN_CONFIG_PATH]: '{ invalid', [PACKAGE_PATH]: VALID_PACKAGE_JSON }),
      globber: makeGlobber([]),
      now: FROZEN_NOW
    });
    expect(result.kind).toBe('invalid-scan-config');
  });

  it('returns invalid-scan-config when the config fails schema validation', async () => {
    const bad = JSON.stringify({ version: 2, source: '@dereekb/util', topicNamespace: 'x', include: ['src/**/*.ts'] });
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      readFile: makeReader({ [SCAN_CONFIG_PATH]: bad, [PACKAGE_PATH]: VALID_PACKAGE_JSON }),
      globber: makeGlobber([]),
      now: FROZEN_NOW
    });
    expect(result.kind).toBe('invalid-scan-config');
  });

  it('returns no-package when package.json is missing', async () => {
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      readFile: makeReader({ [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG }),
      globber: makeGlobber([]),
      now: FROZEN_NOW
    });
    expect(result.kind).toBe('no-package');
  });

  it('returns invalid-package when the package.json has no name', async () => {
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      readFile: makeReader({ [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG, [PACKAGE_PATH]: '{}' }),
      globber: makeGlobber([]),
      now: FROZEN_NOW
    });
    expect(result.kind).toBe('invalid-package');
  });
});

describe('buildManifest — successful builds', () => {
  it('produces a valid manifest with a single tagged entry', async () => {
    const sourcePath = resolve(PROJECT_ROOT, 'src/value/email.ts');
    const sourceText = `
      /**
       * An email address.
       * @semanticType
       * @semanticTopic email contact
       */
      export type EmailAddress = string;
    `;

    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: '@dereekb/dbx-components-mcp@test',
      now: FROZEN_NOW,
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [sourcePath]: sourceText
      }),
      globber: makeGlobber(['src/value/email.ts'])
    });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') {
      throw new Error('expected success');
    }
    expect(result.scannedFileCount).toBe(1);
    expect(result.outPath).toBe(resolve(PROJECT_ROOT, 'semantic-types.mcp.generated.json'));
    expect(result.manifest.source).toBe('@dereekb/util');
    expect(result.manifest.topicNamespace).toBe('dereekb-util');
    expect(result.manifest.generatedAt).toBe('2026-04-25T00:00:00.000Z');
    expect(result.manifest.generator).toBe('@dereekb/dbx-components-mcp@test');
    expect(result.manifest.topics).toEqual(['dereekb-util:duration']);
    expect(result.manifest.entries.length).toBe(1);

    const [entry] = result.manifest.entries;
    expect(entry.name).toBe('EmailAddress');
    expect(entry.package).toBe('@dereekb/util');
    expect(entry.module).toBe('src/value/email');
    expect(entry.kind).toBe('semantic-type');
    expect(entry.baseType).toBe('string');
    expect(entry.topics).toEqual(['email', 'contact']);
  });

  it('returns a manifest with no entries when no source file is tagged', async () => {
    const sourcePath = resolve(PROJECT_ROOT, 'src/value/email.ts');
    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      now: FROZEN_NOW,
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [sourcePath]: 'export type EmailAddress = string;'
      }),
      globber: makeGlobber(['src/value/email.ts'])
    });

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.manifest.entries.length).toBe(0);
    }
  });

  it('respects a custom `out` path from the scan config', async () => {
    const customConfig = JSON.stringify({
      version: 1,
      source: '@dereekb/util',
      topicNamespace: 'dereekb-util',
      include: ['src/**/*.ts'],
      out: 'dist/manifest.json'
    });

    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      now: FROZEN_NOW,
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: customConfig,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON
      }),
      globber: makeGlobber([])
    });

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.outPath).toBe(resolve(PROJECT_ROOT, 'dist/manifest.json'));
    }
  });

  it('produces deterministic JSON via serializeManifest', async () => {
    const sourcePath = resolve(PROJECT_ROOT, 'src/value/email.ts');
    const sourceText = `
      /**
       * @semanticType
       * @semanticTopic email
       */
      export type EmailAddress = string;
    `;

    const result = await buildManifest({
      projectRoot: PROJECT_ROOT,
      generator: 'test',
      now: FROZEN_NOW,
      readFile: makeReader({
        [SCAN_CONFIG_PATH]: VALID_SCAN_CONFIG,
        [PACKAGE_PATH]: VALID_PACKAGE_JSON,
        [sourcePath]: sourceText
      }),
      globber: makeGlobber(['src/value/email.ts'])
    });

    if (result.kind !== 'success') {
      throw new Error('expected success');
    }
    const a = serializeManifest(result.manifest);
    const b = serializeManifest(result.manifest);
    expect(a).toBe(b);
    expect(a.endsWith('\n')).toBe(true);
    expect(JSON.parse(a)).toEqual(result.manifest);
  });
});

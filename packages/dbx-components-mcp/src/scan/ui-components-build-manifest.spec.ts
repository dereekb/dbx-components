import { describe, expect, it } from 'vitest';
import { buildUiComponentsManifest, serializeUiComponentManifest, type BuildUiManifestGlobber, type BuildUiManifestReadFile } from './ui-components-build-manifest.js';

const FIXED_NOW = () => new Date('2025-01-02T03:04:05Z');

interface FixtureOptions {
  readonly files: Record<string, string>;
}

function fixture(options: FixtureOptions): { readonly readFile: BuildUiManifestReadFile; readonly globber: BuildUiManifestGlobber } {
  const map = new Map(Object.entries(options.files));
  const readFile: BuildUiManifestReadFile = async (path) => {
    const value = map.get(path);
    if (value === undefined) {
      throw new Error(`unknown path ${path}`);
    }
    return value;
  };
  const globber: BuildUiManifestGlobber = async (input) => {
    const prefix = `${input.projectRoot}/`;
    const out: string[] = [];
    for (const path of map.keys()) {
      if (path.startsWith(prefix) && path.endsWith('.ts') && !path.includes('.spec.')) {
        out.push(path.slice(prefix.length));
      }
    }
    return out;
  };
  return { readFile, globber };
}

describe('buildUiComponentsManifest', () => {
  it('builds a manifest from tagged sources and validates it against the schema', async () => {
    const { readFile, globber } = fixture({
      files: {
        '/proj/dbx-mcp.scan.json': JSON.stringify({
          version: 1,
          uiComponents: {
            include: ['src/**/*.ts'],
            exclude: ['**/*.spec.ts'],
            out: 'manifests/dereekb-x.ui-components.mcp.json'
          }
        }),
        '/proj/package.json': JSON.stringify({ name: '@dereekb/x' }),
        '/proj/src/section.ts': `
import { Component, input } from '@angular/core';
/**
 * Content section.
 * @dbxWebComponent
 * @dbxWebSlug section
 * @dbxWebCategory layout
 * @dbxWebRelated subsection
 */
@Component({ selector: 'dbx-section', template: '<ng-content></ng-content>' })
export class DbxSectionComponent {
  /** Header text. */
  readonly header = input<string>('');
}
        `
      }
    });

    const outcome = await buildUiComponentsManifest({
      projectRoot: '/proj',
      generator: 'test-generator',
      now: FIXED_NOW,
      readFile,
      globber
    });

    expect(outcome.kind).toBe('success');
    if (outcome.kind !== 'success') {
      throw new Error('not success');
    }
    expect(outcome.manifest.source).toBe('@dereekb/x');
    expect(outcome.manifest.module).toBe('@dereekb/x');
    expect(outcome.manifest.entries.length).toBe(1);
    expect(outcome.manifest.entries[0].slug).toBe('section');
    expect(outcome.manifest.entries[0].relatedSlugs).toEqual(['subsection']);
    expect(outcome.manifest.entries[0].sourcePath).toBe('lib/section.ts'.replace('lib/', '') + '');
    expect(outcome.outPath).toBe('/proj/manifests/dereekb-x.ui-components.mcp.json');
    expect(outcome.scannedFileCount).toBe(1);
    expect(outcome.extractWarnings).toEqual([]);
  });

  it('respects custom source and module overrides', async () => {
    const { readFile, globber } = fixture({
      files: {
        '/proj/dbx-mcp.scan.json': JSON.stringify({
          version: 1,
          uiComponents: {
            source: 'custom-source',
            module: '@custom/module',
            include: ['src/**/*.ts']
          }
        }),
        '/proj/package.json': JSON.stringify({ name: '@dereekb/x' }),
        '/proj/src/x.ts': `
import { Component } from '@angular/core';
/**
 * X.
 * @dbxWebComponent
 * @dbxWebSlug x
 * @dbxWebCategory misc
 */
@Component({ selector: 'x', template: '' })
export class X {}
        `
      }
    });

    const outcome = await buildUiComponentsManifest({
      projectRoot: '/proj',
      generator: 'test',
      now: FIXED_NOW,
      readFile,
      globber
    });

    expect(outcome.kind).toBe('success');
    if (outcome.kind !== 'success') {
      throw new Error('not success');
    }
    expect(outcome.manifest.source).toBe('custom-source');
    expect(outcome.manifest.module).toBe('@custom/module');
  });

  it('returns no-config when scan config is absent', async () => {
    const { readFile, globber } = fixture({
      files: {
        '/proj/package.json': JSON.stringify({ name: '@dereekb/x' })
      }
    });

    const outcome = await buildUiComponentsManifest({
      projectRoot: '/proj',
      generator: 'test',
      now: FIXED_NOW,
      readFile,
      globber
    });

    expect(outcome.kind).toBe('no-config');
  });

  it('returns invalid-scan-config when uiComponents section is missing', async () => {
    const { readFile, globber } = fixture({
      files: {
        '/proj/dbx-mcp.scan.json': JSON.stringify({ version: 1 }),
        '/proj/package.json': JSON.stringify({ name: '@dereekb/x' })
      }
    });

    const outcome = await buildUiComponentsManifest({
      projectRoot: '/proj',
      generator: 'test',
      now: FIXED_NOW,
      readFile,
      globber
    });

    expect(outcome.kind).toBe('invalid-scan-config');
  });
});

describe('serializeUiComponentManifest', () => {
  it('produces stable JSON with trailing newline', async () => {
    const { readFile, globber } = fixture({
      files: {
        '/proj/dbx-mcp.scan.json': JSON.stringify({
          version: 1,
          uiComponents: { include: ['src/**/*.ts'] }
        }),
        '/proj/package.json': JSON.stringify({ name: '@dereekb/x' }),
        '/proj/src/x.ts': `
import { Component } from '@angular/core';
/**
 * X.
 * @dbxWebComponent
 * @dbxWebSlug x
 * @dbxWebCategory misc
 */
@Component({ selector: 'x', template: '' })
export class X {}
        `
      }
    });

    const outcome = await buildUiComponentsManifest({
      projectRoot: '/proj',
      generator: 'test',
      now: FIXED_NOW,
      readFile,
      globber
    });
    if (outcome.kind !== 'success') {
      throw new Error('not success');
    }
    const serialized = serializeUiComponentManifest(outcome.manifest);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(JSON.parse(serialized)).toEqual(outcome.manifest);
  });
});

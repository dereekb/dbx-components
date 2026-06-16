/**
 * Specs for the marker-injection utility: applied / already-present /
 * marker-missing / file-missing paths, indentation, placement, and dry-run.
 */

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { dbxAddonMarker, formatManualInjectionInstructions, injectAll, injectAtMarker } from './source-inject.js';

const MARKER = dbxAddonMarker({ addonId: 'oidc', fileTag: 'root-config', site: 'providers' });
const SENTINEL = '@dbx-addon:oidc:provideDbxFirebaseOidc';
const SNIPPET = `provideDbxFirebaseOidc({ appCollectionClass: AppCollections }), // ${SENTINEL}`;

describe('injectAtMarker', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-inject-'));
  });

  function writeFixture(name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }

  it('applies the snippet after the marker and reports applied', () => {
    const filePath = writeFixture('config.ts', ['providers: [', `  // ${MARKER}`, '  provideOther()', ']'].join('\n'));

    const result = injectAtMarker({ filePath, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL });

    expect(result.status).toBe('applied');
    const written = readFileSync(filePath, 'utf8');
    expect(written).toContain(SENTINEL);
    const lines = written.split('\n');
    const markerLine = lines.findIndex((line) => line.includes(MARKER));
    expect(lines[markerLine + 1]).toContain('provideDbxFirebaseOidc');
    // indentation is inherited from the marker line (two spaces).
    expect(lines[markerLine + 1].startsWith('  provideDbxFirebaseOidc')).toBe(true);
  });

  it('is a no-op when the sentinel is already present', () => {
    const filePath = writeFixture('config.ts', ['providers: [', `  // ${MARKER}`, `  ${SNIPPET}`, ']'].join('\n'));
    const before = readFileSync(filePath, 'utf8');

    const result = injectAtMarker({ filePath, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL });

    expect(result.status).toBe('already-present');
    expect(readFileSync(filePath, 'utf8')).toBe(before);
  });

  it('does not write and returns the manual snippet when the marker is missing', () => {
    const filePath = writeFixture('config.ts', ['providers: [', '  provideOther()', ']'].join('\n'));
    const before = readFileSync(filePath, 'utf8');

    const result = injectAtMarker({ filePath, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL });

    expect(result.status).toBe('marker-missing');
    expect(result.manualSnippet).toBe(SNIPPET);
    expect(readFileSync(filePath, 'utf8')).toBe(before);
  });

  it('reports file-missing for a nonexistent file', () => {
    const result = injectAtMarker({ filePath: join(dir, 'nope.ts'), marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL });

    expect(result.status).toBe('file-missing');
    expect(result.manualSnippet).toBe(SNIPPET);
  });

  it('inserts before the marker when placement is before', () => {
    const filePath = writeFixture('config.ts', [`// ${MARKER}`, 'lastLine'].join('\n'));

    injectAtMarker({ filePath, marker: MARKER, snippet: 'INSERTED', sentinel: 'INSERTED', placement: 'before' });

    const lines = readFileSync(filePath, 'utf8').split('\n');
    expect(lines[0]).toBe('INSERTED');
    expect(lines[1]).toContain(MARKER);
  });

  it('honors dryRun (computes status without writing)', () => {
    const filePath = writeFixture('config.ts', [`  // ${MARKER}`].join('\n'));
    const before = readFileSync(filePath, 'utf8');

    const result = injectAtMarker({ filePath, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL }, { dryRun: true });

    expect(result.status).toBe('applied');
    expect(readFileSync(filePath, 'utf8')).toBe(before);
  });
});

describe('injectAll + formatManualInjectionInstructions', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-inject-'));
  });

  it('summarizes only the manual (marker/file missing) results', () => {
    const withMarker = join(dir, 'a.ts');
    writeFileSync(withMarker, `// ${MARKER}\n`);
    const withoutMarker = join(dir, 'b.ts');
    writeFileSync(withoutMarker, 'noMarkerHere\n');

    const results = injectAll([
      { filePath: withMarker, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL },
      { filePath: withoutMarker, marker: MARKER, snippet: 'B_SNIPPET', sentinel: 'B_SENTINEL' },
      { filePath: join(dir, 'missing.ts'), marker: MARKER, snippet: 'C_SNIPPET', sentinel: 'C_SENTINEL' }
    ]);

    expect(results.map((result) => result.status)).toEqual(['applied', 'marker-missing', 'file-missing']);

    const manual = formatManualInjectionInstructions(results, { relativeTo: dir });
    expect(manual).toContain('b.ts');
    expect(manual).toContain('B_SNIPPET');
    expect(manual).toContain('missing.ts');
    expect(manual).toContain('C_SNIPPET');
    expect(manual).not.toContain('a.ts');
  });

  it('returns undefined when nothing requires manual work', () => {
    const filePath = join(dir, 'a.ts');
    writeFileSync(filePath, `// ${MARKER}\n`);
    const results = injectAll([{ filePath, marker: MARKER, snippet: SNIPPET, sentinel: SENTINEL }]);
    expect(formatManualInjectionInstructions(results)).toBeUndefined();
  });
});

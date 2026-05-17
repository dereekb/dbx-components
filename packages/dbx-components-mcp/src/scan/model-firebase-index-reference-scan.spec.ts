/**
 * Vitest specs for the firebase-index reference scanner.
 *
 * Verifies that:
 *   - Factory names referenced in consumer `.ts` files are counted.
 *   - The factory's own declaration file is skipped (self-references
 *     in the body don't inflate counts).
 *   - Word boundaries are respected (substring collisions don't match).
 *   - Multiple call-sites in the same file each contribute to the count.
 *   - Empty input returns an empty map.
 */

import { describe, expect, it } from 'vitest';
import { scanFactoryReferences } from './model-firebase-index-reference-scan.js';

interface FakeFs {
  readonly globber: (input: { readonly projectRoot: string; readonly include: readonly string[]; readonly exclude: readonly string[] }) => Promise<readonly string[]>;
  readonly readFile: (absolutePath: string) => Promise<string>;
}

function fakeFs(projectRoot: string, files: Record<string, string>): FakeFs {
  const norm = (p: string) => p.replaceAll('\\', '/');
  const root = norm(projectRoot).replace(/\/+$/, '');
  const entries = new Map<string, string>();
  for (const [rel, contents] of Object.entries(files)) {
    const relNorm = norm(rel).replace(/^\/+/, '');
    entries.set(`${root}/${relNorm}`, contents);
  }
  return {
    globber: async () => {
      const result: string[] = [];
      for (const abs of entries.keys()) {
        result.push(abs.slice(root.length + 1));
      }
      return result;
    },
    readFile: async (abs) => {
      const value = entries.get(norm(abs));
      if (value === undefined) throw new Error(`fakeFs: ${abs} not found`);
      return value;
    }
  };
}

describe('scanFactoryReferences', () => {
  it('returns an empty map when called with no entries', async () => {
    const fs = fakeFs('/proj', {});
    const result = await scanFactoryReferences({ projectRoot: '/proj', entries: [], globber: fs.globber, readFile: fs.readFile });
    expect(result.size).toBe(0);
  });

  it('counts references in consumer files but skips the declaration file', async () => {
    const fs = fakeFs('/proj', {
      'src/lib/model/job/job.query.ts': `
        export function jobsActiveQuery() { return jobsActiveQuery; }
      `,
      'src/lib/model/job/job.action.ts': `
        import { jobsActiveQuery } from './job.query';
        export function runActiveJobs() {
          const constraints = jobsActiveQuery();
          return constraints;
        }
      `,
      'src/lib/model/other/other.api.ts': `
        import { jobsActiveQuery } from '../job/job.query';
        const x = jobsActiveQuery();
      `
    });
    const result = await scanFactoryReferences({
      projectRoot: '/proj',
      entries: [{ slug: 'jobs-active', name: 'jobsActiveQuery', filePath: '/proj/src/lib/model/job/job.query.ts' }],
      globber: fs.globber,
      readFile: fs.readFile
    });
    const info = result.get('jobs-active');
    expect(info).toBeDefined();
    expect(info?.count).toBe(4);
    expect(info?.referencedBy.length).toBe(4);
    const files = (info?.referencedBy ?? []).map((r) => r.file).sort();
    expect(files).toEqual(['src/lib/model/job/job.action.ts', 'src/lib/model/job/job.action.ts', 'src/lib/model/other/other.api.ts', 'src/lib/model/other/other.api.ts']);
  });

  it('reports zero references when no consumer uses the factory', async () => {
    const fs = fakeFs('/proj', {
      'src/lib/model/job/job.query.ts': `
        export function orphanQuery() { return []; }
      `,
      'src/lib/model/job/job.action.ts': `
        export function runJobs() { return 42; }
      `
    });
    const result = await scanFactoryReferences({
      projectRoot: '/proj',
      entries: [{ slug: 'orphan', name: 'orphanQuery', filePath: '/proj/src/lib/model/job/job.query.ts' }],
      globber: fs.globber,
      readFile: fs.readFile
    });
    expect(result.get('orphan')?.count).toBe(0);
    expect(result.get('orphan')?.referencedBy).toEqual([]);
  });

  it('respects word boundaries (no substring matches)', async () => {
    const fs = fakeFs('/proj', {
      'src/lib/model/job/job.query.ts': `
        export function fooQuery() { return []; }
      `,
      'src/lib/model/job/job.action.ts': `
        // fooQueryExtended is a different identifier - the scanner must not double-count it.
        export function fooQueryExtended() { return 1; }
        const f = fooQueryExtended();
      `,
      'src/lib/model/job/job.api.ts': `
        import { fooQuery } from './job.query';
        const f = fooQuery();
      `
    });
    const result = await scanFactoryReferences({
      projectRoot: '/proj',
      entries: [{ slug: 'foo', name: 'fooQuery', filePath: '/proj/src/lib/model/job/job.query.ts' }],
      globber: fs.globber,
      readFile: fs.readFile
    });
    expect(result.get('foo')?.count).toBe(2);
  });

  it('counts multiple factories independently', async () => {
    const fs = fakeFs('/proj', {
      'src/lib/model/job/job.query.ts': `
        export function aQuery() { return []; }
        export function bQuery() { return []; }
      `,
      'src/lib/model/job/job.action.ts': `
        import { aQuery, bQuery } from './job.query';
        const a = aQuery();
        const a2 = aQuery();
        const b = bQuery();
      `
    });
    const result = await scanFactoryReferences({
      projectRoot: '/proj',
      entries: [
        { slug: 'a', name: 'aQuery', filePath: '/proj/src/lib/model/job/job.query.ts' },
        { slug: 'b', name: 'bQuery', filePath: '/proj/src/lib/model/job/job.query.ts' }
      ],
      globber: fs.globber,
      readFile: fs.readFile
    });
    expect(result.get('a')?.count).toBe(3);
    expect(result.get('b')?.count).toBe(2);
  });

  it('captures the 1-based line number of each reference', async () => {
    const fs = fakeFs('/proj', {
      'src/lib/model/job/job.query.ts': `export function lineQuery() { return []; }`,
      'src/lib/model/job/job.action.ts': `// line 1
// line 2
import { lineQuery } from './job.query';
const x = lineQuery();
`
    });
    const result = await scanFactoryReferences({
      projectRoot: '/proj',
      entries: [{ slug: 'line', name: 'lineQuery', filePath: '/proj/src/lib/model/job/job.query.ts' }],
      globber: fs.globber,
      readFile: fs.readFile
    });
    const sites = result.get('line')?.referencedBy ?? [];
    const lines = sites.map((s) => s.line).sort((a, b) => a - b);
    expect(lines).toEqual([3, 4]);
  });
});

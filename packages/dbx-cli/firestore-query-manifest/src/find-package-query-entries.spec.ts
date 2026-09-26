import { describe, expect, it } from 'vitest';
import type { LoadModelFirebaseIndexPackageManifestsOutcome } from '../../firestore-indexes/src/model-firebase-index-package-manifests.js';
import { findPackageQueryEntries } from './find-package-query-entries.js';

function entry(overrides: Record<string, unknown> = {}): any {
  return {
    slug: 'notifications-newest-first-query',
    name: 'notificationsNewestFirstQuery',
    module: '@dereekb/firebase',
    subpath: 'model/notification/notification.query',
    signature: 'notificationsNewestFirstQuery(): FirestoreQueryConstraint[]',
    description: 'Lists a box notifications, newest first.',
    model: 'Notification',
    collection: 'nbn',
    isNested: true,
    scope: 'COLLECTION',
    manual: false,
    skip: false,
    category: 'lookup',
    params: [],
    returns: 'FirestoreQueryConstraint[]',
    tags: [],
    constraintSequences: [],
    derivedComposites: [],
    derivedFieldOverrides: [],
    ...overrides
  };
}

function loaded(path: string, entries: readonly any[]): any {
  return { path, manifest: { version: 1, source: 'dereekb-firebase', module: '@dereekb/firebase', generatedAt: 'x', generator: 'test@1', entries } };
}

describe('findPackageQueryEntries()', () => {
  it('collects the entries of every bundled manifest', async () => {
    const seen: unknown[] = [];
    const result = await findPackageQueryEntries({
      cwd: '/workspace',
      loadManifests: async (input) => {
        seen.push(input);
        return { kind: 'success', loaded: [loaded('/a.json', [entry()]), loaded('/b.json', [entry({ slug: 'other-query', name: 'otherQuery', module: '@dereekb/other' })])] };
      }
    });

    expect(seen).toEqual([{ cwd: '/workspace', discoverBundled: true }]);
    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries.map((x) => x.slug)).toEqual(['notifications-newest-first-query', 'other-query']);
    expect(result.entries[0]).toMatchObject({ module: '@dereekb/firebase', model: 'Notification', collection: 'nbn', isNested: true, scope: 'COLLECTION', category: 'lookup' });
    expect(result.manifestPaths).toEqual(['/a.json', '/b.json']);
  });

  it('drops @dbxModelFirebaseIndexSpecFilesOnly entries', async () => {
    const result = await findPackageQueryEntries({ cwd: '/workspace', loadManifests: async () => ({ kind: 'success', loaded: [loaded('/a.json', [entry(), entry({ slug: 'spec-only-query', name: 'specOnlyQuery', specOnly: true })])] }) });

    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.entries.map((x) => x.slug)).toEqual(['notifications-newest-first-query']);
    expect(result.droppedSpecOnly).toBe(1);
  });

  it('reports a missing bundling package as a failure naming the fix', async () => {
    const outcome: LoadModelFirebaseIndexPackageManifestsOutcome = { kind: 'no-bundled-package', packageName: '@dereekb/dbx-components-mcp' };
    const result = await findPackageQueryEntries({ cwd: '/workspace', loadManifests: async () => outcome });

    expect(result.kind).toBe('failure');
    if (result.kind !== 'failure') return;
    expect(result.message).toContain('[packages]');
    expect(result.message).toContain('@dereekb/dbx-components-mcp is not installed');
  });
});

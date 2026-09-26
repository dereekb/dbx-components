import { describe, expect, it } from 'vitest';
import { bindPackageQueryFactories, bindQueryFactories } from './bind-factories.js';
import type { CollectedQueryEntry } from './types.js';

const ENTRY: CollectedQueryEntry = {
  slug: 'published-guestbooks-query',
  name: 'publishedGuestbooksQuery',
  module: 'demo-firebase',
  subpath: 'model/guestbook/guestbook.query',
  model: 'Guestbook',
  collection: 'gb',
  isNested: false,
  scope: 'COLLECTION',
  signature: 'publishedGuestbooksQuery(params: P): FirestoreQueryConstraint[]',
  params: []
};

describe('bindQueryFactories()', () => {
  it('binds an entry exported from the component barrel', () => {
    const result = bindQueryFactories({ componentRoot: '/c', entries: [ENTRY], isExported: () => true });
    expect(result.bound).toEqual([{ entry: ENTRY, bound: true }]);
    expect(result.warnings).toEqual([]);
  });

  it('still emits an unbound entry, with a [no-factory] warning', () => {
    const result = bindQueryFactories({ componentRoot: '/c', entries: [ENTRY], isExported: () => false });
    expect(result.bound).toEqual([{ entry: ENTRY, bound: false }]);
    expect(result.warnings).toEqual(['[no-factory] demo-firebase · published-guestbooks-query → publishedGuestbooksQuery not exported']);
  });

  it('looks each identifier up against the supplied component root', () => {
    const seen: unknown[] = [];
    bindQueryFactories({
      componentRoot: '/components/demo-firebase',
      entries: [ENTRY],
      isExported: (input) => {
        seen.push(input);
        return true;
      }
    });
    expect(seen).toEqual([{ packageRoot: '/components/demo-firebase', identifier: 'publishedGuestbooksQuery' }]);
  });
});

describe('bindPackageQueryFactories()', () => {
  const PACKAGE_ENTRY: CollectedQueryEntry = {
    ...ENTRY,
    slug: 'notifications-newest-first-query',
    name: 'notificationsNewestFirstQuery',
    module: '@dereekb/firebase',
    subpath: 'model/notification/notification.query',
    model: 'Notification',
    collection: 'nbn',
    isNested: true,
    signature: 'notificationsNewestFirstQuery(): FirestoreQueryConstraint[]'
  };

  it('binds an entry exported from its installed package barrel', () => {
    const seen: unknown[] = [];
    const result = bindPackageQueryFactories({
      cwd: '/workspace',
      entries: [PACKAGE_ENTRY],
      resolvePackageRoot: () => '/workspace/node_modules/@dereekb/firebase',
      isExported: (input) => {
        seen.push(input);
        return true;
      }
    });
    expect(result.bound).toEqual([{ entry: PACKAGE_ENTRY, bound: true }]);
    expect(result.warnings).toEqual([]);
    expect(seen).toEqual([{ packageRoot: '/workspace/node_modules/@dereekb/firebase', identifier: 'notificationsNewestFirstQuery' }]);
  });

  it('leaves an entry unbound when its package is not installed', () => {
    const result = bindPackageQueryFactories({ cwd: '/workspace', entries: [PACKAGE_ENTRY], resolvePackageRoot: () => null, isExported: () => true });
    expect(result.bound).toEqual([{ entry: PACKAGE_ENTRY, bound: false }]);
    expect(result.warnings).toEqual(['[no-factory] @dereekb/firebase · notifications-newest-first-query → @dereekb/firebase is not installed']);
  });

  it('leaves an entry unbound when the installed package does not export it', () => {
    const result = bindPackageQueryFactories({ cwd: '/workspace', entries: [PACKAGE_ENTRY], resolvePackageRoot: () => '/pkg', isExported: () => false });
    expect(result.bound).toEqual([{ entry: PACKAGE_ENTRY, bound: false }]);
    expect(result.warnings).toEqual(['[no-factory] @dereekb/firebase · notifications-newest-first-query → notificationsNewestFirstQuery not exported']);
  });

  it('resolves each module once', () => {
    const resolved: string[] = [];
    bindPackageQueryFactories({
      cwd: '/workspace',
      entries: [PACKAGE_ENTRY, { ...PACKAGE_ENTRY, slug: 'other-query', name: 'otherQuery' }],
      resolvePackageRoot: ({ module }) => {
        resolved.push(module);
        return null;
      },
      isExported: () => true
    });
    expect(resolved).toEqual(['@dereekb/firebase']);
  });
});

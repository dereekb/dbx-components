import { describe, expect, it } from 'vitest';
import { type CliFirestoreQueryManifest, type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { CliError } from '../util/output';
import { filterCliFirestoreQueries, renderCliFirestoreQueryEntry, renderCliFirestoreQueryList, resolveCliFirestoreQueryEntry } from './query-info-utils';
import { createCliFirestoreQueryRegistry } from './query-registry';

function buildEntry(input: Partial<CliFirestoreQueryManifestEntry> & { readonly slug: string; readonly name: string }): CliFirestoreQueryManifestEntry {
  return {
    module: 'demo-firebase',
    subpath: 'src/lib/model/guestbook/guestbook.query.ts',
    model: 'Guestbook',
    collection: 'gb',
    isNested: false,
    scope: 'COLLECTION',
    signature: `${input.name}(params: Params): FirestoreQueryConstraint[]`,
    params: [],
    factory: () => [],
    ...input
  } as CliFirestoreQueryManifestEntry;
}

const PUBLISHED_GUESTBOOKS = buildEntry({
  slug: 'published-guestbooks',
  name: 'publishedGuestbooksQuery',
  category: 'listing',
  tags: ['guestbook', 'Published'],
  params: [{ name: 'params', type: 'PublishedGuestbooksQueryParams', optional: false, description: 'The published state to match.' }]
});

const PUBLISHED_ENTRIES = buildEntry({
  slug: 'published-guestbook-entries',
  name: 'publishedGuestbookEntriesQuery',
  model: 'GuestbookEntry',
  collection: 'gbe',
  isNested: true,
  scope: 'COLLECTION_GROUP',
  category: 'listing'
});

/**
 * A catalogued entry whose identifier is not exported from its module — the manifest generator emits
 * it so it stays discoverable, with `factory: undefined` marking it unrunnable.
 */
const NOT_INVOCABLE = buildEntry({
  slug: 'internal-guestbook-scan',
  name: 'internalGuestbookScanQuery',
  factory: undefined,
  manual: true,
  skip: true
});

const DISPATCHER = buildEntry({
  slug: 'guestbooks',
  name: 'guestbooksQuery',
  dispatcher: true,
  relatedSlugs: ['published-guestbooks'],
  example: 'demo-cli firestore-query guestbooks --params \'{"kind":"published"}\''
});

const MANIFEST: CliFirestoreQueryManifest = [PUBLISHED_ENTRIES, PUBLISHED_GUESTBOOKS, NOT_INVOCABLE, DISPATCHER];
const REGISTRY = createCliFirestoreQueryRegistry(MANIFEST);

describe('resolveCliFirestoreQueryEntry()', () => {
  it('resolves by slug', () => {
    expect(resolveCliFirestoreQueryEntry(REGISTRY, 'published-guestbooks')).toBe(PUBLISHED_GUESTBOOKS);
  });

  it('resolves by exported identifier', () => {
    expect(resolveCliFirestoreQueryEntry(REGISTRY, 'publishedGuestbookEntriesQuery')).toBe(PUBLISHED_ENTRIES);
  });

  it('fails with NOT_FOUND listing the known slugs', () => {
    let error: unknown;
    try {
      resolveCliFirestoreQueryEntry(REGISTRY, 'nope');
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe('NOT_FOUND');
    expect((error as CliError).suggestion).toContain('published-guestbooks');
  });

  it('points at the missing wiring when the catalog is empty', () => {
    let error: unknown;
    try {
      resolveCliFirestoreQueryEntry(createCliFirestoreQueryRegistry([]), 'anything');
    } catch (e) {
      error = e;
    }
    expect((error as CliError).suggestion).toContain('firestoreQueryManifest');
  });
});

describe('filterCliFirestoreQueries()', () => {
  it('returns everything with no filters', () => {
    expect(filterCliFirestoreQueries(REGISTRY, {})).toHaveLength(4);
  });

  it('filters by PascalCase model name', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { model: 'GuestbookEntry' }).map((x) => x.slug)).toEqual(['published-guestbook-entries']);
  });

  it('filters by collection prefix', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { model: 'gbe' }).map((x) => x.slug)).toEqual(['published-guestbook-entries']);
  });

  it('filters by category', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { category: 'listing' }).map((x) => x.slug)).toEqual(['published-guestbook-entries', 'published-guestbooks']);
  });

  it('filters by tag, case-insensitively', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { tag: 'published' }).map((x) => x.slug)).toEqual(['published-guestbooks']);
  });

  it('combines filters', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { model: 'gb', category: 'listing' }).map((x) => x.slug)).toEqual(['published-guestbooks']);
  });
});

describe('renderCliFirestoreQueryList()', () => {
  it('renders the documented column set', () => {
    const rendered = renderCliFirestoreQueryList(REGISTRY.all);
    expect(rendered.split('\n')[0]).toContain('SLUG');
    expect(rendered.split('\n')[0]).toContain('INVOCABLE');
    expect(rendered).toContain('Guestbook (gb)');
    expect(rendered).toContain('COLLECTION_GROUP');
  });

  it('marks a factory-less entry INVOCABLE = no', () => {
    const row = renderCliFirestoreQueryList([NOT_INVOCABLE])
      .split('\n')
      .find((l) => l.includes('internal-guestbook-scan'));
    expect(row).toBeDefined();
    expect(row?.trimEnd().endsWith('no')).toBe(true);
  });

  it('marks an invocable entry INVOCABLE = yes', () => {
    const row = renderCliFirestoreQueryList([PUBLISHED_GUESTBOOKS])
      .split('\n')
      .find((l) => l.includes('published-guestbooks'));
    expect(row?.trimEnd().endsWith('yes')).toBe(true);
  });

  it('renders a placeholder for an empty catalog', () => {
    expect(renderCliFirestoreQueryList([])).toBe('No Firestore queries found.\n');
  });
});

describe('renderCliFirestoreQueryEntry()', () => {
  it('renders the signature and the params table', () => {
    const rendered = renderCliFirestoreQueryEntry(PUBLISHED_GUESTBOOKS);
    expect(rendered).toContain('# published-guestbooks');
    expect(rendered).toContain('Function: publishedGuestbooksQuery');
    expect(rendered).toContain('Signature: publishedGuestbooksQuery(params: Params)');
    expect(rendered).toContain('Parameters (1):');
    expect(rendered).toContain('PublishedGuestbooksQueryParams');
    expect(rendered).toContain('Invocable: yes');
  });

  it('reports no parameters for a zero-arg factory', () => {
    expect(renderCliFirestoreQueryEntry(PUBLISHED_ENTRIES)).toContain('Parameters: none');
  });

  it('names the unexported identifier when the entry is not invocable', () => {
    const rendered = renderCliFirestoreQueryEntry(NOT_INVOCABLE);
    expect(rendered).toContain('Invocable: no — internalGuestbookScanQuery is not exported from demo-firebase');
  });

  it('lists the governance flags, which do not affect callability', () => {
    expect(renderCliFirestoreQueryEntry(NOT_INVOCABLE)).toContain('Index flags: manual, skip');
  });

  it('explains a dispatcher and points at its related slugs', () => {
    const rendered = renderCliFirestoreQueryEntry(DISPATCHER);
    expect(rendered).toContain('This is a DISPATCHER');
    expect(rendered).toContain('Related: published-guestbooks');
    expect(rendered).toContain('Example:');
  });

  it('marks a nested model as nested', () => {
    expect(renderCliFirestoreQueryEntry(PUBLISHED_ENTRIES)).toContain('collection gbe (nested)');
  });
});

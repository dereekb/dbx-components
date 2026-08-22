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

/**
 * A bound factory over a collection `firestore.rules` refuses outright — invocable, unreachable.
 */
const UNAVAILABLE = buildEntry({
  slug: 'notifications',
  name: 'notificationsQuery',
  model: 'Notification',
  collection: 'nbn',
  isNested: true,
  scope: 'COLLECTION_GROUP',
  queryMode: 'unavailable',
  rules: { list: 'denied', collectionGroup: false, reason: 'list-denied' }
});

/**
 * The `jlja` shape: readable under its parent, dead as a collection group.
 */
const PARENT_CHILD = buildEntry({
  slug: 'job-applications-not-closed',
  name: 'jobApplicationsNotClosedQuery',
  model: 'JobApplication',
  collection: 'jlja',
  isNested: true,
  scope: 'COLLECTION_GROUP',
  queryMode: 'parent-child',
  rules: { list: 'allowed', collectionGroup: false, reason: 'no-collection-group-rule', parentPaths: ['jl/{jobLocation}/jlj/{job}'] }
});

const MANIFEST: CliFirestoreQueryManifest = [PUBLISHED_ENTRIES, PUBLISHED_GUESTBOOKS, NOT_INVOCABLE, DISPATCHER];
const REGISTRY = createCliFirestoreQueryRegistry(MANIFEST);
const SCANNED_REGISTRY = createCliFirestoreQueryRegistry([PUBLISHED_GUESTBOOKS, UNAVAILABLE, PARENT_CHILD, NOT_INVOCABLE]);

/**
 * The last two cells of a rendered table row — `INVOCABLE` and `MODE`.
 *
 * @param row - One rendered row.
 * @returns The two trailing cell values.
 */
function trailingColumns(row: string): string[] {
  return row
    .trimEnd()
    .split(/\s{2,}/)
    .slice(-2);
}

/**
 * Renders a one-entry list and returns the row for a slug.
 *
 * @param entries - The entries to render.
 * @param slug - The slug whose row is wanted.
 * @returns The matching row.
 */
function rowFor(entries: readonly CliFirestoreQueryManifestEntry[], slug: string): string {
  return renderCliFirestoreQueryList(entries)
    .split('\n')
    .find((l) => l.includes(slug)) as string;
}

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

  it('drops unbound and unavailable entries under invocableOnly, keeping parent-child ones', () => {
    // a parent-child entry IS runnable — with `--parent` — so hiding it would lose real capability
    expect(filterCliFirestoreQueries(SCANNED_REGISTRY, { invocableOnly: true }).map((x) => x.slug)).toEqual(['job-applications-not-closed', 'published-guestbooks']);
  });

  it('keeps an unscanned entry under invocableOnly', () => {
    expect(filterCliFirestoreQueries(REGISTRY, { invocableOnly: true }).map((x) => x.slug)).toEqual(['guestbooks', 'published-guestbook-entries', 'published-guestbooks']);
  });
});

describe('renderCliFirestoreQueryList()', () => {
  it('renders the documented column set', () => {
    const rendered = renderCliFirestoreQueryList(REGISTRY.all);
    expect(rendered.split('\n')[0]).toContain('SLUG');
    expect(rendered.split('\n')[0]).toContain('INVOCABLE');
    expect(rendered.split('\n')[0]).toContain('MODE');
    expect(rendered).toContain('Guestbook (gb)');
    expect(rendered).toContain('COLLECTION_GROUP');
  });

  it('marks a factory-less entry INVOCABLE = no', () => {
    const row = renderCliFirestoreQueryList([NOT_INVOCABLE])
      .split('\n')
      .find((l) => l.includes('internal-guestbook-scan'));
    expect(row).toBeDefined();
    expect(trailingColumns(row as string)).toEqual(['no', 'unknown']);
  });

  it('marks an invocable entry INVOCABLE = yes', () => {
    const row = renderCliFirestoreQueryList([PUBLISHED_GUESTBOOKS])
      .split('\n')
      .find((l) => l.includes('published-guestbooks'));
    expect(trailingColumns(row as string)).toEqual(['yes', 'unknown']);
  });

  it('renders MODE = unknown for an entry the generator never scanned', () => {
    // absence of a mode is UNKNOWN, and the table has to say so rather than imply `model`
    expect(trailingColumns(rowFor([PUBLISHED_GUESTBOOKS], 'published-guestbooks'))).toEqual(['yes', 'unknown']);
  });

  it('marks an unavailable entry MODE = unavailable while INVOCABLE stays yes', () => {
    // the two columns answer different questions: the factory bound fine, the rules refuse it
    expect(trailingColumns(rowFor([UNAVAILABLE], 'notifications'))).toEqual(['yes', 'unavailable']);
  });

  it('marks a parent-child entry MODE = parent-child', () => {
    expect(trailingColumns(rowFor([PARENT_CHILD], 'job-applications-not-closed'))).toEqual(['yes', 'parent-child']);
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

  it('says the mode is unknown when the manifest was generated without --rules', () => {
    expect(renderCliFirestoreQueryEntry(PUBLISHED_GUESTBOOKS)).toContain('Mode: unknown');
  });

  it('names the missing collection-group rule and the --parent shape for a parent-child entry', () => {
    const rendered = renderCliFirestoreQueryEntry(PARENT_CHILD);

    expect(rendered).toContain('Mode: parent-child');
    expect(rendered).toContain('match /{path=**}/jlja/{id}');
    expect(rendered).toContain('jl/{jobLocation}/jlj/{job}');
  });

  it('reports an unavailable entry as such despite being invocable', () => {
    const rendered = renderCliFirestoreQueryEntry(UNAVAILABLE);

    expect(rendered).toContain('Invocable: yes');
    expect(rendered).toContain('Mode: unavailable —');
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

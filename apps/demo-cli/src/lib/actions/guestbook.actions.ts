import { type ActionCommandSpec, type CliContext, iterateDbxCliCallModel } from '@dereekb/dbx-cli';
import { type Guestbook, type GuestbookEntry, type GuestbookKey, type QueryGuestbookEntriesParams, type QueryGuestbooksParams } from 'demo-firebase';

// MARK: queryGuestbookEntriesForGuestbook

/**
 * Input for {@link queryGuestbookEntriesForGuestbook}.
 */
export interface QueryGuestbookEntriesForGuestbookInput {
  readonly context: CliContext;
  readonly guestbook: GuestbookKey;
  readonly published?: boolean;
  readonly limit?: number;
}

/**
 * Output for {@link queryGuestbookEntriesForGuestbook}.
 */
export interface QueryGuestbookEntriesForGuestbookOutput {
  readonly guestbook: GuestbookKey;
  readonly count: number;
  readonly entries: ReadonlyArray<GuestbookEntry>;
}

/**
 * Pages through every GuestbookEntry for a single Guestbook via `guestbookEntry.query`.
 *
 * Exposed as a plain async function so other actions can compose it directly
 * (no string-keyed action registry, full TypeScript inference). The matching
 * {@link queryGuestbookEntriesForGuestbookAction} is a thin yargs adapter that
 * delegates to this function.
 *
 * @example
 * ```ts
 * const { count, entries } = await queryGuestbookEntriesForGuestbook({
 *   context,
 *   guestbook: 'gb/abc',
 *   published: true
 * });
 * ```
 *
 * @param input - The function inputs.
 * @returns Aggregated entries for the Guestbook.
 */
export async function queryGuestbookEntriesForGuestbook(input: QueryGuestbookEntriesForGuestbookInput): Promise<QueryGuestbookEntriesForGuestbookOutput> {
  const { context, guestbook, published, limit } = input;

  const result = await iterateDbxCliCallModel<QueryGuestbookEntriesParams, GuestbookEntry>({
    context,
    modelType: 'guestbookEntry',
    params: { guestbook, ...(published !== undefined ? { published } : {}) },
    totalItemsLimit: limit
  });

  const output: QueryGuestbookEntriesForGuestbookOutput = {
    guestbook,
    count: result.totalItems,
    entries: result.items ?? []
  };

  return output;
}

/**
 * Action: list GuestbookEntries for a single Guestbook (paginated).
 */
export const queryGuestbookEntriesForGuestbookAction: ActionCommandSpec = {
  command: 'entries <guestbook>',
  describe: 'List GuestbookEntries for a Guestbook (paginates guestbookEntry.query).',
  model: 'guestbook',
  builder: (y) => y.positional('guestbook', { type: 'string', describe: 'Guestbook key (e.g. `gb/<id>`).' }).option('published', { type: 'boolean', describe: 'Filter by published flag.' }).option('limit', { type: 'number', describe: 'Max entries to return.' }),
  handler: ({ context, argv }) =>
    queryGuestbookEntriesForGuestbook({
      context,
      guestbook: String((argv as { readonly guestbook: string }).guestbook),
      published: (argv as { readonly published?: boolean }).published,
      limit: (argv as { readonly limit?: number }).limit
    })
};

// MARK: queryAllPublishedGuestbookEntries

/**
 * Input for {@link queryAllPublishedGuestbookEntries}.
 */
export interface QueryAllPublishedGuestbookEntriesInput {
  readonly context: CliContext;
  readonly limit?: number;
  readonly parallel?: number;
}

/**
 * Output for {@link queryAllPublishedGuestbookEntries}.
 */
export interface QueryAllPublishedGuestbookEntriesOutput {
  readonly guestbookCount: number;
  readonly entryCount: number;
  readonly perGuestbook: ReadonlyArray<QueryGuestbookEntriesForGuestbookOutput>;
}

/**
 * Pages through every published Guestbook, and for each one reuses
 * {@link queryGuestbookEntriesForGuestbook} to gather its published entries —
 * demonstrating two-level action composition without a `callAction` registry.
 *
 * @example
 * ```ts
 * const summary = await queryAllPublishedGuestbookEntries({ context, parallel: 4 });
 * console.log(summary.guestbookCount, summary.entryCount);
 * ```
 *
 * @param input - The function inputs.
 * @returns Aggregate counts plus the per-Guestbook breakdown.
 */
export async function queryAllPublishedGuestbookEntries(input: QueryAllPublishedGuestbookEntriesInput): Promise<QueryAllPublishedGuestbookEntriesOutput> {
  const { context, limit, parallel } = input;

  const result = await iterateDbxCliCallModel<QueryGuestbooksParams, Guestbook, import('@dereekb/firebase').OnCallQueryModelResult<Guestbook>, QueryGuestbookEntriesForGuestbookOutput>({
    context,
    modelType: 'guestbook',
    params: { published: true },
    totalItemsLimit: limit,
    maxParallelPerPage: parallel ?? 1,
    iterateItem: ({ context: ctx, key }) => queryGuestbookEntriesForGuestbook({ context: ctx, guestbook: key, published: true })
  });

  const perGuestbook = result.itemResults ?? [];
  const entryCount = perGuestbook.reduce((acc, x) => acc + x.count, 0);

  const output: QueryAllPublishedGuestbookEntriesOutput = {
    guestbookCount: result.totalItems,
    entryCount,
    perGuestbook
  };

  return output;
}

/**
 * Action: enumerate every published Guestbook and gather its published entries.
 */
export const queryAllPublishedGuestbookEntriesAction: ActionCommandSpec = {
  command: 'all-published-entries',
  describe: 'Paginate every published Guestbook and gather its published entries.',
  model: 'guestbook',
  builder: (y) => y.option('limit', { type: 'number', describe: 'Max guestbooks to visit.' }).option('parallel', { type: 'number', describe: 'Max guestbooks processed in parallel per page (default 1).' }),
  handler: ({ context, argv }) =>
    queryAllPublishedGuestbookEntries({
      context,
      limit: (argv as { readonly limit?: number }).limit,
      parallel: (argv as { readonly parallel?: number }).parallel
    })
};

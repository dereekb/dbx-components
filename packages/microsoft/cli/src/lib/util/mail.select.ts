import { CliError } from '@dereekb/dbx-cli';
import {
  type MicrosoftGraphContext,
  type MicrosoftGraphMailFolder,
  type MicrosoftGraphMailRequest,
  type MicrosoftGraphMessage,
  type MicrosoftGraphMessageWriteResult,
  type MicrosoftGraphPage,
  type MicrosoftGraphRequestInput,
  MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER,
  MICROSOFT_GRAPH_MESSAGE_MAX_PAGE_SIZE,
  MicrosoftGraphError,
  getMailFolder,
  microsoftGraphGetMailFolderRequest,
  microsoftGraphListMessagesRequest,
  microsoftGraphRequest,
  microsoftGraphSearchMessagesRequest
} from '@dereekb/microsoft';
import { type EmailAddress, type Maybe, type Milliseconds, type Seconds, MS_IN_SECOND } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type MsGraphCliDryRunOutput, type MsGraphCliWriteResultsOutput, msGraphCliDryRunOutput, msGraphCliWriteResultsOutput, runMsGraphCliMessageWrites } from './mail.write';
import { parseMsGraphCliDateOption } from './option';

// MARK: Constants
/**
 * The most messages one selection run acts on, unless `--max-messages` says otherwise. A larger selection
 * reports `complete: false` and `remaining`; re-running the same command continues.
 */
export const DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES = 1000;

/**
 * The seconds a selection run may take before it stops starting new `$batch` calls, unless `--max-seconds`
 * says otherwise. Fits a 2-minute sandbox tool call with headroom for process start and the token mint.
 */
export const DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS: Seconds = 90;

/**
 * A `$search` may stop at 250–1000 results without saying so (250 is the lowest reported cap). A search
 * selection that found this many hits reports `complete: false`, so the caller re-runs it.
 */
export const MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT = 250;

/**
 * The page size of a search selection.
 */
export const MSGRAPH_CLI_SELECTION_SEARCH_PAGE_SIZE = 100;

/**
 * How many of the write requests a selection's `--dry-run` prints.
 */
export const MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE = 3;

/**
 * The folder a selection reads when no `--folder` is given. Never every folder (`/messages`): that includes
 * Deleted Items.
 */
export const DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER = 'inbox';

/**
 * How many ids a selection run sends per write group: one `$batch` call, so the time budget is checked before each.
 */
export const MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE = 20;

/**
 * The longest `Retry-After` a selection run waits for, however much time it has left.
 */
export const MSGRAPH_CLI_SELECTION_MAX_RETRY_AFTER_SECONDS: Seconds = 60;

/**
 * The longest `--category` Outlook takes.
 */
export const MSGRAPH_CLI_CATEGORY_MAX_LENGTH = 255;

/**
 * The well-known mail folder names, which are locale-independent. A folder given by one of these names can be
 * checked before any Graph call; one given by id is checked after the folder pre-flight.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/mailfolder#well-known-folder-names
 */
export const MSGRAPH_CLI_WELL_KNOWN_MAIL_FOLDERS: ReadonlySet<string> = new Set([
  'archive',
  'clutter',
  'conflicts',
  'conversationhistory',
  'deleteditems',
  'drafts',
  'inbox',
  'junkemail',
  'localfailures',
  'msgfolderroot',
  'outbox',
  'recoverableitemsdeletions',
  'scheduled',
  'searchfolders',
  'sentitems',
  'serverfailures',
  'syncissues'
]);

// MARK: Options
/**
 * The commands that take a selection.
 */
export type MsGraphCliMailSelectionCommand = 'delete' | 'move';

/**
 * How a command picks its messages: the ids it was given, a filtered list, or a `$search`.
 */
export type MsGraphCliMailTargetMode = 'ids' | 'list' | 'search';

/**
 * Why a selection run stopped before the selection was exhausted.
 *
 * - `max-messages`: more messages matched than `--max-messages`.
 * - `max-seconds`: the time budget ran out.
 * - `search-cap`: the `$search` found {@link MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT} hits or more and may have stopped at Graph's cap.
 */
export type MsGraphCliMailSelectionStop = 'max-messages' | 'max-seconds' | 'search-cap';

/**
 * The selection options of `mail delete` / `mail move`, parsed. Every one is optional.
 */
export interface MsGraphCliMailSelection {
  /**
   * The source folder, by id or well-known name. Defaults to {@link DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER}.
   */
  readonly folder?: Maybe<string>;
  /**
   * List mode: the sender's address.
   */
  readonly from?: Maybe<EmailAddress>;
  /**
   * List mode: received at or after this instant.
   */
  readonly since?: Maybe<Date>;
  /**
   * List mode: received before this instant.
   */
  readonly until?: Maybe<Date>;
  /**
   * List mode: only unread messages.
   */
  readonly unread?: Maybe<boolean>;
  /**
   * List mode: only messages with file attachments.
   */
  readonly hasAttachments?: Maybe<boolean>;
  /**
   * List mode: only messages that carry this Outlook category.
   */
  readonly category?: Maybe<string>;
  /**
   * Search mode: a KQL query. Cannot be combined with a list filter.
   */
  readonly search?: Maybe<string>;
  /**
   * Act on every message in the explicit `folder`, with no filter.
   */
  readonly wholeFolder?: Maybe<boolean>;
  /**
   * The most messages one run acts on. Defaults to {@link DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES}.
   */
  readonly maxMessages?: Maybe<number>;
  /**
   * The time budget, in seconds; 0 turns it off. Defaults to {@link DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS}.
   */
  readonly maxSeconds?: Maybe<Seconds>;
}

/**
 * Adds the selection options of `mail delete` / `mail move`: the source folder, the list filters, `--search`,
 * `--whole-folder` and the run budget (`--max-messages`, `--max-seconds`).
 *
 * The budget options have no yargs default, so passing one with ids can be refused.
 *
 * @param yargs - The command's yargs.
 * @returns The yargs, with the options added.
 */
export function msGraphCliMailSelectionOptions<T>(yargs: Argv<T>) {
  return yargs
    .option('folder', { type: 'string', describe: `Select from this folder (id or well-known name). Default: ${DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER}. Needs a filter, --search or --whole-folder` })
    .option('from', { type: 'string', describe: "Select: the sender's address" })
    .option('since', { type: 'string', describe: 'Select: received at or after this date/instant (ISO 8601)' })
    .option('until', { type: 'string', describe: 'Select: received before this date/instant (ISO 8601)' })
    .option('unread', { type: 'boolean', describe: 'Select: only unread messages' })
    .option('has-attachments', { type: 'boolean', describe: 'Select: only messages with file attachments' })
    .option('category', { type: 'string', describe: 'Select: only messages with this Outlook category' })
    .option('search', { type: 'string', describe: 'Select by a KQL query ($search) in --folder instead of the filters (Graph cannot combine the two). Re-run while complete is false' })
    .option('whole-folder', { type: 'boolean', describe: 'Select every message in the explicit --folder, with no filter' })
    .option('max-messages', { type: 'number', alias: 'limit', describe: `With a selection: the most messages this run acts on (default ${DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES}). When more match, the output says complete: false and remaining; re-run to continue` })
    .option('max-seconds', { type: 'number', describe: `With a selection: stop starting new $batch calls after this many seconds (default ${DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS}; 0 = no limit). Re-run to continue` });
}

function readIntegerOption(name: string, value: unknown, min: number): Maybe<number> {
  let result: Maybe<number>;

  if (value != null) {
    const number = Number(value);

    if (!Number.isInteger(number) || number < min) {
      throw new CliError({ message: `--${name} must be a whole number of at least ${min}.`, code: 'INVALID_ARGUMENT', suggestion: `e.g. --${name} ${Math.max(min, 1) * 100}` });
    }

    result = number;
  }

  return result;
}

/**
 * Reads a `--category` value: trimmed, not blank, at most {@link MSGRAPH_CLI_CATEGORY_MAX_LENGTH} characters.
 *
 * @param value - The raw option value.
 * @returns The category, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is blank or too long.
 */
export function readMsGraphCliCategoryOption(value: unknown): Maybe<string> {
  let result: Maybe<string>;

  if (value != null) {
    const category = String(value).trim();

    if (!category || category.length > MSGRAPH_CLI_CATEGORY_MAX_LENGTH) {
      throw new CliError({ message: `--category must be 1 to ${MSGRAPH_CLI_CATEGORY_MAX_LENGTH} characters.`, code: 'INVALID_ARGUMENT', suggestion: 'e.g. --category "msgraph-cli: delete"' });
    }

    result = category;
  }

  return result;
}

/**
 * Reads the selection options from the parsed arguments: dates parsed, the category checked, and the budget numbers
 * validated. Defaults are not applied, so an option the caller did not pass stays undefined.
 *
 * @param argv - The parsed arguments.
 * @returns The selection.
 * @throws {CliError} `INVALID_ARGUMENT` for a bad date, category or budget number.
 */
export function readMsGraphCliMailSelection(argv: Record<string, unknown>): MsGraphCliMailSelection {
  return {
    folder: argv['folder'] == null ? undefined : String(argv['folder']),
    from: argv['from'] == null ? undefined : String(argv['from']),
    since: parseMsGraphCliDateOption('since', argv['since']),
    until: parseMsGraphCliDateOption('until', argv['until']),
    unread: argv['unread'] === true ? true : undefined,
    hasAttachments: argv['hasAttachments'] === true ? true : undefined,
    category: readMsGraphCliCategoryOption(argv['category']),
    search: argv['search'] == null ? undefined : String(argv['search']),
    wholeFolder: argv['wholeFolder'] === true ? true : undefined,
    maxMessages: readIntegerOption('max-messages', argv['maxMessages'], 1),
    maxSeconds: readIntegerOption('max-seconds', argv['maxSeconds'], 0)
  };
}

/**
 * Input to {@link msGraphCliMailTargetMode}.
 */
export interface MsGraphCliMailTargetModeInput {
  /**
   * Whether ids were given: positional ids, or `--ids-file` (not read yet).
   */
  readonly hasIds: boolean;
  readonly selection: MsGraphCliMailSelection;
}

function hasListFilter(selection: MsGraphCliMailSelection): boolean {
  return Boolean(selection.from) || selection.since != null || selection.until != null || Boolean(selection.unread) || Boolean(selection.hasAttachments) || Boolean(selection.category);
}

/**
 * The suggestion of the `No ids given.` refusal on a command that also selects.
 */
export const MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION = 'Pass ids / --ids-file, or select in the same command: --folder inbox --from <address> (also --since, --until, --unread, --has-attachments, --category, --search).';

/**
 * Returns how a `mail delete` / `mail move` picks its messages, refusing option sets that are ambiguous or that
 * Graph cannot run. Runs before any Graph call.
 *
 * @param input - Whether ids were given, and the selection.
 * @returns `ids`, `list` (a filter, or `--whole-folder`) or `search`.
 * @throws {CliError} `INVALID_ARGUMENT` for ids mixed with a selection or a budget option, a blank `--search`,
 * `--search` with a filter or `--whole-folder`, `--whole-folder` without `--folder` or with a filter, `--folder` alone,
 * or nothing at all.
 */
export function msGraphCliMailTargetMode(input: MsGraphCliMailTargetModeInput): MsGraphCliMailTargetMode {
  const { hasIds, selection } = input;
  const filtered = hasListFilter(selection);
  const selecting = filtered || selection.folder != null || selection.search != null || Boolean(selection.wholeFolder);
  let result: MsGraphCliMailTargetMode;

  if (hasIds) {
    if (selecting || selection.maxMessages != null || selection.maxSeconds != null) {
      throw new CliError({
        message: 'Pass message ids or a selection (--folder, --from, …), not both.',
        code: 'INVALID_ARGUMENT',
        suggestion: 'Drop the ids to select by filter (re-run while complete is false), or drop --folder/--from/--search/--max-messages/--max-seconds to act on the ids.'
      });
    }

    result = 'ids';
  } else if (selection.search != null) {
    if (!selection.search.trim()) {
      throw new CliError({ message: '--search needs a query.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --search "invoice" or --search "from:ada@example.com"' });
    }

    if (filtered) {
      // Graph rejects $search combined with $filter on messages
      throw new CliError({
        message: '--search does not take --since, --until, --from, --unread, --has-attachments or --category: Graph cannot combine $search with a filter.',
        code: 'INVALID_ARGUMENT',
        suggestion: 'Put them in the query as KQL (from:ada@example.com received>=2026-11-01 category:"Vendors"), or drop --search to filter without searching.'
      });
    }

    if (selection.wholeFolder) {
      throw new CliError({ message: '--search does not take --whole-folder.', code: 'INVALID_ARGUMENT', suggestion: 'Drop --search to act on the whole --folder, or drop --whole-folder to act on the search hits.' });
    }

    result = 'search';
  } else if (selection.wholeFolder) {
    if (!selection.folder || filtered) {
      throw new CliError({ message: '--whole-folder needs an explicit --folder and no filter.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --folder <id> --whole-folder, or drop --whole-folder and select by --from/--since/….' });
    }

    result = 'list';
  } else if (filtered) {
    result = 'list';
  } else if (selection.folder == null) {
    throw new CliError({ message: 'No ids given.', code: 'INVALID_ARGUMENT', suggestion: MSGRAPH_CLI_MAIL_SELECTION_SUGGESTION });
  } else {
    throw new CliError({ message: '--folder alone would act on every message in it: add a filter (--from, --since, …) or --whole-folder.', code: 'INVALID_ARGUMENT', suggestion: 'e.g. --folder inbox --from noreply@example.com, or --folder <id> --whole-folder' });
  }

  return result;
}

// MARK: Folders
/**
 * Input to {@link checkMsGraphCliMailSelectionFolders} and {@link resolveMsGraphCliMailSelectionFolders}.
 */
export interface MsGraphCliMailSelectionFoldersInput {
  readonly command: MsGraphCliMailSelectionCommand;
  /**
   * The source folder as given; {@link DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER} when absent.
   */
  readonly folder?: Maybe<string>;
  /**
   * Delete: permanently (`permanentDelete`) instead of a move to Deleted Items.
   */
  readonly hard?: Maybe<boolean>;
  /**
   * Move: the destination folder as given.
   */
  readonly to?: Maybe<string>;
}

const SOFT_DELETE_FROM_DELETED_ITEMS_MESSAGE = 'A soft delete moves messages to Deleted Items; selecting from Deleted Items would re-move them in place and never finish.';
const SOFT_DELETE_FROM_DELETED_ITEMS_SUGGESTION = 'Use --hard to purge them (permanent), or `mail move --folder deleteditems … --to inbox` to restore them.';
const HARD_DELETE_OUTSIDE_DELETED_ITEMS_MESSAGE = 'A selected --hard delete only purges --folder deleteditems.';
const HARD_DELETE_OUTSIDE_DELETED_ITEMS_SUGGESTION = 'Soft-delete first (recoverable), then purge with --folder deleteditems --hard. Ids with --hard still work from any folder.';

function isSameFolderName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Checks a selection's folders by name, before any Graph call.
 *
 * - a soft delete never selects from `deleteditems`;
 * - a selected `--hard` delete only selects from `deleteditems` (refused here when the folder is absent or another
 *   well-known name; an id is checked after the pre-flight);
 * - a move never targets its own source.
 *
 * @param input - The command, folders and hard flag.
 * @throws {CliError} `INVALID_ARGUMENT` when a rule is broken.
 */
export function checkMsGraphCliMailSelectionFolders(input: MsGraphCliMailSelectionFoldersInput): void {
  const folder = input.folder ?? DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER;

  if (input.command === 'delete') {
    const fromDeletedItems = isSameFolderName(folder, MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER);

    if (input.hard) {
      if (!fromDeletedItems && MSGRAPH_CLI_WELL_KNOWN_MAIL_FOLDERS.has(folder.toLowerCase())) {
        throw new CliError({ message: HARD_DELETE_OUTSIDE_DELETED_ITEMS_MESSAGE, code: 'INVALID_ARGUMENT', suggestion: HARD_DELETE_OUTSIDE_DELETED_ITEMS_SUGGESTION });
      }
    } else if (fromDeletedItems) {
      throw new CliError({ message: SOFT_DELETE_FROM_DELETED_ITEMS_MESSAGE, code: 'INVALID_ARGUMENT', suggestion: SOFT_DELETE_FROM_DELETED_ITEMS_SUGGESTION });
    }
  } else if (input.to && isSameFolderName(folder, input.to)) {
    throw new CliError({ message: `--to ${input.to} is the folder being selected from.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass a different --to, or select from another --folder.' });
  }
}

/**
 * A selection's folders, as Graph resolved them.
 */
export interface MsGraphCliMailSelectionFolders {
  readonly source: MicrosoftGraphMailFolder;
  /**
   * Delete: Deleted Items. Move: the destination.
   */
  readonly target: MicrosoftGraphMailFolder;
}

/**
 * The GETs {@link resolveMsGraphCliMailSelectionFolders} sends: the source folder, then Deleted Items (delete) or
 * the destination (move).
 *
 * @param input - The mailbox, command and folders.
 * @returns The two requests.
 */
export function msGraphCliMailSelectionFolderRequests(input: MsGraphCliMailSelectionFoldersInput & { readonly mailbox?: Maybe<EmailAddress> }): [MicrosoftGraphMailRequest, MicrosoftGraphMailRequest] {
  const target = input.command === 'delete' ? MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER : String(input.to);
  return [microsoftGraphGetMailFolderRequest({ mailbox: input.mailbox, folder: input.folder ?? DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER }), microsoftGraphGetMailFolderRequest({ mailbox: input.mailbox, folder: target })];
}

async function readMsGraphCliMailFolder(read: ReturnType<typeof getMailFolder>, mailbox: Maybe<EmailAddress>, folder: string): Promise<MicrosoftGraphMailFolder> {
  let result: MicrosoftGraphMailFolder;

  try {
    result = await read({ mailbox, folder });
  } catch (e) {
    if (e instanceof MicrosoftGraphError && e.status === 404) {
      const where = mailbox ? ` in ${mailbox}` : '';
      throw new CliError({ message: `Mail folder "${folder}" was not found${where}.`, code: 'NOT_FOUND', suggestion: 'Pass a folder id or a well-known name (inbox, archive, deleteditems, junkemail, drafts, sentitems).' });
    }

    throw e;
  }

  return result;
}

/**
 * The selection pre-flight: reads the source folder and Deleted Items (delete) or the destination (move), then
 * applies the folder rules of {@link checkMsGraphCliMailSelectionFolders} by resolved id, which catches a folder
 * passed by id. A missing folder fails early with `NOT_FOUND`.
 *
 * @param graphContext - The Graph context.
 * @param input - The mailbox, command and folders.
 * @returns The resolved folders.
 * @throws {CliError} `NOT_FOUND` for a missing folder, `INVALID_ARGUMENT` when a folder rule is broken.
 */
export async function resolveMsGraphCliMailSelectionFolders(graphContext: MicrosoftGraphContext, input: MsGraphCliMailSelectionFoldersInput & { readonly mailbox?: Maybe<EmailAddress> }): Promise<MsGraphCliMailSelectionFolders> {
  const read = getMailFolder(graphContext);
  const source = await readMsGraphCliMailFolder(read, input.mailbox, input.folder ?? DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER);
  const target = await readMsGraphCliMailFolder(read, input.mailbox, input.command === 'delete' ? MICROSOFT_GRAPH_DELETED_ITEMS_FOLDER : String(input.to));
  const same = source.id === target.id;

  if (input.command === 'delete') {
    if (input.hard && !same) {
      throw new CliError({ message: HARD_DELETE_OUTSIDE_DELETED_ITEMS_MESSAGE, code: 'INVALID_ARGUMENT', suggestion: HARD_DELETE_OUTSIDE_DELETED_ITEMS_SUGGESTION });
    }

    if (!input.hard && same) {
      throw new CliError({ message: SOFT_DELETE_FROM_DELETED_ITEMS_MESSAGE, code: 'INVALID_ARGUMENT', suggestion: SOFT_DELETE_FROM_DELETED_ITEMS_SUGGESTION });
    }
  } else if (same) {
    throw new CliError({ message: `--to ${String(input.to)} is the folder being selected from.`, code: 'INVALID_ARGUMENT', suggestion: 'Pass a different --to, or select from another --folder.' });
  }

  return { source, target };
}

// MARK: Deadline
/**
 * A run's time budget.
 */
export interface MsGraphCliRunDeadline {
  /**
   * Whether the budget is spent. Always false without a budget.
   */
  readonly shouldStop: () => boolean;
  /**
   * The seconds left (at least 0), or undefined without a budget.
   */
  readonly secondsLeft: () => Maybe<Seconds>;
}

/**
 * Input to {@link msGraphCliRunDeadline}.
 */
export interface MsGraphCliRunDeadlineInput {
  /**
   * The budget in seconds; 0 or less means none.
   */
  readonly maxSeconds: Seconds;
  /**
   * When the run started (ms since the epoch).
   */
  readonly startedAt: Milliseconds;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => Milliseconds>;
}

/**
 * Builds a run's time budget, counted from `startedAt` (the handler's start, so it includes the token mint and
 * the pre-flight).
 *
 * @param input - The budget, the start and the clock.
 * @returns The deadline.
 */
export function msGraphCliRunDeadline(input: MsGraphCliRunDeadlineInput): MsGraphCliRunDeadline {
  const now = input.now ?? Date.now;
  const budget = input.maxSeconds > 0 ? input.maxSeconds * MS_IN_SECOND : undefined;

  return {
    shouldStop: () => budget != null && now() - input.startedAt >= budget,
    secondsLeft: () => (budget == null ? undefined : Math.max(0, (budget - (now() - input.startedAt)) / MS_IN_SECOND))
  };
}

/**
 * The longest `Retry-After` a selection run waits for: the seconds it has left, between 1 and
 * {@link MSGRAPH_CLI_SELECTION_MAX_RETRY_AFTER_SECONDS}.
 *
 * @param deadline - The run's deadline.
 * @returns The limit, or undefined (the `$batch` default) without a budget.
 */
export function msGraphCliSelectionMaxRetryAfterSeconds(deadline: MsGraphCliRunDeadline): Maybe<Seconds> {
  const left = deadline.secondsLeft();
  return left == null ? undefined : Math.min(MSGRAPH_CLI_SELECTION_MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.floor(left)));
}

// MARK: Collect
/**
 * Input to {@link collectMsGraphCliMailSelection}.
 */
export interface CollectMsGraphCliMailSelectionInput {
  readonly graphContext: MicrosoftGraphContext;
  readonly mode: Exclude<MsGraphCliMailTargetMode, 'ids'>;
  readonly selection: MsGraphCliMailSelection;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly immutableIds: boolean;
  /**
   * The most ids to collect.
   */
  readonly maxMessages: number;
  /**
   * Search mode: the pre-flight's source folder id. A hit in another folder (the search index can lag a move) is
   * dropped and counted in `stale`.
   */
  readonly sourceFolderId?: Maybe<string>;
  /**
   * Checked between pages; the first page is always read.
   */
  readonly shouldStop?: Maybe<() => boolean>;
}

/**
 * The ids a selection collected, and what it knows of the rest.
 */
export interface MsGraphCliMailSelectionCollected {
  /**
   * The first listing GET, for `--dry-run`.
   */
  readonly request: MicrosoftGraphMailRequest;
  /**
   * The ids to act on, at most `maxMessages`.
   */
  readonly ids: string[];
  /**
   * How many messages match: Graph's `@odata.count` when `counted`, else how many were found.
   */
  readonly matched: number;
  /**
   * Whether `matched` is Graph's count of the whole selection.
   */
  readonly counted: boolean;
  /**
   * Set when the collection did not reach the end of the selection.
   */
  readonly stopped?: Maybe<MsGraphCliMailSelectionStop>;
  /**
   * Search hits dropped because they are no longer in the source folder.
   */
  readonly stale: number;
}

/**
 * The listing GET of a selection: `$select=id` (plus `parentFolderId` for a search), from the source folder, with
 * `$count=true` and `$top` up to {@link MICROSOFT_GRAPH_MESSAGE_MAX_PAGE_SIZE} for a list.
 *
 * @param input - The mode, selection, mailbox and cap.
 * @returns The first page's request.
 */
export function msGraphCliMailSelectionListingRequest(input: Pick<CollectMsGraphCliMailSelectionInput, 'mode' | 'selection' | 'mailbox' | 'immutableIds' | 'maxMessages'>): MicrosoftGraphMailRequest {
  const { selection, mailbox, immutableIds } = input;
  const folder = selection.folder ?? DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER;
  let result: MicrosoftGraphMailRequest;

  if (input.mode === 'search') {
    result = microsoftGraphSearchMessagesRequest({ query: selection.search ?? '', folder, mailbox, immutableIds, select: 'id,parentFolderId', top: MSGRAPH_CLI_SELECTION_SEARCH_PAGE_SIZE });
  } else {
    result = microsoftGraphListMessagesRequest({
      mailbox,
      immutableIds,
      folder,
      since: selection.since,
      until: selection.until,
      from: selection.from,
      unread: selection.unread,
      hasAttachments: selection.hasAttachments,
      category: selection.category,
      select: 'id',
      top: Math.min(MICROSOFT_GRAPH_MESSAGE_MAX_PAGE_SIZE, input.maxMessages),
      count: true
    });
  }

  return result;
}

/**
 * Collects the ids of a selection BEFORE anything is written: offset paging would skip messages if the folder
 * changed between pages. Follows `@odata.nextLink` until `maxMessages` ids are collected, the selection ends, or
 * `shouldStop` says the time is up (checked between pages).
 *
 * A search reports `stopped: 'search-cap'` once it found {@link MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT} hits,
 * since Graph may have cut it short without saying so.
 *
 * @param input - The Graph context, mode, selection and limits.
 * @returns The ids and what is known of the rest.
 */
export async function collectMsGraphCliMailSelection(input: CollectMsGraphCliMailSelectionInput): Promise<MsGraphCliMailSelectionCollected> {
  const request = msGraphCliMailSelectionListingRequest(input);
  const get = microsoftGraphRequest(input.graphContext);
  const ids: string[] = [];
  let count: Maybe<number>;
  let found = 0;
  let hits = 0;
  let stale = 0;
  let link: Maybe<string>;
  let first = true;
  let stopped: Maybe<MsGraphCliMailSelectionStop>;

  while (first || link) {
    const page: MicrosoftGraphPage<Pick<MicrosoftGraphMessage, 'id' | 'parentFolderId'>> = first ? await get({ method: 'GET', ...request }) : await get({ method: 'GET', path: link as string, headers: request.headers });

    if (first && page['@odata.count'] != null) {
      count = page['@odata.count'];
    }

    first = false;

    for (const message of page.value ?? []) {
      hits += 1;

      if (input.mode === 'search' && input.sourceFolderId && message.parentFolderId && message.parentFolderId !== input.sourceFolderId) {
        stale += 1;
      } else {
        found += 1;

        if (ids.length < input.maxMessages) {
          ids.push(message.id);
        }
      }
    }

    link = page['@odata.nextLink'];

    if (found > ids.length || (link && ids.length >= input.maxMessages)) {
      stopped = 'max-messages';
      link = undefined;
    } else if (link && input.shouldStop?.()) {
      stopped = 'max-seconds';
      link = undefined;
    }
  }

  if (!stopped && input.mode === 'search' && hits >= MSGRAPH_CLI_MAIL_SEARCH_MAY_TRUNCATE_AT) {
    stopped = 'search-cap';
  }

  return { request, ids, matched: count ?? found, counted: count != null, ...(stopped ? { stopped } : {}), stale };
}

// MARK: Output
/**
 * A folder in a selection's output.
 */
export interface MsGraphCliMailSelectionFolderOutput {
  readonly id: string;
  readonly name?: Maybe<string>;
}

/**
 * What a selection's counts add to its output.
 */
export interface MsGraphCliMailSelectionSummary {
  /**
   * How many messages match (Graph's count for a list; how many were found for a search).
   */
  readonly matched: number;
  /**
   * Whether the selection was exhausted: every match was acted on (or attempted; failures are in `failed`).
   */
  readonly complete: boolean;
  /**
   * Why the run stopped early; only when `complete` is false.
   */
  readonly stopped?: MsGraphCliMailSelectionStop;
  /**
   * How many matches this run left; only when Graph counted the selection and `complete` is false.
   */
  readonly remaining?: number;
  /**
   * The source folder.
   */
  readonly folder: MsGraphCliMailSelectionFolderOutput;
  /**
   * A move's destination.
   */
  readonly to?: MsGraphCliMailSelectionFolderOutput;
  /**
   * Search hits dropped because they had left the source folder; only when above 0.
   */
  readonly stale?: number;
}

/**
 * What a selected move or delete prints: the per-id results of the id path plus the selection's counts.
 */
export type MsGraphCliMailSelectionWriteOutput = MsGraphCliWriteResultsOutput & MsGraphCliMailSelectionSummary;

/**
 * What a selected move or delete prints with `--dry-run`.
 */
export type MsGraphCliMailSelectionDryRunOutput = MsGraphCliDryRunOutput &
  MsGraphCliMailSelectionSummary & {
    /**
     * How many messages a real run would act on (at most `--max-messages`).
     */
    readonly toAct: number;
  };

/**
 * Input to {@link msGraphCliMailSelectionSummary}.
 */
export interface MsGraphCliMailSelectionSummaryInput {
  readonly collected: Pick<MsGraphCliMailSelectionCollected, 'matched' | 'counted' | 'stopped' | 'stale'>;
  readonly folders: MsGraphCliMailSelectionFolders;
  readonly command: MsGraphCliMailSelectionCommand;
  /**
   * How many messages were attempted (sent, ok or not).
   */
  readonly attempted: number;
  /**
   * How many were collected.
   */
  readonly collectedCount: number;
}

function folderOutput(folder: MicrosoftGraphMailFolder): MsGraphCliMailSelectionFolderOutput {
  return { id: folder.id, ...(folder.displayName ? { name: folder.displayName } : {}) };
}

/**
 * Builds the selection fields of a run's output. `complete` is true only when the collection reached the end and
 * every collected message was attempted; a run the time budget cut short reports `stopped: 'max-seconds'`.
 *
 * @param input - What was collected and attempted, and the folders.
 * @returns The summary.
 */
export function msGraphCliMailSelectionSummary(input: MsGraphCliMailSelectionSummaryInput): MsGraphCliMailSelectionSummary {
  const { collected, folders, attempted, collectedCount } = input;
  const stopped: Maybe<MsGraphCliMailSelectionStop> = collected.stopped ?? (attempted < collectedCount ? 'max-seconds' : undefined);
  const complete = stopped == null;

  return {
    matched: collected.matched,
    complete,
    ...(stopped ? { stopped } : {}),
    ...(!complete && collected.counted ? { remaining: Math.max(0, collected.matched - attempted) } : {}),
    folder: folderOutput(folders.source),
    ...(input.command === 'move' ? { to: folderOutput(folders.target) } : {}),
    ...(collected.stale > 0 ? { stale: collected.stale } : {})
  };
}

/**
 * Builds what a selected move or delete prints.
 *
 * @param results - The per-id results.
 * @param summary - The selection fields, from {@link msGraphCliMailSelectionSummary}.
 * @param maxRows - Above this many results only the failed rows are listed; unset lists every row.
 * @returns The output.
 */
export function msGraphCliMailSelectionWriteOutput(results: readonly MicrosoftGraphMessageWriteResult[], summary: MsGraphCliMailSelectionSummary, maxRows: Maybe<number>): MsGraphCliMailSelectionWriteOutput {
  return { ...msGraphCliWriteResultsOutput(results, { maxRows }), ...summary };
}

/**
 * Input to {@link msGraphCliMailSelectionDryRunOutput}.
 */
export interface MsGraphCliMailSelectionDryRunOutputInput {
  readonly collected: MsGraphCliMailSelectionCollected;
  readonly folders: MsGraphCliMailSelectionFolders;
  readonly command: MsGraphCliMailSelectionCommand;
  /**
   * Builds the write request for one id.
   */
  readonly writeRequest: (id: string) => MicrosoftGraphRequestInput;
  /**
   * The verb for the note, e.g. `deletes`, `permanently deletes` or `moves`.
   */
  readonly verb: string;
  readonly maxMessages: number;
}

/**
 * Builds what a selection's `--dry-run` prints: the listing GET (which ran, read only) and the first
 * {@link MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE} write requests, with the counts a real run would act on.
 *
 * @param input - What was collected, the folders and the request builder.
 * @returns The output.
 */
export function msGraphCliMailSelectionDryRunOutput(input: MsGraphCliMailSelectionDryRunOutputInput): MsGraphCliMailSelectionDryRunOutput {
  const { collected, folders } = input;
  const toAct = collected.ids.length;
  const folderName = folders.source.displayName ?? folders.source.id;
  const sample = collected.ids.slice(0, MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE).map(input.writeRequest);
  const shown = toAct > sample.length ? `; only the first ${sample.length} of ${toAct} requests are shown` : '';
  const note = `The listing GET ran (read only) and matched ${collected.matched} in ${folderName}. A real run ${input.verb} ${toAct} (max ${input.maxMessages}) through $batch, ${MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE} per HTTP call${shown}.`;
  const summary = msGraphCliMailSelectionSummary({ collected, folders, command: input.command, attempted: toAct, collectedCount: toAct });

  return { ...msGraphCliDryRunOutput([{ method: 'GET', ...collected.request }, ...sample], note), ...summary, toAct };
}

// MARK: Run
/**
 * Input to {@link runMsGraphCliMailSelectionWrite}.
 */
export interface RunMsGraphCliMailSelectionWriteInput extends Pick<MsGraphCliMailSelectionFoldersInput, 'command' | 'hard' | 'to'> {
  readonly graphContext: MicrosoftGraphContext;
  readonly mode: Exclude<MsGraphCliMailTargetMode, 'ids'>;
  readonly selection: MsGraphCliMailSelection;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly immutableIds: boolean;
  /**
   * Run the reads (pre-flight and listing) and print the counts and a sample of the writes, writing nothing.
   */
  readonly dryRun?: Maybe<boolean>;
  /**
   * When the command started; the time budget counts from here.
   */
  readonly startedAt: Milliseconds;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => Milliseconds>;
  /**
   * The command, for the progress lines, e.g. `mail delete`.
   */
  readonly label: string;
  /**
   * The verb for the dry-run note, e.g. `deletes`.
   */
  readonly verb: string;
  /**
   * Builds the write request for one id (the dry-run sample).
   */
  readonly writeRequest: (id: string) => MicrosoftGraphRequestInput;
  /**
   * Sends one group of writes, waiting at most `maxRetryAfterSeconds` for a throttled item.
   */
  readonly send: (ids: string[], maxRetryAfterSeconds: Maybe<Seconds>) => Promise<MicrosoftGraphMessageWriteResult[]>;
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Above this many results only the failed rows are listed; unset lists every row.
   */
  readonly maxRows?: Maybe<number>;
}

/**
 * Runs a selected move or delete: the folder pre-flight, the collection of ids (before acting), then the writes in
 * `$batch` calls of {@link MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE}, within `--max-messages` and `--max-seconds`.
 * With `dryRun`, only the reads run.
 *
 * @param input - The selection, the Graph context and the write sender.
 * @returns The output to print.
 */
export async function runMsGraphCliMailSelectionWrite(input: RunMsGraphCliMailSelectionWriteInput): Promise<MsGraphCliMailSelectionWriteOutput | MsGraphCliMailSelectionDryRunOutput> {
  const { graphContext, mode, selection, mailbox, immutableIds, command } = input;
  const maxMessages = selection.maxMessages ?? DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES;
  const deadline = msGraphCliRunDeadline({ maxSeconds: selection.maxSeconds ?? DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS, startedAt: input.startedAt, now: input.now });
  const folders = await resolveMsGraphCliMailSelectionFolders(graphContext, { command, folder: selection.folder, hard: input.hard, to: input.to, mailbox });
  const collected = await collectMsGraphCliMailSelection({ graphContext, mode, selection, mailbox, immutableIds, maxMessages, sourceFolderId: folders.source.id, shouldStop: deadline.shouldStop });
  let result: MsGraphCliMailSelectionWriteOutput | MsGraphCliMailSelectionDryRunOutput;

  if (input.dryRun) {
    result = msGraphCliMailSelectionDryRunOutput({ collected, folders, command, writeRequest: input.writeRequest, verb: input.verb, maxMessages });
  } else {
    const results = await runMsGraphCliMessageWrites({
      ids: collected.ids,
      label: input.label,
      progress: input.progress,
      groupSize: MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE,
      shouldStop: deadline.shouldStop,
      send: (group) => input.send(group, msGraphCliSelectionMaxRetryAfterSeconds(deadline))
    });

    const summary = msGraphCliMailSelectionSummary({ collected, folders, command, attempted: results.length, collectedCount: collected.ids.length });
    result = msGraphCliMailSelectionWriteOutput(results, summary, input.maxRows);
  }

  return result;
}

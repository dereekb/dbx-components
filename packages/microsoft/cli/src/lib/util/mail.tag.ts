import { type MicrosoftGraphContext, type MicrosoftGraphMessageCategoriesItem, type MicrosoftGraphMessageWriteResult, getMessages, microsoftGraphUpdateMessageCategoriesRequest, updateMessagesCategories } from '@dereekb/microsoft';
import { type EmailAddress, type Maybe, type Milliseconds } from '@dereekb/util';
import {
  DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER,
  DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES,
  DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS,
  MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE,
  MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE,
  type MsGraphCliMailSelection,
  type MsGraphCliMailSelectionFolderOutput,
  type MsGraphCliMailSelectionItem,
  type MsGraphCliMailSelectionSummary,
  type MsGraphCliMailTargetMode,
  collectMsGraphCliMailSelection,
  msGraphCliHasCategory,
  msGraphCliMailSelectionSummary,
  msGraphCliRunDeadline,
  msGraphCliSelectionMaxRetryAfterSeconds
} from './mail.select';
import { type MsGraphCliDryRunOutput, type MsGraphCliWriteResultsOutput, msGraphCliDryRunOutput, msGraphCliWriteResultsOutput, runMsGraphCliMessageWrites } from './mail.write';

// MARK: Categories
/**
 * Whether `mail tag` adds the category or `mail untag` removes it.
 */
export type MsGraphCliMailTagMode = 'tag' | 'untag';

/**
 * A category list with `name` added at the end, unless it is already there (compared case-insensitively, as
 * Outlook does). The existing order is kept.
 *
 * @param existing - The message's categories.
 * @param name - The category to add.
 * @returns The new list.
 */
export function msGraphCliCategoriesWith(existing: Maybe<readonly string[]>, name: string): string[] {
  const list = [...(existing ?? [])];
  return msGraphCliHasCategory(list, name) ? list : [...list, name];
}

/**
 * A category list without `name` (compared case-insensitively). The existing order is kept.
 *
 * @param existing - The message's categories.
 * @param name - The category to remove.
 * @returns The new list.
 */
export function msGraphCliCategoriesWithout(existing: Maybe<readonly string[]>, name: string): string[] {
  const lower = name.toLowerCase();
  return (existing ?? []).filter((x) => x.toLowerCase() !== lower);
}

/**
 * The PATCHes a tag or untag sends, and the messages it skips.
 */
export interface MsGraphCliMailTagPlan {
  /**
   * One item per message to change, with its whole new category list.
   */
  readonly toChange: MicrosoftGraphMessageCategoriesItem[];
  /**
   * Tag: messages that already carry the category.
   */
  readonly alreadyTagged: number;
  /**
   * Untag: messages that do not carry the category.
   */
  readonly notTagged: number;
}

/**
 * Input to {@link planMsGraphCliMailTag}.
 */
export interface PlanMsGraphCliMailTagInput {
  readonly mode: MsGraphCliMailTagMode;
  readonly name: string;
  readonly items: readonly MsGraphCliMailSelectionItem[];
}

/**
 * Plans a tag or untag: each message's new category list, skipping those already tagged (tag) or not tagged (untag).
 *
 * @param input - The mode, the category and the messages with their current categories.
 * @returns The plan.
 */
export function planMsGraphCliMailTag(input: PlanMsGraphCliMailTagInput): MsGraphCliMailTagPlan {
  const { mode, name } = input;
  const toChange: MicrosoftGraphMessageCategoriesItem[] = [];
  let alreadyTagged = 0;
  let notTagged = 0;

  for (const item of input.items) {
    const has = msGraphCliHasCategory(item.categories, name);

    if (mode === 'tag' && has) {
      alreadyTagged += 1;
    } else if (mode === 'untag' && !has) {
      notTagged += 1;
    } else {
      toChange.push({ id: item.id, categories: mode === 'tag' ? msGraphCliCategoriesWith(item.categories, name) : msGraphCliCategoriesWithout(item.categories, name) });
    }
  }

  return { toChange, alreadyTagged, notTagged };
}

// MARK: Run
/**
 * Input to {@link runMsGraphCliMailTag}.
 */
export interface RunMsGraphCliMailTagInput {
  readonly graphContext: MicrosoftGraphContext;
  readonly mode: MsGraphCliMailTagMode;
  /**
   * The category to add or remove.
   */
  readonly name: string;
  readonly target: MsGraphCliMailTargetMode;
  /**
   * The ids, for the `ids` target.
   */
  readonly ids?: Maybe<readonly string[]>;
  /**
   * The selection, for the `list` / `search` targets, without the category: the run adds the untag filter itself.
   */
  readonly selection: MsGraphCliMailSelection;
  readonly mailbox?: Maybe<EmailAddress>;
  readonly immutableIds: boolean;
  readonly dryRun?: Maybe<boolean>;
  readonly startedAt: Milliseconds;
  /**
   * The clock. Defaults to `Date.now`; a spec passes a fake.
   */
  readonly now?: Maybe<() => Milliseconds>;
  readonly progress?: Maybe<(line: string) => void>;
  /**
   * Above this many results only the failed rows are listed; unset lists every row.
   */
  readonly maxRows?: Maybe<number>;
}

/**
 * The counts a tag or untag adds to its output.
 */
export type MsGraphCliMailTagSummary = Partial<MsGraphCliMailSelectionSummary> & {
  readonly alreadyTagged?: number;
  readonly notTagged?: number;
};

/**
 * What `mail tag` / `mail untag` prints.
 */
export type MsGraphCliMailTagOutput = (MsGraphCliWriteResultsOutput & MsGraphCliMailTagSummary) | (MsGraphCliDryRunOutput & MsGraphCliMailTagSummary & { readonly toAct: number });

function skipped(plan: Pick<MsGraphCliMailTagPlan, 'alreadyTagged' | 'notTagged'>) {
  return { ...(plan.alreadyTagged > 0 ? { alreadyTagged: plan.alreadyTagged } : {}), ...(plan.notTagged > 0 ? { notTagged: plan.notTagged } : {}) };
}

function withoutMessage(results: readonly MicrosoftGraphMessageWriteResult[]): MicrosoftGraphMessageWriteResult[] {
  // a PATCH answers the same message, so its id is not a new id
  return results.map((x) => ({ id: x.id, status: x.status, ...(x.error ? { error: x.error } : {}) }));
}

interface DryRunNoteInput {
  readonly mode: MsGraphCliMailTagMode;
  readonly name: string;
  readonly count: number;
  readonly sampled: number;
}

function dryRunNote({ mode, name, count, sampled }: DryRunNoteInput): string {
  const verb = mode === 'tag' ? 'adds' : 'removes';
  const shown = count > sampled ? `; only the first ${sampled} of ${count} requests are shown` : '';
  return `A real run ${verb} "${name}" on ${count} message(s), one PATCH each through $batch, ${MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE} per HTTP call${shown}.`;
}

/**
 * Runs `mail tag` / `mail untag`: reads each message's categories (from the listing, or a `$batch` GET per id),
 * plans the new lists, then PATCHes the messages that change. A selection is collected first, within
 * `--max-messages` and `--max-seconds`; a tag skips messages that already carry the category and keeps paging, and
 * an untag always filters by the category (every folder unless `--folder`), so re-running continues either way.
 *
 * @param input - The mode, category, target and Graph context.
 * @returns The output to print.
 */
export async function runMsGraphCliMailTag(input: RunMsGraphCliMailTagInput): Promise<MsGraphCliMailTagOutput> {
  const { graphContext, mode, name, mailbox, immutableIds } = input;
  const patch = (item: MicrosoftGraphMessageCategoriesItem) => microsoftGraphUpdateMessageCategoriesRequest({ mailbox, immutableIds, ...item });
  let result: MsGraphCliMailTagOutput;

  if (input.target === 'ids') {
    const ids = input.ids ?? [];
    const read = await getMessages(graphContext)({ mailbox, immutableIds, ids, select: 'id,categories' });
    const readFailed: MicrosoftGraphMessageWriteResult[] = read.filter((x) => !x.message).map((x) => ({ id: x.id, status: x.status, error: x.error }));
    const plan = planMsGraphCliMailTag({ mode, name, items: read.filter((x) => x.message).map((x) => ({ id: x.id, categories: x.message?.categories ?? [] })) });

    if (input.dryRun) {
      const sample = plan.toChange.slice(0, MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE).map(patch);
      const unread = readFailed.length > 0 ? ` ${readFailed.length} id(s) could not be read.` : '';
      result = { ...msGraphCliDryRunOutput(sample, `The category GETs ran (read only). ${dryRunNote({ mode, name, count: plan.toChange.length, sampled: sample.length })}${unread}`), toAct: plan.toChange.length, ...skipped(plan) };
    } else {
      const byId = new Map(plan.toChange.map((x) => [x.id, x]));
      const results = await runMsGraphCliMessageWrites({
        ids: plan.toChange.map((x) => x.id),
        label: `mail ${mode}`,
        progress: input.progress,
        send: (group) => updateMessagesCategories(graphContext)({ mailbox, immutableIds, items: group.map((id) => byId.get(id) as MicrosoftGraphMessageCategoriesItem) })
      });

      result = { ...msGraphCliWriteResultsOutput([...withoutMessage(results), ...readFailed], { maxRows: input.maxRows }), ...skipped(plan) };
    }
  } else {
    const { selection } = input;
    const maxMessages = selection.maxMessages ?? DEFAULT_MSGRAPH_CLI_SELECTION_MAX_MESSAGES;
    const deadline = msGraphCliRunDeadline({ maxSeconds: selection.maxSeconds ?? DEFAULT_MSGRAPH_CLI_SELECTION_MAX_SECONDS, startedAt: input.startedAt, now: input.now });
    const untag = mode === 'untag';
    const collected = await collectMsGraphCliMailSelection({
      graphContext,
      mode: input.target,
      // an untag always selects by its category
      selection: { ...selection, category: untag ? name : undefined },
      mailbox,
      immutableIds,
      maxMessages,
      allFolders: untag,
      categories: { name, mode },
      shouldStop: deadline.shouldStop
    });

    const plan = planMsGraphCliMailTag({ mode, name, items: collected.items ?? [] });
    const counts = { ...collected, alreadyTagged: collected.alreadyTagged + plan.alreadyTagged };
    // an untag with no --folder reads every folder
    const folderId = selection.folder ?? (untag ? undefined : DEFAULT_MSGRAPH_CLI_SELECTION_FOLDER);
    const folder: Maybe<MsGraphCliMailSelectionFolderOutput> = folderId ? { id: folderId } : undefined;

    if (input.dryRun) {
      const sample = plan.toChange.slice(0, MSGRAPH_CLI_SELECTION_DRY_RUN_SAMPLE).map(patch);
      const where = folder ? `in ${folder.id}` : 'in every folder';
      const summary = msGraphCliMailSelectionSummary({ collected: counts, folder, command: mode, attempted: plan.toChange.length, collectedCount: plan.toChange.length });
      result = {
        ...msGraphCliDryRunOutput([{ method: 'GET', ...collected.request }, ...sample], `The listing GET ran (read only) and matched ${collected.matched} ${where}. ${dryRunNote({ mode, name, count: plan.toChange.length, sampled: sample.length })}`),
        ...summary,
        ...skipped({ alreadyTagged: 0, notTagged: plan.notTagged }),
        toAct: plan.toChange.length
      };
    } else {
      const byId = new Map(plan.toChange.map((x) => [x.id, x]));
      const results = await runMsGraphCliMessageWrites({
        ids: plan.toChange.map((x) => x.id),
        label: `mail ${mode}`,
        progress: input.progress,
        groupSize: MSGRAPH_CLI_SELECTION_WRITE_GROUP_SIZE,
        shouldStop: deadline.shouldStop,
        send: (group) => updateMessagesCategories(graphContext)({ mailbox, immutableIds, items: group.map((id) => byId.get(id) as MicrosoftGraphMessageCategoriesItem), maxRetryAfterSeconds: msGraphCliSelectionMaxRetryAfterSeconds(deadline) })
      });

      const summary = msGraphCliMailSelectionSummary({ collected: counts, folder, command: mode, attempted: results.length, collectedCount: plan.toChange.length });
      result = { ...msGraphCliWriteResultsOutput(withoutMessage(results), { maxRows: input.maxRows }), ...summary, ...skipped({ alreadyTagged: 0, notTagged: plan.notTagged }) };
    }
  }

  return result;
}

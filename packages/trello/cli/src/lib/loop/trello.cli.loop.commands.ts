import { CliError, getCliOutputWriter } from '@dereekb/dbx-cli';
import {
  type ListBoardCardsInput,
  type TrelloAction,
  type TrelloActionAuthorIdentity,
  type TrelloActionType,
  type TrelloCardId,
  type TrelloCommentCardActionData,
  TRELLO_MAX_PAGE_LIMIT,
  diffTrelloBoardSnapshots,
  extractTrelloCardShortLinks,
  fetchTrelloBoardSnapshot,
  findTrelloMentions,
  getCard,
  listCardActions,
  listTrelloBoardActivitySince,
  parseTrelloCardRef,
  renderTrelloCardMarkdown,
  resolveTrelloBoardNames
} from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { parseTrelloCliCardArg, parseTrelloCliListOption, withTrelloCliCardPositional } from '../util/option';
import { type TrelloCardAttachmentSync, syncTrelloCardAttachments, trelloCliBoardStateStore, writeMarkdownPreservingBlocks } from './trello.cli.loop.fs';

/**
 * The card filters `board snapshot` / `board changes` accept.
 */
export const TRELLO_CLI_SNAPSHOT_CARD_FILTERS: readonly NonNullable<ListBoardCardsInput['filter']>[] = ['visible', 'open', 'closed', 'all'];

/**
 * The name of the preserved block `card render` writes: notes written inside it survive a re-render with `--out`.
 */
export const TRELLO_CLI_CARD_RENDER_NOTES_BLOCK = 'notes';

/**
 * How many comments `card render` includes by default.
 */
export const DEFAULT_TRELLO_CLI_CARD_RENDER_COMMENTS_LIMIT = 50;

/**
 * Resolves the board's saved-state store for the run.
 *
 * @param ctx - The run's context.
 * @returns The board id and its store.
 */
function boardStateStore(ctx: TrelloCliContext) {
  const boardId = ctx.requireBoard();
  return { boardId, store: trelloCliBoardStateStore({ stateDir: ctx.stateDir(), boardId }) };
}

/**
 * Who `--include-self` filters out: the authenticated member.
 *
 * @param ctx - The run's context.
 * @param includeSelf - Whether to keep the member's own comments.
 * @returns The identity to exclude, or undefined.
 */
async function selfExclusion(ctx: TrelloCliContext, includeSelf: boolean): Promise<Maybe<TrelloActionAuthorIdentity>> {
  return includeSelf ? undefined : { memberIds: [(await ctx.me()).id] };
}

/**
 * The username mentions are searched for: `--username`, or the authenticated member's.
 *
 * @param ctx - The run's context.
 * @param value - The `--username` value.
 * @returns The username, without a leading `@`.
 */
async function mentionUsername(ctx: TrelloCliContext, value: unknown): Promise<string> {
  const given = typeof value === 'string' ? value.trim().replace(/^@/, '') : '';
  return given || (await ctx.me()).username;
}

const snapshotCommand: TrelloCliCommand = {
  command: 'snapshot',
  describe: "Capture the board's lists, labels and card fingerprints (--save stores it for board changes)",
  requires: 'board',
  builder: (yargs: Argv) =>
    yargs
      .option('save', { type: 'boolean', default: false, describe: 'Store the snapshot as the baseline `board changes` compares against' })
      .option('card-filter', { type: 'string', choices: [...TRELLO_CLI_SNAPSHOT_CARD_FILTERS], default: 'visible', describe: 'Which cards to capture (all keeps archived cards, so archiving reports as closed)' }),
  handler: async (argv, ctx) => {
    const { boardId, store } = boardStateStore(ctx);
    const snapshot = await fetchTrelloBoardSnapshot({ trelloContext: ctx.trelloContext, boardId, cardFilter: argv['card-filter'] as 'visible', now: () => ctx.now() });

    if (argv['save']) {
      await store.update((current) => ({ ...current, snapshot }));
    }

    ctx.output.result(snapshot, argv['save'] ? { saved: store.filePath } : undefined);
  }
};

const changesCommand: TrelloCliCommand = {
  command: 'changes',
  describe: 'Diff the board against the saved snapshot: added, removed, closed, reopened, moved, relabeled, renamed, commented',
  requires: 'board',
  builder: (yargs: Argv) =>
    yargs
      .option('save', { type: 'boolean', default: false, describe: 'Store the fresh snapshot as the new baseline' })
      .option('ndjson', { type: 'boolean', default: false, describe: 'Print one change per line instead of the envelope' })
      .option('card-filter', { type: 'string', choices: [...TRELLO_CLI_SNAPSHOT_CARD_FILTERS], describe: "Which cards to capture. Defaults to the saved snapshot's filter, else visible" })
      .example([
        ['$0 board changes --save', 'Report what changed since the last run and move the baseline forward'],
        ['$0 board changes --save --ndjson', 'The same, one JSON change per line']
      ]),
  handler: async (argv, ctx) => {
    const { boardId, store } = boardStateStore(ctx);
    const previous = (await store.read())?.snapshot;
    const cardFilter = (argv['card-filter'] as Maybe<NonNullable<ListBoardCardsInput['filter']>>) ?? previous?.cardFilter ?? 'visible';
    const next = await fetchTrelloBoardSnapshot({ trelloContext: ctx.trelloContext, boardId, cardFilter, now: () => ctx.now() });
    const comparable = previous?.cardFilter === cardFilter ? previous : undefined;
    const diff = diffTrelloBoardSnapshots(comparable, next);
    let baseline: 'none' | 'filter-changed' | 'saved' = 'saved';

    if (previous == null) {
      baseline = 'none';
    } else if (comparable == null) {
      baseline = 'filter-changed';
    }

    if (argv['save']) {
      await store.update((current) => ({ ...current, snapshot: next }));
    }

    if (argv['ndjson']) {
      ctx.output.ndjson(diff.changes);
    } else {
      ctx.output.result({ ...diff, baseline, saved: argv['save'] === true });
    }
  }
};

const activityCommand: TrelloCliCommand = {
  command: 'activity',
  describe: "List the board's actions since a watermark (--save reads and stores it)",
  requires: 'board',
  builder: (yargs: Argv) =>
    yargs
      .option('since', { type: 'string', describe: 'An action id or an ISO 8601 date; only newer actions are returned (overrides the saved watermark)' })
      .option('save', { type: 'boolean', default: false, describe: 'Start from the saved watermark and store the new one' })
      .option('filter', { type: 'string', describe: 'Comma-separated action types, e.g. commentCard,updateCard:idList' })
      .option('max-pages', { type: 'number', describe: 'The most requests to make (default 5); the result is truncated when hit' }),
  handler: async (argv, ctx) => {
    const { boardId, store } = boardStateStore(ctx);
    const saved = argv['save'] ? (await store.read())?.activityWatermark : undefined;
    const since = (argv['since'] as Maybe<string>) || saved || undefined;
    const activity = await listTrelloBoardActivitySince({ trelloContext: ctx.trelloContext, boardId, since, filter: argv['filter'] as Maybe<TrelloActionType>, maxPages: argv['max-pages'] as Maybe<number> });

    if (argv['save'] && activity.watermark != null) {
      await store.update((current) => ({ ...current, activityWatermark: activity.watermark }));
    }

    ctx.output.result({ boardId, since: since ?? null, ...activity });
  }
};

const boardMentionsCommand: TrelloCliCommand = {
  command: 'mentions',
  describe: 'Find comments on the board that @-mention a member (default: you)',
  requires: 'board',
  builder: (yargs: Argv) =>
    yargs
      .option('username', { type: 'string', describe: 'The member to find mentions of. Defaults to the authenticated member' })
      .option('save', { type: 'boolean', default: false, describe: 'Only report mentions newer than the saved watermark, and store the newest' })
      .option('include-self', { type: 'boolean', default: false, describe: "Keep comments the authenticated member wrote (skipped by default, so the member's own replies never count)" })
      .option('max-pages', { type: 'number', describe: 'The most requests to make (default 5)' }),
  handler: async (argv, ctx) => {
    const { boardId, store } = boardStateStore(ctx);
    const username = await mentionUsername(ctx, argv['username']);
    const afterActionId = argv['save'] ? (await store.read())?.mentionWatermark : undefined;
    const activity = await listTrelloBoardActivitySince<Partial<TrelloCommentCardActionData>>({ trelloContext: ctx.trelloContext, boardId, since: afterActionId, filter: 'commentCard', maxPages: argv['max-pages'] as Maybe<number> });
    const found = findTrelloMentions({ actions: activity.actions as readonly TrelloAction<unknown>[], username, exclude: await selfExclusion(ctx, argv['include-self'] === true), afterActionId });

    if (argv['save'] && found.newestMentionId != null) {
      await store.update((current) => ({ ...current, mentionWatermark: found.newestMentionId }));
    }

    ctx.output.result({ boardId, username, ...found, truncated: activity.truncated });
  }
};

const resolveCommand: TrelloCliCommand = {
  command: 'resolve',
  describe: 'Resolve list and label names (case-insensitive, ignoring a trailing "(…)") to ids; fails on any unknown or ambiguous name',
  requires: 'board',
  builder: (yargs: Argv) => yargs.option('list', { type: 'string', describe: 'Comma-separated list names or ids' }).option('label', { type: 'string', describe: 'Comma-separated label names or ids' }),
  handler: async (argv, ctx) => {
    const lists = parseTrelloCliListOption(argv['list']);
    const labels = parseTrelloCliListOption(argv['label']);

    if (lists.length === 0 && labels.length === 0) {
      throw new CliError({ message: 'Pass --list and/or --label.', code: 'INVALID_ARGUMENT' });
    }

    const names = await resolveTrelloBoardNames({ trelloContext: ctx.trelloContext, boardId: ctx.requireBoard(), lists, labels });
    const result = { boardId: names.boardId, listIds: names.listIds, labelIds: names.labelIds };

    if (!names.ok) {
      throw new CliError({ message: names.missing.map((x) => x.message).join(' '), code: 'INVALID_ARGUMENT', suggestion: 'Run: trello-cli board lists / board labels to see the names.', data: { ...result, missing: names.missing } });
    }

    ctx.output.result(result);
  }
};

/**
 * The loop `board` subcommands: `snapshot`, `changes`, `activity`, `mentions`, `resolve`.
 */
export const TRELLO_CLI_BOARD_LOOP_SUBCOMMANDS: readonly TrelloCliCommand[] = [snapshotCommand, changesCommand, activityCommand, boardMentionsCommand, resolveCommand];

/**
 * Renders the `Attachments` section lines for a sync, linking each mirrored file relative to the markdown file.
 *
 * @param sync - The sync result.
 * @param baseDir - The markdown file's directory, or undefined to link absolute paths.
 * @returns The section lines.
 */
export function trelloCliAttachmentSectionLines(sync: TrelloCardAttachmentSync, baseDir: Maybe<string>): string[] {
  const lines = sync.entries.map((entry) => {
    let line: string;

    if (entry.status === 'link') {
      line = `- [${entry.name}](${entry.url ?? ''})`;
    } else if (entry.status === 'error') {
      line = `- ${entry.name} — download failed: ${entry.error ?? 'unknown error'}`;
    } else {
      const path = join(sync.dir, entry.file ?? '');
      line = `- [${entry.name}](${(baseDir == null ? path : relative(baseDir, path)).replaceAll('\\', '/')})`;
    }

    return line;
  });

  return lines.length > 0 ? lines : ['_(no attachments)_'];
}

const renderCommand: TrelloCliCommand = {
  command: 'render <card>',
  describe: 'Render the card as markdown (--out writes it, keeping the notes block across re-renders)',
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('out', { type: 'string', describe: 'Write the markdown to this file (relative to the cwd); the notes block of an existing file is kept' })
      .option('attachments', { type: 'boolean', default: false, describe: 'Mirror the uploaded attachments (into <dir of --out>/attachments) and add an Attachments section' })
      .option('attachments-dir', { type: 'string', describe: 'Where --attachments mirrors files. Defaults to <dir of --out>/attachments' })
      .option('comments-limit', { type: 'number', default: DEFAULT_TRELLO_CLI_CARD_RENDER_COMMENTS_LIMIT, describe: 'The newest comments to include' })
      .option('raw', { type: 'boolean', default: false, describe: 'Print the markdown itself instead of the JSON envelope' })
      .example([
        ['$0 card render sD7bnJf5 --raw', 'Print the card as markdown'],
        ['$0 card render sD7bnJf5 --out cards/sD7bnJf5/card.md --attachments', 'Write card.md and mirror its files into cards/sD7bnJf5/attachments']
      ]),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    const out = argv['out'] ? resolve(argv['out'] as string) : undefined;
    const attachmentsDirArg = argv['attachments-dir'] as Maybe<string>;
    const commentsLimit = Math.max(0, Math.min(TRELLO_MAX_PAGE_LIMIT, Number(argv['comments-limit'] ?? DEFAULT_TRELLO_CLI_CARD_RENDER_COMMENTS_LIMIT)));
    let attachmentsDir: Maybe<string>;

    if (argv['attachments']) {
      if (attachmentsDirArg) {
        attachmentsDir = isAbsolute(attachmentsDirArg) ? attachmentsDirArg : resolve(attachmentsDirArg);
      } else if (out == null) {
        throw new CliError({ message: '--attachments needs --out or --attachments-dir to know where to put the files.', code: 'INVALID_ARGUMENT' });
      } else {
        attachmentsDir = join(dirname(out), 'attachments');
      }
    }

    const card = await getCard(ctx.trelloContext)({ cardId, list: true });
    const comments = commentsLimit > 0 ? await listCardActions(ctx.trelloContext)<Partial<TrelloCommentCardActionData>>({ cardId: card.id, filter: 'commentCard', limit: commentsLimit }) : [];
    const sync = attachmentsDir == null ? undefined : await syncTrelloCardAttachments({ trelloContext: ctx.trelloContext, cardId: card.id, dir: attachmentsDir });
    const markdown = renderTrelloCardMarkdown({
      card,
      listName: card.list?.name,
      labelNames: (card.labels ?? []).map((x) => x.name || x.color || x.id),
      comments,
      preservedBlocks: [{ name: TRELLO_CLI_CARD_RENDER_NOTES_BLOCK, heading: 'Notes', placeholder: '_(notes written here are kept when the card is re-rendered with --out)_' }],
      sections: sync == null ? undefined : [{ heading: 'Attachments', lines: trelloCliAttachmentSectionLines(sync, out == null ? undefined : dirname(out)) }]
    });

    let written: Maybe<{ readonly path: string; readonly changed: boolean; readonly markdown: string }>;

    if (out != null) {
      written = await writeMarkdownPreservingBlocks({ path: out, markdown });
    }

    if (argv['raw']) {
      getCliOutputWriter()((written?.markdown ?? markdown).replace(/\n$/, ''));
    } else {
      ctx.output.result({ cardId: card.id, shortLink: card.shortLink, ...(written == null ? { markdown } : { path: written.path, changed: written.changed, bytes: Buffer.byteLength(written.markdown) }), ...(sync == null ? {} : { attachments: sync }) });
    }
  }
};

const attachmentsSyncCommand: TrelloCliCommand = {
  command: 'sync <card>',
  describe: "Mirror the card's uploaded attachments into a directory (cached by size; removed attachments are deleted)",
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).option('dir', { type: 'string', demandOption: true, describe: 'The directory to mirror into (relative to the cwd)' }),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    ctx.output.result(await syncTrelloCardAttachments({ trelloContext: ctx.trelloContext, cardId, dir: resolve(argv['dir'] as string) }));
  }
};

const attachmentsCommand: TrelloCliCommand = {
  command: 'attachments',
  describe: 'Card attachment files: sync',
  subcommands: [attachmentsSyncCommand]
};

const cardMentionsCommand: TrelloCliCommand = {
  command: 'mentions <card>',
  describe: "Find the card's comments that @-mention a member (default: you)",
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('username', { type: 'string', describe: 'The member to find mentions of. Defaults to the authenticated member' })
      .option('after', { type: 'string', describe: 'Only mentions newer than this comment action id (the newestMentionId of a previous run)' })
      .option('include-self', { type: 'boolean', default: false, describe: 'Keep comments the authenticated member wrote' }),
  handler: async (argv, ctx) => {
    const cardId: TrelloCardId = parseTrelloCliCardArg(argv['card']);
    const username = await mentionUsername(ctx, argv['username']);
    const actions = await listCardActions(ctx.trelloContext)({ cardId, filter: 'commentCard', limit: TRELLO_MAX_PAGE_LIMIT });
    const found = findTrelloMentions({ actions, username, exclude: await selfExclusion(ctx, argv['include-self'] === true), afterActionId: (argv['after'] as Maybe<string>) || undefined });

    ctx.output.result({ cardId, username, ...found });
  }
};

const refCommand: TrelloCliCommand = {
  command: 'ref <text..>',
  describe: 'Parse a card reference (link, shortLink or id) and list every card shortLink in the text; no Trello call',
  requires: 'none',
  handler: (argv, ctx) => {
    const text = ([] as unknown[])
      .concat(argv['text'] ?? [])
      .map(String)
      .join(' ');
    ctx.output.result({ ref: parseTrelloCardRef(text.trim()) ?? null, shortLinks: extractTrelloCardShortLinks(text) });
  }
};

/**
 * The loop `card` subcommands: `render`, `attachments sync`, `mentions`, `ref`.
 */
export const TRELLO_CLI_CARD_LOOP_SUBCOMMANDS: readonly TrelloCliCommand[] = [renderCommand, attachmentsCommand, cardMentionsCommand, refCommand];

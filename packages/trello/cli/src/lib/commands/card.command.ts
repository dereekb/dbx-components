import { CliError } from '@dereekb/dbx-cli';
import { type GetCardQuery, type TrelloBoardId, type TrelloLabelId, type TrelloMemberId, TRELLO_MAX_PAGE_LIMIT, addMemberToCard, createCard, deleteCard, getCard, getList, getMember, listBoardLabels, matchTrelloLabel, removeMemberFromCard, updateCard, updateTrelloCardLabels } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { parseTrelloCliBoardArg, parseTrelloCliCardArg, parseTrelloCliListOption, parseTrelloCliPosition, readTrelloCliTextOption, requireTrelloCliConfirmation, resolveTrelloCliList } from '../util/option';

const TRELLO_ID_REGEX = /^[a-f0-9]{24}$/i;

/**
 * Adds the `<card>` positional every card command takes.
 *
 * @param yargs - The yargs instance.
 * @returns The yargs instance.
 */
export function withTrelloCliCardPositional(yargs: Argv): Argv {
  return yargs.positional('card', { type: 'string', demandOption: true, describe: 'The card: its link, shortLink or id' });
}

/**
 * Resolves label refs — ids, or names matched case-insensitively — to label ids on a board.
 *
 * @param ctx - The run's context.
 * @param boardId - The board the labels belong to.
 * @param refs - The label ids or names.
 * @returns The label ids.
 * @throws {CliError} `INVALID_ARGUMENT` when a name matches no label (or several).
 */
export async function resolveTrelloCliLabelIds(ctx: TrelloCliContext, boardId: TrelloBoardId, refs: readonly string[]): Promise<TrelloLabelId[]> {
  const names = refs.filter((x) => !TRELLO_ID_REGEX.test(x));
  const labels = names.length > 0 ? await listBoardLabels(ctx.trelloContext)({ boardId, limit: TRELLO_MAX_PAGE_LIMIT }) : [];

  return refs.map((ref) => {
    let id: TrelloLabelId;

    if (TRELLO_ID_REGEX.test(ref)) {
      id = ref;
    } else {
      const match = matchTrelloLabel({ labels, label: ref });

      if (!match.ok) {
        throw new CliError({ message: match.message, code: 'INVALID_ARGUMENT', suggestion: 'Run: trello-cli board labels to see the board labels.' });
      }

      id = match.label.id;
    }

    return id;
  });
}

/**
 * Resolves member refs — `me`, an id, or a username — to member ids.
 *
 * @param ctx - The run's context.
 * @param refs - The member refs.
 * @returns The member ids.
 */
export async function resolveTrelloCliMemberIds(ctx: TrelloCliContext, refs: readonly string[]): Promise<TrelloMemberId[]> {
  const ids: TrelloMemberId[] = [];

  for (const ref of refs) {
    if (ref === 'me') {
      ids.push((await ctx.me()).id);
    } else if (TRELLO_ID_REGEX.test(ref)) {
      ids.push(ref);
    } else {
      ids.push((await getMember(ctx.trelloContext)({ memberId: ref.replace(/^@/, ''), fields: 'id' })).id);
    }
  }

  return ids;
}

/**
 * The board a card is on.
 *
 * @param ctx - The run's context.
 * @param cardId - The card.
 * @returns The board id.
 */
async function trelloCliCardBoardId(ctx: TrelloCliContext, cardId: string): Promise<TrelloBoardId> {
  return (await getCard(ctx.trelloContext)({ cardId, fields: 'idBoard' })).idBoard;
}

const getCommand: TrelloCliCommand = {
  command: 'get <card>',
  describe: 'Show a card, with its list and labels; add --comments, --attachments, --checklists, --members for more',
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('comments', { type: 'boolean', default: false, describe: 'Include the comments (newest first, up to 50)' })
      .option('attachments', { type: 'boolean', default: false, describe: 'Include the attachments' })
      .option('checklists', { type: 'boolean', default: false, describe: 'Include the checklists and their items' })
      .option('members', { type: 'boolean', default: false, describe: 'Include the members' })
      .option('all', { type: 'boolean', default: false, describe: 'Include all of the above' })
      .option('fields', { type: 'string', describe: 'Comma-separated card fields, or all' }),
  handler: async (argv, ctx) => {
    const all = argv['all'] === true;
    const query: GetCardQuery = {
      list: true,
      ...(argv['fields'] ? { fields: argv['fields'] as string } : {}),
      ...(all || argv['comments'] ? { actions: 'commentCard' } : {}),
      ...(all || argv['attachments'] ? { attachments: true } : {}),
      ...(all || argv['checklists'] ? { checklists: 'all' as const } : {}),
      ...(all || argv['members'] ? { members: true } : {})
    };

    ctx.output.result(await getCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), ...query }));
  }
};

const createCommand: TrelloCliCommand = {
  command: 'create',
  describe: 'Create a card in a list',
  builder: (yargs: Argv) =>
    yargs
      .option('list', { type: 'string', demandOption: true, describe: 'The list: its id, or its name on the board' })
      .option('name', { type: 'string', demandOption: true, describe: 'The card title' })
      .option('desc', { type: 'string', describe: 'The description (markdown)' })
      .option('desc-file', { type: 'string', describe: 'Read the description from this file' })
      .option('labels', { type: 'string', describe: 'Comma-separated label names or ids' })
      .option('members', { type: 'string', describe: 'Comma-separated members: me, usernames or ids' })
      .option('due', { type: 'string', describe: 'Due date (ISO 8601, e.g. 2026-12-01)' })
      .option('pos', { type: 'string', default: 'bottom', describe: 'top, bottom, or a number' })
      .conflicts('desc', 'desc-file')
      .example([['$0 card create --list "To Do" --name "Fix login" --labels bug --members me', 'A card on the default board']]),
  handler: async (argv, ctx) => {
    const list = await resolveTrelloCliList({ trelloContext: ctx.trelloContext, boardId: ctx.board, list: String(argv['list']) });
    const labelRefs = parseTrelloCliListOption(argv['labels']);
    const memberRefs = parseTrelloCliListOption(argv['members']);
    let idLabels: Maybe<TrelloLabelId[]>;

    if (labelRefs.length > 0) {
      const boardId = 'idBoard' in list ? list.idBoard : (await getList(ctx.trelloContext)({ listId: list.id })).idBoard;
      idLabels = await resolveTrelloCliLabelIds(ctx, boardId, labelRefs);
    }

    const card = await createCard(ctx.trelloContext)({
      idList: list.id,
      name: String(argv['name']),
      desc: (await readTrelloCliTextOption({ value: argv['desc'], file: argv['desc-file'] })) ?? undefined,
      idLabels: idLabels ?? undefined,
      idMembers: memberRefs.length > 0 ? await resolveTrelloCliMemberIds(ctx, memberRefs) : undefined,
      due: (argv['due'] as Maybe<string>) ?? undefined,
      pos: parseTrelloCliPosition(argv['pos'])
    });

    ctx.output.result(card);
  }
};

const updateCommand: TrelloCliCommand = {
  command: 'update <card>',
  describe: "Change a card's fields (labels / members given here REPLACE the current set; use card label / card member to add or remove)",
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('name', { type: 'string', describe: 'The new title' })
      .option('desc', { type: 'string', describe: 'The new description' })
      .option('desc-file', { type: 'string', describe: 'Read the new description from this file' })
      .option('due', { type: 'string', describe: 'Due date (ISO 8601), or "none" to clear it' })
      .option('due-complete', { type: 'boolean', describe: 'Mark the due date complete (--no-due-complete to reopen)' })
      .option('start', { type: 'string', describe: 'Start date (ISO 8601), or "none" to clear it' })
      .option('labels', { type: 'string', describe: 'Replace the labels: comma-separated names or ids ("" clears them)' })
      .option('members', { type: 'string', describe: 'Replace the members: comma-separated me, usernames or ids ("" clears them)' })
      .conflicts('desc', 'desc-file'),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    const desc = await readTrelloCliTextOption({ value: argv['desc'], file: argv['desc-file'] });
    const dateOption = (value: unknown) => (value === 'none' ? null : String(value));
    let idLabels: Maybe<TrelloLabelId[]>;
    let idMembers: Maybe<TrelloMemberId[]>;

    if (argv['labels'] != null) {
      const refs = parseTrelloCliListOption(argv['labels']);
      idLabels = refs.length > 0 ? await resolveTrelloCliLabelIds(ctx, await trelloCliCardBoardId(ctx, cardId), refs) : [];
    }

    if (argv['members'] != null) {
      idMembers = await resolveTrelloCliMemberIds(ctx, parseTrelloCliListOption(argv['members']));
    }

    const update = {
      ...(argv['name'] == null ? {} : { name: String(argv['name']) }),
      ...(desc == null ? {} : { desc }),
      ...(argv['due'] == null ? {} : { due: dateOption(argv['due']) }),
      ...(argv['due-complete'] == null ? {} : { dueComplete: argv['due-complete'] as boolean }),
      ...(argv['start'] == null ? {} : { start: dateOption(argv['start']) }),
      ...(idLabels == null ? {} : { idLabels }),
      ...(idMembers == null ? {} : { idMembers })
    };

    if (Object.keys(update).length === 0) {
      throw new CliError({ message: 'Nothing to update.', code: 'INVALID_ARGUMENT', suggestion: 'Pass at least one of --name, --desc, --desc-file, --due, --due-complete, --start, --labels, --members.' });
    }

    ctx.output.result(await updateCard(ctx.trelloContext)({ cardId, ...update }));
  }
};

const moveCommand: TrelloCliCommand = {
  command: 'move <card>',
  describe: 'Move a card to another list (on its board, or on --to-board)',
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('list', { type: 'string', demandOption: true, describe: 'The target list: its id, or its name' })
      .option('to-board', { type: 'string', describe: 'Move to this board (id, shortLink or link); --list is resolved there' })
      .option('pos', { type: 'string', describe: 'top, bottom, or a number' })
      .example([['$0 card move https://trello.com/c/AbCd1234 --list Done', 'Move a card to its board\'s "Done" list']]),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    const toBoard = parseTrelloCliBoardArg(argv['to-board']);
    const listArg = String(argv['list']);
    const boardId = toBoard ?? (TRELLO_ID_REGEX.test(listArg) ? undefined : await trelloCliCardBoardId(ctx, cardId));
    const list = await resolveTrelloCliList({ trelloContext: ctx.trelloContext, boardId, list: listArg });
    let idBoard: Maybe<TrelloBoardId>;

    if (toBoard) {
      idBoard = 'idBoard' in list ? list.idBoard : (await getList(ctx.trelloContext)({ listId: list.id })).idBoard;
    }

    ctx.output.result(await updateCard(ctx.trelloContext)({ cardId, idList: list.id, ...(idBoard ? { idBoard } : {}), ...(argv['pos'] == null ? {} : { pos: parseTrelloCliPosition(argv['pos']) }) }));
  }
};

const archiveCommand: TrelloCliCommand = {
  command: 'archive <card>',
  describe: 'Archive (close) a card',
  builder: withTrelloCliCardPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), closed: true }))
};

const unarchiveCommand: TrelloCliCommand = {
  command: 'unarchive <card>',
  describe: 'Reopen an archived card',
  builder: withTrelloCliCardPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), closed: false }))
};

const deleteCommand: TrelloCliCommand = {
  command: 'delete <card>',
  describe: 'Delete a card permanently (needs --yes; prefer card archive)',
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).option('yes', { type: 'boolean', default: false, describe: 'Confirm the deletion' }),
  handler: async (argv, ctx) => {
    requireTrelloCliConfirmation(argv, 'Deleting a card');
    const cardId = parseTrelloCliCardArg(argv['card']);
    await deleteCard(ctx.trelloContext)({ cardId });
    ctx.output.result({ deleted: true, cardId });
  }
};

const labelCommand: TrelloCliCommand = {
  command: 'label <card>',
  describe: "Add / remove labels by name or id, one call each (never rewrites the card's whole label set)",
  builder: (yargs: Argv) =>
    withTrelloCliCardPositional(yargs)
      .option('add', { type: 'string', describe: 'Comma-separated label names or ids to add' })
      .option('remove', { type: 'string', describe: 'Comma-separated label names or ids to remove' })
      .example([['$0 card label AbCd1234 --add "in review" --remove "in progress"', 'Swap two labels']]),
  handler: async (argv, ctx) => {
    const add = parseTrelloCliListOption(argv['add']);
    const remove = parseTrelloCliListOption(argv['remove']);

    if (add.length === 0 && remove.length === 0) {
      throw new CliError({ message: 'Pass --add and/or --remove.', code: 'INVALID_ARGUMENT' });
    }

    const result = await updateTrelloCardLabels({ trelloContext: ctx.trelloContext, cardId: parseTrelloCliCardArg(argv['card']), add, remove });

    if (!result.ok) {
      throw new CliError({ message: result.unresolved.map((x) => x.message).join(' '), code: 'INVALID_ARGUMENT', suggestion: 'Nothing was changed. Run: trello-cli board labels to see the board labels.', data: result });
    }

    ctx.output.result(result);
  }
};

const memberCommand: TrelloCliCommand = {
  command: 'member <card>',
  describe: 'Add / remove card members (me, usernames or ids)',
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).option('add', { type: 'string', describe: 'Comma-separated members to add' }).option('remove', { type: 'string', describe: 'Comma-separated members to remove' }),
  handler: async (argv, ctx) => {
    const cardId = parseTrelloCliCardArg(argv['card']);
    const add = await resolveTrelloCliMemberIds(ctx, parseTrelloCliListOption(argv['add']));
    const remove = await resolveTrelloCliMemberIds(ctx, parseTrelloCliListOption(argv['remove']));

    if (add.length === 0 && remove.length === 0) {
      throw new CliError({ message: 'Pass --add and/or --remove.', code: 'INVALID_ARGUMENT' });
    }

    const current = new Set((await getCard(ctx.trelloContext)({ cardId, fields: 'idMembers' })).idMembers ?? []);
    const added: TrelloMemberId[] = [];
    const removed: TrelloMemberId[] = [];

    for (const memberId of add.filter((x) => !current.has(x))) {
      await addMemberToCard(ctx.trelloContext)({ cardId, memberId });
      current.add(memberId);
      added.push(memberId);
    }

    for (const memberId of remove.filter((x) => current.has(x))) {
      await removeMemberFromCard(ctx.trelloContext)({ cardId, memberId });
      current.delete(memberId);
      removed.push(memberId);
    }

    ctx.output.result({ added, removed, memberIds: Array.from(current) });
  }
};

/**
 * The built-in `card` subcommands.
 */
export const TRELLO_CLI_CARD_CORE_SUBCOMMANDS: readonly TrelloCliCommand[] = [getCommand, createCommand, updateCommand, moveCommand, archiveCommand, unarchiveCommand, deleteCommand, labelCommand, memberCommand];

/**
 * The `card` command.
 */
export const TRELLO_CLI_CARD_COMMAND: TrelloCliCommand = {
  command: 'card',
  describe: 'Cards: get, create, update, move, archive, unarchive, delete, label, member',
  subcommands: TRELLO_CLI_CARD_CORE_SUBCOMMANDS
};

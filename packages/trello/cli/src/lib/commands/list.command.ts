import { createList, getList, listCardsInList, updateList } from '@dereekb/trello';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { type TrelloCliContext } from '../context/cli.context';
import { parseTrelloCliPosition, resolveTrelloCliList } from '../util/option';

/**
 * Resolves a list argument on the run's board.
 *
 * @param ctx - The run's context.
 * @param list - The list name or id.
 * @returns The list id.
 */
async function trelloCliListId(ctx: TrelloCliContext, list: unknown): Promise<string> {
  return (await resolveTrelloCliList({ trelloContext: ctx.trelloContext, boardId: ctx.board, list: String(list) })).id;
}

const listPositional = (yargs: Argv) => yargs.positional('list', { type: 'string', demandOption: true, describe: 'The list: its id, or its name on the board (case-insensitive)' });

const getCommand: TrelloCliCommand = {
  command: 'get <list>',
  describe: 'Show a list',
  builder: listPositional,
  handler: async (argv, ctx) => ctx.output.result(await getList(ctx.trelloContext)({ listId: await trelloCliListId(ctx, argv['list']) }))
};

const cardsCommand: TrelloCliCommand = {
  command: 'cards <list>',
  describe: "List a list's cards",
  builder: (yargs: Argv) => listPositional(yargs).option('filter', { type: 'string', choices: ['open', 'closed', 'all'], default: 'open', describe: 'Which cards' }),
  handler: async (argv, ctx) => ctx.output.result(await listCardsInList(ctx.trelloContext)({ listId: await trelloCliListId(ctx, argv['list']), filter: argv['filter'] as 'open' }))
};

const createCommand: TrelloCliCommand = {
  command: 'create <name>',
  describe: 'Create a list on the board',
  requires: 'board',
  builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true, describe: 'The list name' }).option('pos', { type: 'string', default: 'bottom', describe: 'top, bottom, or a number' }),
  handler: async (argv, ctx) => ctx.output.result(await createList(ctx.trelloContext)({ name: String(argv['name']), idBoard: ctx.requireBoard(), pos: parseTrelloCliPosition(argv['pos']) }))
};

const renameCommand: TrelloCliCommand = {
  command: 'rename <list> <name>',
  describe: 'Rename a list',
  builder: (yargs: Argv) => listPositional(yargs).positional('name', { type: 'string', demandOption: true, describe: 'The new name' }),
  handler: async (argv, ctx) => ctx.output.result(await updateList(ctx.trelloContext)({ listId: await trelloCliListId(ctx, argv['list']), name: String(argv['name']) }))
};

const archiveCommand: TrelloCliCommand = {
  command: 'archive <list>',
  describe: 'Archive (close) a list',
  builder: listPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateList(ctx.trelloContext)({ listId: await trelloCliListId(ctx, argv['list']), closed: true }))
};

const unarchiveCommand: TrelloCliCommand = {
  command: 'unarchive <list>',
  describe: 'Reopen an archived list (pass its id)',
  builder: listPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateList(ctx.trelloContext)({ listId: await trelloCliListId(ctx, argv['list']), closed: false }))
};

/**
 * The `list` command.
 */
export const TRELLO_CLI_LIST_COMMAND: TrelloCliCommand = {
  command: 'list',
  describe: 'Lists: get, cards, create, rename, archive, unarchive',
  subcommands: [getCommand, cardsCommand, createCommand, renameCommand, archiveCommand, unarchiveCommand]
};

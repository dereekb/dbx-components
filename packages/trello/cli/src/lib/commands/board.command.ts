import { type TrelloMemberBoardsFilter, getBoard, listBoardCards, listBoardLabels, listBoardLists, listBoardMembers, listCardsInList, listMemberBoards, TRELLO_MAX_PAGE_LIMIT } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { TRELLO_CLI_BOARD_LOOP_SUBCOMMANDS } from '../loop/trello.cli.loop.commands';
import { resolveTrelloCliList } from '../util/option';

/**
 * The board fields `board list` returns unless `--fields` says otherwise.
 */
export const TRELLO_CLI_BOARD_LIST_FIELDS = 'id,name,url,shortUrl,closed,dateLastActivity';

/**
 * The card fields `board cards` / `list cards` return unless `--fields` says otherwise.
 */
export const TRELLO_CLI_CARD_LIST_FIELDS = 'id,name,idList,idLabels,idMembers,closed,due,dueComplete,shortLink,shortUrl,dateLastActivity';

const listCommand: TrelloCliCommand = {
  command: 'list',
  describe: 'List the boards the member can see',
  builder: (yargs: Argv) =>
    yargs.option('filter', { type: 'string', choices: ['open', 'all', 'closed', 'members', 'organization', 'public', 'starred'], default: 'open', describe: 'Which boards' }).option('fields', { type: 'string', default: TRELLO_CLI_BOARD_LIST_FIELDS, describe: 'Comma-separated board fields, or all' }),
  handler: async (argv, ctx) => ctx.output.result(await listMemberBoards(ctx.trelloContext)({ filter: argv['filter'] as TrelloMemberBoardsFilter, fields: argv['fields'] as string }))
};

const getCommand: TrelloCliCommand = {
  command: 'get',
  describe: 'Show the board (--board, config default-board, or TRELLO_CLI_BOARD)',
  requires: 'board',
  handler: async (_argv, ctx) => ctx.output.result(await getBoard(ctx.trelloContext)({ boardId: ctx.requireBoard() }))
};

const listsCommand: TrelloCliCommand = {
  command: 'lists',
  describe: "List the board's lists",
  requires: 'board',
  builder: (yargs: Argv) => yargs.option('filter', { type: 'string', choices: ['open', 'closed', 'all', 'none'], default: 'open', describe: 'Which lists' }),
  handler: async (argv, ctx) => ctx.output.result(await listBoardLists(ctx.trelloContext)({ boardId: ctx.requireBoard(), filter: argv['filter'] as 'open' }))
};

const labelsCommand: TrelloCliCommand = {
  command: 'labels',
  describe: "List the board's labels",
  requires: 'board',
  handler: async (_argv, ctx) => ctx.output.result(await listBoardLabels(ctx.trelloContext)({ boardId: ctx.requireBoard(), limit: TRELLO_MAX_PAGE_LIMIT }))
};

const membersCommand: TrelloCliCommand = {
  command: 'members',
  describe: "List the board's members",
  requires: 'board',
  handler: async (_argv, ctx) => ctx.output.result(await listBoardMembers(ctx.trelloContext)({ boardId: ctx.requireBoard() }))
};

const cardsCommand: TrelloCliCommand = {
  command: 'cards',
  describe: "List the board's cards, or one list's (--list <name|id>)",
  requires: 'board',
  builder: (yargs: Argv) =>
    yargs
      .option('list', { type: 'string', describe: 'Only this list: its name (case-insensitive) or id' })
      .option('filter', { type: 'string', choices: ['visible', 'open', 'closed', 'all'], default: 'visible', describe: 'Which cards' })
      .option('fields', { type: 'string', default: TRELLO_CLI_CARD_LIST_FIELDS, describe: 'Comma-separated card fields, or all' })
      .example([
        ['$0 board cards --board AbCd1234', 'Every visible card on the board'],
        ['$0 board cards --list "In Progress"', 'The cards in one list of the default board']
      ]),
  handler: async (argv, ctx) => {
    const boardId = ctx.requireBoard();
    const listArg = argv['list'] as Maybe<string>;
    let cards: unknown;

    if (listArg) {
      const list = await resolveTrelloCliList({ trelloContext: ctx.trelloContext, boardId, list: listArg });
      cards = await listCardsInList(ctx.trelloContext)({ listId: list.id, filter: argv['filter'] === 'visible' ? 'open' : (argv['filter'] as 'open') });
    } else {
      cards = await listBoardCards(ctx.trelloContext)({ boardId, filter: argv['filter'] as 'visible', fields: argv['fields'] as string });
    }

    ctx.output.result(cards);
  }
};

/**
 * The `board` subcommands: the read-only `list`, `get`, `lists`, `labels`, `members`, `cards`, then the loop commands
 * `snapshot`, `changes`, `activity`, `mentions`, `resolve`.
 */
export const TRELLO_CLI_BOARD_CORE_SUBCOMMANDS: readonly TrelloCliCommand[] = [listCommand, getCommand, listsCommand, labelsCommand, membersCommand, cardsCommand, ...TRELLO_CLI_BOARD_LOOP_SUBCOMMANDS];

/**
 * The `board` command.
 */
export const TRELLO_CLI_BOARD_COMMAND: TrelloCliCommand = {
  command: 'board',
  describe: 'Boards: list, get, lists, labels, members, cards, snapshot, changes, activity, mentions, resolve',
  subcommands: TRELLO_CLI_BOARD_CORE_SUBCOMMANDS
};

import { type TrelloSearchModelType, getBoard, searchTrello } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { parseTrelloCliListOption } from '../util/option';

/**
 * The card fields `search` returns unless `--card-fields` says otherwise.
 */
export const TRELLO_CLI_SEARCH_CARD_FIELDS = 'id,name,idBoard,idList,idLabels,closed,shortLink,shortUrl,dateLastActivity';

/**
 * The `search <query>` command: Trello's own search (`/search`), across every board or only the run's board (`--here`).
 */
export const TRELLO_CLI_SEARCH_COMMAND: TrelloCliCommand = {
  command: 'search <query>',
  describe: "Search cards (and optionally boards / members) with Trello's search syntax",
  builder: (yargs: Argv) =>
    yargs
      .positional('query', { type: 'string', demandOption: true, describe: 'The query, e.g. "login bug", "label:urgent is:open", "@me"' })
      .option('type', { type: 'string', default: 'cards', describe: 'Comma-separated model types: cards, boards, members, actions, organizations, or all' })
      .option('here', { type: 'boolean', default: false, describe: 'Only search the run board (--board / default-board)' })
      .option('limit', { type: 'number', default: 20, describe: 'Max cards (up to 1000)' })
      .option('partial', { type: 'boolean', default: true, describe: 'Match word prefixes (--no-partial for whole words)' })
      .option('card-fields', { type: 'string', default: TRELLO_CLI_SEARCH_CARD_FIELDS, describe: 'Comma-separated card fields, or all' })
      .example([
        ['$0 search "login bug" --here', 'Cards on the default board mentioning "login bug"'],
        ['$0 search "is:open label:urgent" --limit 50', 'Open urgent cards anywhere']
      ]),
  handler: async (argv, ctx) => {
    const types = parseTrelloCliListOption(argv['type']);
    const modelTypes: 'all' | TrelloSearchModelType[] = types.includes('all') ? 'all' : (types as TrelloSearchModelType[]);
    let idBoards: Maybe<string[]>;

    if (argv['here'] === true) {
      // search's idBoards takes real ids, not shortLinks
      idBoards = [(await getBoard(ctx.trelloContext)({ boardId: ctx.requireBoard() })).id];
    }

    ctx.output.result(await searchTrello(ctx.trelloContext)({ query: String(argv['query']), modelTypes, idBoards, cardsLimit: argv['limit'] as number, partial: argv['partial'] as boolean, cardFields: argv['card-fields'] as string }));
  }
};

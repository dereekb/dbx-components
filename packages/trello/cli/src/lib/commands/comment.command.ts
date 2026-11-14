import { CliError } from '@dereekb/dbx-cli';
import { addCommentToCard, deleteCommentOnCard, listCardActions, updateCommentOnCard } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { parseTrelloCliCardArg, readTrelloCliTextOption, requireTrelloCliConfirmation, withTrelloCliCardPositional } from '../util/option';

/**
 * Reads a comment's text from the `[text]` positional or `--file`.
 *
 * @param argv - The parsed arguments.
 * @returns The text.
 * @throws {CliError} `INVALID_ARGUMENT` when neither (or an empty text) was given.
 */
async function trelloCliCommentText(argv: Record<string, unknown>): Promise<string> {
  const text: Maybe<string> = await readTrelloCliTextOption({ value: argv['text'], file: argv['file'] });

  if (text == null || text.trim().length === 0) {
    throw new CliError({ message: 'The comment text is empty.', code: 'INVALID_ARGUMENT', suggestion: 'Pass the text as an argument or --file <path>.' });
  }

  return text;
}

const withTextOptions = (yargs: Argv) => yargs.positional('text', { type: 'string', describe: 'The comment text (markdown)' }).option('file', { type: 'string', describe: 'Read the text from this file instead' });

const listCommand: TrelloCliCommand = {
  command: 'list <card>',
  describe: "List a card's comments, newest first",
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).option('limit', { type: 'number', default: 50, describe: 'Max comments (up to 1000)' }),
  handler: async (argv, ctx) => ctx.output.result(await listCardActions(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), filter: 'commentCard', limit: argv['limit'] as number }))
};

const addCommand: TrelloCliCommand = {
  command: 'add <card> [text]',
  describe: 'Comment on a card',
  builder: (yargs: Argv) => withTextOptions(withTrelloCliCardPositional(yargs)).example([['$0 comment add AbCd1234 "Deployed to staging"', 'Add a comment']]),
  handler: async (argv, ctx) => ctx.output.result(await addCommentToCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), text: await trelloCliCommentText(argv) }))
};

const editCommand: TrelloCliCommand = {
  command: 'edit <card> <commentId> [text]',
  describe: 'Replace the text of a comment (its action id, from comment list)',
  builder: (yargs: Argv) => withTextOptions(withTrelloCliCardPositional(yargs).positional('commentId', { type: 'string', demandOption: true, describe: 'The comment action id' })),
  handler: async (argv, ctx) => ctx.output.result(await updateCommentOnCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), actionId: String(argv['commentId']), text: await trelloCliCommentText(argv) }))
};

const deleteCommand: TrelloCliCommand = {
  command: 'delete <card> <commentId>',
  describe: 'Delete a comment (needs --yes)',
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).positional('commentId', { type: 'string', demandOption: true, describe: 'The comment action id' }).option('yes', { type: 'boolean', default: false, describe: 'Confirm the deletion' }),
  handler: async (argv, ctx) => {
    requireTrelloCliConfirmation(argv, 'Deleting a comment');
    const cardId = parseTrelloCliCardArg(argv['card']);
    await deleteCommentOnCard(ctx.trelloContext)({ cardId, actionId: String(argv['commentId']) });
    ctx.output.result({ deleted: true, cardId, commentId: String(argv['commentId']) });
  }
};

/**
 * The `comment` command.
 */
export const TRELLO_CLI_COMMENT_COMMAND: TrelloCliCommand = {
  command: 'comment',
  describe: 'Card comments: list, add, edit, delete',
  subcommands: [listCommand, addCommand, editCommand, deleteCommand]
};

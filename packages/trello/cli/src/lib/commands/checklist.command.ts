import { addCheckItemToChecklist, addChecklistToCard, deleteCheckItemFromCard, deleteChecklist, listCardChecklists, updateCardCheckItem, updateChecklist } from '@dereekb/trello';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { parseTrelloCliCardArg, parseTrelloCliPosition, requireTrelloCliConfirmation } from '../util/option';
import { withTrelloCliCardPositional } from './card.command';

const checklistPositional = (yargs: Argv) => yargs.positional('checklistId', { type: 'string', demandOption: true, describe: 'The checklist id (from checklist list)' });
const checkItemPositional = (yargs: Argv) => withTrelloCliCardPositional(yargs).positional('itemId', { type: 'string', demandOption: true, describe: 'The check item id (from checklist list)' });

const listCommand: TrelloCliCommand = {
  command: 'list <card>',
  describe: "List a card's checklists with their items",
  builder: withTrelloCliCardPositional,
  handler: async (argv, ctx) => ctx.output.result(await listCardChecklists(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), checkItems: 'all' }))
};

const addCommand: TrelloCliCommand = {
  command: 'add <card> <name>',
  describe: 'Add a checklist to a card',
  builder: (yargs: Argv) => withTrelloCliCardPositional(yargs).positional('name', { type: 'string', demandOption: true, describe: 'The checklist name' }).option('pos', { type: 'string', describe: 'top, bottom, or a number' }),
  handler: async (argv, ctx) => ctx.output.result(await addChecklistToCard(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), name: String(argv['name']), pos: parseTrelloCliPosition(argv['pos']) }))
};

const renameCommand: TrelloCliCommand = {
  command: 'rename <checklistId> <name>',
  describe: 'Rename a checklist',
  builder: (yargs: Argv) => checklistPositional(yargs).positional('name', { type: 'string', demandOption: true, describe: 'The new name' }),
  handler: async (argv, ctx) => ctx.output.result(await updateChecklist(ctx.trelloContext)({ checklistId: String(argv['checklistId']), name: String(argv['name']) }))
};

const deleteCommand: TrelloCliCommand = {
  command: 'delete <checklistId>',
  describe: 'Delete a checklist and its items (needs --yes)',
  builder: (yargs: Argv) => checklistPositional(yargs).option('yes', { type: 'boolean', default: false, describe: 'Confirm the deletion' }),
  handler: async (argv, ctx) => {
    requireTrelloCliConfirmation(argv, 'Deleting a checklist');
    await deleteChecklist(ctx.trelloContext)({ checklistId: String(argv['checklistId']) });
    ctx.output.result({ deleted: true, checklistId: String(argv['checklistId']) });
  }
};

const itemAddCommand: TrelloCliCommand = {
  command: 'add <checklistId> <name>',
  describe: 'Add an item to a checklist',
  builder: (yargs: Argv) => checklistPositional(yargs).positional('name', { type: 'string', demandOption: true, describe: 'The item text' }).option('checked', { type: 'boolean', default: false, describe: 'Add it already checked' }).option('pos', { type: 'string', describe: 'top, bottom, or a number' }),
  handler: async (argv, ctx) => ctx.output.result(await addCheckItemToChecklist(ctx.trelloContext)({ checklistId: String(argv['checklistId']), name: String(argv['name']), checked: argv['checked'] === true, pos: parseTrelloCliPosition(argv['pos']) }))
};

const itemCheckCommand: TrelloCliCommand = {
  command: 'check <card> <itemId>',
  describe: 'Mark an item complete',
  builder: checkItemPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateCardCheckItem(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), checkItemId: String(argv['itemId']), state: 'complete' }))
};

const itemUncheckCommand: TrelloCliCommand = {
  command: 'uncheck <card> <itemId>',
  describe: 'Mark an item incomplete',
  builder: checkItemPositional,
  handler: async (argv, ctx) => ctx.output.result(await updateCardCheckItem(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), checkItemId: String(argv['itemId']), state: 'incomplete' }))
};

const itemRenameCommand: TrelloCliCommand = {
  command: 'rename <card> <itemId> <name>',
  describe: "Change an item's text",
  builder: (yargs: Argv) => checkItemPositional(yargs).positional('name', { type: 'string', demandOption: true, describe: 'The new text' }),
  handler: async (argv, ctx) => ctx.output.result(await updateCardCheckItem(ctx.trelloContext)({ cardId: parseTrelloCliCardArg(argv['card']), checkItemId: String(argv['itemId']), name: String(argv['name']) }))
};

const itemDeleteCommand: TrelloCliCommand = {
  command: 'delete <card> <itemId>',
  describe: 'Delete an item (needs --yes)',
  builder: (yargs: Argv) => checkItemPositional(yargs).option('yes', { type: 'boolean', default: false, describe: 'Confirm the deletion' }),
  handler: async (argv, ctx) => {
    requireTrelloCliConfirmation(argv, 'Deleting a check item');
    const cardId = parseTrelloCliCardArg(argv['card']);
    await deleteCheckItemFromCard(ctx.trelloContext)({ cardId, checkItemId: String(argv['itemId']) });
    ctx.output.result({ deleted: true, cardId, itemId: String(argv['itemId']) });
  }
};

const itemCommand: TrelloCliCommand = {
  command: 'item',
  describe: 'Checklist items: add, check, uncheck, rename, delete',
  subcommands: [itemAddCommand, itemCheckCommand, itemUncheckCommand, itemRenameCommand, itemDeleteCommand]
};

/**
 * The `checklist` command.
 */
export const TRELLO_CLI_CHECKLIST_COMMAND: TrelloCliCommand = {
  command: 'checklist',
  describe: 'Card checklists: list, add, rename, delete, item add/check/uncheck/rename/delete',
  subcommands: [listCommand, addCommand, renameCommand, deleteCommand, itemCommand]
};

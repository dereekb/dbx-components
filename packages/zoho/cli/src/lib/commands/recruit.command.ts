import type { CommandModule, Argv } from 'yargs';
import { getRecruitContext, exitZohoCliCommandWithError } from '../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../util/output';
import { withPagination, withModule, withRecordId, withFields, withSort } from '../util/args';
import { runZohoPaginatedList } from '../util/pagination';
import { zohoRecruitDeleteRecord, zohoRecruitGetAttachmentsForRecord, zohoRecruitGetEmailsForRecord, zohoRecruitGetRecordById, zohoRecruitGetRecords, zohoRecruitInsertRecord, zohoRecruitSearchRecords, zohoRecruitUpdateRecord, zohoRecruitUpsertRecord } from '@dereekb/zoho';

const recruitListCommand: CommandModule = {
  command: 'list',
  describe: 'List records from a module',
  builder: (yargs: Argv) => withSort(withFields(withPagination(withModule(yargs)))),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const initialInput = {
        module: argv.module,
        page: argv.page,
        per_page: argv.perPage,
        fields: argv.fields,
        sort_by: argv.sortBy,
        sort_order: argv.sortOrder
      };
      await runZohoPaginatedList({ argv, initialInput, fetchPage: (input) => zohoRecruitGetRecords(recruitContext)(input) });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitGetCommand: CommandModule = {
  command: 'get',
  describe: 'Get a record by ID',
  builder: (yargs: Argv) => withRecordId(withModule(yargs)),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const result = await zohoRecruitGetRecordById(recruitContext)({ module: argv.module, id: argv.id });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search records in a module',
  builder: (yargs: Argv) =>
    withPagination(withModule(yargs))
      .option('criteria', { type: 'string', describe: 'Search criteria string, e.g. (First_Name:equals:John)' })
      .option('word', { type: 'string', describe: 'Keyword search' })
      .option('email', { type: 'string', describe: 'Search by email' })
      .option('phone', { type: 'string', describe: 'Search by phone' }),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const initialInput = {
        module: argv.module,
        criteria: argv.criteria,
        word: argv.word,
        email: argv.email,
        phone: argv.phone,
        page: argv.page,
        per_page: argv.perPage
      };
      await runZohoPaginatedList({ argv, initialInput, fetchPage: (input) => zohoRecruitSearchRecords(recruitContext)(input) });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitInsertCommand: CommandModule = {
  command: 'insert',
  describe: 'Insert a record into a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array)' }),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const data = JSON.parse(argv.data);
      const result = await zohoRecruitInsertRecord(recruitContext)({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitUpsertCommand: CommandModule = {
  command: 'upsert',
  describe: 'Upsert a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, include id for update)' }),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const data = JSON.parse(argv.data);
      const result = await zohoRecruitUpsertRecord(recruitContext)({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitUpdateCommand: CommandModule = {
  command: 'update',
  describe: 'Update a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, must include id)' }),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const data = JSON.parse(argv.data);
      const result = await zohoRecruitUpdateRecord(recruitContext)({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitDeleteCommand: CommandModule = {
  command: 'delete',
  describe: 'Delete records from a module',
  builder: (yargs: Argv) => withModule(yargs).option('ids', { type: 'string', demandOption: true, describe: 'Comma-separated record IDs to delete' }),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const ids = (argv.ids as string).split(',').map((id: string) => id.trim());
      const result = await zohoRecruitDeleteRecord(recruitContext)({ module: argv.module, ids });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitEmailsCommand: CommandModule = {
  command: 'emails',
  describe: 'Get emails for a record',
  builder: (yargs: Argv) => withPagination(withRecordId(withModule(yargs))),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const initialInput = { module: argv.module, id: argv.id, page: argv.page, per_page: argv.perPage };
      await runZohoPaginatedList({ argv, initialInput, fetchPage: (input) => zohoRecruitGetEmailsForRecord(recruitContext)(input) });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const recruitAttachmentsCommand: CommandModule = {
  command: 'attachments',
  describe: 'Get attachments for a record',
  builder: (yargs: Argv) => withPagination(withRecordId(withModule(yargs))),
  handler: async (argv: any) => {
    try {
      const recruitContext = getRecruitContext(argv);
      const initialInput = { module: argv.module, id: argv.id, page: argv.page, per_page: argv.perPage };
      await runZohoPaginatedList({ argv, initialInput, fetchPage: (input) => zohoRecruitGetAttachmentsForRecord(recruitContext)(input) });
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const RECRUIT_COMMAND: CommandModule = {
  command: 'recruit',
  describe: 'Zoho Recruit operations',
  builder: (yargs: Argv) =>
    yargs
      .command(recruitListCommand)
      .command(recruitGetCommand)
      .command(recruitSearchCommand)
      .command(recruitInsertCommand)
      .command(recruitUpsertCommand)
      .command(recruitUpdateCommand)
      .command(recruitDeleteCommand)
      .command(recruitEmailsCommand)
      .command(recruitAttachmentsCommand)
      .demandCommand(1, 'Please specify a recruit subcommand.')
      .example([
        ['$0 recruit list -m Candidates --per-page 10', 'List first 10 candidates'],
        ['$0 recruit get -m Candidates --id 12345', 'Get a candidate by ID'],
        ['$0 recruit search -m Candidates --word "John"', 'Search candidates by keyword'],
        ['$0 recruit insert -m Candidates --data \'{"First_Name":"John","Last_Name":"Doe"}\'', 'Insert a candidate']
      ]),
  handler: noop
};

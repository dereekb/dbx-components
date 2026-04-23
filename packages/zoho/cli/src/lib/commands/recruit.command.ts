import type { CommandModule, Argv } from 'yargs';
import { getRecruitApi } from '../middleware/auth.middleware';
import { noop } from '../util/noop';
import { outputResult, outputError } from '../util/output';
import { withPagination, withModule, withRecordId, withFields, withSort } from '../util/args';

const recruitListCommand: CommandModule = {
  command: 'list',
  describe: 'List records from a module',
  builder: (yargs: Argv) => withSort(withFields(withPagination(withModule(yargs)))),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const result = await recruitApi.getRecords({
        module: argv.module,
        page: argv.page,
        per_page: argv.perPage,
        fields: argv.fields,
        sort_by: argv.sortBy,
        sort_order: argv.sortOrder
      });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitGetCommand: CommandModule = {
  command: 'get',
  describe: 'Get a record by ID',
  builder: (yargs: Argv) => withRecordId(withModule(yargs)),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const result = await recruitApi.getRecordById({ module: argv.module, id: argv.id });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search records in a module',
  builder: (yargs: Argv) => withPagination(withModule(yargs)).option('criteria', { type: 'string', describe: 'Search criteria string, e.g. (First_Name:equals:John)' }).option('word', { type: 'string', describe: 'Keyword search' }).option('email', { type: 'string', describe: 'Search by email' }).option('phone', { type: 'string', describe: 'Search by phone' }),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const result = await recruitApi.searchRecords({
        module: argv.module,
        criteria: argv.criteria,
        word: argv.word,
        email: argv.email,
        phone: argv.phone,
        page: argv.page,
        per_page: argv.perPage
      });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitInsertCommand: CommandModule = {
  command: 'insert',
  describe: 'Insert a record into a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array)' }),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const data = JSON.parse(argv.data);
      const result = await recruitApi.insertRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitUpsertCommand: CommandModule = {
  command: 'upsert',
  describe: 'Upsert a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, include id for update)' }),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const data = JSON.parse(argv.data);
      const result = await recruitApi.upsertRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitUpdateCommand: CommandModule = {
  command: 'update',
  describe: 'Update a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, must include id)' }),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const data = JSON.parse(argv.data);
      const result = await recruitApi.updateRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitDeleteCommand: CommandModule = {
  command: 'delete',
  describe: 'Delete records from a module',
  builder: (yargs: Argv) => withModule(yargs).option('ids', { type: 'string', demandOption: true, describe: 'Comma-separated record IDs to delete' }),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const ids = (argv.ids as string).split(',').map((id: string) => id.trim());
      const result = await recruitApi.deleteRecord({ module: argv.module, ids });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitEmailsCommand: CommandModule = {
  command: 'emails',
  describe: 'Get emails for a record',
  builder: (yargs: Argv) => withPagination(withRecordId(withModule(yargs))),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const result = await recruitApi.getEmailsForRecord({ module: argv.module, id: argv.id, page: argv.page, per_page: argv.perPage });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const recruitAttachmentsCommand: CommandModule = {
  command: 'attachments',
  describe: 'Get attachments for a record',
  builder: (yargs: Argv) => withPagination(withRecordId(withModule(yargs))),
  handler: async (argv: any) => {
    try {
      const recruitApi = getRecruitApi(argv);
      const result = await recruitApi.getAttachmentsForRecord({ module: argv.module, id: argv.id, page: argv.page, per_page: argv.perPage });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const recruitCommand: CommandModule = {
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

import type { CommandModule, Argv } from 'yargs';
import { getCrmApi } from '../middleware/auth.middleware';
import { noop } from '../util/noop';
import { outputResult, outputError } from '../util/output';
import { withPagination, withModule, withRecordId, withFields, withSort } from '../util/args';

const crmListCommand: CommandModule = {
  command: 'list',
  describe: 'List records from a module',
  builder: (yargs: Argv) => withSort(withFields(withPagination(withModule(yargs)), true)),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const result = await crmApi.getRecords({
        module: argv.module,
        fields: argv.fields,
        page: argv.page,
        per_page: argv.perPage,
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

const crmGetCommand: CommandModule = {
  command: 'get',
  describe: 'Get a record by ID',
  builder: (yargs: Argv) => withRecordId(withModule(yargs)),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const result = await crmApi.getRecordById({ module: argv.module, id: argv.id });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search records in a module',
  builder: (yargs: Argv) => withPagination(withModule(yargs)).option('criteria', { type: 'string', describe: 'Search criteria string, e.g. (First_Name:equals:John)' }).option('word', { type: 'string', describe: 'Keyword search' }).option('email', { type: 'string', describe: 'Search by email' }).option('phone', { type: 'string', describe: 'Search by phone' }),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const result = await crmApi.searchRecords({
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

const crmInsertCommand: CommandModule = {
  command: 'insert',
  describe: 'Insert a record into a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array)' }),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const data = JSON.parse(argv.data);
      const result = await crmApi.insertRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmUpsertCommand: CommandModule = {
  command: 'upsert',
  describe: 'Upsert a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, include id for update)' }),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const data = JSON.parse(argv.data);
      const result = await crmApi.upsertRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmUpdateCommand: CommandModule = {
  command: 'update',
  describe: 'Update a record in a module',
  builder: (yargs: Argv) => withModule(yargs).option('data', { type: 'string', demandOption: true, describe: 'JSON record data (object or array, must include id)' }),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const data = JSON.parse(argv.data);
      const result = await crmApi.updateRecord({ module: argv.module, data });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmDeleteCommand: CommandModule = {
  command: 'delete',
  describe: 'Delete records from a module',
  builder: (yargs: Argv) => withModule(yargs).option('ids', { type: 'string', demandOption: true, describe: 'Comma-separated record IDs to delete' }),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const ids = (argv.ids as string).split(',').map((id: string) => id.trim());
      const result = await crmApi.deleteRecord({ module: argv.module, ids });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmEmailsCommand: CommandModule = {
  command: 'emails',
  describe: 'Get emails for a record',
  builder: (yargs: Argv) => withPagination(withRecordId(withModule(yargs))),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const result = await crmApi.getEmailsForRecord({ module: argv.module, id: argv.id, page: argv.page, per_page: argv.perPage });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const crmAttachmentsCommand: CommandModule = {
  command: 'attachments',
  describe: 'Get attachments for a record',
  builder: (yargs: Argv) => withFields(withPagination(withRecordId(withModule(yargs))), true),
  handler: async (argv: any) => {
    try {
      const crmApi = getCrmApi(argv);
      const result = await crmApi.getAttachmentsForRecord({ module: argv.module, id: argv.id, fields: argv.fields, page: argv.page, per_page: argv.perPage });
      outputResult(result.data, { page: result.info?.page, per_page: result.info?.per_page, more_records: result.info?.more_records });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const crmCommand: CommandModule = {
  command: 'crm',
  describe: 'Zoho CRM operations',
  builder: (yargs: Argv) =>
    yargs
      .command(crmListCommand)
      .command(crmGetCommand)
      .command(crmSearchCommand)
      .command(crmInsertCommand)
      .command(crmUpsertCommand)
      .command(crmUpdateCommand)
      .command(crmDeleteCommand)
      .command(crmEmailsCommand)
      .command(crmAttachmentsCommand)
      .demandCommand(1, 'Please specify a CRM subcommand.')
      .example([
        ['$0 crm list -m Contacts --fields "First_Name,Last_Name,Email" --per-page 10', 'List contacts'],
        ['$0 crm get -m Contacts --id 12345', 'Get a contact by ID'],
        ['$0 crm search -m Leads --word "Acme"', 'Search leads by keyword'],
        ['$0 crm insert -m Contacts --data \'{"First_Name":"Jane","Last_Name":"Doe"}\'', 'Insert a contact']
      ]),
  handler: noop
};

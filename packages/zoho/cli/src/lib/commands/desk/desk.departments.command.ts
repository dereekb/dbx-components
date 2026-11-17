import type { CommandModule, Argv } from 'yargs';
import { getDeskContext, exitZohoCliCommandWithError } from '../../middleware/auth.middleware';
import { noop } from '@dereekb/util';
import { outputResult } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, ZOHO_DESK_PAGINATION_ADAPTER } from '../../util/pagination';
import { zohoDeskGetDepartmentById, zohoDeskGetDepartments } from '@dereekb/zoho';

const departmentsListCommand: CommandModule = {
  command: 'list',
  describe: 'List departments',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('search', { type: 'string', describe: 'Search by name' }).option('is-enabled', { type: 'boolean', describe: 'Filter by enabled status' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const initialInput = { from: argv.from, limit: argv.limit, searchStr: argv.search, isEnabled: argv.isEnabled };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => zohoDeskGetDepartments(deskContext)(input),
        adapter: ZOHO_DESK_PAGINATION_ADAPTER,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { count: result.data?.length });
      }
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

const departmentsGetCommand: CommandModule = {
  command: 'get <departmentId>',
  describe: 'Get a department by ID',
  builder: (yargs: Argv) => yargs.positional('departmentId', { type: 'string', demandOption: true, describe: 'Department ID' }),
  handler: async (argv: any) => {
    try {
      const deskContext = getDeskContext(argv);
      const result = await zohoDeskGetDepartmentById(deskContext)({ departmentId: argv.departmentId });
      outputResult(result);
    } catch (e) {
      await exitZohoCliCommandWithError(e);
    }
  }
};

export const DESK_DEPARTMENTS_COMMAND: CommandModule = {
  command: 'departments',
  describe: 'Desk department operations',
  builder: (yargs: Argv) => yargs.command(departmentsListCommand).command(departmentsGetCommand).demandCommand(1),
  handler: noop
};

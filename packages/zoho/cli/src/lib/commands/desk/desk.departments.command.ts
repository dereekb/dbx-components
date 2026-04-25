import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const departmentsListCommand: CommandModule = {
  command: 'list',
  describe: 'List departments',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('search', { type: 'string', describe: 'Search by name' }).option('is-enabled', { type: 'boolean', describe: 'Filter by enabled status' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { from: argv.from, limit: argv.limit, searchStr: argv.search, isEnabled: argv.isEnabled };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getDepartments(input as any),
        adapter: zohoDeskPaginationAdapter,
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
      outputError(e);
      process.exit(1);
    }
  }
};

const departmentsGetCommand: CommandModule = {
  command: 'get <departmentId>',
  describe: 'Get a department by ID',
  builder: (yargs: Argv) => yargs.positional('departmentId', { type: 'string', demandOption: true, describe: 'Department ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getDepartmentById({ departmentId: argv.departmentId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskDepartmentsCommand: CommandModule = {
  command: 'departments',
  describe: 'Desk department operations',
  builder: (yargs: Argv) => yargs.command(departmentsListCommand).command(departmentsGetCommand).demandCommand(1),
  handler: noop
};

import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const agentsListCommand: CommandModule = {
  command: 'list',
  describe: 'List agents',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('department-id', { type: 'string', describe: 'Filter by department ID' }).option('status', { type: 'string', describe: 'Filter by status (active, disabled)' }).option('include', { type: 'string', describe: 'Comma-separated includes (e.g. role,profile,departments)' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { from: argv.from, limit: argv.limit, departmentId: argv.departmentId, status: argv.status, include: argv.include };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getAgents(input as any),
        adapter: zohoDeskPaginationAdapter,
        multiplePages: argv.multiplePages,
        multiplePagesOutput: argv.multiplePagesOutput,
        dumpOutput: argv.dumpOutput,
        dumpMerge: argv.dumpMerge
      });
      if (outcome.handled === false) {
        const result = outcome.result;
        outputResult(result.data, { from: argv.from, limit: argv.limit, count: result.data?.length });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const agentsGetCommand: CommandModule = {
  command: 'get <agentId>',
  describe: 'Get an agent by ID',
  builder: (yargs: Argv) => yargs.positional('agentId', { type: 'string', demandOption: true, describe: 'Agent ID' }).option('include', { type: 'string', describe: 'Comma-separated includes' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getAgentById({ agentId: argv.agentId, include: argv.include });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const agentsMyInfoCommand: CommandModule = {
  command: 'my-info',
  describe: 'Get current authenticated agent info',
  builder: (yargs: Argv) => yargs,
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getMyInfo();
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskAgentsCommand: CommandModule = {
  command: 'agents',
  describe: 'Desk agent operations',
  builder: (yargs: Argv) => yargs.command(agentsListCommand).command(agentsGetCommand).command(agentsMyInfoCommand).demandCommand(1),
  handler: noop
};

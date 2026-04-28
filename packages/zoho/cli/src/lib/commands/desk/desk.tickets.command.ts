import type { CommandModule, Argv } from 'yargs';
import { getDeskApi } from '../../middleware/auth.middleware';
import { noop } from '../../util/noop';
import { outputResult, outputError } from '../../util/output';
import { withDeskPagination } from '../../util/args';
import { runPaginatedList, zohoDeskPaginationAdapter } from '../../util/pagination';

const ticketsListCommand: CommandModule = {
  command: 'list',
  describe: 'List tickets',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('department-id', { type: 'string', describe: 'Filter by department ID' }).option('status', { type: 'string', describe: 'Filter by status' }).option('sort-by', { type: 'string', describe: 'Field to sort by' }).option('include', { type: 'string', describe: 'Comma-separated includes (e.g. contacts,assignee,departments,team,isRead)' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { from: argv.from, limit: argv.limit, departmentId: argv.departmentId, status: argv.status, sortBy: argv.sortBy, include: argv.include };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getTickets(input),
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

const ticketsGetCommand: CommandModule = {
  command: 'get <ticketId>',
  describe: 'Get a ticket by ID',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }).option('include', { type: 'string', describe: 'Comma-separated includes (e.g. contacts,assignee,departments,team,isRead)' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketById({ ticketId: argv.ticketId, include: argv.include });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const ticketsSearchCommand: CommandModule = {
  command: 'search',
  describe: 'Search tickets',
  builder: (yargs: Argv) => withDeskPagination(yargs).option('subject', { type: 'string', describe: 'Search by subject' }).option('status', { type: 'string', describe: 'Filter by status' }).option('email', { type: 'string', describe: 'Filter by email' }).option('department-id', { type: 'string', describe: 'Filter by department ID' }).option('channel', { type: 'string', describe: 'Filter by channel' }).option('priority', { type: 'string', describe: 'Filter by priority' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { from: argv.from, limit: argv.limit, subject: argv.subject, status: argv.status, email: argv.email, departmentId: argv.departmentId, channel: argv.channel, priority: argv.priority };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.searchTickets(input),
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

const ticketsByContactCommand: CommandModule = {
  command: 'by-contact <contactId>',
  describe: 'List tickets for a contact',
  builder: (yargs: Argv) => withDeskPagination(yargs).positional('contactId', { type: 'string', demandOption: true, describe: 'Contact ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const initialInput = { contactId: argv.contactId, from: argv.from, limit: argv.limit };
      const outcome = await runPaginatedList({
        initialInput,
        fetchPage: (input) => api.getTicketsForContact(input),
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

const ticketsMetricsCommand: CommandModule = {
  command: 'metrics <ticketId>',
  describe: 'Get ticket metrics',
  builder: (yargs: Argv) => yargs.positional('ticketId', { type: 'string', demandOption: true, describe: 'Ticket ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const result = await api.getTicketMetrics({ ticketId: argv.ticketId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const ticketsAgentCountsCommand: CommandModule = {
  command: 'agent-counts',
  describe: 'Get ticket counts per agent',
  builder: (yargs: Argv) => yargs.option('agent-ids', { type: 'string', demandOption: true, describe: 'Comma-separated agent IDs' }).option('department-id', { type: 'string', describe: 'Filter by department ID' }),
  handler: async (argv: any) => {
    try {
      const api = getDeskApi(argv);
      const agentIds = (argv.agentIds as string).split(',').map((id: string) => id.trim());
      const result = await api.getAgentsTicketsCount({ agentIds, departmentId: argv.departmentId });
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const deskTicketsCommand: CommandModule = {
  command: 'tickets',
  describe: 'Desk ticket operations',
  builder: (yargs: Argv) => yargs.command(ticketsListCommand).command(ticketsGetCommand).command(ticketsSearchCommand).command(ticketsByContactCommand).command(ticketsMetricsCommand).command(ticketsAgentCountsCommand).demandCommand(1),
  handler: noop
};

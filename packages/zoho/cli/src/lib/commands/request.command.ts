import type { CommandModule, Argv } from 'yargs';
import { getRecruitApi, getCrmApi, getDeskApi } from '../middleware/auth.middleware';
import { outputResult, outputError } from '../util/output';

export const requestCommand: CommandModule = {
  command: 'request <product> <method> <path>',
  describe: 'Make a raw API request through the authenticated context',
  builder: (yargs: Argv) =>
    yargs
      .positional('product', { type: 'string', demandOption: true, choices: ['recruit', 'crm', 'desk'] as const, describe: 'Zoho product' })
      .positional('method', { type: 'string', demandOption: true, choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const, describe: 'HTTP method' })
      .positional('path', { type: 'string', demandOption: true, describe: 'API path (relative to product base URL)' })
      .option('body', { type: 'string', describe: 'JSON request body' })
      .option('query', { type: 'string', describe: 'JSON query parameters' })
      .example([
        ['$0 request recruit GET /v2/Candidates', 'List candidates via raw API'],
        ['$0 request desk GET /tickets --query \'{"limit":5}\'', 'List 5 desk tickets via raw API'],
        ['$0 request crm POST /v8/Contacts --body \'{"data":[{"Last_Name":"Test"}]}\'', 'Create a CRM contact via raw API']
      ]),
  handler: async (argv: any) => {
    try {
      const product = argv.product as string;
      const method = argv.method as string;
      const path = argv.path as string;

      let productContext;

      switch (product) {
        case 'recruit':
          productContext = getRecruitApi(argv).recruitContext;
          break;
        case 'crm':
          productContext = getCrmApi(argv).crmContext;
          break;
        case 'desk':
          productContext = getDeskApi(argv).deskContext;
          break;
        default:
          throw new Error(`Unknown product: ${product}`);
      }

      let url = path;

      if (argv.query) {
        const queryParams = JSON.parse(argv.query);
        const searchParams = new URLSearchParams(queryParams);
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${searchParams.toString()}`;
      }

      const fetchOptions: Record<string, unknown> = { method };

      if (argv.body) {
        fetchOptions['body'] = argv.body;
        fetchOptions['headers'] = { 'Content-Type': 'application/json' };
      }

      const result = await productContext.fetchJson(url, fetchOptions as any);
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

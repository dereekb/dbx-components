import { CliError } from '@dereekb/dbx-cli';
import { outputMsGraphCliResult } from '../util/output';
import { type MicrosoftGraphQuery, microsoftGraphRequest, microsoftGraphRequestAllPages } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { type FetchJsonBody, type FetchMethod } from '@dereekb/util/fetch';
import type { Argv, CommandModule } from 'yargs';
import { msGraphCommandHandler } from '../middleware/auth.middleware';

/**
 * The HTTP methods `request` accepts.
 */
export const MSGRAPH_CLI_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Parses a JSON option value, failing with a `CliError` that names the option.
 *
 * @param name - The option name, for the error.
 * @param value - The raw option value.
 * @returns The parsed value, or undefined when the option is not set.
 * @throws {CliError} `INVALID_ARGUMENT` when the value is not valid JSON.
 */
export function parseMsGraphCliJsonOption<T>(name: string, value: unknown): Maybe<T> {
  let result: Maybe<T>;

  if (typeof value === 'string' && value.trim()) {
    try {
      result = JSON.parse(value) as T;
    } catch {
      throw new CliError({ message: `--${name} is not valid JSON.`, code: 'INVALID_ARGUMENT', suggestion: `Quote it as one argument, e.g. --${name} '{"$top":5}'` });
    }
  }

  return result;
}

/**
 * `request <METHOD> <path>`: a raw Graph call as the token source's user.
 */
export const REQUEST_COMMAND: CommandModule = {
  command: 'request <method> <path>',
  describe: 'Make a raw Microsoft Graph request (path relative to https://graph.microsoft.com/v1.0)',
  builder: (yargs: Argv) =>
    yargs
      .positional('method', { type: 'string', demandOption: true, choices: MSGRAPH_CLI_REQUEST_METHODS, coerce: (x: string) => x.toUpperCase(), describe: 'HTTP method' })
      .positional('path', { type: 'string', demandOption: true, describe: 'Graph path, e.g. /me or /me/messages' })
      .option('query', { type: 'string', describe: 'JSON query parameters, e.g. \'{"$top":5}\'' })
      .option('body', { type: 'string', describe: 'JSON request body' })
      .option('all-pages', { type: 'boolean', default: false, describe: 'GET only: follow @odata.nextLink and return every item' })
      .option('max-pages', { type: 'number', describe: 'With --all-pages: stop after this many pages (default 20)' })
      .example([
        ['$0 request GET /me', 'The signed-in user'],
        ['$0 request GET /me/messages --query \'{"$top":5,"$select":"subject"}\'', 'Five message subjects'],
        ['$0 request GET /me/events --all-pages', 'Every event, following nextLink']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const method = argv.method as FetchMethod;
    const path = argv.path as string;
    const query = parseMsGraphCliJsonOption<MicrosoftGraphQuery>('query', argv.query);
    const body = parseMsGraphCliJsonOption<FetchJsonBody>('body', argv.body);

    if (argv.allPages) {
      if (method !== 'GET' || body != null) {
        throw new CliError({ message: '--all-pages only applies to a GET without a body.', code: 'INVALID_ARGUMENT' });
      }

      outputMsGraphCliResult(await microsoftGraphRequestAllPages(graphContext)({ path, query, maxPages: argv.maxPages }));
    } else {
      outputMsGraphCliResult(await microsoftGraphRequest(graphContext)({ method, path, query, body }));
    }
  })
};

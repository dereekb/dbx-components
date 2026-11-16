import { CliError } from '@dereekb/dbx-cli';
import { TRELLO_API_URL } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Argv } from 'yargs';
import { type TrelloCliCommand } from '../context/cli.command';
import { parseTrelloCliJsonOption } from '../util/option';

/**
 * The methods `request` accepts.
 */
export const TRELLO_CLI_REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

/**
 * Input for {@link trelloCliRequestPath}.
 */
export interface TrelloCliRequestPathInput {
  /**
   * The path as typed: relative to the api base, or an absolute url.
   */
  readonly path: string;
  /**
   * The api base url, e.g. `https://api.trello.com/1`.
   */
  readonly apiUrl: string;
}

/**
 * Turns a `request` path into a path relative to the api base. An absolute url is accepted only on the api's own origin
 * and base path, so a raw request can never carry the credentials to another host.
 *
 * @param input - The path as typed and the api base url.
 * @returns The path relative to the base, with its query string.
 * @throws {CliError} `INVALID_ARGUMENT` for a url on another host or outside the api base.
 */
export function trelloCliRequestPath(input: TrelloCliRequestPathInput): string {
  const { path, apiUrl } = input;
  let result: string;

  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    const base = new URL(apiUrl);
    let url: Maybe<URL>;

    try {
      url = new URL(path);
    } catch {
      url = undefined;
    }

    const basePath = base.pathname.replace(/\/+$/, '');

    if (url?.origin !== base.origin || (basePath.length > 0 && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`))) {
      throw new CliError({ message: `"${path}" is not on the Trello api (${apiUrl}).`, code: 'INVALID_ARGUMENT', suggestion: `request only calls the Trello api. Pass a path relative to ${apiUrl}, e.g. /members/me.` });
    }

    result = `${url.pathname.slice(basePath.length) || '/'}${url.search}`;
  } else {
    result = path.startsWith('/') ? path : `/${path}`;
  }

  return result;
}

/**
 * The `request <method> <path>` escape hatch: a raw call to the Trello REST api with the run's credentials. The path is
 * relative to `https://api.trello.com/1` (or `--api-url`); absolute urls on any other host are refused.
 */
export const TRELLO_CLI_REQUEST_COMMAND: TrelloCliCommand = {
  command: 'request <method> <path>',
  describe: 'Make a raw Trello REST request (path relative to https://api.trello.com/1)',
  builder: (yargs: Argv) =>
    yargs
      .positional('method', { type: 'string', demandOption: true, choices: TRELLO_CLI_REQUEST_METHODS, coerce: (x: string) => x.toUpperCase(), describe: 'HTTP method' })
      .positional('path', { type: 'string', demandOption: true, describe: 'Api path, e.g. /members/me or /boards/<id>/cards' })
      .option('query', { type: 'string', describe: 'JSON query parameters, e.g. \'{"fields":"name,url"}\'' })
      .option('body', { type: 'string', describe: 'JSON request body' })
      .example([
        ['$0 request GET /members/me', 'The authenticated member'],
        ['$0 request GET /boards/AbCd1234/cards --query \'{"fields":"name,idList"}\'', 'Card names and lists on a board'],
        ['$0 request PUT /cards/AbCd1234 --body \'{"name":"New title"}\'', 'Rename a card']
      ]),
  handler: async (argv, ctx) => {
    const trelloContext = ctx.trelloContext;
    const apiUrl = trelloContext.config.apiUrl ?? TRELLO_API_URL;
    const query = parseTrelloCliJsonOption<Record<string, unknown>>('query', argv['query']);
    const body = parseTrelloCliJsonOption<unknown>('body', argv['body']);
    let path = trelloCliRequestPath({ path: String(argv['path']), apiUrl });

    if (query != null) {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(query)) {
        if (value != null) {
          params.append(key, String(value));
        }
      }

      path = `${path}${path.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    const response = await trelloContext.fetch(path, { method: String(argv['method']), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    let data: unknown = text;

    if ((response.headers.get('content-type') ?? '').includes('json') || /^\s*[[{]/.test(text)) {
      try {
        data = text.length > 0 ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
    }

    ctx.output.result(data);
  }
};

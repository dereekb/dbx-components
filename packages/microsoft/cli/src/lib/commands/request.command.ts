import { CliError } from '@dereekb/dbx-cli';
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { outputMsGraphCliResult } from '../util/output';
import { MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER, DEFAULT_MICROSOFT_GRAPH_RAW_CONTENT_TYPE, type MicrosoftGraphHeaders, type MicrosoftGraphQuery, type MicrosoftGraphRawResponse, microsoftGraphRequest, microsoftGraphRequestAllPages, microsoftGraphRequestRaw } from '@dereekb/microsoft';
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
 * Parses repeatable `--header 'Name: value'` options into a header record.
 *
 * @param values - The raw option values (a single string or an array).
 * @returns The headers, or undefined when none are given.
 * @throws {CliError} `INVALID_ARGUMENT` when a value has no `:` or an empty name.
 */
export function parseMsGraphCliHeaderOptions(values: unknown): Maybe<MicrosoftGraphHeaders> {
  const list = (Array.isArray(values) ? values : [values]).filter((x): x is string => typeof x === 'string');
  let result: Maybe<MicrosoftGraphHeaders>;

  list.forEach((value) => {
    const separator = value.indexOf(':');
    const name = separator > 0 ? value.slice(0, separator).trim() : '';

    if (!name) {
      throw new CliError({ message: `--header "${value}" is not in the form "Name: value".`, code: 'INVALID_ARGUMENT', suggestion: `e.g. --header 'Prefer: ${MICROSOFT_GRAPH_IMMUTABLE_ID_PREFER}'` });
    }

    result = { ...result, [name]: value.slice(separator + 1).trim() };
  });

  return result;
}

/**
 * Picks the `Content-Type` for a `--body-file` upload when `--content-type` is not given: JSON for a
 * `.json` file, plain text for `.txt` / `.csv` / `.md`, otherwise `application/octet-stream`.
 *
 * @param path - The body file path.
 * @returns The content type.
 */
export function msGraphCliContentTypeForFile(path: string): string {
  const extension = extname(path).toLowerCase();
  let result = DEFAULT_MICROSOFT_GRAPH_RAW_CONTENT_TYPE;

  if (extension === '.json') {
    result = 'application/json';
  } else if (extension === '.txt' || extension === '.csv' || extension === '.md') {
    result = 'text/plain';
  }

  return result;
}

/**
 * What `request` prints for a raw response (`--raw-out` / `--include-headers`).
 */
export interface MsGraphCliRawRequestOutput {
  readonly status: number;
  /**
   * With `--include-headers`: the response headers (names lower-cased).
   */
  readonly headers?: MicrosoftGraphHeaders;
  /**
   * With `--raw-out`: the file the body was written to. The bytes never go to stdout.
   */
  readonly file?: string;
  readonly bytes: number;
  readonly contentType?: string;
  /**
   * Without `--raw-out`: the body parsed as JSON, or as text for a `text/*` response. A binary body is
   * left out; write it with `--raw-out`.
   */
  readonly body?: unknown;
}

/**
 * Builds the `request` output for a raw response.
 *
 * @param response - The raw Graph response.
 * @param options - Whether the headers are included and where the body was written.
 * @param options.includeHeaders - Whether to print the response headers.
 * @param options.file - The file the body was written to (`--raw-out`), if any.
 * @returns The output.
 */
export function msGraphCliRawRequestOutput(response: MicrosoftGraphRawResponse, options: { readonly includeHeaders: boolean; readonly file?: Maybe<string> }): MsGraphCliRawRequestOutput {
  const contentType = response.headers['content-type'];
  let body: unknown;

  if (!options.file && response.body.length > 0) {
    if (contentType?.includes('json')) {
      body = response.json();
    } else if (contentType?.startsWith('text/')) {
      body = response.text();
    }
  }

  return {
    status: response.status,
    ...(options.includeHeaders ? { headers: response.headers } : {}),
    ...(options.file ? { file: options.file } : {}),
    bytes: response.body.length,
    ...(contentType ? { contentType } : {}),
    ...(body === undefined ? {} : { body })
  };
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
      .option('body-file', { type: 'string', describe: 'Send this file as the raw request body (e.g. an upload); see --content-type' })
      .option('content-type', { type: 'string', describe: 'With --body-file: the body Content-Type (default: from the file extension, else application/octet-stream)' })
      .option('header', { type: 'string', array: true, describe: "Extra request header 'Name: value' (repeatable), e.g. 'Prefer: IdType=\"ImmutableId\"'" })
      .option('raw-out', { type: 'string', describe: 'Write the raw response body to this file (a download, MIME); stdout gets the path and byte count, never the bytes' })
      .option('include-headers', { type: 'boolean', default: false, describe: 'Print { status, headers, body } instead of the body alone (e.g. to read a 202 Location header)' })
      .option('all-pages', { type: 'boolean', default: false, describe: 'GET only: follow @odata.nextLink and return every item' })
      .option('max-pages', { type: 'number', describe: 'With --all-pages: stop after this many pages (default 20)' })
      .conflicts('body', 'body-file')
      .example([
        ['$0 request GET /me', 'The signed-in user'],
        ['$0 request GET /me/messages --query \'{"$top":5,"$select":"subject"}\'', 'Five message subjects'],
        ['$0 request GET /me/events --all-pages', 'Every event, following nextLink'],
        ['$0 request GET /me/drive/items/{id}/content --raw-out report.xlsx', 'Download a file'],
        ['$0 request PUT /me/drive/root:/notes.txt:/content --body-file notes.txt', 'Upload a small file'],
        ['$0 request GET /me/messages --header \'Prefer: IdType="ImmutableId"\'', 'Message ids that survive a move']
      ]),
  handler: msGraphCommandHandler(async (argv: any, { graphContext }) => {
    const method = argv.method as FetchMethod;
    const path = argv.path as string;
    const query = parseMsGraphCliJsonOption<MicrosoftGraphQuery>('query', argv.query);
    const body = parseMsGraphCliJsonOption<FetchJsonBody>('body', argv.body);
    const headers = parseMsGraphCliHeaderOptions(argv.header);
    const bodyFile = argv.bodyFile as Maybe<string>;
    const rawOut = argv.rawOut as Maybe<string>;
    const includeHeaders = Boolean(argv.includeHeaders);
    const raw = Boolean(bodyFile || rawOut || includeHeaders);

    if (argv.allPages) {
      if (method !== 'GET' || body != null || raw) {
        throw new CliError({ message: '--all-pages only applies to a GET without a body, --body-file, --raw-out or --include-headers.', code: 'INVALID_ARGUMENT' });
      }

      outputMsGraphCliResult(await microsoftGraphRequestAllPages(graphContext)({ path, query, headers, maxPages: argv.maxPages }));
    } else if (raw) {
      let rawBody: Maybe<Uint8Array | string>;
      let contentType: Maybe<string>;

      if (bodyFile) {
        rawBody = await readFile(bodyFile);
        contentType = argv.contentType ?? msGraphCliContentTypeForFile(bodyFile);
      } else if (body != null) {
        rawBody = JSON.stringify(body);
        contentType = 'application/json';
      }

      const response = await microsoftGraphRequestRaw(graphContext)({ method, path, query, headers, body: rawBody, contentType });

      if (rawOut) {
        await writeFile(rawOut, response.body);
      }

      outputMsGraphCliResult(msGraphCliRawRequestOutput(response, { includeHeaders, file: rawOut }));
    } else {
      outputMsGraphCliResult(await microsoftGraphRequest(graphContext)({ method, path, query, body, headers }));
    }
  })
};

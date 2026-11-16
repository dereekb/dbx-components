import { type Maybe } from '@dereekb/util';
import { DOCS_API_PATH, DOCS_NOT_FOUND_ERROR_CODE, DOCS_SECTION_NOT_FOUND_ERROR_CODE, docsApiReadPath, docsApiSearchPath, type DocsListResult, type DocsReadParams, type DocsReadResult, type DocsSearchParams, type DocsSearchResult } from '@dereekb/firebase';
import { cliHandoffRemintSuggestion, describeCliAuthFailureSuggestion, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE } from '../auth/auth-failure.hint';
import { getApiJsonOverHttp } from '../api/call-model.client';
import { type CliContextCredential } from '../context/cli.context';
import { CliError, CliHttpError } from '../util/output';

/**
 * Default name of the built-in docs command group registered by `createCli()`.
 */
export const DEFAULT_DOCS_API_COMMAND_NAME = 'docs';

/**
 * CLI error code for a 404 that carries no docs server code: the API at the env's `apiBaseUrl` has not mounted the
 * docs API (`docsApiModuleMetadata()`).
 */
export const DOCS_API_NOT_AVAILABLE_ERROR_CODE = 'DOCS_API_NOT_AVAILABLE';

/**
 * Inputs shared by the docs API client functions.
 */
export interface DocsApiClientInput {
  /**
   * The env's API base URL (carries the `/api` prefix).
   */
  readonly apiBaseUrl: string;
  readonly accessToken: string;
  /**
   * The CLI's name, used in the error suggestions.
   */
  readonly cliName: string;
  /**
   * The active env's name, used in the error suggestions.
   */
  readonly envName: string;
  /**
   * The docs group's name, used in the error suggestions. Defaults to {@link DEFAULT_DOCS_API_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
  /**
   * The space-delimited scopes the credential carries, when known.
   */
  readonly scope?: Maybe<string>;
  readonly credential?: Maybe<Pick<CliContextCredential, 'handoff' | 'refreshable'>>;
  /**
   * Custom fetch implementation for tests.
   */
  readonly fetcher?: Maybe<typeof fetch>;
}

/**
 * Lists the docs the caller may read (`GET <apiBaseUrl>/docs`).
 *
 * @param input - The API target, credential and suggestion context.
 * @returns The visible docs.
 * @throws {CliError} A plain {@link CliError} with a docs-specific suggestion on a non-2xx response.
 */
export function listDocsOverHttp(input: DocsApiClientInput): Promise<DocsListResult> {
  return requestDocsApi<DocsListResult>({ input, path: DOCS_API_PATH, errorPrefix: 'docs list failed' });
}

/**
 * Searches the docs the caller may read (`GET <apiBaseUrl>/docs/search?q=&limit=`). The server ranks the hits exactly
 * like the MCP documentation search tool.
 *
 * @param input - The API target, credential and suggestion context, plus the query and optional limit.
 * @returns The ranked hits.
 * @throws {CliError} A plain {@link CliError} with a docs-specific suggestion on a non-2xx response.
 */
export function searchDocsOverHttp(input: DocsApiClientInput & DocsSearchParams): Promise<DocsSearchResult> {
  return requestDocsApi<DocsSearchResult>({ input, path: docsApiSearchPath({ query: input.query, limit: input.limit }), errorPrefix: `docs search "${input.query}" failed` });
}

/**
 * Reads one doc, or one of its sections (`GET <apiBaseUrl>/docs/read?id=&section=`).
 *
 * @param input - The API target, credential and suggestion context, plus the doc id and optional section id.
 * @returns The doc content.
 * @throws {CliError} A plain {@link CliError} with a docs-specific suggestion on a non-2xx response.
 */
export function readDocOverHttp(input: DocsApiClientInput & DocsReadParams): Promise<DocsReadResult> {
  const target = input.section ? `${input.id} ${input.section}` : input.id;
  return requestDocsApi<DocsReadResult>({ input, path: docsApiReadPath({ id: input.id, section: input.section }), errorPrefix: `docs read ${target} failed`, docId: input.id });
}

/**
 * Inputs to {@link describeDocsApiFailureSuggestion}.
 */
export interface DescribeDocsApiFailureSuggestionInput {
  readonly status: number;
  readonly serverCode?: Maybe<string>;
  readonly cliName: string;
  readonly envName: string;
  /**
   * The docs group's name. Defaults to {@link DEFAULT_DOCS_API_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
  /**
   * The env's API base URL, named when the API has not mounted the docs API.
   */
  readonly apiBaseUrl?: Maybe<string>;
  /**
   * The space-delimited scopes the credential carries, when known.
   */
  readonly scope?: Maybe<string>;
  readonly credential?: Maybe<Pick<CliContextCredential, 'handoff' | 'refreshable'>>;
  /**
   * The doc id that was read, when the failure came from a read.
   */
  readonly docId?: Maybe<string>;
}

/**
 * Builds the suggestion for a failed docs API request.
 *
 * - 401 and a 403 other than a missing scope reuse {@link describeCliAuthFailureSuggestion}.
 * - A 403 for the docs API's required OIDC scope explains how to get a credential that carries it.
 * - A 404 for a doc explains that docs outside the caller's audiences read as not found, so ids cannot be probed.
 * - A 404 for a section points at the section ids, or reading the whole doc.
 * - A 404 without a docs code means the API has not mounted the docs API.
 *
 * @param input - The response status and server code, plus the CLI, env and credential in context.
 * @returns The suggestion text, or `undefined` when there is no useful remediation.
 * @__NO_SIDE_EFFECTS__
 */
export function describeDocsApiFailureSuggestion(input: DescribeDocsApiFailureSuggestionInput): Maybe<string> {
  const { status, serverCode, cliName, envName, scope, credential } = input;
  const docs = `${cliName} ${input.commandName ?? DEFAULT_DOCS_API_COMMAND_NAME}`;
  const handoff = credential?.handoff === true;
  let result: Maybe<string>;

  if (status === 403 && serverCode === MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE) {
    const who = handoff ? 'credential' : 'login';
    const carries = scope ? ` It carries \`${scope}\`.` : '';
    const intro = `The app's docs API requires an OIDC scope this ${who} lacks (the error names it).${carries}`;
    result = handoff
      ? `${intro} Its scopes were fixed when it was minted. ${cliHandoffRemintSuggestion({ cliName, envName })} Leave the tool's \`scopes\` unset so the credential keeps the scope.`
      : `${intro} Run with an env whose scopes include it (\`${docs} list --env <env>\`), or add it to this env with \`${cliName} auth setup --env ${envName} --scopes "<scopes> <scope>"\` and then \`${cliName} auth login --env ${envName}\`.`;
  } else if (status === 401 || status === 403) {
    result = describeCliAuthFailureSuggestion({ status, serverCode, cliName, envName, scope, credential });
  } else if (status === 404 && serverCode === DOCS_NOT_FOUND_ERROR_CODE) {
    result = `No doc you can read has this id. Docs published to an audience you do not hold read as not found, the same as a missing doc. List the docs you can read with \`${docs} list\`, or search them with \`${docs} search <words..>\`.`;
  } else if (status === 404 && serverCode === DOCS_SECTION_NOT_FOUND_ERROR_CODE) {
    const id = input.docId ?? '<id>';
    result = `Use one of the section ids the error lists, or read the whole doc with \`${docs} read ${id}\`. List section ids with \`${docs} list --sections\`.`;
  } else if (status === 404) {
    const at = input.apiBaseUrl ? ` at ${input.apiBaseUrl}` : '';
    result = `The API${at} has not mounted the docs API (\`/api/docs\`). Check the env's \`apiBaseUrl\` (\`${cliName} env show ${envName}\`), or that the app's API imports \`docsApiModuleMetadata()\`.`;
  }

  return result;
}

// MARK: Internal
interface RequestDocsApiConfig {
  readonly input: DocsApiClientInput;
  readonly path: string;
  readonly errorPrefix: string;
  readonly docId?: string;
}

async function requestDocsApi<T>(config: RequestDocsApiConfig): Promise<T> {
  const { input, path, errorPrefix, docId } = config;

  try {
    return await getApiJsonOverHttp<T>({ apiBaseUrl: input.apiBaseUrl, path, accessToken: input.accessToken, errorPrefix, fetcher: input.fetcher ?? undefined });
  } catch (error) {
    throw error instanceof CliHttpError ? docsApiError(error, input, docId) : error;
  }
}

/**
 * Rethrows an HTTP failure as a plain {@link CliError} so the runner's generic 401/403 mapper (which rewrites only
 * {@link CliHttpError} suggestions) keeps the docs-specific suggestion.
 *
 * @param error - The HTTP failure.
 * @param input - The client input carrying the suggestion context.
 * @param docId - The doc id that was read, if any.
 * @returns The plain error to throw.
 */
function docsApiError(error: CliHttpError, input: DocsApiClientInput, docId?: string): CliError {
  const { status, serverCode } = error;
  const isDocsNotFound = serverCode === DOCS_NOT_FOUND_ERROR_CODE || serverCode === DOCS_SECTION_NOT_FOUND_ERROR_CODE;
  const code = status === 404 && !isDocsNotFound ? DOCS_API_NOT_AVAILABLE_ERROR_CODE : error.code;
  const suggestion = describeDocsApiFailureSuggestion({ status, serverCode, cliName: input.cliName, envName: input.envName, commandName: input.commandName, apiBaseUrl: input.apiBaseUrl, scope: input.scope, credential: input.credential, docId }) ?? error.suggestion;

  return new CliError({ message: error.message, code, ...(serverCode ? { serverCode } : undefined), ...(suggestion ? { suggestion } : undefined) });
}

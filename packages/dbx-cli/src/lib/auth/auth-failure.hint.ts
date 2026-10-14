import { type Maybe } from '@dereekb/util';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE } from '@dereekb/firebase';
import { type CliContextCredential, getCliContext } from '../context/cli.context';
import { type CliErrorMapper, type CliErrorOutput, CliHttpError, sanitizeString } from '../util/output';

/**
 * Server error code for a missing endpoint-level OIDC scope.
 *
 * Mirrors `MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE` in `@dereekb/firebase-server`. Duplicated rather than
 * imported so `@dereekb/dbx-cli` keeps taking no dependency on `@dereekb/firebase-server`.
 */
export const MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE = 'MISSING_ENDPOINT_OIDC_SCOPE_ERROR';

/**
 * Server error codes that mean "the credential is valid but lacks a scope this call needs".
 */
export const CLI_MISSING_SCOPE_SERVER_ERROR_CODES: ReadonlySet<string> = new Set([CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, MISSING_ENDPOINT_OIDC_SCOPE_ERROR_CODE]);

/**
 * Inputs to {@link cliHandoffRemintSuggestion}.
 */
export interface CliHandoffRemintSuggestionInput {
  readonly cliName: string;
  readonly envName: string;
}

/**
 * The recovery for a handoff credential that lapsed or was rejected: mint a fresh claim code and redeem it.
 *
 * Names the MCP tool by its pattern — the prefix belongs to the MCP server that minted the code, which
 * this CLI cannot see.
 *
 * @param input - The CLI and env names.
 * @returns The suggestion text.
 * @__NO_SIDE_EFFECTS__
 */
export function cliHandoffRemintSuggestion(input: CliHandoffRemintSuggestionInput): string {
  return `Mint a fresh claim code with the MCP server's CLI token tool (\`<prefix>_cli_token\`) and run \`${input.cliName} auth handoff <code> --env ${input.envName}\`.`;
}

/**
 * Inputs to {@link describeCliAuthFailureSuggestion}.
 */
export interface DescribeCliAuthFailureSuggestionInput {
  readonly status: number;
  readonly serverCode?: Maybe<string>;
  readonly cliName: string;
  readonly envName: string;
  /**
   * The space-delimited scopes the credential carries, when known.
   */
  readonly scope?: Maybe<string>;
  readonly credential?: Maybe<Pick<CliContextCredential, 'handoff' | 'refreshable'>>;
}

/**
 * Builds the suggestion for a 401/403 response from what the CLI knows about its credential.
 *
 * Tells apart the three causes a user can actually act on: the credential expired or was revoked
 * (401 — log in again, or re-mint a handoff credential), the credential lacks a SCOPE the call needs
 * (403 with a scope code), and the user lacks a ROLE (any other 403). Logging in again cannot fix
 * either 403, so neither suggests it.
 *
 * @param input - The response status and server code, plus the credential in context.
 * @returns The suggestion text, or `undefined` for a status other than 401/403.
 * @__NO_SIDE_EFFECTS__
 */
export function describeCliAuthFailureSuggestion(input: DescribeCliAuthFailureSuggestionInput): Maybe<string> {
  const { status, serverCode, cliName, envName, scope, credential } = input;
  const handoff = credential?.handoff === true;
  const carries = scope ? ` It carries \`${scope}\`.` : '';
  let result: Maybe<string>;

  if (status === 401) {
    result = handoff ? `The handoff credential was rejected (expired or revoked) and cannot be refreshed. ${cliHandoffRemintSuggestion({ cliName, envName })}` : `The credentials were rejected. Run \`${cliName} auth login --env ${envName}\`.`;
  } else if (status === 403) {
    if (serverCode != null && CLI_MISSING_SCOPE_SERVER_ERROR_CODES.has(serverCode)) {
      const fix = handoff ? ' Re-mint the credential without narrowing `scopes` (or include the scope this call needs).' : " Add the scope to the env's scopes and log in again.";
      result = `The credential is valid but lacks the scope this call needs.${carries}${fix}`;
    } else {
      const fix = handoff ? ' If it was minted with narrowed `scopes`, check that the app’s claims scope was kept.' : '';
      result = `The credential is valid, but the user lacks the role or permission this call needs; logging in again will not change that.${carries}${fix}`;
    }
  }

  return result;
}

/**
 * {@link CliErrorMapper} that rewrites the suggestion on a 401/403 {@link CliHttpError} from the
 * credential in the active {@link CliContext}. Every other error falls through to the next mapper.
 *
 * @param error - The thrown value.
 * @returns The mapped envelope, or `undefined` when the error is not a 401/403 HTTP error.
 */
export const cliAuthFailureErrorMapper: CliErrorMapper = (error: unknown): Maybe<CliErrorOutput> => {
  let result: Maybe<CliErrorOutput>;

  if (error instanceof CliHttpError && (error.status === 401 || error.status === 403)) {
    const context = getCliContext();

    if (context != null) {
      const suggestion = describeCliAuthFailureSuggestion({
        status: error.status,
        serverCode: error.serverCode,
        cliName: context.cliName,
        envName: context.envName,
        scope: context.scope,
        credential: context.credential
      });

      result = { ok: false, error: sanitizeString(error.message), code: error.code, ...((suggestion ?? error.suggestion) ? { suggestion: suggestion ?? error.suggestion } : {}) };
    }
  }

  return result;
};

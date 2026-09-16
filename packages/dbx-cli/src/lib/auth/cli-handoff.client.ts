import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { CliError, tracedFetch } from '../util/output';

/**
 * Path, relative to the OIDC issuer, of the one-time claim redemption endpoint.
 *
 * Mirrors `FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH` on the server. Duplicated rather than imported so
 * `@dereekb/dbx-cli` keeps taking no dependency on `@dereekb/firebase-server`.
 */
export const CLI_TOKEN_CLAIM_ENDPOINT_PATH_PART = '/cli-token/claim';

/**
 * The credential bundle `POST <issuer>/cli-token/claim` returns — everything a bare machine needs to
 * create an env and be logged in.
 *
 * The server-side shape is `CliTokenHandoffBundle` in `@dereekb/firebase-server/oidc`.
 */
export interface CliHandoffBundle {
  readonly uid: string;
  readonly issuer: string;
  readonly apiBaseUrl?: string;
  /**
   * The env name the minting deployment says it is. Advisory — an explicit `--env` still wins — but
   * it is what lets the rendered one-line handoff command work on a machine with no config at all.
   */
  readonly envName?: string;
  readonly clientId: string;
  readonly refreshToken: string;
  readonly scope: string;
  readonly expiresAt: ISO8601DateString;
}

/**
 * Inputs to {@link claimCliHandoff}.
 */
export interface ClaimCliHandoffInput {
  /**
   * The env's OIDC issuer URL, e.g. `https://example.com/oidc`.
   */
  readonly oidcIssuer: string;
  /**
   * The one-time claim code an MCP session's `cli-token` tool produced.
   */
  readonly code: string;
}

/**
 * Builds the claim endpoint URL from an OIDC issuer.
 *
 * @param oidcIssuer - The env's OIDC issuer URL.
 * @returns The claim endpoint URL.
 * @__NO_SIDE_EFFECTS__
 */
export function buildCliHandoffClaimEndpoint(oidcIssuer: string): string {
  return `${oidcIssuer.replace(/\/+$/, '')}${CLI_TOKEN_CLAIM_ENDPOINT_PATH_PART}`;
}

/**
 * Redeems a one-time claim code for the credential bundle it wraps.
 *
 * The request carries no credential of its own — the code IS the credential, which is the entire
 * point: the machine running this has nothing yet. The server answers every failure (unknown code,
 * expired code, already-redeemed code) with the same generic error, so this reports one message too
 * rather than inventing a distinction the server deliberately withholds.
 *
 * @param input - The issuer and the claim code.
 * @returns The parsed {@link CliHandoffBundle}.
 * @throws {CliError} `AUTH_HANDOFF_FAILED` when the code is rejected or the response is unusable.
 */
export async function claimCliHandoff(input: ClaimCliHandoffInput): Promise<CliHandoffBundle> {
  const endpoint = buildCliHandoffClaimEndpoint(input.oidcIssuer);
  let response: Response;

  try {
    response = await tracedFetch(undefined, endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: input.code })
    });
  } catch (e) {
    throw new CliError({
      message: `Could not reach the CLI handoff endpoint at ${endpoint}: ${(e as Error).message}`,
      code: 'AUTH_HANDOFF_FAILED',
      suggestion: 'Verify the env oidcIssuer URL is reachable.'
    });
  }

  if (!response.ok) {
    throw new CliError({
      message: 'The claim code was rejected. Claim codes are single-use and expire within minutes.',
      code: 'AUTH_HANDOFF_FAILED',
      suggestion: 'Mint a fresh one with the `cli-token` MCP tool and redeem it right away.'
    });
  }

  const bundle = (await readJsonSafely(response)) as Maybe<CliHandoffBundle>;

  if (!bundle?.refreshToken || !bundle.clientId || !bundle.issuer) {
    throw new CliError({
      message: 'The CLI handoff response did not carry a usable credential.',
      code: 'AUTH_HANDOFF_FAILED'
    });
  }

  return bundle;
}

async function readJsonSafely(response: Response): Promise<unknown> {
  let result: unknown;

  try {
    result = await response.json();
  } catch {
    result = undefined;
  }

  return result;
}

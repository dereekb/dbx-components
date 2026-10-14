import { type ISO8601DateString, type Maybe } from '@dereekb/util';
import { type CliTokenCredentialType, CLI_TOKEN_BEARER_CREDENTIAL_TYPE, CLI_TOKEN_REFRESH_CREDENTIAL_TYPE } from '@dereekb/firebase';
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
  /**
   * The CLI OAuth client the credential's grant belongs to. A refresh credential must be refreshed as
   * this client; a bearer credential only records it in the env.
   */
  readonly clientId: string;
  /**
   * The kind of credential the bundle carries. Absent from a server that predates bearer handoffs,
   * whose bundles are always refresh credentials — see {@link cliHandoffBundleCredentialType}.
   */
  readonly credentialType?: CliTokenCredentialType;
  /**
   * The bearer access token, for a bearer credential. Used directly; cannot be refreshed.
   */
  readonly accessToken?: string;
  /**
   * The token type of {@link CliHandoffBundle.accessToken}.
   */
  readonly tokenType?: string;
  /**
   * The refresh token, for a refresh credential.
   */
  readonly refreshToken?: string;
  readonly scope: string;
  readonly expiresAt: ISO8601DateString;
}

/**
 * Reads a bundle's credential type, treating a bundle with no `credentialType` (from a server that
 * predates bearer handoffs) as a refresh credential.
 *
 * @param bundle - The redeemed bundle.
 * @returns The bundle's credential type.
 * @__NO_SIDE_EFFECTS__
 */
export function cliHandoffBundleCredentialType(bundle: Pick<CliHandoffBundle, 'credentialType'>): CliTokenCredentialType {
  return bundle.credentialType === CLI_TOKEN_BEARER_CREDENTIAL_TYPE ? CLI_TOKEN_BEARER_CREDENTIAL_TYPE : CLI_TOKEN_REFRESH_CREDENTIAL_TYPE;
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
   * The one-time claim code an MCP session's CLI token tool (`<prefix>_cli_token`) produced.
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
      // the tool's prefix belongs to the MCP server that minted the code, which this CLI cannot see —
      // so name the pattern rather than guess one spelling of it
      suggestion: "Mint a fresh one with the MCP server's CLI token tool (`<prefix>_cli_token`) and redeem it right away."
    });
  }

  const bundle = (await readJsonSafely(response)) as Maybe<CliHandoffBundle>;

  if (!bundle || !isUsableCliHandoffBundle(bundle)) {
    throw new CliError({
      message: 'The CLI handoff response did not carry a usable credential.',
      code: 'AUTH_HANDOFF_FAILED'
    });
  }

  return bundle;
}

// A bundle is usable when it names its client and issuer and carries the secret its type calls for.
// A bearer credential also needs a parseable expiry, since nothing can refresh it.
function isUsableCliHandoffBundle(bundle: CliHandoffBundle): boolean {
  let hasCredential: boolean;

  if (cliHandoffBundleCredentialType(bundle) === CLI_TOKEN_BEARER_CREDENTIAL_TYPE) {
    hasCredential = Boolean(bundle.accessToken) && Number.isFinite(Date.parse(bundle.expiresAt));
  } else {
    hasCredential = Boolean(bundle.refreshToken);
  }

  return hasCredential && Boolean(bundle.clientId) && Boolean(bundle.issuer);
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

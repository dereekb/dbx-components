import { type ISO8601DateString, type Maybe, type PromiseOrValue, type Seconds, type WebsiteUrl, SECONDS_IN_HOUR, SECONDS_IN_MINUTE } from '@dereekb/util';
import { type FirebaseAuthUserId, type OidcScope, type OidcScopeTerm, CLI_TOKEN_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';

// MARK: Paths
/**
 * Path (relative to the OIDC issuer) of the CLI-token mint endpoint.
 *
 * Under the `oidc` controller prefix the route is `POST /oidc/cli-token`.
 */
export const CLI_TOKEN_MINT_PATH_PART = 'cli-token';

/**
 * Path (relative to the OIDC issuer) of the one-time claim redemption endpoint.
 *
 * Under the `oidc` controller prefix the route is `POST /oidc/cli-token/claim`.
 */
export const CLI_TOKEN_CLAIM_PATH_PART = 'cli-token/claim';

/**
 * Full path of the mint endpoint, as an app must list it in the OIDC module's `protectedPaths`.
 *
 * The mint reads `req.auth`, which only the bearer-token middleware populates. Note this is the
 * MINT path specifically — {@link FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH} must NOT be protected, since
 * the claim code IS the credential there and a bearer middleware would 401 the machine redeeming it.
 *
 * The OIDC routes are excluded from the global `/api` prefix (see
 * `FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE`), so the path carries no `/api` prefix.
 */
export const FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH = '/oidc/cli-token';

/**
 * Full path of the unauthenticated claim endpoint.
 *
 * Deliberately a SUFFIX of {@link FIREBASE_SERVER_CLI_TOKEN_API_PROTECTED_PATH}'s prefix, so an app
 * that protects `/oidc/cli-token` by prefix would also protect this one. The middleware config
 * therefore has to exclude it — see `OidcAuthMiddlewareConfig.unprotectedPaths`.
 */
export const FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH = '/oidc/cli-token/claim';

// MARK: TTL
/**
 * Hard ceiling on a minted CLI credential's lifetime, in seconds (one hour).
 *
 * NEVER configurable upward: the credential is minted non-interactively by whatever already holds
 * the session, and the child grant does not cascade-revoke with its parent (see
 * {@link OidcCliTokenService}), so the short ceiling IS the mitigation.
 */
export const MAX_CLI_TOKEN_TTL_SECONDS: Seconds = SECONDS_IN_HOUR;

/**
 * Default lifetime requested for a minted CLI credential when the caller asks for none.
 */
export const DEFAULT_CLI_TOKEN_TTL_SECONDS: Seconds = SECONDS_IN_HOUR;

/**
 * Window a one-time claim code may be redeemed within, in seconds.
 *
 * Short by design: the code only has to survive the hop from the minting agent to the machine
 * running the CLI. The credential it unwraps lives its own (also short) life from the mint.
 */
export const CLI_TOKEN_CLAIM_TTL_SECONDS: Seconds = 5 * SECONDS_IN_MINUTE;

/**
 * Number of random bytes behind a claim code. 32 bytes base64url-encodes to 43 characters.
 */
export const CLI_TOKEN_CLAIM_CODE_BYTES = 32;

// MARK: Scopes
/**
 * Scopes a minted CLI credential NEVER inherits, no matter what the minting session holds.
 *
 * - `token.cli` — no chaining: a handoff credential must not be able to mint another one.
 * - `token.service` — no escalation: that scope is the 365-day, non-rotating tier, and a one-hour
 *   credential must not be able to trade itself up into one.
 *
 * Everything else the caller holds (including `session.firestore`) inherits normally — the child is
 * exactly as privileged as its parent, minus these two.
 */
export const CLI_TOKEN_DENIED_INHERITED_OIDC_SCOPES: readonly OidcScope[] = [CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE];

/**
 * Scope always unioned into a minted credential's grant, so the refresh-token grant is coherent.
 */
export const CLI_TOKEN_REQUIRED_OIDC_SCOPE: OidcScope = OFFLINE_ACCESS_OIDC_SCOPE;

/**
 * The default {@link CliTokenApiModuleConfig.requiredScope}, re-exported for apps that want to widen
 * it into an OR-group rather than replace it.
 */
export const DEFAULT_CLI_TOKEN_REQUIRED_OIDC_SCOPE: OidcScopeTerm = CLI_TOKEN_OIDC_SCOPE;

// MARK: Admin Predicate
/**
 * Signature for the predicate that authorizes a caller to mint a CLI credential.
 *
 * Receives the calling request's auth data (`undefined` for an unauthenticated request) and returns
 * true when that caller may mint. Typically an admin check, e.g.
 * `(auth) => authRoleClaimsService.toRoles(auth?.token ?? {}).has('admin')`.
 *
 * This is the LOAD-BEARING gate — the `token.cli` scope check beside it is defence in depth only,
 * because a non-OIDC caller carries no `scope` claim and every enforcement site treats that as
 * "skip". When no predicate is provided the endpoint fails closed for EVERY caller.
 */
export type CliTokenAdminPredicate = (auth: Maybe<FirebaseServerAuthData>) => PromiseOrValue<boolean>;

/**
 * NestJS injection token for the {@link CliTokenAdminPredicate} provider.
 */
export const CLI_TOKEN_ADMIN_PREDICATE = 'CLI_TOKEN_ADMIN_PREDICATE';

// MARK: Config
/**
 * Configuration for the CLI-token mint endpoint, supplied by the app via its dependency module.
 *
 * Without a config the endpoint is DISABLED: there is no safe default for `cliClientId`, and minting
 * against the wrong client would hand the CLI a credential its own `client_id` cannot refresh.
 */
export abstract class CliTokenApiModuleConfig {
  /**
   * The registered OAuth `client_id` of the app's CLI client — the same client the CLI's
   * `auth setup` was configured with.
   *
   * REQUIRED. When absent (or unresolvable at the provider) the endpoint is disabled.
   */
  readonly cliClientId!: string;
  /**
   * OIDC scope term an OIDC caller must hold to mint. Defaults to
   * {@link DEFAULT_CLI_TOKEN_REQUIRED_OIDC_SCOPE}. Pass `null` to disable scope enforcement entirely
   * (the admin predicate remains the real gate either way).
   */
  readonly requiredScope?: Maybe<OidcScopeTerm> | null;
  /**
   * Lifetime requested for a minted credential when the caller names none. Clamped to
   * {@link MAX_CLI_TOKEN_TTL_SECONDS}. Defaults to {@link DEFAULT_CLI_TOKEN_TTL_SECONDS}.
   */
  readonly defaultTtlSeconds?: Seconds;
  /**
   * The app's API base URL, echoed into the handoff bundle so a machine with no prior `auth setup`
   * can bootstrap an env from the bundle alone.
   */
  readonly apiBaseUrl?: WebsiteUrl;
}

// MARK: Results
/**
 * Result of a successful mint. Carries ONLY the one-time claim code — never the refresh token, which
 * would otherwise land in an MCP transcript and a shell history.
 */
export interface CliTokenMintResult {
  /**
   * The one-time code to redeem at `POST /oidc/cli-token/claim`.
   */
  readonly claimCode: string;
  /**
   * When the CLAIM CODE stops being redeemable.
   */
  readonly claimExpiresAt: ISO8601DateString;
  /**
   * When the minted CREDENTIAL itself expires — always within {@link MAX_CLI_TOKEN_TTL_SECONDS}.
   */
  readonly expiresAt: ISO8601DateString;
  /**
   * The space-delimited scopes the minted credential carries.
   */
  readonly scope: string;
}

/**
 * The credential bundle handed back by `POST /oidc/cli-token/claim`. Everything a bare machine needs
 * to create a CLI env and be logged in.
 */
export interface CliTokenHandoffBundle {
  /**
   * The uid the credential was minted for — the minting caller's own uid.
   */
  readonly uid: FirebaseAuthUserId;
  /**
   * The OIDC issuer the credential is valid at.
   */
  readonly issuer: WebsiteUrl;
  /**
   * The app's API base URL, when the app configured one. Lets a machine with no prior `auth setup`
   * create the env from this bundle alone.
   */
  readonly apiBaseUrl?: WebsiteUrl;
  /**
   * The CLI OAuth client the refresh token is bound to. The CLI must present THIS `client_id` when
   * refreshing — a refresh token is client-bound.
   */
  readonly clientId: string;
  /**
   * The refresh token itself. The only place it is ever returned.
   */
  readonly refreshToken: string;
  /**
   * The space-delimited scopes the credential carries.
   */
  readonly scope: string;
  /**
   * When the credential expires.
   */
  readonly expiresAt: ISO8601DateString;
}

// MARK: Scope Resolution
/**
 * Inputs to {@link resolveCliTokenScopes}.
 */
export interface ResolveCliTokenScopesInput {
  /**
   * The scopes the MINTING caller holds. The minted credential can never exceed this set.
   */
  readonly callerScopes: Maybe<ReadonlySet<OidcScope>>;
  /**
   * An optional subset the caller asked for. May only NARROW `callerScopes` — any scope named here
   * that the caller does not hold is dropped.
   */
  readonly requestedScopes?: Maybe<readonly OidcScope[]>;
}

/**
 * Resolves the scope set a minted CLI credential carries.
 *
 * `granted = callerScopes ∩ (requestedSubset ?? callerScopes) − {token.cli, token.service} ∪ {offline_access}`
 *
 * The intersection is what makes the mint non-amplifying: the caller may narrow, never widen. The
 * deny-list is the only asymmetry, and it exists so a one-hour credential cannot manufacture a
 * longer-lived or further-minting one.
 *
 * @param input - The caller's scopes and the optional requested subset.
 * @returns The space-delimited scope string to grant.
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliTokenScopes(input: ResolveCliTokenScopesInput): string {
  const { callerScopes, requestedScopes } = input;
  const denied = new Set<OidcScope>(CLI_TOKEN_DENIED_INHERITED_OIDC_SCOPES);
  const available = callerScopes ?? new Set<OidcScope>();
  const requested = requestedScopes == null ? undefined : new Set<OidcScope>(requestedScopes);

  const granted = new Set<OidcScope>();

  for (const scope of available) {
    if (!denied.has(scope) && (requested == null || requested.has(scope))) {
      granted.add(scope);
    }
  }

  // a refresh-token grant that does not carry offline_access is incoherent — the credential exists
  // only to be refreshed
  granted.add(CLI_TOKEN_REQUIRED_OIDC_SCOPE);

  return Array.from(granted).join(' ');
}

// MARK: TTL Resolution
/**
 * Inputs to {@link resolveCliTokenTtlSeconds}.
 */
export interface ResolveCliTokenTtlSecondsInput {
  /**
   * The TTL the caller asked for, if any.
   */
  readonly requestedTtlSeconds?: Maybe<Seconds>;
  /**
   * The app-configured default, used when the caller asks for none.
   */
  readonly defaultTtlSeconds?: Maybe<Seconds>;
  /**
   * Seconds of life remaining on the MINTING caller's own grant, when known. A child must never
   * outlive its parent.
   */
  readonly parentRemainingSeconds?: Maybe<Seconds>;
}

/**
 * Resolves a minted credential's lifetime as
 * `min(requested ?? default, MAX_CLI_TOKEN_TTL_SECONDS, parentRemaining)`, floored at one second.
 *
 * @param input - The requested/default TTL and the parent grant's remaining life.
 * @returns The TTL to mint with, in seconds.
 * @__NO_SIDE_EFFECTS__
 */
export function resolveCliTokenTtlSeconds(input: ResolveCliTokenTtlSecondsInput): Seconds {
  const { requestedTtlSeconds, defaultTtlSeconds, parentRemainingSeconds } = input;
  const requested = requestedTtlSeconds != null && requestedTtlSeconds > 0 ? requestedTtlSeconds : (defaultTtlSeconds ?? DEFAULT_CLI_TOKEN_TTL_SECONDS);
  const candidates: Seconds[] = [requested, MAX_CLI_TOKEN_TTL_SECONDS];

  if (parentRemainingSeconds != null && parentRemainingSeconds > 0) {
    candidates.push(parentRemainingSeconds);
  }

  return Math.max(1, Math.floor(Math.min(...candidates)));
}

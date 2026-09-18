import { type AuthClaims, type AuthRoleSet, type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type FirestoreModelType, type OidcModelScopeRequirement, type OidcScope, type OidcScopeTerm } from '@dereekb/firebase';

/**
 * Default path the MCP Streamable HTTP transport is mounted at.
 *
 * Combined with the app origin to form the canonical MCP resource URL
 * (e.g., `https://api.example.com/mcp`) advertised in the protected-resource
 * discovery document at `/.well-known/oauth-protected-resource`.
 */
export const DEFAULT_MCP_PATH = '/mcp';

/**
 * Default name advertised by the MCP server on the JSON-RPC `initialize` handshake.
 *
 * Apps may override this via {@link McpModuleConfig.serverName} to identify their
 * deployment (e.g., `demo-api-mcp`, `hellosubs-api-mcp`).
 */
export const DEFAULT_MCP_SERVER_NAME = 'dbx-firebase-server-mcp';

/**
 * Default `instructions` string advertised by the MCP server on the JSON-RPC `initialize`
 * handshake. Apps may override this via {@link McpModuleConfig.serverInstructions}.
 */
export const DEFAULT_MCP_SERVER_INSTRUCTIONS = 'A set of call-model tools generated automatically.';

/**
 * Default name of the auto-injected reason parameter added to every advertised MCP tool's input
 * schema. See {@link McpReasonParameterConfig.parameterName}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_NAME = 'reason';

/**
 * Default maximum length (in characters) of the auto-injected reason parameter. Values longer than
 * this are clamped server-side before being forwarded to analytics. See
 * {@link McpReasonParameterConfig.maxLength}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH = 250;

/**
 * Default required-ness of the auto-injected reason parameter. See
 * {@link McpReasonParameterConfig.required}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_REQUIRED = true;

/**
 * Default description advertised for the auto-injected reason parameter on every tool's input schema.
 * See {@link McpReasonParameterConfig.description}.
 */
export const DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION = 'A brief human-readable reason (≤250 chars) explaining why this tool is being called. Recorded for analytics/audit only; not part of the operation.';

/**
 * Configuration for the auto-injected `reason` parameter the MCP server adds to every advertised
 * tool's input schema.
 *
 * When enabled (the default), the server augments each tool's `inputSchema` with a `reason` string
 * property — a short human-readable justification for the call, surfaced to the model and recorded on
 * the per-call analytics event. The field is stripped from the JSON body before the args are
 * dispatched to the underlying handler, so call-model handlers never receive it.
 *
 * Supplied to {@link McpModuleConfig.reasonParameter} as a full object (to tune individual fields), or
 * as a boolean shorthand (`true` = defaults on, `false` = disabled).
 */
export interface McpReasonParameterConfig {
  /**
   * Whether the reason parameter is injected at all. Defaults to `true`. Set `false` to disable
   * (equivalent to `reasonParameter: false`).
   */
  readonly enabled?: boolean;
  /**
   * Whether the parameter is marked `required` in the advertised input schema. Defaults to
   * {@link DEFAULT_MCP_REASON_PARAMETER_REQUIRED}.
   */
  readonly required?: boolean;
  /**
   * Maximum character length advertised (`maxLength`) and enforced server-side (the forwarded value is
   * clamped). Defaults to {@link DEFAULT_MCP_REASON_PARAMETER_MAX_LENGTH}.
   */
  readonly maxLength?: number;
  /**
   * Description advertised for the parameter on each tool's input schema. Defaults to
   * {@link DEFAULT_MCP_REASON_PARAMETER_DESCRIPTION}.
   */
  readonly description?: string;
  /**
   * Name of the injected parameter. Defaults to {@link DEFAULT_MCP_REASON_PARAMETER_NAME} (`'reason'`).
   * Rename to avoid colliding with a handler that legitimately consumes a `reason` input field.
   */
  readonly parameterName?: string;
}

/**
 * Filter applied to the OIDC provider's advertised scope list when building the MCP
 * protected-resource metadata's `scopes_supported`. Receives every scope the provider
 * issues to an arbitrary client (from `OidcProviderConfigService.clientRequestableScopesSupported`)
 * and returns the subset to advertise. Supplied via {@link McpModuleConfig.scopesSupported};
 * when unset, all of them are advertised.
 */
export type McpScopesSupportedFilter = (allScopes: readonly OidcScope[]) => readonly OidcScope[];

/**
 * Configuration for the firebase-server/mcp module.
 *
 * Apps construct this in their `*McpModule` provider and pass it through
 * {@link mcpModuleMetadata}. It carries:
 *
 * - The canonical issuer URL for the OIDC provider that gates this MCP endpoint
 *   (used in the protected-resource discovery document).
 * - The canonical resource URL where the MCP transport is mounted (also part of
 *   the discovery document; doubles as the `resource` claim consumers should
 *   verify their access tokens against).
 * - Optional server identity (name, version) advertised on the MCP `initialize` handshake.
 *
 * The OAuth bearer middleware that authenticates `/mcp` is configured on
 * {@link OidcModuleConfig.protectedPaths} — that's outside this config's scope.
 */
export abstract class McpModuleConfig {
  /**
   * The canonical issuer URL of the OIDC provider that gates this MCP endpoint.
   *
   * Surfaced in the `authorization_servers` field of the protected-resource
   * discovery document. Claude custom-connector reads this to discover the OIDC issuer.
   *
   * @example 'https://api.example.com/oidc'
   */
  readonly oidcIssuer!: string;

  /**
   * The canonical resource URL of the MCP endpoint.
   *
   * Surfaced as the `resource` field of the protected-resource discovery document,
   * and used as the audience the access token's `aud` claim should match.
   *
   * @example 'https://api.example.com/mcp'
   */
  readonly mcpUrl!: string;

  /**
   * Optional filter applied to the OIDC provider's scope list when building the
   * protected-resource discovery document's `scopes_supported` (RFC 9728 §2).
   *
   * The base list is pulled automatically from the OIDC provider config via the
   * injected {@link OidcProviderConfigService.clientRequestableScopesSupported}, so
   * the MCP resource advertises the scopes the issuer grants an arbitrary client
   * without the app restating them. Scopes only an admin-assigned provider profile
   * unlocks are excluded from that base list, since an unassigned client can never
   * be granted one. Provide this to narrow the set further — or to add such a gated
   * scope back deliberately, which is safe: the consent URL builder withholds it
   * from any client whose profiles do not unlock it, so that client's flow completes
   * without it rather than failing. When unset, the whole base list is advertised.
   *
   * Advertising these matters because dynamic-registration MCP clients (the Claude
   * Code CLI) read `scopes_supported` to decide which scopes to request on the
   * authorization call; with none advertised they authorize with no `scope`, leaving
   * the OIDC provider nothing to grant and ending the interaction in `access_denied`.
   *
   * @example (allScopes) => allScopes.filter((scope) => scope === 'openid' || scope.startsWith('model.'))
   */
  readonly scopesSupported?: McpScopesSupportedFilter;

  /**
   * Optional name advertised on the MCP `initialize` handshake. Defaults to
   * {@link DEFAULT_MCP_SERVER_NAME}.
   */
  readonly serverName?: string;

  /**
   * Optional version advertised on the MCP `initialize` handshake.
   */
  readonly serverVersion?: string;
  /**
   * Optional override for the `instructions` string passed to `new McpServer(...)` and
   * advertised on the JSON-RPC `initialize` handshake. Defaults to
   * {@link DEFAULT_MCP_SERVER_INSTRUCTIONS}.
   */
  readonly serverInstructions?: string;
  /**
   * Absolute path to a pre-rendered MCP manifest JSON file produced by
   * `dbx-cli-generate-mcp-manifest`. When set, the runtime reads it once at
   * boot and uses each tool's `description`, `inputSchema`, and `outputSchema`
   * during tool generation — no per-request file I/O.
   *
   * Optional. When unset or the file is missing, the runtime falls back to
   * today's behavior (auto-generated descriptions, ArkType-derived input
   * schemas, no output schemas) and emits a single boot warning.
   */
  readonly mcpManifestPath?: string;
  /**
   * Absolute path to a pre-rendered route manifest JSON file produced by
   * `dbx-cli-generate-route-manifest`. When set, the runtime reads it once at
   * boot and registers the built-in `url-models` tool, which decodes an app URL
   * into the Firestore models its page renders.
   *
   * Optional. When unset or the file is missing, the runtime skips registering
   * `url-models` and emits a single boot warning when the path was set but
   * unreadable.
   */
  readonly mcpRouteManifestPath?: string;
  /**
   * When `true`, the MCP server only advertises tools whose effective read-only classification is `true`.
   *
   * Write tools (`create`/`update`/`delete`) and tools with unknown classification (e.g., `invoke`
   * with no explicit `mcp.readOnly` override) are dropped from `tools/list` — fail-safe under the
   * principle that anything not provably read-only is treated as a write.
   *
   * The advertised `serverName` on the JSON-RPC `initialize` handshake is suffixed with
   * ` (read-only)` so the client surface reflects the mode.
   */
  readonly readOnly?: boolean;

  /**
   * Controls the auto-injected `reason` parameter added to every advertised tool's input schema.
   *
   * Enabled by default (unset / `true` = defaults on). Pass a {@link McpReasonParameterConfig} object
   * to tune `required`, `maxLength`, `description`, or `parameterName`, or `false` to disable it.
   *
   * When enabled, every advertised tool's `inputSchema` carries a required `reason` string the model
   * fills with a short justification for the call. The value is forwarded to analytics and stripped
   * from the dispatched handler body. See {@link McpReasonParameterConfig}.
   */
  readonly reasonParameter?: McpReasonParameterConfig | boolean;

  /**
   * Default OIDC scope group term required on EVERY `callModel` op, mirrored into MCP tool-list
   * visibility, unless a finer term overrides it (a per-function `requiredScope`, then a
   * {@link McpModuleConfig.modelRequiredScopes} entry). Threaded into the same
   * `resolveEffectiveOidcScopeTerms` composition the server-side model-api scope gate
   * (`assertModelApiOidcScope`) uses, so a tool is advertised only when the caller could actually invoke it.
   *
   * Set this to the SAME value passed to `ModelApiDispatchConfig.defaultRequiredScope` to
   * keep tool visibility and enforcement in lockstep.
   */
  readonly defaultRequiredScope?: OidcScopeTerm;
  /**
   * Per-model OIDC scope group-term overrides, keyed by {@link FirestoreModelType}, mirrored into MCP
   * tool-list visibility. Set this to the SAME value passed to
   * `ModelApiDispatchConfig.modelRequiredScopes` so per-model / verb-keyed restrictions that
   * confine a subset client apply identically to the advertised tool list.
   */
  readonly modelRequiredScopes?: Record<FirestoreModelType, OidcModelScopeRequirement>;
}

/**
 * Signature for the optional role reader the MCP module uses when evaluating
 * declarative {@link McpVisibilityRule.requiredRoles} on `tools/list`.
 *
 * The MCP factory does not have access to the constructed `FirebaseServerAuthContext`
 * (that's built later by the dispatch chain), so apps wire a thin function that
 * maps the caller's Firebase custom claims to the corresponding role set —
 * typically `authRoleClaimsService(...).toRoles` from `@dereekb/util`.
 *
 * When no reader is provided, declarative role checks fail closed (treated as
 * "missing role"), and the factory emits a single boot-time warning.
 */
export type McpAuthRoleReader = (claims: AuthClaims) => AuthRoleSet;

/**
 * NestJS injection token for the optional {@link McpAuthRoleReader} provider.
 */
export const MCP_AUTH_ROLE_READER = 'MCP_AUTH_ROLE_READER';

/**
 * Signature for the optional predicate that authorizes `model-roles` calls which target another
 * user's uid.
 *
 * `model-roles` resolves permissions for the calling user by default, which is always safe. Passing
 * a `uid` asks the server "what can *that* user do here?" — an answer that leaks the target's
 * effective access, so it is gated behind this app-supplied predicate rather than being open.
 *
 * Receives the calling request's auth data (`undefined` for an unauthenticated request) and returns
 * true if that caller may resolve roles for arbitrary uids. Typically an admin check, e.g.
 * `(auth) => authRoleClaimsService.toRoles(auth?.token ?? {}).has('admin')`.
 *
 * When no predicate is provided the `uid` parameter fails closed for every caller — the tool is
 * still registered and still answers for the caller themselves.
 */
export type McpModelRolesTargetUidPredicate = (auth: Maybe<FirebaseServerAuthData>) => PromiseOrValue<boolean>;

/**
 * NestJS injection token for the optional {@link McpModelRolesTargetUidPredicate} provider.
 */
export const MCP_MODEL_ROLES_TARGET_UID_PREDICATE = 'MCP_MODEL_ROLES_TARGET_UID_PREDICATE';

// MARK: CLI Token Minter
/**
 * Input handed to an {@link McpCliTokenMinter}.
 */
export interface McpCliTokenMintInput {
  /**
   * The calling request's auth data — the identity the minted credential belongs to.
   */
  readonly auth: Maybe<FirebaseServerAuthData>;
  /**
   * An optional subset of the caller's own scopes to grant. May only narrow.
   */
  readonly scopes?: Maybe<readonly string[]>;
  /**
   * An optional requested lifetime in seconds, clamped by the minter.
   */
  readonly ttlSeconds?: Maybe<number>;
  /**
   * When true, ask the minter to also produce a signed, self-authenticating download URL for the
   * CLI binary so a bare machine can fetch it before redeeming the claim code.
   */
  readonly includeDownloadUrl?: boolean;
  /**
   * The calling MCP session's client address, resolved from the tool call's raw request.
   *
   * Forwarded so a mint through the MCP surface records the same address an HTTP mint does. Without
   * it an app that binds a claim code to its minting address would silently apply that binding on one
   * path and not the other — a gate that looks enabled while doing nothing is worse than none.
   */
  readonly requestIp?: Maybe<string>;
}

/**
 * What an {@link McpCliTokenMinter} returns. Carries the one-time claim code and NEVER the refresh
 * token — the tool's output reaches an MCP transcript, and a refresh token must not.
 */
export interface McpCliTokenMintResult {
  readonly claimCode: string;
  readonly claimExpiresAt: string;
  readonly expiresAt: string;
  readonly scope: string;
  /**
   * The CLI's binary name, used to render the exact `<cli> auth handoff <code>` command.
   */
  readonly cliName?: string;
  /**
   * A signed download URL for the CLI binary, when one was requested and the app wired the
   * download path.
   */
  readonly downloadUrl?: string;
  /**
   * SHA-256 of the artifact behind {@link downloadUrl}, so the caller can verify what it fetched.
   */
  readonly downloadSha256?: string;
  /**
   * Name of the CLI env the credential should be redeemed into, from `CliTokenApiModuleConfig.envName`.
   *
   * Load-bearing for the rendered `handoffCommand`, not decorative. `dbx-cli auth handoff` resolves
   * the issuer to POST the claim to from the ACTIVE env — so on a machine with no active env the
   * bare command fails `AUTH_HANDOFF_NO_ISSUER`, and on one active against a different env it aims
   * the claim at the wrong issuer. A built-in env NAME is only a default template until something
   * instantiates it, so it cannot be relied on to already exist. The deployment is the only party
   * that knows which env it is; passing it through is what lets the tool render a command the target
   * machine can run unmodified.
   */
  readonly envName?: string;
}

/**
 * Signature for the optional app-supplied CLI credential minter behind the `cli-token` MCP tool.
 *
 * Minting needs `OidcService.getProvider()`, which lives in `@dereekb/firebase-server/oidc`. Routing
 * it through an app-supplied injection token — the same shape as
 * {@link McpModelRolesTargetUidPredicate} — keeps `@dereekb/firebase-server/mcp` app-agnostic and
 * free of a dependency on the oidc package.
 *
 * When no minter is provided the `cli-token` tool is not registered at all.
 */
export type McpCliTokenMinter = (input: McpCliTokenMintInput) => PromiseOrValue<McpCliTokenMintResult>;

/**
 * NestJS injection token for the optional {@link McpCliTokenMinter} provider.
 */
export const MCP_CLI_TOKEN_MINTER = 'MCP_CLI_TOKEN_MINTER';

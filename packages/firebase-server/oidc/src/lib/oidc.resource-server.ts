import { type BuildIssuerProfilesConfig, type BuildIssuerProfilesOidcIssuerInput } from '@dereekb/oauth-resource';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe, type Seconds, type WebsiteUrlWithPrefix, unique } from '@dereekb/util';
import { allOidcScopesStringForProviderConfig, type OidcModuleConfig, type OidcProviderConfig, type OidcResourceServerInfo } from './oidc.config';

// MARK: Resource Servers
export interface BuildOidcResourceServerConfig {
  /**
   * The RFC 8707 resource indicator — the value a client sends as `resource=` on `/authorize` and
   * `/token`, and the key this entry is registered under. Usually the resource's full URL, e.g.
   * `https://db.example.com/mcp`.
   */
  readonly url: WebsiteUrlWithPrefix;
  /**
   * Space-delimited scopes valid on this resource server. Issued access tokens are filtered to the
   * intersection of the client-requested scopes and this allow-list, so keep it to what the
   * resource actually understands rather than every scope the provider issues.
   */
  readonly scope: string;
  /**
   * `aud` claim placed on tokens bound to this resource. Defaults to {@link url}.
   *
   * An OFF-BOX resource server usually wants its ORIGIN here (`https://db.example.com`) rather
   * than the `/mcp` resource-indicator URL, so one audience covers every route it serves.
   */
  readonly audience?: Maybe<string>;
  /**
   * Access-token format. Defaults to oidc-provider's `'opaque'`.
   *
   * **Set `'jwt'` for any resource server that is not this API process.** An opaque access token is
   * a database key: it can only be validated by the issuer's own adapter store, so a remote service
   * fundamentally cannot verify it. A `'jwt'` token is an RS256 JWT signed with the provider's
   * active JWKS key (no extra provider config needed — `getResourceServerConfig` falls back to
   * `clientDefaults.id_token_signed_response_alg`, i.e. `RS256`), which any service can verify via
   * `@dereekb/oauth-resource` against the published `/.well-known/jwks.json`.
   *
   * The trade-off: a JWT access token is NOT persisted by oidc-provider, so it has no adapter
   * record and **cannot be revoked before `exp`**. Revoking the Grant stops refresh and future
   * issuance but leaves outstanding JWTs valid — keep {@link accessTokenTTL} short.
   */
  readonly accessTokenFormat?: Maybe<'opaque' | 'jwt'>;
  /**
   * Access-token TTL for this resource, in seconds. Falls back to the provider's `ttl.AccessToken`.
   */
  readonly accessTokenTTL?: Maybe<Seconds>;
}

/**
 * Builds a single-entry {@link OidcResourceServerInfo} map for an RFC 8707 resource indicator.
 *
 * This is the supported way to declare a resource server the provider issues tokens for —
 * including one that runs OFF-BOX (a Docker'd sidecar, a worker, a standalone MCP host), which is
 * what {@link BuildOidcResourceServerConfig.accessTokenFormat} `'jwt'` exists for.
 *
 * @param config - The resource indicator, its scopes, and the token shape to issue for it.
 * @returns A single-entry map keyed by the resource indicator.
 *
 * @example
 * ```ts
 * const DB_ORIGIN = 'https://db.example.com';
 *
 * oidcModuleMetadata({
 *   dependencyModule: MyOidcDependencyModule,
 *   config: {
 *     resourceServers: buildOidcResourceServer({
 *       url: `${DB_ORIGIN}/mcp`,
 *       scope: 'openid profile email offline_access',
 *       audience: DB_ORIGIN,
 *       accessTokenFormat: 'jwt',
 *       accessTokenTTL: 3600
 *     })
 *   }
 * })
 * ```
 */
export function buildOidcResourceServer(config: BuildOidcResourceServerConfig): Record<string, OidcResourceServerInfo> {
  const url = config.url.replace(/\/+$/, '');

  return {
    [url]: {
      scope: config.scope,
      audience: config.audience ?? url,
      ...(config.accessTokenFormat == null ? {} : { accessTokenFormat: config.accessTokenFormat }),
      ...(config.accessTokenTTL == null ? {} : { accessTokenTTL: config.accessTokenTTL })
    }
  };
}

/**
 * Input for {@link buildFirebaseServerMcpResourceServer}.
 */
export interface BuildFirebaseServerMcpResourceServerInput {
  /**
   * The Firebase server environment service. The MCP URL is read from `envService.appMcpUrl`.
   */
  readonly envService: FirebaseServerEnvService;
  /**
   * The OIDC provider config whose scopes back the resource server's `scope` value.
   */
  readonly providerConfig: OidcProviderConfig;
  /**
   * Access-token format. Defaults to oidc-provider's `'opaque'`.
   *
   * See {@link BuildOidcResourceServerConfig.accessTokenFormat}.
   */
  readonly accessTokenFormat?: Maybe<'opaque' | 'jwt'>;
  /**
   * Access-token TTL for the MCP resource, in seconds.
   */
  readonly accessTokenTTL?: Maybe<Seconds>;
}

// COMPAT: superseded by the general-purpose buildOidcResourceServer().
/**
 * Builds a single-entry {@link OidcResourceServerInfo} map for the MCP endpoint
 * declared on `envService.appMcpUrl`, with `scope` set to every scope declared
 * on `providerConfig.claims` (so any scope the provider issues is valid on the
 * resource server) and `audience` set to the MCP URL.
 *
 * Returns `undefined` when no `appMcpUrl` is configured.
 *
 * Used internally by `oidcModuleMetadata` when `OidcModuleConfig.configureMcpResourceServer`
 * is enabled.
 *
 * @param input - The environment service and provider config backing the entry.
 * @returns The single-entry map, or `undefined` when no MCP URL is configured.
 *
 * @deprecated Prefer {@link buildOidcResourceServer}, which takes the URL, scope, audience, and
 * token format explicitly instead of deriving a fixed shape from the environment.
 */
export function buildFirebaseServerMcpResourceServer(input: BuildFirebaseServerMcpResourceServerInput): Record<string, OidcResourceServerInfo> | undefined {
  const { envService, providerConfig } = input;
  const mcpUrl = envService.appMcpUrl;
  let result: Record<string, OidcResourceServerInfo> | undefined;

  if (mcpUrl) {
    result = buildOidcResourceServer({
      url: mcpUrl,
      scope: allOidcScopesStringForProviderConfig(providerConfig),
      audience: mcpUrl,
      accessTokenFormat: input.accessTokenFormat,
      accessTokenTTL: input.accessTokenTTL
    });
  }

  return result;
}

// MARK: Issuer Profiles
export interface FirebaseServerIssuerProfilesConfig {
  /**
   * The provider's own module config. Its `issuer` becomes the trusted OIDC issuer, and every
   * registered `resourceServers` entry contributes its key and `audience` to the accepted
   * audience list.
   */
  readonly oidcModuleConfig: Pick<OidcModuleConfig, 'issuer' | 'resourceServers'>;
  /**
   * Firebase project ids whose ID tokens the resource server also trusts.
   */
  readonly firebaseProjectIds?: Maybe<readonly string[]>;
  /**
   * Extra audiences to accept beyond the ones derived from `resourceServers` — typically the
   * resource server's own origin when it is not itself a registered resource indicator.
   */
  readonly audiences?: Maybe<readonly string[]>;
  /**
   * Overrides how the provider's verification keys are resolved, bypassing discovery. The API
   * verifying its OWN tokens in-process passes a local key set here rather than making an HTTP
   * call back to itself.
   */
  readonly getKey?: Maybe<Required<Exclude<BuildIssuerProfilesOidcIssuerInput, string>>['getKey']>;
  /**
   * `fetch` used for OIDC discovery; injected in specs.
   */
  readonly fetch?: Maybe<typeof fetch>;
}

/**
 * Emits the `@dereekb/oauth-resource` {@link BuildIssuerProfilesConfig} for THIS provider, so an
 * API and the satellite services it issues tokens for cannot drift on issuer / audience strings —
 * both sides read the same `OidcModuleConfig`.
 *
 * The type dependency points `firebase-server → oauth-resource` and never the reverse: the light
 * verify package must stay installable in a plain Express service with no Firebase, Nest, or
 * oidc-provider in its install graph.
 *
 * @param config - The provider's module config plus any extra trusted projects / audiences.
 * @returns The issuer-profile config to hand to `buildIssuerProfiles()`.
 *
 * @example
 * ```ts
 * // inside the API, to hand its satellites a config they cannot get wrong
 * const profilesConfig = firebaseServerIssuerProfiles({ oidcModuleConfig, firebaseProjectIds: [projectId] });
 * const profiles = buildIssuerProfiles(profilesConfig);
 * ```
 */
export function firebaseServerIssuerProfiles(config: FirebaseServerIssuerProfilesConfig): BuildIssuerProfilesConfig {
  const { issuer, resourceServers } = config.oidcModuleConfig;
  const audiences = unique([...oidcResourceServerAudiences(resourceServers), ...(config.audiences ?? [])]);

  return {
    firebaseProjectIds: config.firebaseProjectIds ?? [],
    oidcIssuers: [{ issuer, audiences, getKey: config.getKey }],
    audiences,
    fetch: config.fetch
  };
}

/**
 * Reads every audience a registered resource-server map can put on an access token: each entry's
 * key (the resource indicator, which oidc-provider uses as the audience by default) plus its
 * explicit `audience` when one is configured.
 *
 * @param resourceServers - The provider's registered resource servers, if any.
 * @returns The unique audience values.
 */
export function oidcResourceServerAudiences(resourceServers: Maybe<Record<string, OidcResourceServerInfo>>): string[] {
  const entries = Object.entries(resourceServers ?? {});
  return unique(entries.flatMap(([url, info]) => (info.audience == null ? [url] : [url, info.audience])));
}

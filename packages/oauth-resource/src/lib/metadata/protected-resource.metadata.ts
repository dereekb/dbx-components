import { type Maybe } from '@dereekb/util';

// MARK: Constants
/**
 * RFC 9728 §3 well-known path for OAuth 2.0 protected-resource metadata.
 */
export const OAUTH_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';

/**
 * Builds the RFC 9728 §3.1 path-suffixed well-known path for a resource — the form MCP clients
 * try first (e.g. `/.well-known/oauth-protected-resource/mcp` for a resource served at `/mcp`).
 *
 * @param resourcePath - The resource's path on the origin, with or without a leading slash.
 * @returns The path-suffixed well-known path.
 */
export function oauthProtectedResourcePathForResource(resourcePath: string): string {
  const suffix = resourcePath.replace(/^\/+/, '').replace(/\/+$/, '');
  return suffix.length > 0 ? `${OAUTH_PROTECTED_RESOURCE_PATH}/${suffix}` : OAUTH_PROTECTED_RESOURCE_PATH;
}

// MARK: Document
/**
 * RFC 9728 protected-resource metadata document.
 *
 * Snake-cased because it is the wire document, served verbatim.
 */
export interface OAuthProtectedResourceMetadata {
  readonly resource: string;
  readonly authorization_servers: readonly string[];
  readonly scopes_supported: readonly string[];
  readonly bearer_methods_supported: readonly string[];
  readonly resource_documentation?: string;
  readonly resource_name?: string;
}

export interface BuildProtectedResourceMetadataConfig {
  /**
   * The resource identifier clients pass as the RFC 8707 `resource` parameter, e.g.
   * `https://db.example.com/mcp`.
   */
  readonly resource: string;
  /**
   * Issuers of the authorization servers that may issue tokens for this resource.
   */
  readonly authorizationServers: readonly string[];
  /**
   * Scopes this resource understands, advertised to clients so they can request them up-front.
   */
  readonly scopesSupported?: Maybe<readonly string[]>;
  /**
   * How a bearer token may be presented. Defaults to `['header']` — the only method this package's
   * middleware reads.
   */
  readonly bearerMethodsSupported?: Maybe<readonly string[]>;
  /**
   * Human-readable name of the resource.
   */
  readonly resourceName?: Maybe<string>;
  /**
   * URL of human-readable documentation for the resource.
   */
  readonly resourceDocumentation?: Maybe<string>;
}

/**
 * Builds the RFC 9728 protected-resource metadata document.
 *
 * Hand-rolled deliberately: the MCP SDK's builder also wants the authorization-server metadata
 * document, which a resource server never hosts — it points at one instead.
 *
 * @param config - The resource identifier, its authorization servers, and the advertised scopes.
 * @returns The metadata document.
 */
export function buildProtectedResourceMetadata(config: BuildProtectedResourceMetadataConfig): OAuthProtectedResourceMetadata {
  return {
    resource: config.resource,
    authorization_servers: [...config.authorizationServers],
    scopes_supported: [...(config.scopesSupported ?? [])],
    bearer_methods_supported: [...(config.bearerMethodsSupported ?? ['header'])],
    ...(config.resourceName == null ? {} : { resource_name: config.resourceName }),
    ...(config.resourceDocumentation == null ? {} : { resource_documentation: config.resourceDocumentation })
  };
}

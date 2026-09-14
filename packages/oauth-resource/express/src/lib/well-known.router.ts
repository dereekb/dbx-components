import { buildProtectedResourceMetadata, OAUTH_PROTECTED_RESOURCE_PATH, oauthProtectedResourcePathForResource, type BuildProtectedResourceMetadataConfig, type OAuthProtectedResourceMetadata } from '@dereekb/oauth-resource';
import { type Maybe, type Seconds } from '@dereekb/util';
import cors from 'cors';
import { Router, type RequestHandler } from 'express';

// MARK: Constants
/**
 * How long a client may cache the protected-resource metadata document, in seconds.
 */
export const DEFAULT_PROTECTED_RESOURCE_METADATA_MAX_AGE: Seconds = 300;

// MARK: Router
export interface CreateWellKnownRouterConfig extends BuildProtectedResourceMetadataConfig {
  /**
   * Path of the resource on this origin, used to serve the RFC 9728 §3.1 path-suffixed well-known
   * path (e.g. `/mcp` → `/.well-known/oauth-protected-resource/mcp`, the path clients try first).
   *
   * Defaults to the path component of {@link BuildProtectedResourceMetadataConfig.resource}.
   */
  readonly resourcePath?: Maybe<string>;
  /**
   * `cache-control: public, max-age=` value in seconds. Defaults to
   * {@link DEFAULT_PROTECTED_RESOURCE_METADATA_MAX_AGE}.
   */
  readonly maxAge?: Maybe<Seconds>;
}

/**
 * Serves the RFC 9728 metadata at both the path-suffixed (`…/oauth-protected-resource/mcp`,
 * what clients try first) and bare well-known paths. Public and CORS-open so a browser-based
 * client can discover the issuer, and built once at construction.
 *
 * @param config - The metadata document's inputs plus the resource path and cache lifetime.
 * @returns The router.
 */
export function createWellKnownRouter(config: CreateWellKnownRouterConfig): Router {
  const document = buildProtectedResourceMetadata(config);
  const maxAge = config.maxAge ?? DEFAULT_PROTECTED_RESOURCE_METADATA_MAX_AGE;
  const serve: RequestHandler = (_req, res) => {
    res.setHeader('cache-control', `public, max-age=${maxAge}`).json(document);
  };
  const router = Router();
  const suffixedPath = oauthProtectedResourcePathForResource(config.resourcePath ?? resourcePathForResource(config.resource));

  if (suffixedPath !== OAUTH_PROTECTED_RESOURCE_PATH) {
    router.get(suffixedPath, cors(), serve);
  }

  router.get(OAUTH_PROTECTED_RESOURCE_PATH, cors(), serve);

  return router;
}

/**
 * Re-exported for callers that want the document without the router (e.g. to serve it from
 * another framework).
 */
export type { OAuthProtectedResourceMetadata };

// MARK: Internal
function resourcePathForResource(resource: string): string {
  let path = '';

  try {
    path = new URL(resource).pathname;
  } catch {
    // not an absolute URL — treat the whole value as the path
    path = resource;
  }

  return path;
}

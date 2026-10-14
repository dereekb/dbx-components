import { type AuthRole, type Maybe } from '@dereekb/util';
import { type OidcScopeTerm } from '@dereekb/firebase';
import { type FirebaseServerAuthData } from '../auth.context.server';

// MARK: Paths
/**
 * Route prefix the docs API controller is mounted at. Under the `/api` global route prefix the routes become
 * `/api/docs`, `/api/docs/search` and `/api/docs/read`.
 */
export const DOCS_API_ROUTE_PREFIX = 'docs';

/**
 * Path (relative to the API base URL) of the docs API.
 */
export const DOCS_API_PATH = '/docs';

/**
 * Path prefix apps must add to their OIDC `protectedPaths` so the bearer-token middleware authenticates the docs
 * API. Unlike `/api/download` (which carries its own signed token), every docs route needs a bearer token.
 */
export const FIREBASE_SERVER_DOCS_API_PROTECTED_PATH = '/api/docs';

// MARK: Audiences
/**
 * An audience a doc is published to (e.g. `admin`, `worker`, `school`). Declared per doc in its frontmatter and
 * checked against the generator's `--audiences` allow-list.
 */
export type DocsAudience = string;

/**
 * Reserved audience: any authenticated caller may read the doc. Every caller holds it.
 */
export const DOCS_AUDIENCE_ANY: DocsAudience = 'any';

/**
 * Reads the audiences an authenticated caller holds. {@link DOCS_AUDIENCE_ANY} is always added.
 *
 * Synchronous on purpose: audiences come from the token's claims, and the MCP layer checks doc visibility while it
 * builds the tool list.
 */
export type DocsAudienceReader = (auth: FirebaseServerAuthData) => Iterable<DocsAudience>;

/**
 * Injection token for the app's {@link DocsAudienceReader}. Without one every caller holds only
 * {@link DOCS_AUDIENCE_ANY} (fail-closed), and a warning is logged at boot.
 */
export const DOCS_AUDIENCE_READER = 'DOCS_AUDIENCE_READER';

// MARK: Config
/**
 * Default cap on the characters a single read returns. Longer content is truncated and flagged.
 */
export const DEFAULT_DOCS_MAX_READ_LENGTH = 200_000;

/**
 * Configuration for the docs API, supplied by the app via its dependency module.
 *
 * Without a {@link docsRoot} and {@link docsManifestPath} the API serves no docs.
 *
 * **`docsRoot` must never sit under the download module's `secureAssetsRoot`.** Every file under that root can be
 * minted as a signed download, which would bypass a doc's audience.
 */
export abstract class DocsApiModuleConfig {
  /**
   * Absolute path to the docs folder (the deployed copy of `src/assets/docs`). Docs are only ever read from inside it.
   */
  readonly docsRoot?: Maybe<string>;
  /**
   * Absolute path to the `docs.manifest.json` written by `dbx-cli-generate-docs-manifest`.
   */
  readonly docsManifestPath?: Maybe<string>;
  /**
   * OIDC scope an OIDC caller must hold to use the docs API (REST and MCP). Undefined imposes none; reuse the app's
   * default MCP scope rather than introducing a new one.
   */
  readonly requiredScope?: Maybe<OidcScopeTerm>;
  /**
   * Refuse docs whose bytes no longer match the manifest's `sha256` / `size`. Defaults to true.
   */
  readonly verifyContentHashes?: Maybe<boolean>;
  /**
   * Maximum characters returned by one read. Defaults to {@link DEFAULT_DOCS_MAX_READ_LENGTH}.
   */
  readonly maxReadLength?: Maybe<number>;
}

// MARK: Role Reader
/**
 * Config for {@link docsAudienceReaderForRoles}.
 */
export interface DocsAudienceReaderForRolesConfig {
  /**
   * Reads the caller's roles (e.g. `(auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles(auth.token)`).
   */
  readonly roleReader: (auth: FirebaseServerAuthData) => Iterable<AuthRole>;
  /**
   * Audience → the roles that grant it. Holding any listed role grants the audience.
   */
  readonly audiences: Readonly<Record<DocsAudience, readonly AuthRole[]>>;
}

/**
 * Creates a {@link DocsAudienceReader} that grants audiences from the caller's roles.
 *
 * @param config - The role reader and the audience → roles map.
 * @returns The audience reader.
 * @example
 * ```ts
 * docsAudienceReaderForRoles({
 *   roleReader: (auth) => APP_AUTH_CLAIMS_SERVICE.toRoles(auth.token),
 *   audiences: { admin: [AUTH_ADMIN_ROLE], worker: [AUTH_ADMIN_ROLE, WORKER_ROLE], school: [AUTH_ADMIN_ROLE, SCHOOL_ROLE] }
 * });
 * ```
 */
export function docsAudienceReaderForRoles(config: DocsAudienceReaderForRolesConfig): DocsAudienceReader {
  const entries = Object.entries(config.audiences);

  return (auth) => {
    const roles = new Set(config.roleReader(auth));
    return entries.filter(([, grantingRoles]) => grantingRoles.some((role) => roles.has(role))).map(([audience]) => audience);
  };
}

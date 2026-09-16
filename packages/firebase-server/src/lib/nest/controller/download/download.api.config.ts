import { existsSync, realpathSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { type Maybe, type Seconds, type WebsiteUrl, SECONDS_IN_HOUR, SECONDS_IN_MINUTE } from '@dereekb/util';

// MARK: Paths
/**
 * Route prefix the download controller is mounted at. Under the `/api` global route prefix the route
 * becomes `GET /api/download`.
 */
export const DOWNLOAD_API_ROUTE_PREFIX = 'download';

/**
 * Path (relative to the API base URL) of the signed asset-download endpoint.
 */
export const DOWNLOAD_API_PATH = '/download';

/**
 * Query parameter carrying the signed capability token.
 */
export const DOWNLOAD_API_ASSET_QUERY_PARAM = 'asset';

/**
 * Folder, relative to the app's dist output, that holds every mintable asset.
 *
 * The downloadable set is exactly this ONE folder — nothing outside it is ever mintable, and the
 * containment check in {@link resolveSecureAssetPath} is what enforces that.
 */
export const DEFAULT_SECURE_ASSETS_DIRECTORY = 'assets/secure';

// MARK: Token
/**
 * `aud` claim of a download capability token.
 *
 * Distinct from every OAuth audience so a download token can never be presented as a bearer access
 * token — `oidcProviderIssuerProfiles` only accepts the registered resource-server audiences and the
 * issuer itself.
 */
export const DOWNLOAD_TOKEN_AUDIENCE = 'dbx:asset-download';

/**
 * Header `typ` of a download capability token.
 *
 * **Load-bearing.** The same JWKS signs the provider's `at+jwt` access tokens, so this is the second
 * half of the mutual rejection: the download verifier accepts ONLY this `typ` (plus
 * {@link DOWNLOAD_TOKEN_AUDIENCE}), and the bearer path rejects a download token on its audience.
 */
export const DOWNLOAD_TOKEN_TYP = 'dbx-dl+jwt';

/**
 * `sub` claim of a download capability token. The token carries NO user identifier — the caller is
 * authorized at MINT time and the uid goes to the audit log there, so it never lands in a URL that
 * ends up in shell history and proxy logs.
 */
export const DOWNLOAD_TOKEN_SUBJECT = 'dbx:asset';

/**
 * Claim carrying the asset path, RELATIVE to the secure root. Never absolute.
 */
export const DOWNLOAD_TOKEN_PATH_CLAIM = 'p';

/**
 * Default lifetime of a minted download URL.
 */
export const DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS: Seconds = 10 * SECONDS_IN_MINUTE;

/**
 * Ceiling on a minted download URL's lifetime.
 *
 * A download URL is deliberately NOT one-time — a network blip partway through a multi-megabyte
 * download would otherwise burn it — so the TTL is the whole control, with the token's `jti` logged
 * so a replay is at least visible.
 */
export const MAX_DOWNLOAD_TOKEN_TTL_SECONDS: Seconds = SECONDS_IN_HOUR;

/**
 * The verified claims of a download capability token.
 */
export interface DownloadTokenClaims {
  /**
   * The asset path, relative to the secure root.
   */
  readonly path: string;
  /**
   * The token's unique id, logged so a replay is visible.
   */
  readonly jti?: string;
}

// MARK: Signer
/**
 * Input to {@link DownloadTokenSigner.signToken}.
 */
export interface DownloadTokenSignInput {
  readonly claims: Record<string, unknown>;
  readonly audience: string;
  readonly subject: string;
  readonly typ: string;
  readonly expiresIn: Seconds;
}

/**
 * Result of {@link DownloadTokenSigner.signToken}.
 */
export interface DownloadTokenSignResult {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Input to {@link DownloadTokenSigner.verifyToken}.
 */
export interface DownloadTokenVerifyInput {
  readonly token: string;
  readonly audience: string;
  readonly typ: string;
}

/**
 * App-supplied JWT signer/verifier backing the download capability token.
 *
 * Kept as an interface so `@dereekb/firebase-server` takes no dependency on the OIDC package: the
 * app adapts `OidcJwtSigningService` (whose keys are the provider's own already-rotating JWKS, so
 * there is no new secret to distribute). Nothing outside the download module knows how the token is
 * BUILT — the signer only signs and verifies whatever claims it is handed.
 *
 * Without a signer the endpoint fails closed and no URL can be minted.
 */
export interface DownloadTokenSigner {
  signToken(input: DownloadTokenSignInput): Promise<DownloadTokenSignResult>;
  /**
   * Verifies a token, returning its claims, or `undefined` when it is not a valid token of this
   * `typ` + `audience` from this issuer.
   */
  verifyToken(input: DownloadTokenVerifyInput): Promise<Maybe<Record<string, unknown>>>;
}

/**
 * NestJS injection token for the {@link DownloadTokenSigner} provider.
 */
export const DOWNLOAD_TOKEN_SIGNER = 'DOWNLOAD_TOKEN_SIGNER';

// MARK: Config
/**
 * Configuration for the signed asset-download endpoint, supplied by the app via its dependency module.
 *
 * Without a resolvable {@link secureAssetsRoot} the endpoint fails closed for every request.
 */
export abstract class DownloadApiModuleConfig {
  /**
   * Absolute path to the ONLY folder assets may be served from.
   *
   * Resolve it with the same three-cwd probe the dist manifests use — the Functions runtime, a
   * workspace-root run, and vitest all set different `process.cwd()` values.
   */
  readonly secureAssetsRoot?: Maybe<string>;
  /**
   * The app's API base URL, used to build the absolute minted URL.
   */
  readonly apiBaseUrl?: Maybe<WebsiteUrl>;
  /**
   * Default lifetime for a minted URL. Clamped to {@link MAX_DOWNLOAD_TOKEN_TTL_SECONDS}. Defaults to
   * {@link DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS}.
   */
  readonly defaultTtlSeconds?: Maybe<Seconds>;
}

// MARK: Containment
/**
 * Resolves an asset path, relative to the secure root, to the absolute file it names — or
 * `undefined` when it escapes containment.
 *
 * **This function IS the security model for Part C.** With a folder root rather than a key registry,
 * a mistake here is an arbitrary-file-read primitive on the function's filesystem, so it is enforced
 * in BOTH places (at mint, so a URL for an outside file can never be obtained; and at download, so a
 * bug in the minting path cannot become a read primitive) and both call sites share this one
 * function so they cannot drift.
 *
 * Rejected up front: an absolute path, any `..` segment, a null byte, and an empty path. Then
 * `realpath` is applied to BOTH sides — that is what stops a symlink inside `secure/` from pointing
 * at `/etc` or at the function's `.env`. The final containment compare appends `path.sep` so a
 * sibling directory sharing a name prefix (`secure-other/x`) cannot pass a naive `startsWith`.
 *
 * @param secureRoot - Absolute path to the secure root folder, or `undefined` when unconfigured (⇒ always fails).
 * @param relativePath - The asset path relative to the secure root.
 * @returns The absolute, real path of the file, or `undefined` when it is not a contained regular file.
 * @__NO_SIDE_EFFECTS__
 */
export function resolveSecureAssetPath(secureRoot: Maybe<string>, relativePath: Maybe<string>): Maybe<string> {
  let result: Maybe<string>;

  if (secureRoot && relativePath && isSafeRelativeAssetPath(relativePath)) {
    try {
      const realRoot = realpathSync(secureRoot);
      const candidate = path.resolve(realRoot, relativePath);

      if (existsSync(candidate)) {
        const realCandidate = realpathSync(candidate);

        if (realCandidate.startsWith(realRoot + path.sep) && statSync(realCandidate).isFile()) {
          result = realCandidate;
        }
      }
    } catch {
      // a missing root, a broken symlink, or a permission error are all "not downloadable"
      result = undefined;
    }
  }

  return result;
}

/**
 * Returns true when a relative asset path is structurally safe to resolve — non-empty, relative, free
 * of `..` segments, and free of null bytes.
 *
 * Split out from {@link resolveSecureAssetPath} so the structural rejection is testable without a
 * filesystem, and so the reason a path is refused is one check rather than a compound condition.
 *
 * @param relativePath - The candidate path.
 * @returns True when the path may be resolved against the secure root.
 * @__NO_SIDE_EFFECTS__
 */
export function isSafeRelativeAssetPath(relativePath: string): boolean {
  const normalized = relativePath.trim();
  let result = false;

  if (normalized.length > 0 && !normalized.includes('\0') && !path.isAbsolute(normalized)) {
    // check the SEGMENTS rather than the raw string: a filename legitimately containing '..'
    // (`v1..2.tar`) is fine, while `a/../../etc` is not. Both separators are checked because a
    // Windows-style path reaching a POSIX host would otherwise slip through `path.posix` splitting.
    const segments = new Set(normalized.split(/[/\\]/));
    result = !segments.has('..') && !segments.has('');
  }

  return result;
}

/**
 * Clamps a requested download-URL lifetime to {@link MAX_DOWNLOAD_TOKEN_TTL_SECONDS}.
 *
 * @param requestedTtlSeconds - The requested lifetime, if any.
 * @param defaultTtlSeconds - The app-configured default, used when none is requested.
 * @returns The lifetime to sign with, in seconds.
 * @__NO_SIDE_EFFECTS__
 */
export function downloadTokenTtlSeconds(requestedTtlSeconds: Maybe<Seconds>, defaultTtlSeconds?: Maybe<Seconds>): Seconds {
  const requested = requestedTtlSeconds != null && requestedTtlSeconds > 0 ? requestedTtlSeconds : (defaultTtlSeconds ?? DEFAULT_DOWNLOAD_TOKEN_TTL_SECONDS);
  return Math.max(1, Math.floor(Math.min(requested, MAX_DOWNLOAD_TOKEN_TTL_SECONDS)));
}

// MARK: Content Type
/**
 * File-extension to `Content-Type` table for served assets.
 *
 * Intentionally tiny: the secure root holds build artifacts, and anything unrecognized is served as
 * {@link DEFAULT_DOWNLOAD_CONTENT_TYPE} rather than being guessed at.
 */
export const DOWNLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sha256': 'text/plain; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
  '.tgz': 'application/gzip',
  '.gz': 'application/gzip',
  '.zip': 'application/zip'
};

/**
 * `Content-Type` used for any asset whose extension is not in {@link DOWNLOAD_CONTENT_TYPES}.
 */
export const DEFAULT_DOWNLOAD_CONTENT_TYPE = 'application/octet-stream';

/**
 * Resolves the `Content-Type` for a file path from its extension.
 *
 * @param filePath - The resolved file path.
 * @returns The content type, defaulting to {@link DEFAULT_DOWNLOAD_CONTENT_TYPE}.
 * @__NO_SIDE_EFFECTS__
 */
export function downloadContentTypeForPath(filePath: string): string {
  return DOWNLOAD_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_DOWNLOAD_CONTENT_TYPE;
}

import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { type Readable } from 'node:stream';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { type ISO8601DateString, type Maybe, type Seconds, type WebsiteUrl } from '@dereekb/util';
import { badRequestError, notFoundError, unauthenticatedError } from '../../../function/error';
import {
  DOWNLOAD_API_ASSET_QUERY_PARAM,
  DOWNLOAD_API_PATH,
  DOWNLOAD_TOKEN_AUDIENCE,
  DOWNLOAD_TOKEN_PATH_CLAIM,
  DOWNLOAD_TOKEN_SUBJECT,
  DOWNLOAD_TOKEN_SIGNER,
  DOWNLOAD_TOKEN_TYP,
  DownloadApiModuleConfig,
  type DownloadTokenSigner,
  downloadContentTypeForPath,
  downloadTokenTtlSeconds,
  resolveSecureAssetPath
} from './download.api.config';

// MARK: Errors
/**
 * Error code returned when the `asset` token is missing, malformed, or not a valid download token.
 */
export const DOWNLOAD_INVALID_TOKEN_ERROR_CODE = 'DOWNLOAD_INVALID_TOKEN_ERROR';

/**
 * Error code returned when the token verifies but names nothing servable — a missing file, a
 * directory, or anything that fails containment. Deliberately one code for all three so the endpoint
 * does not report whether a given path exists outside the secure root.
 */
export const DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE = 'DOWNLOAD_ASSET_NOT_FOUND_ERROR';

/**
 * Error code returned when minting is asked for an asset that is not inside the secure root.
 */
export const DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE = 'DOWNLOAD_ASSET_NOT_MINTABLE_ERROR';

// MARK: Types
/**
 * Input to {@link DownloadApiService.downloadUrlForAsset}.
 */
export interface DownloadUrlForAssetInput {
  /**
   * The asset path RELATIVE to the secure root, e.g. `demo-cli`.
   */
  readonly path: string;
  /**
   * Optional lifetime in seconds. Clamped to one hour.
   */
  readonly ttlSeconds?: Maybe<Seconds>;
  /**
   * Optional uid of the caller the URL is being minted for, written to the audit log. NOT put in the
   * token — a download URL lands in shell history and proxy logs.
   */
  readonly forUid?: Maybe<string>;
}

/**
 * A minted download URL.
 */
export interface DownloadUrlForAssetResult {
  readonly url: WebsiteUrl;
  readonly expiresAt: ISO8601DateString;
  /**
   * SHA-256 of the artifact, so the caller can verify what it fetched.
   */
  readonly sha256: string;
  /**
   * Size of the artifact in bytes.
   */
  readonly size: number;
}

/**
 * A resolved, contained asset ready to be streamed.
 */
export interface ResolvedDownloadAsset {
  readonly absolutePath: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly size: number;
  readonly stream: () => Readable;
}

// MARK: Service
/**
 * Mints and resolves signed, self-authenticating asset-download URLs.
 *
 * A minted URL is a capability: anything holding it can fetch exactly one file until it expires. The
 * downloadable set is ONE folder (the app's configured secure root) and the containment check in
 * `resolveSecureAssetPath` runs on BOTH sides — refusing to sign a token for anything outside the
 * root, and refusing to serve one even if a signed token somehow names an outside path.
 *
 * The token is signed with the OIDC provider's own JWKS through an app-supplied
 * {@link DownloadTokenSigner}, so it needs no new secret and rotates with the provider's keys. Its
 * `typ` (`dbx-dl+jwt`) and `aud` (`dbx:asset-download`) are load-bearing discriminators: the bearer
 * middleware must never accept a download token, and this verifier must never accept an access token.
 */
@Injectable()
export class DownloadApiService {
  private readonly _logger = new Logger(DownloadApiService.name);

  constructor(
    @Optional() @Inject(DownloadApiModuleConfig) private readonly config?: DownloadApiModuleConfig,
    @Optional() @Inject(DOWNLOAD_TOKEN_SIGNER) private readonly signer?: DownloadTokenSigner
  ) {
    if (!config?.secureAssetsRoot) {
      this._logger.warn(`No DownloadApiModuleConfig.secureAssetsRoot configured — ${DOWNLOAD_API_PATH} will refuse every request.`);
    }

    if (!signer) {
      this._logger.warn(`No ${DOWNLOAD_TOKEN_SIGNER} provided — ${DOWNLOAD_API_PATH} will refuse every request.`);
    }
  }

  /**
   * Whether the download path is usable at all (a signer AND a secure root are configured).
   */
  get enabled(): boolean {
    return this.signer != null && this.config?.secureAssetsRoot != null;
  }

  /**
   * Mints a signed, self-authenticating URL for one asset inside the secure root.
   *
   * @param input - The asset path, optional TTL, and the minting caller's uid (for the audit log only).
   * @returns The absolute URL, its expiry, and the artifact's SHA-256 + size.
   * @throws {HttpsError} A `400` when the path is not a servable file inside the secure root, or when the endpoint is not configured.
   */
  async downloadUrlForAsset(input: DownloadUrlForAssetInput): Promise<DownloadUrlForAssetResult> {
    const signer = this.signer;
    const secureRoot = this.config?.secureAssetsRoot;
    const apiBaseUrl = this.config?.apiBaseUrl;

    if (signer == null || secureRoot == null || !apiBaseUrl) {
      throw badRequestError({ status: 400, code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE, message: 'Signed asset downloads are not configured for this app.' });
    }

    // refuse to SIGN for anything outside the root: a leaked minting call must not become a leak of
    // the filesystem
    const absolutePath = resolveSecureAssetPath(secureRoot, input.path);

    if (absolutePath == null) {
      throw badRequestError({ status: 400, code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE, message: `No downloadable asset named "${input.path}".` });
    }

    const ttlSeconds = downloadTokenTtlSeconds(input.ttlSeconds, this.config?.defaultTtlSeconds);
    const signed = await signer.signToken({
      claims: { [DOWNLOAD_TOKEN_PATH_CLAIM]: input.path },
      audience: DOWNLOAD_TOKEN_AUDIENCE,
      subject: DOWNLOAD_TOKEN_SUBJECT,
      typ: DOWNLOAD_TOKEN_TYP,
      expiresIn: ttlSeconds
    });

    const url = `${apiBaseUrl.replace(/\/+$/, '')}${DOWNLOAD_API_PATH}?${DOWNLOAD_API_ASSET_QUERY_PARAM}=${encodeURIComponent(signed.token)}`;
    const stats = statSync(absolutePath);
    const sha256 = sha256ForFile(absolutePath);

    this._logger.log(`Minted asset download URL: asset="${input.path}" uid=${input.forUid ?? 'unknown'} ttl=${ttlSeconds}s sha256=${sha256}`);

    return { url, expiresAt: signed.expiresAt.toISOString(), sha256, size: stats.size };
  }

  /**
   * Verifies a download token and resolves the asset it names, re-running containment.
   *
   * @param rawToken - The raw `asset` query parameter.
   * @returns The resolved asset, ready to stream.
   * @throws {HttpsError} A `401` for a missing/invalid/expired token, or a `404` for anything not servable.
   */
  async resolveDownloadRequest(rawToken: Maybe<string>): Promise<ResolvedDownloadAsset> {
    const signer = this.signer;
    const secureRoot = this.config?.secureAssetsRoot;

    if (signer == null || secureRoot == null) {
      // fail CLOSED when unconfigured — a 404, not a 500, so an unconfigured deploy is indistinguishable
      // from a deploy that simply has no such asset
      throw this._notFoundError();
    }

    if (!rawToken) {
      throw this._invalidTokenError();
    }

    // accepts ONLY `typ: dbx-dl+jwt` + `aud: dbx:asset-download`, so an ordinary `at+jwt` access
    // token signed by the SAME JWKS is rejected here just as a download token is rejected by the
    // bearer middleware
    const claims = await signer.verifyToken({ token: rawToken, audience: DOWNLOAD_TOKEN_AUDIENCE, typ: DOWNLOAD_TOKEN_TYP });

    if (claims == null) {
      throw this._invalidTokenError();
    }

    const relativePath = claims[DOWNLOAD_TOKEN_PATH_CLAIM];

    // NEVER trust the token's path just because the signature verified — the same containment check
    // the mint ran, run again, so a bug on the minting side cannot become an arbitrary read
    const absolutePath = typeof relativePath === 'string' ? resolveSecureAssetPath(secureRoot, relativePath) : undefined;

    if (absolutePath == null) {
      this._logger.warn(`Rejected asset download for a non-contained path: jti=${String(claims['jti'] ?? 'unknown')}`);
      throw this._notFoundError();
    }

    const stats = statSync(absolutePath);
    this._logger.log(`Serving asset download: asset="${relativePath}" jti=${String(claims['jti'] ?? 'unknown')} bytes=${stats.size}`);

    return {
      absolutePath,
      fileName: path.basename(absolutePath),
      contentType: downloadContentTypeForPath(absolutePath),
      size: stats.size,
      stream: () => createReadStream(absolutePath)
    };
  }

  // never echo the token back in an error body
  private _invalidTokenError() {
    return unauthenticatedError({ status: 401, code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE, message: 'The download link is invalid or has expired.' });
  }

  private _notFoundError() {
    return notFoundError({ status: 404, code: DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE, message: 'The requested asset is not available.' });
  }
}

/**
 * Computes the SHA-256 of a file, hex-encoded.
 *
 * Read fully into memory rather than streamed: the secure root holds build artifacts in the tens of
 * megabytes at most, and the hash is only computed at mint time (not per download).
 *
 * @param absolutePath - The absolute path to hash.
 * @returns The lowercase hex digest.
 */
export function sha256ForFile(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

import { type Maybe, type Milliseconds, type Seconds } from '@dereekb/util';
import { Inject, Injectable } from '@nestjs/common';
import { type JWK, type KeyInput, SignJWT, importJWK } from 'jose';
import { randomUUID } from 'node:crypto';
import { OidcModuleConfig } from '../oidc.config';
import { JwksService } from './oidc.jwks.service';

// MARK: Constants
/**
 * Default lifetime of a minted JWT, in seconds.
 */
export const DEFAULT_OIDC_SIGNED_JWT_EXPIRES_IN_SECONDS: Seconds = 600;

/**
 * How long the active signing key is cached before it is re-read from the JWKS store.
 *
 * A rotation is picked up within this window; rotated keys stay in the public JWKS for 30 days, so
 * tokens signed with the previous key keep verifying in the meantime.
 */
export const DEFAULT_OIDC_JWT_SIGNING_KEY_CACHE_MS: Milliseconds = 5 * 60 * 1000;

/**
 * Header `typ` for a minted JWT: an RFC 9068 JWT access token, matching the format oidc-provider
 * uses for the `accessTokenFormat: 'jwt'` resource-server tokens.
 */
export const DEFAULT_OIDC_SIGNED_JWT_TYP = 'at+jwt';

// MARK: Types
export interface OidcSignJwtInput {
  /**
   * `aud` claim(s) — the resource the token is for, e.g. an off-box service's origin.
   */
  readonly audience: string | readonly string[];
  /**
   * `sub` claim — the first-party identity of the caller, e.g. `demo-api`.
   */
  readonly subject: string;
  /**
   * Lifetime in seconds. Defaults to {@link DEFAULT_OIDC_SIGNED_JWT_EXPIRES_IN_SECONDS}.
   */
  readonly expiresIn?: Maybe<Seconds>;
  /**
   * Extra claims merged onto the payload, e.g. `{ client_id, scope }`.
   */
  readonly claims?: Maybe<Record<string, unknown>>;
  /**
   * Header `typ`. Defaults to {@link DEFAULT_OIDC_SIGNED_JWT_TYP}.
   */
  readonly typ?: Maybe<string>;
}

export interface OidcSignedJwt {
  readonly token: string;
  readonly expiresAt: Date;
  /**
   * `kid` of the JWKS key that signed the token.
   */
  readonly kid: string;
}

interface CachedSigningKey {
  readonly kid: string;
  readonly key: KeyInput;
  readonly loadedAt: number;
}

// MARK: Service
/**
 * Signs first-party JWTs with the OIDC provider's active JWKS signing key.
 *
 * The result is an RS256 token with `iss` = this provider's issuer, so any resource server that
 * already trusts the provider's JWKS for OAuth access tokens verifies it with no new secret or
 * trust anchor: "the API mints a token for the satellite service" is literally "sign with the
 * active key, `aud` = the satellite's origin". The counterpart on the resource server is
 * `verifyBearerJwt` from `@dereekb/oauth-resource`, whose `oidc` issuer profile discovers this
 * provider's `jwks_uri` from its own discovery document.
 *
 * Registered and exported by `oidcModuleMetadata`, so a downstream app injects it with no extra
 * wiring. Pair it with `createCachedTokenProvider` from `@dereekb/util/oidc` to hold a minted
 * token until it nears expiry instead of re-signing per call.
 */
@Injectable()
export class OidcJwtSigningService {
  private _cached: Maybe<CachedSigningKey>;

  constructor(
    @Inject(JwksService) private readonly _jwks: JwksService,
    @Inject(OidcModuleConfig) private readonly _config: OidcModuleConfig
  ) {}

  /**
   * Mints a signed JWT.
   *
   * @param input - Audience, subject, lifetime, and extra claims.
   * @returns The compact token, its expiry, and the signing key id.
   */
  async signJwt(input: OidcSignJwtInput): Promise<OidcSignedJwt> {
    const { kid, key } = await this._loadSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (input.expiresIn ?? DEFAULT_OIDC_SIGNED_JWT_EXPIRES_IN_SECONDS);

    const token = await new SignJWT({ ...input.claims })
      .setProtectedHeader({ alg: 'RS256', kid, typ: input.typ ?? DEFAULT_OIDC_SIGNED_JWT_TYP })
      .setIssuer(this._config.issuer)
      .setAudience(typeof input.audience === 'string' ? input.audience : [...input.audience])
      .setSubject(input.subject)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .setJti(randomUUID())
      .sign(key);

    return { token, kid, expiresAt: new Date(exp * 1000) };
  }

  private async _loadSigningKey(): Promise<CachedSigningKey> {
    const stale = !this._cached || Date.now() - this._cached.loadedAt > DEFAULT_OIDC_JWT_SIGNING_KEY_CACHE_MS;

    if (stale) {
      // same fallback OidcService uses when no key has been generated yet
      const jwk = (await this._jwks.getActiveSigningKey()) ?? (await this._jwks.generateKeyPair()).signingKey;
      this._cached = { kid: jwk.kid, key: await importJWK(jwk as JWK, 'RS256'), loadedAt: Date.now() };
    }

    return this._cached as CachedSigningKey;
  }
}

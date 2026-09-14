import { type Maybe, type PromiseOrValue, type Seconds } from '@dereekb/util';
import { decodeJwt, decodeProtectedHeader, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import { defaultOAuthResourceErrorFactory, type OAuthResourceErrorFactory } from '../error/oauth.resource.error';
import { type IssuerProfile, type IssuerProfileKind, type IssuerProfiles } from '../issuer/issuer.profile';

// MARK: Types
/**
 * A verified bearer token: which issuer profile matched, the subject, and
 * the full claim set.
 */
export interface VerifiedBearer {
  readonly kind: IssuerProfileKind;
  readonly issuer: string;
  readonly subject: string;
  readonly claims: JWTPayload;
  readonly token: string;
}

/**
 * Additional policy applied to a token that already passed signature + standard claim validation.
 *
 * Returning `false` rejects the token as `forbidden` (403 / `insufficient_scope`), not
 * `unauthorized` — the token is valid, the caller is simply not allowed.
 */
export type VerifyBearerClaimPredicate = (claims: JWTPayload, profile: IssuerProfile) => PromiseOrValue<boolean>;

export interface VerifyBearerOptions {
  readonly profiles: IssuerProfiles;
  /**
   * Accept unsigned (`alg: none`) Firebase emulator ID tokens. Never set this in production —
   * an unsigned token proves nothing.
   */
  readonly firebaseEmulator?: Maybe<boolean>;
  /**
   * Claims that must be present and truthy on the token, e.g. an app's onboarded flag. A missing
   * claim rejects with `forbidden`.
   */
  readonly requiredClaims?: Maybe<readonly string[]>;
  /**
   * Arbitrary additional policy gate, evaluated after {@link requiredClaims}.
   */
  readonly claimPredicate?: Maybe<VerifyBearerClaimPredicate>;
  /**
   * Which issuer kinds {@link requiredClaims} / {@link claimPredicate} apply to.
   *
   * Defaults to {@link DEFAULT_BEARER_CLAIM_GATE_KINDS} (`['firebase']`): app-account claims live
   * on a Firebase ID token, while an OAuth access token from the authorization server carries
   * scopes instead and is gated by scope, not by account claims.
   */
  readonly claimGateKinds?: Maybe<readonly IssuerProfileKind[]>;
  /**
   * Signing algorithms accepted. Defaults to {@link BEARER_ALGORITHMS}.
   */
  readonly algorithms?: Maybe<readonly string[]>;
  /**
   * Leeway applied to `exp` / `nbf` / `iat` / `auth_time`. Defaults to
   * {@link BEARER_CLOCK_TOLERANCE_SECONDS}.
   */
  readonly clockToleranceSeconds?: Maybe<Seconds>;
  /**
   * Builds the thrown error, letting a consumer surface its own API error type.
   * Defaults to {@link defaultOAuthResourceErrorFactory}.
   */
  readonly errorFactory?: Maybe<OAuthResourceErrorFactory>;
  /**
   * Clock source in seconds; injected in specs.
   */
  readonly nowSeconds?: Maybe<() => number>;
}

// MARK: Constants
/**
 * Leeway applied to `exp` / `nbf` / `iat` / `auth_time`.
 */
export const BEARER_CLOCK_TOLERANCE_SECONDS: Seconds = 60;

/**
 * The signing algorithms accepted by default (Firebase and oidc-provider both sign RS256).
 */
export const BEARER_ALGORITHMS: readonly string[] = ['RS256'];

/**
 * Issuer kinds the claim gates apply to by default.
 */
export const DEFAULT_BEARER_CLAIM_GATE_KINDS: readonly IssuerProfileKind[] = ['firebase'];

// MARK: Verify
/**
 * Verifies a bearer JWT against the trusted issuer profiles: the `iss`
 * claim selects the profile, the profile's JWKS verifies the RS256
 * signature, and jose enforces `iss` / `aud` / `exp` / `nbf` / `iat` with a
 * 60 s tolerance. Firebase tokens additionally get the `auth_time` sanity
 * check and the optional claim gates. Under the Firebase emulator an
 * unsigned (`alg: none`) token is accepted after the same claim checks —
 * the emulator never signs, and the flag is never set in production.
 *
 * Scopes are deliberately NOT enforced here: a resource server's scope policy is per-route, so it
 * belongs to the caller (see the Express adapter's `requiredScopes`).
 *
 * @param token - The raw bearer token.
 * @param options - Trusted profiles + policy.
 * @returns The verified token.
 * @throws {OAuthResourceError} `unauthorized` for any malformed / untrusted / invalid token; `forbidden` when a claim gate fails. Replaceable via {@link VerifyBearerOptions.errorFactory}.
 */
export async function verifyBearerJwt(token: string, options: VerifyBearerOptions): Promise<VerifiedBearer> {
  const errorFactory = options.errorFactory ?? defaultOAuthResourceErrorFactory;
  const clockTolerance = options.clockToleranceSeconds ?? BEARER_CLOCK_TOLERANCE_SECONDS;
  let unverified: JWTPayload;

  try {
    unverified = decodeJwt(token);
  } catch {
    throw errorFactory({ code: 'unauthorized', message: 'Malformed bearer token.' });
  }

  const profile = unverified.iss === undefined ? undefined : options.profiles.get(unverified.iss);

  if (!profile) {
    throw errorFactory({ code: 'unauthorized', message: 'Untrusted token issuer.' });
  }

  const now = (options.nowSeconds ?? defaultNowSeconds)();
  const context: VerifyContext = { profile, now, clockTolerance, errorFactory };
  let claims: JWTPayload;

  if (profile.kind === 'firebase' && options.firebaseEmulator === true && isUnsignedToken(token)) {
    claims = verifyUnsignedEmulatorToken(unverified, context);
  } else {
    claims = await verifySignedToken(token, context, options.algorithms ?? BEARER_ALGORITHMS);
  }

  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw errorFactory({ code: 'unauthorized', message: 'Token has no subject.' });
  }

  if (profile.kind === 'firebase') {
    const authTime = claims['auth_time'];

    if (typeof authTime === 'number' && authTime > now + clockTolerance) {
      throw errorFactory({ code: 'unauthorized', message: 'Token auth_time is in the future.' });
    }
  }

  const claimGateKinds = options.claimGateKinds ?? DEFAULT_BEARER_CLAIM_GATE_KINDS;

  if (claimGateKinds.includes(profile.kind)) {
    await assertClaimGates(claims, options, context);
  }

  return { kind: profile.kind, issuer: profile.issuer, subject: claims.sub, claims, token };
}

// MARK: Internal
interface VerifyContext {
  readonly profile: IssuerProfile;
  readonly now: number;
  readonly clockTolerance: Seconds;
  readonly errorFactory: OAuthResourceErrorFactory;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function isUnsignedToken(token: string): boolean {
  let unsigned = false;

  try {
    unsigned = decodeProtectedHeader(token).alg === 'none';
  } catch {
    // undecodable header — treat as signed so the signature path rejects it
  }

  return unsigned;
}

async function assertClaimGates(claims: JWTPayload, options: VerifyBearerOptions, context: VerifyContext): Promise<void> {
  const requiredClaims = options.requiredClaims ?? [];
  const missingClaim = requiredClaims.find((claim) => !claims[claim]);

  if (missingClaim != null) {
    throw context.errorFactory({ code: 'forbidden', message: `Token is missing the required "${missingClaim}" claim.`, details: { claim: missingClaim } });
  }

  if (options.claimPredicate != null) {
    const allowed = await options.claimPredicate(claims, context.profile);

    if (!allowed) {
      throw context.errorFactory({ code: 'forbidden', message: 'Token failed the resource server claim policy.' });
    }
  }
}

async function verifySignedToken(token: string, context: VerifyContext, algorithms: readonly string[]): Promise<JWTPayload> {
  const { profile, now, clockTolerance, errorFactory } = context;
  let claims: JWTPayload;

  try {
    const getKey = await profile.getKey();
    const verified = await jwtVerify(token, getKey, {
      issuer: profile.issuer,
      audience: [...profile.audiences],
      algorithms: [...algorithms],
      clockTolerance,
      currentDate: new Date(now * 1000)
    });

    claims = verified.payload;
  } catch (error) {
    const code = error instanceof joseErrors.JOSEError ? error.code : 'ERR_JWT_INVALID';
    throw errorFactory({ code: 'unauthorized', message: `Invalid bearer token (${code}).` });
  }

  return claims;
}

// The emulator issues `alg: none` tokens; firebase-admin skips the signature
// under FIREBASE_AUTH_EMULATOR_HOST and checks the claims only, so the same
// iss / aud / exp / iat gates are applied here. The error strings reproduce jose's
// so both paths look identical to a caller.
function verifyUnsignedEmulatorToken(claims: JWTPayload, context: VerifyContext): JWTPayload {
  const { profile, now, clockTolerance, errorFactory } = context;
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : (claims.aud ?? []);

  if (claims.iss !== profile.issuer) {
    throw errorFactory({ code: 'unauthorized', message: 'Invalid bearer token (ERR_JWT_CLAIM_VALIDATION_FAILED: iss).' });
  }

  if (!audiences.some((aud) => profile.audiences.includes(aud))) {
    throw errorFactory({ code: 'unauthorized', message: 'Invalid bearer token (ERR_JWT_CLAIM_VALIDATION_FAILED: aud).' });
  }

  if (typeof claims.exp !== 'number' || claims.exp + clockTolerance <= now) {
    throw errorFactory({ code: 'unauthorized', message: 'Invalid bearer token (ERR_JWT_EXPIRED).' });
  }

  if (typeof claims.nbf === 'number' && claims.nbf > now + clockTolerance) {
    throw errorFactory({ code: 'unauthorized', message: 'Invalid bearer token (ERR_JWT_CLAIM_VALIDATION_FAILED: nbf).' });
  }

  if (typeof claims.iat === 'number' && claims.iat > now + clockTolerance) {
    throw errorFactory({ code: 'unauthorized', message: 'Invalid bearer token (ERR_JWT_CLAIM_VALIDATION_FAILED: iat).' });
  }

  return claims;
}

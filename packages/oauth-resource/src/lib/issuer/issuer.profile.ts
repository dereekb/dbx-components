import { cachedGetter, type Maybe } from '@dereekb/util';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

// MARK: Types
/**
 * Which family a trusted issuer belongs to.
 *
 * `firebase` is a Firebase Auth ID token issuer (`https://securetoken.google.com/<projectId>`);
 * `oidc` is any OAuth 2.0 / OpenID Connect authorization server — a dbx-components
 * `@dereekb/firebase-server/oidc` provider, Auth0, Okta, and so on.
 */
export type IssuerProfileKind = 'firebase' | 'oidc';

/**
 * One trusted token issuer: how to recognize its tokens (`iss`), which
 * audiences it may name, and how to fetch its verification keys.
 */
export interface IssuerProfile {
  readonly kind: IssuerProfileKind;
  readonly issuer: string;
  readonly audiences: readonly string[];
  /**
   * Resolves the JWKS key getter. Lazy so a discovery failure at boot does
   * not take the service down — it surfaces as a 401 on the request instead.
   */
  readonly getKey: () => Promise<JWTVerifyGetKey>;
}

/**
 * Trusted issuer profiles, keyed by their `iss` value. The `iss` claim on an incoming token
 * selects the profile that verifies it.
 */
export type IssuerProfiles = ReadonlyMap<string, IssuerProfile>;

// MARK: Constants
/**
 * Google's public JWKS for Firebase ID tokens (the `securetoken` signer).
 */
export const FIREBASE_SECURETOKEN_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/**
 * Path appended to an issuer to read its OpenID Connect discovery document.
 */
export const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration';

/**
 * Builds the `iss` value Firebase stamps on a project's ID tokens.
 *
 * @param projectId - The Firebase project id.
 * @returns The issuer URL.
 */
export function firebaseIssuerForProject(projectId: string): string {
  return `https://securetoken.google.com/${projectId}`;
}

// MARK: Config
/**
 * An OIDC issuer to trust. The string form takes the shared `audiences` and discovers its JWKS;
 * the object form overrides either.
 */
export type BuildIssuerProfilesOidcIssuerInput = string | OidcIssuerProfileConfig;

export interface OidcIssuerProfileConfig {
  readonly issuer: string;
  /**
   * Audiences accepted on this issuer's tokens. Defaults to {@link BuildIssuerProfilesConfig.audiences}.
   */
  readonly audiences?: Maybe<readonly string[]>;
  /**
   * Overrides how this issuer's verification keys are resolved, bypassing discovery.
   *
   * This is the seam the whole design rests on: a test injects `createLocalJWKSet()`, and an
   * authorization server verifying its OWN tokens in-process injects its local key set rather
   * than making an HTTP call back to itself.
   */
  readonly getKey?: Maybe<() => Promise<JWTVerifyGetKey>>;
}

export interface BuildIssuerProfilesConfig {
  /**
   * Firebase project ids whose ID tokens are trusted. Each contributes a `firebase` profile whose
   * only accepted audience is the project id itself.
   */
  readonly firebaseProjectIds?: Maybe<readonly string[]>;
  /**
   * OAuth/OIDC issuers to trust.
   */
  readonly oidcIssuers?: Maybe<readonly BuildIssuerProfilesOidcIssuerInput[]>;
  /**
   * Audiences accepted on OIDC tokens — this resource server's identity. Typically its origin
   * plus any RFC 8707 resource-indicator URLs pointed at it.
   */
  readonly audiences?: Maybe<readonly string[]>;
  /**
   * JWKS URL used for the Firebase leg. Defaults to {@link FIREBASE_SECURETOKEN_JWKS_URL}.
   */
  readonly firebaseJwksUrl?: Maybe<string>;
  /**
   * `fetch` used for OIDC discovery; injected in specs. Defaults to the global.
   */
  readonly fetch?: Maybe<typeof fetch>;
}

// MARK: Profiles
/**
 * Builds the issuer → profile map the bearer verifier dispatches on: one
 * Firebase profile per trusted project id (sharing Google's JWKS) and one
 * OIDC profile per trusted issuer (JWKS discovered from
 * `{iss}/.well-known/openid-configuration`, falling back to `{iss}/jwks`).
 *
 * @param config - The trusted project ids / issuers / audiences + optional fetch.
 * @returns Profiles keyed by their `iss` value.
 */
export function buildIssuerProfiles(config: BuildIssuerProfilesConfig): IssuerProfiles {
  const fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
  const audiences = config.audiences ?? [];
  const profiles = new Map<string, IssuerProfile>();
  // jose caches the key set and refetches on an unknown `kid` (30 s cooldown). Built on first use
  // rather than at map-construction time, so a bad URL is a per-request 401 and not a boot failure.
  const firebaseKeys = cachedGetter(() => createRemoteJWKSet(new URL(config.firebaseJwksUrl ?? FIREBASE_SECURETOKEN_JWKS_URL)));

  (config.firebaseProjectIds ?? []).forEach((projectId) => {
    const issuer = firebaseIssuerForProject(projectId);
    profiles.set(issuer, { kind: 'firebase', issuer, audiences: [projectId], getKey: async () => firebaseKeys() });
  });

  (config.oidcIssuers ?? []).forEach((input) => {
    const entry: OidcIssuerProfileConfig = typeof input === 'string' ? { issuer: input } : input;
    const { issuer } = entry;
    const getKey = entry.getKey ?? memoizeSuccess(() => discoverOidcJwks(issuer, fetchFn));

    profiles.set(issuer, { kind: 'oidc', issuer, audiences: entry.audiences ?? audiences, getKey });
  });

  return profiles;
}

// MARK: Internal
interface OidcDiscoveryDocument {
  readonly jwks_uri?: string;
}

async function discoverOidcJwks(issuer: string, fetchFn: typeof fetch): Promise<JWTVerifyGetKey> {
  let jwksUri = `${issuer}/jwks`;

  try {
    const response = await fetchFn(`${issuer}${OPENID_CONFIGURATION_PATH}`);

    if (response.ok) {
      const document = (await response.json()) as OidcDiscoveryDocument;

      if (typeof document.jwks_uri === 'string' && document.jwks_uri.length > 0) {
        jwksUri = document.jwks_uri;
      }
    }
  } catch {
    // discovery unreachable — fall back to the conventional `{iss}/jwks`
  }

  return createRemoteJWKSet(new URL(jwksUri));
}

// Caches the resolved value only once it resolved — a rejected attempt is
// retried on the next call, so a discovery outage never latches.
function memoizeSuccess<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Maybe<Promise<T>>;

  return () => {
    let result = cached;

    if (result == null) {
      result = load().catch((error: unknown) => {
        cached = undefined;
        throw error;
      });
      cached = result;
    }

    return result;
  };
}

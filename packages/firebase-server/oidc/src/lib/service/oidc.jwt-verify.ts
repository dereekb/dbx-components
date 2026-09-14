import { buildIssuerProfiles, type IssuerProfiles } from '@dereekb/oauth-resource';
import { type Maybe } from '@dereekb/util';
import { createLocalJWKSet, type JWK, type JWTVerifyGetKey } from 'jose';
import { type OidcModuleConfig } from '../oidc.config';
import { firebaseServerIssuerProfiles } from '../oidc.resource-server';
import { type JwksService } from './oidc.jwks.service';

// MARK: Keys
/**
 * Builds a jose {@link JWTVerifyGetKey} backed by the provider's OWN published JWKS, read directly
 * from {@link JwksService} rather than over HTTP.
 *
 * An in-process verifier must not `createRemoteJWKSet` against its own `/.well-known/jwks.json`:
 * that would make every bearer-authenticated request depend on the process being able to reach
 * itself over the network (which it may not be, behind a load balancer, in a Functions emulator,
 * or under supertest).
 *
 * The key set is cached and re-read only when a token presents a `kid` the cache does not hold —
 * so a freshly rotated key is picked up on its first use instead of after a fixed TTL.
 *
 * @param jwksService - The provider's JWKS service.
 * @returns The key resolver.
 */
export function jwksServiceVerifyGetKey(jwksService: JwksService): JWTVerifyGetKey {
  interface CachedKeySet {
    readonly kids: Set<string>;
    readonly getKey: JWTVerifyGetKey;
  }

  let cached: Maybe<CachedKeySet>;

  async function loadKeySet(): Promise<CachedKeySet> {
    const jwks = await jwksService.getLatestPublicJwks();
    const next: CachedKeySet = {
      kids: new Set(jwks.keys.map((key) => key.kid)),
      getKey: createLocalJWKSet({ keys: jwks.keys as JWK[] })
    };

    cached = next;
    return next;
  }

  return async (protectedHeader, token) => {
    let keySet = cached ?? (await loadKeySet());
    const kid = protectedHeader?.kid;

    if (kid != null && !keySet.kids.has(kid)) {
      keySet = await loadKeySet();
    }

    return keySet.getKey(protectedHeader, token);
  };
}

// MARK: Profiles
/**
 * Builds the {@link IssuerProfiles} the provider uses to verify its OWN JWT-format access tokens
 * in-process.
 *
 * A JWT access token is issued for a specific `resource=`, so it carries THAT resource server's
 * audience — not the API's own identity. The accepted audiences are therefore every registered
 * `resourceServers` key and audience, plus the issuer itself. The trust decision that implies is
 * deliberate and narrow: a resource server the user consented to may present the token it was
 * given back to the API that issued it. Scope enforcement is unchanged and still does the real
 * authorization work (e.g. the admin-only `session.firestore` consent gate and the endpoint's own
 * admin predicate).
 *
 * @param config - The provider's module config.
 * @param jwksService - The provider's JWKS service, used for local key resolution.
 * @returns The issuer profiles, holding exactly this provider.
 */
export function oidcProviderIssuerProfiles(config: OidcModuleConfig, jwksService: JwksService): IssuerProfiles {
  const getKey = jwksServiceVerifyGetKey(jwksService);
  return buildIssuerProfiles(firebaseServerIssuerProfiles({ oidcModuleConfig: config, audiences: [config.issuer], getKey: async () => getKey }));
}

import { Module } from '@nestjs/common';
import { EMAIL_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, OPENID_OIDC_SCOPE, PROFILE_OIDC_SCOPE } from '@dereekb/firebase';
import { JwksServiceStorageConfig, type OidcAccountClaims, OidcAccountService, oidcModuleMetadata, type OidcAccountServiceDelegate, type OidcProviderConfig } from '@dereekb/firebase-server/oidc';
import { APP_CODE_PREFIXApiAuthModule, APP_CODE_PREFIXApiAuthService, APP_CODE_PREFIXApiFirestoreModule, APP_CODE_PREFIXApiStorageModule } from '../../common/firebase';
import { type FirebaseServerAuthUserContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH, APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE, APP_CODE_PREFIX_CAPS_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, type APP_CODE_PREFIXApiAuthClaims, type APP_CODE_PREFIXOidcScope } from 'FIREBASE_COMPONENTS_NAME';

export type APP_CODE_PREFIXOidcAccountServiceDelegate = OidcAccountServiceDelegate<APP_CODE_PREFIXOidcScope>;

export const APP_CODE_PREFIX_CAPS_OIDC_PROVIDER_CONFIG: OidcProviderConfig<APP_CODE_PREFIXOidcScope> = {
  claims: {
    [OPENID_OIDC_SCOPE]: ['sub'],
    [PROFILE_OIDC_SCOPE]: ['name', 'picture'],
    [EMAIL_OIDC_SCOPE]: ['email', 'email_verified'],
    // offline_access grants a refresh token but adds no extra ID-token claims.
    [OFFLINE_ACCESS_OIDC_SCOPE]: [],
    APP_CODE_PREFIX_LOWER: ['sub', ...APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE.claimKeys],
    // model.* scopes confer authorization for callModel CRUD operations and add no extra ID-token claims.
    'model.create': [],
    'model.read': [],
    'model.update': [],
    'model.delete': [],
    'model.query': [],
    'model.invoke': []
  },
  responseTypes: ['code'],
  grantTypes: ['authorization_code', 'refresh_token']
};

// MARK: Factories
/**
 * Creates the OidcAccountService, which builds OIDC claims from Firebase Auth
 * user records based on the requested scopes.
 *
 * @param authService - The auth service used to look up user records and claims.
 * @returns A configured OidcAccountService instance.
 */
export function APP_CODE_PREFIX_CAMELOidcAccountServiceFactory(authService: APP_CODE_PREFIXApiAuthService): OidcAccountService {
  const delegate: APP_CODE_PREFIXOidcAccountServiceDelegate = {
    providerConfig: APP_CODE_PREFIX_CAPS_OIDC_PROVIDER_CONFIG,
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<APP_CODE_PREFIXOidcScope>): Promise<OidcAccountClaims> {
      const user = await userContext.loadRecord();
      const claims: OidcAccountClaims = { sub: user.uid };

      if (scopes.has(PROFILE_OIDC_SCOPE)) {
        if (user.displayName) {
          claims.name = user.displayName;
        }

        if (user.photoURL) {
          claims.picture = user.photoURL;
        }
      }

      if (scopes.has(EMAIL_OIDC_SCOPE) && user.email) {
        claims.email = user.email;
        claims.email_verified = user.emailVerified ?? false;
      }

      if (scopes.has('APP_CODE_PREFIX_LOWER')) {
        const authClaims = await userContext.loadClaims<APP_CODE_PREFIXApiAuthClaims>();
        Object.assign(claims, APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE.copyClaims(authClaims));
      }

      return claims;
    }
  };

  return new OidcAccountService(authService, delegate);
}

/**
 * Creates the JWKS storage configuration that points to the jwks.json file in
 * Firebase Storage, used by the OIDC provider to persist signing keys.
 *
 * @param firebaseServerStorageService - The storage service providing file access.
 * @returns A JwksServiceStorageConfig targeting the jwks.json storage file.
 */
export function APP_CODE_PREFIX_CAMELJwksServiceStorageConfigFactory(firebaseServerStorageService: FirebaseServerStorageService): JwksServiceStorageConfig {
  return {
    jwksStorageAccessorFile: firebaseServerStorageService.file('jwks.json')
  };
}

@Module({
  imports: [APP_CODE_PREFIXApiAuthModule, APP_CODE_PREFIXApiStorageModule, APP_CODE_PREFIXApiFirestoreModule],
  exports: [APP_CODE_PREFIXApiFirestoreModule, OidcAccountService, JwksServiceStorageConfig],
  providers: [
    {
      provide: OidcAccountService,
      useFactory: APP_CODE_PREFIX_CAMELOidcAccountServiceFactory,
      inject: [APP_CODE_PREFIXApiAuthService]
    },
    {
      provide: JwksServiceStorageConfig,
      useFactory: APP_CODE_PREFIX_CAMELJwksServiceStorageConfigFactory,
      inject: [FirebaseServerStorageService]
    }
  ]
})
export class APP_CODE_PREFIXApiOidcDependencyModule {}

// MARK: Module
@Module(
  oidcModuleMetadata({
    dependencyModule: APP_CODE_PREFIXApiOidcDependencyModule,
    config: {
      suppressBodyParserWarning: true,
      protectedPaths: [OIDC_PROTECTED_PATHS],
      appOAuthInteractionPath: APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH,
      tokenEndpointAuthMethods: APP_CODE_PREFIX_CAPS_OIDC_TOKEN_ENDPOINT_AUTH_METHODS,
      configureMcpResourceServer: OIDC_CONFIGURE_MCP_RESOURCE_SERVER
    },
    // `registrationEnabled` (DCR) is unauthenticated and rate-limit-free, so any caller
    // can write Firestore client docs unbounded. Allow it in non-prod (dev, emulator,
    // tests) so Claude/mcp-inspector can self-register, but lock it down in prod —
    // prod clients should be provisioned out-of-band as public PKCE clients
    // (`token_endpoint_auth_method: 'none'`) via `oidcClientService.createClient()`.
    configFactory: (envService) => ({
      registrationEnabled: !envService.isProduction
    })
  })
)
export class APP_CODE_PREFIXApiOidcModule {}

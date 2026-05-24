import { Module } from '@nestjs/common';
import { EMAIL_OIDC_SCOPE, OFFLINE_ACCESS_OIDC_SCOPE, OPENID_OIDC_SCOPE, PROFILE_OIDC_SCOPE } from '@dereekb/firebase';
import { JwksServiceStorageConfig, type OidcAccountClaims, OidcAccountService, oidcModuleMetadata, type OidcAccountServiceDelegate, type OidcProviderConfig, type OidcRenderErrorFunction } from '@dereekb/firebase-server/oidc';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { DemoApiAuthService, DemoApiFirestoreModule, DemoApiStorageModule } from '../../common/firebase';
import { type FirebaseServerAuthUserContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { DEMO_APP_OAUTH_INTERACTION_PATH, DEMO_AUTH_CLAIMS_SERVICE, DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, type DemoApiAuthClaims, type DemoOidcScope } from 'demo-firebase';

export type DemoOidcAccountServiceDelegate = OidcAccountServiceDelegate<DemoOidcScope>;

export const DEMO_OIDC_PROVIDER_CONFIG: OidcProviderConfig<DemoOidcScope> = {
  claims: {
    [OPENID_OIDC_SCOPE]: ['sub'],
    [PROFILE_OIDC_SCOPE]: ['name', 'picture'],
    [EMAIL_OIDC_SCOPE]: ['email', 'email_verified'],
    // offline_access grants a refresh token but adds no extra ID-token claims.
    [OFFLINE_ACCESS_OIDC_SCOPE]: [],
    demo: ['sub', ...DEMO_AUTH_CLAIMS_SERVICE.claimKeys],
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
 * Creates the OidcAccountService for the demo API, configuring how OIDC claims
 * are built from Firebase Auth user records and custom auth claims.
 * Supports the openid, profile, email, and demo scopes.
 *
 * @param demoApiAuthService - The demo auth service used as the underlying auth provider.
 * @returns An OidcAccountService configured with the demo-specific claim builder.
 */
export function demoOidcAccountServiceFactory(demoApiAuthService: DemoApiAuthService): OidcAccountService {
  const delegate: DemoOidcAccountServiceDelegate = {
    providerConfig: DEMO_OIDC_PROVIDER_CONFIG,
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<DemoOidcScope>): Promise<OidcAccountClaims> {
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

      if (scopes.has('demo')) {
        const authClaims = await userContext.loadClaims<DemoApiAuthClaims>();
        Object.assign(claims, DEMO_AUTH_CLAIMS_SERVICE.copyClaims(authClaims));
      }

      return claims;
    }
  };

  return new OidcAccountService(demoApiAuthService, delegate);
}

/**
 * Creates the JWKS storage config pointing to the jwks.json file in Firebase Storage.
 * The OIDC provider uses this to persist and retrieve its signing key set.
 *
 * @param firebaseServerStorageService - The Firebase storage service for accessing cloud storage files.
 * @returns A JwksServiceStorageConfig with the storage accessor file reference.
 */
export function demoJwksServiceStorageConfigFactory(firebaseServerStorageService: FirebaseServerStorageService): JwksServiceStorageConfig {
  return {
    jwksStorageAccessorFile: firebaseServerStorageService.file('jwks.json')
  };
}

@Module({
  imports: [DemoApiAuthModule, DemoApiStorageModule, DemoApiFirestoreModule],
  exports: [DemoApiFirestoreModule, OidcAccountService, JwksServiceStorageConfig],
  providers: [
    {
      provide: OidcAccountService,
      useFactory: demoOidcAccountServiceFactory,
      inject: [DemoApiAuthService]
    },
    {
      provide: JwksServiceStorageConfig,
      useFactory: demoJwksServiceStorageConfigFactory,
      inject: [FirebaseServerStorageService]
    }
  ]
})
export class DemoApiOidcDependencyModule {}

// MARK: Render Error
const demoOidcRenderError: OidcRenderErrorFunction = (ctx, out) => {
  ctx.type = 'application/json';
  ctx.body = JSON.stringify({
    error: out.error,
    error_description: out.error_description
  });
};

@Module(
  oidcModuleMetadata({
    dependencyModule: DemoApiOidcDependencyModule,
    config: {
      suppressBodyParserWarning: true,
      renderError: demoOidcRenderError,
      protectedPaths: ['/api/model', '/mcp'],
      appOAuthInteractionPath: DEMO_APP_OAUTH_INTERACTION_PATH,
      tokenEndpointAuthMethods: DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS
    }
  })
)
export class DemoApiOidcModule {}

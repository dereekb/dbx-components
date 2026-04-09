import { Module } from '@nestjs/common';
import { JwksServiceStorageConfig, type OidcAccountClaims, OidcAccountService, oidcModuleMetadata, type OidcAccountServiceDelegate, type OidcProviderConfig, type OidcRenderErrorFunction } from '@dereekb/firebase-server/oidc';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { DemoApiAuthService, DemoApiFirestoreModule, DemoApiStorageModule } from '../../common/firebase';
import { type FirebaseServerAuthUserContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { DEMO_APP_OAUTH_INTERACTION_PATH, DEMO_OIDC_TOKEN_ENDPOINT_AUTH_METHODS, type DemoApiAuthClaims, type DemoOidcScope } from 'demo-firebase';

export type DemoOidcAccountServiceDelegate = OidcAccountServiceDelegate<DemoOidcScope>;

export const DEMO_OIDC_PROVIDER_CONFIG: OidcProviderConfig<DemoOidcScope> = {
  claims: {
    openid: ['sub'],
    profile: ['name', 'picture'],
    email: ['email', 'email_verified'],
    demo: ['sub', 'o', 'a', 'fr']
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
 * @param demoApiAuthService - the demo auth service used as the underlying auth provider
 * @returns an OidcAccountService configured with the demo-specific claim builder
 */
export function demoOidcAccountServiceFactory(demoApiAuthService: DemoApiAuthService): OidcAccountService {
  const delegate: DemoOidcAccountServiceDelegate = {
    providerConfig: DEMO_OIDC_PROVIDER_CONFIG,
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<DemoOidcScope>): Promise<OidcAccountClaims> {
      const user = await userContext.loadRecord();
      const claims: OidcAccountClaims = { sub: user.uid };

      if (scopes.has('profile')) {
        if (user.displayName) {
          claims.name = user.displayName;
        }

        if (user.photoURL) {
          claims.picture = user.photoURL;
        }
      }

      if (scopes.has('email') && user.email) {
        claims.email = user.email;
        claims.email_verified = user.emailVerified ?? false;
      }

      if (scopes.has('demo')) {
        const authClaims = await userContext.loadClaims<DemoApiAuthClaims>();
        claims.o = authClaims.o;
        claims.a = authClaims.a;
        claims.fr = authClaims.fr;
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
 * @param firebaseServerStorageService - the Firebase storage service for accessing cloud storage files
 * @returns a JwksServiceStorageConfig with the storage accessor file reference
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

import { Module } from '@nestjs/common';
import { JwksServiceStorageConfig, OidcAccountClaims, OidcAccountService, oidcModuleMetadata } from '@dereekb/firebase-server/oidc';
import type { OidcAccountServiceDelegate, OidcProviderConfig, OidcRenderErrorFunction } from '@dereekb/firebase-server/oidc';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { DemoApiAuthService, DemoApiFirestoreModule, DemoApiStorageModule } from '../../common/firebase';
import { FirebaseServerAuthUserContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { DEMO_APP_OIDC_INTERACTION_PATH, type DemoApiAuthClaims, type DemoOidcScope } from 'demo-firebase';

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

      if (scopes.has('email')) {
        if (user.email) {
          claims.email = user.email;
          claims.email_verified = user.emailVerified ?? false;
        }
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
      interactionPath: DEMO_APP_OIDC_INTERACTION_PATH
    }
  })
)
export class DemoApiOidcModule {}

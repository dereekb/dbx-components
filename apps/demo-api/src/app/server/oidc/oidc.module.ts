import { Module } from '@nestjs/common';
import { OIDC_ACCOUNT_SERVICE_TOKEN, OidcAccountClaims, OidcAccountService, OidcAccountServiceDelegate, oidcModuleMetadata } from '@dereekb/firebase-server/oidc';
import { DemoApiAuthModule } from '../../common/firebase/auth.module';
import { DemoApiAuthService, DemoApiFirestoreModule } from '../../common';
import { FirebaseServerAuthUserContext } from '@dereekb/firebase-server';

export function demoOidcAccountServiceFactory(demoApiAuthService: DemoApiAuthService): OidcAccountService {
  const delegate = {
    async buildClaimsForUser(userContext: FirebaseServerAuthUserContext, scopes: Set<string>): Promise<OidcAccountClaims> {
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

      return claims;
    }
  };

  return new OidcAccountService(demoApiAuthService, delegate);
}

@Module({
  imports: [DemoApiAuthModule],
  exports: [DemoApiFirestoreModule],
  providers: [
    {
      provide: OIDC_ACCOUNT_SERVICE_TOKEN,
      useFactory: demoOidcAccountServiceFactory,
      inject: [DemoApiAuthService]
    }
  ]
})
export class DemoApiOidcDependencyModule {}

@Module(
  oidcModuleMetadata({
    dependencyModule: DemoApiOidcDependencyModule
  })
)
export class DemoApiOidcModule {}

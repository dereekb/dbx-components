import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { type DemoApiNestContext } from '../function/function.context';
import { OidcAccountService, OidcClientService, OidcService, JwksService, OidcServerFirestoreCollections, OidcModuleConfig, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../common';
import { type DemoOidcScope } from 'demo-firebase';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class DemoApiServerNestContext extends AbstractServerFirebaseNestContext<DemoApiNestContext> {
  get oidcAccountService(): OidcAccountService<DemoOidcScope, DemoApiFirebaseServerAuthUserContext> {
    return this.context.nestApplication.get(OidcAccountService);
  }

  get oidcClientService(): OidcClientService {
    return this.context.nestApplication.get(OidcClientService);
  }

  get oidcService(): OidcService {
    return this.context.nestApplication.get(OidcService);
  }

  get jwksService(): JwksService {
    return this.context.nestApplication.get(JwksService);
  }

  get oidcServerFirestoreCollections(): OidcServerFirestoreCollections {
    return this.context.nestApplication.get(OidcServerFirestoreCollections);
  }

  get oidcModuleConfig(): OidcModuleConfig {
    return this.context.nestApplication.get(OidcModuleConfig);
  }

  get oidcProviderConfigService(): OidcProviderConfigService {
    return this.context.nestApplication.get(OidcProviderConfigService);
  }
}

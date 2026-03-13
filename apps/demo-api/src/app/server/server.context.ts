import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { DemoApiNestContext } from '../function/function.context';
import { OidcAccountService, OidcClientService, OidcService, JwksService, OidcServerFirestoreCollections, OidcModuleConfig, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../common';
import { DemoOidcScope } from 'demo-firebase';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class DemoApiServerNestContext extends AbstractServerFirebaseNestContext<DemoApiNestContext> {
  get oidcAccountService(): OidcAccountService<DemoOidcScope, DemoApiFirebaseServerAuthUserContext> {
    return this.context.nest.get(OidcAccountService);
  }

  get oidcClientService(): OidcClientService {
    return this.context.nest.get(OidcClientService);
  }

  get oidcService(): OidcService {
    return this.context.nest.get(OidcService);
  }

  get jwksService(): JwksService {
    return this.context.nest.get(JwksService);
  }

  get oidcServerFirestoreCollections(): OidcServerFirestoreCollections {
    return this.context.nest.get(OidcServerFirestoreCollections);
  }

  get oidcModuleConfig(): OidcModuleConfig {
    return this.context.nest.get(OidcModuleConfig);
  }

  get oidcProviderConfigService(): OidcProviderConfigService {
    return this.context.nest.get(OidcProviderConfigService);
  }
}

import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXApiNestContext } from '../function/function';
import { OidcAccountService, OidcClientService, OidcService, JwksService, OidcServerFirestoreCollections, OidcModuleConfig, OidcProviderConfigService } from '@dereekb/firebase-server/oidc';
import { type APP_CODE_PREFIXApiFirebaseServerAuthUserContext } from '../common/firebase/auth.service';
import { type APP_CODE_PREFIXOidcScope } from 'FIREBASE_COMPONENTS_NAME';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class APP_CODE_PREFIXApiServerNestContext extends AbstractServerFirebaseNestContext<APP_CODE_PREFIXApiNestContext> {
  get oidcAccountService(): OidcAccountService<APP_CODE_PREFIXOidcScope, APP_CODE_PREFIXApiFirebaseServerAuthUserContext> {
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

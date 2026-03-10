import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { DemoApiNestContext } from '../function/function.context';
import { OIDC_ACCOUNT_SERVICE_TOKEN, OidcAccountService, OidcService, JwksService, OidcFirestoreCollections } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../common';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class DemoApiServerNestContext extends AbstractServerFirebaseNestContext<DemoApiNestContext> {
  get oidcAccountService(): OidcAccountService<DemoApiFirebaseServerAuthUserContext> {
    return this.context.nest.get(OIDC_ACCOUNT_SERVICE_TOKEN);
  }

  get oidcService(): OidcService {
    return this.context.nest.get(OidcService);
  }

  get jwksService(): JwksService {
    return this.context.nest.get(JwksService);
  }

  get oidcFirestoreCollections(): OidcFirestoreCollections {
    return this.context.nest.get(OidcFirestoreCollections);
  }
}

import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { DemoApiNestContext } from '../function/function.context';
import { OidcAccountService, OidcService, JwksService, OidcFirestoreCollections } from '@dereekb/firebase-server/oidc';
import { type DemoApiFirebaseServerAuthUserContext } from '../common';
import { type DemoOidcScope } from './oidc/oidc.module';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class DemoApiServerNestContext extends AbstractServerFirebaseNestContext<DemoApiNestContext> {
  get oidcAccountService(): OidcAccountService<DemoOidcScope, DemoApiFirebaseServerAuthUserContext> {
    return this.context.nest.get(OidcAccountService);
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

import { AbstractServerFirebaseNestContext } from '@dereekb/firebase-server';
import { DemoApiNestContext } from '../function/function.context';

/**
 * The top-most NestJS context that is used for server-only services.
 *
 * This type is typically only available in testing.
 */
export class DemoApiServerNestContext extends AbstractServerFirebaseNestContext<DemoApiNestContext> {
  // TODO: get oidc service(s)
}

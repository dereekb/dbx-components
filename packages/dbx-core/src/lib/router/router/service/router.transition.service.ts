import { type Observable } from 'rxjs';
import { type DbxRouterTransitionEvent } from '../transition/transition';

/**
 * Router service definition that provides high level information about router transitions.
 */
export abstract class DbxRouterTransitionService {
  /**
   * Observable that emits DbxRouterTransitionEvent values as transitions occur.
   */
  abstract readonly transitions$: Observable<DbxRouterTransitionEvent>;
}

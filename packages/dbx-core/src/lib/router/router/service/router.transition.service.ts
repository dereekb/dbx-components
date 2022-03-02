import { Observable } from 'rxjs';
import { DbNgxRouterTransitionEvent } from '../transition/transition';

/**
 * Router service definition that provides high level information about router transitions.
 */
export abstract class DbNgxRouterTransitionService {

  /**
   * Observable that emits DbNgxRouterTransitionEvent values as transitions occur.
   */
  abstract readonly transitions$: Observable<DbNgxRouterTransitionEvent>;

}

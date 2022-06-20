import { ObservableOrValue } from '@dereekb/rxjs';
import { Observable } from 'rxjs';
import { SegueRefOrSegueRefRouterLink, SegueRefRawSegueParams } from '../../segue';

/**
 * Router service definition that can route the app and provide routing details.
 */
export abstract class DbxRouterService {
  /**
   * Params of the current successfully loaded route.
   */
  abstract readonly params$: Observable<SegueRefRawSegueParams>;

  /**
   * Navigates to the target SegueRef.
   *
   * @param segueRef
   */
  abstract go(segueRef: ObservableOrValue<SegueRefOrSegueRefRouterLink>): Promise<boolean>;

  /**
   * Navigates to the current url with updated parameters. Will be merged with the existing parameters.
   *
   * @param segueRef
   */
  abstract updateParams(params: ObservableOrValue<SegueRefRawSegueParams>): Promise<boolean>;

  /**
   * Returns true if the input segue ref is considered active.
   *
   * @param segueRef
   */
  abstract isActive(segueRef: SegueRefOrSegueRefRouterLink): boolean;

  /**
   * Compares the two refs for precision for a certain route.
   *
   * For example, if the parent route is input with a child route, the child route is
   * considered more precise.
   *
   * @param a
   * @param b
   */
  abstract comparePrecision(a: SegueRefOrSegueRefRouterLink, b: SegueRefOrSegueRefRouterLink): number;
}

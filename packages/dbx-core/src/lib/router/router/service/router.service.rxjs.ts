import { type Maybe } from '@dereekb/util';
import { filter, map, type Observable, of, type OperatorFunction, switchMap, startWith } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../transition';
import { isSegueRefActiveFunction, type IsSegueRefActiveFunctionConfig } from './router.service.util';

// MARK: Transition Events
export function onRouterTransitionEventType(events$: Observable<DbxRouterTransitionEvent>, type: DbxRouterTransitionEventType): Observable<DbxRouterTransitionEvent> {
  return events$.pipe(filter((x) => x.type === type));
}

export function onRouterTransitionSuccessEvent(events$: Observable<DbxRouterTransitionEvent>): Observable<DbxRouterTransitionEvent> {
  return onRouterTransitionEventType(events$, DbxRouterTransitionEventType.SUCCESS);
}

// MARK: Router Service
/**
 * Creates an observable that returns true when the route for the input segueRef is active.
 *
 * @param dbxRouterService
 * @param segueRef
 */
export function isSegueRefActiveOnTransitionSuccess(config: IsSegueRefActiveFunctionConfig): Observable<boolean> {
  const isActiveFn = isSegueRefActiveFunction(config);
  return onRouterTransitionSuccessEvent(config.dbxRouterService.transitions$).pipe(
    startWith(undefined),
    map(() => isActiveFn())
  );
}

export interface IsSegueRefActiveConfig extends Pick<IsSegueRefActiveFunctionConfig, 'dbxRouterService' | 'activeExactly'> {
  /**
   * What to pipe if the input segueRef is null.
   */
  readonly defaultIfNull?: boolean;
}

/**
 * Operator function that maps the input segueRef to a boolean depending on the current route state.
 *
 * @param dbxRouterService
 * @param segueRef
 */
export function isSegueRefActive(config: IsSegueRefActiveConfig): OperatorFunction<Maybe<SegueRefOrSegueRefRouterLink>, boolean> {
  const { defaultIfNull = false } = config;

  return switchMap((segueRef) => {
    if (segueRef) {
      return isSegueRefActiveOnTransitionSuccess({ ...config, segueRef });
    } else {
      return of(defaultIfNull);
    }
  });
}

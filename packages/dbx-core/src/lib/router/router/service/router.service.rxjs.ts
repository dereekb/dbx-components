import { type Maybe } from '@dereekb/util';
import { filter, map, type Observable, of, type OperatorFunction, switchMap, startWith } from 'rxjs';
import { type SegueRefOrSegueRefRouterLink } from '../../segue';
import { type DbxRouterTransitionEvent, DbxRouterTransitionEventType } from '../transition';
import { isSegueRefActiveFunction, type IsSegueRefActiveFunctionConfig } from './router.service.util';

// MARK: Transition Events
/**
 * Filters the given transition event observable to only emit events of the specified type.
 *
 * @param events$ - The source observable of router transition events.
 * @param type - The transition event type to filter for.
 * @returns An observable that emits only events matching the given type.
 */
export function onRouterTransitionEventType(events$: Observable<DbxRouterTransitionEvent>, type: DbxRouterTransitionEventType): Observable<DbxRouterTransitionEvent> {
  return events$.pipe(filter((x) => x.type === type));
}

/**
 * Filters the given transition event observable to only emit successful transition events.
 *
 * @param events$ - The source observable of router transition events.
 * @returns An observable that emits only {@link DbxRouterTransitionEventType.SUCCESS} events.
 *
 * @see {@link onRouterTransitionEventType}
 */
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

/**
 * Configuration for the {@link isSegueRefActive} RxJS operator function.
 *
 * @see {@link isSegueRefActive}
 */
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

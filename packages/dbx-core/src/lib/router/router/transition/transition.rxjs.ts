import { filter, MonoTypeOperatorFunction, Observable } from 'rxjs';
import { DbxRouterTransitionEvent, DbxRouterTransitionEventType } from './transition';

/**
 * Convenience function for filtering success from the input observable.
 *
 * @param obs
 * @returns
 */
export function successTransition(obs: Observable<DbxRouterTransitionEvent>): Observable<DbxRouterTransitionEvent> {
  return obs.pipe(filterTransitionSuccess());
}

export function filterTransitionSuccess(): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filterTransitionEvent(DbxRouterTransitionEventType.SUCCESS);
}

export function filterTransitionEvent(type: DbxRouterTransitionEventType): MonoTypeOperatorFunction<DbxRouterTransitionEvent> {
  return filter((x) => x.type === type);
}

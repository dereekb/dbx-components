import { type OperatorFunction, type Observable, switchMap, of } from 'rxjs';
import { type LoadingContext, type LoadingContextEvent } from './loading.context';
import { type Maybe } from '@dereekb/util';

/**
 * Creates a `switchMap` operator that subscribes to the {@link LoadingContext.stream$} of each emitted {@link LoadingContext},
 * emitting `undefined` when the context is nullish.
 *
 * Useful for flattening an observable of optional loading contexts into a single stream of loading events.
 *
 * @example
 * ```ts
 * const context$ = new BehaviorSubject<Maybe<LoadingContext>>(myLoadingContext);
 *
 * const events$ = context$.pipe(
 *   switchMapMaybeLoadingContextStream()
 * );
 * // emits LoadingContextEvent values from myLoadingContext.stream$
 * // emits undefined when context$ emits null/undefined
 * ```
 *
 * @returns an RxJS operator that switches to the stream$ of each non-null LoadingContext
 */
export function switchMapMaybeLoadingContextStream(): OperatorFunction<Maybe<LoadingContext>, Maybe<LoadingContextEvent>> {
  return switchMap((x: Maybe<LoadingContext>) => (x != null ? x.stream$ : of(undefined)) as Observable<Maybe<LoadingContextEvent>>);
}

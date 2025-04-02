import { OperatorFunction, Observable, switchMap, of } from 'rxjs';
import { LoadingContext, LoadingContextEvent } from './loading.context';
import { Maybe } from '@dereekb/util';
import { filterMaybe } from '../rxjs';

/**
 * Creates a switchMap operator that will emit the stream of events from the input LoadingContext as soon as a non-null LoadingContext is emitted.
 */
export function switchMapMaybeLoadingContextStream(): OperatorFunction<Maybe<LoadingContext>, Maybe<LoadingContextEvent>> {
  return switchMap((x: Maybe<LoadingContext>) => (x != null ? x.stream$ : of(undefined)) as Observable<Maybe<LoadingContextEvent>>);
}

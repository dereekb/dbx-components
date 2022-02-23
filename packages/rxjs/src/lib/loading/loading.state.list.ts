import { filter, map, Observable, OperatorFunction } from 'rxjs';
import { ListLoadingState, loadingStateIsLoading } from "./loading.state";

export function listLoadingStateIsEmpty<T>(listLoadingState: ListLoadingState<T>): boolean {
  return Boolean(listLoadingState.value && !(listLoadingState.value?.length > 0));
}

export function isListLoadingStateEmpty<T>(): OperatorFunction<ListLoadingState<T>, boolean> {
  return (obs: Observable<ListLoadingState<T>>) => {
    return obs.pipe(
      filter(x => !loadingStateIsLoading(x)),
      map(x => Boolean(x.value && !(x.value?.length > 0)))
    );
  }
}

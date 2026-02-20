import { type LoadingState, type LoadingContextEvent, type LoadingStateContextInput, type MutableLoadingStateContext, loadingStateContext, type ListLoadingState, type ListLoadingStateContextInput, type MutableListLoadingStateContext, listLoadingStateContext } from '@dereekb/rxjs';
import { clean } from './clean';

/**
 * Creates a new LoadingStateContext that is automatically destroyed when the context is destroyed.
 *
 * Must be run within an Angular injection context.
 */
export function cleanLoadingContext<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingContextEvent = LoadingContextEvent & S>(input?: LoadingStateContextInput<T, S, E>): MutableLoadingStateContext<T, S, E> {
  return clean(loadingStateContext(input));
}

/**
 * Creates a new ListLoadingStateContext that is automatically destroyed when the context is destroyed.
 *
 * Must be run within an Angular injection context.
 */
export function cleanListLoadingContext<L = unknown, S extends ListLoadingState<L> = ListLoadingState<L>>(input?: ListLoadingStateContextInput<L, S>): MutableListLoadingStateContext<L, S> {
  return clean(listLoadingStateContext(input));
}

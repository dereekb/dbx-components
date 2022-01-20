import { Maybe, ReadableDataError } from '@dereekb/util';
import { LoadingState } from './loading.state';

export const getLoadingStateModel = <T>(state: LoadingState<T>): Maybe<T> => state.model;
export const getLoadingStateError = <T>(state: LoadingState<T>): Maybe<ReadableDataError> => state.error;

import { ServerError } from '../error/api.error';
import { LoadingState } from './loading.state';

export const getLoadingStateModel = <T>(state: LoadingState<T>): T => state.model;
export const getLoadingStateError = <T>(state: LoadingState<T>): ServerError => state.error;

import { FINAL_PAGE, FIRST_PAGE, ModelListState, UNLOADED_PAGE } from './loading.state.list';

export const getListPage = <T>(list: ModelListState<T>): number => list?.page ?? UNLOADED_PAGE;
export const getNextListPage = <T>(list: ModelListState<T>): number => (getListPage(list) + 1);
export const getRetrievingPage = <T>(list: ModelListState<T>): number => list?.retrieving;
export const hasResults = <T>(list: ModelListState<T>): boolean => getListPage(list) !== UNLOADED_PAGE;
export const isRetrieving = <T>(list: ModelListState<T>): boolean => list?.retrieving !== undefined;
export const isEndOfResults = <T>(list: ModelListState<T>): boolean => list?.page === FINAL_PAGE;
export const isRetrievingFirstPage = <T>(list: ModelListState<T>): boolean => list?.retrieving === FIRST_PAGE;
export const hasRequestedAny = <T>(list: ModelListState<T>): boolean => getListPage(list) !== UNLOADED_PAGE || isRetrieving(list);

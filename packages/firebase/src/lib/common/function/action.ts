
export type FirebaseFunctionUpdateAction<T> = (document: T) => Promise<T>;
export type AsyncFirebaseFunctionUpdateAction<T> = Promise<FirebaseFunctionUpdateAction<T>>;

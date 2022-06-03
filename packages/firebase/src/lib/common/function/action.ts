import { TransformAndValidateFunctionResult } from '@dereekb/model';

export type FirebaseFunctionCreateAction<P extends object, T> = TransformAndValidateFunctionResult<P, () => Promise<T>>;
export type AsyncFirebaseFunctionCreateAction<P extends object, T> = Promise<FirebaseFunctionCreateAction<P, T>>;

export type FirebaseFunctionUpdateAction<P extends object, T> = TransformAndValidateFunctionResult<P, (document: T) => Promise<T>>;
export type AsyncFirebaseFunctionUpdateAction<P extends object, T> = Promise<FirebaseFunctionUpdateAction<P, T>>;

export type FirebaseFunctionDeleteAction<P extends object, T> = TransformAndValidateFunctionResult<P, (document: T) => Promise<void>>;
export type AsyncFirebaseFunctionDeleteAction<P extends object, T> = Promise<FirebaseFunctionUpdateAction<P, T>>;

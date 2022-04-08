import { TransformAndValidateFunctionResult } from "@dereekb/model";

// export type FirebaseFunctionUpdateAction<T> = (document: T) => Promise<T>;
// export type AsyncFirebaseFunctionUpdateAction<T> = Promise<FirebaseFunctionUpdateAction<T>>;

export type FirebaseFunctionUpdateAction<P extends object, T> = TransformAndValidateFunctionResult<P, (document: T) => Promise<T>>;
export type AsyncFirebaseFunctionUpdateAction<P extends object, T> = Promise<FirebaseFunctionUpdateAction<P, T>>;

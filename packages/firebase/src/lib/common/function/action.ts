import { TransformAndValidateObjectOutput } from "@dereekb/model";

// export type FirebaseFunctionUpdateAction<T> = (document: T) => Promise<T>;
// export type AsyncFirebaseFunctionUpdateAction<T> = Promise<FirebaseFunctionUpdateAction<T>>;

export type FirebaseFunctionParsedUpdateAction<P, T> = TransformAndValidateObjectOutput<P, (document: T) => Promise<T>>;
export type AsyncFirebaseFunctionParsedUpdateAction<P, T> = Promise<FirebaseFunctionParsedUpdateAction<P, T>>;

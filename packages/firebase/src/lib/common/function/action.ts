import { type TransformAndValidateFunctionResult } from '@dereekb/model';

/**
 * A validated create action for a Firebase function.
 *
 * Wraps a {@link TransformAndValidateFunctionResult} that validates parameters `P` then executes a create operation
 * returning `T`. Optionally accepts an input `I`.
 *
 * @template P - the validated parameters type
 * @template T - the created entity type
 * @template I - optional input for the create operation
 */
export type FirebaseFunctionCreateAction<P extends object, T, I = void> = I extends void ? TransformAndValidateFunctionResult<P, () => Promise<T>> : TransformAndValidateFunctionResult<P, (input: I) => Promise<T>>;

/**
 * Async variant of {@link FirebaseFunctionCreateAction} — the action itself is produced asynchronously.
 */
export type AsyncFirebaseFunctionCreateAction<P extends object, T, I = void> = Promise<FirebaseFunctionCreateAction<P, T, I>>;

/**
 * A validated read action for a Firebase function. Structurally identical to {@link FirebaseFunctionCreateAction}.
 */
export type FirebaseFunctionReadAction<P extends object, T, I = void> = FirebaseFunctionCreateAction<P, T, I>;

/**
 * Async variant of {@link FirebaseFunctionReadAction}.
 */
export type AsyncFirebaseFunctionReadAction<P extends object, T, I = void> = Promise<FirebaseFunctionReadAction<P, T, I>>;

/**
 * A validated update action for a Firebase function.
 *
 * Takes the entity `T` as input and returns the updated entity.
 */
export type FirebaseFunctionUpdateAction<P extends object, T> = TransformAndValidateFunctionResult<P, (input: T) => Promise<T>>;

/**
 * Async variant of {@link FirebaseFunctionUpdateAction}.
 */
export type AsyncFirebaseFunctionUpdateAction<P extends object, T> = Promise<FirebaseFunctionUpdateAction<P, T>>;

/**
 * A validated delete action for a Firebase function.
 *
 * Takes the entity `T` as input and returns void on successful deletion.
 */
export type FirebaseFunctionDeleteAction<P extends object, T> = TransformAndValidateFunctionResult<P, (input: T) => Promise<void>>;

/**
 * Async variant of {@link FirebaseFunctionDeleteAction}.
 */
export type AsyncFirebaseFunctionDeleteAction<P extends object, T> = Promise<FirebaseFunctionDeleteAction<P, T>>;

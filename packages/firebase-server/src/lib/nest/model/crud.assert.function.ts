import { type Maybe } from '@dereekb/util';
import { type NestContextCallableRequest } from '../function/nest';
import { type OnCallFunctionType, type FirestoreModelType } from '@dereekb/firebase';

/**
 * Discriminator for the category of CRUD operation being asserted.
 *
 * Used by {@link AssertModelCrudRequestFunction} to let assertions branch on operation type,
 * enabling cross-cutting rules like "block all deletes for archived models."
 */
export type AssertModelCrudRequestFunctionContextCrudType = 'call' | 'create' | 'read' | 'update' | 'delete';

/**
 * Context passed to a {@link AssertModelCrudRequestFunction} before a CRUD handler executes.
 *
 * Provides the original request alongside routing metadata (call type, model type, specifier)
 * so assertions can make fine-grained decisions without parsing the raw request.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type of the request.
 */
export interface AssertModelCrudRequestFunctionContext<N, I = unknown> {
  /** The original callable request including the NestJS context and caller data. */
  readonly request: NestContextCallableRequest<N, I>;
  /** The CRUD call type string (e.g., 'create', 'read'). */
  readonly call: OnCallFunctionType;
  /** The Firestore model type being targeted (e.g., 'profile', 'guestbook'). */
  readonly modelType: FirestoreModelType;
  /** The optional sub-operation specifier (e.g., 'username', 'fromUpload'). */
  readonly specifier: Maybe<string>;
}

/**
 * Pre-assertion hook invoked before a model CRUD handler executes.
 *
 * Throw an error to reject the request. Useful for cross-cutting concerns such as
 * feature flags, rate limiting, or role-based access restrictions that apply
 * across multiple model types or operations.
 *
 * @typeParam N - The NestJS context type.
 * @typeParam I - The input data type of the request.
 */
export type AssertModelCrudRequestFunction<N, I = unknown> = (context: AssertModelCrudRequestFunctionContext<N, I>) => void;

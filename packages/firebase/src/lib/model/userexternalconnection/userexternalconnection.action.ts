import { type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type UserExternalConnectionDocument } from './userexternalconnection';

/**
 * @module userexternalconnection.action
 *
 * Type aliases for UserExternalConnection server action functions.
 *
 * NOTE: there are no create/delete action aliases here on purpose. The document pair is only ever
 * mutated through the paired per-provider connect/update/disconnect operations in
 * `@dereekb/firebase-server/model`, which create and remove the documents themselves.
 *
 * @template P - the API parameter type for the action
 */

/**
 * Synchronous update action targeting a {@link UserExternalConnectionDocument}.
 */
export type UserExternalConnectionUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, UserExternalConnectionDocument>;

/**
 * Async update action targeting a {@link UserExternalConnectionDocument}.
 */
export type AsyncUserExternalConnectionUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, UserExternalConnectionDocument>;

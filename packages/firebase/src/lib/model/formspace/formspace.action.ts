import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type FormSpaceDocument } from './formspace';

/**
 * @module formspace.action
 *
 * Type aliases for FormSpace server action functions, following the same pattern as the StorageFile and
 * Calendar actions. See `@dereekb/firebase-server/model` for the implementations.
 *
 * @template P - the parameter type for the action
 */

/**
 * Synchronous create action targeting a {@link FormSpaceDocument}.
 */
export type FormSpaceCreateAction<P extends object> = FirebaseFunctionCreateAction<P, FormSpaceDocument>;

/**
 * Async create action targeting a {@link FormSpaceDocument}.
 */
export type AsyncFormSpaceCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, FormSpaceDocument>;

/**
 * Synchronous update action targeting a {@link FormSpaceDocument}.
 */
export type FormSpaceUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, FormSpaceDocument>;

/**
 * Async update action targeting a {@link FormSpaceDocument}.
 */
export type AsyncFormSpaceUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, FormSpaceDocument>;

/**
 * Synchronous delete action targeting a {@link FormSpaceDocument}.
 */
export type FormSpaceDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, FormSpaceDocument>;

/**
 * Async delete action targeting a {@link FormSpaceDocument}.
 */
export type AsyncFormSpaceDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, FormSpaceDocument>;

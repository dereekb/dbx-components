import { type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionDeleteAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionDeleteAction, type FirebaseFunctionUpdateAction } from '@dereekb/firebase';
import { type SystemStateDocument } from './system';

/**
 * @module system.action
 *
 * Type aliases for SystemState server action functions.
 *
 * @template P - the API parameter type for the action
 */

/**
 * Synchronous create action targeting a {@link SystemStateDocument}.
 */
export type SystemStateCreateAction<P extends object> = FirebaseFunctionCreateAction<P, SystemStateDocument>;

/**
 * Async create action targeting a {@link SystemStateDocument}.
 */
export type AsyncSystemStateCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, SystemStateDocument>;

/**
 * Synchronous update action targeting a {@link SystemStateDocument}.
 */
export type SystemStateUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, SystemStateDocument>;

/**
 * Async update action targeting a {@link SystemStateDocument}.
 */
export type AsyncSystemStateUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, SystemStateDocument>;

/**
 * Synchronous delete action targeting a {@link SystemStateDocument}.
 */
export type SystemStateDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, SystemStateDocument>;

/**
 * Async delete action targeting a {@link SystemStateDocument}.
 */
export type AsyncSystemStateDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, SystemStateDocument>;

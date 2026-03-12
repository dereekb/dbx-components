import { type AsyncFirebaseFunctionDeleteAction, type FirebaseFunctionDeleteAction, type AsyncFirebaseFunctionCreateAction, type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionCreateAction, type FirebaseFunctionUpdateAction } from '../../common';
import { type OidcEntryDocument } from './oidcmodel';

/**
 * @module oidcmodel.action
 *
 * Type aliases for OidcEntry server action functions.
 *
 * These connect API parameter types to their target document types, following the same
 * pattern as storagefile actions. See `@dereekb/firebase-server/oidc` for the
 * server-side action service implementations.
 *
 * @template P - the API parameter type for the action
 */

// MARK: OidcEntry Actions
/**
 * Synchronous create action targeting an {@link OidcEntryDocument}.
 */
export type OidcEntryCreateAction<P extends object> = FirebaseFunctionCreateAction<P, OidcEntryDocument>;

/**
 * Async create action targeting an {@link OidcEntryDocument}.
 */
export type AsyncOidcEntryCreateAction<P extends object> = AsyncFirebaseFunctionCreateAction<P, OidcEntryDocument>;

/**
 * Synchronous update action targeting an {@link OidcEntryDocument}.
 */
export type OidcEntryUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, OidcEntryDocument>;

/**
 * Async update action targeting an {@link OidcEntryDocument}.
 */
export type AsyncOidcEntryUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, OidcEntryDocument>;

/**
 * Synchronous delete action targeting an {@link OidcEntryDocument}.
 */
export type OidcEntryDeleteAction<P extends object> = FirebaseFunctionDeleteAction<P, OidcEntryDocument>;

/**
 * Async delete action targeting an {@link OidcEntryDocument}.
 */
export type AsyncOidcEntryDeleteAction<P extends object> = AsyncFirebaseFunctionDeleteAction<P, OidcEntryDocument>;

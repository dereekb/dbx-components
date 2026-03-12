import { type, type Type } from 'arktype';
import { type TargetModelParams, type OnCallCreateModelResult } from '../../common';
import { InferredTargetModelParams, inferredTargetModelParamsType, targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction, type ModelFirebaseDeleteFunction } from '../../client';
import { type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type OidcEntryClientId } from './oidcmodel.id';
import { type OidcModelTypes } from './oidcmodel';

export interface AbstractOidcClientParams {
  readonly client_name?: Maybe<string>;
  readonly redirect_uris?: Maybe<string[]>;
  readonly grant_types?: Maybe<string[]>;
  readonly response_types?: Maybe<string[]>;
}

export const abstractOidcClientParamsType = type({
  'client_name?': clearable('string'),
  'redirect_uris?': clearable('string[]'),
  'grant_types?': clearable('string[]'),
  'response_types?': clearable('string[]')
}) as Type<AbstractOidcClientParams>;

// MARK: Create
/**
 * Parameters for registering a new OAuth client for the target entity.
 *
 * If no target model is provided, assumes the current user.
 *
 * The server generates `client_id` and `client_secret` and creates the adapter entry.
 */
export interface CreateOidcClientParams extends AbstractOidcClientParams, InferredTargetModelParams {}

export const createOidcClientParamsType = inferredTargetModelParamsType.merge(abstractOidcClientParamsType).merge({
  client_name: 'string'
}) as Type<CreateOidcClientParams>;

/**
 * Result of creating a new OAuth client.
 *
 * Includes the generated `client_secret` in plaintext — this is the only time
 * it is returned to the caller.
 */
export interface CreateOidcClientResult extends OnCallCreateModelResult {
  readonly client_id: OidcEntryClientId;
  readonly client_secret: string;
}

// MARK: Update
/**
 * Parameters for updating an existing OAuth client.
 */
export interface UpdateOidcClientParams extends AbstractOidcClientParams, TargetModelParams {}

export const updateOidcClientParamsType = targetModelParamsType.merge(abstractOidcClientParamsType) as Type<UpdateOidcClientParams>;

// MARK: Delete
/**
 * Parameters for revoking/deleting an OAuth client.
 */
export interface DeleteOidcClientParams extends TargetModelParams {}

export const deleteOidcClientParamsType = targetModelParamsType as Type<DeleteOidcClientParams>;

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for OIDC.
 */
export type OidcModelFunctionTypeMap = {};

export const oidcFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<OidcModelFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the OIDC client model.
 *
 * Uses `oidcEntry` as the key, matching the adapter collection identity.
 */
export type OidcModelCrudFunctionsConfig = {
  readonly oidcEntry: {
    create: {
      client: [CreateOidcClientParams, CreateOidcClientResult];
    };
    update: {
      client: UpdateOidcClientParams;
    };
    delete: {
      client: DeleteOidcClientParams;
    };
  };
};

export const oidcModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<OidcModelCrudFunctionsConfig, OidcModelTypes> = {
  oidcEntry: ['create:client', 'update:client', 'delete:client']
};

/**
 * Abstract class defining all callable OIDC cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 */
export abstract class OidcModelFunctions implements ModelFirebaseFunctionMap<OidcModelFunctionTypeMap, OidcModelCrudFunctionsConfig> {
  abstract oidcEntry: {
    createOidcEntry: {
      client: ModelFirebaseCreateFunction<CreateOidcClientParams, CreateOidcClientResult>;
    };
    updateOidcEntry: {
      client: ModelFirebaseCrudFunction<UpdateOidcClientParams>;
    };
    deleteOidcEntry: {
      client: ModelFirebaseDeleteFunction<DeleteOidcClientParams>;
    };
  };
}

/**
 * Client-side callable function map factory for OIDC client CRUD operations.
 *
 * @example
 * ```ts
 * const functions = oidcFunctionMap(callableFactory);
 * const result = await functions.oidcEntry.createOidcEntry.create({
 *   client_name: 'My App',
 *   redirect_uris: ['https://myapp.com/callback']
 * });
 * ```
 */
export const oidcModelFunctionMap = callModelFirebaseFunctionMapFactory(oidcFunctionTypeConfigMap, oidcModelCrudFunctionsConfig);

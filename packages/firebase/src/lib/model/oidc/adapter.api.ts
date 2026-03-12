import { type, type Type } from 'arktype';
import { type TargetModelParams, type OnCallCreateModelResult } from '../../common';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction, type ModelFirebaseDeleteFunction } from '../../client';
import { type Maybe } from '@dereekb/util';
import { type OidcAdapterEntryId } from './adapter.id';
import { type OidcModelTypes } from './adapter';

// MARK: Create
/**
 * Parameters for registering a new OAuth client.
 *
 * The server generates `client_id` and `client_secret` and creates the adapter entry.
 */
export interface CreateOidcClientParams {
  readonly client_name: string;
  readonly redirect_uris: string[];
  readonly grant_types?: Maybe<string[]>;
  readonly response_types?: Maybe<string[]>;
}

export const createOidcClientParamsType = type({
  client_name: 'string',
  redirect_uris: 'string[]',
  'grant_types?': 'string[]',
  'response_types?': 'string[]'
}) as Type<CreateOidcClientParams>;

/**
 * Result of creating a new OAuth client.
 *
 * Includes the generated `client_secret` in plaintext — this is the only time
 * it is returned to the caller.
 */
export interface CreateOidcClientResult extends OnCallCreateModelResult {
  readonly client_id: OidcAdapterEntryId;
  readonly client_secret: string;
}

// MARK: Update
/**
 * Parameters for updating an existing OAuth client.
 */
export interface UpdateOidcClientParams extends TargetModelParams {
  readonly client_name?: Maybe<string>;
  readonly redirect_uris?: Maybe<string[]>;
  readonly grant_types?: Maybe<string[]>;
  readonly response_types?: Maybe<string[]>;
}

export const updateOidcClientParamsType = targetModelParamsType.merge({
  'client_name?': 'string',
  'redirect_uris?': 'string[]',
  'grant_types?': 'string[]',
  'response_types?': 'string[]'
}) as Type<UpdateOidcClientParams>;

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
export type OidcFunctionTypeMap = {};

export const oidcFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<OidcFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the OIDC client model.
 *
 * Uses `oidcAdapterEntry` as the key, matching the adapter collection identity.
 */
export type OidcModelCrudFunctionsConfig = {
  readonly oidcAdapterEntry: {
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
  oidcAdapterEntry: ['create:client', 'update:client', 'delete:client']
};

/**
 * Abstract class defining all callable OIDC cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 */
export abstract class OidcFunctions implements ModelFirebaseFunctionMap<OidcFunctionTypeMap, OidcModelCrudFunctionsConfig> {
  abstract oidcAdapterEntry: {
    createOidcAdapterEntry: {
      client: ModelFirebaseCreateFunction<CreateOidcClientParams, CreateOidcClientResult>;
    };
    updateOidcAdapterEntry: {
      client: ModelFirebaseCrudFunction<UpdateOidcClientParams>;
    };
    deleteOidcAdapterEntry: {
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
 * const result = await functions.oidcAdapterEntry.createOidcAdapterEntry.create({
 *   client_name: 'My App',
 *   redirect_uris: ['https://myapp.com/callback']
 * });
 * ```
 */
export const oidcFunctionMap = callModelFirebaseFunctionMapFactory(oidcFunctionTypeConfigMap, oidcModelCrudFunctionsConfig);

import { type, type Type } from 'arktype';
import { type TargetModelParams, type OnCallCreateModelResult } from '../../common';
import { type InferredTargetModelParams, inferredTargetModelParamsType, targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction, type ModelFirebaseDeleteFunction, type ModelFirebaseUpdateFunction } from '../../client';
import { type WebsiteUrlWithPrefix, type Maybe } from '@dereekb/util';
import { clearable } from '@dereekb/model';
import { type OidcEntryClientId } from './oidcmodel.id';
import { type OidcModelTypes } from './oidcmodel';
import { type OidcRedirectUri, type OidcTokenEndpointAuthMethod } from './oidcmodel.interaction';

/**
 * Fields that can be changed on an existing OIDC client.
 *
 * Does NOT include `token_endpoint_auth_method` — that is immutable after creation.
 */
export interface UpdateOidcClientFieldParams {
  readonly client_name: string;
  readonly redirect_uris: OidcRedirectUri[];
  readonly logo_uri?: Maybe<WebsiteUrlWithPrefix>;
  readonly client_uri?: Maybe<WebsiteUrlWithPrefix>;
}

export const updateOidcClientFieldParamsType = type({
  client_name: 'string',
  redirect_uris: 'string[]',
  'logo_uri?': clearable('string'),
  'client_uri?': clearable('string')
}) as Type<UpdateOidcClientFieldParams>;

export const createOidcClientFieldParamsType = updateOidcClientFieldParamsType.merge(
  type({
    token_endpoint_auth_method: "'client_secret_basic' | 'client_secret_post' | 'client_secret_jwt' | 'private_key_jwt'"
  })
);

// MARK: Create
/**
 * Parameters for registering a new OAuth client for the target entity.
 *
 * If no target model is provided, assumes the current user.
 *
 * The server generates `client_id` and `client_secret` and creates the adapter entry.
 *
 * Extends {@link UpdateOidcClientFieldParams} with `token_endpoint_auth_method` which is immutable after creation.
 */
export interface CreateOidcClientParams extends UpdateOidcClientFieldParams, InferredTargetModelParams {
  readonly token_endpoint_auth_method: OidcTokenEndpointAuthMethod;
  /**
   * URL where the client's public JSON Web Key Set can be fetched.
   *
   * Used with `private_key_jwt` authentication so the provider can retrieve
   * the client's public keys to verify `client_assertion` JWTs.
   * The client manages key rotation at this URL independently.
   */
  readonly jwks_uri?: WebsiteUrlWithPrefix;
}

export const createOidcClientParamsType = inferredTargetModelParamsType.merge(createOidcClientFieldParamsType) as Type<CreateOidcClientParams>;

/**
 * Result of creating a new OAuth client.
 *
 * Includes the generated `client_secret` in plaintext — this is the only time
 * it is returned to the caller.
 */
export interface CreateOidcClientResult extends OnCallCreateModelResult {
  readonly client_id: OidcEntryClientId;
  /**
   * The generated client secret in plaintext. Only returned for auth methods that require a secret
   * (e.g., `client_secret_basic`, `client_secret_post`). Undefined for `private_key_jwt`.
   */
  readonly client_secret?: string;
}

// MARK: Update
/**
 * Parameters for updating an existing OAuth client.
 *
 * Uses {@link UpdateOidcClientFieldParams} — `token_endpoint_auth_method` is immutable.
 */
export interface UpdateOidcClientParams extends UpdateOidcClientFieldParams, TargetModelParams {}

export const updateOidcClientParamsType = targetModelParamsType.merge(updateOidcClientFieldParamsType) as Type<UpdateOidcClientParams>;

export type RotateOidcClientSecretParams = TargetModelParams;

export const rotateOidcClientSecretParamsType = targetModelParamsType as Type<RotateOidcClientSecretParams>;

export type RotateOidcClientSecretResult = Pick<CreateOidcClientResult, 'client_id' | 'client_secret'>;

// MARK: Delete
/**
 * Parameters for revoking/deleting an OAuth client.
 */
export type DeleteOidcClientParams = TargetModelParams;

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
      rotateClientSecret: [RotateOidcClientSecretParams, RotateOidcClientSecretResult];
    };
    delete: {
      client: DeleteOidcClientParams;
    };
  };
};

export const oidcModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<OidcModelCrudFunctionsConfig, OidcModelTypes> = {
  oidcEntry: ['create:client', 'update:client,rotateClientSecret', 'delete:client']
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
      rotateClientSecret: ModelFirebaseUpdateFunction<RotateOidcClientSecretParams, RotateOidcClientSecretResult>;
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

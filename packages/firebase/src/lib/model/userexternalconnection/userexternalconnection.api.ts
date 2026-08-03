import { type, type Type } from 'arktype';
import { type InferredTargetModelParams, inferredTargetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type UserExternalConnectionTypes } from './userexternalconnection';
import { type UserExternalConnectionProviderType } from './userexternalconnection.id';

// MARK: Update
/**
 * Parameters for disconnecting the current user from a third-party provider.
 *
 * This is the ONLY write path a client has to the connection pair. There is deliberately no connect
 * or update params type here: connecting requires credentials, which only the server ever sees.
 *
 * If no target model is provided, the current user's connection document is assumed.
 *
 * @dbxModelApiParams
 */
export interface DisconnectUserExternalConnectionParams extends InferredTargetModelParams {
  /**
   * The provider type to disconnect from.
   */
  readonly providerType: UserExternalConnectionProviderType;
}

export const disconnectUserExternalConnectionParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    providerType: 'string'
  })
) as Type<DisconnectUserExternalConnectionParams>;

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for UserExternalConnection. There are none.
 */
export type UserExternalConnectionFunctionTypeMap = {};

export const USER_EXTERNAL_CONNECTION_FUNCTION_TYPE_CONFIG_MAP: FirebaseFunctionTypeConfigMap<UserExternalConnectionFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the UserExternalConnection model.
 */
export type UserExternalConnectionModelCrudFunctionsConfig = {
  readonly userExternalConnection: {
    update: {
      /**
       * Disconnects the current user from the given provider.
       *
       * Removes the provider's credentials and its entry in one transaction, and recomputes the
       * connected-provider array from the result.
       */
      disconnect: DisconnectUserExternalConnectionParams;
    };
  };
};

export const USER_EXTERNAL_CONNECTION_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<UserExternalConnectionModelCrudFunctionsConfig, UserExternalConnectionTypes> = {
  userExternalConnection: ['update:disconnect']
};

/**
 * Abstract class defining all callable UserExternalConnection cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 */
export abstract class UserExternalConnectionFunctions implements ModelFirebaseFunctionMap<UserExternalConnectionFunctionTypeMap, UserExternalConnectionModelCrudFunctionsConfig> {
  abstract userExternalConnection: {
    updateUserExternalConnection: {
      disconnect: ModelFirebaseCrudFunction<DisconnectUserExternalConnectionParams>;
    };
  };
}

/**
 * Used to generate the UserExternalConnectionFunctions map for a Functions instance.
 */
export const userExternalConnectionFunctionMap = callModelFirebaseFunctionMapFactory(USER_EXTERNAL_CONNECTION_FUNCTION_TYPE_CONFIG_MAP, USER_EXTERNAL_CONNECTION_MODEL_CRUD_FUNCTIONS_CONFIG);

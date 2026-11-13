import { type, type Type } from 'arktype';
import { type Maybe } from '@dereekb/util';
import { type InferredTargetModelParams, inferredTargetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCreateFunction, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap } from '../../client';
import { type UserExternalConnectionTypes } from './userexternalconnection';
import { type UserExternalConnectionProviderType } from './userexternalconnection.id';
import { type UserExternalConnectionScopePresetKey } from './userexternalconnection.preset';
import { type UserExternalConnectionDataItemKey, type UserExternalConnectionDataItemSummary, type UserExternalConnectionDataMap, type UserExternalConnectionDataTypeKey, type UserExternalConnectionDataTypeSummary, type UserExternalConnectionDataValue } from './userexternalconnection.data';

// MARK: Create
/**
 * Parameters for creating the calling user's connection document.
 *
 * Deliberately empty: the document is keyed by uid, so there is nothing to target and nothing to
 * seed it with — providers arrive one at a time through the OAuth flow, never at creation.
 *
 * @dbxModelApiParams
 */
export interface CreateUserExternalConnectionParams {}

export const createUserExternalConnectionParamsType = /* @__PURE__ */ type({}) as Type<CreateUserExternalConnectionParams>;

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

// MARK: Read
/**
 * Parameters for beginning an OAuth connect handoff for a provider.
 *
 * @dbxModelApiParams
 */
export interface ReadUserExternalConnectionAuthorizeStateParams extends InferredTargetModelParams {
  /**
   * The provider type to begin connecting to.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Which handoff the state begins. Defaults to `connect`.
   *
   * - `connect` — attach the provider as a DATA connection, with the data scopes.
   * - `link` — make the provider a LOGIN METHOD for the already-signed-in caller, with the sign-in
   *   scopes. A separate round trip because the two scope sets are not guaranteed to be the same,
   *   so a data grant cannot be assumed to cover an identity read.
   *
   * Absent means `connect`, so a client minting a state before `link` existed still gets one.
   */
  readonly mode?: Maybe<'connect' | 'link'>;
  /**
   * Key of the scope preset to connect with, for a provider that declares scope presets.
   *
   * Only applies to the `connect` mode; ignored for `link`. Absent means the provider's default preset
   * (or no preset at all when the provider declares none). A key the provider does not declare is
   * refused with `USER_EXTERNAL_CONNECTION_SCOPE_PRESET_NOT_ALLOWED`.
   */
  readonly scopePreset?: Maybe<UserExternalConnectionScopePresetKey>;
}

export const readUserExternalConnectionAuthorizeStateParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    providerType: 'string',
    'mode?': "'connect' | 'link'",
    'scopePreset?': 'string'
  })
) as Type<ReadUserExternalConnectionAuthorizeStateParams>;

// MARK: Unlink
/**
 * Parameters for removing a provider as a LOGIN METHOD for the current user.
 *
 * Distinct from {@link DisconnectUserExternalConnectionParams}, and strictly larger: a disconnect
 * drops the data connection and leaves the login link in place, whereas an unlink removes the login
 * link AND the data connection and its credentials. "Stop using my Discord token" and "Discord is no
 * longer how I log in" are different requests, so they are different calls.
 *
 * If no target model is provided, the current user's connection document is assumed.
 *
 * @dbxModelApiParams
 */
export interface UnlinkUserExternalConnectionLoginParams extends InferredTargetModelParams {
  /**
   * The provider type to unlink.
   */
  readonly providerType: UserExternalConnectionProviderType;
}

export const unlinkUserExternalConnectionLoginParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    providerType: 'string'
  })
) as Type<UnlinkUserExternalConnectionLoginParams>;

// MARK: Data
/**
 * Parameters for reading the calling user's stored connection data (`UserExternalConnectionData`).
 *
 * Always reads the caller's own data. Every filter is optional: omit them all to read everything the caller may use.
 *
 * @dbxModelApiParams
 */
export interface ReadUserExternalConnectionDataParams extends InferredTargetModelParams {
  /**
   * Only this provider's data. Omit for every provider the caller may use.
   */
  readonly providerType?: Maybe<UserExternalConnectionProviderType>;
  /**
   * Only this data type, e.g. `mail_signature`.
   */
  readonly dataType?: Maybe<UserExternalConnectionDataTypeKey>;
  /**
   * Only this item, e.g. `me` or a mailbox address.
   */
  readonly itemKey?: Maybe<UserExternalConnectionDataItemKey>;
  /**
   * Return item summaries only, without values.
   */
  readonly keysOnly?: Maybe<boolean>;
}

export const readUserExternalConnectionDataParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    'providerType?': 'string',
    'dataType?': 'string',
    'itemKey?': 'string',
    'keysOnly?': 'boolean'
  })
) as Type<ReadUserExternalConnectionDataParams>;

/**
 * Result of reading the calling user's connection data.
 */
export interface ReadUserExternalConnectionDataResult {
  /**
   * The values, keyed provider type → data type → item key. Absent with `keysOnly`.
   */
  readonly data?: UserExternalConnectionDataMap;
  /**
   * A summary of every matching item.
   */
  readonly items: readonly UserExternalConnectionDataItemSummary[];
  /**
   * The data types the caller may store (for the matching provider), so a caller can discover what to save.
   */
  readonly dataTypes: readonly UserExternalConnectionDataTypeSummary[];
}

/**
 * Sets one item.
 */
export interface UserExternalConnectionDataSetOperation {
  readonly dataType: UserExternalConnectionDataTypeKey;
  readonly itemKey: UserExternalConnectionDataItemKey;
  /**
   * The value, validated against the data type's registered shape.
   */
  readonly value: UserExternalConnectionDataValue;
}

/**
 * Removes one item, or a whole data type when `itemKey` is omitted.
 */
export interface UserExternalConnectionDataUnsetOperation {
  readonly dataType: UserExternalConnectionDataTypeKey;
  readonly itemKey?: Maybe<UserExternalConnectionDataItemKey>;
}

/**
 * Parameters for changing the calling user's stored data for one provider.
 *
 * Applies `clear`, then every `unset`, then every `set`, in one transaction.
 *
 * @dbxModelApiParams
 */
export interface UpdateUserExternalConnectionDataParams extends InferredTargetModelParams {
  /**
   * The provider whose data to change, e.g. `microsoft`.
   */
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * Items to set (create or replace).
   */
  readonly set?: Maybe<readonly UserExternalConnectionDataSetOperation[]>;
  /**
   * Items (or whole data types) to remove.
   */
  readonly unset?: Maybe<readonly UserExternalConnectionDataUnsetOperation[]>;
  /**
   * Drop all of this provider's data first. Written without decrypting, so it also recovers an unreadable document.
   */
  readonly clear?: Maybe<boolean>;
}

export const updateUserExternalConnectionDataParamsType = /* @__PURE__ */ inferredTargetModelParamsType.merge(
  type({
    providerType: 'string',
    'set?': type({ dataType: 'string', itemKey: 'string', value: 'Record<string, unknown>' }).array(),
    'unset?': type({ dataType: 'string', 'itemKey?': 'string' }).array(),
    'clear?': 'boolean'
  })
) as Type<UpdateUserExternalConnectionDataParams>;

/**
 * Result of changing the calling user's connection data. Never carries values.
 */
export interface UpdateUserExternalConnectionDataResult {
  /**
   * The provider's items after the write.
   */
  readonly items: readonly UserExternalConnectionDataItemSummary[];
}

/**
 * The opaque, short-lived `state` to carry through a provider's OAuth handoff.
 *
 * Minting it requires an authenticated call, because a top-level navigation to the provider's
 * authorize endpoint carries no credentials and the server must already know who is connecting. The
 * client's only job is to pass this through — it must never append its ID token to the redirect.
 */
export interface UserExternalConnectionAuthorizeStateResult {
  /**
   * The state to send on the authorize request.
   */
  readonly state: string;
}

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
    /**
     * Creates the calling user's connection document.
     *
     * Every other client-reachable operation asserts a role against this document, so it must exist
     * before a user can begin a connect. Creating it is its own call — rather than a side effect of
     * the first connect — so that "may this user have external connections at all?" is decided in
     * one place instead of being folded into the OAuth handoff.
     *
     * Throws when the document already exists.
     */
    create: CreateUserExternalConnectionParams;
    read: {
      /**
       * Mints the short-lived `state` that begins an OAuth connect handoff for a provider.
       *
       * A read rather than an update: it changes nothing, it just proves who is asking. The app
       * decides how the state is signed and how long it lives.
       */
      authorizeState: [ReadUserExternalConnectionAuthorizeStateParams, UserExternalConnectionAuthorizeStateResult];
      /**
       * Reads the caller's stored connection data (UserExternalConnectionData): per-provider settings such as default
       * mail signatures, decrypted server-side. Also returns the data types the caller may store.
       *
       * Example: `{ providerType: 'microsoft', dataType: 'mail_signature' }`. Use `keysOnly: true` to list items without values.
       */
      data: [ReadUserExternalConnectionDataParams, ReadUserExternalConnectionDataResult];
    };
    update: {
      /**
       * Disconnects the current user from the given provider.
       *
       * Removes the provider's credentials and its entry in one transaction, and recomputes the
       * connected-provider array from the result. The provider's LOGIN LINK is retained — a data
       * connection ending says nothing about whether the provider is still a way to sign in.
       */
      disconnect: DisconnectUserExternalConnectionParams;
      /**
       * Removes the given provider as a login method for the current user.
       *
       * Removes the login link, the entry, and the credentials in one transaction. Refused when it
       * would leave the account with no way to sign back in.
       */
      unlink: UnlinkUserExternalConnectionLoginParams;
      /**
       * Saves or removes the caller's stored connection data for one provider, encrypted at rest. The app CLI hands it
       * to the provider's CLI as DEFAULT settings when it mints a token (explicit local config and flags still win).
       *
       * Example (a default msgraph-cli signature for a shared mailbox):
       * `{ providerType: 'microsoft', set: [{ dataType: 'mail_signature', itemKey: 'support@example.com', value: { html: '<p>…</p>' } }] }`.
       * Use `itemKey: 'me'` for your own mailbox. `unset` removes items; `clear: true` removes everything for the provider.
       * Call `read` `data` first to see which data types are allowed.
       */
      data: [UpdateUserExternalConnectionDataParams, UpdateUserExternalConnectionDataResult];
    };
  };
};

export const USER_EXTERNAL_CONNECTION_MODEL_CRUD_FUNCTIONS_CONFIG: ModelFirebaseCrudFunctionConfigMap<UserExternalConnectionModelCrudFunctionsConfig, UserExternalConnectionTypes> = {
  userExternalConnection: ['create', 'read:authorizeState,data', 'update:data,disconnect,unlink']
};

/**
 * Abstract class defining all callable UserExternalConnection cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 */
export abstract class UserExternalConnectionFunctions implements ModelFirebaseFunctionMap<UserExternalConnectionFunctionTypeMap, UserExternalConnectionModelCrudFunctionsConfig> {
  abstract userExternalConnection: {
    createUserExternalConnection: ModelFirebaseCreateFunction<CreateUserExternalConnectionParams>;
    readUserExternalConnection: {
      authorizeState: ModelFirebaseCrudFunction<ReadUserExternalConnectionAuthorizeStateParams, UserExternalConnectionAuthorizeStateResult>;
      data: ModelFirebaseCrudFunction<ReadUserExternalConnectionDataParams, ReadUserExternalConnectionDataResult>;
    };
    updateUserExternalConnection: {
      disconnect: ModelFirebaseCrudFunction<DisconnectUserExternalConnectionParams>;
      unlink: ModelFirebaseCrudFunction<UnlinkUserExternalConnectionLoginParams>;
      data: ModelFirebaseCrudFunction<UpdateUserExternalConnectionDataParams, UpdateUserExternalConnectionDataResult>;
    };
  };
}

/**
 * Used to generate the UserExternalConnectionFunctions map for a Functions instance.
 */
export const userExternalConnectionFunctionMap = callModelFirebaseFunctionMapFactory(USER_EXTERNAL_CONNECTION_FUNCTION_TYPE_CONFIG_MAP, USER_EXTERNAL_CONNECTION_MODEL_CRUD_FUNCTIONS_CONFIG);

import { type Maybe } from '@dereekb/util';
import {
  USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE,
  type UserExternalConnectionDataItemKey,
  type UserExternalConnectionDataTypeKey,
  type UserExternalConnectionProviderType
} from '@dereekb/firebase';
import { badRequestError, internalServerError } from '@dereekb/firebase-server';

export { USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE, USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE, USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE, USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE, USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR_CODE } from '@dereekb/firebase';

/**
 * Creates an error refusing a data type the app has not registered for the provider.
 *
 * @param providerType - The provider.
 * @param dataType - The refused data type.
 * @returns A bad-request HttpsError.
 */
export function userExternalConnectionDataTypeNotAllowedError(providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey) {
  return badRequestError({
    message: `"${dataType}" is not a connection data type of the "${providerType}" provider. Read the connection data first to list the allowed data types.`,
    code: USER_EXTERNAL_CONNECTION_DATA_TYPE_NOT_ALLOWED_ERROR_CODE,
    data: { providerType, dataType }
  });
}

/**
 * Creates an error refusing an item key the data type does not accept.
 *
 * The key itself is deliberately absent: keys can be personal (an email address).
 *
 * @param providerType - The provider.
 * @param dataType - The data type.
 * @param itemKeyDescription - The data type's description of valid keys.
 * @returns A bad-request HttpsError.
 */
export function userExternalConnectionDataItemKeyInvalidError(providerType: UserExternalConnectionProviderType, dataType: UserExternalConnectionDataTypeKey, itemKeyDescription?: Maybe<string>) {
  return badRequestError({
    message: `Invalid item key for "${providerType}" connection data type "${dataType}".${itemKeyDescription ? ` Expected ${itemKeyDescription}.` : ''}`,
    code: USER_EXTERNAL_CONNECTION_DATA_ITEM_KEY_INVALID_ERROR_CODE,
    data: { providerType, dataType }
  });
}

/**
 * Creates an error refusing a value that does not match the data type's shape.
 *
 * Carries the first failing path only — never the value, and never arktype's summary, which can quote the value.
 *
 * @param input - The provider, data type, item key and the first failing path.
 * @returns A bad-request HttpsError.
 */
export function userExternalConnectionDataValueInvalidError(input: { readonly providerType: UserExternalConnectionProviderType; readonly dataType: UserExternalConnectionDataTypeKey; readonly itemKey: UserExternalConnectionDataItemKey; readonly path?: Maybe<string> }) {
  const { providerType, dataType, itemKey, path } = input;

  return badRequestError({
    message: `Invalid value for "${providerType}" connection data type "${dataType}"${path ? ` at "${path}"` : ''}.`,
    code: USER_EXTERNAL_CONNECTION_DATA_VALUE_INVALID_ERROR_CODE,
    data: { providerType, dataType, itemKey, path }
  });
}

/**
 * What a {@link userExternalConnectionDataTooLargeError} limit applies to.
 */
export type UserExternalConnectionDataTooLargeScope = 'value' | 'items' | 'document' | 'operations';

/**
 * Data of a {@link userExternalConnectionDataTooLargeError}.
 */
export interface UserExternalConnectionDataTooLargeErrorData {
  readonly scope: UserExternalConnectionDataTooLargeScope;
  readonly limit: number;
  /**
   * The size in bytes, for the `value` and `document` scopes.
   */
  readonly bytes?: Maybe<number>;
  /**
   * The count, for the `items` and `operations` scopes.
   */
  readonly count?: Maybe<number>;
  readonly providerType?: Maybe<UserExternalConnectionProviderType>;
  readonly dataType?: Maybe<UserExternalConnectionDataTypeKey>;
}

/**
 * Creates an error refusing a write that exceeds a limit.
 *
 * @param data - Which limit, and by how much.
 * @returns A bad-request HttpsError.
 */
export function userExternalConnectionDataTooLargeError(data: UserExternalConnectionDataTooLargeErrorData) {
  const { scope, limit, bytes, count, dataType } = data;
  let message: string;

  switch (scope) {
    case 'value':
      message = `A "${dataType}" value is ${bytes} bytes; the limit is ${limit}.`;
      break;
    case 'items':
      message = `Too many "${dataType}" items (${count}); the limit is ${limit}.`;
      break;
    case 'document':
      message = `The stored connection data would be ${bytes} bytes; the limit is ${limit}. Remove items first.`;
      break;
    case 'operations':
      message = `Too many operations (${count}) in one update; the limit is ${limit}.`;
      break;
  }

  return badRequestError({
    message,
    code: USER_EXTERNAL_CONNECTION_DATA_TOO_LARGE_ERROR_CODE,
    data
  });
}

/**
 * Creates an error reporting that the stored connection data could not be decrypted.
 *
 * @returns An internal-server HttpsError.
 */
export function userExternalConnectionDataUnreadableError() {
  return internalServerError({
    message: 'The stored connection data could not be read. Update it with `clear: true` to replace it.',
    code: USER_EXTERNAL_CONNECTION_DATA_UNREADABLE_ERROR_CODE
  });
}

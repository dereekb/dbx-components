import {
  firestoreModelKey,
  type ReadUserExternalConnectionDataParams,
  type ReadUserExternalConnectionDataResult,
  readUserExternalConnectionDataParamsType,
  type UpdateUserExternalConnectionDataParams,
  type UpdateUserExternalConnectionDataResult,
  type UserExternalConnectionProviderType,
  updateUserExternalConnectionDataParamsType,
  userExternalConnectionIdentity
} from '@dereekb/firebase';
import { isAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { assertUserExternalConnectionProviderConnectable } from '@dereekb/firebase-server/model';
import { type DemoReadModelFunction, type DemoUpdateModelFunction } from '../function.context';

/**
 * Whether a provider's data is reachable by the caller: its connect policy decides (an `adminOnly` provider needs an
 * admin), and a refused provider looks exactly like an unmounted one.
 *
 * @param input - The connectability assertion input, minus the provider.
 * @returns A predicate over provider types.
 */
function isProviderConnectableFunction(input: Omit<Parameters<typeof assertUserExternalConnectionProviderConnectable>[0], 'providerType'>) {
  return (providerType: UserExternalConnectionProviderType) => {
    let allowed: boolean;

    try {
      assertUserExternalConnectionProviderConnectable({ ...input, providerType });
      allowed = true;
    } catch {
      allowed = false;
    }

    return allowed;
  };
}

/**
 * Reads the caller's own stored connection data (`UserExternalConnectionData`), decrypted server-side, plus the data
 * types the caller may store.
 *
 * Always the caller's own uid: `key` is ignored, as in every UserExternalConnection callable. A named provider must be
 * connectable by the caller; with no provider named, the result is filtered to the providers that are. The `data` role
 * is asserted on the caller's `/uec` document, which therefore has to exist.
 */
export const userExternalConnectionReadData: DemoReadModelFunction<ReadUserExternalConnectionDataParams, ReadUserExternalConnectionDataResult> = withApiDetails({
  inputType: readUserExternalConnectionDataParamsType,
  mcp: { readOnly: true },
  fn: async (request) => {
    const { nest, data, auth } = request;
    const connectable = { oauthRegistry: nest.userExternalConnectionOAuthRegistry, policyRegistry: nest.userExternalConnectionProviderPolicyRegistry, isAdmin: isAdminInRequest(request) };

    if (data.providerType != null) {
      assertUserExternalConnectionProviderConnectable({ ...connectable, providerType: data.providerType });
    }

    const uid = auth.uid;

    return nest.useModel('userExternalConnection', {
      request,
      key: firestoreModelKey(userExternalConnectionIdentity, uid),
      roles: 'data',
      use: () => nest.userExternalConnectionDataActions.readUserExternalConnectionData({ uid, params: data, isProviderAllowed: isProviderConnectableFunction(connectable) })
    });
  }
});

/**
 * Saves or removes the caller's own stored connection data for one provider, encrypted at rest.
 *
 * A `set` is a reversible preference, so it stays on the write surface; `unset` and `clear` escalate to destructive.
 * Every value is validated against the data type the demo registered (`DEMO_USER_EXTERNAL_CONNECTION_DATA_TYPES`).
 */
export const userExternalConnectionUpdateData: DemoUpdateModelFunction<UpdateUserExternalConnectionDataParams, UpdateUserExternalConnectionDataResult> = withApiDetails({
  inputType: updateUserExternalConnectionDataParamsType,
  mcp: {
    destructive: false,
    escalatingParams: { unset: { destructive: true }, clear: { destructive: true } }
  },
  fn: async (request) => {
    const { nest, data, auth } = request;

    assertUserExternalConnectionProviderConnectable({
      oauthRegistry: nest.userExternalConnectionOAuthRegistry,
      policyRegistry: nest.userExternalConnectionProviderPolicyRegistry,
      providerType: data.providerType,
      isAdmin: isAdminInRequest(request)
    });

    const uid = auth.uid;

    return nest.useModel('userExternalConnection', {
      request,
      key: firestoreModelKey(userExternalConnectionIdentity, uid),
      roles: 'data',
      use: () => nest.userExternalConnectionDataActions.updateUserExternalConnectionData({ uid, params: data })
    });
  }
});

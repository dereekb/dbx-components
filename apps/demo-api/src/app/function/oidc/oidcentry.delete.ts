import { type DeleteOidcTokenParams, deleteOidcTokenParamsType } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const oidcEntryDeleteToken: DemoDeleteModelFunction<DeleteOidcTokenParams> = withApiDetails({
  inputType: deleteOidcTokenParamsType,
  analytics: {
    onSuccess: (analytics) => {
      analytics.sendEventType('OIDC Grant Revoked');
    },
    onError: (analytics) => {
      analytics.sendEventType('OIDC Grant Revoke Failed');
    }
  },
  fn: async (request) => {
    const { nest, data } = request;

    const deleteFn = await nest.oidcModelServerActions.deleteOidcToken(data);
    const document = await nest.useModel('oidcEntry', {
      request,
      key: data.key,
      roles: 'delete',
      use: (x) => x.document
    });

    await deleteFn(document);
  }
});

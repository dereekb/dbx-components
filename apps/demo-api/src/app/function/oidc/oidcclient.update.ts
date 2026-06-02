import { type RotateOidcClientSecretParams, type RotateOidcClientSecretResult, type UpdateOidcClientParams, rotateOidcClientSecretParamsType, updateOidcClientParamsType } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const oidcEntryUpdateClient: DemoUpdateModelFunction<UpdateOidcClientParams> = withApiDetails({
  inputType: updateOidcClientParamsType,
  analytics: {
    onSuccess: (analytics) => {
      analytics.sendEventType('OIDC Client Updated');
    },
    onError: (analytics) => {
      analytics.sendEventType('OIDC Client Update Failed');
    }
  },
  fn: async (request) => {
    const { nest, data } = request;

    const updateFn = await nest.oidcModelServerActions.updateOidcClient(data);
    const document = await nest.useModel('oidcEntry', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateFn(document);
  }
});
export const oidcEntryRotateClientSecret: DemoUpdateModelFunction<RotateOidcClientSecretParams, RotateOidcClientSecretResult> = withApiDetails({
  inputType: rotateOidcClientSecretParamsType,
  analytics: {
    onSuccess: (analytics, request, result) => {
      analytics.sendEvent('OIDC Client Secret Rotated', { client_id: result?.client_id });
    },
    onError: (analytics) => {
      analytics.sendEventType('OIDC Client Secret Rotate Failed');
    }
  },
  fn: async (request) => {
    const { nest, data } = request;

    const rotateFn = await nest.oidcModelServerActions.rotateOidcClientSecret(data);
    const document = await nest.useModel('oidcEntry', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    return rotateFn(document);
  }
});

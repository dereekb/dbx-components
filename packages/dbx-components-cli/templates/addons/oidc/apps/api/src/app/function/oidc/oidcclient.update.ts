import { type RotateOidcClientSecretParams, type RotateOidcClientSecretResult, type UpdateOidcClientParams, rotateOidcClientSecretParamsType, updateOidcClientParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const oidcEntryUpdateClient: APP_CODE_PREFIXUpdateModelFunction<UpdateOidcClientParams> = withApiDetails({
  inputType: updateOidcClientParamsType,
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

export const oidcEntryUpdateRotateClientSecret: APP_CODE_PREFIXUpdateModelFunction<RotateOidcClientSecretParams, RotateOidcClientSecretResult> = withApiDetails({
  inputType: rotateOidcClientSecretParamsType,
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

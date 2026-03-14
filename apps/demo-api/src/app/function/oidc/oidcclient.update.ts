import { type RotateOidcClientSecretParams, type RotateOidcClientSecretResult, type UpdateOidcClientParams } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

export const updateOidcClient: DemoUpdateModelFunction<UpdateOidcClientParams> = async (request) => {
  const { nest, data } = request;

  const updateFn = await nest.oidcModelServerActions.updateOidcClient(data);
  const document = await nest.useModel('oidcEntry', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  await updateFn(document);
};
export const rotateOidcClientSecret: DemoUpdateModelFunction<RotateOidcClientSecretParams, RotateOidcClientSecretResult> = async (request) => {
  const { nest, data } = request;

  const rotateFn = await nest.oidcModelServerActions.rotateOidcClientSecret(data);
  const document = await nest.useModel('oidcEntry', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  return rotateFn(document);
};

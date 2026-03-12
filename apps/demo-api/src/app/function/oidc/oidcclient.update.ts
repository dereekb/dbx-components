import { type UpdateOidcClientParams } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

export const updateOidcClient: DemoUpdateModelFunction<UpdateOidcClientParams> = async (request) => {
  const { nest, auth, data } = request;

  const updateFn = await nest.oidcModelServerActions.updateOidcClient(data);
  await nest.useModel('oidcAdapterEntry', {
    request,
    key: data.key,
    roles: 'update'
  });

  await updateFn(auth.uid);
};

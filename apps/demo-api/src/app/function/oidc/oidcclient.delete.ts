import { type DeleteOidcClientParams } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';

export const deleteOidcClient: DemoDeleteModelFunction<DeleteOidcClientParams> = async (request) => {
  const { nest, auth, data } = request;

  const deleteFn = await nest.oidcModelServerActions.deleteOidcClient(data);
  await nest.useModel('oidcAdapterEntry', {
    request,
    key: data.key,
    roles: 'delete'
  });

  await deleteFn(auth.uid);
};

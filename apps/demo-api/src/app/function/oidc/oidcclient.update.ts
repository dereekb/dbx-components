import { type UpdateOidcClientParams } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

export const updateOidcClient: DemoUpdateModelFunction<UpdateOidcClientParams> = async (request) => {
  const { nest, data } = request;

  const updateFn = await nest.oidcModelServerActions.updateOidcClient(data);
  await nest.useModel('oidcEntry', {
    request,
    key: data.key,
    roles: 'update'
  });

  await updateFn();
};

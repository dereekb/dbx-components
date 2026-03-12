import { type DeleteOidcClientParams } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';

export const deleteOidcClient: DemoDeleteModelFunction<DeleteOidcClientParams> = async (request) => {
  const { nest, data } = request;

  const deleteFn = await nest.oidcModelServerActions.deleteOidcClient(data);
  const document = await nest.useModel('oidcEntry', {
    request,
    key: data.key,
    roles: 'delete',
    use: (x) => x.document
  });

  await deleteFn(document);
};

import { type DeleteOidcTokenParams } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';

export const oidcEntryDeleteToken: DemoDeleteModelFunction<DeleteOidcTokenParams> = async (request) => {
  const { nest, data } = request;

  const deleteFn = await nest.oidcModelServerActions.deleteOidcToken(data);
  const document = await nest.useModel('oidcEntry', {
    request,
    key: data.key,
    roles: 'delete',
    use: (x) => x.document
  });

  await deleteFn(document);
};

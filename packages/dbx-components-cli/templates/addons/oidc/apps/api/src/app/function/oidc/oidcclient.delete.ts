import { type DeleteOidcClientParams, deleteOidcClientParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXDeleteModelFunction } from '../function';

export const oidcEntryDeleteClient: APP_CODE_PREFIXDeleteModelFunction<DeleteOidcClientParams> = withApiDetails({
  inputType: deleteOidcClientParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const deleteFn = await nest.oidcModelServerActions.deleteOidcClient(data);
    const document = await nest.useModel('oidcEntry', {
      request,
      key: data.key,
      roles: 'delete',
      use: (x) => x.document
    });

    await deleteFn(document);
  }
});

import { type DeleteOidcTokenParams, deleteOidcTokenParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXDeleteModelFunction } from '../function';

export const oidcEntryDeleteToken: APP_CODE_PREFIXDeleteModelFunction<DeleteOidcTokenParams> = withApiDetails({
  inputType: deleteOidcTokenParamsType,
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

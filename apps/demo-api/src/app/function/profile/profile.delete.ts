import { type UpdateProfileParams, profileIdentity, updateProfileParamsType } from 'demo-firebase';
import { firestoreModelKey } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const profileDelete: DemoDeleteModelFunction<UpdateProfileParams> = withApiDetails({
  inputType: updateProfileParamsType,
  fn: async (request) => {
    const { nest, auth } = request;
    const profileDocument = await nest.useModel('profile', {
      request,
      key: firestoreModelKey(profileIdentity, auth.uid),
      roles: 'owner',
      use: (x) => x.document
    });

    await profileDocument.accessor.delete();
  }
});

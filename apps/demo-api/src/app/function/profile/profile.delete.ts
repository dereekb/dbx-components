import { type UpdateProfileParams, profileIdentity } from 'demo-firebase';
import { firestoreModelKey } from '@dereekb/firebase';
import { type DemoDeleteModelFunction } from '../function.context';

export const profileDelete: DemoDeleteModelFunction<UpdateProfileParams> = async (request) => {
  const { nest, auth } = request;
  const profileDocument = await nest.useModel('profile', {
    request,
    key: firestoreModelKey(profileIdentity, auth.uid),
    roles: 'owner',
    use: (x) => x.document
  });

  await profileDocument.accessor.delete();
};

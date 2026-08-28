import { type CreateFormSpaceParams, createFormSpaceParamsType, type FirebaseAuthUserId, firestoreModelKey, onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { profileIdentity } from 'demo-firebase';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates a FormSpace for the calling user.
 *
 * The owner is WHO IS CALLING, never a value in the request body: the ownership key drives read access in
 * `firestore.rules`, so accepting one from the client would let a caller mint a space owned by someone else.
 */
export const formSpaceCreate: DemoCreateModelFunction<CreateFormSpaceParams> = withApiDetails({
  inputType: createFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    const createFormSpace = await nest.formSpaceServerActions.createFormSpace(data);
    const formSpaceDocument = await createFormSpace({ uid, ownerKey: firestoreModelKey(profileIdentity, uid) });

    return onCallCreateModelResultWithDocs(formSpaceDocument);
  }
});

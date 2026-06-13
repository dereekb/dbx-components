import { type ProfileDocument } from 'FIREBASE_COMPONENTS_NAME';
import { type FirebaseAuthUserId, type InferredTargetModelParams, type TargetModelParams } from '@dereekb/firebase';
import { type NestContextCallableRequestWithAuth } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXApiNestContext } from '../function';

export function profileForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.APP_CODE_PREFIX_CAMELFirestoreCollections.profileCollection;
  return profileFirestoreCollection.documentAccessor().loadDocumentForId(uid);
}

export async function profileForUserRequest(request: NestContextCallableRequestWithAuth<APP_CODE_PREFIXApiNestContext, TargetModelParams | InferredTargetModelParams>): Promise<ProfileDocument> {
  const { nest, data: params, auth } = request;
  let profileDocument: ProfileDocument;

  if (params.key == null) {
    profileDocument = profileForUser(nest, auth.uid);
  } else {
    profileDocument = await nest.useModel('profile', {
      request,
      key: params.key,
      roles: 'owner',
      use: (x) => x.document
    });
  }

  return profileDocument;
}

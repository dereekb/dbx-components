import { ProfileDocument } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseAuthUserId, InferredTargetModelParams, TargetModelParams } from '@dereekb/firebase';
import { NestContextCallableRequestWithAuth } from '@dereekb/firebase-server';
import { APP_CODE_PREFIXApiNestContext } from '../function';

export function profileForUser(nest: APP_CODE_PREFIXApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.APP_CODE_PREFIX_CAMELFirestoreCollections.profileCollection;
  const profileDocument = profileFirestoreCollection.documentAccessor().loadDocumentForId(uid);
  return profileDocument;
}

export async function profileForUserRequest(request: NestContextCallableRequestWithAuth<APP_CODE_PREFIXApiNestContext, TargetModelParams | InferredTargetModelParams>): Promise<ProfileDocument> {
  const { nest, data: params, auth } = request;
  let profileDocument: ProfileDocument;

  if (params.key != null) {
    profileDocument = await nest.useModel('profile', {
      request,
      key: params.key,
      roles: 'owner',
      use: (x) => x.document
    });
  } else {
    profileDocument = profileForUser(nest, auth.uid);
  }

  return profileDocument;
}

import { type ProfileDocument } from 'demo-firebase';
import { type FirebaseAuthUserId, type InferredTargetModelParams, type TargetModelParams } from '@dereekb/firebase';
import { type NestContextCallableRequestWithAuth } from '@dereekb/firebase-server';
import { type DemoApiNestContext } from '../function.context';

export function profileForUser(nest: DemoApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.demoFirestoreCollections.profileCollection;
  return profileFirestoreCollection.documentAccessor().loadDocumentForId(uid);
}

export async function profileForUserRequest(request: NestContextCallableRequestWithAuth<DemoApiNestContext, TargetModelParams | InferredTargetModelParams>): Promise<ProfileDocument> {
  const { nest, data: params, auth } = request;
  let profileDocument: ProfileDocument;

  if (params.key != null) {
    profileDocument = await nest.useModel('profile', {
      request,
      key: params.key,
      roles: 'owner',
      use: (x) => x.document
    });

    // Alternative way using model() chain
    /*
    profileDocument = await nest.model(context)('profile')(updateProfile.params.key)('read')((x) => {
      return x.document;
    });
    */
  } else {
    profileDocument = profileForUser(nest, auth.uid);
  }

  return profileDocument;
}

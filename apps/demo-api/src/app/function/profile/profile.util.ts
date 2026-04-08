import { type ProfileDocument } from 'demo-firebase';
import { type FirebaseAuthUserId, type InferredTargetModelParams, type TargetModelParams } from '@dereekb/firebase';
import { type NestContextCallableRequestWithAuth } from '@dereekb/firebase-server';
import { type DemoApiNestContext } from '../function.context';

/**
 * Loads the ProfileDocument for a user by their UID.
 * Profile document IDs match the user's Firebase Auth UID.
 *
 * @param nest - the NestJS context providing Firestore collection accessors
 * @param uid - the Firebase Auth UID identifying both the user and their profile document
 * @returns the ProfileDocument for the given user
 */
export function profileForUser(nest: DemoApiNestContext, uid: FirebaseAuthUserId): ProfileDocument {
  const profileFirestoreCollection = nest.demoFirestoreCollections.profileCollection;
  return profileFirestoreCollection.documentAccessor().loadDocumentForId(uid);
}

/**
 * Resolves the ProfileDocument for an authenticated callable request.
 * If the request includes an explicit model key, loads that profile with owner role verification.
 * Otherwise falls back to the caller's own profile based on their auth UID.
 *
 * @param request - the authenticated callable request containing nest context, params, and auth info
 * @returns the resolved ProfileDocument for the target or calling user
 */
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

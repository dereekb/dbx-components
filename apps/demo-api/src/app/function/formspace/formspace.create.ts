import { type CreateFormSpaceParams, createFormSpaceParamsType, type FirebaseAuthUserId, firestoreModelKey, firestoreModelKeyCollectionName, onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { assertSnapshotData, badRequestError, withApiDetails } from '@dereekb/firebase-server';
import { type CreateFormSpaceActionInput } from '@dereekb/firebase-server/model';
import { DEMO_GUESTBOOK_FORM_SPACE_TYPE, demoGuestbookFormSpaceId, guestbookIdentity, isGuestbookSignedByUser, profileIdentity } from 'demo-firebase';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates a FormSpace for the calling user.
 *
 * The ownership key is WHO IS CALLING, or WHAT THEY OPENED THE SPACE AGAINST — never a value in the
 * request body. It drives read access in `firestore.rules` and in the model service's ownership-key grant,
 * so accepting one from the client would let a caller mint a space owned by someone else.
 *
 * Two shapes resolve here. The default is single-user: an arbitrary id, owned by the caller's own profile.
 * {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE} is the SHARED one, and every field of it is derived from the
 * guestbook rather than the caller.
 */
export const formSpaceCreate: DemoCreateModelFunction<CreateFormSpaceParams> = withApiDetails({
  inputType: createFormSpaceParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const uid = request.auth.uid as FirebaseAuthUserId;

    let createInput: CreateFormSpaceActionInput;

    if (data.formSpaceType === DEMO_GUESTBOOK_FORM_SPACE_TYPE) {
      const targetModelKey = data.targetModelKey;

      if (targetModelKey == null || firestoreModelKeyCollectionName(targetModelKey) !== guestbookIdentity.collectionName) {
        throw badRequestError({ message: `A ${DEMO_GUESTBOOK_FORM_SPACE_TYPE} FormSpace must target a Guestbook.` });
      }

      // reading the guestbook is the FIRST gate — an unpublished guestbook the caller did not create is
      // not theirs to open an album on, and useModel raises the canonical FORBIDDEN for it
      const guestbookDocument = await nest.useModel('guestbook', { request, key: targetModelKey, roles: 'read', use: (x) => x.document });
      const guestbook = await assertSnapshotData(guestbookDocument);

      // ...and having signed it is the second. The same predicate gates uploading, so nobody opens an
      // album they would then be refused every upload into.
      const signed = await isGuestbookSignedByUser({ collections: nest.demoFirestoreCollections, guestbookId: guestbookDocument.id, uid });

      if (!signed) {
        throw badRequestError({ message: `Sign this guestbook before starting its album.` });
      }

      createInput = {
        // NOT the caller. `rolesForFormSpaceUser` hands `u` submit and delete, and the first signer through
        // the door must not inherit those over everyone else's files. The fallback covers a guestbook
        // seeded without a creator, where the album is effectively admin-owned.
        uid: guestbook.cby ?? uid,
        ownerKey: targetModelKey,
        // ONE space per guestbook: the id IS the identity, so a second caller resolves to the same document
        // instead of racing a second "shared" album into existence.
        formSpaceId: demoGuestbookFormSpaceId(targetModelKey),
        getOrCreate: true
      };
    } else {
      createInput = { uid, ownerKey: firestoreModelKey(profileIdentity, uid) };
    }

    const createFormSpace = await nest.formSpaceServerActions.createFormSpace(data);
    const formSpaceDocument = await createFormSpace(createInput);

    return onCallCreateModelResultWithDocs(formSpaceDocument);
  }
});

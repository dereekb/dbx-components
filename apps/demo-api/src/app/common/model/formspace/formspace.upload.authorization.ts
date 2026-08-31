import { type FormSpaceUploadAuthorizationDelegate } from '@dereekb/firebase-server/model';
import { DEMO_GUESTBOOK_FORM_SPACE_TYPE, type GuestbookFirestoreCollections, isGuestbookOwnershipKeySignedByUser } from 'demo-firebase';

/**
 * The demo app's answer to "may this uploader put a file in a space they do not own?".
 *
 * Exactly one type says yes: {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE}, whose `o` names a Guestbook. Every
 * other type keeps the default single-user rule, so a delegate bug cannot widen a form nobody meant to
 * share — the type check is the first thing here, not an afterthought.
 *
 * Membership goes through the same {@link isGuestbookOwnershipKeySignedByUser} the model service's role
 * grant uses, so "who may upload" and "who may read" cannot drift apart.
 *
 * A plain function over the collections the actions context already carries rather than a NestJS provider:
 * this is app policy, and injecting it would mean importing a Guestbook provider into the storage upload
 * service for something that is not a service.
 *
 * @param collections - The app's guestbook collections.
 * @returns The delegate to hand to `formSpaceStorageFileUploadInitializers`.
 */
export function demoFormSpaceUploadAuthorizationDelegate(collections: GuestbookFirestoreCollections): FormSpaceUploadAuthorizationDelegate {
  return async ({ formSpace, uploaderId }) => {
    let allowed = false;

    if (formSpace.t === DEMO_GUESTBOOK_FORM_SPACE_TYPE) {
      allowed = await isGuestbookOwnershipKeySignedByUser({ collections, ownershipKey: formSpace.o, uid: uploaderId });
    }

    return allowed;
  };
}

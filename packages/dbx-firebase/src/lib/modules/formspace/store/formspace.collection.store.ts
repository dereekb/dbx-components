import { Injectable, inject } from '@angular/core';
import { AbstractDbxFirebaseCollectionStore, firebaseCollectionStoreCreateFunction } from '../../../model/modules/store';
import { type FormSpace, type FormSpaceDocument, FormSpaceFirestoreCollections, FormSpaceFunctions } from '@dereekb/firebase';

/**
 * Collection store for {@link FormSpace} documents.
 *
 * The screen this exists for is "my outstanding forms", which is also the reason `firestore.rules` grants
 * `list` on `/fsp` at all — scoped by the same ownership predicate, so an unscoped list still fails. Pair
 * it with `formSpacesForOwnerQuery(ownerKey)`.
 */
@Injectable()
export class FormSpaceCollectionStore extends AbstractDbxFirebaseCollectionStore<FormSpace, FormSpaceDocument> {
  readonly formSpaceFunctions = inject(FormSpaceFunctions);

  constructor() {
    super({ firestoreCollection: inject(FormSpaceFirestoreCollections).formSpaceCollection });
  }

  readonly createFormSpace = firebaseCollectionStoreCreateFunction(this, this.formSpaceFunctions.formSpace.createFormSpace.create);
}

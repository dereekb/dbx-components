import { type FirestoreContext } from '@dereekb/firebase';
import { Service, inject } from '@angular/core';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';

/**
 * Service that provides access to the app's FirestoreContext.
 */
@Service()
export class DbxFirestoreContextService {
  readonly firestoreContext = inject<FirestoreContext>(DBX_FIRESTORE_CONTEXT_TOKEN);
}

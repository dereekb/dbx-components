import { FirestoreContext } from '@dereekb/firebase';
import { Injectable, inject } from '@angular/core';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';

/**
 * Service that provides access to the app's FirestoreContext.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirestoreContextService {
  readonly firestoreContext = inject<FirestoreContext>(DBX_FIRESTORE_CONTEXT_TOKEN);
}

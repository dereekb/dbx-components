import { Inject, Injectable } from '@angular/core';
import { FirestoreContext } from '@dereekb/firebase';
import { DBX_FIRESTORE_CONTEXT_TOKEN } from './firebase.firestore';

/**
 * Service that provides access to the app's FirestoreContext.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxFirestoreContextService {
  constructor(@Inject(DBX_FIRESTORE_CONTEXT_TOKEN) readonly firestoreContext: FirestoreContext) {}
}

import { inject, Injectable, InjectionToken } from '@angular/core';
import { StorageAccessor } from '@dereekb/dbx-core';
import { OAuthInteractionLoginDetails } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { catchError, Observable, of } from 'rxjs';

/**
 * Injection token for a {@link StorageAccessor} used by {@link DbxFirebaseOauthClientStorageService} to persist oauth client details.
 */
export const DBX_FIREBASE_OAUTH_CLIENT_STORAGE_ACCESSOR_TOKEN = new InjectionToken('DbxFirebaseOauthClientStorageAccessor');

const DBX_FIREBASE_OAUTH_CLIENT_STORAGE_ACCESSOR_STORAGE_KEY = 'c';

/**
 * Manages persistence of {@link OAuthInteractionLoginDetails} items in local storage.
 */
@Injectable()
export class DbxFirebaseOauthClientStorageService {
  readonly storageAccessor = inject<StorageAccessor<OAuthInteractionLoginDetails>>(DBX_FIREBASE_OAUTH_CLIENT_STORAGE_ACCESSOR_TOKEN);

  constructor() {}

  getLoginInteractionDetails(): Observable<Maybe<OAuthInteractionLoginDetails>> {
    return this.storageAccessor.get(DBX_FIREBASE_OAUTH_CLIENT_STORAGE_ACCESSOR_STORAGE_KEY).pipe(catchError(() => of(null)));
  }

  setLoginInteractionDetails(clientDetails: OAuthInteractionLoginDetails): Observable<void> {
    return this.storageAccessor.set(DBX_FIREBASE_OAUTH_CLIENT_STORAGE_ACCESSOR_STORAGE_KEY, clientDetails);
  }
}

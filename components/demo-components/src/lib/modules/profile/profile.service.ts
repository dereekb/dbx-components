import { ProfileDocument, DemoFirestoreCollections, profileWithUsername } from '@dereekb/demo-firebase';
import { map, Observable, of, switchMap } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Injectable({
  providedIn: 'root'
})
export class DemoProfileService {
  readonly collections = inject(DemoFirestoreCollections);

  constructor() {
    // TODO: Also pull in the current auth and return true for isUsernameAvailable if the current user owns that username.
  }
  isUsernameAvailable(username: string): Observable<boolean> {
    return this.profileWithUsername(username).pipe(map((x) => !x));
  }

  profileWithUsername(username: string): Observable<Maybe<ProfileDocument>> {
    return of(username).pipe(switchMap((x) => this.collections.profileCollection.queryDocument(profileWithUsername(x)).getFirstDoc()));
  }
}

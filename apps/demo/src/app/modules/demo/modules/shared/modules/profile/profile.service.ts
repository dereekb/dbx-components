import { ProfileDocument, DemoFirestoreCollections, profileWithUsername } from '@dereekb/demo-firebase';
import { map, Observable, of, switchMap } from 'rxjs';
import { Injectable } from "@angular/core";
import { Maybe } from '@dereekb/util';

@Injectable({
  providedIn: 'root'
})
export class DemoProfileService {

  constructor(readonly collections: DemoFirestoreCollections) { }

  isUsernameAvailable(username: string): Observable<boolean> {
    return this.profileWithUsername(username).pipe(map(x => !Boolean(x)));
  }

  profileWithUsername(username: string): Observable<Maybe<ProfileDocument>> {
    return of(username).pipe(
      switchMap(x => this.collections.profileFirestoreCollection.queryDocument(profileWithUsername(x)).getFirstDoc()),
    );
  }

}

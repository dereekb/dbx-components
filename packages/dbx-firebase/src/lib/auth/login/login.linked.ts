import { Injectable, InjectionToken, inject } from '@angular/core';
import { combineLatest, map, type Observable, shareReplay } from 'rxjs';
import { filterMaybeArrayValues, type Maybe } from '@dereekb/util';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { type FirebaseLoginMethodType } from './login';
import { firebaseProviderIdToLoginMethodType } from './login.provider.id';

/**
 * A source of login method types that are linked to the signed-in user but are NOT Firebase-native
 * providers.
 *
 * The seam exists because `currentLinkedProviderIds$` reads `user.providerData`, which can only ever
 * describe providers Firebase Auth itself issued. A user signed in with a custom token — the whole
 * point of the external-connection sign-in direction — has an EMPTY `providerData`, so a link/unlink
 * list built from it alone can never show the provider they actually signed in with.
 *
 * Declared here, in `auth/login`, and contributed to from elsewhere: the externalconnection module
 * already depends on this one, and a dependency the other way would be a cycle.
 */
export abstract class DbxFirebaseLinkedLoginMethodsSource {
  abstract readonly linkedLoginMethodTypes$: Observable<FirebaseLoginMethodType[]>;
}

/**
 * Multi-provider token every {@link DbxFirebaseLinkedLoginMethodsSource} registers under.
 */
export const DBX_FIREBASE_LINKED_LOGIN_METHODS_SOURCES_TOKEN = new InjectionToken<DbxFirebaseLinkedLoginMethodsSource[]>('DbxFirebaseLinkedLoginMethodsSources');

/**
 * Merges the union of every login method type currently linked to the signed-in user.
 *
 * Pure and exported so it is unit-testable without a TestBed.
 *
 * @param lists - The per-source lists to merge, most-authoritative first.
 * @returns The deduped union, in the order the sources reported them.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mergeDbxFirebaseLinkedLoginMethodTypes(lists: Maybe<FirebaseLoginMethodType[]>[]): FirebaseLoginMethodType[] {
  const seen = new Set<FirebaseLoginMethodType>();
  const result: FirebaseLoginMethodType[] = [];

  lists.forEach((list) => {
    (list ?? []).forEach((type) => {
      if (!seen.has(type)) {
        seen.add(type);
        result.push(type);
      }
    });
  });

  return result;
}

/**
 * The login method types linked to the signed-in user: the Firebase-native ones, plus every
 * registered {@link DbxFirebaseLinkedLoginMethodsSource}.
 *
 * Both the login list and the manage-providers component read from here rather than from
 * `currentLinkedProviderIds$` directly, so a provider that is a login method without being a Firebase
 * provider appears in the unlink list and is excluded from the link list — which is what makes the two
 * lists describe the same set of facts.
 */
@Injectable({ providedIn: 'root' })
export class DbxFirebaseLinkedLoginMethodsService {
  private readonly _dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  private readonly _sources = inject(DBX_FIREBASE_LINKED_LOGIN_METHODS_SOURCES_TOKEN, { optional: true });

  /**
   * The Firebase-native half: the provider ids on the current user's `providerData`.
   */
  readonly nativeLoginMethodTypes$: Observable<FirebaseLoginMethodType[]> = this._dbxFirebaseAuthService.currentLinkedProviderIds$.pipe(
    map((ids) => filterMaybeArrayValues(ids.map(firebaseProviderIdToLoginMethodType))),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly linkedLoginMethodTypes$: Observable<FirebaseLoginMethodType[]> = combineLatest([this.nativeLoginMethodTypes$, ...(this._sources ?? []).map((x) => x.linkedLoginMethodTypes$)]).pipe(
    map(mergeDbxFirebaseLinkedLoginMethodTypes),
    // refCount so a source backed by a Firestore listener holds no subscription while nothing is
    // rendering a link/unlink list
    shareReplay({ bufferSize: 1, refCount: true })
  );
}

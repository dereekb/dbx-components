import { map, type Observable } from 'rxjs';
import { inContextFirebaseModelsServiceFactory } from '@dereekb/firebase';
import { DbxFirebaseAuthService, type DbxFirebaseInContextFirebaseModelServiceInstance, dbxFirebaseInContextFirebaseModelServiceInstanceFactory, type DbxFirebaseModelContextService, dbxFirebaseModelContextServiceInfoInstanceFactory, firebaseContextServiceEntityMap } from '@dereekb/dbx-firebase';
import { inject, Injectable } from '@angular/core';
import { type ModelKey } from '@dereekb/util';
import { type ObservableOrValue } from '@dereekb/rxjs';
import { type DemoFirebaseBaseContext, demoFirebaseModelServices, DemoFirestoreCollections, type GuestbookDocument, type GuestbookRoles } from 'demo-firebase';

/**
 * Used to access the demoFirebaseModelServices() on the client side.
 */
@Injectable()
export class DemoFirebaseContextService implements DbxFirebaseModelContextService {
  readonly demoFirestoreCollections = inject(DemoFirestoreCollections);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly baseContext$: Observable<DemoFirebaseBaseContext> = this.dbxFirebaseAuthService.currentAuthContextInfo$.pipe(
    map((auth) => {
      const result: DemoFirebaseBaseContext = {
        auth,
        app: this.demoFirestoreCollections
      };

      return result;
    })
  );

  readonly context$ = this.baseContext$.pipe(map((x) => inContextFirebaseModelsServiceFactory(demoFirebaseModelServices)(x)));

  readonly modelService = dbxFirebaseInContextFirebaseModelServiceInstanceFactory(this.context$);
  readonly entityMap$ = this.context$.pipe(firebaseContextServiceEntityMap());

  readonly modelInfoInstance = dbxFirebaseModelContextServiceInfoInstanceFactory({ modelService: this.modelService, entityMap$: this.entityMap$ });

  guestbook(key$: ObservableOrValue<ModelKey>) {
    return this.modelService('guestbook', key$) as DbxFirebaseInContextFirebaseModelServiceInstance<GuestbookDocument, GuestbookRoles>;
  }
}

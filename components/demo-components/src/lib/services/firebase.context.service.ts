import { map, Observable } from 'rxjs';
import { inContextFirebaseModelsServiceFactory } from '@dereekb/firebase';
import { DbxFirebaseAuthService, DbxFirebaseInContextFirebaseModelServiceInstance, dbxFirebaseInContextFirebaseModelServiceInstanceFactory, DbxFirebaseModelContextService, dbxFirebaseModelContextServiceInfoInstanceFactory, firebaseContextServiceEntityMap } from '@dereekb/dbx-firebase';
import { inject, Injectable } from '@angular/core';
import { ModelKey } from '@dereekb/util';
import { ObservableOrValue } from '@dereekb/rxjs';
import { DemoFirebaseBaseContext, demoFirebaseModelServices, DemoFirestoreCollections, GuestbookDocument, GuestbookRoles } from '@dereekb/demo-firebase';

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

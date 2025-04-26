import { map, Observable } from 'rxjs';
import { inContextFirebaseModelsServiceFactory } from '@dereekb/firebase';
import { DbxFirebaseAuthService, DbxFirebaseInContextFirebaseModelServiceInstance, dbxFirebaseInContextFirebaseModelServiceInstanceFactory, DbxFirebaseModelContextService, dbxFirebaseModelContextServiceInfoInstanceFactory, firebaseContextServiceEntityMap } from '@dereekb/dbx-firebase';
import { inject, Injectable } from '@angular/core';
import { ModelKey } from '@dereekb/util';
import { ObservableOrValue } from '@dereekb/rxjs';
import { APP_CODE_PREFIXFirebaseBaseContext, APP_CODE_PREFIXFirebaseModelServices, APP_CODE_PREFIXFirestoreCollections, ProfileDocument, ProfileRoles } from 'FIREBASE_COMPONENTS_NAME';

/**
 * Used to access the APP_CODE_PREFIXFirebaseModelServices() on the client side.
 */
@Injectable()
export class APP_CODE_PREFIXFirebaseContextService implements DbxFirebaseModelContextService {

  readonly APP_CODE_PREFIX_CAMELFirestoreCollections = inject(APP_CODE_PREFIXFirestoreCollections);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly baseContext$: Observable<APP_CODE_PREFIXFirebaseBaseContext> = this.dbxFirebaseAuthService.currentAuthContextInfo$.pipe(
    map((auth) => {
      const result: APP_CODE_PREFIXFirebaseBaseContext = {
        auth,
        app: this.APP_CODE_PREFIX_CAMELFirestoreCollections
      };

      return result;
    })
  );

  readonly context$ = this.baseContext$.pipe(map((x) => inContextFirebaseModelsServiceFactory(APP_CODE_PREFIXFirebaseModelServices)(x)));

  readonly modelService = dbxFirebaseInContextFirebaseModelServiceInstanceFactory(this.context$);
  readonly entityMap$ = this.context$.pipe(firebaseContextServiceEntityMap());

  readonly modelInfoInstance = dbxFirebaseModelContextServiceInfoInstanceFactory({ modelService: this.modelService, entityMap$: this.entityMap$ });

  profile(key$: ObservableOrValue<ModelKey>) {
    return this.modelService('profile', key$) as DbxFirebaseInContextFirebaseModelServiceInstance<ProfileDocument, ProfileRoles>;
  }

}

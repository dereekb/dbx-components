import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, DbxFirebaseDefaultProvidersModule, DbxFirebaseAuthModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from '../environments/environment';
import { DemoFirestoreCollections, makeDemoFirestoreCollections } from '@dereekb/demo-firebase';

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseEmulatorModule.forRoot(environment.firebase.emulators),
    DbxFirebaseDefaultProvidersModule.forRoot(environment.firebase),
    DbxFirebaseFirestoreCollectionModule.forRoot({
      appCollectionClass: DemoFirestoreCollections,
      collectionFactory: (firestoreContext: FirestoreContext) => makeDemoFirestoreCollections(firestoreContext)
    }),
    DbxFirebaseAuthModule.forRoot({
      delegateFactory: undefined  // todo
    })
  ],
  providers: []
})
export class RootFirebaseModule { }

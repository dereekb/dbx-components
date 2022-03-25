import { DbxFirebaseEmulatorModule, DbxFirebaseDefaultProvidersModule, DbxFirebaseAuthModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseEmulatorModule.forRoot(environment.firebase.emulators),
    DbxFirebaseDefaultProvidersModule.forRoot(environment.firebase),
    DbxFirebaseAuthModule.forRoot({
      delegateFactory: undefined  // todo
    })
  ],
  providers: []
})
export class RootFirebaseModule { }

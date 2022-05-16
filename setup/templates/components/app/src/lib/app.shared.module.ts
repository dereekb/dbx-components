import { NgModule } from '@angular/core';
import { DbxFirebaseModule } from '@dereekb/dbx-firebase';
import { APP_CODE_PREFIXRootSharedModule } from './root.shared.module';

@NgModule({
  exports: [
    APP_CODE_PREFIXRootSharedModule,
    DbxFirebaseModule
  ]
})
export class APP_CODE_PREFIXAppSharedModule { }

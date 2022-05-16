import { NgModule } from '@angular/core';
import { DemoSharedModule } from '@/shared/shared.module';
import { DemoSharedProfileModule } from './modules/profile/profile.module';
import { DemoSharedGuestbookModule } from './modules/guestbook/guestbook.module';
import { DbxFirebaseModule } from '@dereekb/dbx-firebase';

@NgModule({
  exports: [
    DemoSharedModule,
    DbxFirebaseModule,
    DemoSharedGuestbookModule,
    DemoSharedProfileModule
  ]
})
export class DemoAppSharedModule { }

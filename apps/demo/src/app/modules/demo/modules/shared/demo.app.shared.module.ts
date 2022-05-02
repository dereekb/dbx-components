import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoSharedProfileModule } from './modules/profile/profile.module';
import { DemoSharedGuestbookModule } from './modules/guestbook/guestbook.module';
import { DbxFirebaseModule } from '@dereekb/dbx-firebase';

@NgModule({
  exports: [
    AppSharedModule,
    DbxFirebaseModule,
    DemoSharedGuestbookModule,
    DemoSharedProfileModule
  ]
})
export class DemoAppSharedModule { }

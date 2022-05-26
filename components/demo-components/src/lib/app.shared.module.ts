import { NgModule } from '@angular/core';
import { DemoSharedProfileModule } from './modules/profile/profile.module';
import { DemoSharedGuestbookModule } from './modules/guestbook/guestbook.module';
import { DbxFirebaseModule } from '@dereekb/dbx-firebase';
import { DemoRootSharedModule } from './root.shared.module';

@NgModule({
  exports: [DemoRootSharedModule, DbxFirebaseModule, DemoSharedGuestbookModule, DemoSharedProfileModule]
})
export class DemoAppSharedModule {}

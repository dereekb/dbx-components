import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoSharedProfileModule } from './profile/profile.module';
import { DemoSharedGuestbookModule } from './guestbook/guestbook.module';

@NgModule({
  exports: [
    AppSharedModule,
    DemoSharedGuestbookModule,
    DemoSharedProfileModule
  ]
})
export class DemoAppSharedModule { }

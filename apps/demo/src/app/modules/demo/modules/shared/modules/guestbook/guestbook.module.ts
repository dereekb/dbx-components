import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoGuestbookListComponent, DemoGuestbookListViewComponent, DemoGuestbookListViewItemComponent } from './component/guestbook.list.component';
import { DemoGuestbookEntryListComponent, DemoGuestbookEntryListViewComponent, DemoGuestbookEntryListViewItemComponent } from './component/guestbook.entry.list.component';
import { DemoGuestbookLoaderDirective } from './component/guestbook.loader.directive';

@NgModule({
  imports: [
    AppSharedModule
  ],
  declarations: [
    DemoGuestbookLoaderDirective,
    DemoGuestbookListComponent,
    DemoGuestbookListViewComponent,
    DemoGuestbookListViewItemComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryListViewComponent,
    DemoGuestbookEntryListViewItemComponent
  ],
  exports: [
    DemoGuestbookLoaderDirective,
    DemoGuestbookListComponent,
    DemoGuestbookEntryListComponent
  ]
})
export class DemoSharedGuestbookModule { }

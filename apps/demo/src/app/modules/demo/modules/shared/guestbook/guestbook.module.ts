import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoGuestbookListComponent, DemoGuestbookListViewComponent, DemoGuestbookListViewItemComponent } from './component/guestbook.list.component';
import { DemoGuestbookEntryListComponent, DemoGuestbookEntryListViewComponent, DemoGuestbookEntryListViewItemComponent } from './component/guestbook.entry.list.component';

@NgModule({
  imports: [
    AppSharedModule
  ],
  declarations: [
    DemoGuestbookListComponent,
    DemoGuestbookListViewComponent,
    DemoGuestbookListViewItemComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryListViewComponent,
    DemoGuestbookEntryListViewItemComponent
  ],
  exports: [
    DemoGuestbookListComponent,
    DemoGuestbookEntryListComponent
  ]
})
export class DemoSharedGuestbookModule { }

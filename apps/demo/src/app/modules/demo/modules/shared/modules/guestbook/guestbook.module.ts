import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoGuestbookListComponent, DemoGuestbookListViewComponent, DemoGuestbookListViewItemComponent } from './component/guestbook.list.component';
import { DemoGuestbookEntryListComponent, DemoGuestbookEntryListViewComponent, DemoGuestbookEntryListViewItemComponent } from './component/guestbook.entry.list.component';
import { DemoGuestbookCollectionStoreDirective } from './store/guestbook.collection.store.directive';

@NgModule({
  imports: [
    AppSharedModule
  ],
  declarations: [
    DemoGuestbookCollectionStoreDirective,
    DemoGuestbookListComponent,
    DemoGuestbookListViewComponent,
    DemoGuestbookListViewItemComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryListViewComponent,
    DemoGuestbookEntryListViewItemComponent
  ],
  exports: [
    DemoGuestbookCollectionStoreDirective,
    DemoGuestbookListComponent,
    DemoGuestbookEntryListComponent
  ]
})
export class DemoSharedGuestbookModule { }

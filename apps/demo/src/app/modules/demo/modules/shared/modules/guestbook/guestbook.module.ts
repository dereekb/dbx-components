import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoGuestbookListComponent, DemoGuestbookListViewComponent, DemoGuestbookListViewItemComponent } from './component/guestbook.list.component';
import { DemoGuestbookEntryListComponent, DemoGuestbookEntryListViewComponent, DemoGuestbookEntryListViewItemComponent } from './component/guestbook.entry.list.component';
import { DemoGuestbookCollectionStoreDirective } from './store/guestbook.collection.store.directive';
import { DemoGuestbookDocumentStoreDirective } from './store/guestbook.document.store.directive';

@NgModule({
  imports: [
    AppSharedModule
  ],
  declarations: [
    DemoGuestbookCollectionStoreDirective,
    DemoGuestbookDocumentStoreDirective,
    DemoGuestbookListComponent,
    DemoGuestbookListViewComponent,
    DemoGuestbookListViewItemComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryListViewComponent,
    DemoGuestbookEntryListViewItemComponent
  ],
  exports: [
    DemoGuestbookCollectionStoreDirective,
    DemoGuestbookDocumentStoreDirective,
    DemoGuestbookListComponent,
    DemoGuestbookEntryListComponent
  ]
})
export class DemoSharedGuestbookModule { }

import { NgModule } from '@angular/core';
import { DemoGuestbookListComponent, DemoGuestbookListViewComponent, DemoGuestbookListViewItemComponent } from './component/guestbook.list.component';
import { DemoGuestbookEntryListComponent, DemoGuestbookEntryListViewComponent, DemoGuestbookEntryListViewItemComponent } from './component/guestbook.entry.list.component';
import { DemoGuestbookCollectionStoreDirective } from './store/guestbook.collection.store.directive';
import { DemoGuestbookDocumentStoreDirective } from './store/guestbook.document.store.directive';
import { DemoGuestbookEntryCollectionStoreDirective } from './store/guestbook.entry.collection.store.directive';
import { DemoGuestbookEntryDocumentStoreDirective } from './store/guestbook.entry.document.store.directive';
import { DemoGuestbookEntryFormComponent } from './component/guestbook.entry.form.component';

@NgModule({
  imports: [],
  declarations: [
    // component
    DemoGuestbookEntryFormComponent,
    DemoGuestbookListComponent,
    DemoGuestbookListViewComponent,
    DemoGuestbookListViewItemComponent,
    DemoGuestbookEntryListComponent,
    DemoGuestbookEntryListViewComponent,
    DemoGuestbookEntryListViewItemComponent,
    // store
    DemoGuestbookCollectionStoreDirective,
    DemoGuestbookDocumentStoreDirective,
    DemoGuestbookEntryCollectionStoreDirective,
    DemoGuestbookEntryDocumentStoreDirective
  ],
  exports: [DemoGuestbookEntryFormComponent, DemoGuestbookListComponent, DemoGuestbookEntryListComponent, DemoGuestbookCollectionStoreDirective, DemoGuestbookDocumentStoreDirective, DemoGuestbookEntryCollectionStoreDirective, DemoGuestbookEntryDocumentStoreDirective]
})
export class DemoSharedGuestbookModule {}

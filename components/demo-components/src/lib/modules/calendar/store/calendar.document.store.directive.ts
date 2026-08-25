import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '@dereekb/dbx-firebase';
import { type Calendar, type CalendarDocument } from '@dereekb/firebase';
import { CalendarDocumentStore } from './calendar.document.store';

@Directive({
  selector: '[demoCalendarDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(DemoCalendarDocumentStoreDirective, CalendarDocumentStore),
  standalone: true
})
export class DemoCalendarDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Calendar, CalendarDocument, CalendarDocumentStore> {
  constructor() {
    super(inject(CalendarDocumentStore));
  }
}

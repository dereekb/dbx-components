import { Directive, inject } from '@angular/core';
import { DbxFirebaseDocumentStoreDirective, provideDbxFirebaseDocumentStoreDirective } from '../../../model/modules/store';
import { type Calendar, type CalendarDocument } from '@dereekb/firebase';
import { CalendarDocumentStore } from './calendar.document.store';

/**
 * Directive providing a {@link CalendarDocumentStore} for accessing a single calendar document.
 */
@Directive({
  selector: '[dbxFirebaseCalendarDocument]',
  providers: provideDbxFirebaseDocumentStoreDirective(CalendarDocumentStoreDirective, CalendarDocumentStore)
})
export class CalendarDocumentStoreDirective extends DbxFirebaseDocumentStoreDirective<Calendar, CalendarDocument, CalendarDocumentStore> {
  constructor() {
    super(inject(CalendarDocumentStore));
  }
}

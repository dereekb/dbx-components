import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxAppContextStateDirective, DbxRouteModelIdFromAuthUserIdDirective } from '@dereekb/dbx-core';
import { CalendarDocumentStoreDirective, DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective } from '@dereekb/dbx-firebase';
import { DbxContentLayoutModule, DbxSectionPageComponent } from '@dereekb/dbx-web';
import { DemoProfileDocumentStoreDirective } from 'demo-components';
import { UIView } from '@uirouter/angular';

/**
 * Layout for the signed-in user's profile calendar at `/demo/app/calendar`.
 *
 * The calendar's document id IS the two-way flat key of the profile that owns it, so the profile store
 * resolves `pr/<uid>` from the auth user and the calendar store takes its id from that same key —
 * `cal/pr_<uid>` — with no lookup field and no query.
 */
@Component({
  templateUrl: './layout.component.html',
  imports: [UIView, DbxAppContextStateDirective, DbxContentLayoutModule, DemoProfileDocumentStoreDirective, DbxRouteModelIdFromAuthUserIdDirective, DbxFirebaseDocumentStoreTwoWayModelKeySourceDirective, CalendarDocumentStoreDirective, DbxFirebaseDocumentStoreIdFromTwoWayModelKeyDirective, DbxSectionPageComponent]
})
export class DemoCalendarLayoutComponent {}

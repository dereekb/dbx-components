import { Component, inject } from '@angular/core';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from '@dereekb/dbx-firebase';

@Component({
    templateUrl: './history.component.html',
    standalone: true
})
export class DemoAppHistoryComponent {
  readonly dbxFirebaseModelTrackerService = inject(DbxFirebaseModelTrackerService);

  readonly historyFilter: DbxFirebaseModelTrackerHistoryFilter = {};
}

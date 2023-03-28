import { Component } from '@angular/core';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from '@dereekb/dbx-firebase';
import { loadingStateFromObs } from '@dereekb/rxjs';

@Component({
  templateUrl: './history.component.html'
})
export class DemoAppHistoryComponent {
  readonly historyFilter: DbxFirebaseModelTrackerHistoryFilter = {};

  constructor(readonly dbxFirebaseModelTrackerService: DbxFirebaseModelTrackerService) {}
}

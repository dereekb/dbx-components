import { Component } from '@angular/core';
import { DbxFirebaseModelTrackerService } from '@dereekb/dbx-firebase';
import { loadingStateFromObs } from '@dereekb/rxjs';

@Component({
  templateUrl: './history.component.html'
})
export class DemoAppHistoryComponent {
  readonly historyPairs$ = this.dbxFirebaseModelTrackerService.loadHistoryPairs();
  readonly state$ = loadingStateFromObs(this.historyPairs$);

  constructor(readonly dbxFirebaseModelTrackerService: DbxFirebaseModelTrackerService) {}
}

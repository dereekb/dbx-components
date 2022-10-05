import { Component } from '@angular/core';
import { loadingStateFromObs, tapLog } from '@dereekb/rxjs';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { DbxFirebaseDevelopmentWidgetEntry } from './development.widget';

export const DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY = 'DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET';

export function developmentFirebaseServerSchedulerWidgetEntry(): DbxFirebaseDevelopmentWidgetEntry {
  return {
    label: 'Run Scheduled Task',
    widget: {
      type: DEVELOPMENT_FIREBASE_SERVER_SCHEDULER_WIDGET_KEY,
      componentClass: DbxFirebaseDevelopmentSchedulerWidgetComponent
    }
  };
}

@Component({
  template: `
    <div>
      <dbx-firebase-development-scheduler-list [state$]="state$"></dbx-firebase-development-scheduler-list>
    </div>
  `
})
export class DbxFirebaseDevelopmentSchedulerWidgetComponent {
  readonly entries$ = this.dbxFirebaseDevelopmentSchedulerService.schedulerList$;
  readonly state$ = loadingStateFromObs(this.entries$).pipe(tapLog('x'));

  constructor(readonly dbxFirebaseDevelopmentSchedulerService: DbxFirebaseDevelopmentSchedulerService) {}
}

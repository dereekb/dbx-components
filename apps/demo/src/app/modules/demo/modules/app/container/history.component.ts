import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxFirebaseModelHistoryComponent, DbxFirebaseModelHistoryPopoverButtonComponent, type DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from '@dereekb/dbx-firebase';
import { DbxContentLayoutModule, DbxListEmptyContentComponent, DbxSectionLayoutModule, DbxSpacerDirective } from '@dereekb/dbx-web';

@Component({
  templateUrl: './history.component.html',
  imports: [DbxContentLayoutModule, DbxSectionLayoutModule, DbxSpacerDirective, DbxFirebaseModelHistoryPopoverButtonComponent, DbxFirebaseModelHistoryComponent, DbxListEmptyContentComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppHistoryComponent {
  readonly dbxFirebaseModelTrackerService = inject(DbxFirebaseModelTrackerService);

  readonly historyFilter: DbxFirebaseModelTrackerHistoryFilter = {};
}

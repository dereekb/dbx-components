import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map, distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';

/**
 * A table header component used for injecting the input picker view.
 */
@Component({
  selector: 'dbx-table-summary-start-cell',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableSummaryStartCellComponent {
  readonly tableStore = inject(DbxTableStore);

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.summaryRowHeader),
    distinctUntilChanged()
  );
}

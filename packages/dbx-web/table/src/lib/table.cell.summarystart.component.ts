import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

/**
 * A table header component used for injecting the input picker view.
 */
@Component({
  selector: 'dbx-table-summary-start-cell',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxTableSummaryStartCellComponent {
  readonly tableStore = inject(DbxTableStore);

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.summaryRowHeader),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}

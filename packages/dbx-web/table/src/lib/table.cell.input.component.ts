import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { map, distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';

/**
 * A table header component used for injecting the input picker view.
 */
@Component({
  selector: 'dbx-table-input-cell',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableInputCellComponent {
  readonly tableStore = inject(DbxTableStore);

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.inputHeader),
    distinctUntilChanged()
  );
}

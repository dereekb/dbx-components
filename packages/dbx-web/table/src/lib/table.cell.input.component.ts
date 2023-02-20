import { ChangeDetectionStrategy, Component } from '@angular/core';
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
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.inputHeader),
    distinctUntilChanged()
  );

  constructor(readonly tableStore: DbxTableStore) {}
}

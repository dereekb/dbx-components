import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-table-action-cell',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxTableActionCellComponent {
  readonly tableStore = inject(DbxTableStore);

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.summaryRowEnd),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}

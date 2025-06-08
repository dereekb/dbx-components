import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs';
import { DbxTableStore } from './table.store';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

/**
 * A table header component used for injecting the input picker view.
 */
@Component({
  selector: 'dbx-table-full-summary-row',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxInjectionComponent],
  host: {
    class: 'dbx-h100 dbx-flex-bar'
  }
})
export class DbxTableFullSummaryRowComponent {
  readonly tableStore = inject(DbxTableStore);

  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((x) => x.fullSummaryRow),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}

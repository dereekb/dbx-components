import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { DbxTableStore } from './table.store';
import { loadingStateContext } from '@dereekb/rxjs';

/**
 * A table with fixed content
 */
@Component({
  selector: 'dbx-table',
  templateUrl: './table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableComponent<I, C, T> implements OnDestroy {
  readonly innerColumns$ = this.tableStore.columns$;
  readonly context = loadingStateContext({ obs: this.tableStore.dataState$ });

  constructor(readonly tableStore: DbxTableStore<I, C, T>) {}

  ngOnDestroy(): void {
    this.context.destroy();
  }
}

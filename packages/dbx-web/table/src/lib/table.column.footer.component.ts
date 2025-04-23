import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AbstractDbxTableColumnDirective } from './table.column.directive';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-table-column-footer',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxInjectionComponent]
})
export class DbxTableColumnFooterComponent<C> extends AbstractDbxTableColumnDirective<C> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    switchMap((viewDelegate) => {
      const columnFooter = viewDelegate.columnFooter;

      if (columnFooter) {
        return this.column$.pipe(map((x) => columnFooter(x)));
      } else {
        return of(undefined);
      }
    }),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}

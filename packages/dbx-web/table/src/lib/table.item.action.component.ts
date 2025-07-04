import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AbstractDbxTableItemDirective } from './table.item.directive';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-table-item-action',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxTableItemActionComponent<T> extends AbstractDbxTableItemDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((viewDelegate) => {
      const itemAction = viewDelegate.itemAction;
      let obs: MaybeObservableOrValue<DbxInjectionComponentConfig> = undefined;

      if (itemAction) {
        obs = this.item$.pipe(map((x) => (x != null ? itemAction(x) : undefined)));
      }

      return obs;
    }),
    maybeValueFromObservableOrValue()
  );

  readonly configSignal = toSignal(this.config$);
}

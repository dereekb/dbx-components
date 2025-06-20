import { ChangeDetectionStrategy, Component } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, distinctUntilChanged } from 'rxjs';
import { MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDbxTableGroupDirective } from './table.group.directive';

@Component({
  selector: 'dbx-table-group-header',
  template: `
    <dbx-injection [config]="configSignal()"></dbx-injection>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxTableGroupHeaderComponent<T> extends AbstractDbxTableGroupDirective<T> {
  readonly config$ = this.tableStore.viewDelegate$.pipe(
    map((viewDelegate) => {
      const groupHeader = viewDelegate.groupHeader;
      let obs: MaybeObservableOrValue<DbxInjectionComponentConfig> = undefined;

      if (groupHeader) {
        obs = this.group$.pipe(map((x) => groupHeader(x)));
      }

      return obs;
    }),
    maybeValueFromObservableOrValue(),
    distinctUntilChanged()
  );

  readonly configSignal = toSignal(this.config$);
}

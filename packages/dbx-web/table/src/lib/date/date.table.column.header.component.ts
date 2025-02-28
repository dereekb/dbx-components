import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxInjectionComponentConfig, DbxInjectionComponentConfigFactory } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxTableColumn } from '../table';

/**
 * A table header component used for rendering date values on the header.
 */
@Component({
  template: `
    <div *ngIf="date" class="dbx-table-date-column-header">
      <span class="dbx-table-date-column-header-left">{{ date | date: left }}</span>
      <span>{{ date | date: right }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxTableDateHeaderComponent {
  left = 'E';
  right = 'MMM d';

  private _date: Maybe<Date>;

  constructor() {}

  get date() {
    return this._date;
  }

  set date(date: Maybe<Date>) {
    this._date = date;
  }
}

export function dbxTableDateHeaderInjectionFactory(): DbxInjectionComponentConfigFactory<DbxTableColumn<Date>, DbxTableDateHeaderComponent> {
  return (column: DbxTableColumn<Date>) => {
    const config: DbxInjectionComponentConfig<DbxTableDateHeaderComponent> = {
      componentClass: DbxTableDateHeaderComponent,
      init: (x) => {
        x.date = column.meta;
      }
    };

    return config;
  };
}

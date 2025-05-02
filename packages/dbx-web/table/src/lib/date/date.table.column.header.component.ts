import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DbxInjectionComponentConfig, DbxInjectionComponentConfigFactory } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxTableColumn } from '../table';
import { DatePipe } from '@angular/common';

/**
 * A table header component used for rendering date values on the header.
 */
@Component({
  template: `
    @if (dateSignal()) {
      <div class="dbx-table-date-column-header">
        <span class="dbx-table-date-column-header-left">{{ dateSignal() | date: left }}</span>
        <span>{{ dateSignal() | date: right }}</span>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  standalone: true
})
export class DbxTableDateHeaderComponent {
  readonly left = 'E';
  readonly right = 'MMM d';

  private readonly _dateSignal = signal<Maybe<Date>>(undefined);
  readonly dateSignal = this._dateSignal.asReadonly();

  get date() {
    return this._dateSignal();
  }

  set date(date: Maybe<Date>) {
    this._dateSignal.set(date);
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

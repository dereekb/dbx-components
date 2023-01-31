import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { DbxTableColumn } from '@dereekb/dbx-web/table';
import { ExampleTableData } from './table.item';

@Component({
  template: `
    <div style="text-align: center">
      <div class="dbx-small">{{ name }}</div>
      <div class="dbx-small dbx-hint">{{ columnName }}</div>
    </div>
  `
})
export class DocExtensionTableItemCellExampleComponent {
  item!: ExampleTableData;
  column!: DbxTableColumn<Date>;

  get name() {
    return this.item.name;
  }

  get columnName() {
    return this.column.columnName;
  }
}

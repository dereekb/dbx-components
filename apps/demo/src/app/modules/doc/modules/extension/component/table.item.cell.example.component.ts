import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type DbxTableColumn } from '@dereekb/dbx-web/table';
import { type ExampleTableData } from './table.item';

@Component({
  template: `
    <div style="text-align: center">
      <div class="dbx-small">{{ name }}</div>
      <div class="dbx-small">{{ value }}</div>
      <div class="dbx-small dbx-hint">{{ columnName }}</div>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableItemCellExampleComponent {
  item!: ExampleTableData;
  column!: DbxTableColumn<Date>;

  get name() {
    return this.item.name;
  }

  get value() {
    const day = this.column.meta.getDay();
    return this.item.columnValues[day];
  }

  get columnName() {
    return this.column.columnName;
  }
}

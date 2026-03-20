import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type ExampleTableData, type ExampleTableGroupData } from './table.item';
import { type DbxTableItemGroup } from '@dereekb/dbx-web/table';

@Component({
  template: `
    <div>Footer View For: {{ name }}</div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableGroupFooterExampleComponent {
  group!: DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>;

  get name() {
    return this.group.meta.groupName;
  }
}

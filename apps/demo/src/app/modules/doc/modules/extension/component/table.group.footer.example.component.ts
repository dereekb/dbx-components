import { Component } from '@angular/core';
import { ExampleTableData, ExampleTableGroupData } from './table.item';
import { DbxTableItemGroup } from '@dereekb/dbx-web/table';

@Component({
  template: `
    <div>Footer View For: {{ name }}</div>
  `,
  standalone: true
})
export class DocExtensionTableGroupFooterExampleComponent {
  group!: DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>;

  get name() {
    return this.group.meta.groupName;
  }
}

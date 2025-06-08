import { Component } from '@angular/core';
import { ExampleTableData, ExampleTableGroupData } from './table.item';
import { DbxTableItemGroup } from '@dereekb/dbx-web/table';

@Component({
  template: `
    <div>{{ name }} - {{ group.items.length }} Items</div>
    <div class="dbx-small dbx-hint">This group header spans across the entire table. It is a custom component that is configured to inject any other component in your app.</div>
  `,
  standalone: true
})
export class DocExtensionTableGroupHeaderExampleComponent {
  group!: DbxTableItemGroup<ExampleTableData, ExampleTableGroupData>;

  get name() {
    return this.group.meta.groupName;
  }
}

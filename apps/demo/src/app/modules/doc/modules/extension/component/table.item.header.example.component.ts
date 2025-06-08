import { Component } from '@angular/core';
import { ExampleTableData } from './table.item';

@Component({
  template: `
    <div>{{ name }}</div>
    <div class="dbx-small dbx-hint">Item Header</div>
  `,
  standalone: true
})
export class DocExtensionTableItemHeaderExampleComponent {
  item!: ExampleTableData;

  get name() {
    return this.item.name;
  }
}

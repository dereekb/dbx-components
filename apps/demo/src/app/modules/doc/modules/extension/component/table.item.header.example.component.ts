import { Component } from '@angular/core';
import { ExampleTableData } from './table.item';

@Component({
  template: `
    <div>{{ name }}</div>
  `
})
export class DocExtensionTableItemHeaderExampleComponent {
  item!: ExampleTableData;

  get name() {
    return this.item.name;
  }
}

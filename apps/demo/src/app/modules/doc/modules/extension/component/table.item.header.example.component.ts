import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { Maybe } from '@dereekb/util';
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

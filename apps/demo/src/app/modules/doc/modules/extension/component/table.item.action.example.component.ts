import { filterMaybe } from '@dereekb/rxjs';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, Input } from '@angular/core';
import { AbstractDbxInjectionDirective } from '@dereekb/dbx-core';
import { map, distinctUntilChanged, BehaviorSubject, switchMap } from 'rxjs';
import { Maybe } from '@dereekb/util';

@Component({
  template: `
    <div class="doc-example-table-action-cell">
      <button mat-icon-button><mat-icon>thumb_up</mat-icon></button>
      <dbx-button-spacer></dbx-button-spacer>
      <button mat-icon-button><mat-icon>thumb_down</mat-icon></button>
    </div>
  `,
  styleUrls: ['./table.item.action.example.scss']
})
export class DocExtensionTableItemActionExampleComponent {}

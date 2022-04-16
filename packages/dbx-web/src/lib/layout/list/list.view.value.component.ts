import { Component } from '@angular/core';
import { shareReplay, map, first } from 'rxjs';
import { DbxValueListItem, AbstractDbxValueListViewConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { AnchorType, anchorTypeForAnchor } from '@dereekb/dbx-core';

export interface DbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any> extends AbstractDbxValueListViewConfig<T, I, V> {
  emitAllClicks?: boolean;
}

/**
 * Abstract list view that has a pre-built-in selection change event for an Angular Material MatSelectionListChange.
 */
@Component({
  selector: 'dbx-list-view',
  template: `
    <mat-nav-list>
      <dbx-anchor *ngFor="let item of (items$ | async)" [anchor]="item.anchor" [disabled]="item.disabled">
        <a mat-list-item class="dbx-list-view-item" [disabled]="item.disabled" (click)="onClickItem(item)">
          <mat-icon matListIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
          <div dbx-injection [config]="item.config"></div>
        </a>
      </dbx-anchor>
    </mat-nav-list>
  `,
  host: {
    'class': 'dbx-list-view'
  }
})
export class DbxValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = any, C extends DbxValueListViewConfig<T, I, V> = DbxValueListViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {

  readonly emitAllClicks$ = this.config$.pipe(map(x => x.emitAllClicks), shareReplay(1));

  onClickItem(item: DbxValueListItem<T>) {

    // do not emit clicks for disabled items.
    if (!item.disabled) {
      this.emitAllClicks$.pipe(first()).subscribe((emitAll) => {
        // only emit clicks for items with no anchor, or plain anchors.
        if (emitAll || !item.anchor || anchorTypeForAnchor(item.anchor) === AnchorType.PLAIN) {
          this.onClickValue(item.value);
        }
      });
    }
  }

}

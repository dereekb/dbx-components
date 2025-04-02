import { Observable, map, shareReplay, distinctUntilChanged, of } from 'rxjs';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, computed, input, signal } from '@angular/core';
import { MatListOption, MatSelectionList, MatSelectionListChange } from '@angular/material/list';
import { DbxListSelectionMode, ListSelectionState, ListSelectionStateItem } from './list.view';
import { DbxValueListItem, AbstractDbxValueListViewConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { type Maybe } from '@dereekb/util';
import { DbxValueListViewContentComponent } from './list.view.value.component';
import { NgSwitch, NgSwitchCase, NgSwitchDefault, NgFor, AsyncPipe } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

export interface DbxSelectionValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends AbstractDbxValueListViewConfig<T, I, V> {
  readonly multiple?: boolean;
}

// MARK: DbxSelectionValueListViewContentComponent
/**
 * Content view for a DbxSelectionValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-selection-list-view-content',
  template: `
    @switch (selectionMode()) {
      @case ('view') {
        <dbx-list-view-content [items]="items()"></dbx-list-view-content>
      }
      @default {
        <mat-selection-list [disabled]="disabledSignal()" [multiple]="multiple()" (selectionChange)="matSelectionChanged($event)">
          @for (item of items(); trackBy: trackByFunctionSignal()($index, item)) {
            <mat-list-option class="dbx-list-view-item" [selected]="item.selected" [disabled]="item.disabled" [value]="item.itemValue" (click)="onClickValue(item.itemValue)">
              @if (item.icon) {
                <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              }
              <dbx-injection [config]="item.config"></dbx-injection>
            </mat-list-option>
          }
        </mat-selection-list>
      }
    }
  `,
  host: {
    class: 'dbx-list-view dbx-selection-list-view'
  },
  standalone: true,
  imports: [MatSelectionList, MatListOption, MatIcon, DbxInjectionComponent, DbxValueListViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSelectionValueListViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> extends DbxValueListViewContentComponent<T, I> {
  readonly multiple = input<Maybe<boolean>>();
  readonly selectionMode = input<Maybe<DbxListSelectionMode>>();
  readonly trackByFunctionSignal = toSignal(this.trackBy$);

  constructor() {
    super();
    if (!this.dbxListView.selectionChange) {
      throw new Error('DbxSelectionValueListViewContentComponent(): Parent dbxListView is missing a required selectionChange output ref.');
    }
  }

  matSelectionChanged(selection: MatSelectionListChange): void {
    const options = selection.source.selectedOptions.selected;
    const items: ListSelectionStateItem<T>[] = options.map((x) => {
      const { value: itemValue, selected, disabled } = x;
      return { itemValue, selected, disabled };
    });

    // asserted in constructor
    this.dbxListView.selectionChange?.emit({ items });
  }
}

// MARK: DbxSelectionValueListViewComponent
/**
 * Renders a selection list view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-selection-list-view',
  template: `
    <dbx-selection-list-view-content [selectionMode]="selectionModeSignal()" [multiple]="multipleSignal()" [items]="itemsSignal()"></dbx-selection-list-view-content>
  `,
  standalone: true,
  imports: [DbxSelectionValueListViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxSelectionValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends AbstractDbxValueListViewDirective<T, I, V, DbxSelectionValueListViewConfig<T, I, V>> {
  readonly selectionMode$ = (this.dbxListView.selectionMode$ ?? of('select')).pipe(
    map((x) => x ?? 'select'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly selectionModeSignal = toSignal(this.selectionMode$, { initialValue: 'select' as DbxListSelectionMode });
  readonly multipleSignal = computed(() => this.config()?.multiple ?? true);
}

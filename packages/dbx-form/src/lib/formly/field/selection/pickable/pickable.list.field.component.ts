import { Component } from '@angular/core';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE, AbstractDbxSelectionListWrapperDirective, provideDbxListView, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, ListSelectionState, addConfigToValueListItems, DbxListSelectionMode } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { map, shareReplay } from 'rxjs';
import { PickableValueFieldDisplayValue } from './pickable';
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from './pickable.field.directive';

/**
 * Used for picking pre-set values using a selection list as the presentation.
 */
@Component({
  templateUrl: 'pickable.list.field.component.html'
})
export class DbxPickableListFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {
  onSelectionChange(event: unknown) {
    const items = (event as ListSelectionState<PickableValueFieldDisplayValue<T>>).items;
    const values = items.map((x) => x.itemValue.value);
    this.setValues(values);
  }
}

// MARK: Selection List
@Component({
  selector: 'dbx-form-pickable-item-field-item-list',
  template: DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE
})
export class DbxPickableListFieldItemListComponent<T> extends AbstractDbxSelectionListWrapperDirective<PickableItemFieldItem<T>> {
  constructor() {
    super({
      componentClass: DbxPickableListFieldItemListViewComponent
    });
  }
}

/**
 * NOTE: Values input are PickableItemFieldItem<T>, but output values are PickableValueFieldDisplayValue<T>.
 */
@Component({
  template: `
    <dbx-selection-list-view-content [multiple]="multiple" [selectionMode]="selectionMode" [items]="items$ | async"></dbx-selection-list-view-content>
  `,
  providers: provideDbxListView(DbxPickableListFieldItemListViewComponent)
})
export class DbxPickableListFieldItemListViewComponent<T> extends AbstractDbxSelectionListViewDirective<any> {
  // TODO: any belongs here for now, but item list typings need to be updated.

  readonly config: DbxInjectionComponentConfig = {
    componentClass: DbxPickableListFieldItemListViewItemComponent
  };

  get multiple(): boolean {
    return !this.dbxPickableListFieldComponent.pickOnlyOne;
  }

  get selectionMode(): Maybe<DbxListSelectionMode> {
    let selectionMode: Maybe<DbxListSelectionMode> = 'select';

    if (this.dbxPickableListFieldComponent.disabled && this.dbxPickableListFieldComponent.changeSelectionModeToViewOnDisabled) {
      selectionMode = 'view';
    }

    return selectionMode;
  }

  readonly items$ = this.values$.pipe(
    // NOTE: This causes the "value" to be a PickableValueFieldDisplayValue<T>, which means we emit PickableValueFieldDisplayValue<T> to DbxPickableListFieldComponent.
    map((x) => addConfigToValueListItems(this.config, x)),
    shareReplay(1)
  );

  constructor(readonly dbxPickableListFieldComponent: DbxPickableListFieldComponent<T>) {
    super();
  }
}

@Component({
  template: `
    <div class="dbx-default-pickable-item-field-list-item">
      <mat-icon class="dbx-icon-spacer" *ngIf="icon">{{ icon }}</mat-icon>
      <span class="dbx-chip-label">{{ label }}</span>
      <span class="dbx-chip-sublabel" *ngIf="sublabel">({{ sublabel }})</span>
    </div>
  `
})
export class DbxPickableListFieldItemListViewItemComponent<T> extends AbstractDbxValueListViewItemComponent<PickableValueFieldDisplayValue<T>> {
  get label(): string {
    return this.itemValue.label;
  }

  get sublabel() {
    return this.itemValue.sublabel;
  }

  get icon() {
    return this.itemValue.icon;
  }
}

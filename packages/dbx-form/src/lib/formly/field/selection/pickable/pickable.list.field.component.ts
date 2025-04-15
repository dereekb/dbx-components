import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { AbstractDbxSelectionListWrapperDirective, provideDbxListView, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, ListSelectionState, addConfigToValueListItems, DbxListSelectionMode, provideDbxListViewWrapper, DbxLoadingComponent, DbxSelectionValueListViewContentComponent, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { map, shareReplay } from 'rxjs';
import { PickableValueFieldDisplayValue } from './pickable';
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from './pickable.field.directive';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

// MARK: Selection List
@Component({
  selector: 'dbx-form-pickable-item-field-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: provideDbxListViewWrapper(DbxPickableListFieldItemListComponent),
  standalone: true
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
    <dbx-selection-list-view-content [multiple]="multiple" [selectionMode]="selectionMode" [items]="itemsSignal()"></dbx-selection-list-view-content>
  `,
  providers: provideDbxListView(DbxPickableListFieldItemListViewComponent),
  imports: [DbxSelectionValueListViewContentComponent],
  standalone: true
})
export class DbxPickableListFieldItemListViewComponent<T> extends AbstractDbxSelectionListViewDirective<any> {
  readonly dbxPickableListFieldComponent = inject(DbxPickableListFieldComponent<T>);

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

  readonly itemsSignal = toSignal(this.items$);
}

@Component({
  template: `
    <div class="dbx-default-pickable-item-field-list-item dbx-flex-bar">
      @if (icon) {
        <mat-icon class="dbx-icon-spacer">{{ icon }}</mat-icon>
      }
      <span class="dbx-chip-label">{{ label }}</span>
      @if (sublabel) {
        <span class="dbx-chip-sublabel">({{ sublabel }})</span>
      }
    </div>
  `,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPickableListFieldItemListViewItemComponent<T> extends AbstractDbxValueListViewItemComponent<PickableValueFieldDisplayValue<T>> {
  readonly label = this.itemValue.label;
  readonly sublabel = this.itemValue.sublabel;
  readonly icon = this.itemValue.icon;
}

// List Field Component
/**
 * Used for picking pre-set values using a selection list as the presentation.
 */
@Component({
  templateUrl: 'pickable.list.field.component.html',
  imports: [DbxPickableListFieldItemListComponent, NgTemplateOutlet, FormsModule, ReactiveFormsModule, MatInputModule, MatDivider, DbxLoadingComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPickableListFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {
  onSelectionChange(event: unknown) {
    const items = (event as ListSelectionState<PickableValueFieldDisplayValue<T>>).items;
    const values = items.map((x) => x.itemValue.value);
    this.setValues(values);
  }
}

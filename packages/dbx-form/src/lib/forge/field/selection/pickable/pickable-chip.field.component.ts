import { Component, computed, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule, type MatChipSelectionChange } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type PrimativeKey } from '@dereekb/util';
import { type PickableItemFieldItem } from '../../../../field/selection/pickable/pickable.item';
import { AbstractForgePickableItemFieldDirective } from './pickable.field.directive';
import { setupMetaTracking } from '@ng-forge/dynamic-forms/integration';

/**
 * Listbox value of the "All" chip. Items use their string key, so it never matches one.
 */
const SELECT_ALL_CHIP_VALUE = Symbol('select-all');

/**
 * Forge ValueFieldComponent for pickable chip selection.
 *
 * Renders available values as Material chips with optional text filtering, select-all toggle,
 * and custom display/hash functions. Bridges the FieldTree signal form model with the
 * pickable value loading and caching pipeline.
 */
@Component({
  selector: 'dbx-forge-pickable-chip-field',
  templateUrl: './pickable-chip.field.component.html',
  imports: [ReactiveFormsModule, MatChipsModule, MatIconModule, MatDivider, DbxInjectionComponent]
})
export class DbxForgePickableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgePickableItemFieldDirective<T, M, H> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly selectAllChipValue = SELECT_ALL_CHIP_VALUE;

  /**
   * The selection, as the listbox's value.
   *
   * A chip toggles itself when the user picks it, and the listbox re-applies its own value whenever its chips change (such as
   * when the text filter changes). Binding the value keeps both in line with the field: it is a new array after every items
   * update, so a refused pick is reverted too.
   */
  readonly listboxValueSignal = computed(() => {
    const selectedKeys: unknown[] = this.itemsSignal()
      .filter((x) => x.selected)
      .map((x) => x.key);

    return this.allSelectedSignal() ? [SELECT_ALL_CHIP_VALUE, ...selectedKeys] : selectedKeys;
  });

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta, { selector: 'mat-chip-listbox' });
  }

  itemSelectionChange(event: MatChipSelectionChange, item: PickableItemFieldItem<T, M>): void {
    if (event.isUserInput) {
      this.itemClicked(item);
    }
  }

  selectAllSelectionChange(event: MatChipSelectionChange): void {
    if (event.isUserInput) {
      this.toggleAll();
    }
  }
}

import { Component, effect, ElementRef, inject, untracked, viewChildren } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatListModule, MatListOption, type MatSelectionListChange } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type PrimativeKey, separateValues } from '@dereekb/util';
import { AbstractForgePickableItemFieldDirective } from './pickable.field.directive';
import { setupMetaTracking } from '@ng-forge/dynamic-forms/integration';

/**
 * Forge ValueFieldComponent for pickable list selection.
 *
 * Renders available values as a `mat-selection-list` with checkbox-based selection.
 * Supports text filtering, select-all toggle, and custom display/hash functions.
 * Uses `mat-list-option` items with icon, label, and sublabel content projection.
 */
@Component({
  selector: 'dbx-forge-pickable-list-field',
  templateUrl: './pickable-list.field.component.html',
  imports: [ReactiveFormsModule, MatListModule, MatIconModule, MatDivider, DbxInjectionComponent]
})
export class DbxForgePickableListFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgePickableItemFieldDirective<T, M, H> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly _optionsSignal = viewChildren(MatListOption);

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta, { selector: 'mat-selection-list' });

    // An option toggles itself when the user picks it, and its [selected] binding does not change when that pick is refused, so
    // the selection is re-applied to the options after every items update.
    effect(() => {
      const items = this.itemsSignal();
      const options = this._optionsSignal();
      const selectedKeys = new Set(items.filter((x) => x.selected).map((x) => x.key));

      untracked(() =>
        options.forEach((option) => {
          option.selected = selectedKeys.has(option.value as string);
        })
      );
    });
  }

  /**
   * Applies only the options that changed, so a value without a visible option (hidden by the text filter, or not loaded) stays
   * selected.
   *
   * @param event - The selection change event.
   */
  onSelectionChange(event: MatSelectionListChange): void {
    const { included: pickedOptions, excluded: removedOptions } = separateValues(event.options, (x) => x.selected);

    if (removedOptions.length > 0) {
      this._removeValues(this._valuesForOptions(removedOptions));
    }

    if (pickedOptions.length > 0) {
      this._addValues(this._valuesForOptions(pickedOptions));
    }
  }

  private _valuesForOptions(options: MatListOption[]): T[] {
    const keys = new Set(options.map((x) => x.value as string));

    return this.itemsSignal()
      .filter((x) => keys.has(x.key))
      .map((x) => x.itemValue.value);
  }
}

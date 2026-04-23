import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatListModule, type MatSelectionListChange } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type PrimativeKey } from '@dereekb/util';
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
  imports: [ReactiveFormsModule, MatListModule, MatIconModule, MatDivider, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgePickableListFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgePickableItemFieldDirective<T, M, H> {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    super();
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'mat-selection-list' });
  }

  onSelectionChange(event: MatSelectionListChange): void {
    const selectedValues = event.source.selectedOptions.selected.map((option) => option.value as T);
    this._setValues(selectedValues);
  }

  toggleAll(): void {
    if (this.allSelectedSignal()) {
      this._setValues([]);
    } else {
      const items = this.itemsSignal();
      const allValues = items.filter((x) => !x.disabled).map((x) => x.itemValue.value);
      this._setValues(allValues);
    }
  }
}

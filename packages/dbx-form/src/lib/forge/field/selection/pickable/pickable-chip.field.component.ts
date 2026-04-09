import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type PrimativeKey } from '@dereekb/util';
import { AbstractForgePickableItemFieldDirective } from './pickable.field.directive';

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
  imports: [ReactiveFormsModule, MatChipsModule, MatIconModule, MatDivider, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgePickableChipFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgePickableItemFieldDirective<T, M, H> {
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

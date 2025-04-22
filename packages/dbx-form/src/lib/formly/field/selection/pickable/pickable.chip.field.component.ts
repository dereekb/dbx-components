import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxPickableItemFieldDirective, PickableItemFieldItem } from './pickable.field.directive';
import { MatChipsModule } from '@angular/material/chips';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { MatInputModule } from '@angular/material/input';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Used for picking pre-set values using chips as the presentation.
 */
@Component({
  templateUrl: 'pickable.chip.field.component.html',
  imports: [MatChipsModule, NgTemplateOutlet, FormsModule, ReactiveFormsModule, MatIconModule, MatInputModule, DbxLoadingComponent, MatDivider, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPickableChipListFieldComponent<T> extends AbstractDbxPickableItemFieldDirective<T> {
  itemClicked(item: PickableItemFieldItem<T>): void {
    if (!item.disabled && !this.isReadonlyOrDisabled) {
      if (item.selected) {
        this.removeValue(item.itemValue.value);
      } else {
        this.addValue(item.itemValue.value);
      }
    }
  }
}

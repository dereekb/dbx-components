import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { type PrimativeKey } from '@dereekb/util';
import { AbstractForgePickableItemFieldDirective } from './pickable.field.directive';

/**
 * Forge ValueFieldComponent for pickable list selection.
 *
 * Renders available values as a selectable chip list with optional text filtering
 * and custom display/hash functions. Uses chip-listbox in list layout mode.
 */
@Component({
  selector: 'dbx-forge-pickable-list-field',
  templateUrl: './pickable-list.field.component.html',
  imports: [ReactiveFormsModule, MatChipsModule, MatIconModule, MatDivider, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgePickableListFieldComponent<T = unknown, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractForgePickableItemFieldDirective<T, M, H> {}

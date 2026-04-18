import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FieldWrapperContract, EventDispatcher, arrayEvent, WrapperFieldInputs } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { DbxButtonComponent, DbxButtonSpacerDirective, type DbxButtonStyle } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import { type DbxForgeArrayFieldElementWrapperProps, type DbxForgeArrayItemPair } from './array-field.element.wrapper';

/**
 * Forge wrapper component that wraps a single array item with
 * a drag handle, item label, and remove button.
 *
 * Uses {@link EventDispatcher} and {@link arrayEvent} to remove
 * the item from the parent array.
 */
@Component({
  selector: 'dbx-forge-array-field-element-wrapper',
  templateUrl: './array-field.element.wrapper.component.html',
  imports: [CdkDrag, CdkDragHandle, CdkDragPlaceholder, MatIconModule, MatButtonModule, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeArrayFieldElementWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  private readonly dispatcher = inject(EventDispatcher);

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Props from wrapper config
  readonly fieldInputs = input<WrapperFieldInputs>();

  private readonly wrapperProps = computed(() => (this.fieldInputs()?.props ?? {}) as unknown as DbxForgeArrayFieldElementWrapperProps);

  readonly arrayKeySignal = computed(() => this.wrapperProps().arrayKey);
  readonly indexSignal = computed(() => this.wrapperProps().index);
  readonly disableRearrangeSignal = computed(() => this.wrapperProps().disableRearrange ?? false);
  readonly allowRemoveSignal = computed(() => this.wrapperProps().allowRemove ?? true);
  readonly removeTextSignal = computed(() => this.wrapperProps().removeText ?? 'Remove');

  private static readonly _DEFAULT_REMOVE_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'warn' };

  readonly removeButtonStyleSignal = computed(() => this.wrapperProps().removeButtonStyle ?? DbxForgeArrayFieldElementWrapperComponent._DEFAULT_REMOVE_BUTTON_STYLE);

  readonly labelSignal = computed(() => {
    const props = this.wrapperProps();
    const index = props.index;
    const labelForField = props.labelForField;

    if (!labelForField) {
      return `${index + 1}.`;
    }

    if (typeof labelForField === 'string') {
      return `${index + 1}. ${labelForField}`;
    }

    const pair: DbxForgeArrayItemPair = { index };
    return `${index + 1}. ${(labelForField as FactoryWithRequiredInput<string, DbxForgeArrayItemPair>)(pair)}`;
  });

  removeItem(): void {
    this.dispatcher.dispatch(arrayEvent(this.arrayKeySignal()).removeAt(this.indexSignal()));
  }
}

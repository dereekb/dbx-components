import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FieldWrapperContract, EventDispatcher, arrayEvent, WrapperFieldInputs, ARRAY_CONTEXT } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type DbxButtonStyle, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import { type DbxForgeArrayFieldElementWrapperProps, type DbxForgeArrayItemPair } from './array-field.element.wrapper';

/**
 * Forge wrapper component that wraps a single array item with
 * a drag handle, item label, and remove button.
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

  readonly arrayContext = inject(ARRAY_CONTEXT);

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Props from wrapper config
  readonly fieldInputs = input<WrapperFieldInputs>();

  private readonly wrapperProps = computed(() => (this.fieldInputs()?.props ?? {}) as unknown as DbxForgeArrayFieldElementWrapperProps);

  readonly disableRearrangeSignal = computed(() => this.wrapperProps().disableRearrange ?? false);
  readonly allowRemoveSignal = computed(() => this.wrapperProps().allowRemove ?? true);
  readonly removeTextSignal = computed<string>(() => {
    const text = this.wrapperProps().removeText;
    return typeof text === 'string' ? text : 'Remove';
  });
  readonly removeButtonStyleSignal = computed<DbxButtonStyle>(() => this.wrapperProps().removeButtonStyle ?? { type: 'stroked', color: 'warn' });

  readonly labelSignal = computed(() => {
    const props = this.wrapperProps();
    const index = this.arrayContext.index();
    const labelForField = props.labelForEntry;

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
    this.dispatcher.dispatch(arrayEvent(this.arrayContext.arrayKey).removeAt(this.arrayContext.index()));
  }
}

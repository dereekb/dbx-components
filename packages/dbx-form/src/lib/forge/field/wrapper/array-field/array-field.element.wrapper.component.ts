import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FieldWrapperContract, WRAPPER_FIELD_CONTEXT, EventDispatcher, arrayEvent } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { DbxButtonComponent, DbxButtonSpacerDirective, type DbxButtonStyle } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import type { DbxForgeArrayItemPair } from '../../../field/value/array/array.field';

/**
 * Props for the array-field element wrapper.
 *
 * Passed via the wrapper config and read from {@link WRAPPER_FIELD_CONTEXT}.
 */
export interface DbxForgeArrayFieldElementWrapperProps<T = unknown> {
  /**
   * The key of the parent array field. Used to dispatch remove events.
   */
  readonly arrayKey: string;
  /**
   * Index of this element within the array.
   */
  readonly index: number;
  /**
   * Label for this array item. Can be a static string or a function.
   */
  readonly labelForField?: string | FactoryWithRequiredInput<string, DbxForgeArrayItemPair<T>>;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: string;
  /**
   * Whether this item can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
}

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

  private readonly context = inject(WRAPPER_FIELD_CONTEXT);
  private readonly dispatcher = inject(EventDispatcher);

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  private readonly wrapperProps = computed(() => (this.context.config['props'] ?? {}) as DbxForgeArrayFieldElementWrapperProps);

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

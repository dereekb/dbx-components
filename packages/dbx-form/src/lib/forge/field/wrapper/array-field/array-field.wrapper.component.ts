import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type DynamicText, FieldWrapperContract, WRAPPER_FIELD_CONTEXT, EventDispatcher, arrayEvent } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { DbxButtonComponent, DbxButtonSpacerDirective, type DbxButtonStyle } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import type { DbxForgeArrayItemPair, DbxForgeArrayTemplateField } from '../../../field/value/array/array.field';

/**
 * Props for the array-field wrapper.
 *
 * Passed via the wrapper config and read from {@link WRAPPER_FIELD_CONTEXT}.
 */
export interface DbxForgeArrayFieldWrapperProps<T = unknown> {
  /**
   * Template defining the structure of a single array item.
   * Used when adding new items via the add button.
   */
  readonly template: DbxForgeArrayTemplateField | readonly DbxForgeArrayTemplateField[];
  /**
   * Label for each array item. Can be a static string or a function.
   */
  readonly labelForField?: string | FactoryWithRequiredInput<string, DbxForgeArrayItemPair<T>>;
  /**
   * Text for the add button. Defaults to 'Add'.
   */
  readonly addText?: string;
  /**
   * Text for the remove button. Defaults to 'Remove'.
   */
  readonly removeText?: string;
  /**
   * Whether the add button is shown. Defaults to true.
   */
  readonly allowAdd?: boolean;
  /**
   * Whether items can be removed. Defaults to true.
   */
  readonly allowRemove?: boolean;
  /**
   * Whether drag/drop reordering is disabled. Defaults to false.
   */
  readonly disableRearrange?: boolean;
  /**
   * Style configuration for the add button. Defaults to raised primary.
   */
  readonly addButtonStyle?: DbxButtonStyle;
  /**
   * Style configuration for the remove button. Defaults to stroked warn.
   */
  readonly removeButtonStyle?: DbxButtonStyle;
}

/**
 * Forge wrapper component that wraps an ng-forge `array` field with
 * drag-and-drop reordering, add/remove buttons, and per-item labeling.
 *
 * Uses {@link EventDispatcher} and {@link arrayEvent} to programmatically
 * manipulate the wrapped array field.
 */
@Component({
  selector: 'dbx-forge-array-field-wrapper',
  templateUrl: './array-field.wrapper.component.html',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, MatIconModule, MatButtonModule, DynamicTextPipe, AsyncPipe, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [EventDispatcher]
})
export class DbxForgeArrayFieldWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  private readonly context = inject(WRAPPER_FIELD_CONTEXT);
  private readonly dispatcher = inject(EventDispatcher);

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Wrapper config values
  readonly label = computed(() => this.context.config['label'] as DynamicText | undefined);
  readonly arrayKey = computed(() => this.context.wrapperField.key ?? '');

  private readonly wrapperProps = computed(() => (this.context.config['props'] ?? {}) as DbxForgeArrayFieldWrapperProps);

  readonly templateSignal = computed(() => this.wrapperProps().template);
  readonly disableRearrangeSignal = computed(() => this.wrapperProps().disableRearrange ?? false);
  readonly allowAddSignal = computed(() => this.wrapperProps().allowAdd ?? true);
  readonly allowRemoveSignal = computed(() => this.wrapperProps().allowRemove ?? true);
  readonly addTextSignal = computed(() => this.wrapperProps().addText ?? 'Add');
  readonly removeTextSignal = computed(() => this.wrapperProps().removeText ?? 'Remove');

  private static readonly _DEFAULT_ADD_BUTTON_STYLE: DbxButtonStyle = { type: 'raised', color: 'primary' };
  private static readonly _DEFAULT_REMOVE_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'warn' };

  readonly addButtonStyleSignal = computed(() => this.wrapperProps().addButtonStyle ?? DbxForgeArrayFieldWrapperComponent._DEFAULT_ADD_BUTTON_STYLE);
  readonly removeButtonStyleSignal = computed(() => this.wrapperProps().removeButtonStyle ?? DbxForgeArrayFieldWrapperComponent._DEFAULT_REMOVE_BUTTON_STYLE);

  addItem(): void {
    const template = this.templateSignal();

    if (template) {
      this.dispatcher.dispatch(arrayEvent(this.arrayKey()).append(template as any));
    }
  }

  removeItemAt(index: number): void {
    this.dispatcher.dispatch(arrayEvent(this.arrayKey()).removeAt(index));
  }

  drop(_event: CdkDragDrop<unknown>): void {
    // TODO: ng-forge does not currently expose a reorder/move event via arrayEvent().
    // Drag-drop reordering will need a custom solution or future ng-forge API support.
  }
}

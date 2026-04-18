import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type DynamicText, FieldWrapperContract, EventDispatcher, arrayEvent, FIELD_SIGNAL_CONTEXT, FieldSignalContext, WrapperFieldInputs } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { DbxButtonComponent, DbxButtonSpacerDirective, type DbxButtonStyle } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import { DbxForgeArrayFieldWrapperProps } from './array-field.wrapper';

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

  private readonly fieldSignalContext = inject(FIELD_SIGNAL_CONTEXT) as FieldSignalContext;
  private readonly dispatcher = inject(EventDispatcher);

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  // Props from wrapper config
  readonly fieldInputs = input<WrapperFieldInputs>();

  readonly label = computed(() => this.fieldInputs()?.label);
  readonly arrayKey = computed(() => this.fieldInputs()?.key ?? '');

  private readonly wrapperProps = computed(() => (this.fieldInputs()?.props ?? {}) as DbxForgeArrayFieldWrapperProps);

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
    const template = {}; // this.templateSignal();  // TODO: Hook the template signal back up

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

import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { arrayEvent, type ArrayItemDefinitionTemplate, EventDispatcher, type FieldWrapperContract, WrapperFieldInputs } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { type DbxButtonStyle, DbxButtonComponent } from '@dereekb/dbx-web';
import { forgeFieldDisabled } from '../../field.util';
import { DbxForgeArrayFieldWrapperProps } from './array-field.wrapper';

/**
 * Forge wrapper component that wraps an ng-forge `array` field with
 * a section header (label + hint), a cdkDropList for drag-and-drop reordering,
 * and the array field content.
 *
 * Provides {@link DbxForgeArrayFieldState} so element wrappers can inject it
 * for coordinated add/remove/reorder operations.
 */
@Component({
  selector: 'dbx-forge-array-field-wrapper',
  templateUrl: './array-field.wrapper.component.html',
  imports: [DynamicTextPipe, AsyncPipe, CdkDropList, DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeArrayFieldWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly fieldInputs = input<WrapperFieldInputs>();

  private readonly dispatcher = inject(EventDispatcher);

  /**
   * Wrapper config props passed via addWrappers({ type, props }).
   * ng-forge delivers wrapper config properties (with `type` stripped) as individual inputs.
   */
  readonly props = input<DbxForgeArrayFieldWrapperProps>();

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();

  readonly labelSignal = computed(() => this.props()?.label ?? '');
  readonly hintSignal = computed(() => this.props()?.hint ?? '');
  readonly disableRearrangeSignal = computed(() => this.props()?.disableRearrange ?? false);
  readonly allowAddSignal = computed(() => this.props()?.allowAdd ?? true);
  readonly addTextSignal = computed<string>(() => {
    const text = this.props()?.addText;
    return typeof text === 'string' ? text : 'Add';
  });

  readonly addButtonStyleSignal = computed<DbxButtonStyle>(() => this.props()?.addButtonStyle ?? { type: 'raised', color: 'primary' });

  constructor() {
    console.log('init?');
  }

  drop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    this.move(event.previousIndex, event.currentIndex);
  }
  // MARK: Accessors
  /**
   * Returns the array field key from the wrapper's field inputs.
   */
  private _arrayKey(): string {
    return this.fieldInputs()?.key ?? '';
  }

  /**
   * Returns the item template from the wrapper props.
   *
   * ng-forge requires an explicit template for every dynamic add operation.
   * The template is the container field definition (with element wrappers)
   * built by {@link dbxForgeArrayField} and passed via wrapper props.
   */
  private _itemTemplate(): ArrayItemDefinitionTemplate | undefined {
    return this.props()?.itemTemplate;
  }

  // MARK: Array Value Access
  private _readArrayValue(): unknown[] {
    const formValue = this.fieldInputs()?.field?.value();
    const key = this._arrayKey();

    if (!formValue || !key) {
      return [];
    }

    return ((formValue as Record<string, unknown>)[key] as unknown[]) ?? [];
  }

  // MARK: Operations
  /**
   * Moves an array item from one index to another.
   *
   * Strategy:
   * 1. Insert a new item at toIndex (ng-forge creates a new resolved item)
   * 2. Remove the original item at fromIndex (adjusted for the insertion shift)
   * 3. Patch the form value so the moved item's data ends up at the correct position
   */
  move(fromIndex: number, toIndex: number): void {
    const template = this._itemTemplate();
    const key = this._arrayKey();

    console.log('move', { fromIndex, toIndex, template, key });

    if (!template || !key || fromIndex === toIndex) {
      return;
    }

    this.dispatcher.dispatch(arrayEvent(key).move(fromIndex, toIndex));
  }

  /**
   * Appends a new item to the end of the array using the item template.
   */
  addItem(): void {
    const template = this._itemTemplate();
    const key = this._arrayKey();

    console.log('add item', { template, key });

    if (!template || !key) {
      return;
    }

    this.dispatcher.dispatch(arrayEvent(key).append(template));
  }

  /**
   * Removes an item at the given index.
   */
  removeItem(index: number): void {
    const key = this._arrayKey();

    if (!key) {
      return;
    }

    this.dispatcher.dispatch(arrayEvent(key).removeAt(index));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { arrayEvent, type ArrayItemDefinitionTemplate, EventDispatcher, type FieldWrapperContract, WrapperFieldInputs } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { type DbxButtonStyle, DbxButtonComponent } from '@dereekb/dbx-web';
import { type IndexNumber } from '@dereekb/util';
import { dbxForgeFieldDisabled } from '../../field.util';
import { DbxForgeArrayFieldWrapperProps } from './array-field.wrapper';
import { dbxForgeArrayFieldTemplateWithItemValues } from './array-field.duplicate';
import { DbxForgeFormContextService } from '../../../form/forge.context.service';

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
  private readonly _formContextService = inject(DbxForgeFormContextService);

  /**
   * Wrapper config props passed via addWrappers({ type, props }).
   * ng-forge delivers wrapper config properties (with `type` stripped) as individual inputs.
   */
  readonly props = input<DbxForgeArrayFieldWrapperProps>();

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  readonly labelSignal = computed(() => this.props()?.label ?? '');
  readonly hintSignal = computed(() => this.props()?.hint ?? '');
  readonly disableRearrangeSignal = computed(() => this.props()?.disableRearrange ?? false);
  readonly allowAddSignal = computed(() => this.props()?.allowAdd ?? true);
  readonly addTextSignal = computed<string>(() => {
    const text = this.props()?.addText;
    return typeof text === 'string' ? text : 'Add';
  });

  readonly addButtonStyleSignal = computed<DbxButtonStyle>(() => this.props()?.addButtonStyle ?? { type: 'raised', color: 'primary' });

  /**
   * Current item count read reactively from the form value.
   */
  readonly itemCountSignal = computed(() => this._readArrayValue().length);

  /**
   * Whether the array has reached its configured `maxLength`. When true, the
   * add button is disabled. Returns false when `maxLength` is not set.
   */
  readonly atMaxLengthSignal = computed(() => {
    const maxLength = this.props()?.maxLength;
    return typeof maxLength === 'number' && this.itemCountSignal() >= maxLength;
  });

  /**
   * Add button disabled state — combines the standard disabled flag with the
   * `maxLength` cap so clicking past the limit is prevented.
   */
  readonly addButtonDisabledSignal = computed(() => this.isDisabled() || this.atMaxLengthSignal());

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
  /**
   * Returns the current items for this array field.
   *
   * Reads the parent form value from {@link DbxForgeFormContextService} (which
   * mirrors `DynamicForm.formValue()`) and indexes by the array's key. The
   * wrapper's `fieldInputs.field.value()` is unreliable here — it reports
   * undefined in some render phases — so we source the value from the
   * DynamicForm signal instead.
   */
  private _readArrayValue(): unknown[] {
    const key = this._arrayKey();
    if (!key) {
      return [];
    }

    const formValue = this._formContextService.formValue();
    const value = (formValue as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
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

    if (!template || !key || fromIndex === toIndex) {
      return;
    }

    this.dispatcher.dispatch(arrayEvent(key).move(fromIndex, toIndex));
  }

  /**
   * Appends a new item to the end of the array using the item template.
   *
   * No-ops when the array has reached its configured `maxLength`.
   */
  addItem(): void {
    const template = this._itemTemplate();
    const key = this._arrayKey();

    if (!template || !key || this.atMaxLengthSignal()) {
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

  /**
   * Duplicates the item at `fromIndex`, inserting a copy at `toIndex`.
   *
   * ng-forge's array slots are managed through `arrayEvent` dispatches — writing
   * a bigger value into the form doesn't create a new slot. We read the source
   * item from the form value, stamp its fields onto the template via
   * {@link dbxForgeArrayFieldTemplateWithItemValues}, and dispatch `insertAt`
   * so the slot is registered AND initialized with the duplicated values in a
   * single event (back-to-back dispatches don't settle reliably).
   */
  duplicateItem(fromIndex: IndexNumber, toIndex: IndexNumber): void {
    const template = this._itemTemplate();
    const key = this._arrayKey();

    if (!template || !key) {
      return;
    }

    const items = this._readArrayValue();

    if (fromIndex < 0 || fromIndex >= items.length) {
      return;
    }

    const source = items[fromIndex];
    const templateWithValues = dbxForgeArrayFieldTemplateWithItemValues(template, source);
    const boundedTo = Math.max(0, Math.min(toIndex, items.length));

    this.dispatcher.dispatch(arrayEvent(key).insertAt(boundedTo, templateWithValues));
  }
}

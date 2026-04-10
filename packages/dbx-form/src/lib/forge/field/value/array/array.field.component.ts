import { ChangeDetectionStrategy, Component, computed, effect, input, signal, type Signal } from '@angular/core';
import { type CdkDragDrop, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages, FormConfig } from '@ng-forge/dynamic-forms';
import { DynamicForm } from '@ng-forge/dynamic-forms';
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { DbxButtonComponent, DbxButtonSpacerDirective, type DbxButtonStyle } from '@dereekb/dbx-web';
import type { ForgeArrayFieldProps, ForgeArrayItemPair } from './array.field';
import { forgeFieldDisabled } from '../../field.disabled';

/**
 * Internal state for a single array item.
 */
interface ForgeArrayItem {
  readonly trackId: number;
  value: unknown;
}

let _forgeArrayItemTrackId = 0;

/**
 * Forge ValueFieldComponent that renders a drag-and-drop array.
 *
 * Each array item is rendered as a nested `DynamicForm` using the provided template.
 * Items can be reordered via CDK drag/drop, added, removed, and duplicated.
 *
 * This is the forge equivalent of formly's `DbxFormRepeatArrayTypeComponent`.
 */
@Component({
  selector: 'dbx-forge-array-field',
  templateUrl: './array.field.component.html',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, MatIconModule, MatButtonModule, DynamicForm, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeArrayFieldComponent<T = unknown> {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown[]>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeArrayFieldProps<T> | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly itemsSignal = signal<ForgeArrayItem[]>([]);

  private _initialized = false;

  readonly templateConfigSignal = computed((): FormConfig => {
    const template = this.props()?.template;

    if (!template) {
      return { fields: [] } as unknown as FormConfig;
    }

    const fields = Array.isArray(template) ? template : [template];
    return { fields } as unknown as FormConfig;
  });

  // Disabled state
  readonly isDisabled = forgeFieldDisabled();
  readonly formOptionsSignal = computed(() => (this.isDisabled() ? { disabled: true } : undefined));

  readonly disableRearrangeSignal = computed(() => this.props()?.disableRearrange ?? false);
  readonly allowAddSignal = computed(() => this.props()?.allowAdd ?? true);
  readonly allowRemoveSignal = computed(() => this.props()?.allowRemove ?? true);
  readonly allowDuplicateSignal = computed(() => this.props()?.allowDuplicate ?? false);
  readonly addTextSignal = computed(() => this.props()?.addText ?? 'Add');
  readonly removeTextSignal = computed(() => this.props()?.removeText ?? 'Remove');
  readonly duplicateTextSignal = computed(() => this.props()?.duplicateText ?? 'Duplicate');

  private static readonly _DEFAULT_ADD_BUTTON_STYLE: DbxButtonStyle = { type: 'raised', color: 'primary' };
  private static readonly _DEFAULT_REMOVE_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'warn' };
  private static readonly _DEFAULT_DUPLICATE_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'primary' };

  readonly addButtonStyleSignal = computed(() => this.props()?.addButtonStyle ?? ForgeArrayFieldComponent._DEFAULT_ADD_BUTTON_STYLE);
  readonly removeButtonStyleSignal = computed(() => this.props()?.removeButtonStyle ?? ForgeArrayFieldComponent._DEFAULT_REMOVE_BUTTON_STYLE);
  readonly duplicateButtonStyleSignal = computed(() => this.props()?.duplicateButtonStyle ?? ForgeArrayFieldComponent._DEFAULT_DUPLICATE_BUTTON_STYLE);

  readonly showAddButtonSignal = computed(() => {
    if (!this.allowAddSignal()) {
      return false;
    }

    const maxLength = this.props()?.maxLength;

    if (maxLength != null) {
      return this.itemsSignal().length < maxLength;
    }

    return true;
  });

  constructor() {
    effect(() => {
      const fieldState = this.field()();
      const values = fieldState.value() ?? [];

      if (!this._initialized && Array.isArray(values)) {
        this._initialized = true;
        this.itemsSignal.set(
          values.map((value) => ({
            trackId: _forgeArrayItemTrackId++,
            value
          }))
        );
      }
    });
  }

  /**
   * Cast item value to Partial for the DynamicForm [value] binding.
   */
  asPartial(value: unknown): Record<string, unknown> | undefined {
    return (value as Record<string, unknown>) ?? undefined;
  }

  labelForItem(index: number, value: unknown): string {
    const labelForField = this.props()?.labelForField;

    if (!labelForField) {
      return `${index + 1}.`;
    }

    if (typeof labelForField === 'string') {
      return `${index + 1}. ${labelForField}`;
    }

    const pair: ForgeArrayItemPair<T> = { index, value: value as T };
    return `${index + 1}. ${(labelForField as FactoryWithRequiredInput<string, ForgeArrayItemPair<T>>)(pair)}`;
  }

  onItemValueChange(index: number, newValue: unknown): void {
    const items = [...this.itemsSignal()];

    if (items[index]) {
      items[index] = { ...items[index], value: newValue };
      this.itemsSignal.set(items);
      this._syncToFieldTree();
    }
  }

  addItem(): void {
    const items = [...this.itemsSignal()];
    items.push({ trackId: _forgeArrayItemTrackId++, value: {} });
    this.itemsSignal.set(items);
    this._syncToFieldTree();
  }

  removeItem(index: number): void {
    const items = [...this.itemsSignal()];
    items.splice(index, 1);
    this.itemsSignal.set(items);
    this._syncToFieldTree();
  }

  duplicateItem(index: number): void {
    const items = [...this.itemsSignal()];
    const source = items[index];

    if (!source) {
      return;
    }

    const duplicate: ForgeArrayItem = {
      trackId: _forgeArrayItemTrackId++,
      value: structuredClone(source.value)
    };

    const addToEnd = this.props()?.addDuplicateToEnd ?? false;

    if (addToEnd) {
      items.push(duplicate);
    } else {
      items.splice(index + 1, 0, duplicate);
    }

    this.itemsSignal.set(items);
    this._syncToFieldTree();
  }

  drop(event: CdkDragDrop<unknown>): void {
    const items = [...this.itemsSignal()];
    const [movedItem] = items.splice(event.previousIndex, 1);

    if (movedItem) {
      items.splice(event.currentIndex, 0, movedItem);
      this.itemsSignal.set(items);
      this._syncToFieldTree();
    }
  }

  private _syncToFieldTree(): void {
    const values = this.itemsSignal().map((item) => item.value);
    const fieldState = this.field()();
    fieldState.value.set(values);
    fieldState.markAsTouched();
    fieldState.markAsDirty();
  }
}

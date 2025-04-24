import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { asDecisionFunction, cachedGetter, DecisionFunction, FactoryWithRequiredInput, Getter, getValueFromGetter, IndexRef, makeGetter, type Maybe } from '@dereekb/util';
import { FieldArrayTypeConfig, FieldArrayType, FormlyFieldConfig, FormlyFieldProps, FormlyModule } from '@ngx-formly/core';
import { DbxBarDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface DbxFormRepeatArrayPair<T = unknown> extends IndexRef {
  readonly value?: T | undefined;
}

export interface DbxFormRepeatArrayFieldConfigPair<T = unknown> extends Partial<DbxFormRepeatArrayPair<T>> {
  readonly fieldConfig: FormlyFieldConfig;
}

export type DbxFormRepeatArrayAddTemplateFunction<T> = FactoryWithRequiredInput<Partial<Maybe<T>>, number>;

export interface DbxFormRepeatArrayConfig<T = unknown> extends Pick<FormlyFieldProps, 'maxLength' | 'label' | 'description'> {
  readonly labelForField?: string | FactoryWithRequiredInput<string, DbxFormRepeatArrayFieldConfigPair<T>>;
  /**
   * Text for the add button.
   */
  readonly addText?: string;
  /**
   * Optional template function to create a new template when using the add button.
   */
  readonly addTemplate?: DbxFormRepeatArrayAddTemplateFunction<T>;
  /**
   * Text for the duplicate button.
   */
  readonly duplicateText?: string;
  /**
   * Text for the remove button.
   */
  readonly removeText?: string;
  /**
   * Whethe or not to disable rearranging items.
   *
   * False by default.
   */
  readonly disableRearrange?: boolean;
  /**
   * Wether or not to show the add button.
   *
   * True by default.
   */
  readonly allowAdd?: boolean;
  /**
   * Whether or not to allow duplicateing items. Can optionally pass a decision function that decides whether or not a specific item can be removed.
   */
  readonly allowDuplicate?: boolean | DecisionFunction<DbxFormRepeatArrayPair<T>>;
  /**
   * Whether or not to allow removing items. Can optionally pass a decision function that decides whether or not a specific item can be removed.
   */
  readonly allowRemove?: boolean | DecisionFunction<DbxFormRepeatArrayPair<T>>;
  /**
   * Adds the duplicate to the end of the values
   */
  readonly addDuplicateToEnd?: boolean;
}

@Component({
  template: `
    <div class="dbx-form-repeat-array">
      <dbx-subsection [header]="label" [hint]="description">
        <!-- Fields -->
        <div class="dbx-form-repeat-array-fields" cdkDropList [cdkDropListDisabled]="disableRearrange" (cdkDropListDropped)="drop($event)">
          @for (field of field.fieldGroup; track field.key; let i = $index; let last = $last) {
            <div class="dbx-form-repeat-array-field" cdkDrag cdkDragLockAxis="y">
              <div class="dbx-form-repeat-array-drag-placeholder" *cdkDragPlaceholder></div>
              <dbx-bar class="dbx-form-repeat-array-bar dbx-bar-fixed-height">
                @if (!disableRearrange) {
                  <button class="dbx-form-repeat-array-drag-button" cdkDragHandle mat-stroked-button><mat-icon>drag_handle</mat-icon></button>
                  <dbx-button-spacer></dbx-button-spacer>
                }
                <h4>
                  <span class="repeat-array-number">{{ i + 1 }}</span>
                  <span>{{ labelForItem(field, i) }}</span>
                </h4>
                <span class="dbx-spacer"></span>
                @if (allowDuplicate(i)) {
                  <dbx-button [stroked]="true" [text]="duplicateText" (buttonClick)="duplicate(i)"></dbx-button>
                  <dbx-button-spacer></dbx-button-spacer>
                }
                @if (allowRemove(i)) {
                  <dbx-button color="warn" [stroked]="true" [text]="removeText" (buttonClick)="remove(i)"></dbx-button>
                }
              </dbx-bar>
              <formly-field class="dbx-form-repeat-array-field-content" [field]="field"></formly-field>
            </div>
          }
        </div>
        <!-- Add Button -->
        <div class="dbx-form-repeat-array-footer">
          @if (allowAdd) {
            <dbx-button [raised]="true" [disabled]="addItemDisabled" [text]="addText" (buttonClick)="addClicked()"></dbx-button>
          }
        </div>
      </dbx-subsection>
    </div>
  `,
  imports: [DbxSubSectionComponent, DbxBarDirective, DbxButtonComponent, FormlyModule, DragDropModule, MatIconModule, DbxButtonSpacerDirective, MatFormFieldModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormRepeatArrayTypeComponent<T = unknown> extends FieldArrayType<FieldArrayTypeConfig<DbxFormRepeatArrayConfig>> {
  private readonly _labelForField = cachedGetter(() => {
    const input = this.repeatArrayField.labelForField;

    if (typeof input === 'function') {
      return input;
    } else {
      return makeGetter(input ?? '');
    }
  });

  private readonly _allowRemove: Getter<DecisionFunction<DbxFormRepeatArrayPair<T>>> = cachedGetter(() => {
    return asDecisionFunction(this.field.props.allowRemove, true);
  });

  private readonly _allowDuplicate: Getter<DecisionFunction<DbxFormRepeatArrayPair<T>>> = cachedGetter(() => {
    return asDecisionFunction(this.field.props.allowDuplicate || false, false);
  });

  get repeatArrayField(): DbxFormRepeatArrayConfig {
    return this.field.props;
  }

  get label(): string {
    return this.field.props.label ?? (this.field.key as string);
  }

  get description(): Maybe<string> {
    return this.field.props.description;
  }

  get duplicateText(): string {
    return this.repeatArrayField.addText ?? 'Duplicate';
  }

  get addText(): string {
    return this.repeatArrayField.addText ?? 'Add';
  }

  get addTemplate() {
    return this.repeatArrayField.addTemplate;
  }

  get removeText(): string {
    return this.repeatArrayField.removeText ?? 'Remove';
  }

  get max(): Maybe<number> {
    return this.field.props.maxLength;
  }

  get count(): number {
    return this.field.fieldGroup?.length ?? 0;
  }

  get disableRearrange(): boolean {
    return Boolean(this.field.props.disableRearrange);
  }

  get allowAdd(): boolean {
    return this.field.props.allowAdd ?? true;
  }

  get addDuplicateToEnd(): boolean {
    return this.field.props.addDuplicateToEnd ?? false;
  }

  allowRemove(i: number) {
    const array: unknown[] = this.model;
    const value = array[i] as T | undefined;
    return this._allowRemove()({
      i,
      value
    });
  }

  allowDuplicate(i: number) {
    const array: unknown[] = this.model;
    const value = array[i] as T;
    return this._allowDuplicate()({
      i,
      value
    });
  }

  get addItemDisabled() {
    return !this.canAddItem;
  }

  get canAddItem(): boolean {
    const max = this.max;

    if (max == null) {
      return true;
    } else {
      return this.count < max;
    }
  }

  /**
   * Moves the target index up one value.
   *
   * @param index
   */
  moveUp(index: number) {
    if (index === 0) {
      return;
    }

    this.swapIndexes(index, index - 1);
  }

  moveDown(index: number) {
    this.swapIndexes(index, index + 1);
  }

  addClicked() {
    const addTemplate = this.addTemplate;
    const template = addTemplate ? addTemplate(this.count) : undefined;
    this.add(undefined, template);
  }

  duplicate(index: number) {
    const array: unknown[] = this.model;
    const targetValue = array[index];

    if (!targetValue) {
      return;
    }

    const targetIndex = this.addDuplicateToEnd ? array.length : index;
    this.add(targetIndex, targetValue, { markAsDirty: true });
  }

  swapIndexes(currentIndex: number, targetIndex: number) {
    const array: unknown[] = this.model;
    const targetValue = array[currentIndex];

    if (!targetValue) {
      return;
    }

    this.remove(currentIndex);
    this.add(targetIndex, targetValue, { markAsDirty: true });
    this.formControl.markAsTouched();
  }

  drop(event: CdkDragDrop<unknown>) {
    this.swapIndexes(event.previousIndex, event.currentIndex);
  }

  labelForItem(fieldConfig: FormlyFieldConfig, i: number): string {
    const array: unknown[] = this.model;
    const value = array[i] as T;

    return getValueFromGetter(this._labelForField(), {
      i,
      value,
      fieldConfig
    });
  }
}

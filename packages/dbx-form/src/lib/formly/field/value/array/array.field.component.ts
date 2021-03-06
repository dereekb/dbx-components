import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { FactoryWithInput, getValueFromGetter, Maybe } from '@dereekb/util';
import { FieldArrayTypeConfig, FieldArrayType, FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';

export interface DbxFormRepeatArrayConfig extends FormlyFieldProps {
  labelForField?: string | FactoryWithInput<string, FormlyFieldConfig>;
  addText?: string;
  removeText?: string;
}

@Component({
  template: `
    <div class="dbx-form-repeat-array">
      <dbx-subsection [header]="label">
        <!-- Fields -->
        <div class="dbx-form-repeat-array-fields" cdkDropList (cdkDropListDropped)="drop($event)">
          <div class="dbx-form-repeat-array-field" cdkDrag cdkDragLockAxis="y" *ngFor="let field of field.fieldGroup; let i = index; let last = last">
            <div class="example-custom-placeholder" *cdkDragPlaceholder></div>
            <dbx-bar>
              <button cdkDragHandle mat-flat-button><mat-icon>drag_handle</mat-icon></button>
              <dbx-button-spacer></dbx-button-spacer>
              <h4>
                <span class="repeat-array-number">{{ i + 1 }}</span>
                <span>{{ labelForItem(field) }}</span>
              </h4>
              <span class="dbx-spacer"></span>
              <button mat-flat-button color="warn" (click)="remove(i)">{{ removeText }}</button>
            </dbx-bar>
            <formly-field class="dbx-form-repeat-array-field-content" [field]="field"></formly-field>
          </div>
        </div>
        <!-- Add Button -->
        <div class="dbx-form-repeat-array-footer">
          <button *ngIf="canAdd" mat-raised-button (click)="add()">{{ addText }}</button>
        </div>
      </dbx-subsection>
    </div>
  `
})
export class DbxFormRepeatArrayTypeComponent extends FieldArrayType<FieldArrayTypeConfig<DbxFormRepeatArrayConfig>> {
  get repeatArrayField(): DbxFormRepeatArrayConfig {
    return this.field.props;
  }

  get label(): string {
    return this.field.props.label ?? (this.field.key as string);
  }

  get addText(): string {
    return this.repeatArrayField.addText ?? 'Add';
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

  get canAdd(): boolean {
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

  labelForItem(field: FormlyFieldConfig): string {
    return getValueFromGetter(this.repeatArrayField.labelForField ?? '', field);
  }
}

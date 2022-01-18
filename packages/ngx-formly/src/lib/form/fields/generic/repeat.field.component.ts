import { OnInit } from '@angular/core';
import { Component } from '@angular/core';
import { FieldArrayType, FieldWrapper, FormlyConfig, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface FormRepeatSectionConfig {
  itemLabel?: string;
  addText?: string;
  removeText?: string;
}

export interface FormRepeatTypeTemplateOptions extends FormlyTemplateOptions, FormRepeatSectionConfig {
  repeatSection?: FormRepeatSectionConfig;
}

@Component({
  template: `
    <div class="form-repeat-section">
      <!-- Fields -->
      <div class="form-repeat-section-fields">
        <ng-container *ngFor="let field of field.fieldGroup; let i = index;">
          <div class="form-repeat-section-field">
            <div>
              <h4><span>{{ itemLabel }}</span><span>{{ i + 1 }}</span></h4>
              <dbx-button-spacer></dbx-button-spacer>
              <button mat-button color="warn" (click)="remove(i)">{{ removeText }}</button>
            </div>
            <formly-field [field]="field"></formly-field>
          </div>
          <mat-divider [inset]="true" *ngIf="!last"></mat-divider>
        </ng-container>
      </div>
      <!-- Add Button -->
      <div class="form-repeat-section-footer">
        <button *ngIf="canAdd" mat-button (click)="add()">{{ addText }}</button>
      </div>
    </div>
  `,
  styleUrls: ['./generic.scss']
})
export class DbNgxFormRepeatTypeComponent extends FieldArrayType {

  readonly to: FormRepeatTypeTemplateOptions;

  get repeatSection(): FormRepeatSectionConfig {
    return this.to.repeatSection ?? {};
  }

  get itemLabel(): string {
    return this.repeatSection.itemLabel ?? '#';
  }

  get addText(): string {
    return this.repeatSection.addText ?? 'Add';
  }

  get removeText(): string {
    return this.repeatSection.removeText ?? 'Remove';
  }

  get max(): number {
    return this.field.templateOptions?.maxLength;
  }

  get count(): number {
    return this.field.fieldGroup?.length ?? 0;
  }

  get canAdd(): boolean {
    const max = this.max;

    if (max == null) {
      return true;
    } else {
      return (this.count < max);
    }
  }

}

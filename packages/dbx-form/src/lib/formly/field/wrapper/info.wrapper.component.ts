import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';

export interface FormInfoSectionConfig<T> {
  onInfoClick: () => void;
}

export interface FormInfoSectionWrapperTemplateOptions<T = any> extends FormlyTemplateOptions {
  infoSection: FormInfoSectionConfig<T>;
}

export interface FormInfoSectionWFormlyConfig<T = any> extends FormlyFieldConfig {
  templateOptions?: FormInfoSectionWrapperTemplateOptions<T>;
}

@Component({
  template: `
    <div class="form-info-section" fxLayout="row">
      <div class="form-info-section-content" fxFlex="grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="form-info-section-info" fxFlex="noshrink" fxLayout="column" fxLayoutAlign="center center">
        <button mat-icon-button [attr.aria-label]="'show info button for ' + to.label || 'section'"
          (click)="onInfoClick()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `
})
export class FormInfoSectionWrapperComponent<T> extends FieldWrapper<FormInfoSectionWFormlyConfig<T>> {

  get infoSection(): FormInfoSectionConfig<T> {
    return this.to.infoSection;
  }

  onInfoClick(): void {
    this.infoSection.onInfoClick();
  }

}

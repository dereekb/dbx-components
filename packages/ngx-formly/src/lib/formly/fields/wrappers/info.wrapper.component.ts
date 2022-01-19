import { Component } from '@angular/core';
import { FieldWrapper, FormlyConfig, FormlyFieldConfig, FormlyTemplateOptions } from '@ngx-formly/core';


export interface FormInfoSectionConfig<T> {
  onClicked: (data: T) => void;
  data?: T;
}

export interface FormInfoSectionWrapperTemplateOptions<T = any> extends FormlyTemplateOptions {
  infoSection: FormInfoSectionConfig<T>;
}

@Component({
  template: `
    <div class="form-info-section" fxLayout="row">
      <div class="form-info-section-content" fxFlex="grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="form-info-section-info" fxFlex="noshrink" fxLayout="column" fxLayoutAlign="center center">
        <button mat-icon-button [attr.aria-label]="'show info button for ' + to.label || 'section'"
          (click)="infoClicked()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./wrapper.scss']
})
export class FormInfoSectionWrapperComponent<T> extends FieldWrapper {

  readonly to: FormInfoSectionWrapperTemplateOptions<T>;

  get infoSection(): FormInfoSectionConfig<T> {
    return this.to.infoSection;
  }

  infoClicked(): void {
    this.infoSection.onClicked(this.infoSection.data);
  }

}

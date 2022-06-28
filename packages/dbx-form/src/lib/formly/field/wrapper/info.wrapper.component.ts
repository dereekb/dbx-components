import { Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';

export interface DbxFormInfoConfig extends FormlyFieldProps {
  onInfoClick: () => void;
}

@Component({
  template: `
    <div class="dbx-form-info-wrapper" fxLayout="row">
      <div class="dbx-form-info-wrapper-content" fxFlex="grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="dbx-form-info-wrapper-info" fxFlex="noshrink" fxLayout="column" fxLayoutAlign="center center">
        <button mat-icon-button [attr.aria-label]="'show info button for ' + (to.label || 'section')" (click)="onInfoClick()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `
})
export class DbxFormInfoWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormInfoConfig>> {
  get infoWrapper(): DbxFormInfoConfig {
    return this.props;
  }

  onInfoClick(): void {
    this.infoWrapper.onInfoClick();
  }
}

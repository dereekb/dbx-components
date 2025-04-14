import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldWrapper, FormlyFieldConfig, FormlyFieldProps } from '@ngx-formly/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

export interface DbxFormInfoConfig extends FormlyFieldProps {
  readonly onInfoClick: () => void;
}

@Component({
  template: `
    <div class="dbx-form-info-wrapper dbx-flex-bar">
      <div class="dbx-form-info-wrapper-content dbx-flex-grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="dbx-form-info-wrapper-info dbx-flex-noshrink dbx-flex-column dbx-flex-center">
        <button mat-icon-button [attr.aria-label]="'show info button for ' + (to.label || 'section')" (click)="onInfoClick()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `,
  imports: [MatIconButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormInfoWrapperComponent extends FieldWrapper<FormlyFieldConfig<DbxFormInfoConfig>> {
  get infoWrapper(): DbxFormInfoConfig {
    return this.props;
  }

  onInfoClick(): void {
    this.infoWrapper.onInfoClick();
  }
}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldWrapper, type FormlyFieldConfig, type FormlyFieldProps } from '@ngx-formly/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Configuration for the info wrapper that adds an info icon button beside the field.
 */
export interface DbxFormInfoConfig extends FormlyFieldProps {
  /** Callback invoked when the info button is clicked. */
  readonly onInfoClick: () => void;
}

/**
 * Formly wrapper that renders a Material info icon button beside the wrapped field.
 * Clicking the button invokes the configured `onInfoClick` callback.
 *
 * Registered as Formly wrapper `'info'`.
 */
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
  imports: [MatIconButton, MatIconModule],
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

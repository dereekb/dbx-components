import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FIELD_SIGNAL_CONTEXT, FieldSignalContext, FieldWrapperContract, type WrapperFieldInputs } from '@ng-forge/dynamic-forms';

/**
 * Forge wrapper component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * Implements {@link FieldWrapperContract} and monitors the field tree's
 * pending signal to detect when async validators are running.
 */
@Component({
  selector: 'dbx-forge-working-wrapper',
  template: `
    <div class="dbx-forge-working-wrapper">
      <ng-container #fieldComponent></ng-container>
      @if (showLoading()) {
        <mat-progress-bar mode="indeterminate" class="dbx-forge-working-bar"></mat-progress-bar>
      }
    </div>
  `,
  imports: [MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeWorkingWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  private readonly fieldSignalContext = inject(FIELD_SIGNAL_CONTEXT) as FieldSignalContext;

  readonly showLoading = computed((): boolean => {
    return this.fieldSignalContext.form().pending();
  });
}

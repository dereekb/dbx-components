import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { FieldWrapper } from '@ng-forge/dynamic-forms';
import { FIELD_SIGNAL_CONTEXT } from '@ng-forge/dynamic-forms/integration';

/**
 * Forge wrapper component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * Implements {@link FieldWrapper} and monitors the field tree's
 * pending signal to detect when async validators are running.
 */
@Component({
  selector: 'dbx-forge-working-wrapper',
  template: `
    <div class="dbx-forge-working-wrapper">
      <ng-container #fieldComponent></ng-container>
      @if (showLoadingSignal()) {
        <mat-progress-bar mode="indeterminate" class="dbx-forge-working-bar"></mat-progress-bar>
      }
    </div>
  `,
  imports: [MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeWorkingWrapperComponent implements FieldWrapper {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  private readonly fieldSignalContext = inject(FIELD_SIGNAL_CONTEXT);

  readonly showLoadingSignal = computed((): boolean => {
    return this.fieldSignalContext.form().pending();
  });
}

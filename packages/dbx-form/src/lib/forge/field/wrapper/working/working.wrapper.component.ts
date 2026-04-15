import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FieldWrapperContract, WRAPPER_FIELD_CONTEXT, type WrapperFieldContext } from '@ng-forge/dynamic-forms';
import type { DbxForgeWorkingWrapper } from './working.wrapper';

/**
 * Forge wrapper component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * Implements {@link FieldWrapperContract} and monitors the field tree's
 * pending signal via {@link WRAPPER_FIELD_CONTEXT} to detect when async
 * validators are running.
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

  private readonly context = inject<WrapperFieldContext<DbxForgeWorkingWrapper>>(WRAPPER_FIELD_CONTEXT);

  readonly showLoading = computed((): boolean => {
    return this.context.fieldSignalContext.form()?.pending() ?? false;
  });
}

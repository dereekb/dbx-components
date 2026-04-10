import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { DbxForgeWrapperContentComponent } from '../wrapper.content.component';
import type { DbxForgeWorkingWrapperFieldProps } from './working.wrapper.field';

/**
 * Forge wrapper field component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * This is the forge equivalent of formly's `DbxFormWorkingWrapperComponent`.
 * Monitors the child form's pending signal (via {@link DbxForgeWrapperContentComponent})
 * to detect when async validators are running.
 */
@Component({
  selector: 'dbx-forge-working-wrapper-field',
  template: `
    <div class="dbx-forge-working-wrapper">
      <dbx-forge-wrapper-content />
      @if (showLoadingSignal()) {
        <mat-progress-bar mode="indeterminate" class="dbx-forge-working-bar"></mat-progress-bar>
      }
    </div>
  `,
  providers: provideDbxForgeWrapperFieldDirective(DbxForgeWorkingWrapperFieldComponent),
  imports: [DbxForgeWrapperContentComponent, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class DbxForgeWorkingWrapperFieldComponent extends AbstractForgeWrapperFieldComponent<DbxForgeWorkingWrapperFieldProps> {
  private readonly _content = viewChild(DbxForgeWrapperContentComponent);

  readonly showLoadingSignal = computed((): boolean => {
    return this._content()?.pending() ?? false;
  });
}

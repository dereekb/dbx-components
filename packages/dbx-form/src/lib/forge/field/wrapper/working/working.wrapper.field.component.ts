import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { ForgeWrapperContentComponent } from '../wrapper.content.component';
import type { ForgeWorkingWrapperFieldProps } from './working.wrapper.field';

/**
 * Forge wrapper field component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * This is the forge equivalent of formly's `DbxFormWorkingWrapperComponent`.
 * Monitors the child form's pending signal (via {@link ForgeWrapperContentComponent})
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
  providers: provideDbxForgeWrapperFieldDirective(ForgeWorkingWrapperFieldComponent),
  imports: [ForgeWrapperContentComponent, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeWorkingWrapperFieldComponent extends AbstractForgeWrapperFieldComponent<ForgeWorkingWrapperFieldProps> {
  private readonly _content = viewChild(ForgeWrapperContentComponent);

  readonly showLoadingSignal = computed((): boolean => {
    return this._content()?.pending() ?? false;
  });
}

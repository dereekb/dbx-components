import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { ForgeWrapperContentComponent } from '../wrapper.content.component';
import type { ForgeWorkingWrapperFieldProps } from './working.wrapper.field';

/**
 * Forge wrapper field component that renders child fields with a loading
 * indicator shown during async validation.
 *
 * This is the forge equivalent of formly's `DbxFormWorkingWrapperComponent`.
 * Monitors the field tree's pending signal, which aggregates pending state
 * from all child fields.
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
  styles: `
    .dbx-forge-working-bar {
      margin-top: 4px;
    }
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
  readonly showLoadingSignal = computed((): boolean => {
    const fieldState = this.field()();
    return fieldState.pending?.() ?? false;
  });
}

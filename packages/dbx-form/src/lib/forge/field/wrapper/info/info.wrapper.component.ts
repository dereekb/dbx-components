import { ChangeDetectionStrategy, Component, computed, input, viewChild, ViewContainerRef } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type FieldWrapperContract } from '@ng-forge/dynamic-forms';

/**
 * Forge wrapper component that renders child fields inside a flex layout
 * with an info icon button beside them.
 *
 * Implements {@link FieldWrapperContract} and receives configuration
 * via component inputs.
 */
@Component({
  selector: 'dbx-forge-info-wrapper',
  template: `
    <div class="dbx-form-info-wrapper dbx-flex-bar">
      <div class="dbx-form-info-wrapper-content dbx-flex-grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="dbx-form-info-wrapper-info dbx-flex-noshrink dbx-flex-column dbx-flex-center">
        <button mat-icon-button type="button" (click)="onClick()" [attr.aria-label]="ariaLabelValue()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `,
  imports: [MatIconButton, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeInfoWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  readonly onInfoClick = input<() => void>();
  readonly ariaLabel = input<string>();

  readonly ariaLabelValue = computed(() => {
    return this.ariaLabel() ?? 'More information';
  });

  onClick(): void {
    this.onInfoClick()?.();
  }
}

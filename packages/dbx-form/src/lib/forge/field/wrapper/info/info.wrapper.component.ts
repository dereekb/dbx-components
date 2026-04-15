import { ChangeDetectionStrategy, Component, computed, inject, viewChild, ViewContainerRef } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FieldWrapperContract, WRAPPER_FIELD_CONTEXT, type WrapperFieldContext } from '@ng-forge/dynamic-forms';
import type { DbxForgeInfoWrapper } from './info.wrapper';

/**
 * Forge wrapper component that renders child fields inside a flex layout
 * with an info icon button beside them.
 *
 * Implements {@link FieldWrapperContract} and reads configuration from
 * {@link WRAPPER_FIELD_CONTEXT}.
 */
@Component({
  selector: 'dbx-forge-info-wrapper',
  template: `
    <div class="dbx-form-info-wrapper dbx-flex-bar">
      <div class="dbx-form-info-wrapper-content dbx-flex-grow">
        <ng-container #fieldComponent></ng-container>
      </div>
      <div class="dbx-form-info-wrapper-info dbx-flex-noshrink dbx-flex-column dbx-flex-center">
        <button mat-icon-button type="button" (click)="onClick()" [attr.aria-label]="ariaLabel()">
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

  private readonly context = inject<WrapperFieldContext<DbxForgeInfoWrapper>>(WRAPPER_FIELD_CONTEXT);

  readonly ariaLabel = computed(() => {
    return this.context.config.ariaLabel ?? 'More information';
  });

  onClick(): void {
    this.context.config.onInfoClick();
  }
}

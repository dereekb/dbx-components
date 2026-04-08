import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { ForgeWrapperContentComponent } from '../wrapper.content.component';
import type { ForgeInfoWrapperFieldProps } from './info.wrapper.field';

/**
 * Forge wrapper field component that renders child fields inside a flex layout
 * with an info icon button beside them.
 *
 * This is the forge equivalent of formly's `DbxFormInfoWrapperComponent`,
 * providing a content area with a clickable info button on the right side.
 * Supports wrapping groups of fields, not just single fields.
 */
@Component({
  selector: 'dbx-forge-info-wrapper-field',
  template: `
    <div class="dbx-form-info-wrapper dbx-flex-bar">
      <div class="dbx-form-info-wrapper-content dbx-flex-grow">
        <dbx-forge-wrapper-content />
      </div>
      <div class="dbx-form-info-wrapper-info dbx-flex-noshrink dbx-flex-column dbx-flex-center">
        <button mat-icon-button type="button" (click)="onClick()" [attr.aria-label]="ariaLabelSignal()">
          <mat-icon>info</mat-icon>
        </button>
      </div>
    </div>
  `,
  providers: provideDbxForgeWrapperFieldDirective(ForgeInfoWrapperFieldComponent),
  imports: [ForgeWrapperContentComponent, MatIconButton, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeInfoWrapperFieldComponent extends AbstractForgeWrapperFieldComponent<ForgeInfoWrapperFieldProps> {
  readonly ariaLabelSignal = computed(() => {
    return this.props()?.ariaLabel ?? 'More information';
  });

  onClick(): void {
    this.props()?.onInfoClick();
  }
}

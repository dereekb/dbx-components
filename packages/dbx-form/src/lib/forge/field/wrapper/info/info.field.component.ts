import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import type { ForgeInfoButtonFieldProps } from './info.field';

/**
 * Forge ValueFieldComponent that renders a Material info icon button.
 *
 * Displays a circular icon button with the `info` icon. On click,
 * invokes the `onInfoClick` callback from props.
 */
@Component({
  selector: 'dbx-forge-info-button-field',
  template: `
    <button mat-icon-button type="button" class="dbx-forge-info-button" (click)="onClick()" [attr.aria-label]="ariaLabelSignal()">
      <mat-icon>info</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      align-self: center;
    }
  `,
  imports: [MatIconButton, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeInfoButtonFieldComponent {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<unknown>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeInfoButtonFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly ariaLabelSignal = computed(() => {
    return this.props()?.ariaLabel ?? 'More information';
  });

  onClick(): void {
    this.props()?.onInfoClick();
  }
}

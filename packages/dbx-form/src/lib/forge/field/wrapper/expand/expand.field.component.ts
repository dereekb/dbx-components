import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type FieldTree } from '@angular/forms/signals';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import type { ForgeExpandFieldProps } from './expand.field';

/**
 * Forge ValueFieldComponent that renders an expand/collapse control.
 *
 * Displays as either a Material stroked button or a clickable text link.
 * Writes `true`/`false` to its FieldTree value on click, which drives
 * conditional visibility on sibling groups via ng-forge's `logic` system.
 */
@Component({
  selector: 'dbx-forge-expand-field',
  templateUrl: './expand.field.component.html',
  styles: `
    :host {
      display: block;
    }

    .dbx-forge-expand-text {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      user-select: none;
      color: var(--mat-sys-primary);
      font-size: 0.875rem;
    }

    .dbx-forge-expand-text:hover {
      text-decoration: underline;
    }

    .dbx-forge-expand-text-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class ForgeExpandFieldComponent {
  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<boolean>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeExpandFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  readonly isOpenSignal = computed((): boolean => {
    return this.field()().value() ?? false;
  });

  readonly buttonTypeSignal = computed(() => {
    return this.props()?.buttonType ?? 'text';
  });

  readonly labelSignal = computed(() => {
    return this.props()?.expandLabel ?? '';
  });

  readonly iconSignal = computed(() => {
    return this.isOpenSignal() ? 'expand_less' : 'expand_more';
  });

  toggle(): void {
    const fieldState = this.field()();
    const currentValue = fieldState.value() ?? false;
    fieldState.value.set(!currentValue);
    fieldState.markAsTouched();
  }
}

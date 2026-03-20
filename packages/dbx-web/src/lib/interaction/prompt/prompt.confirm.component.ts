import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxPromptComponent } from './prompt.component';
import { MatButtonModule } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';
import { type Maybe } from '@dereekb/util';

/**
 * Configuration for the confirmation prompt display.
 */
export interface DbxPromptConfirmConfig {
  readonly title?: string;
  readonly prompt?: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
}

/**
 * Renders a confirmation prompt with customizable title, message, confirm, and cancel buttons.
 *
 * @example
 * ```html
 * <dbx-prompt-confirm [config]="{ title: 'Delete?', prompt: 'This cannot be undone.' }" (confirm)="onConfirm()" (cancel)="onCancel()">
 *   <p>Additional content here.</p>
 * </dbx-prompt-confirm>
 * ```
 */
@Component({
  selector: 'dbx-prompt-confirm',
  template: `
    <dbx-prompt [header]="config()?.title" [prompt]="config()?.prompt">
      <ng-content></ng-content>
      <div class="dbx-pt3">
        <button mat-stroked-button (click)="onConfirm()">{{ confirmTextSignal() }}</button>
        <dbx-button-spacer></dbx-button-spacer>
        <button mat-stroked-button color="warn" (click)="onCancel()">{{ cancelTextSignal() }}</button>
      </div>
    </dbx-prompt>
  `,
  standalone: true,
  imports: [DbxPromptComponent, MatButtonModule, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptConfirmComponent {
  readonly config = input<Maybe<DbxPromptConfirmConfig>>({});

  readonly confirmTextSignal = computed(() => this.config()?.confirmText || 'Confirm');
  readonly cancelTextSignal = computed(() => this.config()?.cancelText || 'Cancel');

  readonly confirm = output<void>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DbxPromptComponent } from './prompt.component';
import { MatButtonModule } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';
import { Maybe } from '@dereekb/util';

export interface DbxPromptConfirmConfig {
  readonly title?: string;
  readonly prompt?: string;
  readonly confirmText?: string;
  readonly cancelText?: string;
}

/**
 * Displays a confirmation dialog.
 */
@Component({
  selector: 'dbx-prompt-confirm',
  template: `
    <dbx-prompt [header]="config()?.title" [prompt]="config()?.prompt">
      <ng-content></ng-content>
      <button mat-stroked-button (click)="onConfirm()">{{ confirmTextSignal() }}</button>
      <dbx-button-spacer></dbx-button-spacer>
      <button mat-stroked-button color="warn" (click)="onCancel()">{{ cancelTextSignal() }}</button>
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
  readonly cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';

export enum DbNgxPromptConfirmTypes {
  /**
   * Dialog is for yes/no.
   */
  NORMAL = 'normal',
  /**
   * Dialog is for deleting something.
   */
  DELETE = 'delete'
}

export interface DbNgxPromptConfirmConfig {
  type?: DbNgxPromptConfirmTypes;
  title?: string;
  prompt?: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Displays a confirmation dialog.
 */
@Component({
  selector: 'dbx-prompt-confirm',
  templateUrl: './prompt.confirm.component.html',
  styleUrls: ['./prompt.scss']
})
export class DbNgxPromptConfirmComponent {

  @Input()
  config?: DbNgxPromptConfirmConfig;

  @Output()
  confirm = new EventEmitter<void>();

  @Output()
  cancel = new EventEmitter<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

}

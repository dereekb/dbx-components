import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Maybe } from '@dereekb/util';

export enum DbxPromptConfirmTypes {
  /**
   * Dialog is for yes/no.
   */
  NORMAL = 'normal',
  /**
   * Dialog is for deleting something.
   */
  DELETE = 'delete'
}

export interface DbxPromptConfirmConfig {
  type?: DbxPromptConfirmTypes;
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
  templateUrl: './prompt.confirm.component.html'
})
export class DbxPromptConfirmComponent {
  private _config: DbxPromptConfirmConfig = {};

  @Output()
  readonly confirm = new EventEmitter<void>();

  @Output()
  readonly cancel = new EventEmitter<void>();

  @Input()
  get config(): DbxPromptConfirmConfig {
    return this._config;
  }

  set config(config: Maybe<DbxPromptConfirmConfig>) {
    this._config = config ?? {};
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

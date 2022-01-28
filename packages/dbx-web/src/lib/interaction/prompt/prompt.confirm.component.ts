import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Maybe } from '@dereekb/util';

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
  // TODO: styleUrls: ['./prompt.scss']
})
export class DbNgxPromptConfirmComponent {

  private _config: DbNgxPromptConfirmConfig = {};

  @Output()
  confirm = new EventEmitter<void>();

  @Output()
  cancel = new EventEmitter<void>();

  @Input()
  get config(): DbNgxPromptConfirmConfig {
    return this._config;
  }

  set config(config: Maybe<DbNgxPromptConfirmConfig>) {
    this._config = config ?? {};
  }

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

}

import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { DbxErrorSnackbarComponent, DbxErrorSnackbarConfig } from './error.snackbar.component';

export const DEFAULT_DBX_ERROR_SNACKBAR_CONFIG: DbxErrorSnackbarConfig = {
  politeness: 'polite',
  announcementMessage: 'An error has occurred',
  horizontalPosition: 'center',
  verticalPosition: 'bottom'
};

/**
 * Service used to show errors in the snackbar.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxErrorSnackbarService {
  readonly matSnackbar = inject(MatSnackBar);

  private _defaultConfig: DbxErrorSnackbarConfig = DEFAULT_DBX_ERROR_SNACKBAR_CONFIG;

  get defaultConfig() {
    return this._defaultConfig;
  }

  setDefaultConfig(defaultConfig: DbxErrorSnackbarConfig) {
    this._defaultConfig = defaultConfig;
  }

  showSnackbarError(error: ErrorInput, inputConfig?: Maybe<DbxErrorSnackbarConfig>) {
    const config = {
      ...inputConfig,
      ...this._defaultConfig
    };

    return DbxErrorSnackbarComponent.showErrorSnackbar(this.matSnackbar, error, config);
  }
}

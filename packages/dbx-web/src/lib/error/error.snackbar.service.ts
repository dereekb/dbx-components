import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { type ErrorInput, type Maybe } from '@dereekb/util';
import { DbxErrorSnackbarComponent, type DbxErrorSnackbarConfig } from './error.snackbar.component';

/**
 * Default configuration for error snackbars, using polite announcements centered at the bottom of the viewport.
 */
export const DEFAULT_DBX_ERROR_SNACKBAR_CONFIG: DbxErrorSnackbarConfig = {
  politeness: 'polite',
  announcementMessage: 'An error has occurred',
  horizontalPosition: 'center',
  verticalPosition: 'bottom'
};

/**
 * Application-wide service for displaying error notifications in a Material snackbar.
 *
 * Wraps {@link DbxErrorSnackbarComponent} with configurable defaults. Inject this service
 * to programmatically show error snackbars from any component or service.
 *
 * @example
 * ```typescript
 * const snackbarService = inject(DbxErrorSnackbarService);
 * snackbarService.showSnackbarError(error, { duration: 5000 });
 * ```
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

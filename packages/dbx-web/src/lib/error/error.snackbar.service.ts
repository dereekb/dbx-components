import { Service, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { type ErrorInput, type Maybe, mergeObjects } from '@dereekb/util';
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
 * Application-wide service that shows any {@link ErrorInput} as an error in a Material snackbar.
 *
 * Wraps {@link DbxErrorSnackbarComponent} with configurable defaults. Inject this service
 * to programmatically show error snackbars from any component or service.
 *
 * In templates, prefer `dbxActionSnackbarError` on a `dbxAction`, which calls this service for every action error.
 *
 * {@link DbxErrorSnackbarService.setDefaultConfig} sets the app-wide snackbar defaults. The config passed to
 * {@link DbxErrorSnackbarService.showSnackbarError} overrides them per call; its `undefined` values keep the defaults.
 *
 * @dbxWebComponent
 * @dbxWebSlug error-snackbar-service
 * @dbxWebCategory feedback
 * @dbxWebRelated error-snackbar, action-snackbar-error, error, error-widget-service
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```ts
 * inject(DbxErrorSnackbarService).showSnackbarError(error);
 * ```
 *
 * @example
 * ```ts
 * const snackbar = inject(DbxErrorSnackbarService);
 * snackbar.setDefaultConfig({ ...DEFAULT_DBX_ERROR_SNACKBAR_CONFIG, duration: 8000 }); // app-wide default
 * snackbar.showSnackbarError(error, { verticalPosition: 'top' }); // per-call config wins
 * ```
 */
@Service()
export class DbxErrorSnackbarService {
  readonly matSnackbar = inject(MatSnackBar);

  private _defaultConfig: DbxErrorSnackbarConfig = DEFAULT_DBX_ERROR_SNACKBAR_CONFIG;

  get defaultConfig() {
    return this._defaultConfig;
  }

  /**
   * Replaces the app-wide default snackbar config.
   *
   * @param defaultConfig - The new default config.
   */
  setDefaultConfig(defaultConfig: DbxErrorSnackbarConfig) {
    this._defaultConfig = defaultConfig;
  }

  /**
   * Shows the error in a snackbar.
   *
   * @param error - The error to show.
   * @param inputConfig - Optional per-call config. Its defined values override the default config.
   * @returns The opened snackbar reference.
   */
  showSnackbarError(error: ErrorInput, inputConfig?: Maybe<DbxErrorSnackbarConfig>) {
    const config: DbxErrorSnackbarConfig = mergeObjects<DbxErrorSnackbarConfig>([this._defaultConfig, inputConfig]);

    return DbxErrorSnackbarComponent.showErrorSnackbar(this.matSnackbar, error, config);
  }
}

import { Injectable } from '@angular/core';
import { type ValidationMessages } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { dbxForgeDefaultValidationMessages } from '../validation';
import { type DbxForgeGlobalFormConfigDefaults } from './forge.form';

/**
 * Root-provided service that holds the {@link DbxForgeGlobalFormConfigDefaults} applied
 * as the lowest-priority layer during {@link dbxForgeFinalizeFormConfig} merging.
 *
 * Seeded with {@link dbxForgeDefaultValidationMessages} so apps receive the standard
 * dbx-form validation messages without any explicit configuration.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxForgeGlobalDefaultConfigService {
  private _defaults: DbxForgeGlobalFormConfigDefaults = {
    defaultValidationMessages: dbxForgeDefaultValidationMessages()
  };

  /**
   * Returns the current global defaults applied to every finalized forge form config.
   *
   * @returns The active {@link DbxForgeGlobalFormConfigDefaults} object.
   *
   * @example
   * ```ts
   * const defaults = service.getGlobalDefaults();
   * ```
   */
  getGlobalDefaults(): DbxForgeGlobalFormConfigDefaults {
    return this._defaults;
  }

  /**
   * Replaces the entire global defaults object.
   *
   * @param value - The new {@link DbxForgeGlobalFormConfigDefaults} to apply.
   *
   * @example
   * ```ts
   * service.setGlobalDefaults({ defaultValidationMessages: { required: 'Required' } });
   * ```
   */
  setGlobalDefaults(value: DbxForgeGlobalFormConfigDefaults): void {
    this._defaults = value;
  }

  /**
   * Replaces only the default validation messages on the global defaults, preserving
   * any other fields in the current defaults object.
   *
   * @param messages - The {@link ValidationMessages} to apply, or `undefined` to clear.
   *
   * @example
   * ```ts
   * service.setDefaultValidationMessages({ required: 'This field is required.' });
   * ```
   */
  setDefaultValidationMessages(messages: Maybe<ValidationMessages>): void {
    this._defaults = { ...this._defaults, defaultValidationMessages: messages ?? undefined };
  }
}

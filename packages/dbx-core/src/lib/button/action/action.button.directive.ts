import { Directive, inject, InjectionToken, input, type Provider } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { filter } from 'rxjs';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { cleanSubscription } from '../../rxjs/subscription';
import { type DbxButtonEcho } from '../button';

/**
 * Configuration for the automatic button echo feedback shown by {@link DbxActionButtonDirective}
 * on action success and/or error.
 *
 * Each property accepts a {@link DbxButtonEcho} to customize the feedback, or `false` to disable it.
 *
 * @example
 * ```typescript
 * const config: DbxActionButtonEchoConfig = {
 *   onSuccess: { icon: 'check_circle', color: 'success', duration: 3000 },
 *   onError: false // disable error echo
 * };
 * ```
 */
export interface DbxActionButtonEchoConfig {
  /**
   * Echo to show when the action resolves successfully. Set to `false` to disable.
   */
  readonly onSuccess?: DbxButtonEcho | false;
  /**
   * Echo to show when the action is rejected with an error. Set to `false` to disable.
   */
  readonly onError?: DbxButtonEcho | false;
}

/**
 * Default success echo configuration.
 */
export const DEFAULT_DBX_ACTION_BUTTON_SUCCESS_ECHO: DbxButtonEcho = { icon: 'check', color: 'success', iconOnly: true, duration: 2000 };

/**
 * Default error echo configuration.
 */
export const DEFAULT_DBX_ACTION_BUTTON_ERROR_ECHO: DbxButtonEcho = { icon: 'error', color: 'warn', iconOnly: true, duration: 2000 };

/**
 * Default echo configuration used by {@link DbxActionButtonDirective}.
 */
export const DEFAULT_DBX_ACTION_BUTTON_ECHO_CONFIG: DbxActionButtonEchoConfig = {
  onSuccess: DEFAULT_DBX_ACTION_BUTTON_SUCCESS_ECHO,
  onError: DEFAULT_DBX_ACTION_BUTTON_ERROR_ECHO
};

/**
 * Injection token for providing an app-wide default {@link DbxActionButtonEchoConfig}.
 *
 * When provided, all {@link DbxActionButtonDirective} instances will use this config
 * unless overridden by the per-instance `dbxActionButtonEcho` input.
 *
 * @example
 * ```typescript
 * providers: [
 *   { provide: DBX_ACTION_BUTTON_ECHO_CONFIG, useValue: { onSuccess: false, onError: false } }
 * ]
 * ```
 */
export const DBX_ACTION_BUTTON_ECHO_CONFIG = new InjectionToken<DbxActionButtonEchoConfig>('DbxActionButtonEchoConfig');

/**
 * Creates a provider for the app-wide {@link DbxActionButtonEchoConfig}.
 *
 * @example
 * ```typescript
 * providers: [
 *   provideDbxActionButtonEchoConfig({ onSuccess: { icon: 'done', color: 'ok' }, onError: false })
 * ]
 * ```
 */
export function provideDbxActionButtonEchoConfig(config: DbxActionButtonEchoConfig): Provider {
  return { provide: DBX_ACTION_BUTTON_ECHO_CONFIG, useValue: config };
}

/**
 * Links a {@link DbxButton} to an action context, synchronizing the button's
 * disabled and working states with the action's lifecycle and forwarding
 * button clicks as action triggers.
 *
 * Also provides automatic visual echo feedback on action success and error,
 * configurable via the `dbxActionButtonEcho` input or the {@link DBX_ACTION_BUTTON_ECHO_CONFIG} injection token.
 *
 * Extends {@link DbxActionButtonTriggerDirective} by also binding working/disabled state.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <button dbxButton dbxActionButton [text]="'Submit'">Submit</button>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- Custom echo config -->
 * <button dbxButton dbxActionButton [dbxActionButtonEcho]="{ onSuccess: { icon: 'done', color: 'ok' } }">
 *   Save
 * </button>
 * ```
 */
@Directive({
  selector: '[dbxActionButton]',
  standalone: true
})
export class DbxActionButtonDirective extends DbxActionButtonTriggerDirective {
  private readonly _injectedEchoConfig = inject<Maybe<DbxActionButtonEchoConfig>>(DBX_ACTION_BUTTON_ECHO_CONFIG, { optional: true });

  /**
   * Per-instance echo configuration. Merges over the injected default.
   */
  readonly dbxActionButtonEcho = input<Maybe<DbxActionButtonEchoConfig>>();

  constructor() {
    super();

    cleanSubscription(
      this.source.isWorkingOrWorkProgress$.subscribe((working) => {
        this.dbxButton.setWorking(working);
      })
    );

    cleanSubscription(
      this.source.isDisabled$.subscribe((disabled) => {
        this.dbxButton.setDisabled(disabled);
      })
    );

    // Echo on success
    cleanSubscription(
      this.source.isSuccess$.pipe(filter((isSuccess) => isSuccess)).subscribe(() => {
        const config = this._resolvedEchoConfig();
        const onSuccess = config.onSuccess;

        if (onSuccess !== false && onSuccess != null) {
          this.dbxButton.showButtonEcho(onSuccess);
        }
      })
    );

    // Echo on error
    cleanSubscription(
      this.source.rejected$.pipe(filterMaybe()).subscribe(() => {
        const config = this._resolvedEchoConfig();
        const onError = config.onError;

        if (onError !== false && onError != null) {
          this.dbxButton.showButtonEcho(onError);
        }
      })
    );
  }

  private _resolvedEchoConfig(): DbxActionButtonEchoConfig {
    const instanceConfig = this.dbxActionButtonEcho();
    const injectedConfig = this._injectedEchoConfig;
    const result: DbxActionButtonEchoConfig = {
      ...DEFAULT_DBX_ACTION_BUTTON_ECHO_CONFIG,
      ...injectedConfig,
      ...instanceConfig
    };
    return result;
  }
}

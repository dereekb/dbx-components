import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DBX_ACTION_SNACKBAR_DEFAULTS } from './action.snackbar.default';
import { Service, InjectionToken, type Type, inject } from '@angular/core';
import { MatSnackBar, type MatSnackBarConfig, type MatSnackBarRef } from '@angular/material/snack-bar';
import { type Milliseconds, type Maybe, mergeObjects, MS_IN_SECOND } from '@dereekb/util';
import { DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION, type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarType } from './action.snackbar';
import { type DbxActionSnackbarGeneratorInput, type DbxMakeActionSnackbarGeneratorConfiguration, makeDbxActionSnackbarDisplayConfigGeneratorFunction } from './action.snackbar.generator';

/**
 * Injection token for providing a custom {@link DbxActionSnackbarServiceConfig}.
 */
export const DBX_ACTION_SNACKBAR_SERVICE_CONFIG = new InjectionToken('DbxActionSnackbarServiceConfig');

/**
 * Default snackbar display duration in milliseconds (4 seconds).
 */
export const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = MS_IN_SECOND * 4;

/**
 * Maps snackbar type keys (e.g. "save", "delete") to their generator configurations
 * for producing display configs per loading state.
 */
export interface DbxActionSnackbarEventMakeConfig {
  [key: string]: DbxMakeActionSnackbarGeneratorConfiguration;
}

/**
 * Root-level configuration for the snackbar service, controlling the component class,
 * positioning, default durations, and per-type message configurations.
 */
export interface DbxActionSnackbarServiceConfig<C = unknown> {
  /**
   * Component class to render inside the snackbar. Defaults to {@link DbxActionSnackbarComponent}.
   */
  readonly componentClass: Type<C>;
  /**
   * Snackbar positioning overrides.
   */
  readonly snackbar?: Pick<MatSnackBarConfig, 'horizontalPosition' | 'verticalPosition'>;
  /**
   * Default duration for snackbars without an action.
   */
  readonly defaultDuration?: Milliseconds;
  /**
   * Default duration for snackbars that include an undo action. Defaults to {@link DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION}.
   *
   * The undo window of an action snackbar is resolved in this order:
   * 1. the action's own `duration` (e.g. `dbxActionSnackbarUndoDuration`, or the undo config's `duration`)
   * 2. the display config's `snackbar.duration`
   * 3. this `defaultUndoDuration`
   *
   * An action snackbar is never closed by MatSnackBar's own timer; the snackbar component closes itself only while the action is idle.
   */
  readonly defaultUndoDuration?: Milliseconds;
  /**
   * Per-type message configurations (e.g. "save", "create", "delete").
   */
  readonly eventTypeConfigs: DbxActionSnackbarEventMakeConfig;
}

/**
 * Application-wide service for opening action snackbars and generating display configurations
 * from registered type presets. Merges user-provided config with built-in defaults.
 *
 * @example
 * ```typescript
 * const service = inject(DbxActionSnackbarService);
 * service.openSnackbar({ message: 'Item saved!', button: 'Ok' });
 * ```
 */
@Service()
export class DbxActionSnackbarService<C = DbxActionSnackbarComponent> {
  readonly matSnackBar = inject(MatSnackBar);

  readonly config: DbxActionSnackbarServiceConfig<C> = ((inputConfig) => {
    return {
      ...inputConfig,
      componentClass: inputConfig.componentClass ?? (DbxActionSnackbarComponent as unknown as Type<C>),
      defaultDuration: inputConfig.defaultDuration || DEFAULT_SNACKBAR_DIRECTIVE_DURATION,
      defaultUndoDuration: inputConfig.defaultUndoDuration || DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION,
      eventTypeConfigs: mergeObjects([DBX_ACTION_SNACKBAR_DEFAULTS, inputConfig.eventTypeConfigs]) as DbxActionSnackbarEventMakeConfig
    };
  })(inject<Partial<DbxActionSnackbarServiceConfig<C>>>(DBX_ACTION_SNACKBAR_SERVICE_CONFIG, { optional: true }) ?? {});

  get componentClass(): Type<C> {
    return this.config.componentClass;
  }

  get eventTypeConfigs(): DbxActionSnackbarEventMakeConfig {
    return this.config.eventTypeConfigs;
  }

  /**
   * Opens a new snackbar with the given display configuration, merging with global defaults.
   *
   * When the config has an action (e.g. "Undo"), the snackbar owns the action's reference and destroys it once the snackbar is dismissed,
   * including when a newer snackbar replaces it. The action snackbar is not given a MatSnackBar duration; the component closes itself
   * after the undo window, and only while the action is idle.
   *
   * @param config - Display configuration for the snackbar content and behavior.
   * @returns A reference to the opened Material snackbar.
   */
  openSnackbar<T = unknown, O = unknown>(config: DbxActionSnackbarDisplayConfig<T, O>): MatSnackBarRef<C> {
    const { snackbar: inputSnackbarConfig, action } = config;
    const { snackbar: defaultSnackbarConfig, defaultDuration, defaultUndoDuration } = this.config;
    const { duration: snackbarDuration, ...snackbarConfig } = { ...defaultSnackbarConfig, ...inputSnackbarConfig } as MatSnackBarConfig;

    let matSnackbarConfig: MatSnackBarConfig;

    if (action) {
      // The snackbar component closes itself after the undo window, so MatSnackBar is not given a duration.
      const updatedConfig: DbxActionSnackbarDisplayConfig<T, O> = {
        ...config,
        action: {
          ...action,
          duration: action.duration ?? snackbarDuration ?? defaultUndoDuration ?? DEFAULT_SNACKBAR_UNDO_DIRECTIVE_DURATION
        }
      };

      matSnackbarConfig = { ...snackbarConfig, data: updatedConfig };
    } else {
      matSnackbarConfig = { ...snackbarConfig, data: config, duration: snackbarDuration ?? defaultDuration ?? DEFAULT_SNACKBAR_DIRECTIVE_DURATION };
    }

    const ref = this.matSnackBar.openFromComponent(this.componentClass, matSnackbarConfig);

    if (action) {
      // The snackbar owns the action reference, and destroys it once it closes.
      ref.afterDismissed().subscribe(() => action.reference.destroy());
    }

    return ref;
  }

  /**
   * Generates a snackbar display configuration for the given type and event input,
   * using the registered event type configs. Returns `undefined` if no config is found for the type.
   *
   * @param type - The snackbar type key (e.g. "save", "delete"), or undefined to use "none".
   * @param input - The generator input containing the event and optional undo configuration.
   * @returns The generated display configuration, or `undefined` if no config is registered for the given type.
   */
  generateDisplayConfig<T = unknown, O = unknown>(type: Maybe<DbxActionSnackbarType>, input: DbxActionSnackbarGeneratorInput<T, O>): Maybe<DbxActionSnackbarDisplayConfig<T, O>> {
    const configForType = this.eventTypeConfigs[type ?? 'none'];
    let result: Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

    if (configForType) {
      result = makeDbxActionSnackbarDisplayConfigGeneratorFunction(configForType)(input);
    }

    return result;
  }
}

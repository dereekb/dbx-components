import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DBX_ACTION_SNACKBAR_DEFAULTS } from './action.snackbar.default';
import { Injectable, InjectionToken, type Type, inject } from '@angular/core';
import { MatSnackBar, type MatSnackBarConfig, type MatSnackBarRef } from '@angular/material/snack-bar';
import { type Milliseconds, type Maybe, mergeObjects, MS_IN_SECOND } from '@dereekb/util';
import { type DbxActionSnackbarDisplayConfig, type DbxActionSnackbarType } from './action.snackbar';
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
  /** Component class to render inside the snackbar. Defaults to {@link DbxActionSnackbarComponent}. */
  readonly componentClass: Type<C>;
  /** Snackbar positioning overrides. */
  readonly snackbar?: Pick<MatSnackBarConfig, 'horizontalPosition' | 'verticalPosition'>;
  /** Default duration for snackbars without an action. */
  readonly defaultDuration?: Milliseconds;
  /** Default duration for snackbars that include an undo action. */
  readonly defaultUndoDuration?: Milliseconds;
  /** Per-type message configurations (e.g. "save", "create", "delete"). */
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
@Injectable({
  providedIn: 'root'
})
export class DbxActionSnackbarService<C = DbxActionSnackbarComponent> {
  readonly matSnackBar = inject(MatSnackBar);

  readonly config: DbxActionSnackbarServiceConfig<C> = ((inputConfig) => {
    return {
      ...inputConfig,
      componentClass: inputConfig.componentClass ?? (DbxActionSnackbarComponent as unknown as Type<C>),
      defaultDuration: inputConfig.defaultDuration || DEFAULT_SNACKBAR_DIRECTIVE_DURATION,
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
   * @param config - Display configuration for the snackbar content and behavior.
   * @returns A reference to the opened Material snackbar.
   */
  openSnackbar<T = unknown, O = unknown>(config: DbxActionSnackbarDisplayConfig<T, O>): MatSnackBarRef<C> {
    const { snackbar: inputSnackbarConfig } = config;
    const { snackbar: defaultSnackbarConfig, defaultDuration } = this.config;

    const matSnackbarConfig: MatSnackBarConfig = {
      ...defaultSnackbarConfig,
      ...inputSnackbarConfig,
      data: config
    };

    const duration = config.action?.duration ?? matSnackbarConfig.duration ?? defaultDuration ?? DEFAULT_SNACKBAR_DIRECTIVE_DURATION;

    if (config.action) {
      // Set the duration on the action and create an updated config for the snackbar data
      const updatedConfig: DbxActionSnackbarDisplayConfig<T, O> = {
        ...config,
        action: {
          ...config.action,
          duration
        }
      };

      matSnackbarConfig.data = updatedConfig;
    } else {
      // The snackbar does not close here. The duration is passed to the component and it will close it.
      matSnackbarConfig.duration = duration;
    }

    return this.matSnackBar.openFromComponent(this.componentClass, matSnackbarConfig);
  }

  /**
   * Generates a snackbar display configuration for the given type and event input,
   * using the registered event type configs. Returns `undefined` if no config is found for the type.
   *
   * @param type - The snackbar type key (e.g. "save", "delete"), or undefined to use "none".
   * @param input - The generator input containing the event and optional undo configuration.
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

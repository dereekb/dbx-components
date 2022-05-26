import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DBX_ACTION_SNACKBAR_DEFAULTS } from './action.snackbar.default';
import { Inject, Injectable, InjectionToken, Optional, Type } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';
import { Milliseconds, Maybe, mergeObjects } from '@dereekb/util';
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarType } from './action.snackbar';
import { DbxActionSnackbarGeneratorInput, DbxMakeActionSnackbarGeneratorConfiguration, makeDbxActionSnackbarDisplayConfigGeneratorFunction } from './action.snackbar.generator';
import ms from 'ms';

export const DBX_ACTION_SNACKBAR_SERVICE_CONFIG = new InjectionToken('DbxActionSnackbarServiceConfig');

export const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = ms('4s');

export interface DbxActionSnackbarEventMakeConfig {
  [key: string]: DbxMakeActionSnackbarGeneratorConfiguration;
}

export interface DbxActionSnackbarServiceConfig<C = unknown> {
  readonly componentClass: Type<C>;
  readonly snackbar?: Pick<MatSnackBarConfig, 'horizontalPosition' | 'verticalPosition'>;
  readonly defaultDuration?: Milliseconds;
  readonly defaultUndoDuration?: Milliseconds;
  readonly eventTypeConfigs: DbxActionSnackbarEventMakeConfig;
}

/**
 * Used for managing/configuring the snackbar default values and pushing snackbar events.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxActionSnackbarService<C = DbxActionSnackbarComponent> {
  readonly config: DbxActionSnackbarServiceConfig<C>;

  get componentClass(): Type<C> {
    return this.config.componentClass;
  }

  get eventTypeConfigs(): DbxActionSnackbarEventMakeConfig {
    return this.config.eventTypeConfigs;
  }

  constructor(readonly matSnackBar: MatSnackBar, @Optional() @Inject(DBX_ACTION_SNACKBAR_SERVICE_CONFIG) inputConfig: Partial<DbxActionSnackbarServiceConfig<C>>) {
    inputConfig = inputConfig ?? {};

    this.config = {
      ...inputConfig,
      componentClass: inputConfig.componentClass ?? (DbxActionSnackbarComponent as unknown as Type<C>),
      defaultDuration: inputConfig.defaultDuration || DEFAULT_SNACKBAR_DIRECTIVE_DURATION,
      eventTypeConfigs: mergeObjects([DBX_ACTION_SNACKBAR_DEFAULTS, inputConfig.eventTypeConfigs]) as DbxActionSnackbarEventMakeConfig
    };
  }

  /**
   * Opens a new snackbar given the input configuration.
   *
   * @param config
   * @returns
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
      // Set the duration on the action
      config.action = {
        ...config.action,
        duration
      };
    } else {
      // The snackbar does not close here. The duration is passed to the component and it will close it.
      matSnackbarConfig.duration = duration;
    }

    return this.matSnackBar.openFromComponent(this.componentClass, matSnackbarConfig);
  }

  generateDisplayConfig<T = unknown, O = unknown>(type: Maybe<DbxActionSnackbarType>, input: DbxActionSnackbarGeneratorInput<T, O>): Maybe<DbxActionSnackbarDisplayConfig<T, O>> {
    const configForType = this.eventTypeConfigs[type ?? 'none'];
    let result: Maybe<DbxActionSnackbarDisplayConfig<T, O>>;

    if (configForType) {
      result = makeDbxActionSnackbarDisplayConfigGeneratorFunction(configForType)(input);
    }

    return result;
  }
}

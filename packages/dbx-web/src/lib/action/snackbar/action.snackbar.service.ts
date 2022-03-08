import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DBX_ACTION_SNACKBAR_DEFAULTS } from './action.snackbar.default';
import { Inject, Injectable, InjectionToken, Optional, Type } from "@angular/core";
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from "@angular/material/snack-bar";
import { Milliseconds, Maybe, mergeObjects } from "@dereekb/util";
import { DbxActionSnackbarDisplayConfig, DbxActionSnackbarType } from "./action.snackbar";
import { DbxActionSnackbarGeneratorInput, DbxMakeActionSnackbarGeneratorConfiguration, makeDbxActionSnackbarDisplayConfigGeneratorFunction } from "./action.snackbar.generator";
import ms from "ms";

export const DBX_ACTION_SNACKBAR_SERVICE_CONFIG = new InjectionToken('DbxActionSnackbarServiceConfig');

export const DEFAULT_SNACKBAR_DIRECTIVE_DURATION = ms('4s');

export interface DbxActionSnackbarEventMakeConfig {
  [key: string]: DbxMakeActionSnackbarGeneratorConfiguration;
}

export interface DbxActionSnackbarServiceConfig<C = any> {
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

  constructor(
    readonly matSnackBar: MatSnackBar,
    @Optional() @Inject(DBX_ACTION_SNACKBAR_SERVICE_CONFIG) inputConfig: Partial<DbxActionSnackbarServiceConfig<C>> = {}) {

    this.config = {
      ...inputConfig,
      componentClass: inputConfig.componentClass ?? DbxActionSnackbarComponent as any,
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
  openSnackbar(config: DbxActionSnackbarDisplayConfig): MatSnackBarRef<C> {
    const { snackbar: inputSnackbarConfig } = config;
    const { snackbar: defaultSnackbarConfig, defaultDuration } = this.config;

    const matSnackbarConfig: MatSnackBarConfig = {
      ...defaultSnackbarConfig,
      ...inputSnackbarConfig,
      data: config
    };

    matSnackbarConfig.duration = matSnackbarConfig.duration ?? defaultDuration ?? DEFAULT_SNACKBAR_DIRECTIVE_DURATION;

    return this.matSnackBar.openFromComponent(this.componentClass, matSnackbarConfig);
  }

  generateDisplayConfig(type: Maybe<DbxActionSnackbarType>, input: DbxActionSnackbarGeneratorInput): Maybe<DbxActionSnackbarDisplayConfig> {
    const configForType = this.eventTypeConfigs[type ?? 'none'];
    let result: Maybe<DbxActionSnackbarDisplayConfig>;

    if (configForType) {
      result = makeDbxActionSnackbarDisplayConfigGeneratorFunction(configForType)(input);
    }

    return result;
  }

}

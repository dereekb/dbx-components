import { DASH_CHARACTER_PREFIX_INSTANCE, Destroyable, type Maybe } from '@dereekb/util';
import { asObservable, filterMaybe, ObservableOrValue, tapLog } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, map, switchMap, shareReplay } from 'rxjs';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { DBX_DARK_STYLE_CLASS_SUFFIX, DbxStyleClass, dbxStyleClassCleanSuffix, DbxStyleClassCleanSuffix, DbxStyleClassSuffix, DbxStyleConfig } from './style';

export const DBX_STYLE_DEFAULT_CONFIG_TOKEN = new InjectionToken('DbxStyleServiceDefaultConfig');

/**
 * Used for managing styles within an app.
 */
@Injectable()
export class DbxStyleService implements Destroyable {
  private readonly _defaultConfig = new BehaviorSubject<Maybe<DbxStyleConfig>>(inject<DbxStyleConfig>(DBX_STYLE_DEFAULT_CONFIG_TOKEN));

  private readonly _config = new BehaviorSubject<Maybe<Observable<DbxStyleConfig>>>(undefined);
  private readonly _styleClassSuffix = new BehaviorSubject<Maybe<DbxStyleClassCleanSuffix>>(undefined);

  readonly config$ = this._config.pipe(
    switchMap((x) => {
      if (x == null) {
        return this._defaultConfig;
      } else {
        return x;
      }
    }),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly styleClassSuffix$ = this._styleClassSuffix.pipe(distinctUntilChanged(), shareReplay(1));
  readonly styleClassName$ = this.getStyleClassWithConfig(this.config$);

  /**
   * Returns the style class given the input configuration.
   *
   * @param configObs Observable containing the configuration to use.
   * @returns DbxStyleClass
   */
  getStyleClassWithConfig(configObs: Observable<DbxStyleConfig>): Observable<DbxStyleClass> {
    return combineLatest([configObs, this.styleClassSuffix$]).pipe(
      map(([config, suffix]) => {
        let styleClass = config.style;

        if (suffix != null && config.suffixes) {
          if (config.suffixes.has(suffix)) {
            styleClass = `${styleClass}${DASH_CHARACTER_PREFIX_INSTANCE.prefixSuffixString(suffix)}`;
          }
        }

        return styleClass;
      }),
      distinctUntilChanged(),
      shareReplay(1),
      tapLog('styleClassName$')
    );
  }

  /**
   * Toggles the dark suffix on/off for the service.
   *
   * @param toggle Whether to toggle the suffix on or off
   */
  toggleDarkSuffix(toggle?: Maybe<boolean>) {
    this.toggleSuffix(DBX_DARK_STYLE_CLASS_SUFFIX, toggle);
  }

  /**
   * Toggles the arbitrary suffix on/off for the service.
   *
   * @param suffix The suffix to toggle
   * @param toggle Whether to toggle the suffix on or off
   */
  toggleSuffix(suffix: DbxStyleClassSuffix, toggle?: Maybe<boolean>) {
    // clean the suffix
    suffix = dbxStyleClassCleanSuffix(suffix);

    const toggleValue: boolean = toggle != null ? toggle : this.currentStyleClassSuffix !== suffix;
    let suffixValue: Maybe<DbxStyleClassSuffix> = undefined;

    if (toggleValue) {
      suffixValue = suffix;
    } else {
      suffixValue = undefined;
    }

    this._styleClassSuffix.next(suffixValue);
  }

  get currentStyleClassSuffix(): Maybe<DbxStyleClassCleanSuffix> {
    return this._styleClassSuffix.value;
  }

  setStyleClassSuffix(suffix: Maybe<DbxStyleClassSuffix>) {
    this._styleClassSuffix.next(suffix ? dbxStyleClassCleanSuffix(suffix) : undefined);
  }

  setDefaultConfig(defaultConfig: DbxStyleConfig) {
    this._defaultConfig.next(defaultConfig);
  }

  setConfig(config: ObservableOrValue<DbxStyleConfig>) {
    this._config.next(asObservable(config));
  }

  destroy(): void {
    this._defaultConfig.complete();
    this._config.complete();
    this._styleClassSuffix.complete();
  }
}

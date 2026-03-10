import { DASH_CHARACTER_PREFIX_INSTANCE, type Destroyable, type Maybe } from '@dereekb/util';
import { asObservable, filterMaybe, type ObservableOrValue } from '@dereekb/rxjs';
import { BehaviorSubject, type Observable, combineLatest, distinctUntilChanged, map, switchMap, shareReplay } from 'rxjs';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { DBX_DARK_STYLE_CLASS_SUFFIX, type DbxStyleClass, dbxStyleClassCleanSuffix, type DbxStyleClassCleanSuffix, type DbxStyleClassSuffix, type DbxStyleConfig } from './style';

/**
 * Injection token for providing the default {@link DbxStyleConfig} to {@link DbxStyleService}.
 */
export const DBX_STYLE_DEFAULT_CONFIG_TOKEN = new InjectionToken('DbxStyleServiceDefaultConfig');

/**
 * Manages application-wide style classes and suffix modes (e.g., dark mode).
 *
 * Consumers can set a default style config, override it with an observable config,
 * and toggle style suffixes to switch between style variants at runtime.
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
      shareReplay(1)
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

  /**
   * Returns the current style class suffix, if one is set.
   */
  get currentStyleClassSuffix(): Maybe<DbxStyleClassCleanSuffix> {
    return this._styleClassSuffix.value;
  }

  /**
   * Directly sets the active style class suffix, or clears it if null/undefined.
   */
  setStyleClassSuffix(suffix: Maybe<DbxStyleClassSuffix>) {
    this._styleClassSuffix.next(suffix ? dbxStyleClassCleanSuffix(suffix) : undefined);
  }

  /**
   * Updates the default style configuration used when no override config is set.
   */
  setDefaultConfig(defaultConfig: DbxStyleConfig) {
    this._defaultConfig.next(defaultConfig);
  }

  /**
   * Overrides the active style configuration with the given value or observable.
   */
  setConfig(config: ObservableOrValue<DbxStyleConfig>) {
    this._config.next(asObservable(config));
  }

  /**
   * Clears the active config override if it matches the given reference, reverting to the default config.
   */
  unsetConfig(config: ObservableOrValue<DbxStyleConfig>) {
    if (this._config.value === config) {
      this._config.next(undefined);
    }
  }

  destroy(): void {
    this._defaultConfig.complete();
    this._config.complete();
    this._styleClassSuffix.complete();
  }
}

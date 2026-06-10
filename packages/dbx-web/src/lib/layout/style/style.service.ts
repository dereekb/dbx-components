import { DASH_CHARACTER_PREFIX_INSTANCE, type Destroyable, type Maybe } from '@dereekb/util';
import { asObservable, filterMaybe, type ObservableOrValue } from '@dereekb/rxjs';
import { BehaviorSubject, type Observable, combineLatest, distinctUntilChanged, map, of, switchMap, shareReplay } from 'rxjs';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { DBX_DARK_STYLE_CLASS_SUFFIX, type DbxStyleApplication, type DbxStyleClass, dbxStyleClassCleanSuffix, type DbxStyleClassCleanSuffix, type DbxStyleClassSuffix, type DbxStyleConfig, type DbxStyleSupplement } from './style';

/**
 * Injection token for providing the default {@link DbxStyleConfig} to {@link DbxStyleService}.
 */
export const DEFAULT_DBX_STYLE_CONFIG_TOKEN = new InjectionToken('DbxStyleServiceDefaultConfig');

/**
 * Manages application-wide style classes and suffix modes (e.g., dark mode).
 *
 * Consumers can set a default style config, override it with an observable config,
 * and toggle style suffixes to switch between style variants at runtime.
 *
 * Provided via `provideDbxStyleService()` from `style.providers`.
 *
 * @dbxWebComponent
 * @dbxWebSlug style-service
 * @dbxWebCategory layout
 * @dbxWebRelated style, set-style, style-body, color-service
 *
 * @example
 * ```ts
 * const styleService = inject(DbxStyleService);
 * styleService.toggleDarkSuffix();           // toggle dark mode on/off
 * styleService.setStyleClassSuffix('dark');  // force dark mode
 * ```
 */
@Injectable()
export class DbxStyleService implements Destroyable {
  private readonly _defaultConfig = new BehaviorSubject<Maybe<DbxStyleConfig>>(inject<DbxStyleConfig>(DEFAULT_DBX_STYLE_CONFIG_TOKEN));

  private readonly _config = new BehaviorSubject<Maybe<Observable<DbxStyleConfig>>>(undefined);
  private readonly _styleClassSuffix = new BehaviorSubject<Maybe<DbxStyleClassCleanSuffix>>(undefined);
  private readonly _supplement = new BehaviorSubject<Maybe<Observable<Maybe<DbxStyleSupplement>>>>(undefined);

  readonly config$ = this._config.pipe(
    switchMap((x) => x ?? this._defaultConfig),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly styleClassSuffix$ = this._styleClassSuffix.pipe(distinctUntilChanged(), shareReplay(1));
  readonly styleClassName$ = this.getStyleClassWithConfig(this.config$);

  /**
   * The currently active style supplement, or undefined when none is set.
   */
  readonly supplement$: Observable<Maybe<DbxStyleSupplement>> = this._supplement.pipe(
    switchMap((x) => x ?? of(undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The flattened body application: the root style class plus any supplement classes, alongside the supplement inline styles.
   */
  readonly styleApplication$: Observable<DbxStyleApplication> = combineLatest([this.styleClassName$, this.supplement$]).pipe(
    map(([styleClassName, supplement]) => ({
      classes: [styleClassName, ...(supplement?.classes ?? [])],
      style: supplement?.style ?? {}
    })),
    shareReplay(1)
  );

  /**
   * Returns the style class given the input configuration.
   *
   * @param configObs - Observable containing the configuration to use.
   * @returns DbxStyleClass.
   */
  getStyleClassWithConfig(configObs: Observable<DbxStyleConfig>): Observable<DbxStyleClass> {
    return combineLatest([configObs, this.styleClassSuffix$]).pipe(
      map(([config, suffix]) => {
        let styleClass = config.style;

        if (suffix != null && config.suffixes?.has(suffix)) {
          styleClass = `${styleClass}${DASH_CHARACTER_PREFIX_INSTANCE.prefixSuffixString(suffix)}`;
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
   * @param toggle - Whether to toggle the suffix on or off.
   */
  toggleDarkSuffix(toggle?: Maybe<boolean>) {
    this.toggleSuffix(DBX_DARK_STYLE_CLASS_SUFFIX, toggle);
  }

  /**
   * Toggles the arbitrary suffix on/off for the service.
   *
   * @param suffix - The suffix to toggle.
   * @param toggle - Whether to toggle the suffix on or off.
   */
  toggleSuffix(suffix: DbxStyleClassSuffix, toggle?: Maybe<boolean>) {
    // clean the suffix
    suffix = dbxStyleClassCleanSuffix(suffix);

    const toggleValue: boolean = toggle == null ? this.currentStyleClassSuffix !== suffix : toggle;
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
   *
   * @returns The currently active style class suffix, or undefined if none is set.
   */
  get currentStyleClassSuffix(): Maybe<DbxStyleClassCleanSuffix> {
    return this._styleClassSuffix.value;
  }

  /**
   * Directly sets the active style class suffix, or clears it if null/undefined.
   *
   * @param suffix - The suffix to activate, or nullish to clear the current suffix.
   */
  setStyleClassSuffix(suffix: Maybe<DbxStyleClassSuffix>) {
    this._styleClassSuffix.next(suffix ? dbxStyleClassCleanSuffix(suffix) : undefined);
  }

  /**
   * Updates the default style configuration used when no override config is set.
   *
   * @param defaultConfig - The style configuration to use as the new default.
   */
  setDefaultConfig(defaultConfig: DbxStyleConfig) {
    this._defaultConfig.next(defaultConfig);
  }

  /**
   * Overrides the active style configuration with the given value or observable.
   *
   * @param config - A style configuration value or observable to set as the active override.
   */
  setConfig(config: ObservableOrValue<DbxStyleConfig>) {
    this._config.next(asObservable(config));
  }

  /**
   * Clears the active config override if it matches the given reference, reverting to the default config.
   *
   * @param config - The config reference to compare against the current override.
   */
  unsetConfig(config: ObservableOrValue<DbxStyleConfig>) {
    if (this._config.value === config) {
      this._config.next(undefined);
    }
  }

  /**
   * Sets the active style supplement (classes + inline styles) layered on top of the configured style on the body.
   *
   * @param supplement - A supplement value or observable, or nullish to clear the current supplement.
   */
  setSupplement(supplement: Maybe<ObservableOrValue<Maybe<DbxStyleSupplement>>>) {
    this._supplement.next(supplement == null ? undefined : asObservable(supplement));
  }

  /**
   * Clears the active supplement if it matches the given reference.
   *
   * @param supplement - The supplement reference to compare against the current supplement.
   */
  unsetSupplement(supplement: ObservableOrValue<Maybe<DbxStyleSupplement>>) {
    if (this._supplement.value === supplement) {
      this._supplement.next(undefined);
    }
  }

  destroy(): void {
    this._defaultConfig.complete();
    this._config.complete();
    this._styleClassSuffix.complete();
    this._supplement.complete();
  }
}

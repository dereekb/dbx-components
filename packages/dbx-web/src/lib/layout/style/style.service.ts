import { Destroyable, Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, combineLatest, distinctUntilChanged, map, switchMap, shareReplay } from 'rxjs';
import { Inject, Injectable, InjectionToken, Optional, inject } from '@angular/core';

export const DBX_STYLE_DEFAULT_CONFIG_TOKEN = new InjectionToken('DbxStyleServiceDefaultConfig');

export interface DbxStyleConfig {
  /**
   * Root style name.
   */
  style: string;
  /**
   * Suffixes available to this configuration.
   */
  suffixes?: Set<string>;
}

/**
 * Used for managing styles within an app.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxStyleService implements Destroyable {
  private _defaultConfig = new BehaviorSubject<Maybe<DbxStyleConfig>>(inject<DbxStyleConfig>(DBX_STYLE_DEFAULT_CONFIG_TOKEN));
  private _config = new BehaviorSubject<Maybe<Observable<DbxStyleConfig>>>(undefined);
  private _suffix = new BehaviorSubject<Maybe<string>>(undefined);

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

  readonly suffix$ = this._suffix.pipe(distinctUntilChanged());
  readonly style$ = this.getStyleWithConfig(this.config$);

  get suffix(): Maybe<string> {
    return this._suffix.value;
  }

  set suffix(suffix: Maybe<string>) {
    this._suffix.next(suffix);
  }

  getStyleWithConfig(configObs: Observable<DbxStyleConfig>): Observable<string> {
    return combineLatest([configObs, this.suffix$]).pipe(
      map(([config, suffix]) => {
        let style = config.style;

        if (suffix != null && config.suffixes) {
          const sanitizedSuffix = suffix[0] === '-' ? suffix?.slice(1) : suffix;

          if (config.suffixes.has(sanitizedSuffix)) {
            style = `${style}-${sanitizedSuffix}`;
          }
        }

        return style;
      }),
      distinctUntilChanged()
    );
  }

  toggleDarkSuffix(dark?: Maybe<boolean>) {
    const toggle: boolean = dark != null ? dark : this.suffix !== '-dark';

    if (toggle) {
      this.suffix = '-dark';
    } else {
      this.suffix = undefined;
    }
  }

  setDefaultConfig(defaultConfig: DbxStyleConfig) {
    this._defaultConfig.next(defaultConfig);
  }

  setConfig(config: Observable<DbxStyleConfig>) {
    this._config.next(config);
  }

  destroy(): void {
    this._defaultConfig.complete();
    this._config.complete();
    this._suffix.complete();
  }
}
